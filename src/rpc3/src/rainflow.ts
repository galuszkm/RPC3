// rainflow.ts
import { findMinMax, linspace } from './utils';

/**
 * 1) Discretize the signal into k bins
 * 2) Detect reversal indices
 * 
 * Returns [reversalValues, reversalIndices].
 */
export function findReversals(signal: Float64Array, k=1024): [Float64Array, Int32Array] {
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

/** Helper for trivial "all constant" edge case. */
function newReversalPair(val0: number, val1: number, idx0: number, idx1: number): [Float64Array, Int32Array] {
  const r = new Float64Array([val0, val1]);
  const i = new Int32Array([idx0, idx1]);
  return [r, i];
}

/**
 * Concatenate two reversal arrays optimally, checking sign conditions
 * to avoid duplications or produce an invalid sequence.
 */
export function concatenateReversals(rev1: Float64Array, rev2: Float64Array): Float64Array {
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
 * Returns [closedCycles, residue].
 * closedCycles is an array of [startValue, endValue].
 * residue is the leftover stack as a Float64Array (for possible next pass).
 */
export function findRainflowCyclesStack(reversals: Float64Array): [Array<[number, number]>, Float64Array] {
  const cycles: Array<[number, number]> = [];
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
        cycles.push([S1, S2]);
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

  return [cycles, residue];
}

/**
 * Multiply cycles by 'repeats' (simple expansion).
 * If repeats is huge and you only need frequencies,
 * consider storing counts instead of expanding.
 */
export function multiplyCycles(cycles: Array<[number, number]>, repeats: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  out.length = cycles.length * repeats; // pre-allocate

  let idx = 0;
  for (let i = 0; i < cycles.length; i++) {
    const cycle = cycles[i];
    for (let r = 0; r < repeats; r++) {
      out[idx++] = cycle;
    }
  }
  return out;
}