// ── Parser — правила подгружаются из parser-rules.json ───
// Интерфейс: new Parser(rules) → parser.parse(rawText) → Block[]
//
// Block: { type, authorId, side, datetime, content, anchor }
// type: 'message' | 'divider' | 'empty'

export class Parser {
  constructor(rules) {
    this.rules    = rules;
    this.authors  = rules.authors  || [];
    this.patterns = rules.patterns || [];
    this.transforms = rules.transforms || [];
    this.cleanup  = rules.cleanup  || {};

    // compile regexes once
    this._compiled = this.patterns.map(p => ({
      ...p,
      _rx: new RegExp(p.regex, 'm')
    }));

    // build author lookup: name → author object
    this._authorMap = {};
    for (const a of this.authors) {
      for (const name of a.names) {
        this._authorMap[name.toLowerCase()] = a;
      }
    }
  }

  // ── main entry ──────────────────────────────────────────
  parse(rawText) {
    let text = this._applyTransforms(rawText);
    if (this.cleanup.collapseMultipleNewlines) {
      const max = this.cleanup.maxConsecutiveNewlines || 2;
      text = text.replace(new RegExp(`\n{${max + 1},}`, 'g'), '\n'.repeat(max));
    }

    const lines = text.split('\n');
    const blocks = [];
    let currentAuthor = null;
    let currentSide   = 'right'; // первый пост всегда справа
    let messageBuffer = [];
    let firstPost     = true;
    let lastAuthorDatetime = null;

    const flush = () => {
      if (!messageBuffer.length) return;
      const content = messageBuffer.join('\n').trim();
      if (!content) { messageBuffer = []; return; }
      blocks.push({
        type:     'message',
        authorId: currentAuthor?.id || null,
        side:     currentSide,
        datetime: lastAuthorDatetime,
        content,
        anchor:   `msg-${blocks.length}`
      });
      messageBuffer = [];
    };

    for (const line of lines) {
      const trimmed = line.trim();

      // author block pattern
      const authorMatch = this._matchAuthorBlock(trimmed);
      if (authorMatch) {
        flush();

        const author = this._resolveAuthor(authorMatch.author);
        const isNew  = author?.id !== currentAuthor?.id;

        if (firstPost) {
          currentSide = 'right';
          firstPost = false;
        } else if (isNew) {
          // alternate sides by default if no explicit side
          currentSide = currentSide === 'right' ? 'left' : 'right';
        }

        // if author has explicit side preference, use it
        if (author?.defaultSide) currentSide = author.defaultSide;

        currentAuthor      = author || { id: authorMatch.author, names: [authorMatch.author] };
        lastAuthorDatetime = authorMatch.datetime || null;

        // strip date-only lines that follow author blocks
        continue;
      }

      // star divider
      if (this._matchPattern('star_divider', trimmed)) {
        flush();
        blocks.push({ type: 'divider', anchor: `div-${blocks.length}` });
        continue;
      }

      // skip standalone date/time lines if cleanup says so
      if (this.cleanup.stripDateLines && this._isDateLine(trimmed)) continue;

      messageBuffer.push(line);
    }

    flush();
    return blocks;
  }

  // ── private ─────────────────────────────────────────────
  _applyTransforms(text) {
    for (const t of this.transforms) {
      text = text.replace(new RegExp(t.find, t.flags || 'g'), t.replace);
    }
    return text;
  }

  _matchAuthorBlock(line) {
    const p = this._compiled.find(c => c.name === 'author_block');
    if (!p) return null;
    const m = line.match(p._rx);
    if (!m) return null;
    const groups = p.groups || { author: 1, datetime: 2 };
    return {
      author:   m[groups.author]?.trim() || null,
      datetime: m[groups.datetime]?.trim() || null
    };
  }

  _matchPattern(name, line) {
    const p = this._compiled.find(c => c.name === name);
    return p ? p._rx.test(line) : false;
  }

  _resolveAuthor(nameStr) {
    if (!nameStr) return null;
    // try exact match first
    const key = nameStr.trim().toLowerCase();
    if (this._authorMap[key]) return this._authorMap[key];
    // try partial match
    for (const [k, v] of Object.entries(this._authorMap)) {
      if (key.includes(k) || k.includes(key)) return v;
    }
    return null;
  }

  _isDateLine(line) {
    // matches standalone date/time lines like "3/17/2026 2:52 AM"
    return /^\d{1,2}\/\d{1,2}\/\d{4}(\s+\d{1,2}:\d{2}(:\d{2})?(\s+[AP]M)?)?$/.test(line);
  }
}

// ── static loader ────────────────────────────────────────
export async function loadParser(rulesUrl = './data/parser-rules.json') {
  const resp = await fetch(rulesUrl);
  if (!resp.ok) throw new Error(`Failed to load parser rules: ${resp.status}`);
  const rules = await resp.json();
  return new Parser(rules);
}
