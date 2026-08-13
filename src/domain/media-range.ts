export type ByteRange = { start: number; end: number };

export function parseByteRange(header: string | null, size: number): ByteRange | null {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || size <= 0) throw new RangeError('Invalid byte range');

  const [, startText, endText] = match;
  if (!startText && !endText) throw new RangeError('Invalid byte range');

  let start: number;
  let end: number;
  if (!startText) {
    const suffix = Number(endText);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) throw new RangeError('Invalid byte range');
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(startText);
    end = endText ? Number(endText) : size - 1;
  }

  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= size || end < start) {
    throw new RangeError('Unsatisfiable byte range');
  }
  return { start, end: Math.min(end, size - 1) };
}

