'use strict';

function stripHtmlTags(value) {
  const html = String(value == null ? '' : value);
  let text = '';
  let insideTag = false;
  let quote = null;

  for (const char of html) {
    if (!insideTag) {
      if (char === '<') {
        insideTag = true;
        text += ' ';
      } else {
        text += char;
      }
      continue;
    }

    if (quote) {
      if (char === quote) quote = null;
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === '>') {
      insideTag = false;
    }
  }

  return text;
}

function decodeHtmlEntities(value) {
  const source = String(value == null ? '' : value);
  const entities = new Map([
    ['amp', '&'],
    ['#x27', "'"],
    ['#39', "'"],
    ['quot', '"'],
    ['lt', '<'],
    ['gt', '>'],
    ['nbsp', ' '],
  ]);
  let decoded = '';

  for (let cursor = 0; cursor < source.length; cursor += 1) {
    if (source[cursor] !== '&') {
      decoded += source[cursor];
      continue;
    }
    const end = source.indexOf(';', cursor + 1);
    if (end === -1 || end - cursor > 10) {
      decoded += '&';
      continue;
    }
    const replacement = entities.get(source.slice(cursor + 1, end).toLowerCase());
    if (replacement === undefined) {
      decoded += '&';
      continue;
    }
    decoded += replacement;
    cursor = end;
  }

  return decoded;
}

module.exports = { decodeHtmlEntities, stripHtmlTags };
