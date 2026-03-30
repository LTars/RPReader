import { Characters }  from './characters.js';
import { Search }      from './search.js';

const BASE_URL         = new URL('../', import.meta.url).href;
const BLOCKS_URL       = BASE_URL + 'content/blocks/';
const PARSER_RULES_URL = BASE_URL + 'data/parser-rules.json';

const LOD_BATCH_SIZE   = 5;
const LOD_SCREENS_AHEAD = 3;

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

    this._filenames  = [];
    this._loadedCount = 0;
    this._lodObserver = null;
    this._lodSentinel = null;
    this._lastRenderedAuthorId = null;
    this._lastRenderedSide     = null;

    this._pendingDivider        = null;
    this._pendingDividerAuthorId = null;
    this._lastBubbleEl          = null;

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
    this._filenames = await indexResp.json();
    await this._fetchBatch(0, LOD_BATCH_SIZE);
  }

  async _fetchBatch(from, count) {
    const slice = this._filenames.slice(from, from + count);
    if (!slice.length) return;

    const loaded = new Array(slice.length);
    await Promise.all(slice.map(async (filename, i) => {
      const resp = await fetch(BLOCKS_URL + filename);
      if (!resp.ok) throw new Error(`Block load failed: ${filename}`);
      loaded[i] = parseBlock(await resp.text(), filename);
    }));

    this.blocks.push(...loaded.filter(Boolean));
    this._loadedCount = from + slice.length;
  }

  // ── render ───────────────────────────────────────────
  _render() {
    const chat = document.getElementById('chat');
    if (!chat) return;

    const fragment = document.createDocumentFragment();
    this._renderBlocks(this._mergeBlocks(this.blocks), fragment);
    this.characters.bindLinks(fragment);
    this.characters.bindBubbles(fragment);
    chat.appendChild(fragment);

    this.characters.checkReturnHighlight();
    this.search = new Search(this.blocks);

    if (this._loadedCount < this._filenames.length) {
      this._setupLOD(chat);
    } else if (this._pendingDivider) {
      chat.appendChild(this._makeDivider(this._pendingDivider));
      this._pendingDivider = null;
      this._pendingDividerAuthorId = null;
    }
  }

  _renderBlocks(blocks, container) {
    for (const block of blocks) {
      if (block.type === 'divider') {
        container.appendChild(this._makeDivider(block));
        this._lastRenderedAuthorId = null;
        this._lastRenderedSide     = null;
        this._lastBubbleEl         = null;
        continue;
      }
      if (block.type !== 'message') continue;

      const showHeader = block.authorId !== this._lastRenderedAuthorId
        || block.side !== this._lastRenderedSide;

      if (showHeader) {
        container.appendChild(this._makeHeader(block));
      }

      container.appendChild(this._makeMessage(block, showHeader));

      this._lastRenderedAuthorId = block.authorId;
      this._lastRenderedSide     = block.side;
    }
  }

  // merge [msg_A, divider, msg_A, ...] chains into single blocks with *** separator
  // trailing dividers are deferred as _pendingDivider for cross-batch handling
  _mergeBlocks(blocks) {
    const result = [];
    let i = 0;
    let lastMsgAuthorId = null;

    while (i < blocks.length) {
      const block = blocks[i];

      if (block.type !== 'message') {
        result.push(block);
        i++;
        continue;
      }

      const parts = [block.content];
      let j = i + 1;

      while (
        j < blocks.length - 1 &&
        blocks[j].type === 'divider' &&
        blocks[j + 1].type === 'message' &&
        blocks[j + 1].authorId === block.authorId
      ) {
        parts.push('***');
        parts.push(blocks[j + 1].content);
        j += 2;
      }

      const merged = parts.length > 1
        ? { ...block, content: parts.join('\n') }
        : block;
      result.push(merged);
      lastMsgAuthorId = block.authorId;
      i = j;
    }

    // Defer trailing divider — it may be a cross-batch bubble-divider
    if (result.length > 0 && result[result.length - 1].type === 'divider') {
      this._pendingDivider        = result.pop();
      this._pendingDividerAuthorId = lastMsgAuthorId;
    }

    return result;
  }

  _setupLOD(chat) {
    this._lodSentinel = document.createElement('div');
    this._lodSentinel.className = 'lod-sentinel';
    chat.appendChild(this._lodSentinel);

    const margin = Math.round(window.innerHeight * LOD_SCREENS_AHEAD);
    this._lodObserver = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting) this._loadNextBatch(); },
      { rootMargin: `${margin}px` }
    );
    this._lodObserver.observe(this._lodSentinel);
  }

  async _loadNextBatch() {
    if (this._loadedCount >= this._filenames.length) {
      this._teardownLOD();
      return;
    }

    this._lodObserver.disconnect();

    const prevCount = this.blocks.length;
    await this._fetchBatch(this._loadedCount, LOD_BATCH_SIZE);
    const newBlocks = this.blocks.slice(prevCount);

    const chat = document.getElementById('chat');
    this._lodSentinel.remove();

    const prevPending        = this._pendingDivider;
    const prevPendingAuthorId = this._pendingDividerAuthorId;
    this._pendingDivider        = null;
    this._pendingDividerAuthorId = null;

    const merged = this._mergeBlocks(newBlocks);

    const fragment = document.createDocumentFragment();

    if (prevPending) {
      if (
        merged.length > 0 &&
        merged[0].type === 'message' &&
        merged[0].authorId === prevPendingAuthorId
      ) {
        this._extendLastBubble(merged[0].content);
        merged.shift();
      } else {
        fragment.appendChild(this._makeDivider(prevPending));
        this._lastRenderedAuthorId = null;
        this._lastRenderedSide     = null;
        this._lastBubbleEl         = null;
      }
    }

    this._renderBlocks(merged, fragment);
    this.characters.bindLinks(fragment);
    this.characters.bindBubbles(fragment);
    chat.appendChild(fragment);

    this.search = new Search(this.blocks);

    if (this._loadedCount < this._filenames.length) {
      chat.appendChild(this._lodSentinel);
      this._lodObserver.observe(this._lodSentinel);
    } else {
      this._teardownLOD();
    }
  }

  _teardownLOD() {
    if (this._pendingDivider) {
      const chat = document.getElementById('chat');
      if (chat) chat.appendChild(this._makeDivider(this._pendingDivider));
      this._pendingDivider        = null;
      this._pendingDividerAuthorId = null;
      this._lastBubbleEl           = null;
    }
    this._lodObserver?.disconnect();
    this._lodSentinel?.remove();
    this._lodObserver = null;
    this._lodSentinel = null;
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
    row.dataset.authorId = block.authorId;

    const avatar = document.createElement('div');
    avatar.className = 'avatar placeholder';
    avatar.textContent = (block.authorId || '?')[0].toUpperCase();

    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.innerHTML = this._renderContentLines(block.content);

    this._lastBubbleEl = bubble;

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

  _renderContentLines(content) {
    return content.split('\n')
      .map(line => {
        const trimmed = line.trim();
        if (!trimmed) return '';
        if (trimmed === '***') return '<div class="bubble-divider"><span>✦</span></div>';
        return `<p>${this._markDialogue(trimmed)}</p>`;
      })
      .filter(Boolean)
      .join('');
  }

  // Wrap speech segments in <span class="dialogue">.
  // Detects: line-starting dashes and inline dashes after punctuation.
  _markDialogue(text) {
    return text.replace(
      /([-\u2013\u2014]\s+)((?:(?![,.!?]\s*[-\u2013\u2014]).)*)/g,
      '<span class="dialogue">$1$2</span>'
    );
  }

  // Extend an already-rendered bubble with a bubble-divider and new content.
  _extendLastBubble(content) {
    if (!this._lastBubbleEl) return;
    this._lastBubbleEl.insertAdjacentHTML(
      'beforeend',
      '<div class="bubble-divider"><span>✦</span></div>' + this._renderContentLines(content)
    );
    this.characters.bindLinks(this._lastBubbleEl);
    this.characters.bindBubbles(this._lastBubbleEl);
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
