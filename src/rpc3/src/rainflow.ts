// rainflow.ts
import { findMinMax, linspace } from './utils';

export function getLoadClassBoundaries(y: number[], k: number): number[] {
  const {min, max} = findMinMax(y)
  const dy = (max - min) / (2.0 * k);
  const y0 = min - dy;
  const y1 = max + dy;
  return linspace(y0, y1, k + 2);
}

export function findReversals(y: number[], k = 64): [number[], number[]] {
  const Y = getLoadClassBoundaries(y, k);
  const dY = Y[1] - Y[0];

  // Classifying points into levels
  const i = y.map(yi => Math.floor((yi - Y[0]) / dY) + 1);
  const z = i.map(ii => Y[0] + dY / 2.0 + (ii - 1) * dY);

  // Find successive datapoints in each class
  const dz = z.slice(1).map((zi, j) => zi - z[j]);
  let ix = dz.flatMap((d, j) => d !== 0 ? [j] : []);
  if (ix.length > 0) {
    ix.push(ix[ix.length - 1] + 1);
  } else {
    // If there's no difference, entire signal is constant
    return [[z[0], z[z.length - 1]], [0, z.length - 1]];
  }

  const z1 = z.filter((_, j) => ix.includes(j)).slice(0, -1);
  const z2 = z.filter((_, j) => ix.includes(j)).slice(1);
  const dz1 = z1.slice(1).map((zi, j) => zi - z1[j]);
  const dz2 = z2.slice(1).map((zi, j) => zi - z2[j]);
  const dzProduct = dz1.map((d1, j) => d1 * dz2[j]);

  const revix = [ix[0], ...dzProduct.flatMap((dp, j) => dp < 0 ? [ix[j + 1]] : [])];

  // Possibly check final reversal
  if (
    (z[revix[revix.length - 1]] - z[revix[revix.length - 2]]) *
    (z[ix[ix.length - 1]] - z[revix[revix.length - 1]]) < 0
  ) {
    revix.push(ix[ix.length - 1]);
  }

  // Return reversals and their indices
  return [revix.map(ri => z[ri]), revix];
}

export function concatenateReversals(reversals1: number[], reversals2: number[]): number[] {
  const R1 = reversals1;
  const R2 = reversals2;

  if (R1.length < 2 || R2.length < 2) {
    // trivial case
    return R1.concat(R2);
  }

  const dRstart = R2[1] - R2[0];
  const dRend   = R1[R1.length - 1] - R1[R1.length - 2];
  const dRjoin  = R2[0] - R1[R1.length - 1];

  const t1 = dRend * dRstart;
  const t2 = dRend * dRjoin;

  if (t1 > 0 && t2 < 0) {
    return R1.concat(R2);
  } else if (t1 > 0 && t2 >= 0) {
    return R1.slice(0, R1.length - 1).concat(R2.slice(1));
  } else if (t1 < 0 && t2 >= 0) {
    return R1.concat(R2.slice(1));
  } else if (t1 < 0 && t2 < 0) {
    return R1.slice(0, R1.length - 1).concat(R2);
  }
  throw new Error('Input must be reversals. End/start value repeated?');
}

export function findRainflowCycles(reversals: number[]): [number[][], number[]] {
  const cycles: number[][] = [];
  const residue: number[] = [];

  for (const rev of reversals) {
    residue.push(rev);
    while (residue.length >= 4) {
      const [S0, S1, S2, S3] = residue.slice(-4);
      const dS1 = Math.abs(S1 - S0);
      const dS2 = Math.abs(S2 - S1);
      const dS3 = Math.abs(S3 - S2);

      if (dS2 <= dS1 && dS2 <= dS3) {
        cycles.push([S1, S2]);
        residue.splice(residue.length - 3, 2); // remove S1, S2
      } else {
        break;
      }
    }
  }

  return [cycles, residue];
}
