# Code Review — RPReader

Дата: 2026-03-28
Ревизия: `dcb3ef3` (main)

---

## Содержание

1. [Архитектура и структура](#1-архитектура-и-структура)
2. [Баги и ошибки](#2-баги-и-ошибки)
3. [Мёртвый код](#3-мёртвый-код)
4. [Безопасность](#4-безопасность)
5. [Производительность](#5-производительность)
6. [Качество кода](#6-качество-кода)
7. [CSS](#7-css)
8. [HTML](#8-html)
9. [Данные и конфигурация](#9-данные-и-конфигурация)
10. [Общие выводы](#10-общие-выводы)

---

## 1. Архитектура и структура

### Общая оценка

Архитектура соответствует заявленному пайплайну `Content → Parse → Blocks → Render → DOM`. Разделение на processing (Node.js) и rendering (браузер) — правильное решение. Однако есть путаница между двумя парсерами и несколько «осиротевших» файлов.

### Два парсера — один лишний

**`parser.js`** (браузерный) и **`process.js`** (Node.js) содержат пересекающуюся, но несовместимую логику парсинга.

- `process.js` — рабочий пайплайн. Парсит формат Telegram (`[M/D/YYYY H:MM AM] author: text`), линкует персонажей, записывает блоки.
- `parser.js` — экспортирует класс `Parser` и функцию `loadParser()`. **Нигде не импортируется и не используется.** Regex `author_block` из `parser-rules.json` ожидает формат `[Author datetime]`, который не совпадает с реальным форматом Telegram.

`reader.js` парсит блоки своей функцией `parseBlock()` (YAML frontmatter), а не через `Parser`.

**Вердикт:** `parser.js` — мёртвый модуль. Либо удалить, либо привести к реальному формату данных и интегрировать.

### Файл `content/names.json` — осиротевший

163 строки данных о персонажах в формате `{clan, name, aliases[]}`. Не импортируется ни одним JS-файлом. По содержанию дублирует `data/characters/index.json`, но с расхождениями (см. раздел 9).

---

## 2. Баги и ошибки

### BUG-01: CSS — лишние закрывающие скобки

Три файла содержат «висячие» `}` в конце, вне любого правила:

| Файл | Строка | Контекст |
|---|---|---|
| `css/common.css` | 57 | После закрытия `.app` на строке 56 |
| `css/index.css` | 45 | После закрытия `.index-link` на строке 44 |
| `css/character.css` | 188 | После закрытия `.char-scene-note` на строке 187 |

Браузеры молча игнорируют ошибку, но она может сломать парсинг при добавлении правил ниже и делает CSS невалидным.

### BUG-02: Null reference в `search.js:27`

```js
// search.js:27
if (!q || q.length < MIN_QUERY_LENGTH) { this._results.innerHTML = ''; return; }
```

`this._results` может быть `null` (элемент `#search-results` не найден). В том же файле `this._input` обращается через optional chaining (`this._input?.value`), а `this._results` — нет. При отсутствии DOM-элемента упадёт с TypeError.

### BUG-03: Null reference в `character.js:25`

```js
// character.js:25
content.innerHTML = `<p class="char-loading">${UI.LOADING}</p>`;
```

`content` (`document.getElementById('char-content')`) не проверяется на `null`. Если элемент отсутствует — crash. При этом `navLink` и `backLink` в том же файле проверяются.

### BUG-04: Fallback на `example_char.json` показывает фейковые данные

```js
// character.js:88-94
} else {
  const exResp = await fetch(BASE_URL + 'data/characters/example_char.json');
  // ...
  example.id = entry.id;
  example.names = [entry.names[0]];
  renderChar(example);
}
```

Если файл персонажа не найден (404), страница молча показывает шаблонные данные из `example_char.json` с подменённым именем. Пользователь видит фейковые связи и сцены без индикации, что данные неполные.

### BUG-05: `parseBlock` в reader.js — хрупкий парсинг frontmatter

```js
// reader.js:9
const fmMatch = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
```

Regex ломается, если содержимое блока начинается с `---` (допустимый markdown для горизонтальной линии). Текущие данные не содержат таких случаев, но это мина замедленного действия.

### BUG-06: `_resolveAuthor` — нечёткий матчинг

```js
// parser.js:126-128
for (const [k, v] of Object.entries(this._authorMap)) {
  if (key.includes(k) || k.includes(key)) return v;
}
```

Fuzzy-matching через `includes` может дать ложные срабатывания. Например, автор "an" совпадёт с "Lan". Для текущего набора авторов (Tars, zavet) это не проблема, но опасно при масштабировании. Впрочем, `parser.js` не используется (см. раздел 1).

### BUG-07: `process.js` — неиспользуемые переменные

```js
// process.js:75
let result = '';
let lastIndex = 0;
```

Объявлены в `linkCharacters()`, но нигде не читаются и не модифицируются. Остатки рефакторинга.

---

## 3. Мёртвый код

| Что | Где | Причина |
|---|---|---|
| Модуль `parser.js` целиком | `js/parser.js` | Не импортируется, не используется |
| Метод `wrapNames()` | `js/characters.js:46-55` | Линковка персонажей происходит в `process.js` на этапе сборки, в рантайме метод не вызывается |
| Переменные `result`, `lastIndex` | `scripts/process.js:75` | Объявлены, не используются |
| Файл `content/names.json` | — | Не импортируется, дублирует `data/characters/index.json` |
| Файл `data/character-appearances.json` | — | Пуст (`[]`), нигде не читается фронтендом |

---

## 4. Безопасность

### SEC-01: innerHTML с непроверенными данными

Несколько мест вставляют данные из JSON через `innerHTML` без санитизации:

| Файл | Строки | Что вставляется |
|---|---|---|
| `reader.js` | 124-127 | Имя автора из `parser-rules.json` |
| `reader.js` | 148-150 | Содержимое блока (HTML с char-links) |
| `character.js` | 55-72 | Имена персонажей из `index.json` |
| `character.js` | 104-134 | Описание, связи, сцены из JSON персонажа |

**Риск:** Низкий в текущей модели (данные из собственных JSON-файлов). Но при переходе к Supabase-бэкенду или пользовательскому вводу (комментарии, закладки из roadmap) — это станет XSS-уязвимостью.

**Рекомендация:** Использовать `textContent` для текстовых данных, `innerHTML` только для HTML, сгенерированного внутри приложения. Для character links в блоках — они уже HTML, это ожидаемо.

### SEC-02: Поиск — корректная эскейпизация

```js
// search.js:39
snippet = snippet.replace(/</g, '&lt;').replace(/>/g, '&gt;');
```

Данные эскейпятся перед вставкой в `innerHTML` — это правильно.

---

## 5. Производительность

### PERF-01: Все блоки загружаются разом

```js
// reader.js:76
await Promise.all(filenames.map(async (filename, i) => {
  const resp = await fetch(BLOCKS_URL + filename);
  // ...
}));
```

48 параллельных fetch-запросов при загрузке страницы. На текущем объёме (48 блоков) — терпимо. При росте до сотен блоков — заметная задержка и нагрузка на сервер. Roadmap упоминает LOD — это правильный путь.

### PERF-02: Линейный поиск на каждый keystroke

```js
// search.js:29-41
for (const block of this.blocks) {
  // ...
  const idx = block.content.toLowerCase().indexOf(q);
}
```

Каждый ввод символа перебирает все блоки и вызывает `toLowerCase()` на каждом. Для текущего объёма — нормально. При масштабировании стоит:
- Кешировать `content.toLowerCase()`
- Добавить debounce на input

### PERF-03: `_compiled.find()` в parser.js вызывается на каждой строке

```js
// parser.js:109
const p = this._compiled.find(c => c.name === 'author_block');
```

Линейный поиск по массиву шаблонов на каждой строке текста. Лучше использовать Map. Но `parser.js` не используется, так что это неактуально.

---

## 6. Качество кода

### Положительное

- **Структура файлов** — чистое разделение по модулям (reader, characters, search, character)
- **ES modules** — без бандлера, чистый import/export
- **Custom properties в CSS** — все значения в переменных, единообразно
- **Naming** — camelCase в JS, kebab-case в CSS, как заявлено в стайлгайде
- **Constness** — `const` по умолчанию, `let` только при мутации
- **Минимализм** — нет лишних зависимостей, нет build step

### Проблемы

#### QA-01: Несогласованная обработка ошибок

| Паттерн | Где |
|---|---|
| `throw new Error(...)` | `reader.js:65,72`, `character.js:45,79,83,90` |
| `return null` | `characters.js:119,121,126`, `reader.js:10` |
| `console.error + return null` | `characters.js:126` |
| Молчаливый catch | `reader.js:217` (battery), `character.js:96-98` |

Нет единого паттерна. Ошибки загрузки блоков бросают исключения, а ошибки загрузки персонажей тихо возвращают null.

#### QA-02: DOM-обращения в конструкторе `Characters`

```js
// characters.js:20-24
this._tooltip      = document.getElementById('char-tooltip');
this._panel        = document.getElementById('char-panel');
// ...
```

Конструктор напрямую обращается к DOM. Это работает только потому, что `reader.js` загружается как `type="module"` (deferred по умолчанию). Но делает класс непереносимым и нетестируемым.

#### QA-03: `character.js` — дублирование fetch index.json

```js
// character.js:44 (loadLibrary)
const resp = await fetch(CHAR_INDEX_URL);
// character.js:78 (loadChar)
const indexResp = await fetch(CHAR_INDEX_URL);
```

Два отдельных fetch для одного и того же файла в двух разных ветках кода. Не баг (они в разных code paths), но при рефакторинге стоит выделить общую загрузку.

#### QA-04: `characters.js` — tooltip с 2-секундной задержкой

```js
// characters.js:74
this._tooltipTimer = setTimeout(() => this._showTooltip(id, e), 2000);
```

2000ms — очень длинная задержка для tooltip. Стандартная UX-практика: 300-500ms. При 2 секундах пользователь скорее кликнет, чем дождётся tooltip.

#### QA-05: `reader.js` — `_showHeader` параметр не используется

```js
// reader.js:131
_makeMessage(block, _showHeader) {
```

Параметр передаётся, но не используется в теле функции (нижнее подчёркивание указывает на намеренный пропуск). Если он не нужен — не стоит передавать.

---

## 7. CSS

### CSS-01: Стили shared-компонентов в reader.css

`reader.css` (506 строк) содержит стили для:
- `.char-link` (используется и на character page)
- `.char-tooltip`
- `.char-panel`
- `.panel` (навигация)
- `.main` (layout)

`character.html` загружает `reader.css` целиком ради этих shared-стилей. Это создаёт неявную зависимость — при рефакторинге reader.css можно случайно сломать character page.

**Рекомендация:** Вынести shared-стили (panel, main, char-link, etc.) в `common.css` или отдельный `shared.css`.

### CSS-02: Нет fallback для CSS nesting

CSS nesting используется повсеместно (`&:hover`, `&.open`, вложенные селекторы). Это соответствует стайлгайду (modern browsers only), но стоит учитывать, что CSS nesting получил поддержку в Chrome 120 (Dec 2023) и Firefox 117 (Aug 2023). Старые версии браузеров полностью проигнорируют вложенные правила.

### CSS-03: Responsive — только один breakpoint

```css
// reader.css:455
@media (max-width: 768px) { ... }
```

Единственный breakpoint — 768px. Нет адаптации для очень маленьких экранов (< 375px) или больших планшетов (768-1024px). Для MVP — достаточно.

### CSS-04: Дублирование font-family

`font-family: var(--font-ui)` повторяется в 20+ правилах. Можно задать на уровне `body` или `.app` и переопределять только для content-зон (где используется `var(--font-body)`).

---

## 8. HTML

### HTML-01: Чистая разметка

Все три HTML-файла валидны, нет inline-стилей и inline-скриптов. Соответствует стайлгайду.

### HTML-02: Accessibility

- `<button>` и `<a>` используются семантически корректно
- `char-link` имеет `tabindex="0"` и обработчик `keydown` — доступность для клавиатуры
- **Отсутствуют:** `aria-label` на иконочных кнопках (panel-toggle, search-btn, blue-filter-btn), `role` на динамических элементах, `<h1>` на reader page

### HTML-03: `character.html` — пустой `<a class="back-link">`

```html
<!-- character.html:26 -->
<a class="back-link"></a>
```

Ссылка без href и текста — наполняется из JS. До загрузки JS — пустой интерактивный элемент. Не критично, но FOUC (Flash of Unstyled Content).

---

## 9. Данные и конфигурация

### DATA-01: Расхождение в написании имени

| Файл | Значение |
|---|---|
| `data/characters/index.json` | "Вэй У**сь**янь" |
| `content/names.json` | "Вэй У**с**янь" |

Разное написание одного персонажа в двух файлах. `index.json` — каноническая версия (используется кодом), `names.json` — осиротевший файл.

### DATA-02: `character-appearances.json` пуст

Файл содержит `[]`, хотя блоки существуют с character links. Либо пайплайн не запускался после последнего рефакторинга, либо файл был сброшен.

### DATA-03: `parser-rules.json` — transform `normalize_zaveta`

```json
{
  "find": "\\bzaveta\\b",
  "replace": "zavet",
  "flags": "g"
}
```

Этот transform используется только в `parser.js`, который не используется. В `process.js` автор `zavet`/`zaveta` обрабатывается через `loadAuthors()`, где `names` содержат оба варианта. Transform мёртвый.

### DATA-04: `parser-rules.json` — author_block pattern не соответствует формату

Regex в `author_block` ожидает `[Author datetime]`, но реальный формат Telegram — `[datetime] Author: text`. Это делает pattern бесполезным для `process.js` (который использует свой `HEADER_RX`). Pattern работает только для `parser.js`, который не используется.

### DATA-05: `example_char.json` — шаблон с реальными данными

Файл содержит пример персонажа с `id: "example"` и шаблонными `relations`, `scenes`. Используется как fallback в `character.js:89` — при 404 на реальном файле персонажа. Смешение тестовых и production данных.

---

## 10. Общие выводы

### Что хорошо

- Чистая архитектура pipeline: контент → блоки → рендер
- Нулевые внешние зависимости (кроме Google Fonts)
- Дизайн-токены через CSS custom properties
- Разумное разделение на модули
- `process.js` — солидный скрипт обработки с продуманной логикой (lastSeen для кланов, longest-first matching)
- Тёмная тема с blue-light filter — продуманный UX

### Что требует внимания

| Приоритет | Тема | Действие |
|---|---|---|
| **Высокий** | CSS syntax errors (BUG-01) | Удалить лишние `}` в 3 файлах |
| **Высокий** | Null references (BUG-02, BUG-03) | Добавить null checks |
| **Средний** | Мёртвый код (parser.js, wrapNames, names.json) | Решить: удалить или интегрировать |
| **Средний** | Fake data fallback (BUG-04) | Показывать «нет данных» вместо example |
| **Средний** | Shared styles в reader.css (CSS-01) | Вынести в common/shared |
| **Средний** | innerHTML без санитизации (SEC-01) | Подготовить к переходу на бэкенд |
| **Низкий** | Tooltip delay 2s (QA-04) | Уменьшить до 300-500ms |
| **Низкий** | Accessibility (HTML-02) | Добавить aria-labels |
| **Низкий** | Performance (PERF-01, PERF-02) | Отложить до масштабирования |
| **Info** | Расхождение имён (DATA-01) | Привести к единому написанию |
| **Info** | Пустой appearances (DATA-02) | Перезапустить pipeline |

### Метрики кодбазы

| Метрика | Значение |
|---|---|
| JS-файлы | 6 (5 frontend + 1 build script) |
| CSS-файлы | 4 |
| HTML-файлы | 3 |
| JSON-конфигов | 5 |
| Блоков контента | 48 |
| Персонажей | 30 |
| Общий объём JS | ~1160 строк |
| Общий объём CSS | ~795 строк |
| Внешние зависимости | 0 (Google Fonts через CDN) |
