const BASE_URL       = new URL('../', import.meta.url).href;
const CHAR_INDEX_URL = BASE_URL + 'data/characters/index.json';

const UI = {
  NAV_READER_TITLE:  'Читалка',
  LOADING:           'Загрузка...',
  NO_ID:             'Персонаж не указан.',
  NOT_FOUND:         'Персонаж не найден.',
  LIBRARY_TITLE:     'Персонажи',
  LIBRARY_EMPTY:     'Персонажей пока нет.',
  SECTION_RELATIONS: 'Связи',
  SECTION_SCENES:    'Сцены',
  BACK_READER:       '← вернуться к тексту',
  BACK_LIBRARY:      '← все персонажи',
};

// ── init ─────────────────────────────────────────────────
const navLink  = document.querySelector('.panel .panel-icon');
if (navLink) navLink.title = UI.NAV_READER_TITLE;

const backLink = document.querySelector('.back-link');
const content  = document.getElementById('char-content');
const params   = new URLSearchParams(location.search);
const id       = params.get('id');

content.innerHTML = `<p class="char-loading">${UI.LOADING}</p>`;

if (id) {
  if (backLink) {
    backLink.href        = BASE_URL + 'character.html';
    backLink.textContent = UI.BACK_LIBRARY;
  }
  loadChar(id);
} else {
  if (backLink) {
    backLink.href        = BASE_URL + 'index.html';
    backLink.textContent = UI.BACK_READER;
  }
  loadLibrary();
}

// ── library ───────────────────────────────────────────────
async function loadLibrary() {
  try {
    const resp = await fetch(CHAR_INDEX_URL);
    if (!resp.ok) throw new Error(`Index load failed: ${resp.status}`);
    const index = await resp.json();
    renderLibrary(index);
  } catch (err) {
    console.error('Library load failed:', err);
    content.innerHTML = `<p class="char-error">${UI.NOT_FOUND}</p>`;
  }
}

function renderLibrary(index) {
  const items = index.map(entry => `
    <a class="char-list-item" href="${BASE_URL}character.html?id=${entry.id}">
      <div class="char-list-avatar">${entry.names[0][0].toUpperCase()}</div>
      <div>
        <div class="char-list-name">${entry.names[0]}</div>
        ${entry.names.length > 1
          ? `<div class="char-list-aliases">${entry.names.slice(1).join(' · ')}</div>`
          : ''}
      </div>
    </a>
  `).join('');

  content.innerHTML = `
    <h1 class="char-library-title">${UI.LIBRARY_TITLE}</h1>
    ${items
      ? `<div class="char-list">${items}</div>`
      : `<p class="char-error">${UI.LIBRARY_EMPTY}</p>`}
  `;
}

// ── character detail ──────────────────────────────────────
async function loadChar(charId) {
  try {
    const indexResp = await fetch(CHAR_INDEX_URL);
    if (!indexResp.ok) throw new Error(`Index load failed: ${indexResp.status}`);
    const index = await indexResp.json();

    const entry = index.find(c => c.id === charId);
    if (!entry) throw new Error('not found');

    const charResp = await fetch(BASE_URL + entry.file);
    if (charResp.ok) {
      renderChar(await charResp.json());
    } else {
      const exResp = await fetch(BASE_URL + 'data/characters/example_char.json');
      if (!exResp.ok) throw new Error(`Example load failed: ${exResp.status}`);
      const example = await exResp.json();
      example.id = entry.id;
      example.names = [entry.names[0]];
      renderChar(example);
    }
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
