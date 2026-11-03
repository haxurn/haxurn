import opentype from 'opentype.js';

const PATH_DECIMALS = 2;
const ELLIPSIS = '…';
const NOTDEF_GLYPH = 0;

function toArrayBuffer(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

function ellipsize(line, fits) {
  let text = line;
  while (text && !fits(`${text}${ELLIPSIS}`)) text = text.slice(0, -1).trimEnd();
  return `${text}${ELLIPSIS}`;
}

/** Turns strings into SVG path data, so panels need no font at view time. */
export function createTypesetter(fontBuffer) {
  const font = opentype.parse(toArrayBuffer(fontBuffer));
  const options = (tracking) => ({ kerning: true, letterSpacing: tracking, features: { liga: false, rlig: false } });

  const width = (text, size, tracking = 0) => font.getAdvanceWidth(text, size, options(tracking));
  const path = (text, x, y, size, tracking = 0) => {
    const missing = [...text].find((char) => !/\s/.test(char) && font.charToGlyphIndex(char) === NOTDEF_GLYPH);
    if (missing) throw new Error(`Font has no glyph for "${missing}" in "${text}"`);
    return font.getPath(text, x, y, size, options(tracking)).toPathData(PATH_DECIMALS);
  };

  function wrap(text, size, maxWidth, maxLines) {
    const fits = (line) => width(line, size) <= maxWidth;
    const lines = [];
    let current = '';
    const words = text.split(/\s+/);
    for (let index = 0; index < words.length; index++) {
      const candidate = current ? `${current} ${words[index]}` : words[index];
      if (fits(candidate)) {
        current = candidate;
      } else if (lines.length === maxLines - 1) {
        return [...lines, ellipsize(candidate, fits)];
      } else {
        lines.push(current);
        current = words[index];
      }
    }
    return [...lines, current];
  }

  return { width, path, wrap };
}

/** Single-font path for pre-outlined artwork, normalized to a font size of 100. */
export function outlineString(fontBuffer, text, tracking) {
  const type = createTypesetter(fontBuffer);
  return { d: type.path(text, 0, 0, 100, tracking), width: type.width(text, 100, tracking) };
}
