// rpc.ts
import { Buffer } from 'buffer';
import { Channel } from './channel';
import struct from 'python-struct';
import { normalizeInt16, formatFileSize, generateHash } from './utils';

type DataType = 'FLOATING_POINT' | 'SHORT_INTEGER';

interface HeaderMap {
  [key: string]: string | number;
}

interface DataTypeInfo {
  unpackSize: number; // bytes
  unpackChar: string,
}

const DATA_TYPES: Record<DataType, DataTypeInfo> = {
  FLOATING_POINT: {
    unpackSize: 4,
    unpackChar: 'f',
  },
  SHORT_INTEGER: {
    unpackSize: 2,
    unpackChar: 'h',
  }
};

export class RPC {
  public Channels: Channel[] = [];
  public Headers: HeaderMap = {};
  public Errors: string[] = [];
  private dt = 0
  public lastModified:Date = new Date();
  private _hash:string = "";

  constructor(
    private bytes: Buffer, 
    public fileName: string, 
    private debug: boolean = false, 
    private extra_headers: HeaderMap = {}
  ) {
    this.extra_headers = {
      INT_FULL_SCALE: 2 ** 15,
      DATA_TYPE: 'SHORT_INTEGER',
      ...extra_headers
    }
    //  Set hash
    this._hash = generateHash(fileName)
  }

  public parse(): boolean {
    if (!this.readHeader()) {
      return false;
    }
    return this.readData();
  }

  public write(channels:Channel[]): Buffer<ArrayBuffer> {
    // Defaults
    const PTS_PER_FRAME = 1024;

    const __channels__ = channels.map(c => normalizeInt16(c.value));
    const __max_chan_len__ = Math.max(...__channels__.map(c => c[0].length));
    const FRAMES = Math.ceil(__max_chan_len__ / PTS_PER_FRAME);
    const PTS_PER_GROUP = FRAMES * PTS_PER_FRAME;

    const chanHead = __channels__.map((c, idx) => [
      channels[idx].Name,
      channels[idx].Units,
      c[1].toExponential(6)
    ]);

    //  Create Header and Data
    const header = this.writeHeader(this.dt, chanHead, PTS_PER_FRAME, FRAMES, PTS_PER_GROUP);
    const data = this.writeData(__channels__.map(c => c[0]), PTS_PER_GROUP);
    // Convert to buffer
    const binary = Buffer.concat([header, data]);

    return binary
  }

  private readHeader(): boolean {
    // Helper function to read a single 128-byte header block at the given offset
    const parseHeaderBlock = (buffer: Buffer, offset: number): [string | null, string | null, number | null] => {
      try {
        // Each header block is 128 bytes total
        const block = buffer.subarray(offset, offset + 128);
  
        // First 32 bytes are the header name, next 96 are the header value
        const headBytes = block.subarray(0, 32);
        const valBytes = block.subarray(32);
  
        // Use TextDecoder with 'windows-1251' if your file is encoded that way
        // (requires Node 19+ or a polyfill for older versions)
        const decoder = new TextDecoder('windows-1251');
        const headStr = decoder.decode(headBytes).replace(/\0/g, '').replace(/\n/g, '');
        const valStr = decoder.decode(valBytes).replace(/\0/g, '').replace(/\n/g, '');
  
        // Return the parsed header name, value, and the new offset
        return [headStr, valStr, offset + 128];
      } catch (e) {
        this.Errors.push(
          'Header of the file does not contain sufficient data to read 128 bytes'
        );
        return [null, null, null];
      }
    };
  
    let idx = 0;
  
    // First, read the first three headers: FORMAT, NUM_HEADER_BLOCKS, NUM_PARAMS
    const requiredFirstHeaders = ['FORMAT', 'NUM_HEADER_BLOCKS', 'NUM_PARAMS'];
    for (let i = 0; i < 3; i++) {
      const [headName, headValue, nextOffset] = parseHeaderBlock(this.bytes, idx);
      if (headName === null || headValue === null || nextOffset === null) {
        this.Errors.push(`Header ${headName} - invalid value: ${headValue}`)
        return false; // parse error
      }
      idx = nextOffset;
  
      if (!requiredFirstHeaders.includes(headName)) {
        this.Errors.push('Header of the file does not contain required fields');
        return false;
      }
      // Depending on which of the three it is, store value appropriately
      if (['NUM_HEADER_BLOCKS', 'NUM_PARAMS'].includes(headName)) {
        this.Headers[headName] = parseInt(headValue, 10);
      } else {
        this.Headers[headName] = headValue;
      }
      // Debuging
      if (this.debug) {
        console.log(`${headName.padEnd(32)}: ${headValue}`);
      }
    }
  
    // Basic validation
    const numParams = Number(this.Headers.NUM_PARAMS);
    if (!(numParams > 3)) {
      this.Errors.push('No data in file (NUM_PARAMS <= 3)');
      return false;
    }
  
    // Read the rest of the headers, from index 3 up to NUM_PARAMS - 1
    // We've already read 3, so keep going
    for (let headerIndex = 3; headerIndex < numParams; headerIndex++) {
      const [headName, headValue, nextOffset] = parseHeaderBlock(this.bytes, idx);
      if (headName === null || headValue === null || nextOffset === null) {
        this.Errors.push(`Header ${headName} - invalid value: ${headValue}`)
        return false
      }
      idx = nextOffset;
  
      // Only set if the name is not empty
      if (headName.trim().length > 0) {
        this.Headers[headName] = String(headValue);
        if (this.debug) {
          console.log(`${headName.padEnd(32)}: ${headValue}`);
        }
      }
    }
  
    // Add/merge any extraHeaders you might have defined
    // E.g., default values if they weren't in the file
    for (const [headerName, headValue] of Object.entries(this.extra_headers)) {
      if (!(headerName in this.Headers)) {
        if (this.debug) {
          console.log(`Adding extra header:\t${headerName} - ${headValue}`);
        }
        this.Headers[headerName] = headValue;
      } else if (this.debug) {
        console.log(
          `WARNING: Extra header already defined in RPC file, skipping\n\t ${headerName} - ${headValue}`
        );
      }
    }

    // Check mandatory headers
    // For 'SHORT_INTEGER' we also require INT_FULL_SCALE.
    const mandatoryCommon = [
      'NUM_HEADER_BLOCKS',
      'CHANNELS',
      'DELTA_T',
      'PTS_PER_FRAME',
      'PTS_PER_GROUP',
      'FRAMES',
      'DATA_TYPE'
    ];
    // Check presence of each common field
    for (const field of mandatoryCommon) {
      if (this.Headers[field] === undefined) {
        this.Errors.push(`Missing mandatory header: ${field}`);
      }
    }
    // If we already have errors, bail out
    if (this.Errors.length > 0) {
      return false;
    }
    // If the file says it's short integer, also check INT_FULL_SCALE
    const dataTypeInHeader = String(this.Headers.DATA_TYPE);
    if (dataTypeInHeader === 'SHORT_INTEGER' && this.Headers.INT_FULL_SCALE === undefined) {
      this.Errors.push('Missing mandatory header: INT_FULL_SCALE for SHORT_INTEGER');
      return false;
    }

  
    // Now parse mandatory numeric headers. If any are missing or invalid, bail out
    try {
      // NUM_HEADER_BLOCKS is used for data offset or validation
      this.Headers.NUM_HEADER_BLOCKS = parseInt(String(this.Headers.NUM_HEADER_BLOCKS), 10);
      // Channel-related
      this.Headers.CHANNELS = parseInt(String(this.Headers.CHANNELS), 10);
      // Time interval
      this.Headers.DELTA_T = parseFloat(String(this.Headers.DELTA_T));
      // For the data structure
      this.Headers.PTS_PER_FRAME = parseInt(String(this.Headers.PTS_PER_FRAME), 10);
      this.Headers.PTS_PER_GROUP = parseInt(String(this.Headers.PTS_PER_GROUP), 10);
      this.Headers.FRAMES = parseInt(String(this.Headers.FRAMES), 10);
      // Time interval
      this.dt = this.Headers.DELTA_T;
  
      if (dataTypeInHeader === 'SHORT_INTEGER') {
        this.Headers.INT_FULL_SCALE = parseInt(String(this.Headers.INT_FULL_SCALE), 10);
      }
    } catch (err) {
      this.Errors.push(`A mandatory header is missing or invalid: ${err}`);
      return false;
    }
    
    // Create channels. For each channel, read scale factor, name, units, etc.
    for (let idx = 0; idx < this.Headers.CHANNELS; idx++) {
      let scaleFactor = 1.0;
      if (dataTypeInHeader === 'SHORT_INTEGER') {
        scaleFactor = parseFloat(String(this.Headers['SCALE.CHAN_' + (idx + 1)]));
      }
      //  Channel name and units
      const name = String(this.Headers['DESC.CHAN_' + (idx + 1)]);
      const units = String(this.Headers['UNITS.CHAN_' + (idx + 1)]);
      
      // Create Channel instance and add to collection
      const channelObj = new Channel(
        idx + 1,
        name,
        units,
        scaleFactor,
        this.dt,
        this.fileName,
        this.hash,
      );
      this.Channels.push(channelObj);
    }
  
    // If we reach here, header parsing succeeded
    return true;
  }

  private readData(): boolean {
    const channels =  Number(this.Headers.CHANNELS);
    const point_per_frame = Number(this.Headers.PTS_PER_FRAME);
    const point_per_group = Number(this.Headers.PTS_PER_GROUP);
    const frames =  Number(this.Headers.FRAMES);

    // Recreate structure of demultiplexed data
    const frames_per_group = parseInt(String(point_per_group / point_per_frame), 10);
    const number_of_groups = parseInt(String(Math.ceil(frames / frames_per_group)));
    const data_order = [];
    let frame_no = 1;
    let removeLastFrame = false;

    for (let i=0; i<number_of_groups; i++){
      if (frame_no > frames) { removeLastFrame=true }
      let temp = []
      for (let j=0; j<frames_per_group; j++){
        if (frame_no > frames) { removeLastFrame=true }
        temp.push(frame_no)
        frame_no += 1
      }
      data_order.push(temp);
    }

    // Check that data type matches file size
    const actual_data_size = this.bytes.length - Number(this.Headers.NUM_HEADER_BLOCKS) * 512;
    const dataType = (this.Headers.DATA_TYPE as DataType) || 'SHORT_INTEGER';
    const unpackSize = DATA_TYPES[dataType].unpackSize;
    const unpackChar = DATA_TYPES[dataType].unpackChar;
    const expected_data_size = point_per_frame * unpackSize * frames_per_group * number_of_groups * channels;

    if (actual_data_size !== expected_data_size) {
      if (this.debug) {
        console.log(
          ' ERROR: DATA_TYPE problem - Data cant be decoded correctly' +
          '\n\tActual data size in bytes:   ' + actual_data_size +
          '\n\tExpected data size in bytes: '+ expected_data_size
        )
      }
      this.Errors.push(`DATA_TYPE error: size is ${actual_data_size}B - expected ${expected_data_size}B`)
      return false
    }

    // Initialize Channel value as Float64Array
    for (let channel = 0; channel < channels; channel++) {
      const expectedSize = frames * point_per_frame;
      this.Channels[channel].value = new Float64Array(expectedSize);
    }
    
    let idx = Number(this.Headers.NUM_HEADER_BLOCKS)*512;
    const writeIndex = Array(channels).fill(0);

    for (let frame_group of data_order) {
      for (let channel = 0; channel < channels; channel++) {
        // Set scale factor (use channel scale if data type is SHORT INTEGER)
        let scale_factor = dataType === 'SHORT_INTEGER' ? this.Channels[channel].scale : 1.0;
  
        // Unpack all frames with struct pkg
        for (let frame = 0; frame < frame_group.length; frame++) {
          const idxLast = idx + point_per_frame * unpackSize;
          const buffer = this.bytes.subarray(idx, idxLast);
  
          // Unpack the binary data into an array of numbers
          const data = struct.unpack(`<${point_per_frame}${unpackChar}`, buffer) as number[];
  
          // Directly modify `Float64Array` (avoids `.map()` overhead)
          for (let i = 0; i < data.length; i++) {
            this.Channels[channel].value[writeIndex[channel]++] = data[i] * scale_factor;
          }
          // Set last idx as current
          idx = idxLast;
        }
      }
    }
    
    // Efficiently truncate the array (if needed) without reallocation
    this.Channels.forEach(channel => {
      if (removeLastFrame) {
        channel.value = channel.value.subarray(0, point_per_frame * frames);
      }
      channel.setMinMax();
    });

    return true
  }

  private writeHeader(dt:number, chanData:string[][], PTS_PER_FRAME:number, FRAMES:number, PTS_PER_GROUP:number): Buffer<ArrayBuffer> {
    // Current time
    const ctime = new Date();
    
    // Header keys
    const keys = [
      'FORMAT',
      'NUM_HEADER_BLOCKS',
      'NUM_PARAMS',
      'FILE_TYPE',
      'TIME_TYPE',
      'DELTA_T',
      'CHANNELS',
      'DATE',
      'REPEATS',
      'DATA_TYPE',
      'PTS_PER_FRAME',
      'PTS_PER_GROUP',
      'FRAMES'
    ];
    // Channel header keys
    const channelKeys = [
      'DESC.CHAN_',
      'UNITS.CHAN_',
      'SCALE.CHAN_',
      'LOWER_LIMIT.CHAN_',
      'UPPER_LIMIT.CHAN_'
    ];
    // Header values
    const values = [
      'BINARY',
      Math.ceil((keys.length + channelKeys.length * chanData.length) / 4).toString(),
      (keys.length + channelKeys.length * chanData.length).toString(),
      'TIME_HISTORY',
      'RESPONSE',
      dt.toExponential(6),
      chanData.length.toString(),
      `${ctime.getHours()}:${ctime.getMinutes()}:${ctime.getSeconds()} ${ctime.getDate()}-${ctime.getMonth() + 1}-${ctime.getFullYear()}`,
      '1',
      'SHORT_INTEGER',
      PTS_PER_FRAME.toString(),
      PTS_PER_GROUP.toString(),
      FRAMES.toString()
    ];
    // Add channels headers keys and values
    for (let idx = 0; idx < chanData.length; idx++) {
      values.push(...chanData[idx], '1', '-1');
      keys.push(...channelKeys.map(key => key + (idx + 1)));
    }

    let HEADER = Buffer.alloc(0);
    for (let idx = 0; idx < keys.length; idx++) {
      const keyBuffer = Buffer.from(keys[idx].padEnd(32, '\x00'), 'binary');
      const valueBuffer = Buffer.from(values[idx].padEnd(96, '\x00'), 'binary');
      HEADER = Buffer.concat([HEADER, keyBuffer, valueBuffer]);
    }

    const headerLen = 512 * parseInt(values[1]);
    HEADER = Buffer.concat([HEADER, Buffer.alloc(headerLen - HEADER.length)]);
    
    return HEADER;
  }

  private writeData(data:Int16Array[], PTS_PER_GROUP:number): Buffer<ArrayBuffer> {
    let DATA = Buffer.alloc(0);

    for (const d of data) {
        if (d.length < PTS_PER_GROUP) {
          const lastItem = d[d.length - 1] 
          const padding = PTS_PER_GROUP - d.length;

          let data2pad = []
          for (let i=0; i<padding; i++) data2pad.push(lastItem)
          const intData = new Int16Array(data2pad);

          const paddedData = Buffer.concat([Buffer.from(d.buffer), Buffer.from(intData.buffer)]);
          DATA = Buffer.concat([DATA, paddedData]);
          
        } else {
            DATA = Buffer.concat([DATA, Buffer.from(d.buffer)]);
        }
    }
    return DATA
  }

  get fileSize(): string {
    return formatFileSize(this.bytes.length)
  }

  get hash(): string {
    return this._hash
  }
}
