// ── Search ───────────────────────────────────────────────

const MIN_QUERY_LENGTH = 2;
const MAX_RESULTS      = 40;
const SNIPPET_CONTEXT  = 60;

export class Search {
  constructor(blocks) {
    this.blocks   = blocks;
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
    if (!q || q.length < MIN_QUERY_LENGTH) { this._results.innerHTML = ''; return; }

    const hits = [];
    for (const block of this.blocks) {
      if (block.type !== 'message') continue;
      const idx = block.content.toLowerCase().indexOf(q);
      if (idx === -1) continue;

      const start = Math.max(0, idx - SNIPPET_CONTEXT);
      const end   = Math.min(block.content.length, idx + q.length + SNIPPET_CONTEXT);
      let snippet = block.content.slice(start, end);
      if (start > 0) snippet = '…' + snippet;
      if (end < block.content.length) snippet += '…';

      const rx = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
      snippet = snippet.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      snippet = snippet.replace(rx, '<mark>$1</mark>');

      hits.push({ anchor: block.anchor, snippet, authorId: block.authorId });
    }

    this._results.innerHTML = hits.slice(0, MAX_RESULTS).map(h => `
      <div class="search-result" data-anchor="${h.anchor}">
        ${h.authorId ? `<span class="search-result-author">${h.authorId}</span>` : ''}
        ${h.snippet}
      </div>
    `).join('');

    this._results.querySelectorAll('.search-result').forEach(el => {
      el.addEventListener('click', () => {
        const target = document.getElementById(el.dataset.anchor);
        if (!target) return;
        this.close();
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target.classList.add('search-target-highlight');
        setTimeout(() => target.classList.remove('search-target-highlight'), 1500);
      });
    });
  }
}
