import { Characters }  from './char-manager.js';
import { Search }      from './search.js';

const BASE_URL         = new URL('../', import.meta.url).href;
const BLOCKS_URL       = BASE_URL + 'content/blocks/';
const PARSER_RULES_URL = BASE_URL + 'data/parser-rules.json';

const LOD_BATCH_SIZE      = 5;
const LOD_SCREENS_AHEAD   = 3;
const VIRT_UNLOAD_SCREENS = 3; // unload virt-pages beyond this many screens from viewport

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

    this._filenames   = [];
    this._loadedCount = 0;
    this._lodObserver = null;
    this._lodSentinel = null;

    this._lastRenderedAuthorId = null;
    this._lastRenderedSide     = null;
    this._pendingDivider        = null;
    this._pendingDividerAuthorId = null;
    this._lastBubbleEl          = null;
    this._currentGroupEl        = null;
    this._currentBubblesEl      = null;

    // virtual scrolling — activated after all LOD batches are loaded
    this._virtPages    = [];
    this._virtObserver = null;

    this._progressFill = document.getElementById('progress-fill');
    this._progressText = document.getElementById('progress-text');
  }

  async init() {
    await Promise.all([
      this.characters.load(),
      this._loadAuthors(),
    ]);
    await this._loadContent();
    this._initVirtObserver();
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

    const page = this._createVirtPage(0, this.blocks.length);
    const fragment = document.createDocumentFragment();
    this._renderBlocks(this._mergeBlocks(this.blocks), fragment);
    this.characters.bindLinks(fragment);
    this.characters.bindBubbles(fragment);
    page.el.appendChild(fragment);
    chat.appendChild(page.el);

    this.characters.checkReturnHighlight();
    this.search = new Search(this.blocks);
    this._virtObserver.observe(page.el);

    if (this._loadedCount < this._filenames.length) {
      this._setupLOD(chat);
    } else {
      if (this._pendingDivider) {
        page.el.appendChild(this._makeDivider(this._pendingDivider));
        this._pendingDivider        = null;
        this._pendingDividerAuthorId = null;
      }
    }
  }

  // ── virtual page management ──────────────────────────

  // Creates a virt-page wrapper for a range of this.blocks[startIdx..endIdx].
  _createVirtPage(startIdx, endIdx) {
    const page = { id: this._virtPages.length, startIdx, endIdx, el: null, loaded: true };
    page.el = document.createElement('div');
    page.el.className = 'virt-page';
    page.el.dataset.pageId = page.id;
    this._virtPages.push(page);
    return page;
  }

  // Creates the persistent virt-scroll observer. Each page is observed
  // immediately after it's appended to the DOM, not after all LOD is done.
  _initVirtObserver() {
    const margin = Math.round(window.innerHeight * VIRT_UNLOAD_SCREENS);
    this._virtObserver = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          const pageId = parseInt(entry.target.dataset.pageId, 10);
          const page = this._virtPages[pageId];
          if (!page) continue;
          if (entry.isIntersecting) {
            if (!page.loaded) this._reloadVirtPage(page);
          } else {
            if (page.loaded) this._unloadVirtPage(page);
          }
        }
      },
      { rootMargin: `${margin}px` }
    );
  }

  _unloadVirtPage(page) {
    // preserve layout footprint so scroll position doesn't jump
    page.el.style.height = page.el.offsetHeight + 'px';
    page.el.innerHTML = '';
    page.loaded = false;
  }

  _reloadVirtPage(page) {
    const blocks = this.blocks.slice(page.startIdx, page.endIdx);
    const merged = this._mergeBlocksIsolated(blocks);
    const fragment = document.createDocumentFragment();

    // isolate rendering state so sequential LOD context is unaffected
    const saved = [
      this._lastRenderedAuthorId, this._lastRenderedSide,
      this._lastBubbleEl, this._currentGroupEl, this._currentBubblesEl
    ];
    this._lastRenderedAuthorId = null;
    this._lastRenderedSide     = null;
    this._lastBubbleEl         = null;
    this._currentGroupEl       = null;
    this._currentBubblesEl     = null;

    this._renderBlocks(merged, fragment);

    [
      this._lastRenderedAuthorId, this._lastRenderedSide,
      this._lastBubbleEl, this._currentGroupEl, this._currentBubblesEl
    ] = saved;

    this.characters.bindLinks(fragment);
    this.characters.bindBubbles(fragment);
    page.el.style.height = '';
    page.el.appendChild(fragment);
    page.loaded = true;
  }

  // Pure merge for isolated re-renders — does not touch _pendingDivider state.
  _mergeBlocksIsolated(blocks) {
    const result = [];
    let i = 0;
    while (i < blocks.length) {
      const block = blocks[i];
      if (block.type !== 'message') {
        result.push(block);
        i++;
        continue;
      }
      const parts = [block.content];
      let j = i + 1;
      while (true) {
        if (
          j < blocks.length &&
          blocks[j].type === 'message' &&
          blocks[j].authorId === block.authorId &&
          blocks[j].side === block.side
        ) {
          parts.push(blocks[j].content);
          j++;
          continue;
        }
        if (
          j < blocks.length - 1 &&
          blocks[j].type === 'divider' &&
          blocks[j + 1].type === 'message' &&
          blocks[j + 1].authorId === block.authorId
        ) {
          parts.push('***');
          parts.push(blocks[j + 1].content);
          j += 2;
          continue;
        }
        break;
      }
      result.push(parts.length > 1 ? { ...block, content: parts.join('\n') } : block);
      i = j;
    }
    return result;
  }

  // ── LOD ──────────────────────────────────────────────
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

    // Strip leading divider if it should extend the previous bubble
    let leadingDivider = null;
    if (
      !prevPending &&
      newBlocks.length > 1 &&
      newBlocks[0].type === 'divider' &&
      newBlocks[1].type === 'message' &&
      newBlocks[1].authorId === this._lastRenderedAuthorId &&
      this._lastBubbleEl
    ) {
      leadingDivider = newBlocks.shift();
    }

    const merged = this._mergeBlocks(newBlocks);

    const page = this._createVirtPage(prevCount, this.blocks.length);
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
        this._currentGroupEl       = null;
        this._currentBubblesEl     = null;
      }
    } else if (leadingDivider) {
      if (merged.length > 0 && merged[0].type === 'message') {
        this._extendLastBubble(merged[0].content);
        merged.shift();
      } else {
        fragment.appendChild(this._makeDivider(leadingDivider));
        this._lastRenderedAuthorId = null;
        this._lastRenderedSide     = null;
        this._lastBubbleEl         = null;
        this._currentGroupEl       = null;
        this._currentBubblesEl     = null;
      }
    }

    this._renderBlocks(merged, fragment);
    this.characters.bindLinks(fragment);
    this.characters.bindBubbles(fragment);
    page.el.appendChild(fragment);
    chat.appendChild(page.el);
    this._virtObserver.observe(page.el);

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
      const lastPage = this._virtPages[this._virtPages.length - 1];
      if (lastPage) lastPage.el.appendChild(this._makeDivider(this._pendingDivider));
      this._pendingDivider        = null;
      this._pendingDividerAuthorId = null;
      this._lastBubbleEl           = null;
    }
    this._lodObserver?.disconnect();
    this._lodSentinel?.remove();
    this._lodObserver = null;
    this._lodSentinel = null;
  }

  _renderBlocks(blocks, container) {
    for (const block of blocks) {
      if (block.type === 'divider') {
        container.appendChild(this._makeDivider(block));
        this._lastRenderedAuthorId = null;
        this._lastRenderedSide     = null;
        this._lastBubbleEl         = null;
        this._currentGroupEl       = null;
        this._currentBubblesEl     = null;
        continue;
      }
      if (block.type !== 'message') continue;

      const newGroup = block.authorId !== this._lastRenderedAuthorId
        || block.side !== this._lastRenderedSide;

      if (newGroup) {
        container.appendChild(this._makeHeader(block));
        const { group, bubbles } = this._makeGroup(block);
        container.appendChild(group);
        this._currentGroupEl   = group;
        this._currentBubblesEl = bubbles;
      }

      const msgEl = this._makeMessage(block);
      this._lastBubbleEl = msgEl.querySelector('.bubble');
      this._currentBubblesEl.appendChild(msgEl);

      this._lastRenderedAuthorId = block.authorId;
      this._lastRenderedSide     = block.side;
    }
  }

  // merge same-author consecutive messages (size-splits) and [msg_A, divider, msg_A, ...] chains;
  // trailing dividers deferred as _pendingDivider
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

      while (true) {
        // consecutive same-author message (size-split): merge without divider marker
        if (
          j < blocks.length &&
          blocks[j].type === 'message' &&
          blocks[j].authorId === block.authorId &&
          blocks[j].side === block.side
        ) {
          parts.push(blocks[j].content);
          j++;
          continue;
        }
        // msg-divider-msg chain: stop one before end to allow trailing-divider pending logic
        if (
          j < blocks.length - 1 &&
          blocks[j].type === 'divider' &&
          blocks[j + 1].type === 'message' &&
          blocks[j + 1].authorId === block.authorId
        ) {
          parts.push('***');
          parts.push(blocks[j + 1].content);
          j += 2;
          continue;
        }
        break;
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

  _makeGroup(block) {
    const group = document.createElement('div');
    group.className = `message-group ${block.side}`;

    const avatar = document.createElement('div');
    avatar.className = 'avatar placeholder';
    avatar.textContent = (block.authorId || '?')[0].toUpperCase();

    const bubbles = document.createElement('div');
    bubbles.className = 'bubbles';

    group.appendChild(avatar);
    group.appendChild(bubbles);
    return { group, bubbles };
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

  _makeMessage(block) {
    const row = document.createElement('div');
    row.className = `message-row ${block.side}`;
    row.id = block.anchor;
    row.dataset.authorId = block.authorId;

    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.innerHTML = this._renderContentLines(block.content);

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
  //
  // Dialogue line: starts with optional whitespace + dash (with or without space after).
  // State machine: SPEECH → [,.!?]\s*- → AUTHOR → [,.!?]\s*- → SPEECH → ...
  // Odd-indexed parts (0, 2, 4...) = speech, even (1, 3...) = attribution — plain text.
  _markDialogue(text) {
    if (!/^\s*-/.test(text)) return text;

    const parts = [];
    let pos = 0;
    const rx = /[,.!?]\s*(?=-)/g;
    let m;

    while ((m = rx.exec(text)) !== null) {
      parts.push(text.slice(pos, m.index + m[0].length));
      pos = m.index + m[0].length;
    }
    parts.push(text.slice(pos));

    return parts.map((part, i) =>
      i % 2 === 0 ? `<span class="dialogue">${part}</span>` : part
    ).join('');
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

  // Content-based progress: extrapolate total height from loaded blocks.
  _updateProgress() {
    const scrollTop    = window.scrollY;
    const loadedHeight = document.documentElement.scrollHeight - window.innerHeight;
    const totalBlocks  = this._filenames.length;
    const loadedBlocks = this._loadedCount;

    const estimatedTotalHeight = loadedBlocks > 0 && loadedBlocks < totalBlocks
      ? (loadedHeight / loadedBlocks) * totalBlocks
      : loadedHeight;

    const pct = estimatedTotalHeight > 0
      ? Math.min(Math.round((scrollTop / estimatedTotalHeight) * 100), 100)
      : 0;

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
