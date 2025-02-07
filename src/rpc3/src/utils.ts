export function linspace(start: number, stop: number, n: number): number[] {
  if (n === 1) return [start];
  const step = (stop - start) / (n - 1);
  return Array.from({ length: n }, (_, i) => start + i * step);
}

export function arrayMax(y: number[]): number {
  let max = -Infinity;
  for (let i = 0; i < y.length; i++) {
    if (y[i] > max) max = y[i];
  }
  return max;
}

export function arrayMin(y: number[]): number {
  let min = Infinity;
  for (let i = 0; i < y.length; i++) {
    if (y[i] < min) min = y[i];
  }
  return min;
}

export function normalizeInt16(array: number[]): [Int16Array, number] {
  // Array bounds
  const absmaxValue = arrayMax([arrayMax(array), Math.abs(arrayMax(array))]);

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

// Generate a robust filename-based hash (Sync)
export const generateFileHash = (fileName: string): string => {
  const normalizedFileName = normalizeFileName(fileName);
  const timestamp = Date.now().toString(); // Add timestamp to avoid collisions
  return fnv1aHash(normalizedFileName + timestamp);
};
