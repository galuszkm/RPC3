import * as fs from 'fs';
import * as path from 'path';
import { RPC } from '../src/rpc';

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

/**
 * Writes an RPC object to a temporary file.
 * @param rpc RPC instance
 * @returns Path to the temporary file
 */
const writeTempSignal = (rpc: RPC): string => {
  const binary = rpc.write(rpc.Channels);
  const tempFile = path.join(__dirname, 'data', 'temp.rsp');
  fs.writeFileSync(tempFile, binary);
  return tempFile;
};

/**
 * Safely removes a file if it exists.
 * @param filePath Path to the file to delete
 */
const removeFile = (filePath: string) => {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
};

describe('RPC Reading Tests', () => {
  const filePath = path.join(__dirname, 'data', 'SignalExample.rsp');

  it('should read and parse SignalExample.rsp without errors', () => {
    const rpc = readSignal(filePath);

    // Basic checks
    expect(rpc.Errors.length).toBe(0);
    expect(rpc.Channels.length).toBe(5);

    // Validate channels
    rpc.Channels.forEach(chan => {
      expect(chan.max).toBeLessThan(1000);
      expect(chan.min).toBeGreaterThan(-1000);
    });
  });
});

describe('RPC Writing Tests', () => {
  const filePath = path.join(__dirname, 'data', 'SignalExample.rsp');

  it('should write and read back SignalExample.rsp without errors', () => {
    const rpc = readSignal(filePath);
    const tempFile = writeTempSignal(rpc);
    const newRpc = readSignal(tempFile);

    // Cleanup
    removeFile(tempFile);

    // Basic checks
    expect(newRpc.Errors.length).toBe(0);
    expect(newRpc.Channels.length).toBe(rpc.Channels.length);

    // Ensure channel values are identical
    rpc.Channels.forEach((chan, idx) => {
      expect(chan.value).toStrictEqual(newRpc.Channels[idx].value);
    });
  });
});

describe('Rainflow counting', () => {
  const filePath = path.join(__dirname, 'data', 'SignalExample.rsp');

  it('should perform rainflow counting of channel and calculate expected damage values without errors', () => {
    const rpc = readSignal(filePath);

    // Basic checks
    expect(rpc.Errors.length).toBe(0);

    const channels = rpc.Channels.slice(0, 3)
    channels.forEach(i => i.rainflow(1, true))

    // Damage calculations
    const damage = channels.map(i => i.damage(5));

    // Expected values
    const expectedDamage = [
      1.20005e+14,
      1.28079e+08,
      4.19604e+08
    ];
    expectedDamage.forEach((i, idx) => {
      expect(damage[idx]-i).toBeLessThan(i/1000);
    })
    
  });
});
