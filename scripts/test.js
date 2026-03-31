import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSegments, groupByAuthor, splitGroup, cleanup, linkCharacters } from './process.js';

// ── parseSegments ────────────────────────────────────────

test('parseSegments: single header + body', () => {
  const input = '[3/17/2026 2:52 AM] tars: Hello world\nSecond line';
  const segs = parseSegments(input);
  assert.equal(segs.length, 1);
  assert.equal(segs[0].authorKey, 'tars');
  assert.equal(segs[0].datetime, '3/17/2026 2:52 AM');
  assert.deepEqual(segs[0].lines, ['Hello world', 'Second line']);
});

test('parseSegments: multiple headers', () => {
  const input = '[3/17/2026 2:52 AM] tars: Line A\n[3/17/2026 3:00 AM] zaveta: Line B';
  const segs = parseSegments(input);
  assert.equal(segs.length, 2);
  assert.equal(segs[0].authorKey, 'tars');
  assert.equal(segs[1].authorKey, 'zaveta');
});

test('parseSegments: header without author inherits previous', () => {
  const input = '[3/17/2026 2:52 AM] tars: First\n[3/17/2026 2:53 AM] Second';
  const segs = parseSegments(input);
  assert.equal(segs.length, 2);
  assert.equal(segs[1].authorKey, 'tars');
  assert.deepEqual(segs[1].lines, ['Second']);
});

test('parseSegments: divider line is kept as content', () => {
  const input = '[3/17/2026 2:52 AM] tars: Before\n***\nAfter';
  const segs = parseSegments(input);
  assert.equal(segs.length, 1);
  assert.ok(segs[0].lines.includes('***'));
});

test('parseSegments: author requires space after colon (tars: content)', () => {
  // HEADER_RX matches "author: " (colon + space); "tars:" alone falls into restOfLine
  const input = '[3/17/2026 2:52 AM] tars: Actual content';
  const segs = parseSegments(input);
  assert.equal(segs.length, 1);
  assert.equal(segs[0].authorKey, 'tars');
  assert.deepEqual(segs[0].lines, ['Actual content']);
});

// ── groupByAuthor ────────────────────────────────────────

test('groupByAuthor: consecutive same author → one group', () => {
  const segs = [
    { authorKey: 'tars', datetime: 't1', lines: ['a'] },
    { authorKey: 'tars', datetime: 't2', lines: ['b'] },
  ];
  const groups = groupByAuthor(segs);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].segments.length, 2);
});

test('groupByAuthor: alternating authors → two groups', () => {
  const segs = [
    { authorKey: 'tars',   datetime: 't1', lines: ['a'] },
    { authorKey: 'zaveta', datetime: 't2', lines: ['b'] },
  ];
  const groups = groupByAuthor(segs);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].authorKey, 'tars');
  assert.equal(groups[1].authorKey, 'zaveta');
});

test('groupByAuthor: same author separated by other → three groups', () => {
  const segs = [
    { authorKey: 'tars',   datetime: 't1', lines: ['a'] },
    { authorKey: 'zaveta', datetime: 't2', lines: ['b'] },
    { authorKey: 'tars',   datetime: 't3', lines: ['c'] },
  ];
  const groups = groupByAuthor(segs);
  assert.equal(groups.length, 3);
});

// ── splitGroup ───────────────────────────────────────────

test('splitGroup: no dividers → one block per segment', () => {
  const group = {
    authorKey: 'tars',
    segments: [
      { datetime: 't1', lines: ['Line one'] },
      { datetime: 't2', lines: ['Line two'] },
    ],
  };
  const blocks = splitGroup(group);
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0].type, 'message');
  assert.equal(blocks[1].type, 'message');
  assert.equal(blocks[0].lines[0], 'Line one');
  assert.equal(blocks[1].lines[0], 'Line two');
});

test('splitGroup: with *** → blocks and dividers', () => {
  const group = {
    authorKey: 'tars',
    segments: [
      { datetime: 't1', lines: ['Before', '***', 'After'] },
    ],
  };
  const blocks = splitGroup(group);
  assert.equal(blocks.length, 3);
  assert.equal(blocks[0].type, 'message');
  assert.equal(blocks[1].type, 'divider');
  assert.equal(blocks[2].type, 'message');
  assert.deepEqual(blocks[0].lines, ['Before']);
  assert.deepEqual(blocks[2].lines, ['After']);
});

test('splitGroup: *** at start → leading divider', () => {
  const group = {
    authorKey: 'tars',
    segments: [
      { datetime: 't1', lines: ['***', 'Content'] },
    ],
  };
  const blocks = splitGroup(group);
  assert.equal(blocks[0].type, 'divider');
  assert.equal(blocks[1].type, 'message');
});

test('splitGroup: empty segment skipped', () => {
  const group = {
    authorKey: 'tars',
    segments: [
      { datetime: 't1', lines: [] },
      { datetime: 't2', lines: ['Text'] },
    ],
  };
  const blocks = splitGroup(group);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].lines[0], 'Text');
});

// ── cleanup ──────────────────────────────────────────────

test('cleanup: collapses 3+ newlines to 2', () => {
  assert.equal(cleanup('a\n\n\n\nb'), 'a\n\nb');
  assert.equal(cleanup('a\n\n\nb'), 'a\n\nb');
  assert.equal(cleanup('a\n\nb'), 'a\n\nb');
});

test('cleanup: trims surrounding whitespace', () => {
  assert.equal(cleanup('\n\ntext\n\n'), 'text');
});

// ── linkCharacters ───────────────────────────────────────

const charData = {
  entries: [
    { text: 'Вэй Усянь',   id: 'wwx', isClan: false },
    { text: 'Лань Ванцзи', id: 'lwj', isClan: false },
    { text: 'Лань',        id: 'lwj', isClan: false }, // short form (part of names list)
  ],
  clanMap: {
    'Лань': ['lwj'],
  },
};

test('linkCharacters: wraps known name in <a>', () => {
  const { text } = linkCharacters('Там был Вэй Усянь.', charData);
  assert.ok(text.includes('<a href="character.html?id=wwx"'));
  assert.ok(text.includes('Вэй Усянь'));
});

test('linkCharacters: longer name wins over shorter', () => {
  // "Лань Ванцзи" should not be split into "Лань" + " Ванцзи"
  const { text } = linkCharacters('Лань Ванцзи молчал.', charData);
  assert.ok(text.includes('data-char-id="lwj"'));
  // should not produce two separate links
  const linkCount = (text.match(/<a /g) || []).length;
  assert.equal(linkCount, 1);
});

test('linkCharacters: unresolved clan → href="" + class unresolved', () => {
  const noSeenData = {
    entries: [],
    clanMap: { 'Лань': ['lwj'] },
  };
  const { text } = linkCharacters('Лань появился.', noSeenData);
  assert.ok(text.includes('class="char-link unresolved"'));
  assert.ok(text.includes('href=""'));
});

test('linkCharacters: resolved clan uses lastSeen', () => {
  const data = {
    entries: [
      { text: 'Лань Ванцзи', id: 'lwj', isClan: false },
    ],
    clanMap: { 'Лань': ['lwj'] },
  };
  const { text } = linkCharacters('Лань Ванцзи улыбнулся. Лань молчал.', data);
  // second "Лань" (clan) should resolve to lwj after seeing "Лань Ванцзи"
  assert.ok(!text.includes('unresolved'));
  const matches = [...text.matchAll(/data-char-id="lwj"/g)];
  assert.equal(matches.length, 2);
});

test('linkCharacters: skips header lines', () => {
  const data = {
    entries: [{ text: 'Вэй Усянь', id: 'wwx', isClan: false }],
    clanMap: {},
  };
  const input = '[3/17/2026 2:52 AM] tars: Вэй Усянь пришёл';
  const { text } = linkCharacters(input, data);
  // header line should be left untouched
  assert.ok(text.startsWith('[3/17/2026'));
  // but content on same line IS part of the header — should not be linked
  assert.ok(!text.includes('<a '));
});

test('linkCharacters: skips divider lines', () => {
  const data = {
    entries: [{ text: 'Вэй Усянь', id: 'wwx', isClan: false }],
    clanMap: {},
  };
  const { text } = linkCharacters('***', data);
  assert.equal(text, '***');
});

test('linkCharacters: tracks appearances', () => {
  const data = {
    entries: [{ text: 'Вэй Усянь', id: 'wwx', isClan: false }],
    clanMap: {},
  };
  const { appearances } = linkCharacters('Вэй Усянь и Вэй Усянь.', data);
  assert.equal(appearances.length, 2);
  assert.equal(appearances[0].characterId, 'wwx');
});
