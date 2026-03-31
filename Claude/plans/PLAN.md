# Plan: Исправления и ближайшие фичи

Основа: CODE_REVIEW.md + коммит `392ee9b` (char-link interaction redesign)

---

## Часть 1. Баг-фиксы и чистка

### 1.1 CRITICAL: `_initPanelSwipe()` не определён

`characters.js:48` вызывает `this._initPanelSwipe()`, но метод не существует в классе.
Результат: **TypeError при конструировании `Characters`** — ломает всю страницу reader.html.

**Действие:** Добавить пустой метод-заглушку в класс `Characters` (перед `closePanel`):

```js
// characters.js — добавить перед closePanel()
_initPanelSwipe() {
  // TODO: реализовать в рамках фичи "Bottom sheet swipe"
}
```

**Файл:** `js/characters.js`, добавить после строки 176 (после `_openPanel`)

---

### 1.2 CSS: лишние закрывающие скобки

Три файла содержат «висячую» `}` в конце, вне любого правила.

**Действия:**

| Файл | Строка | Действие |
|---|---|---|
| `css/common.css` | 57 | Удалить строку `}` |
| `css/index.css` | 45 | Удалить строку `}` |
| `css/character.css` | 188 | Удалить строку `}` |

---

### 1.3 Null reference в `search.js:27`

```js
// Было:
if (!q || q.length < MIN_QUERY_LENGTH) { this._results.innerHTML = ''; return; }
```

**Действие:** Заменить на:
```js
if (!q || q.length < MIN_QUERY_LENGTH) {
  if (this._results) this._results.innerHTML = '';
  return;
}
```

**Файл:** `js/search.js:27`

---

### 1.4 Null reference в `character.js:26`

```js
// Было:
content.innerHTML = `<p class="char-loading">${UI.LOADING}</p>`;
```

**Действие:** Добавить проверку:
```js
if (content) content.innerHTML = `<p class="char-loading">${UI.LOADING}</p>`;
```

И ниже по файлу — все `content.innerHTML = ...` обернуть в `if (content)`.

**Файл:** `js/character.js:26, 56, 73, 104, 125`

---

### 1.5 Удалить мёртвый код: tooltip

По логу `log04.md`: «Hover теперь открывает панель (не тултип), тултип более не используется.»

Но tooltip-код всё ещё присутствует:

**Действия:**

1. **`reader.html:72-76`** — удалить блок:
   ```html
   <!-- character tooltip -->
   <div class="char-tooltip" id="char-tooltip">
     <div class="tooltip-name"></div>
     <div class="tooltip-aliases"></div>
   </div>
   ```

2. **`css/reader.css:290-323`** — удалить блок `.char-tooltip` и все вложенные правила (`.tooltip-name`, `.tooltip-aliases`, `&.show`).

3. **`js/characters.js:23`** — удалить строку:
   ```js
   this._tooltip = document.getElementById('char-tooltip');
   ```

---

### 1.6 Удалить мёртвый код: `wrapNames()`

Метод `Characters.wrapNames()` (characters.js:66-80) не вызывается нигде. Линковка персонажей делается в `process.js` на этапе сборки.

**Действие:** Удалить метод `wrapNames` и комментарий над ним (строки 64-80).

---

### 1.7 Удалить мёртвый код: `parser.js`

Модуль `js/parser.js` не импортируется ни одним файлом. Реальный парсинг:
- Сырой текст → блоки: `scripts/process.js` (Node.js, со своим HEADER_RX)
- Блоки → JS-объекты: `parseBlock()` в `reader.js`

**Действие:** Удалить файл `js/parser.js` (157 строк).

---

### 1.8 Удалить мёртвый код: `content/names.json`

Дублирует `data/characters/index.json`. Не импортируется ни одним файлом. Содержит расхождение в написании («Вэй Усянь» vs «Вэй Усьянь»).

**Действие:** Удалить файл `content/names.json`.

---

### 1.9 Удалить мёртвый код: переменные в `process.js`

```js
// process.js:75 — объявлены, не используются
let result = '';
let lastIndex = 0;
```

**Действие:** Удалить строки 75 и 76 из `scripts/process.js`.

---

### 1.10 Fallback на example_char.json — показывать заглушку

```js
// character.js:94-100 — показывает фейковые данные при 404
const exResp = await fetch(BASE_URL + 'data/characters/example_char.json');
```

**Действие:** Заменить весь блок `else` (строки 94-100) на:
```js
      } else {
        renderChar({ id: entry.id, names: entry.names, description: null, relations: [], scenes: [] });
      }
```

`renderChar` уже обрабатывает пустые массивы через `(char.scenes || [])` и optional `char.description`.

**Файл:** `js/character.js:94-100`

---

### 1.11 Unused параметр `_showHeader`

```js
// reader.js:134
_makeMessage(block, _showHeader) {
```

**Действие:** Убрать параметр из сигнатуры:
```js
_makeMessage(block) {
```

И из вызова (reader.js:108):
```js
// Было:
chat.appendChild(this._makeMessage(block, showHeader));
// Стало:
chat.appendChild(this._makeMessage(block));
```

---

## Часть 2. Roadmap — фича 1: Bottom sheet swipe gestures (mobile)

### Обоснование

- `_initPanelSwipe()` уже вызывается в конструкторе (строка 48) — метод запланирован
- CSS уже трансформирует char-panel в bottom sheet на мобильных (reader.css:456-469)
- Без swipe единственный способ закрыть панель на мобильном — кнопка ✕ или Escape
- Естественное UX-ожидание: swipe down закрывает bottom sheet

### Спецификация

**Поведение:**
- Swipe down по char-panel на мобильном → закрыть панель
- Drag handle визуализируется (уже есть `::before` pill на `.char-panel-header`, reader.css:473-483)
- Порог: swipe > 80px → закрыть, иначе snap back
- Во время свайпа панель следует за пальцем (translateY)

**Реализация:**

1. **`js/characters.js`** — реализовать `_initPanelSwipe()`:

```js
_initPanelSwipe() {
  const panel = this._panel;
  if (!panel) return;

  let startY = 0;
  let currentY = 0;
  let dragging = false;

  const THRESHOLD = 80;

  panel.addEventListener('touchstart', e => {
    if (!panel.classList.contains('open')) return;
    startY = e.touches[0].clientY;
    currentY = startY;
    dragging = true;
    panel.style.transition = 'none';
  }, { passive: true });

  panel.addEventListener('touchmove', e => {
    if (!dragging) return;
    currentY = e.touches[0].clientY;
    const dy = Math.max(0, currentY - startY);
    panel.style.transform = `translateY(${dy}px)`;
  }, { passive: true });

  panel.addEventListener('touchend', () => {
    if (!dragging) return;
    dragging = false;
    const dy = currentY - startY;

    panel.style.transition = '';
    panel.style.transform = '';

    if (dy > THRESHOLD) {
      this.closePanel();
    }
  });
}
```

2. **Никаких изменений в CSS** — мобильный transform уже настроен.

3. **Никаких изменений в HTML** — drag handle (`::before` pseudo-element) уже есть.

### Файлы для изменения

| Файл | Изменение |
|---|---|
| `js/characters.js` | Реализовать `_initPanelSwipe()` |

---

## Часть 3. Roadmap — фича 2: LOD content loading

### Обоснование

- Сейчас 48 блоков загружаются параллельно при старте (reader.js:76-81)
- При росте контента (100+ блоков) — заметная задержка загрузки и расход памяти
- LOD (Level of Detail) — ленивая загрузка блоков по мере прокрутки
- Подготовка к масштабированию без изменения пайплайна

### Спецификация

**Стратегия: Viewport-based lazy loading с IntersectionObserver**

Разбить `index.json` на чанки. Загружать чанк, когда его placeholder входит в viewport.

**Параметры:**
- `CHUNK_SIZE = 10` — блоков за раз
- `ROOT_MARGIN = '600px'` — preload за 600px до видимой области
- Первый чанк загружается сразу (above-the-fold контент)

**Реализация:**

1. **`js/reader.js`** — переработать `_loadContent()` и `_render()`:

```js
// Константы (добавить в начало файла)
const CHUNK_SIZE  = 10;
const ROOT_MARGIN = '600px';

// Заменить _loadContent() на:
async _loadContent() {
  const indexResp = await fetch(BLOCKS_URL + 'index.json');
  if (!indexResp.ok) throw new Error('Blocks index load failed');
  this._filenames = await indexResp.json();
  this._loadedCount = 0;
}

// Заменить _render() на:
_render() {
  this._chat = document.getElementById('chat');
  if (!this._chat) return;

  // Создать placeholder-чанки
  this._chunks = [];
  for (let i = 0; i < this._filenames.length; i += CHUNK_SIZE) {
    const placeholder = document.createElement('div');
    placeholder.className = 'chunk-placeholder';
    placeholder.dataset.chunkIndex = this._chunks.length;
    this._chat.appendChild(placeholder);
    this._chunks.push({
      start: i,
      end: Math.min(i + CHUNK_SIZE, this._filenames.length),
      placeholder,
      loaded: false,
    });
  }

  // Первый чанк — сразу
  this._loadChunk(0).then(() => {
    this.characters.bindLinks(this._chat);
    this.characters.checkReturnHighlight();
    this.search = new Search(this.blocks);
  });

  // Остальные — по IntersectionObserver
  this._observer = new IntersectionObserver(
    entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const idx = Number(entry.target.dataset.chunkIndex);
        if (this._chunks[idx].loaded) continue;
        this._loadChunk(idx);
      }
    },
    { rootMargin: ROOT_MARGIN }
  );

  for (let i = 1; i < this._chunks.length; i++) {
    this._observer.observe(this._chunks[i].placeholder);
  }
}

async _loadChunk(chunkIdx) {
  const chunk = this._chunks[chunkIdx];
  if (chunk.loaded) return;
  chunk.loaded = true;

  const filenames = this._filenames.slice(chunk.start, chunk.end);
  const blocks = new Array(filenames.length);

  await Promise.all(filenames.map(async (filename, i) => {
    const resp = await fetch(BLOCKS_URL + filename);
    if (!resp.ok) return;
    blocks[i] = parseBlock(await resp.text(), filename);
  }));

  const loaded = blocks.filter(Boolean);
  this.blocks.push(...loaded);

  // Рендер блоков вместо placeholder
  const fragment = document.createDocumentFragment();
  let lastAuthorId = null;
  let lastSide = null;

  // Найти последнего автора предыдущего чанка
  if (chunkIdx > 0) {
    const prevBlocks = this.blocks.slice(0, -loaded.length);
    for (let i = prevBlocks.length - 1; i >= 0; i--) {
      if (prevBlocks[i].type === 'message') {
        lastAuthorId = prevBlocks[i].authorId;
        lastSide = prevBlocks[i].side;
        break;
      }
    }
  }

  for (const block of loaded) {
    if (block.type === 'divider') {
      fragment.appendChild(this._makeDivider(block));
      lastAuthorId = null;
      continue;
    }
    if (block.type !== 'message') continue;

    const showHeader = block.authorId !== lastAuthorId || block.side !== lastSide;
    if (showHeader) {
      fragment.appendChild(this._makeHeader(block));
    }
    fragment.appendChild(this._makeMessage(block));
    lastAuthorId = block.authorId;
    lastSide = block.side;
  }

  chunk.placeholder.replaceWith(fragment);
  this._observer?.unobserve(chunk.placeholder);

  // Перебиндить линки в новых элементах
  this.characters.bindLinks(this._chat);

  // Обновить поиск
  if (this.search) {
    this.search.blocks = this.blocks;
  }
}
```

2. **`js/search.js`** — сделать `blocks` мутабельным (уже так: `this.blocks = blocks`, поиск будет автоматически видеть новые блоки).

3. **`css/reader.css`** — добавить минимальный стиль для placeholder (чтобы observer срабатывал):

```css
/* Добавить после .chat */
.chunk-placeholder {
  min-height: 200px;
}
```

### Файлы для изменения

| Файл | Изменение |
|---|---|
| `js/reader.js` | Переработать `_loadContent()`, `_render()`, добавить `_loadChunk()` |
| `css/reader.css` | Добавить `.chunk-placeholder` |

### Ограничения и edge cases

- **Scroll to anchor** (при возврате из character page): если блок в незагруженном чанке — `checkReturnHighlight()` не найдёт элемент. Решение: при наличии `returnLinkId` — загрузить все чанки до нужного id.
- **Search по незагруженным блокам**: результаты будут неполными до полной загрузки. Приемлемо для MVP — в поиске искать только по загруженным.
- **Progress bar**: `_updateProgress()` работает по scroll position, не зависит от количества загруженных блоков — будет работать корректно.

---

## Порядок выполнения

```
Шаг 1 │ Баг-фиксы (1.1 — 1.4)          │ 4 файла
Шаг 2 │ Удаление мёртвого кода (1.5-1.9) │ 6 файлов, 1 удаление
Шаг 3 │ Мелкие улучшения (1.10, 1.11)    │ 2 файла
       │ ── коммит: "fix bugs, remove dead code" ──
Шаг 4 │ Bottom sheet swipe (Часть 2)      │ 1 файл
       │ ── коммит: "add bottom sheet swipe on mobile" ──
Шаг 5 │ LOD loading (Часть 3)            │ 2 файла
       │ ── коммит: "lazy load content blocks via IntersectionObserver" ──
```

---

## Затронутые файлы — сводка

| Файл | Шаг | Действие |
|---|---|---|
| `js/characters.js` | 1,2,4 | Заглушка `_initPanelSwipe` → удалить tooltip → реализовать swipe |
| `js/search.js` | 1 | Null check |
| `js/character.js` | 1,3 | Null check + убрать example fallback |
| `js/reader.js` | 3,5 | Убрать `_showHeader` + LOD loading |
| `css/common.css` | 1 | Удалить лишнюю `}` |
| `css/index.css` | 1 | Удалить лишнюю `}` |
| `css/character.css` | 1 | Удалить лишнюю `}` |
| `css/reader.css` | 2,5 | Удалить tooltip styles + chunk placeholder |
| `reader.html` | 2 | Удалить tooltip DOM |
| `js/parser.js` | 2 | **Удалить файл** |
| `content/names.json` | 2 | **Удалить файл** |
| `scripts/process.js` | 2 | Удалить неиспользуемые переменные |
