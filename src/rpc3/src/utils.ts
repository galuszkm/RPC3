/**
 * Generates a linearly spaced array between two values.
 *
 * @param start - The starting value of the sequence.
 * @param stop - The ending value of the sequence.
 * @param n - The number of points to generate.
 * @returns A `Float64Array` containing `num` evenly spaced values.
 */
export function linspace(start: number, stop: number, n: number): number[] {
  const step = (stop - start) / (n - 1);
  const arr = [];
  for (let i = 0; i < n; i++) {
    arr.push(start + step * i);
  }
  return arr;
}

export const findMinMax = (arr: Float64Array|number[]): { min: number; max: number } => {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] < min) min = arr[i];
    if (arr[i] > max) max = arr[i];
  }
  return { min, max };
};

export const findMin = (arr: Float64Array|number[]): number => {
  let min = Infinity;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] < min) min = arr[i];;
  }
  return min;
};

export const findMax = (arr: Float64Array|number[]): number  => {
  let max = -Infinity;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] > max) max = arr[i];
  }
  return max;
};

/**
 * Computes the mean (average) of a large `Float64Array` efficiently.
 *
 * Uses a loop-based summation approach to minimize memory overhead
 * and maximize performance for large datasets.
 *
 * @param data - A `Float64Array` containing numerical values.
 * @returns The mean (average) value of the array.
 * @throws Error if the array is empty.
 */
export function findMean(data: Float64Array|number[]): number {
  const len = data.length;
  if (len === 0) {
    throw new Error("Cannot compute mean of an empty array.");
  }
  let sum = 0;
  for (let i = 0; i < len; i++) {
    sum += data[i];
  }
  return sum / len;
}

export function normalizeInt16(array: Float64Array): [Int16Array, number] {
  // Array bounds
  const { max } = findMinMax(array)
  const absmaxValue = Math.max(max, Math.abs(max));

  // Normalization factor
  const factor = absmaxValue / (Math.pow(2, 15) - 1);

  // Normalize array
  const normalizedArray = new Int16Array(array.map(value => Math.round(value / factor)));

  return [normalizedArray, factor];
}

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 B";

  const units = ["B", "kB", "MB", "GB", "TB"];
  const exponent = Math.floor(Math.log10(bytes) / 3); // Find the correct unit index
  const value = bytes / Math.pow(1000, exponent); // Convert bytes to unit

  return `${value.toFixed(value < 10 ? 2 : 1)} ${units[exponent]}`; // Keep 2 decimals for <10, otherwise 1
};

// Normalize the filename: remove diacritics and special characters
const normalizeFileName = (fileName: string): string => {
  return fileName
    .normalize("NFD") // Normalize diacritics
    .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
    .replace(/[^a-zA-Z0-9_.-]/g, "_") // Replace special characters
    .toLowerCase();
};

// FNV-1a Hash Function (Sync)
const fnv1aHash = (str: string): string => {
  let hash = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24); // FNV-1a bitwise ops
  }
  return (hash >>> 0).toString(16); // Convert to unsigned 32-bit hex
};

// Generate a robust string-based hash (Sync)
export const generateHash = (name: string): string => {
  const normalizedFileName = normalizeFileName(name);
  const timestamp = Date.now().toString(); // Add timestamp to avoid collisions
  return fnv1aHash(normalizedFileName + timestamp);
};

/**
 * Calculates total damage based on range and cycle count pairs.
 * 
 * @param {number} slope - The exponent used in the damage calculation.
 * @param {Float64Array} range_counts - Input cycle data as [range1, count1, range2, count2, ...].
 * @returns {number} - The total damage sum.
 */
export function calcDamage(slope: number, range_counts: Float64Array): number {
  let totalDamage = 0;

  // Process range_counts as pairs [range, count]
  for (let i = 0; i < range_counts.length; i += 2) {
    const range = range_counts[i];        // Range value
    const count = range_counts[i + 1];    // Count value
    totalDamage += Math.pow(range, slope) * count;
  }

  return totalDamage;
}

export function prettyNumberFormat(x: number, round?: number) {
  return Number(x.toFixed(round)).toLocaleString("en-US").replace(/,/g, " ")
}
