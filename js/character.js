const BASE_URL       = new URL('../', import.meta.url).href;
const CHAR_INDEX_URL = BASE_URL + 'data/characters/index.json';

const UI = {
  NAV_READER_TITLE: 'Читалка',
  LOADING:          'Загрузка...',
  NO_ID:            'Персонаж не указан.',
  NOT_FOUND:        'Персонаж не найден.',
  SECTION_RELATIONS: 'Связи',
  SECTION_SCENES:    'Сцены',
};

// ── init ─────────────────────────────────────────────────
const navLink = document.querySelector('.panel .panel-icon');
if (navLink) navLink.title = UI.NAV_READER_TITLE;

const content = document.getElementById('char-content');
content.innerHTML = `<p class="char-loading">${UI.LOADING}</p>`;

const params = new URLSearchParams(location.search);
const id     = params.get('id');

if (!id) {
  content.innerHTML = `<p class="char-error">${UI.NO_ID}</p>`;
} else {
  loadChar(id);
}

// ── functions ─────────────────────────────────────────────
async function loadChar(charId) {
  try {
    const indexResp = await fetch(CHAR_INDEX_URL);
    if (!indexResp.ok) throw new Error(`Index load failed: ${indexResp.status}`);
    const index = await indexResp.json();

    const entry = index.find(c => c.id === charId);
    if (!entry) throw new Error('not found');

    const charResp = await fetch(BASE_URL + entry.file);
    if (!charResp.ok) throw new Error(`Char load failed: ${charResp.status}`);
    const char = await charResp.json();

    renderChar(char);
  } catch (err) {
    console.error('Character load failed:', err);
    content.innerHTML = `<p class="char-error">${UI.NOT_FOUND}</p>`;
  }
}

function renderChar(char) {
  const [primary, ...aliases] = char.names;
  document.title = primary;

  const scenes = (char.scenes || []).map(s => `
    <a class="char-scene" href="${BASE_URL}reader.html#${s.anchor}">
      ${s.title || s.id}
      ${s.note ? `<span class="char-scene-note">${s.note}</span>` : ''}
    </a>
  `).join('');

  const relations = (char.relations || []).map(r => `
    <a class="char-relation" href="${BASE_URL}character.html?id=${r.characterId}">
      ${r.characterId}${r.type ? ` · ${r.type}` : ''}
    </a>
  `).join('');

  content.innerHTML = `
    <div class="char-avatar-placeholder">
      ${primary[0]?.toUpperCase() || '?'}
    </div>
    <h1 class="char-page-name">${primary}</h1>
    ${aliases.length ? `<div class="char-page-aliases">${aliases.join(' · ')}</div>` : ''}
    ${char.description ? `<p class="char-description">${char.description}</p>` : ''}

    ${relations ? `
      <div class="char-section-title">${UI.SECTION_RELATIONS}</div>
      <div class="char-relations">${relations}</div>
    ` : ''}

    ${scenes ? `
      <div class="char-section-title">${UI.SECTION_SCENES}</div>
      <div class="char-scenes">${scenes}</div>
    ` : ''}
  `;
}
