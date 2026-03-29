// ── Characters ───────────────────────────────────────────
// Загружает index.json, подгружает файлы персонажей по требованию.
// Управляет панелью персонажа.

const BASE_URL = new URL('../', import.meta.url).href;
const CHAR_INDEX_URL = BASE_URL + 'data/characters/index.json';

const PANEL_LINK_LABEL = 'Страница персонажа';
const ALIASES_PREFIX   = 'также: ';
const HOVER_DELAY_MS   = 1000;
const HOVER_HIDE_MS    = 500;
const HIGHLIGHT_MS     = 1200;

export class Characters {
  constructor() {
    this.index   = [];      // [{id, names, file}]
    this.cache   = {};      // id → full character data
    this.nameMap = {};      // lowercase name → id
    this._hoverTimer    = null;
    this._hideTimer     = null;
    this._lastVisited   = null;
    this._panelCharId   = null;  // id персонажа в открытой панели
    this._pendingCharId = null;  // id персонажа в процессе загрузки

    this._tooltip      = document.getElementById('char-tooltip');
    this._panel        = document.getElementById('char-panel');
    this._panelName    = document.getElementById('char-panel-name');
    this._panelAliases = document.getElementById('char-panel-aliases');
    this._panelLink    = document.getElementById('char-panel-link');
    this._panelClose   = document.getElementById('char-panel-close');

    const linkLabel = document.getElementById('char-panel-link-label');
    if (linkLabel) linkLabel.textContent = PANEL_LINK_LABEL;

    this._tooltip?.addEventListener('mouseenter', () => clearTimeout(this._hideTimer));
    this._tooltip?.addEventListener('mouseleave', () => {
      this._hideTimer = setTimeout(() => this._hideTooltip(), HOVER_HIDE_MS);
    });

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

    this._initPanelSwipe();
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

  // ── bind hover to message bubbles for author tooltip ───
  bindBubbles(container) {
    // Desktop only: pointer: fine (mouse, not touch)
    if (!window.matchMedia('(pointer: fine)').matches) return;

    container.querySelectorAll('.message-row[data-author-id]').forEach(row => {
      const bubble = row.querySelector('.bubble');
      if (!bubble) return;

      bubble.addEventListener('mouseenter', () => this._onBubbleHover(row));
      bubble.addEventListener('mouseleave', () => this._onBubbleHoverEnd());
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

  // ── hover (только десктоп, pointer: fine) → тултип ──
  _onHoverStart(el) {
    if (!window.matchMedia('(pointer: fine)').matches) return;
    const id = this._charId(el);
    clearTimeout(this._hoverTimer);
    clearTimeout(this._hideTimer);
    this._hoverTimer = setTimeout(() => this._showTooltip(id, el), HOVER_DELAY_MS);
  }

  _onHoverEnd() {
    clearTimeout(this._hoverTimer);
    this._hideTimer = setTimeout(() => this._hideTooltip(), HOVER_HIDE_MS);
  }

  // ── bubble hover ──────────────────────────────────────
  _onBubbleHover(row) {
    const authorId = row.dataset.authorId;
    if (!authorId) return;

    clearTimeout(this._hoverTimer);
    clearTimeout(this._hideTimer);

    const bubble = row.querySelector('.bubble');
    this._hoverTimer = setTimeout(() => this._showTooltip(authorId, bubble), HOVER_DELAY_MS);
  }

  _onBubbleHoverEnd() {
    clearTimeout(this._hoverTimer);
    this._hideTimer = setTimeout(() => this._hideTooltip(), HOVER_HIDE_MS);
  }

  _showTooltip(id, el) {
    const entry = this.index.find(c => c.id === id);
    if (!entry || !this._tooltip) return;

    const [primary, ...aliases] = entry.names;
    this._tooltip.querySelector('.tooltip-name').textContent = primary;
    this._tooltip.querySelector('.tooltip-aliases').textContent =
      aliases.length ? aliases.join(' · ') : '';

    const rect = el.getBoundingClientRect();
    let x = Math.min(rect.left, window.innerWidth - 260);
    let y = rect.bottom + 8;

    // If hovering over a bubble, position above it instead of below
    if (el.classList.contains('bubble')) {
      x = Math.min(rect.left, window.innerWidth - 260);
      y = rect.top - 8;
    }

    this._tooltip.style.left = x + 'px';
    this._tooltip.style.top  = y + 'px';
    this._tooltip.classList.add('show');
  }

  _hideTooltip() {
    this._tooltip?.classList.remove('show');
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

  // ── свайп-жесты для мобильной панели ─────────────────
  _initPanelSwipe() {
    if (!this._panel) return;
    let startY = 0;

    this._panel.addEventListener('touchstart', e => {
      startY = e.touches[0].clientY;
    }, { passive: true });

    this._panel.addEventListener('touchend', e => {
      const deltaY = e.changedTouches[0].clientY - startY;
      if (deltaY > 60) {
        this.closePanel();
      } else if (deltaY < -60 && this._panelCharId) {
        this._navigateToChar(this._panelCharId, this._lastVisited);
      }
    }, { passive: true });
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
      if (!resp.ok) {
        this.cache[id] = entry;
        return entry;
      }
      const data = await resp.json();
      this.cache[id] = data;
      return data;
    } catch {
      this.cache[id] = entry;
      return entry;
    }
  }
}
