export interface EventType {
  name: string;
  hash: string;
  repetitions: number;
}

export interface CumulativeDataType {
  range: Float64Array;
  ncum: Float64Array;
  dcum: Float64Array;
  totalDamage: number,
}

export interface RFResultType {
  reversals: Float64Array;
  revIdx: Int32Array;
  cycles: Float64Array;
  residuals: Float64Array;
}