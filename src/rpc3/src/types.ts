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

export interface CombineChannelsType {
  residualCycles: Float64Array,
  rangeCounts: Float64Array,
}

export interface RainflowDataColumns {
  range: Float64Array;
  damageOfCycle: Float64Array;
  cumulDamage: Float64Array;
  cycleIndex: Float64Array;
  percCumDamage: Float64Array;
  maxOfCycle: Float64Array;
  cycleRepets: Float64Array;
  minOfCycle: Float64Array;
}

// Equivalent signal row
// [range, mean, repetition, %damage, damage, lastOne]
export type EquivalentSignalRow = [
  number, // range
  number, // mean
  number, // repetition
  number, // percentDamage
  number, // damage
  number, // average_mean_for_block
];

export interface HistogramType {
  counts: Float64Array;
  binEdges: Float64Array;
}