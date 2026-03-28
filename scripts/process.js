import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const MAIN_PATH = join(ROOT, 'content', 'main.md');
const BLOCKS_DIR = join(ROOT, 'content', 'blocks');
const CHARACTERS_PATH = join(ROOT, 'data', 'characters', 'index.json');
const RULES_PATH = join(ROOT, 'data', 'parser-rules.json');
const APPEARANCES_PATH = join(ROOT, 'data', 'character-appearances.json');

// ── Header pattern ──────────────────────────────────────
// [3/17/2026 2:52 AM] Author: text...
// [3/17/2026 2:52 AM] text...  (no author, bare date)
const HEADER_RX = /^\[(\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?)\]\s*(?:([\w][\w-]*):\s)?(.*)$/i;

const DIVIDER_RX = /^\*{3,}$/;

// ── Load data ───────────────────────────────────────────
function loadCharacters() {
  const raw = JSON.parse(readFileSync(CHARACTERS_PATH, 'utf-8'));
  const entries = [];
  const clanMap = {};

  for (const char of raw) {
    for (const name of char.names) {
      entries.push({ text: name, id: char.id, isClan: false });
    }
    if (char.clan) {
      if (!clanMap[char.clan]) clanMap[char.clan] = [];
      clanMap[char.clan].push(char.id);
    }
  }

  return { entries, clanMap };
}

function loadAuthors() {
  const rules = JSON.parse(readFileSync(RULES_PATH, 'utf-8'));
  const map = {};
  for (const a of rules.authors) {
    for (const name of a.names) {
      map[name.toLowerCase()] = a;
    }
  }
  return map;
}

function getNextIndex(authorId) {
  if (!existsSync(BLOCKS_DIR)) return 0;
  const files = readdirSync(BLOCKS_DIR);
  const rx = new RegExp(`^${authorId}_(\\d+)\\.md$`);
  let max = -1;
  for (const f of files) {
    const m = f.match(rx);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return max + 1;
}

// ── Character linker ────────────────────────────────────
function linkCharacters(text, charData) {
  const { entries, clanMap } = charData;
  const lastSeen = {};
  const appearances = [];

  // собрать все токены: имена персонажей + клановые фамилии
  const tokens = [];
  for (const e of entries) {
    tokens.push({ text: e.text, id: e.id, type: 'name' });
  }
  for (const [clan, ids] of Object.entries(clanMap)) {
    tokens.push({ text: clan, ids, type: 'clan' });
  }

  // длинные первыми
  tokens.sort((a, b) => b.text.length - a.text.length);

  // построить один regex из всех токенов
  const escaped = tokens.map(t => escapeRegex(t.text));
  const combinedRx = new RegExp(`(${escaped.join('|')})`, 'g');

  // токен-лукап
  const tokenMap = {};
  for (const t of tokens) {
    if (!tokenMap[t.text]) tokenMap[t.text] = t;
  }

  // линейный проход
  let result = '';
  let lastIndex = 0;

  // нельзя просто replaceAll - нужен порядковый проход для lastSeen
  // разобьем текст на строки, обработаем каждую
  const lines = text.split('\n');
  const linkedLines = [];

  for (const line of lines) {
    // пропускать строки-заголовки и дивайдеры — их линковать не нужно
    if (HEADER_RX.test(line) || DIVIDER_RX.test(line)) {
      linkedLines.push(line);
      continue;
    }

    let linked = '';
    let pos = 0;
    const matches = [...line.matchAll(combinedRx)];

    // дедупликация перекрытий: если матч начинается внутри предыдущего, пропустить
    const filtered = [];
    let lastEnd = 0;
    for (const m of matches) {
      if (m.index >= lastEnd) {
        filtered.push(m);
        lastEnd = m.index + m[0].length;
      }
    }

    for (const m of filtered) {
      const matchText = m[0];
      const matchStart = m.index;
      const token = tokenMap[matchText];

      linked += line.slice(pos, matchStart);

      if (token.type === 'name') {
        linked += `<a href="character.html?id=${token.id}" class="char-link">${matchText}</a>`;
        // обновить lastSeen для клана этого персонажа
        for (const [clan, ids] of Object.entries(clanMap)) {
          if (ids.includes(token.id)) {
            lastSeen[clan] = token.id;
          }
        }
        appearances.push({ characterId: token.id, text: matchText });
      } else {
        // клановая фамилия
        const clan = matchText;
        const resolved = lastSeen[clan];
        if (resolved) {
          linked += `<a href="character.html?id=${resolved}" class="char-link">${matchText}</a>`;
        } else {
          linked += `<a href="" class="char-link unresolved">${matchText}</a>`;
        }
        appearances.push({ characterId: resolved || null, text: matchText, unresolved: !resolved });
      }

      pos = matchStart + matchText.length;
    }

    linked += line.slice(pos);
    linkedLines.push(linked);
  }

  return { text: linkedLines.join('\n'), appearances };
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ── Parser ──────────────────────────────────────────────
function parseSegments(text) {
  const lines = text.split('\n');
  const segments = []; // { authorKey, datetime, lines[] }
  let current = null;

  for (const line of lines) {
    const hm = line.match(HEADER_RX);
    if (hm) {
      const datetime = hm[1];
      const authorKey = hm[2] || null; // может быть null
      const restOfLine = hm[3] || '';

      // начало нового сегмента
      if (current) segments.push(current);
      current = {
        authorKey: authorKey ? authorKey.toLowerCase() : (current?.authorKey || null),
        datetime,
        lines: []
      };
      // остаток строки после заголовка — это контент
      if (restOfLine.trim()) {
        current.lines.push(restOfLine);
      }
      continue;
    }

    if (!current) {
      // текст до первого заголовка — создаем безавторный сегмент
      current = { authorKey: null, datetime: null, lines: [] };
    }
    current.lines.push(line);
  }

  if (current) segments.push(current);
  return segments;
}

function groupByAuthor(segments) {
  // группируем последовательные сегменты одного автора
  const groups = [];
  let currentGroup = null;

  for (const seg of segments) {
    if (!currentGroup || currentGroup.authorKey !== seg.authorKey) {
      if (currentGroup) groups.push(currentGroup);
      currentGroup = {
        authorKey: seg.authorKey,
        segments: [seg]
      };
    } else {
      currentGroup.segments.push(seg);
    }
  }

  if (currentGroup) groups.push(currentGroup);
  return groups;
}

function splitGroup(group) {
  // объединить весь текст группы в строки, отслеживая даты
  const allLines = [];
  let dateMap = []; // { lineIndex, datetime }

  for (const seg of group.segments) {
    dateMap.push({ lineIndex: allLines.length, datetime: seg.datetime });
    allLines.push(...seg.lines);
  }

  // проверить наличие ***
  const hasDividers = allLines.some(l => DIVIDER_RX.test(l.trim()));

  const blocks = [];

  if (hasDividers) {
    // режем по ***
    let buffer = [];
    let currentDatetime = dateMap[0]?.datetime || null;

    for (let i = 0; i < allLines.length; i++) {
      // обновить datetime, если этот индекс — начало нового сегмента
      const dateEntry = dateMap.find(d => d.lineIndex === i);
      if (dateEntry) currentDatetime = dateEntry.datetime;

      if (DIVIDER_RX.test(allLines[i].trim())) {
        // flush буфер как блок
        if (buffer.length) {
          blocks.push({ type: 'message', datetime: currentDatetime, lines: buffer });
          buffer = [];
        }
        blocks.push({ type: 'divider', datetime: null, lines: [] });
        continue;
      }
      buffer.push(allLines[i]);
    }
    if (buffer.length) {
      blocks.push({ type: 'message', datetime: currentDatetime, lines: buffer });
    }
  } else {
    // режем по датам — каждый сегмент = блок
    for (const seg of group.segments) {
      if (seg.lines.length) {
        blocks.push({ type: 'message', datetime: seg.datetime, lines: seg.lines });
      }
    }
  }

  return blocks;
}

// ── Cleanup ─────────────────────────────────────────────
function cleanup(text) {
  // схлопнуть 3+ переноса до 2 (одна пустая строка)
  return text.replace(/\n{3,}/g, '\n\n').trim();
}

// ── Writer ──────────────────────────────────────────────
function writeBlock(authorId, side, datetime, content, index) {
  const pad = String(index).padStart(2, '0');
  const filename = `${authorId}_${pad}.md`;
  const filepath = join(BLOCKS_DIR, filename);

  let frontmatter = '---\n';
  frontmatter += `author: ${authorId}\n`;
  frontmatter += `side: ${side}\n`;
  frontmatter += `type: message\n`;
  if (datetime) frontmatter += `datetime: ${datetime}\n`;
  frontmatter += '---\n';

  writeFileSync(filepath, frontmatter + content, 'utf-8');
  return filename;
}

function writeDivider(authorId, index) {
  const pad = String(index).padStart(2, '0');
  const filename = `${authorId}_${pad}.md`;
  const filepath = join(BLOCKS_DIR, filename);

  writeFileSync(filepath, '---\ntype: divider\n---\n', 'utf-8');
  return filename;
}

// ── Main ────────────────────────────────────────────────
function main() {
  // прочитать main.md
  if (!existsSync(MAIN_PATH)) {
    console.log('main.md not found');
    return;
  }

  let raw = readFileSync(MAIN_PATH, 'utf-8').replace(/\r\n/g, '\n').trim();
  if (!raw) {
    console.log('main.md is empty, nothing to process');
    return;
  }

  console.log(`Processing main.md (${raw.length} chars)...`);

  // загрузить данные
  const charData = loadCharacters();
  const authorMap = loadAuthors();

  // линковка персонажей
  const { text: linked, appearances } = linkCharacters(raw, charData);

  // парсинг
  const segments = parseSegments(linked);
  const groups = groupByAuthor(segments);

  // счетчики индексов по авторам
  const counters = {};

  const written = [];

  for (const group of groups) {
    const author = group.authorKey ? authorMap[group.authorKey] : null;
    const authorId = author?.id || group.authorKey || 'unknown';
    const side = author?.defaultSide || 'right';

    if (!(authorId in counters)) {
      counters[authorId] = getNextIndex(authorId);
    }

    const blocks = splitGroup(group);

    for (const block of blocks) {
      if (block.type === 'divider') {
        const fname = writeDivider(authorId, counters[authorId]++);
        written.push(fname);
        continue;
      }

      const content = cleanup(block.lines.join('\n'));
      if (!content) continue;

      const fname = writeBlock(authorId, side, block.datetime, content, counters[authorId]++);
      written.push(fname);
    }
  }

  // обновить index.json блоков
  const INDEX_PATH = join(BLOCKS_DIR, 'index.json');
  const existing = existsSync(INDEX_PATH)
    ? JSON.parse(readFileSync(INDEX_PATH, 'utf-8'))
    : [];
  writeFileSync(INDEX_PATH, JSON.stringify([...existing, ...written], null, 2), 'utf-8');

  // сохранить appearances
  writeFileSync(APPEARANCES_PATH, JSON.stringify(appearances, null, 2), 'utf-8');

  // очистить main.md
  writeFileSync(MAIN_PATH, '', 'utf-8');

  console.log(`Done. ${written.length} blocks written:`);
  for (const f of written) console.log(`  ${f}`);

  const unresolved = appearances.filter(a => a.unresolved);
  if (unresolved.length) {
    console.log(`\nUnresolved clan names (${unresolved.length}):`);
    for (const u of unresolved) console.log(`  "${u.text}"`);
  }
}

main();
