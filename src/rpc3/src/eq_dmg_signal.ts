import { findMax, findMin } from "./utils";
import { RainflowDataColumns, EquivalentSignalRow } from "./types";

/**
 * Parses multiple signals of rainflow peak/valley pairs into a column-based structure.
 *
 * Each entry in `rfList` is a Float64Array containing pairs of [peak, valley, peak, valley, ...].
 * We pair each array with the corresponding `repetitions[i]`, which indicates how many times
 * that signal is repeated.
 *
 * For every peak/valley pair, this function:
 *   - Calculates the cycle range (`abs(peak - valley)`).
 *   - Computes the cycle damage using `range^slope * (signalRepeats)`.
 *   - Stores the maximum and minimum values of the cycle (for mean/load analysis).
 *   - Tracks an overall cycle index (`cycleIndex`) to identify each unique cycle globally.
 *
 * The result is a `RainflowDataColumns` object containing parallel Float64Array columns:
 *   - `range`:             Range of each cycle.
 *   - `damageOfCycle`:     Damage contributed by each cycle (range^slope * repeats).
 *   - `cumulDamage`:       Cumulative damage (initially zero, typically filled later).
 *   - `cycleIndex`:        Global index of the cycle.
 *   - `percCumDamage`:     Percent of total damage (initially zero, filled later).
 *   - `maxOfCycle`:        Maximum load in the cycle.
 *   - `cycleReptes`:       Repetitions for that signal, applied to each cycle.
 *   - `minOfCycle`:        Minimum load in the cycle.
 *
 * @param rfList - Array of Float64Arrays, each storing [peak, valley, peak, valley, ...].
 * @param repetitions - How many times each corresponding `rfList` signal is repeated.
 * @param slope - The fatigue exponent used in damage = (range^slope) * repeats.
 * @returns A `RainflowDataColumns` object with one row (index) per cycle across all inputs.
 * @throws Error if `rfList` and `repetitions` lengths differ, or if any `Float64Array` has an odd length.
 */
function parseAllRainflowData(rfList: Float64Array[], repetitions: number[], slope: number): RainflowDataColumns {
  // Basic check
  if (rfList.length !== repetitions.length) {
    throw new Error("rfList and repetitions must be the same length.");
  }

  // Count total cycles across all signals
  let totalCycles = 0;
  for (let i = 0; i < rfList.length; i++) {
    const arr = rfList[i];
    if (arr.length % 2 !== 0) {
      throw new Error(
        `Float64Array at index ${i} has an odd length (must be even for [peak,valley] pairs).`
      );
    }
    totalCycles += arr.length / 2; // each pair is one cycle
  }

  // Allocate the Float64Arrays
  // We'll keep them all the same length = totalCycles
  const range = new Float64Array(totalCycles);
  const damageOfCycle = new Float64Array(totalCycles);
  const cumulDamage = new Float64Array(totalCycles);  // will fill later with 0 for now
  const cycleIndex = new Float64Array(totalCycles);
  const percCumDamage = new Float64Array(totalCycles); // will fill later
  const maxOfCycle = new Float64Array(totalCycles);
  const cycleReptes = new Float64Array(totalCycles);
  const minOfCycle = new Float64Array(totalCycles);

  // Fill each array by iterating over all signals
  let globalCycleCounter = 0; // for cycleIndex
  let fillPosition = 0;       // index in the big arrays

  for (let iSig = 0; iSig < rfList.length; iSig++) {
    const arr = rfList[iSig];
    const signalRepeats = repetitions[iSig];

    // Step over the array in increments of 2
    for (let j = 0; j < arr.length; j += 2) {
      const peak = arr[j];
      const valley = arr[j + 1];

      const r = Math.abs(peak - valley);
      const mx = peak > valley ? peak : valley;
      const mn = peak < valley ? peak : valley;

      // damage = repets * (range^slope)
      const dmg = signalRepeats * Math.pow(r, slope);
      range[fillPosition] = r;
      damageOfCycle[fillPosition] = dmg;
      cumulDamage[fillPosition] = 0; // temporarily 0, to be filled later
      cycleIndex[fillPosition] = globalCycleCounter;
      percCumDamage[fillPosition] = 0; // temporarily 0, to fill later
      maxOfCycle[fillPosition] = mx;
      cycleReptes[fillPosition] = signalRepeats;
      minOfCycle[fillPosition] = mn;

      fillPosition++;
      globalCycleCounter++;
    }
  }

  // Return the columnar structure
  return {
    range,
    damageOfCycle,
    cumulDamage,
    cycleIndex,
    percCumDamage,
    maxOfCycle,
    cycleReptes,
    minOfCycle
  };
}

/**
 * Sorts a `RainflowDataColumns` object by ascending cycle range and returns a new,
 * sorted object along with the total accumulated damage. 
 * 
 * Specifically, this function:
 *   1. Creates an index array of all cycle indices.
 *   2. Sorts that array based on the `range` column in ascending order.
 *   3. Allocates new `Float64Array`s of the same length for each column.
 *   4. Copies each column’s values in ascending-range order into the newly allocated arrays.
 *   5. Computes the total damage (`totalDamage`) as the sum of the sorted `damageOfCycle`.
 *   6. Calculates cumulative damage (`cumulDamage`) and the percent of cumulative damage
 *      (`percCumDamage`) in sorted order.
 *
 * @param columns - The unsorted `RainflowDataColumns` containing parallel arrays for rainflow cycles.
 * @returns A tuple with:
 *   - The new `RainflowDataColumns` object (`sortedColumns`), reordered by ascending `range`.
 *   - The total damage (`totalDamage`) computed from `sortedColumns.damageOfCycle`.
 *
 * @remarks
 * - The original `columns` object is not modified; a new set of arrays is returned.
 * - The newly computed `cumulDamage` and `percCumDamage` reside in the returned, sorted object,
 *   allowing further computations or inspections on the reordered data.
 * - Make sure to use the sorted and returned object (`sortedColumns`) for any subsequent
 *   calculations that rely on ascending cycle range.
 */
function sortRainflowColumns(columns: RainflowDataColumns): [RainflowDataColumns, number] {
  // Columns length
  const n = columns.range.length;

  // Init sorted columns
  const sortedColumns = Object.fromEntries(
    Object.keys(columns).map((key) => [key, new Float64Array(n)])
  ) as unknown as RainflowDataColumns;

  // Create an index array [0..n-1]
  const indices = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    indices[i] = i;
  }

  // Sort that index array by ascending range
  indices.sort((a, b) => columns.range[a] - columns.range[b]);

  // Loop over each property name (range, damageOfCycle, etc.)
  // then assign sortedColumns[key][i] = columns[key][oldPos]
  for (let i = 0; i < n; i++) {
    (Object.keys(sortedColumns) as (keyof RainflowDataColumns)[]).forEach((key) => {
      sortedColumns[key][i] = columns[key][indices[i]];
    });
  }

  // Now compute totalDamage
  let totalDamage = 0;
  for (let i = 0; i < n; i++) {
    totalDamage += sortedColumns.damageOfCycle[i];
  }

  // Fill in cumulDamage & percCumDamage in sorted order
  let runningDamage = 0;
  for (let i = 0; i < n; i++) {
    runningDamage += columns.damageOfCycle[i];
    sortedColumns.cumulDamage[i] = runningDamage;
    sortedColumns.percCumDamage[i] = sortedColumns.damageOfCycle[i] / totalDamage;
  }

  return [sortedColumns, totalDamage];
}

/**
 * Divides rainflow cycles into multiple “damage blocks” using a “max square” heuristic,
 * modifying each cycle’s range in the process and returning updated block boundaries
 * (indices) into the sorted rainflow data.
 *
 * This function:
 *   1. Identifies the largest cycle range (`maxRangeVal`) across all cycles.
 *   2. Initializes block boundaries (`blocksIndexed`) with the first and last cycle indices.
 *   3. Iterates `blocksNumber - 1` times to insert additional boundaries:
 *      - For each existing boundary pair, it computes a partial “damageOfBlock” by
 *        accumulating cycle damage from `lowerBlockBorderIn+1` to `upperBlockBorderIn`.
 *      - Calculates a “max square” (damage * (maxRangeVal - currentRange)) for each cycle,
 *        tracking where the largest square occurs (the “division”).
 *      - Increases the `range` of cycles in `[lowerBoundForAddingIn+1, indexOfDivision]`
 *        by `squareHeight`.
 *      - Inserts the new boundary index (`indexOfDivision`) into `blocksIndexed`.
 *   4. Returns the final array of block boundaries (`blocksIndexed`), now containing
 *      multiple subdivisions within `[0, n-1]`.
 *
 * @param columns - The `RainflowDataColumns` object, which will be directly modified
 *   by increasing the `range` for certain cycles.
 * @param blocksNumber - The total number of desired blocks (this function inserts
 *   `blocksNumber - 1` new boundaries).
 * @returns An array of cycle indices (`blocksIndexed`) that mark the boundaries between blocks,
 *   including the starting index (0) and the ending index (`n-1`).
 *
 * @remarks
 * - The approach replicates a “max square” method from Python code: Each iteration locates
 *   where an additional division (boundary) maximizes damage * (maxRangeVal - currentRange).
 * - After finding the best division within each existing block, this function raises the
 *   ranges of cycles in that newly formed sub-block.
 * - The original `columns.range` is permanently changed for those cycles. If you need to
 *   preserve the original ranges, copy the data before calling this function.
 */
function insertBlockBoundaries(columns: RainflowDataColumns, blocksNumber: number): number[] {
  // Columns length
  const n = columns.range.length;

  // Find largest range
  const maxRangeVal = findMax(columns.range);

  // Initialize block info
  const blocksIndexed = [0, n - 1];

  // 3) Insert new boundaries (blocksNumber - 1) times
  for (let iz = 0; iz < blocksNumber - 1; iz++) {
    let totalMaxSquare = 0;

    // We'll store these each time we find a bigger maxSquare:
    let indexOfDivision = 0;
    let squareHeight = 0;
    let lowerBoundForAddingIn = 0;

    // Evaluate each existing block boundary pair
    for (let x = 0; x < blocksIndexed.length - 1; x++) {
      const lowerBlockBorderIn = blocksIndexed[x];
      const upperBlockBorderIn = blocksIndexed[x + 1];

      let damageOfBlock = 0;

      // Check cycles strictly between (lowerBlockBorderIn, upperBlockBorderIn]
      for (let a = lowerBlockBorderIn + 1; a <= upperBlockBorderIn; a++) {
        damageOfBlock += columns.damageOfCycle[a];
        const rangeA = columns.range[a];
        const maxSquare = damageOfBlock * (maxRangeVal - rangeA);

        if (maxSquare >= totalMaxSquare) {
          totalMaxSquare = maxSquare;
          indexOfDivision = a;
          squareHeight = maxRangeVal - rangeA;
          lowerBoundForAddingIn = lowerBlockBorderIn;
        }
      }
    }

    // Now we apply "squareHeight" to the cycles in 
    // (lowerBoundForAddingIn, indexOfDivision]
    for (let ab = lowerBoundForAddingIn + 1; ab <= indexOfDivision; ab++) {
      columns.range[ab] += squareHeight;
    }
    // Insert the new boundary into both arrays
    blocksIndexed.push(indexOfDivision);
    // Sort them so they remain ascending
    blocksIndexed.sort((a, b) => a - b);
  }

  return blocksIndexed;
}

/**
 * Aggregates rainflow cycles into a set of “equivalent blocks” using precomputed
 * block boundaries and produces a compact representation of each block’s amplitude,
 * mean, and damage data.
 *
 * This function:
 *   1. Iterates over pairs of indices in `blocksIndexed`, treating each pair
 *      `[lowerIdx, upperIdx]` as a block boundary.
 *   2. Accumulates per‐cycle damage within `(lowerIdx+1 .. upperIdx]`, calculates a
 *      representative “finalRange” (taken from the last cycle in the block), and
 *      computes the block’s mean load from the cycle maxima and ranges.
 *   3. Derives each block’s fatigue “repetition” by applying `damage / range^slope`,
 *      and calculates the block’s percentage of total damage.
 *   4. Returns an array of `EquivalentSignalRow`, where each row is:
 *      `[range, mean, repetition, %damage, blockDamage, blockMean]`.
 *
 * @param columns - A `RainflowDataColumns` object, whose cycles have been sorted
 *   or otherwise subdivided. The function reads each cycle’s `range`, `damageOfCycle`,
 *   and `maxOfCycle` to compute block summaries.
 * @param blocksIndexed - An array of cycle indices that denote block boundaries,
 *   including start and end markers (e.g., `[0, 10, 25, 40]`).
 * @param totalDamage - The total accumulated damage across all cycles; used to
 *   compute percentage damage for each block.
 * @param slope - The fatigue exponent used in the block repetition formula
 *   (`blockDamage / finalRange^slope`).
 * @returns An array of `EquivalentSignalRow` rows, each describing one block:
 *   `[range, mean, repetition, %damage, damage, blockMean]`.
 *
 * @remarks
 * - The function excludes the cycle at `lowerIdx` itself, iterating from
 *   `lowerIdx+1` up to and including `upperIdx`.
 * - For each block, the last cycle’s `range` is used as `finalRange`, and the
 *   average of `(maxOfCycle - range / 2)` across all block cycles is taken as the
 *   block’s overall mean load.
 * - This representation makes it easier to create a condensed test signal or
 *   analyze block-level fatigue damage.
 */
function buildEquivalentSignalBlocks(
  columns: RainflowDataColumns, blocksIndexed: number[], totalDamage: number, slope: number
): EquivalentSignalRow[] {
  const eqSignal: EquivalentSignalRow[] = [];

  for (let b = 0; b < blocksIndexed.length - 1; b++) {
    const lowerIdx = blocksIndexed[b];
    const upperIdx = blocksIndexed[b + 1];
    
    let blockDamage = 0;
    let sumOfMaxes = 0;
    let sumOfMeans = 0;
    let numberOfCycles = 0;

    // We'll define a finalRange = columns.range of the "last" cycle in this block
    let finalRange = 0;

    for (let i = lowerIdx+1; i <= upperIdx; i++) {
      blockDamage += columns.damageOfCycle[i];
      finalRange = columns.range[i];
      sumOfMaxes += columns.maxOfCycle[i];
      sumOfMeans += (columns.maxOfCycle[i] - columns.range[i] / 2.0);
      numberOfCycles++;
    }

    if (numberOfCycles > 0) {
      const blockMean = sumOfMeans / numberOfCycles;
      // In your new order: [range, mean, repetition, %damage, damage, lastOne]
      eqSignal.push([
        finalRange,                                   // range
        blockMean,                                    // mean
        blockDamage / Math.pow(finalRange, slope),    // repetition
        (blockDamage * 100) / totalDamage,            // % damage
        blockDamage,                                  // blockDamage
        blockMean,                                    // ave mean for block
      ]);
    }
  }

  return eqSignal;
}

/**
 * Scales the equivalent signal blocks to ensure that the total number of cycles
 * in the equivalent signal meets or exceeds a specified minimum.
 *
 * This function iteratively adjusts the block ranges in the `eqSignal` array until
 * the sum of the block repetitions (i.e. the total number of cycles) exceeds `minNumOfCycles`.
 * In each iteration, it:
 *   - Decrements the scale factor by 0.0001.
 *   - Applies the scaling factor to the range of the first block.
 *   - For each middle block, calculates a candidate new range (current range multiplied by the scale factor)
 *     and, if it is greater than or equal to the midpoint of the original block range (from a snapshot),
 *     updates the block's range accordingly.
 *   - If `increasedBlockDmg` is true, forces the last block to cover the full global load range,
 *     as determined by the maximum and minimum values in `columns`.
 *   - Recomputes the repetition (using the formula: repetition = blockDamage / (range^slope))
 *     and the percentage damage for each block.
 *
 * @param eqSignal - An array of equivalent signal blocks, where each block is represented as an array:
 *                   [range, mean, repetition, %damage, blockDamage, aveMean].
 * @param columns - The original rainflow data in columnar form (RainflowDataColumns),
 *                  used to determine global maximum and minimum loads.
 * @param totalDamage - The total damage computed from the original rainflow data.
 * @param slope - The fatigue exponent used in the repetition (damage) calculation.
 * @param minNumOfCycles - The minimum required total number of cycles in the equivalent signal.
 * @param increasedBlockDmg - A flag indicating whether the last block should be forced to span the entire
 *                            global load range (globalMax - globalMin).
 *
 * @remarks
 * - A snapshot of the initial equivalent signal block ranges is stored on the first iteration
 *   (in `eqSignalMaxRed`) and used as a reference for scaling middle blocks.
 * - The loop terminates when the sum of block repetitions exceeds `minNumOfCycles` or when the scale
 *   factor reaches zero.
 * - The function updates the `eqSignal` array in place and does not return a value.
 */
function scaleEquivalentSignalToMinimumCycles(
  eqSignal: EquivalentSignalRow[], columns: RainflowDataColumns, totalDamage: number,
  slope: number, minNumOfCycles: number, increasedBlockDmg: boolean
): void {
  // Make a reference copy and init scale factor
  let eqSignalMaxRed = eqSignal.map(row => [...row] as EquivalentSignalRow);
  let scaleFactor = 1.0;

  while (true) {
    // Break if min number of cycle reached
    const eqSignalCycleNo = eqSignal.reduce((acc, i) => acc + i[2], 0)
    if (eqSignalCycleNo > minNumOfCycles) {
      break; // done
    }
    // On first iteration, store snapshot
    if (scaleFactor === 1.0) {
      eqSignalMaxRed = eqSignal.map(row => [...row] as EquivalentSignalRow);
    }
    scaleFactor -= 0.0001;
    if (scaleFactor <= 0) {
      break;
    }

    // Re-scale the range for the first block
    eqSignal[0][0] *= scaleFactor; // eqSignal[0][0] => range
    // Possibly re-scale middle blocks if candidate >= mid
    for (let idx = 1; idx < eqSignal.length - 1; idx++) {
      const candidate = eqSignal[idx][0] * scaleFactor;
      const mid = (eqSignalMaxRed[idx - 1][0] + eqSignalMaxRed[idx][0]) / 2.0;
      if (candidate >= mid) {
        eqSignal[idx][0] = candidate;
      }
    }
    
    if (increasedBlockDmg) {
      // Force last block to cover globalMax - globalMin
      // We'll find globalMax, globalMin from columns
      const globalMax = findMax(columns.maxOfCycle);
      const globalMin = findMin(columns.minOfCycle);
      const maxBlockRange = globalMax - globalMin;
      const last = eqSignal[eqSignal.length - 1];
      last[0] = maxBlockRange; // range
      last[1] = globalMax      // mean
      last[5] = globalMax - (maxBlockRange / 2.0);  // ave mean
    }

    // Recompute repetition & % damage in eqSignal
    for (const row of eqSignal) {
      const range = row[0];
      const blockDamage = row[4]; // row[4] => blockDamage
      const rep = blockDamage / Math.pow(range, slope);
      row[2] = rep;
      row[3] = (blockDamage * 100) / totalDamage;
    }
  }
}

/**
 * Adjusts the mean values of each equivalent signal block so that the block’s effective
 * mean (stored at index 5) remains within the global load limits. The global limits are
 * derived from the last block in the signal: the global minimum is defined as
 * (lastBlock.mean - lastBlock.range) and the global maximum as lastBlock.mean.
 *
 * For each block in the equivalent signal, if the adjusted mean minus half the block’s
 * range falls below the global minimum, the mean is shifted upward; if the adjusted mean
 * plus half the block’s range exceeds the global maximum, the mean is shifted downward.
 *
 * @param eqSignal - An array of equivalent signal blocks, where each block is represented
 *                   as an array in the following order:
 *                   [range, mean, repetition, %damage, blockDamage, adjustedMean].
 *
 * @remarks
 * This function updates the `eqSignal` array in place and does not return any value.
 */
function adjustBlockMeansToGlobalMinMax(eqSignal: EquivalentSignalRow[]): void {
  const nBlocks = eqSignal.length;
  if (nBlocks === 0) return;

  // We define approximate "minOfTheSignal" as lastBlock.mean - lastBlock.range
  // and "maxOfTheSignal" as lastBlock.mean
  const last = eqSignal[nBlocks - 1];
  const lastRange = last[0];
  const lastMean = last[1];
  const minOfTheSignal = lastMean - lastRange;
  const maxOfTheSignal = lastMean;

  let blockNumber = 0;
  for (const row of eqSignal) {
    blockNumber++;
    // if (mean - range/2) < minOfSignal => shift up
    if (row[5] - row[0] / 2 < minOfTheSignal) {
      row[5] = (row[0] / 2.0) + minOfTheSignal;
    }
    // if (mean + range/2) > maxOfSignal => shift down
    if (row[5] + row[0] / 2.0 > maxOfTheSignal) {
      row[5] = maxOfTheSignal - row[0] / 2.0;
    }
  }
}

/**
 * Calculates the Equivalent Signal from rainflow data columns by dividing the load history
 * into fatigue-representative blocks and scaling them to meet a minimum cycle count.
 *
 * The function performs the following steps:
 *   1. Counts the total number of cycles in the input `columns`. If the total is less than
 *      `minNumOfCycles`, an error is thrown.
 *   2. Sorts the rainflow data by ascending range and computes the total damage.
 *   3. Inserts block boundaries into the sorted data using a "max square" heuristic. A deep
 *      copy of the sorted columns is used since the process modifies some range values.
 *   4. Builds initial equivalent signal blocks from the sorted data and the computed block
 *      boundaries, calculating each block’s damage, representative range, and mean.
 *   5. Iteratively scales the block ranges until the total number of cycles (derived from the
 *      block repetitions) meets or exceeds `minNumOfCycles`. If `increasedBlockDmg` is enabled,
 *      the last block is forced to span the full global load range.
 *   6. Adjusts block mean values so that they do not exceed the global minimum or maximum loads.
 *
 * The resulting array of blocks is then reversed before being returned.
 *
 * @param columns - The rainflow data in columnar form (RainflowDataColumns), which includes arrays
 *                  for range, damageOfCycle, cumulDamage, cycleIndex, percCumDamage, maxOfCycle,
 *                  cycleReptes, and minOfCycle.
 * @param blocksNumber - The desired number of blocks for the equivalent signal.
 * @param minNumOfCycles - The minimum required total number of cycles in the equivalent signal.
 * @param slope - The fatigue slope (exponent) used in the damage calculation (damage = range^slope * repetitions).
 * @returns An array of EquivalentSignalRow, where each row represents a block in the order:
 *          [range, mean, repetition, percentage damage, block damage].
 * @throws Error if the total number of cycles in the input is less than the requested minimum.
 */
function calculateEqSignal(
  columns: RainflowDataColumns, blocksNumber: number, minNumOfCycles: number, slope: number
): EquivalentSignalRow[] {
  // Hardcode "increasedBlockDmg"
  const increasedBlockDmg = true;

  // Count the total number of cycles in the original signals
  let totalNumCyclesOriginal = 0;
  for (let i = 0; i < columns.range.length; i++) {
    totalNumCyclesOriginal += columns.cycleReptes[i];
  }
  if (totalNumCyclesOriginal < minNumOfCycles) {
    throw new Error("Original signal has less cycles than requested minimum.");
  }

  // Sort columns by ascending range, and compute totalDamage
  const [sColumns, totalDamage] = sortRainflowColumns(columns);
  
  // Insert block boundaries with "max square" logic
  // We pass the deep copy of columns since this function
  // is overwritting some values
  const blocksIndexed = insertBlockBoundaries(structuredClone(sColumns), blocksNumber);

  // Build the initial "Equivalent Signal" blocks
  const eqSignal = buildEquivalentSignalBlocks(sColumns, blocksIndexed, totalDamage, slope);
  
  // Scale eqSignal ranges to ensure we meet minNumOfCycles
  scaleEquivalentSignalToMinimumCycles(
    eqSignal, sColumns, totalDamage, slope, minNumOfCycles, increasedBlockDmg
  );
  
  // Adjust block means so we don't exceed global min or max
  adjustBlockMeansToGlobalMinMax(eqSignal);

  return eqSignal.reverse();
}

/**
 * Calculates the Equivalent Damage Signal from raw rainflow data.
 *
 * This wrapper function performs the following steps:
 * 1. Converts the raw rainflow data (an array of Float64Array of peak/valley pairs)
 *    and their associated repetition counts into a columnar data structure using
 *    `parseAllRainflowData`.
 * 2. Processes the columnar data with the block-signal algorithm via `calculateEqSignal`
 *    to segment the load history into fatigue-representative blocks, scale them to meet
 *    a specified minimum cycle count, and compute block-level damage parameters.
 * 3. Returns the resulting equivalent signal as an array of `EquivalentSignalRow`.
 *
 * @param rfList - An array of Float64Arrays, each containing pairs of peak and valley values.
 * @param repetitions - An array of repetition counts corresponding to each signal in `rfList`.
 * @param blocksNumber - The desired number of blocks in the equivalent signal.
 * @param minNumOfCycles - The minimum total number of cycles required in the equivalent signal.
 * @param slope - The fatigue slope (exponent) used for the damage calculation.
 * @returns An array of `EquivalentSignalRow` representing the final equivalent damage signal.
 */
export function eqDmgSignal(
  rfList: Float64Array[], repetitions: number[],blocksNumber: number, minNumOfCycles: number, slope: number
): EquivalentSignalRow[] {
  // Convert (peak,valley) arrays + repetitions into columnar data
  const columns = parseAllRainflowData(rfList, repetitions, slope);

  // Run the block-signal algorithm on the columnar data
  const eqSignal = calculateEqSignal(columns, blocksNumber, minNumOfCycles, slope);

  // Return the final equivalent signal
  return eqSignal;
}
