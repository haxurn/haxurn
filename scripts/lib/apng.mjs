import { crc32, deflateSync } from 'node:zlib';

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const COLOR_TYPE_INDEXED = 3;
const BIT_DEPTH = 8;
const DELAY_NUMERATOR = 1;

function chunk(type, data = Buffer.alloc(0)) {
  const typeBytes = Buffer.from(type, 'latin1');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])) >>> 0);
  return Buffer.concat([length, typeBytes, data, checksum]);
}

function headerChunks(width, height, palette) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = BIT_DEPTH;
  header[9] = COLOR_TYPE_INDEXED;
  const colors = Buffer.from(palette.flatMap((hex) => [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16))));
  return [chunk('IHDR', header), chunk('PLTE', colors)];
}

function compress(pixels, width, height) {
  const scanlines = Buffer.alloc((width + 1) * height);
  for (let row = 0; row < height; row++) {
    Buffer.from(pixels.buffer, pixels.byteOffset + row * width, width).copy(scanlines, row * (width + 1) + 1);
  }
  return deflateSync(scanlines, { level: 9 });
}

function frameControl(sequence, width, height, fps) {
  const control = Buffer.alloc(26);
  control.writeUInt32BE(sequence, 0);
  control.writeUInt32BE(width, 4);
  control.writeUInt32BE(height, 8);
  control.writeUInt16BE(DELAY_NUMERATOR, 20);
  control.writeUInt16BE(fps, 22);
  return chunk('fcTL', control);
}

function withSequence(sequence, data) {
  const prefix = Buffer.alloc(4);
  prefix.writeUInt32BE(sequence);
  return Buffer.concat([prefix, data]);
}

export function encodePng({ width, height, palette, pixels }) {
  return Buffer.concat([
    PNG_SIGNATURE,
    ...headerChunks(width, height, palette),
    chunk('IDAT', compress(pixels, width, height)),
    chunk('IEND'),
  ]);
}

export function encodeApng({ width, height, palette, frames, fps }) {
  const animation = Buffer.alloc(8);
  animation.writeUInt32BE(frames.length, 0);

  let sequence = 0;
  const frameChunks = frames.flatMap((pixels, index) => {
    const control = frameControl(sequence++, width, height, fps);
    const data = compress(pixels, width, height);
    return index === 0 ? [control, chunk('IDAT', data)] : [control, chunk('fdAT', withSequence(sequence++, data))];
  });

  return Buffer.concat([
    PNG_SIGNATURE,
    ...headerChunks(width, height, palette),
    chunk('acTL', animation),
    ...frameChunks,
    chunk('IEND'),
  ]);
}
