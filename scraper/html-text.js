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

module.exports = { stripHtmlTags };
