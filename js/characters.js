// ── Characters ───────────────────────────────────────────
// Загружает index.json, подгружает файлы персонажей по требованию.
// Управляет tooltip и панелью.

const BASE_URL = new URL('../', import.meta.url).href;
const CHAR_INDEX_URL = BASE_URL + 'data/characters/index.json';

const PANEL_LINK_LABEL = 'Страница персонажа';
const ALIASES_PREFIX   = 'также: ';

export class Characters {
  constructor() {
    this.index   = [];      // [{id, names, file}]
    this.cache   = {};      // id → full character data
    this.nameMap = {};      // lowercase name → id
    this._tooltipTimer  = null;
    this._activeTooltip = null;
    this._lastVisited   = null;

    this._tooltip      = document.getElementById('char-tooltip');
    this._panel        = document.getElementById('char-panel');
    this._panelName    = document.getElementById('char-panel-name');
    this._panelAliases = document.getElementById('char-panel-aliases');
    this._panelLink    = document.getElementById('char-panel-link');
    this._panelClose   = document.getElementById('char-panel-close');

    const linkLabel = document.getElementById('char-panel-link-label');
    if (linkLabel) linkLabel.textContent = PANEL_LINK_LABEL;

    this._panelClose?.addEventListener('click', () => this.closePanel());
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
    container.querySelectorAll('.char-link').forEach(el => {
      el.addEventListener('mouseenter', e => this._onHoverStart(e));
      el.addEventListener('mouseleave', () => this._onHoverEnd());
      el.addEventListener('click', e => this._onClick(e));
      el.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') this._onClick(e);
      });
    });
  }

  // ── tooltip ──────────────────────────────────────────
  _onHoverStart(e) {
    const id = e.target.dataset.charId;
    clearTimeout(this._tooltipTimer);
    this._tooltipTimer = setTimeout(() => this._showTooltip(id, e), 2000);
  }

  _onHoverEnd() {
    clearTimeout(this._tooltipTimer);
    this._tooltip?.classList.remove('show');
  }

  _showTooltip(id, e) {
    const entry = this.index.find(c => c.id === id);
    if (!entry || !this._tooltip) return;

    const [primary, ...aliases] = entry.names;
    this._tooltip.querySelector('.tooltip-name').textContent = primary;
    this._tooltip.querySelector('.tooltip-aliases').textContent =
      aliases.length ? aliases.join(' · ') : '';

    const x = Math.min(e.clientX + 12, window.innerWidth - 260);
    const y = Math.min(e.clientY + 16, window.innerHeight - 100);
    this._tooltip.style.left = x + 'px';
    this._tooltip.style.top  = y + 'px';
    this._tooltip.classList.add('show');
  }

  // ── click → panel ────────────────────────────────────
  async _onClick(e) {
    e.preventDefault();
    const id = e.currentTarget.dataset.charId;
    const char = await this._loadChar(id);
    if (!char) return;

    this._lastVisited = e.currentTarget;
    e.currentTarget.classList.add('visited');
    this._openPanel(char);
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
    setTimeout(() => el.classList.remove('highlighted'), 2200);
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
