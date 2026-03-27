// ── Search ───────────────────────────────────────────────
export class Search {
  constructor(blocks) {
    this.blocks = blocks; // parsed blocks from reader
    this._overlay = document.getElementById('search-overlay');
    this._input   = document.getElementById('search-input');
    this._results = document.getElementById('search-results');

    this._input?.addEventListener('input', () => this._run());
    this._overlay?.addEventListener('click', e => {
      if (e.target === this._overlay) this.close();
    });
    document.addEventListener('keydown', e => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); this.open(); }
      if (e.key === 'Escape') this.close();
    });
  }

  open() {
    this._overlay?.classList.add('show');
    this._input?.focus();
  }

  close() {
    this._overlay?.classList.remove('show');
    if (this._input) this._input.value = '';
    if (this._results) this._results.innerHTML = '';
  }

  _run() {
    const q = this._input?.value.trim().toLowerCase();
    if (!q || q.length < 2) { this._results.innerHTML = ''; return; }

    const hits = [];
    for (const block of this.blocks) {
      if (block.type !== 'message') continue;
      const idx = block.content.toLowerCase().indexOf(q);
      if (idx === -1) continue;

      // extract snippet around match
      const start = Math.max(0, idx - 60);
      const end   = Math.min(block.content.length, idx + q.length + 60);
      let snippet = block.content.slice(start, end);
      if (start > 0) snippet = '…' + snippet;
      if (end < block.content.length) snippet += '…';

      // highlight
      const rx = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
      snippet = snippet.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      snippet = snippet.replace(rx, '<mark>$1</mark>');

      hits.push({ anchor: block.anchor, snippet, authorId: block.authorId });
    }

    this._results.innerHTML = hits.slice(0, 40).map(h => `
      <div class="search-result" data-anchor="${h.anchor}">
        ${h.authorId ? `<span style="color:var(--text-muted);font-size:11px;margin-bottom:4px;display:block">${h.authorId}</span>` : ''}
        ${h.snippet}
      </div>
    `).join('');

    this._results.querySelectorAll('.search-result').forEach(el => {
      el.addEventListener('click', () => {
        const anchor = el.dataset.anchor;
        const target = document.getElementById(anchor);
        if (target) {
          this.close();
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
          target.style.outline = '1px solid var(--accent)';
          setTimeout(() => target.style.outline = '', 1500);
        }
      });
    });
  }
}
