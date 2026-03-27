import { loadParser } from './parser.js';
import { Characters }  from './characters.js';
import { Search }      from './search.js';

const BASE_URL = new URL('../', import.meta.url).href;
const CONTENT_URL = BASE_URL + 'content/main.md';
const PARSER_RULES_URL = BASE_URL + 'data/parser-rules.json';

// ── Reader ───────────────────────────────────────────────
class Reader {
  constructor() {
    this.parser     = null;
    this.characters = new Characters();
    this.search     = null;
    this.blocks     = [];
  }

  async init() {
    await Promise.all([
      this._loadParser(),
      this.characters.load()
    ]);

    await this._loadContent();
    this._render();
    this._bindUI();
    this._updateProgress();
  }

  // ── load & parse ─────────────────────────────────────
  async _loadParser() {
    this.parser = await loadParser(PARSER_RULES_URL);
  }

  async _loadContent() {
    const resp = await fetch(CONTENT_URL);
    if (!resp.ok) throw new Error('Content load failed');
    const raw = await resp.text();
    this.blocks = this.parser.parse(raw);
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

    // bind character link events after render
    this.characters.bindLinks(chat);

    // init search with blocks
    this.search = new Search(this.blocks);
  }

  _makeHeader(block) {
    const div = document.createElement('div');
    div.className = `author-header ${block.side}`;

    const authorName = block.authorId
      ? (this.parser.authors.find(a => a.id === block.authorId)?.names[0] || block.authorId)
      : '—';

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

    // process content: wrap character names, handle dialogue lines
    const lines = block.content.split('\n');
    const processedLines = lines.map(line => {
      const trimmed = line.trim();
      if (!trimmed) return '';

      // dialogue line
      if (/^[-–—]/.test(trimmed)) {
        const wrapped = this.characters.wrapNames(trimmed);
        return `<p class="dialogue">${wrapped}</p>`;
      }

      const wrapped = this.characters.wrapNames(trimmed);
      return `<p>${wrapped}</p>`;
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
    // panel toggle
    const panelToggle = document.getElementById('panel-toggle');
    const panel = document.querySelector('.panel');
    panelToggle?.addEventListener('click', () => {
      panel?.classList.toggle('expanded');
    });

    // search button
    document.getElementById('search-btn')?.addEventListener('click', () => {
      this.search?.open();
    });

    // blue light toggle
    document.getElementById('blue-filter-btn')?.addEventListener('click', () => {
      const current = document.documentElement.dataset.blueFilter;
      document.documentElement.dataset.blueFilter = current === 'on' ? 'off' : 'on';
    });

    // scroll → progress
    window.addEventListener('scroll', () => this._updateProgress(), { passive: true });

    // battery
    this._initBattery();
  }

  _updateProgress() {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const pct = docHeight > 0 ? Math.round((scrollTop / docHeight) * 100) : 0;

    const fill = document.getElementById('progress-fill');
    if (fill) fill.style.width = pct + '%';

    const progressText = document.getElementById('progress-text');
    if (progressText) progressText.textContent = `${pct}%`;
  }

  async _initBattery() {
    const el = document.getElementById('battery-text');
    if (!el || !navigator.getBattery) return;
    try {
      const bat = await navigator.getBattery();
      const update = () => {
        const pct = Math.round(bat.level * 100);
        el.textContent = `${pct}%`;
      };
      update();
      bat.addEventListener('levelchange', update);
    } catch { /* not available */ }
  }
}

// ── boot ─────────────────────────────────────────────────
const reader = new Reader();
reader.init().catch(console.error);
