// channel.ts
import { findMinMax } from './utils';
import { findReversals, findRainflowCycles, concatenateReversals } from './rainflow';

export class Channel {
  public value: Float64Array = new Float64Array();
  public min: number = 1e30;
  public max: number = -1e30;
  public isSelected = false;

  // Rainflow data
  public rf = {
    reversals: [] as number[],
    revIdx: [] as number[],
    cycles: [] as number[][],
    range: [] as number[],
    mean: [] as number[],
  };

  // Summarized
  public Range: number[] = [];
  public Cycles: number[] = [];

  constructor(
    public Number: number,
    public Name: string,
    public Units: string,
    private _scale: number,
    private _dt: number,
    public filename?: string,
    public fileHash?: string,
  ) {}

  setMinMax(): void {
    const {min, max} = findMinMax(this.value);
    this.max = max
    this.min = min
  }

  rainflow(k = 256, repeats = 1): void {
    const [reversals, revIdx] = findReversals(Array.from(this.value), k);
    let [cycles, residue] = findRainflowCycles(reversals);

    // Multiply closed cycles by repetitions
    cycles = cycles.flatMap(e => Array.from({ length: repeats }, () => e));

    // Close residuals
    const closed_residuals = concatenateReversals(residue, residue);
    let [cycles_residue] = findRainflowCycles(closed_residuals);
    cycles_residue = cycles_residue.flatMap(e => Array.from({ length: repeats }, () => e));

    // Combine
    cycles = cycles.concat(cycles_residue);

    // Store results
    this.rf.reversals = reversals;
    this.rf.revIdx = revIdx;
    this.rf.cycles = cycles;
    this.rf.range = cycles.map(([start, end]) => Math.abs(end - start));
    this.rf.mean = cycles.map(([start, end]) => (start + end) / 2);

    // Summaries
    this.Range = Array.from(new Set(this.rf.range)).sort((a, b) => a - b);
    this.Cycles = this.Range.map(r => this.rf.range.filter(rr => rr === r).length);
  }

  damage(slope: number): number {
    return this.Range
      .map((r, idx) => Math.pow(r, slope) * this.Cycles[idx])
      .reduce((sum, v) => sum + v, 0);
  }

  get scale() {
    return this._scale
  }

  get dt() {
    return this._dt
  }
}
