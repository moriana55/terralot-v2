'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { stripHtmlTags } = require('../html-text');

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
