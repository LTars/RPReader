// ── Characters ───────────────────────────────────────────
// Загружает index.json, подгружает файлы персонажей по требованию.
// Управляет панелью персонажа.

const BASE_URL = new URL('../', import.meta.url).href;
const CHAR_INDEX_URL = BASE_URL + 'data/characters/index.json';

const PANEL_LINK_LABEL = 'Страница персонажа';
const ALIASES_PREFIX   = 'также: ';
const HOVER_DELAY_MS   = 1000;
const HOVER_HIDE_MS    = 1000;
const HIGHLIGHT_MS     = 1200;
const FOCUS_CONTRACT_MS = 500;
const FOCUS_HOLD_MS     = 1500;
const FOCUS_FADE_MS     = 400;
const SWIPE_VELOCITY    = 0.3;
const SWIPE_DISTANCE    = 0.4;

export class Characters {
  constructor() {
    this.index   = [];
    this.cache   = {};
    this.nameMap = {};
    this._hoverTimer    = null;
    this._hideTimer     = null;
    this._lastVisited   = null;
    this._panelCharId   = null;
    this._pendingCharId = null;
    this._tooltipCharId = null;

    this._tooltip      = document.getElementById('char-tooltip');
    this._tooltipAvatar = document.getElementById('tooltip-avatar');
    this._panel        = document.getElementById('char-panel');
    this._panelName    = document.getElementById('char-panel-name');
    this._panelAliases = document.getElementById('char-panel-aliases');
    this._panelLink    = document.getElementById('char-panel-link');
    this._panelClose   = document.getElementById('char-panel-close');
    this._focusOverlay = document.getElementById('return-focus-overlay');

    const linkLabel = document.getElementById('char-panel-link-label');
    if (linkLabel) linkLabel.textContent = PANEL_LINK_LABEL;

    this._tooltip?.addEventListener('mouseenter', () => {
      clearTimeout(this._hideTimer);
    });
    this._tooltip?.addEventListener('mouseleave', () => {
      this._hideTimer = setTimeout(() => this._hideTooltip(), HOVER_HIDE_MS);
    });
    this._tooltip?.addEventListener('click', () => this._onTooltipClick());

    this._panelClose?.addEventListener('click', () => this.closePanel());

    this._panelLink?.addEventListener('click', e => e.preventDefault());

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
    if (el) this._animateFocusReturn(el);
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

    if (this._tooltipAvatar) {
      this._tooltipAvatar.textContent = primary.charAt(0);
    }

    this._tooltipCharId = id;

    const rect = el.getBoundingClientRect();
    const isBubble = el.classList.contains('bubble');
    let x = Math.min(rect.left, window.innerWidth - 270);
    let y;

    if (isBubble) {
      y = rect.top - 10;
      this._tooltip.classList.add('above');
    } else {
      y = rect.bottom + 8;
      this._tooltip.classList.remove('above');
    }

    this._tooltip.style.left = x + 'px';
    this._tooltip.style.top  = y + 'px';

    if (isBubble) {
      this._tooltip.style.transform = 'translateY(-100%)';
    } else {
      this._tooltip.style.transform = '';
    }

    this._tooltip.classList.add('show');
  }

  _hideTooltip() {
    this._tooltip?.classList.remove('show');
    this._tooltipCharId = null;
  }

  // ── tooltip click: panel or navigate ──────────────────
  async _onTooltipClick() {
    const id = this._tooltipCharId;
    if (!id) return;

    this._hideTooltip();

    const panelActiveForThis =
      this._panel?.classList.contains('open') && this._panelCharId === id;

    if (panelActiveForThis) {
      this._navigateToChar(id, this._lastVisited);
      return;
    }

    this._pendingCharId = id;
    const char = await this._loadChar(id);
    if (!char) { this._pendingCharId = null; return; }

    this._panelCharId = id;
    this._pendingCharId = null;
    this._openPanel(char);
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
    let startTime = 0;
    let currentDeltaY = 0;
    const panelEl = this._panel;

    panelEl.addEventListener('touchstart', e => {
      if (!panelEl.classList.contains('open')) return;
      startY = e.touches[0].clientY;
      startTime = Date.now();
      currentDeltaY = 0;
      panelEl.classList.add('swiping');
    }, { passive: true });

    panelEl.addEventListener('touchmove', e => {
      if (!panelEl.classList.contains('swiping')) return;
      e.preventDefault();

      const deltaY = e.touches[0].clientY - startY;
      const panelHeight = panelEl.offsetHeight;
      const maxUp = -panelHeight * 0.4;

      currentDeltaY = deltaY > 0 ? deltaY : Math.max(deltaY, maxUp);
      panelEl.style.transform = `translateY(${currentDeltaY}px)`;
    }, { passive: false });

    panelEl.addEventListener('touchend', () => {
      if (!panelEl.classList.contains('swiping')) return;
      panelEl.classList.remove('swiping');

      const elapsed = Date.now() - startTime;
      const velocity = currentDeltaY / Math.max(elapsed, 1);
      const panelHeight = panelEl.offsetHeight;
      const fraction = currentDeltaY / panelHeight;

      panelEl.style.transform = '';

      if (velocity > SWIPE_VELOCITY || fraction > SWIPE_DISTANCE) {
        this.closePanel();
      } else if (velocity < -SWIPE_VELOCITY || fraction < -0.3) {
        if (this._panelCharId) {
          this._navigateToChar(this._panelCharId, this._lastVisited);
        }
      }
      // else snap back (transform already cleared)
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

  // ── contracting focus return animation ────────────────
  _animateFocusReturn(el) {
    const overlay = this._focusOverlay;
    if (!overlay) {
      this._highlightElement(el);
      return;
    }

    el.scrollIntoView({ behavior: 'smooth', block: 'center' });

    setTimeout(() => {
      const rect = el.getBoundingClientRect();
      const t = rect.top;
      const r = window.innerWidth - rect.right;
      const b = window.innerHeight - rect.bottom;
      const l = rect.left;

      const anim = overlay.animate([
        { clipPath: 'inset(0px)', opacity: 0 },
        { clipPath: `inset(${t}px ${r}px ${b}px ${l}px)`, opacity: 1 }
      ], {
        duration: FOCUS_CONTRACT_MS,
        easing: 'ease-in',
        fill: 'forwards'
      });

      anim.onfinish = () => {
        setTimeout(() => {
          overlay.animate([
            { opacity: 1 },
            { opacity: 0 }
          ], {
            duration: FOCUS_FADE_MS,
            easing: 'ease-out',
            fill: 'forwards'
          });
        }, FOCUS_HOLD_MS);
      };
    }, 400);
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
