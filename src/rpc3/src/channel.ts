// channel.ts
import { findMinMax, generateHash, calcDamage } from './utils';
import { rainflow_counting, count_range_cycles } from './rainflow';

const rf_init = () => ({
  reversals: new Float64Array(0),
  revIdx: new Int32Array(0),
  cycles: new Float64Array(0),
  residuals: new Float64Array(0),
  range_counts: new Float64Array(0),
})

export class Channel {
  public value: Float64Array = new Float64Array(0);
  public min: number = 1e30;
  public max: number = -1e30;
  private _hash:string = "";
  public repetitions: number = 0;

  // Rainflow data
  private rf: {
    reversals: Float64Array;
    revIdx: Int32Array;
    cycles: Float64Array;
    residuals: Float64Array;
    range_counts: Float64Array;
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
    this.rf = rf_init();
    //  Set hash
    this._hash = generateHash(Number + Name + filename) + fileHash;
  }

  setMinMax(): void {
    const {min, max} = findMinMax(this.value);
    this.max = max
    this.min = min
  }

  rainflow(repets=1, close_residuals=true, k=2**12): void {
    // Save repetitions
    this.repetitions = repets;
    // Perform rainflow counting
    const { cycles, residuals } = rainflow_counting(this.value, close_residuals, k);
    // Save cycles residuals
    this.rf.cycles = cycles
    this.rf.residuals = residuals;
    // Count unique cycles based on range
    this.rf.range_counts = count_range_cycles(cycles, repets);
  }

  damage(slope: number): number {
    return calcDamage(slope, this.range_counts)
  }

  scaleValue(scalar: number) {
    this._scale *= scalar
    for (let i = 0; i < this.value.length; i++) {
      this.value[i] *= scalar;
    }
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

  get residuals() {
    return this.rf.residuals
  }

  get cycles() {
    return this.rf.cycles
  }

  clearRF(): void{
    this.rf = rf_init();
    this.repetitions = 0;
  }
}
