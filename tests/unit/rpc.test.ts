import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { RPC, Channel, eqDmgSignal, cumulative_rainflow_data, combine_channels_range_counts, calcDamage } from '../../src/rpc3'

const EXAMPLE = path.join(__dirname, '..', 'data', 'SignalExample.rsp');
const SLOPE = 5;

/**
 * Reads an RPC file, instantiates the RPC class, and parses it.
 * Ensures parsing is successful, otherwise throws an error.
 * @param filePath Path to the RPC file
 * @returns Parsed RPC instance
 */
const readSignal = (filePath: string): RPC => {
  const fileBuffer = fs.readFileSync(filePath);
  const rpc = new RPC(fileBuffer, path.basename(filePath), /* debug = */ false);

  if (!rpc.parse()) {
    throw new Error(`Failed to parse RPC file: ${filePath}`);
  }

  return rpc;
};

/** Asserts `actual` is within a relative tolerance of `expected` (default 0.1%). */
const expectClose = (actual: number, expected: number, relTol = 1e-3) => {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(Math.abs(expected) * relTol);
};

/** Sum of the cycle counts stored in a flat [range, count, range, count, ...] array. */
const sumCounts = (rangeCounts: Float64Array) => {
  let sum = 0;
  for (let i = 1; i < rangeCounts.length; i += 2) sum += rangeCounts[i];
  return sum;
};

// Reference values for SignalExample.rsp
const EXPECTED_CHANNELS = [
  { name: 'FDO_54xLoc_sh', units: 'N',     min: -197.966, max: 232.284, damage: 1.19984e+14 },
  { name: 'ACC_76zGlob',   units: 'm/s^2', min: 85.872,   max: 114.325, damage: 1.28108e+08 },
  { name: 'FFG_78zGlob',   units: 'N',     min: 90.330,   max: 126.166, damage: 4.19592e+08 },
  { name: 'FAD_7yknc',     units: 'N',     min: 98.114,   max: 153.353, damage: 2.14057e+09 },
  { name: 'D_23magLo',     units: 'mm',    min: -159.683, max: 955.154, damage: 8.69335e+15 },
];

describe('RPC reading', () => {
  it('parses the header and all channels of SignalExample.rsp', () => {
    const rpc = readSignal(EXAMPLE);

    expect(rpc.Errors).toEqual([]);
    expect(rpc.Headers.CHANNELS).toBe(5);
    expect(rpc.Headers.DELTA_T).toBe(0.004);
    expect(rpc.Channels).toHaveLength(EXPECTED_CHANNELS.length);

    rpc.Channels.forEach((chan, idx) => {
      const exp = EXPECTED_CHANNELS[idx];
      expect(chan.Number).toBe(idx + 1);
      expect(chan.Name).toBe(exp.name);
      expect(chan.Units).toBe(exp.units);
      expect(chan.dt).toBe(0.004);
      expect(chan.value).toHaveLength(2048);
      expect(chan.min).toBeCloseTo(exp.min, 3);
      expect(chan.max).toBeCloseTo(exp.max, 3);
    });
  });
});

describe('RPC writing', () => {
  it('writes SignalExample.rsp and reads it back with identical values', () => {
    const rpc = readSignal(EXAMPLE);
    const tempFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rpc3-')), 'temp.rsp');
    try {
      fs.writeFileSync(tempFile, rpc.write(rpc.Channels));
      const newRpc = readSignal(tempFile);

      expect(newRpc.Errors).toEqual([]);
      expect(newRpc.Channels).toHaveLength(rpc.Channels.length);
      rpc.Channels.forEach((chan, idx) => {
        expect(newRpc.Channels[idx].Name).toBe(chan.Name);
        expect(newRpc.Channels[idx].Units).toBe(chan.Units);
        expect(newRpc.Channels[idx].value).toStrictEqual(chan.value);
      });
    } finally {
      fs.rmSync(path.dirname(tempFile), { recursive: true, force: true });
    }
  });
});

describe('Rainflow counting and damage', () => {
  it('calculates the expected damage for every channel', () => {
    const rpc = readSignal(EXAMPLE);
    rpc.Channels.forEach((chan, idx) => {
      chan.rainflow(1, true);
      expectClose(chan.damage(SLOPE), EXPECTED_CHANNELS[idx].damage);
    });
  });

  it('scales damage linearly with repetitions', () => {
    const rpc = readSignal(EXAMPLE);
    rpc.Channels.forEach(chan => {
      chan.rainflow(1, true);
      const single = chan.damage(SLOPE);
      chan.clearRF();
      chan.rainflow(10, true);
      expectClose(chan.damage(SLOPE), single * 10, 1e-9);
    });
  });

  it('builds cumulative data that ends at all cycles and 100% of damage', () => {
    const rpc = readSignal(EXAMPLE);
    rpc.Channels.forEach(chan => {
      chan.rainflow(1000, true);
      const { ncum, dcum, totalDamage } = cumulative_rainflow_data(chan.range_counts, SLOPE, 0);
      expect(ncum[ncum.length - 1]).toBeCloseTo(sumCounts(chan.range_counts), 6);
      expect(dcum[dcum.length - 1]).toBeCloseTo(100, 6);
      expectClose(totalDamage, chan.damage(SLOPE), 1e-9);
    });
  });
});

describe('Damage equivalent block signal', () => {
  // Same path as the UI with "Combine channels" on: residuals are closed in a combined step
  const eqSignalForChannel = (chan: Channel, rpc: RPC, repetitions: number, blocks: number, minCycles: number) => {
    chan.clearRF();
    chan.rainflow(repetitions, false);
    const events = [{ name: rpc.fileName, hash: rpc.hash, repetitions }];
    const { rangeCounts, residualCycles } = combine_channels_range_counts([chan], events);
    const residual = new Channel(999999, chan.Name, chan.Units, 1, chan.dt, 'Combined residuals');
    residual.setRainflowCycles(residualCycles);
    residual.repetitions = 1;
    const chans = [chan, residual];
    const eqSignal = eqDmgSignal(chans.map(c => c.cycles), chans.map(c => c.repetitions), blocks, minCycles, SLOPE);
    return { eqSignal, damage: calcDamage(SLOPE, rangeCounts) };
  };

  it('preserves the damage of the original signal', () => {
    const rpc = readSignal(EXAMPLE);
    const blocks = 5;
    const minCycles = 250e3;

    rpc.Channels.slice(0, 3).forEach(chan => {
      const { eqSignal, damage } = eqSignalForChannel(chan, rpc, 10000, blocks, minCycles);

      expect(eqSignal).toHaveLength(blocks);
      // Total damage is preserved
      expectClose(eqSignal.reduce((acc, row) => acc + row[4], 0), damage);
      // Damage percentages add up to 100%
      expect(eqSignal.reduce((acc, row) => acc + row[3], 0)).toBeCloseTo(100, 6);
      // At least the requested number of cycles
      expect(eqSignal.reduce((acc, row) => acc + row[2], 0)).toBeGreaterThanOrEqual(minCycles);
      // Blocks are ordered from the highest range to the lowest
      for (let i = 1; i < eqSignal.length; i++) {
        expect(eqSignal[i][0]).toBeLessThanOrEqual(eqSignal[i - 1][0]);
      }
    });
  });

  it('throws when the signal has fewer cycles than the requested minimum', () => {
    const rpc = readSignal(EXAMPLE);
    expect(() => eqSignalForChannel(rpc.Channels[0], rpc, 1, 5, 250e3))
      .toThrow('Original signal has less cycles than requested minimum.');
  });
});
