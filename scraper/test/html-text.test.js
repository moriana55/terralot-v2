'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { decodeHtmlEntities, stripHtmlTags } = require('../html-text');

test('stripHtmlTags removes markup without trusting > inside quoted attributes', () => {
  assert.equal(
    stripHtmlTags('<p title="1 > 0" data-note=\'safe > value\'>Owner <strong>Name</strong></p>'),
    ' Owner  Name  ',
  );
});

test('stripHtmlTags handles null and plain text', () => {
  assert.equal(stripHtmlTags(null), '');
  assert.equal(stripHtmlTags('Parcel 42'), 'Parcel 42');
});

test('decodeHtmlEntities decodes exactly one layer', () => {
  assert.equal(decodeHtmlEntities('&lt;b&gt;Owner&amp;Co&lt;/b&gt;'), '<b>Owner&Co</b>');
  assert.equal(decodeHtmlEntities('&amp;lt;script&amp;gt;'), '&lt;script&gt;');
});
