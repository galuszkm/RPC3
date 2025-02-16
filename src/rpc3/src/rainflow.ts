// rainflow.ts
import { findMinMax, linspace } from './utils';
import { CumulativeDataType } from './types';
import { Channel } from './channel';
import { EventType, RFResultType, CombineChannelsType, HistogramType } from './types';
import { parseAllRainflowData } from './eq_dmg_signal';

/**
 * 1) Discretize the signal into k bins
 * 2) Detect reversal indices
 * 
 * Returns [reversalValues, reversalIndices].
 */
function findReversals(signal: Float64Array, k=1024): [Float64Array, Int32Array] {
  const n = signal.length;
  if (n < 2) {
    // trivial
    return [signal.slice(), new Int32Array([0, n - 1])];
  }

  // Compute boundaries for classification
  const { min, max } = findMinMax(signal);
  if (max === min) {
    // entire signal is constant
    // just return first and last as reversal
    return newReversalPair(signal[0], signal[n - 1], 0, n - 1);
  }

  // create k+2 boundaries; step is (max-min)/(2k)
  const dy = (max - min) / (2.0 * k);
  const y0 = min - dy;
  const y1 = max + dy;
  const boundaries = linspace(y0, y1, k + 2);
  const binWidth = boundaries[1] - boundaries[0]; // should be ~ (max-min)/(2k)

  // Assign each signal point to a bin center z[j]
  // e.g. bin index = floor((signal[j] - y0) / binWidth)
  // then z[j] is the mid of that bin
  const z = new Float64Array(n);
  for (let j = 0; j < n; j++) {
    const binIdx = Math.floor((signal[j] - y0) / binWidth);
    // clamp binIdx between 0 and (k+1) - just in case
    const idxClamped = Math.max(0, Math.min(k + 1, binIdx));
    // midpoint of that bin
    z[j] = boundaries[0] + binWidth * 0.5 + idxClamped * binWidth;
  }

  // We only care where z changes to detect potential reversals
  // Find all j where z[j+1] != z[j]
  const changeIndices: number[] = [];
  for (let j = 0; j < n - 1; j++) {
    if (z[j + 1] !== z[j]) {
      changeIndices.push(j);
    }
  }
  // Ensure we include the last index if changed
  if (changeIndices.length) {
    changeIndices.push(changeIndices[changeIndices.length - 1] + 1);
  } else {
    // if no changes, entire z is constant => return first and last
    return newReversalPair(z[0], z[n - 1], 0, n - 1);
  }

  // We'll create a smaller array of "candidate" points
  // and then check 3-point sign changes to find actual reversal
  const candCount = changeIndices.length;
  const candZ = new Float64Array(candCount);
  const candI = new Int32Array(candCount);

  for (let m = 0; m < candCount; m++) {
    const idx = changeIndices[m];
    candZ[m] = z[idx];
    candI[m] = idx;
  }

  // Among these candidate points, identify sign changes in slope
  // i.e. consecutive differences product < 0 => local reversal
  const revIndices = [0]; // always include the first
  for (let m = 0; m < candCount - 2; m++) {
    const d1 = candZ[m + 1] - candZ[m];
    const d2 = candZ[m + 2] - candZ[m + 1];
    if (d1 * d2 < 0) {
      // reversal at m+1
      revIndices.push(m + 1);
    }
  }
  // Possibly add the last point as a reversal if there's a sign change
  // from second-to-last to last
  const nC = candCount;
  if (
    (candZ[revIndices[revIndices.length - 1]] - 
     candZ[revIndices[revIndices.length - 2]]) *
    (candZ[nC - 1] - candZ[revIndices[revIndices.length - 1]]) < 0
  ) {
    revIndices.push(nC - 1);
  } else {
    // ensure the last candidate is included if not already
    if (revIndices[revIndices.length - 1] !== nC - 1) {
      revIndices.push(nC - 1);
    }
  }

  // Build final typed arrays for reversals
  const outCount = revIndices.length;
  const outZ = new Float64Array(outCount);
  const outI = new Int32Array(outCount);
  for (let r = 0; r < outCount; r++) {
    const cidx = revIndices[r];
    outZ[r] = candZ[cidx];
    outI[r] = candI[cidx];
  }

  return [outZ, outI];
}

/**
 * Creates a new reversal pair for the "all constant" edge case.
 *
 * This function constructs two typed arrays:
 * - A `Float64Array` containing two reversal values `[val0, val1]`.
 * - An `Int32Array` containing their corresponding indices `[idx0, idx1]`.
 *
 * @param {number} val0 - First reversal value.
 * @param {number} val1 - Second reversal value.
 * @param {number} idx0 - Index of `val0` in the original dataset.
 * @param {number} idx1 - Index of `val1` in the original dataset.
 * @returns {[Float64Array, Int32Array]} - A tuple containing:
 *          - `Float64Array` with two reversal values.
 *          - `Int32Array` with two corresponding indices.
 */
function newReversalPair(val0: number, val1: number, idx0: number, idx1: number): [Float64Array, Int32Array] {
  const r = new Float64Array([val0, val1]);
  const i = new Int32Array([idx0, idx1]);
  return [r, i];
}

/**
 * Concatenate two reversal arrays optimally, checking sign conditions
 * to avoid duplications or produce an invalid sequence.
 */
function concatenateReversals(rev1: Float64Array, rev2: Float64Array): Float64Array {
  const n1 = rev1.length;
  const n2 = rev2.length;

  if (n1 < 2 || n2 < 2) {
    // trivial concat
    const out = new Float64Array(n1 + n2);
    out.set(rev1, 0);
    out.set(rev2, n1);
    return out;
  }

  // We'll examine the last two of rev1, the first two of rev2
  const dRend = rev1[n1 - 1] - rev1[n1 - 2];
  const dRstart = rev2[1] - rev2[0];
  const dRjoin = rev2[0] - rev1[n1 - 1];
  const t1 = dRend * dRstart;
  const t2 = dRend * dRjoin;

  if (t1 > 0 && t2 < 0) {
    // Simple append
    return concatFloat64(rev1, rev2);
  } else if (t1 > 0 && t2 >= 0) {
    // Drop the last rev1 element, drop the first rev2 element
    return concatFloat64(rev1.subarray(0, n1 - 1), rev2.subarray(1));
  } else if (t1 < 0 && t2 >= 0) {
    // Just drop the first rev2 element
    return concatFloat64(rev1, rev2.subarray(1));
  } else if (t1 < 0 && t2 < 0) {
    // Drop the second-to-last rev1 element
    // (which is rev1[n1-2]), keep entire rev2
    const out = concatFloat64(rev1.subarray(0, n1 - 1), rev2);
    return out;
  }

  throw new Error('Invalid concatenation - repeated end/start value?');
}

/** 
 * Lightweight typed-array concatenation. 
 */
function concatFloat64(a: Float64Array, b: Float64Array): Float64Array {
  const out = new Float64Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

/**
 * Stack-based approach to detect rainflow cycles from a reversal array.
 * 
 * This function identifies closed rainflow cycles based on a stack-based method,
 * following the standard 4-point rainflow cycle counting rule.
 * 
 * @param {Float64Array} reversals - The input array of reversal points.
 * @returns {[Float64Array, Float64Array]} 
 *          - `closedCycles`: A `Float64Array` containing detected cycles as flat pairs `[start1, end1, start2, end2, ...]`.
 *          - `residue`: A `Float64Array` of remaining reversals that couldn't form closed cycles.
 */
function findRainflowCyclesStack(reversals: Float64Array): [Float64Array, Float64Array] {
  const cycles: number[] = [];
  // We'll build up a stack of numbers as we go
  const stack: number[] = [];

  for (let i = 0; i < reversals.length; i++) {
    stack.push(reversals[i]);

    // Try to close cycles as long as we have at least 4 in the stack
    while (stack.length >= 4) {
      const n = stack.length;
      const S0 = stack[n - 4];
      const S1 = stack[n - 3];
      const S2 = stack[n - 2];
      const S3 = stack[n - 1];

      const dS1 = Math.abs(S1 - S0);
      const dS2 = Math.abs(S2 - S1);
      const dS3 = Math.abs(S3 - S2);

      // Standard 4-point rule
      if (dS2 <= dS1 && dS2 <= dS3) {
        // We have a closed cycle from S1->S2
        cycles.push(S1, S2);
        // Remove S1, S2 from stack (the middle two of top 4)
        // effectively pop them out but keep S0, S3
        // A quick way: pop last 3, then push S3 again
        stack.splice(n - 3, 2);
      } else {
        break;
      }
    }
  }
  // Leftover stack is residue
  const residue = new Float64Array(stack.length);
  for (let i = 0; i < stack.length; i++) {
    residue[i] = stack[i];
  }

  return [new Float64Array(cycles), residue];
}

/**
 * Performs rainflow cycle counting on a time-history signal.
 *
 * This function:
 * - Identifies reversal points in the input data using discretization (`k` parameter).
 * - Detects closed rainflow cycles and residuals using a stack-based method.
 * - Optionally closes residuals by repeating them and extracting additional cycles.
 * - Returns the detected reversals, their indices, the full cycle list, and residuals.
 *
 * @param {Float64Array} value - The input time-history signal to analyze.
 * @param {boolean} close_residuals - If `true`, attempts to close residuals by repeating them.
 * @param {number} [k=2**12] - Discretization parameter controlling reversal detection sensitivity.
 * @returns {{
*   reversals: Float64Array,
*   revIdx: Int32Array,
*   cycles: Float64Array,
*   residuals: Float64Array
* }} - An object containing:
*   - `reversals`: Detected reversal points.
*   - `revIdx`: Indices of reversals in the original signal.
*   - `cycles`: Extracted closed rainflow cycles as [peak1, valley1, peak2, valley2, ...].
*   - `residuals`: Remaining reversals that could not form complete cycles.
*/
export function rainflow_counting(value: Float64Array, close_residuals: boolean, k: number=2**12): RFResultType {
  // Find reversals (discretize + pick turning points)
  const [reversals, revIdx] = findReversals(value, k);

  // Find closed cycles + residue (stack-based)
  const [cycles, residue] = findRainflowCyclesStack(reversals);

  // Close the residuals by concatenating residue + residue
  // and extracting any cycles from that.
  let resCycles: Float64Array = new Float64Array()
  if (close_residuals) {
    const closedResiduals = concatenateReversals(residue, residue);
    [resCycles] = findRainflowCyclesStack(closedResiduals);
  }
  // Combine cycles and resCycles into a single Float64Array
  const totalSize = cycles.length + resCycles.length;
  const allCycles = new Float64Array(totalSize);
  allCycles.set(cycles, 0);
  allCycles.set(resCycles, cycles.length);

  return {
    reversals: reversals,
    revIdx: revIdx,
    cycles: allCycles,
    residuals: residue,
  }
}

/**
 * Counts rainflow range cycles and aggregates cycle counts.
 *
 * This function processes a sequence of peaks and valleys stored in `Float64Array` format
 * and computes the corresponding range cycle counts. It:
 * - Computes the absolute difference (range) between each [peak, valley] pair.
 * - Aggregates duplicate ranges by summing cycle counts.
 * - Supports an optional `repets` parameter for weighting the counts.
 * - Returns a sorted `Float64Array` of `[range1, count1, range2, count2, ...]`.
 *
 * @param {Float64Array} cycles - Input peak-valley cycle data as [peak1, valley1, peak2, valley2, ...].
 * @param {number} [repets=1] - Number of times to multiply cycle counts.
 * @returns {Float64Array} - Sorted unique [range, count] pairs stored in a `Float64Array`.
 */
export function count_range_cycles(cycles: Float64Array, repets: number=1): Float64Array {
  // Process the input Float64Array
  // Array is [peak1, valey1, peak2, valey2, ...]
  const rangeMap = new Map<number, number>();
  for (let i = 0; i < cycles.length; i += 2) {
    const start = cycles[i];
    const end = cycles[i + 1];
    const rng = Math.abs(end - start);
    rangeMap.set(rng, (rangeMap.get(rng) ?? 0) + repets);
  }
  // Get sorted unique ranges
  const uniqueRanges = Array.from(rangeMap.keys()).sort((a, b) => b - a);

  // Allocate a Float64Array for the output [range1, counts1, range2, counts2, ...]
  const result = new Float64Array(uniqueRanges.length * 2);
  let index = 0;
  for (const r of uniqueRanges) {
    result[index++] = r;
    result[index++] = rangeMap.get(r)!; // Store count
  }

  return result;
}

/**
 * Merges duplicate ranges by summing their counts and returns a sorted Float64Array.
 *
 * This function processes an already counted range-cycle dataset,
 * summing duplicate ranges and returning a sorted unique list.
 * It:
 * - Takes precomputed `[range, count]` pairs and merges duplicate ranges.
 * - Sorts the result in descending order.
 * - Returns a new `Float64Array` of `[range1, count1, range2, count2, ...]`.
 *
 * @param {Float64Array} range_counts - Input cycle data as [range1, count1, range2, count2, ...].
 * @returns {Float64Array} - Sorted unique [range, count] pairs stored in a `Float64Array`.
 */
export function count_unique_ranges(range_counts: Float64Array): Float64Array {
  // Merge duplicated range counts
  const rangeMap = new Map<number, number>();

  // Process range_counts as pairs [range, count]
  for (let i = 0; i < range_counts.length; i += 2) {
    const rng = range_counts[i];        // Range value
    const count = range_counts[i + 1];  // Count value
    rangeMap.set(rng, (rangeMap.get(rng) ?? 0) + count);
  }
  // Extract and sort unique ranges
  const uniqueRanges = Array.from(rangeMap.keys()).sort((a, b) => b - a);

  // Allocate a Float64Array for the result
  const result = new Float64Array(uniqueRanges.length * 2);
  let index = 0;
  for (const r of uniqueRanges) {
    result[index++] = r;
    result[index++] = rangeMap.get(r)!; // Store merged count
  }

  return result;
}

/**
 * Combines and processes range counts from multiple channels and events.
 *
 * This function:
 * - Concatenates `range_counts` from all channels.
 * - Expands `residuals` based on the event repetitions.
 * - Performs rainflow counting on the combined residuals.
 * - Merges the counted cycles from residuals into the main `range_counts`.
 * - Returns a unique, sorted `Float64Array` of `[range, count]` pairs.
 *
 * @param {Channel[]} channels - Array of channel objects containing `range_counts` and `residuals`.
 * @param {EventType[]} events - Array of events providing repetition counts for each channel.
 * @returns {Float64Array} - A merged and processed `Float64Array` of `[range, count]` pairs.
 */
export function combine_channels_range_counts(channels: Channel[], events:EventType[]): CombineChannelsType {
  // Concatenate all range_counts
  // Range counts already include event repetitions 
  // Assuming they were passed in channel.rainflow() invocation

  // Step 1: Compute total required length
  const totalLength = channels.reduce((sum, channel) => sum + channel.range_counts.length, 0);
  // Step 2: Allocate Float64Array with total size
  const rangeCounts = new Float64Array(totalLength);
  // Step 3: Fill the array in a loop
  let offset = 0;
  for (const channel of channels) {
    rangeCounts.set(channel.range_counts, offset);
    offset += channel.range_counts.length;
  }

  // Calculate total residuals size (considering repetitions)
  const totalResidualLength = channels.reduce((acc, channel) => {
    const repetitions = events.find(i => i.hash === channel.fileHash)?.repetitions || 1;
    return acc + channel.residuals.length * repetitions;
  }, 0);
  // Create a Float64Array with the total length
  const totalResiduals = new Float64Array(totalResidualLength);

  // Fill `totalResiduals` by repeating each channel's residuals
  offset = 0;
  for (const channel of channels) {
    const repetitions = events.find(i => i.hash === channel.fileHash)?.repetitions || 1;
    for (let r = 0; r < repetitions; r++) {
      totalResiduals.set(channel.residuals, offset);
      offset += channel.residuals.length;
    }
  }
  // Perform rainflow counting on residuals
  // Now require to close the residuals of combined residuals
  const { cycles } = rainflow_counting(totalResiduals, true);
  
  // Add counted cycles from rainflow of residuals to combined range counts
  // Residuals were already repeated in loop above, so set repeat to 1
  const countedResidualCycles = count_range_cycles(cycles, 1);
  const totalRangeCounts = new Float64Array(rangeCounts.length + countedResidualCycles.length);
  totalRangeCounts.set(rangeCounts, 0);
  totalRangeCounts.set(countedResidualCycles, rangeCounts.length);

  return {
    residualCycles: cycles,
    rangeCounts: count_unique_ranges(totalRangeCounts)
  }
}

/**
 * Computes cumulative rainflow data from input cycles.
 *  - Merges duplicate range values
 *  - Filters based on `gate` threshold
 *  - Sorts in descending order
 *  - Computes damage percentage and cumulative damage
 *
 * @param {Float64Array} data - Input cycle data as [range1, count1, range2, count2, ...].
 * @param {number} slope - The exponent for damage calculation.
 * @param {number} [gate=0] - Percentage threshold of max range for filtering cycles.
 * @returns {CumulativeDataType} - Computed `{ range, ncum, dcum, totalDamage }` as `Float64Array`.
 */
export function cumulative_rainflow_data(data: Float64Array, slope: number, gate: number=0): CumulativeDataType {
  // Find max range
  let maxRange = 0;
  for (let i = 0; i < data.length; i += 2) {
    maxRange = Math.max(maxRange, data[i]);
  }

  // Sum duplicates while filtering by gate threshold
  const rangeMap = new Map<number, number>();
  for (let i = 0; i < data.length; i += 2) {
    const range = data[i];
    const count = data[i + 1];
    if (range > (maxRange * gate) / 100) {
      rangeMap.set(range, (rangeMap.get(range) ?? 0) + count);
    }
  }

  // Extract and sort unique ranges
  const uniqueRanges = Array.from(rangeMap.keys()).sort((a, b) => b - a);
  let len = uniqueRanges.length;

  // Allocate typed arrays
  const uniqueCycles = new Float64Array(len);
  for (let i = 0; i < len; i++) {
    uniqueCycles[i] = rangeMap.get(uniqueRanges[i])!;
  }

  // Compute damage array = (range^slope) * cycles
  const damageArray = new Float64Array(len);
  let damageSum = 0;
  for (let i = 0; i < len; i++) {
    damageArray[i] = Math.pow(uniqueRanges[i], slope) * uniqueCycles[i];
    damageSum += damageArray[i];
  }

  // Compute damage percentage
  const damagePercent = new Float64Array(len);
  for (let i = 0; i < len; i++) {
    damagePercent[i] = (damageArray[i] / damageSum) * 100;
  }

  // Compute cumulative cycles (Ncum) and cumulative damage% (Dcum)
  const NcumRaw = new Float64Array(len + 1);
  const DcumRaw = new Float64Array(len + 1);
  NcumRaw[0] = 1;  // Start Ncum at 1
  DcumRaw[0] = 0; // Start Dcum at 0
  let cycleAcc = 0;
  let dmgAcc = 0;

  for (let i = 0; i < len; i++) {
    cycleAcc += uniqueCycles[i];
    dmgAcc += damagePercent[i];
    NcumRaw[i + 1] = cycleAcc;
    DcumRaw[i + 1] = dmgAcc;
  }

  // Return computed results
  return {
    range: new Float64Array([uniqueRanges[0], ...uniqueRanges]),  
    ncum: NcumRaw,
    dcum: DcumRaw,
    totalDamage: damageSum,
  };
}

/**
 * Calculates the level crossing distribution using a weighted histogram approach.
 *
 * This function combines peak and valley values with their repetition counts to
 * build a single weighted dataset. It then splits the range at the mean value
 * to produce two histograms (min→mean, mean→max), merges and inverts counts
 * to form a continuous cumulative curve, and finally inserts an extra cycle at
 * the start and end for boundary conditions.
 *
 * @param rfList - An array of Float64Arrays, each storing [peak, valley, ...].
 * @param repetitions - The repetition count for each signal in `rfList`.
 * @param binCount - The number of histogram bins on each side (default = 256).
 * @returns A tuple:
 *  - `[0]`: A Float64Array (`LCcum`) of cumulative crossing counts (with two added boundary points).
 *  - `[1]`: A Float64Array (`LClevel`) of the corresponding level edges (duplicated boundary).
 */
export function level_crossing( rfList: Float64Array[], repetitions: number[], binCount = 256): [Float64Array, Float64Array] {
  // Get peak/valley and repetition data
  const { maxOfCycle, minOfCycle, cycleRepets } = parseAllRainflowData(rfList, repetitions);

  // Combine peak and valley with their weights (repetitions)
  const nCycles = maxOfCycle.length;
  const combined = new Float64Array(nCycles * 2);
  const weights = new Float64Array(nCycles * 2);
  combined.set(maxOfCycle, 0);
  combined.set(minOfCycle, nCycles);
  weights.set(cycleRepets, 0);
  weights.set(cycleRepets, nCycles);

  // Single-pass min, max, weighted sum for mean
  let minVal = combined[0], maxVal = combined[0];
  let sumVal = 0, totW = 0;
  for (let i = 0; i < combined.length; i++) {
    const v = combined[i];
    const w = weights[i];
    if (v < minVal) minVal = v;
    if (v > maxVal) maxVal = v;
    sumVal += v * w;
    totW += w;
  }
  const meanVal = sumVal / totW;

  // Bin edges
  const binsPos = new Float64Array(linspace(minVal, meanVal, binCount));
  const binsNeg = new Float64Array(linspace(meanVal, maxVal, binCount));

  // Weighted histograms
  const { counts: posCounts, binEdges: posEdges } = histogram(combined, weights, binsPos);
  const { counts: negCounts, binEdges: negEdges } = histogram(combined, weights, binsNeg);

  // Cumulative sums
  const posCsum = cumulativeSum(posCounts);             // forward
  const negCsum = cumulativeSum(negCounts).reverse();   // reversed

  // Merge cumsums into a single typed array + add "1" at ends
  const mergedLen = posCsum.length + negCsum.length;
  const LCcum = new Float64Array(mergedLen + 2);
  LCcum[0] = 1;
  LCcum.set(posCsum, 1);
  LCcum.set(negCsum, 1 + posCsum.length);
  LCcum[LCcum.length - 1] = 1;

  // Merge bin edges + duplicate first/last
  const mergedEdges = new Float64Array(mergedLen + 2);
  mergedEdges[0] = posEdges[0];
  mergedEdges.set(posEdges.subarray(0, posEdges.length - 1), 1);
  mergedEdges.set(negEdges.subarray(1), posEdges.length);
  mergedEdges[mergedEdges.length - 1] = mergedEdges[mergedEdges.length - 2];

  return [LCcum, mergedEdges];
}

/**
 * Constructs a weighted histogram for the given data and bin edges.
 *
 * Each data value has a corresponding weight, representing how many times
 * that value occurs. The function increments bin counts by those weights
 * instead of just 1.
 *
 * @param data - The Float64Array containing data values (e.g., combined peaks/valleys).
 * @param weights - A Float64Array of the same length, storing weights for each value in `data`.
 * @param bins - The Float64Array of bin edges to classify `data` into.
 * @returns An object containing:
 *  - `counts`: A Float64Array of weighted bin counts.
 *  - `binEdges`: The same bin edges passed in (for convenience).
 */
function histogram(data: Float64Array, weights: Float64Array, bins: Float64Array): HistogramType {
  const counts = new Float64Array(bins.length - 1);
  for (let i = 0; i < data.length; i++) {
    const x = data[i];
    const w = weights[i];
    // Simple linear bin search (fine for moderate binCount)
    for (let j = 0; j < bins.length - 1; j++) {
      if (x >= bins[j] && x < bins[j + 1]) {
        counts[j] += w;
        break;
      }
    }
  }
  return { counts, binEdges: bins };
}

/**
 * Computes the cumulative sum of a Float64Array and returns a new array.
 *
 * @param arr - A Float64Array of values to be summed in order.
 * @returns A Float64Array where each element is the sum of all preceding
 *          elements in the input, including the current one.
 */
function cumulativeSum(arr: Float64Array): Float64Array {
  const out = new Float64Array(arr.length);
  let s = 0;
  for (let i = 0; i < arr.length; i++) {
    s += arr[i];
    out[i] = s;
  }
  return out;
}
