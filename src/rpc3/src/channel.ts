// channel.ts
import { findMinMax, generateHash } from './utils';
import { findReversals, findRainflowCyclesStack, multiplyCycles, concatenateReversals} from './rainflow';

export class Channel {
  public value: Float64Array = new Float64Array(0);
  public min: number = 1e30;
  public max: number = -1e30;
  private _hash:string = "";

  // Rainflow data
  private rf: {
    reversals: Float64Array;
    revIdx: Int32Array;
    cycles: Array<[number, number]>;
    range_counts: Array<[number, number]>;
  };

  constructor(
    public Number: number,
    public Name: string,
    public Units: string,
    private _scale: number,
    private _dt: number,
    public filename?: string,
    public fileHash?: string,
  ) {
    this.rf = {
      reversals: new Float64Array(0),
      revIdx: new Int32Array(0),
      cycles: [],
      range_counts: [],
    }
    //  Set hash
    this._hash = generateHash(Number + Name + filename) + fileHash;
  }

  setMinMax(): void {
    const {min, max} = findMinMax(this.value);
    this.max = max
    this.min = min
  }

  rainflow(repeats=1, k=2**15): void {
    // Find reversals (discretize + pick turning points)
    const [reversals, revIdx] = findReversals(this.value, k);

    // Find closed cycles + residue (stack-based)
    let [cycles, residue] = findRainflowCyclesStack(reversals);

    // Multiply the closed cycles by "repeats" if needed
    if (repeats > 1) {
      cycles = multiplyCycles(cycles, repeats);
    }

    // Close the residuals by concatenating residue + residue
    // and extracting any cycles from that.
    const closedResiduals = concatenateReversals(residue, residue);
    let [resCycles] = findRainflowCyclesStack(closedResiduals);
    if (repeats > 1) {
      resCycles = multiplyCycles(resCycles, repeats);
    }

    // Combine all cycles
    const allCycles = cycles.concat(resCycles);

    // Store rainflow results
    this.rf.reversals = reversals;
    this.rf.revIdx = revIdx;
    this.rf.cycles = allCycles;
    
    // -----------------------------------------
    // Count unique cycles based on range

    // Accumulate counts in a Map
    const rangeMap = new Map<number, number>();
    // Build counts
    for (const [start, end] of allCycles) {
      const rng = Math.abs(end - start);
      rangeMap.set(rng, (rangeMap.get(rng) ?? 0) + 1);
    }
    // Sort the unique ranges
    const uniqueRanges = Array.from(rangeMap.keys()).sort((a, b) => b - a);
    // Build an array of [range, count] and set to rainflow results
    this.rf.range_counts = uniqueRanges.map(r => [r, rangeMap.get(r)!]);

  }

  damage(slope: number): number {
    return this.rf.range_counts
      .map(([range, count]) => Math.pow(range, slope) * count)
      .reduce((sum, value) => sum + value, 0);
  }

  get hash() {
    return this._hash
  }

  get scale() {
    return this._scale
  }

  get dt() {
    return this._dt
  }

  get range_counts() {
    return this.rf.range_counts
  }
}
