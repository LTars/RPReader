// ── Characters ───────────────────────────────────────────
// Загружает index.json, подгружает файлы персонажей по требованию.
// Управляет панелью персонажа.

const BASE_URL = new URL('../', import.meta.url).href;
const CHAR_INDEX_URL = BASE_URL + 'data/characters/index.json';

const PANEL_LINK_LABEL = 'Страница персонажа';
const ALIASES_PREFIX   = 'также: ';
const HOVER_DELAY_MS   = 1000;
const HIGHLIGHT_MS     = 1200;

export class Characters {
  constructor() {
    this.index   = [];      // [{id, names, file}]
    this.cache   = {};      // id → full character data
    this.nameMap = {};      // lowercase name → id
    this._hoverTimer    = null;
    this._lastVisited   = null;
    this._panelCharId   = null;  // id персонажа в открытой панели
    this._pendingCharId = null;  // id персонажа в процессе загрузки

    this._panel        = document.getElementById('char-panel');
    this._panelName    = document.getElementById('char-panel-name');
    this._panelAliases = document.getElementById('char-panel-aliases');
    this._panelLink    = document.getElementById('char-panel-link');
    this._panelClose   = document.getElementById('char-panel-close');

    const linkLabel = document.getElementById('char-panel-link-label');
    if (linkLabel) linkLabel.textContent = PANEL_LINK_LABEL;

    this._panelClose?.addEventListener('click', () => this.closePanel());

    // клик на линк внутри панели — перехватываем, навигация через _navigateToChar
    this._panelLink?.addEventListener('click', e => e.preventDefault());

    // клик в любом месте панели (кроме кнопки закрытия) → переход на страницу персонажа
    this._panel?.addEventListener('click', e => {
      if (e.target.closest('#char-panel-close')) return;
      if (this._panelCharId) this._navigateToChar(this._panelCharId, this._lastVisited);
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') this.closePanel();
    });
  }

  // ── load ─────────────────────────────────────────────
  async load(indexUrl = CHAR_INDEX_URL) {
    const resp = await fetch(indexUrl);
    if (!resp.ok) throw new Error(`Characters index load failed: ${resp.status}`);
    this.index = await resp.json();

    for (const entry of this.index) {
      for (const name of entry.names) {
        this.nameMap[name.toLowerCase()] = entry.id;
      }
    }
  }

  // ── wrap character names in text ─────────────────────
  // Returns HTML string with <span class="char-link"> around known names
  wrapNames(text) {
    if (!text) return text;

    const names = Object.keys(this.nameMap).sort((a, b) => b.length - a.length);
    if (!names.length) return text;

    const escaped = names.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const rx = new RegExp(`(${escaped.join('|')})`, 'gi');

    return text.replace(rx, match => {
      const id = this.nameMap[match.toLowerCase()];
      if (!id) return match;
      return `<span class="char-link" data-char-id="${id}" tabindex="0">${match}</span>`;
    });
  }

  // ── bind events to rendered char-links ───────────────
  bindLinks(container) {
    container.querySelectorAll('.char-link').forEach((el, i) => {
      el.id = `cl-${i}`;
      el.addEventListener('mouseenter', () => this._onHoverStart(el));
      el.addEventListener('mouseleave', () => this._onHoverEnd());
      el.addEventListener('click', e => this._onClick(e));
      el.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') this._onClick(e);
      });
    });
  }

  // ── возврат к тексту с подсветкой линка ──────────────
  checkReturnHighlight() {
    const linkId = sessionStorage.getItem('returnLinkId');
    if (!linkId) return;
    sessionStorage.removeItem('returnLinkId');
    const el = document.getElementById(linkId);
    if (el) this._highlightElement(el);
  }

  _charId(el) {
    return el.dataset.charId
      || new URLSearchParams(new URL(el.href || '', location.href).search).get('id')
      || null;
  }

  // ── hover → панель через 1 секунду ───────────────────
  _onHoverStart(el) {
    const id = this._charId(el);
    clearTimeout(this._hoverTimer);
    this._hoverTimer = setTimeout(async () => {
      if (this._panelCharId === id) return; // панель уже открыта для этого персонажа
      const char = await this._loadChar(id);
      if (!char) return;
      this._lastVisited = el;
      el.classList.add('visited');
      this._panelCharId = id;
      this._pendingCharId = null;
      this._openPanel(char);
    }, HOVER_DELAY_MS);
  }

  _onHoverEnd() {
    clearTimeout(this._hoverTimer);
    // панель остаётся открытой, если уже показана
  }

  // ── клик: первый → открыть панель, второй → перейти ──
  async _onClick(e) {
    e.preventDefault();
    const el = e.currentTarget;
    const id = this._charId(el);

    const panelActiveForThis =
      (this._panel?.classList.contains('open') && this._panelCharId === id)
      || this._pendingCharId === id;

    if (panelActiveForThis) {
      this._navigateToChar(id, el);
      return;
    }

    clearTimeout(this._hoverTimer);
    this._pendingCharId = id;

    const char = await this._loadChar(id);
    if (!char) { this._pendingCharId = null; return; }

    this._lastVisited = el;
    el.classList.add('visited');
    this._panelCharId = id;
    this._pendingCharId = null;
    this._openPanel(char);
  }

  _navigateToChar(id, el) {
    if (el?.id) sessionStorage.setItem('returnLinkId', el.id);
    window.location.href = BASE_URL + `character.html?id=${id}`;
  }

  _openPanel(char) {
    if (!this._panel) return;
    const [primary, ...aliases] = char.names;

    this._panelName.textContent = primary;
    this._panelAliases.textContent = aliases.length
      ? ALIASES_PREFIX + aliases.join(', ')
      : '';
    this._panelLink.href = BASE_URL + `character.html?id=${char.id}`;

    this._panel.classList.add('open');
  }

  closePanel() {
    this._panel?.classList.remove('open');
    this._panelCharId = null;
    if (this._lastVisited) {
      this._highlightElement(this._lastVisited);
      this._lastVisited = null;
    }
  }

  _highlightElement(el) {
    el.classList.remove('highlighted');
    void el.offsetWidth;
    el.classList.add('highlighted');
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => el.classList.remove('highlighted'), HIGHLIGHT_MS);
  }

  // ── load character data on demand ────────────────────
  async _loadChar(id) {
    if (this.cache[id]) return this.cache[id];
    const entry = this.index.find(c => c.id === id);
    if (!entry) return null;
    try {
      const resp = await fetch(BASE_URL + entry.file);
      if (!resp.ok) return null;
      const data = await resp.json();
      this.cache[id] = data;
      return data;
    } catch (err) {
      console.error('Character load failed:', err);
      return null;
    }
  }
}
