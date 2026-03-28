import { Characters }  from './characters.js';
import { Search }      from './search.js';

const BASE_URL        = new URL('../', import.meta.url).href;
const BLOCKS_URL      = BASE_URL + 'content/blocks/';
const PARSER_RULES_URL = BASE_URL + 'data/parser-rules.json';

function parseBlock(text, filename) {
  const fmMatch = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!fmMatch) return null;

  const fm = {};
  for (const line of fmMatch[1].split('\n')) {
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    fm[line.slice(0, colon).trim()] = line.slice(colon + 1).trim();
  }

  const stem = filename.replace(/\.md$/, '');
  return {
    anchor:   stem,
    type:     fm.type     || 'message',
    authorId: fm.author   || null,
    side:     fm.side     || 'right',
    datetime: fm.datetime || null,
    content:  fmMatch[2].trim(),
  };
}

const UI = {
  MENU_TITLE:         'Меню',
  HOME_TITLE:         'Главная',
  CHARACTERS_TITLE:   'Персонажи',
  SEARCH_TITLE:       'Поиск (⌘K)',
  BLUE_FILTER_TITLE:  'Фильтр синего света',
  SEARCH_PLACEHOLDER: 'Поиск по тексту...',
  UNKNOWN_AUTHOR:     '—',
};

// ── Reader ───────────────────────────────────────────────
class Reader {
  constructor() {
    this.authors    = [];
    this.characters = new Characters();
    this.search     = null;
    this.blocks     = [];

    this._progressFill = document.getElementById('progress-fill');
    this._progressText = document.getElementById('progress-text');
  }

  async init() {
    await Promise.all([
      this.characters.load(),
      this._loadAuthors(),
    ]);
    await this._loadContent();
    this._render();
    this._bindUI();
    this._updateProgress();
  }

  // ── load ─────────────────────────────────────────────
  async _loadAuthors() {
    const resp = await fetch(PARSER_RULES_URL);
    if (!resp.ok) throw new Error('Parser rules load failed');
    const rules = await resp.json();
    this.authors = rules.authors || [];
  }

  async _loadContent() {
    const indexResp = await fetch(BLOCKS_URL + 'index.json');
    if (!indexResp.ok) throw new Error('Blocks index load failed');
    const filenames = await indexResp.json();

    const blocks = new Array(filenames.length);
    await Promise.all(filenames.map(async (filename, i) => {
      const resp = await fetch(BLOCKS_URL + filename);
      if (!resp.ok) throw new Error(`Block load failed: ${filename}`);
      blocks[i] = parseBlock(await resp.text(), filename);
    }));

    this.blocks = blocks.filter(Boolean);
  }

  // ── render ───────────────────────────────────────────
  _render() {
    const chat = document.getElementById('chat');
    if (!chat) return;

    let lastAuthorId = null;
    let lastSide     = null;

    for (const block of this.blocks) {
      if (block.type === 'divider') {
        chat.appendChild(this._makeDivider(block));
        lastAuthorId = null;
        continue;
      }
      if (block.type !== 'message') continue;

      const showHeader = block.authorId !== lastAuthorId || block.side !== lastSide;

      if (showHeader) {
        chat.appendChild(this._makeHeader(block));
      }

      chat.appendChild(this._makeMessage(block, showHeader));

      lastAuthorId = block.authorId;
      lastSide     = block.side;
    }

    this.characters.bindLinks(chat);
    this.characters.checkReturnHighlight();
    this.search = new Search(this.blocks);
  }

  _makeHeader(block) {
    const div = document.createElement('div');
    div.className = `author-header ${block.side}`;

    const authorName = block.authorId
      ? (this.authors.find(a => a.id === block.authorId)?.names[0] || block.authorId)
      : UI.UNKNOWN_AUTHOR;

    div.innerHTML = `
      <span class="author-name">${authorName}</span>
      ${block.datetime ? `<span class="author-date">${block.datetime}</span>` : ''}
    `;
    return div;
  }

  _makeMessage(block, _showHeader) {
    const row = document.createElement('div');
    row.className = `message-row ${block.side}`;
    row.id = block.anchor;

    const avatar = document.createElement('div');
    avatar.className = 'avatar placeholder';
    avatar.textContent = (block.authorId || '?')[0].toUpperCase();

    const bubble = document.createElement('div');
    bubble.className = 'bubble';

    const lines = block.content.split('\n');
    const processedLines = lines.map(line => {
      const trimmed = line.trim();
      if (!trimmed) return '';
      const cls = /^[-–—]/.test(trimmed) ? ' class="dialogue"' : '';
      return `<p${cls}>${trimmed}</p>`;
    });

    bubble.innerHTML = processedLines.filter(Boolean).join('');
    row.appendChild(avatar);
    row.appendChild(bubble);
    return row;
  }

  _makeDivider(block) {
    const div = document.createElement('div');
    div.className = 'scene-divider';
    div.id = block.anchor;
    div.innerHTML = '<span>✦</span>';
    return div;
  }

  // ── UI bindings ──────────────────────────────────────
  _bindUI() {
    const panelToggle   = document.getElementById('panel-toggle');
    const panel         = document.querySelector('.panel');
    const homeBtn       = document.getElementById('home-btn');
    const charsBtn      = document.getElementById('characters-btn');
    const searchBtn     = document.getElementById('search-btn');
    const blueFilterBtn = document.getElementById('blue-filter-btn');
    const searchInput   = document.getElementById('search-input');

    if (panelToggle)   panelToggle.title   = UI.MENU_TITLE;
    if (homeBtn)       homeBtn.title       = UI.HOME_TITLE;
    if (charsBtn)      charsBtn.title      = UI.CHARACTERS_TITLE;
    if (searchBtn)     searchBtn.title     = UI.SEARCH_TITLE;
    if (blueFilterBtn) blueFilterBtn.title = UI.BLUE_FILTER_TITLE;
    if (searchInput)   searchInput.placeholder = UI.SEARCH_PLACEHOLDER;

    panelToggle?.addEventListener('click', () => {
      panel?.classList.toggle('expanded');
    });

    searchBtn?.addEventListener('click', () => {
      this.search?.open();
    });

    blueFilterBtn?.addEventListener('click', () => {
      const current = document.documentElement.dataset.blueFilter;
      document.documentElement.dataset.blueFilter = current === 'on' ? 'off' : 'on';
    });

    window.addEventListener('scroll', () => this._updateProgress(), { passive: true });

    this._initBattery();
  }

  _updateProgress() {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const pct = docHeight > 0 ? Math.round((scrollTop / docHeight) * 100) : 0;

    if (this._progressFill) this._progressFill.style.width = pct + '%';
    if (this._progressText) this._progressText.textContent = `${pct}%`;
  }

  async _initBattery() {
    const el = document.getElementById('battery-text');
    if (!el || !navigator.getBattery) return;
    try {
      const bat = await navigator.getBattery();
      const update = () => {
        el.textContent = `${Math.round(bat.level * 100)}%`;
      };
      update();
      bat.addEventListener('levelchange', update);
    } catch {
      // Battery API not available — element stays empty
    }
  }
}

// ── boot ─────────────────────────────────────────────────
const reader = new Reader();
reader.init().catch(console.error);
