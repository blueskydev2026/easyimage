import './styles.css';
import { createState, getActivePhoto, sortPhotos } from './state.js';
import { bindFileOpening, fileToPhoto, openWithLaunchQueue } from './files.js';
import { renderCanvas, renderThumb, exportActivePhoto } from './image-engine.js';
import { openPrintDialog, renderPrintPreview } from './print.js';
import { $, createEl, formatBytes, isTypingTarget, naturalCompare, toast } from './utils.js';

const app = $('#app');
const state = createState();
let currentRenderToken = 0;
let beforeInstallPrompt = null;

app.innerHTML = `
  <div class="shell">
    <header class="topbar">
      <div class="brand">
        <span class="brand-mark" aria-hidden="true"></span>
        <div>
          <strong>EasyImage</strong>
          <small>צפייה, עריכה והדפסה מקומית</small>
        </div>
      </div>
      <div class="top-actions">
        <button id="openFolder" class="primary">פתיחת תיקייה</button>
        <button id="openFiles">בחירת תמונות</button>
        <button id="installApp" hidden>התקנה</button>
        <button id="themeToggle" aria-pressed="false">מצב בהיר</button>
      </div>
    </header>

    <main class="workspace">
      <aside class="library" aria-label="רשימת תמונות">
        <div class="library-tools">
          <input id="searchInput" type="search" placeholder="חיפוש בשם קובץ" aria-label="חיפוש בשם קובץ" />
          <select id="sortSelect" aria-label="מיון">
            <option value="name-asc">שם עולה</option>
            <option value="name-desc">שם יורד</option>
            <option value="date-desc">תאריך חדש</option>
            <option value="date-asc">תאריך ישן</option>
            <option value="size-desc">גודל גדול</option>
            <option value="type-asc">סוג קובץ</option>
          </select>
        </div>
        <div class="selection-tools">
          <button id="selectAll">בחר הכל</button>
          <button id="clearSelection">נקה בחירה</button>
        </div>
        <div id="photoList" class="photo-list" role="listbox" aria-label="תמונות"></div>
      </aside>

      <section class="viewer" aria-label="תצוגת תמונה">
        <div id="emptyState" class="empty-state">
          <div class="empty-visual" aria-hidden="true"></div>
          <h1>EasyImage</h1>
          <p>פתח תיקייה או בחר תמונות כדי להתחיל לעבוד. כל העיבוד נשאר במכשיר.</p>
          <div class="empty-actions">
            <button id="emptyFolder" class="primary">פתיחת תיקייה</button>
            <button id="emptyFiles">בחירת תמונות</button>
          </div>
        </div>

        <div id="imageStage" class="image-stage" hidden>
          <button id="prevPhoto" class="nav-button nav-prev" aria-label="תמונה קודמת">‹</button>
          <canvas id="mainCanvas" aria-label="התמונה הפעילה"></canvas>
          <button id="nextPhoto" class="nav-button nav-next" aria-label="תמונה הבאה">›</button>
          <div class="zoom-strip">
            <button id="zoomOut" aria-label="הקטנה">−</button>
            <button id="fitZoom">התאם</button>
            <button id="actualZoom">100%</button>
            <button id="zoomIn" aria-label="הגדלה">+</button>
          </div>
        </div>
      </section>

      <aside class="inspector" aria-label="כלים">
        <div class="mode-switch" role="group" aria-label="מצב עבודה">
          <button id="viewMode" aria-pressed="true">צפייה</button>
          <button id="editMode" aria-pressed="false">עריכה</button>
        </div>
        <section class="panel">
          <h2>מידע</h2>
          <dl id="metaPanel"></dl>
        </section>
        <section id="editPanel" class="panel" hidden>
          <h2>עריכה</h2>
          <div class="tool-grid">
            <button data-action="rotate-left">סובב שמאלה</button>
            <button data-action="rotate-right">סובב ימינה</button>
            <button data-action="flip-x">היפוך אופקי</button>
            <button data-action="flip-y">היפוך אנכי</button>
          </div>
          <label>בהירות <input data-filter="brightness" type="range" min="-100" max="100" value="0" /></label>
          <label>ניגודיות <input data-filter="contrast" type="range" min="-100" max="100" value="0" /></label>
          <label>רוויה <input data-filter="saturation" type="range" min="-100" max="100" value="0" /></label>
          <label>חדות <input data-filter="sharpness" type="range" min="0" max="100" value="0" /></label>
          <div class="tool-grid">
            <button id="undoEdit">Undo</button>
            <button id="redoEdit">Redo</button>
            <button id="resetEdit">איפוס</button>
            <button id="compareEdit" aria-pressed="false">לפני/אחרי</button>
          </div>
        </section>
        <section class="panel">
          <h2>פעולות</h2>
          <div class="tool-grid">
            <button id="saveAs">שמירה בשם</button>
            <button id="copyImage">העתקה</button>
            <button id="shareImage">שיתוף</button>
            <button id="printImage">הדפסה</button>
            <button id="renamePhoto">שינוי שם</button>
            <button id="removePhoto">הסרה</button>
          </div>
        </section>
      </aside>
    </main>

    <dialog id="printDialog" class="dialog">
      <form method="dialog" class="dialog-shell">
        <header>
          <h2>מנהל הדפסה</h2>
          <button value="cancel" aria-label="סגירה">×</button>
        </header>
        <div class="print-layout">
          <div class="print-controls">
            <label>מצב
              <select id="printMode">
                <option value="quick">הדפסה מהירה</option>
                <option value="size">גודל מדויק</option>
                <option value="grid">מספר תמונות בדף</option>
                <option value="copies">מספר עותקים</option>
              </select>
            </label>
            <label>כיוון
              <select id="printOrientation">
                <option value="portrait">לאורך</option>
                <option value="landscape">לרוחב</option>
              </select>
            </label>
            <label>עמודות <input id="printCols" type="number" min="1" max="6" value="2" /></label>
            <label>שורות <input id="printRows" type="number" min="1" max="8" value="2" /></label>
            <label>עותקים <input id="printCopies" type="number" min="1" max="64" value="4" /></label>
            <label><input id="printNames" type="checkbox" /> הדפס שמות קבצים</label>
            <button id="runPrint" value="default" class="primary">הדפס</button>
          </div>
          <div id="printPreview" class="print-preview" aria-label="תצוגה מקדימה"></div>
        </div>
      </form>
    </dialog>

    <div id="status" class="status" aria-live="polite"></div>
    <input id="fileInput" type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/bmp,image/avif" multiple hidden />
  </div>
`;

const els = {
  fileInput: $('#fileInput'),
  openFiles: $('#openFiles'),
  emptyFiles: $('#emptyFiles'),
  openFolder: $('#openFolder'),
  emptyFolder: $('#emptyFolder'),
  list: $('#photoList'),
  empty: $('#emptyState'),
  stage: $('#imageStage'),
  canvas: $('#mainCanvas'),
  meta: $('#metaPanel'),
  status: $('#status'),
  search: $('#searchInput'),
  sort: $('#sortSelect'),
  editPanel: $('#editPanel'),
  viewMode: $('#viewMode'),
  editMode: $('#editMode'),
  install: $('#installApp'),
  theme: $('#themeToggle'),
};

bindFileOpening({ state, onLoaded: updateAll, onMessage: message });
openWithLaunchQueue({ state, onLoaded: updateAll, onMessage: message });

els.openFiles.addEventListener('click', () => els.fileInput.click());
els.emptyFiles.addEventListener('click', () => els.fileInput.click());
els.fileInput.addEventListener('change', async () => loadFiles([...els.fileInput.files]));
els.openFolder.addEventListener('click', openFolder);
els.emptyFolder.addEventListener('click', openFolder);
els.search.addEventListener('input', updateList);
els.sort.addEventListener('change', () => {
  state.sort = els.sort.value;
  sortPhotos(state);
  updateAll();
});

$('#selectAll').addEventListener('click', () => {
  state.photos.forEach((photo) => state.selected.add(photo.id));
  updateList();
});
$('#clearSelection').addEventListener('click', () => {
  state.selected.clear();
  updateList();
});

$('#prevPhoto').addEventListener('click', () => navigate(-1));
$('#nextPhoto').addEventListener('click', () => navigate(1));
$('#zoomIn').addEventListener('click', () => setZoom(state.zoom * 1.2));
$('#zoomOut').addEventListener('click', () => setZoom(state.zoom / 1.2));
$('#fitZoom').addEventListener('click', () => setZoom(0));
$('#actualZoom').addEventListener('click', () => setZoom(1));
els.canvas.addEventListener('dblclick', () => setZoom(state.zoom === 1 ? 0 : 1));
els.canvas.addEventListener('wheel', (event) => {
  event.preventDefault();
  setZoom(state.zoom || 1 * (event.deltaY > 0 ? 0.9 : 1.1));
}, { passive: false });

els.viewMode.addEventListener('click', () => setMode('view'));
els.editMode.addEventListener('click', () => setMode('edit'));
$('#saveAs').addEventListener('click', saveAs);
$('#copyImage').addEventListener('click', copyImage);
$('#shareImage').addEventListener('click', shareImage);
$('#printImage').addEventListener('click', () => openPrintDialog(state));
$('#renamePhoto').addEventListener('click', renameActive);
$('#removePhoto').addEventListener('click', removeActive);
$('#undoEdit').addEventListener('click', () => historyMove(-1));
$('#redoEdit').addEventListener('click', () => historyMove(1));
$('#resetEdit').addEventListener('click', resetEdit);
$('#compareEdit').addEventListener('pointerdown', () => state.compare = true);
$('#compareEdit').addEventListener('pointerup', () => { state.compare = false; renderActive(); });
$('#compareEdit').addEventListener('pointerleave', () => { state.compare = false; renderActive(); });

document.querySelectorAll('[data-action]').forEach((button) => {
  button.addEventListener('click', () => applyAction(button.dataset.action));
});
document.querySelectorAll('[data-filter]').forEach((input) => {
  input.addEventListener('input', () => {
    const photo = getActivePhoto(state);
    if (!photo) return;
    photo.edits.filters[input.dataset.filter] = Number(input.value);
    photo.dirty = true;
    renderActive();
    updateMeta();
  });
  input.addEventListener('change', pushHistory);
});

['printMode', 'printOrientation', 'printCols', 'printRows', 'printCopies', 'printNames'].forEach((id) => {
  $(`#${id}`).addEventListener('input', () => renderPrintPreview(state));
});
$('#runPrint').addEventListener('click', (event) => {
  event.preventDefault();
  window.print();
});

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  beforeInstallPrompt = event;
  els.install.hidden = false;
});
els.install.addEventListener('click', async () => {
  if (!beforeInstallPrompt) return;
  beforeInstallPrompt.prompt();
  await beforeInstallPrompt.userChoice;
  beforeInstallPrompt = null;
  els.install.hidden = true;
});

els.theme.addEventListener('click', () => {
  state.lightTheme = !state.lightTheme;
  document.documentElement.classList.toggle('light', state.lightTheme);
  els.theme.textContent = state.lightTheme ? 'מצב כהה' : 'מצב בהיר';
  els.theme.setAttribute('aria-pressed', String(state.lightTheme));
  localStorage.setItem('easyimage.theme', state.lightTheme ? 'light' : 'dark');
});

window.addEventListener('keydown', (event) => {
  if (isTypingTarget(event.target)) return;
  const mod = event.ctrlKey || event.metaKey;
  if (event.key === 'ArrowLeft') navigate(1);
  if (event.key === 'ArrowRight') navigate(-1);
  if (event.key === 'Home') setActive(0);
  if (event.key === 'End') setActive(state.photos.length - 1);
  if (event.key === '+') setZoom((state.zoom || 1) * 1.2);
  if (event.key === '-') setZoom((state.zoom || 1) / 1.2);
  if (event.key === '0' || event.key.toLowerCase() === 'f') setZoom(0);
  if (event.key.toLowerCase() === 'e') setMode(state.mode === 'edit' ? 'view' : 'edit');
  if (event.key.toLowerCase() === 'r' && !event.shiftKey) applyAction('rotate-right');
  if (event.key.toLowerCase() === 'r' && event.shiftKey) applyAction('rotate-left');
  if (mod && event.key.toLowerCase() === 's') {
    event.preventDefault();
    saveAs();
  }
  if (mod && event.key.toLowerCase() === 'c') {
    event.preventDefault();
    copyImage();
  }
  if (mod && event.key.toLowerCase() === 'p') {
    event.preventDefault();
    openPrintDialog(state);
  }
  if (mod && event.key.toLowerCase() === 'z' && !event.shiftKey) historyMove(-1);
  if ((mod && event.key.toLowerCase() === 'y') || (mod && event.shiftKey && event.key.toLowerCase() === 'z')) historyMove(1);
  if (event.key === 'Delete') removeActive();
});

const appBase = import.meta.env.BASE_URL;

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register(`${appBase}sw.js`).catch(() => message('לא ניתן היה לרשום Service Worker'));
}

if (localStorage.getItem('easyimage.theme') === 'light') {
  els.theme.click();
}

async function loadFiles(files) {
  const images = files.filter((file) => file.type.startsWith('image/'));
  const photos = await Promise.all(images.map(fileToPhoto));
  state.photos.push(...photos);
  sortPhotos(state);
  if (state.activeId === null && photos[0]) state.activeId = photos[0].id;
  updateAll();
  message(`${photos.length} תמונות נטענו`);
}

async function openFolder() {
  if (!window.showDirectoryPicker) {
    message('פתיחת תיקייה נתמכת בדפדפני Chromium. אפשר לבחור מספר תמונות במקום.');
    els.fileInput.click();
    return;
  }
  try {
    const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
    const files = [];
    for await (const entry of handle.values()) {
      if (entry.kind === 'file') {
        const file = await entry.getFile();
        if (file.type.startsWith('image/')) files.push(file);
      }
    }
    await loadFiles(files);
  } catch (error) {
    if (error.name !== 'AbortError') message('פתיחת התיקייה נכשלה');
  }
}

function updateAll() {
  updateList();
  updateMeta();
  renderActive();
}

function visiblePhotos() {
  const query = els.search.value.trim();
  return state.photos.filter((photo) => !query || naturalCompare.includes(photo.name, query));
}

function updateList() {
  els.list.replaceChildren();
  const photos = visiblePhotos();
  photos.forEach((photo, index) => {
    const item = createEl('button', {
      className: `thumb ${photo.id === state.activeId ? 'active' : ''}`,
      role: 'option',
      'aria-selected': String(photo.id === state.activeId),
    });
    const checkbox = createEl('input', { type: 'checkbox', checked: state.selected.has(photo.id), 'aria-label': `בחר ${photo.name}` });
    const canvas = createEl('canvas');
    const name = createEl('span', { textContent: photo.name });
    const meta = createEl('small', { textContent: `${formatBytes(photo.size)} · ${photo.type.split('/').pop() || 'image'}` });
    checkbox.addEventListener('click', (event) => {
      event.stopPropagation();
      toggleSelection(photo.id, event.shiftKey);
    });
    item.addEventListener('click', (event) => {
      if (event.ctrlKey || event.metaKey || event.shiftKey) toggleSelection(photo.id, event.shiftKey);
      else {
        state.activeId = photo.id;
        state.lastSelectedId = photo.id;
        updateAll();
      }
    });
    item.append(checkbox, canvas, name, meta);
    els.list.append(item);
    renderThumb(photo, canvas);
  });
}

function toggleSelection(id, range) {
  if (range && state.lastSelectedId) {
    const ids = visiblePhotos().map((photo) => photo.id);
    const a = ids.indexOf(state.lastSelectedId);
    const b = ids.indexOf(id);
    ids.slice(Math.min(a, b), Math.max(a, b) + 1).forEach((photoId) => state.selected.add(photoId));
  } else if (state.selected.has(id)) {
    state.selected.delete(id);
  } else {
    state.selected.add(id);
  }
  state.lastSelectedId = id;
  updateList();
}

function updateMeta() {
  const photo = getActivePhoto(state);
  els.meta.replaceChildren();
  if (!photo) return;
  const pairs = [
    ['שם', photo.name],
    ['גודל קובץ', formatBytes(photo.size)],
    ['סוג', photo.type || 'לא ידוע'],
    ['תאריך', photo.lastModified ? new Date(photo.lastModified).toLocaleString('he-IL') : 'לא ידוע'],
    ['עריכות', photo.dirty ? 'יש שינויים שלא נשמרו' : 'ללא שינויים'],
  ];
  for (const [key, value] of pairs) {
    els.meta.append(createEl('dt', { textContent: key }), createEl('dd', { textContent: value }));
  }
}

async function renderActive() {
  const photo = getActivePhoto(state);
  els.empty.hidden = Boolean(photo);
  els.stage.hidden = !photo;
  if (!photo) return;
  const token = ++currentRenderToken;
  await renderCanvas(photo, els.canvas, { compare: state.compare, zoom: state.zoom });
  if (token !== currentRenderToken) return;
}

function setActive(index) {
  if (!state.photos[index]) return;
  state.activeId = state.photos[index].id;
  updateAll();
}

function navigate(delta) {
  const index = state.photos.findIndex((photo) => photo.id === state.activeId);
  setActive(Math.max(0, Math.min(state.photos.length - 1, index + delta)));
}

function setZoom(value) {
  state.zoom = value === 0 ? 0 : Math.max(0.1, Math.min(8, value));
  renderActive();
}

function setMode(mode) {
  state.mode = mode;
  els.viewMode.setAttribute('aria-pressed', String(mode === 'view'));
  els.editMode.setAttribute('aria-pressed', String(mode === 'edit'));
  els.editPanel.hidden = mode !== 'edit';
}

function applyAction(action) {
  const photo = getActivePhoto(state);
  if (!photo) return;
  pushHistory();
  if (action === 'rotate-right') photo.edits.rotation = (photo.edits.rotation + 90) % 360;
  if (action === 'rotate-left') photo.edits.rotation = (photo.edits.rotation + 270) % 360;
  if (action === 'flip-x') photo.edits.flipX = !photo.edits.flipX;
  if (action === 'flip-y') photo.edits.flipY = !photo.edits.flipY;
  photo.dirty = true;
  updateAll();
}

function pushHistory() {
  const photo = getActivePhoto(state);
  if (!photo) return;
  photo.history = photo.history.slice(0, photo.historyIndex + 1);
  photo.history.push(JSON.stringify(photo.edits));
  photo.historyIndex = photo.history.length - 1;
}

function historyMove(delta) {
  const photo = getActivePhoto(state);
  if (!photo) return;
  const next = photo.historyIndex + delta;
  if (next < 0 || next >= photo.history.length) return;
  photo.historyIndex = next;
  photo.edits = JSON.parse(photo.history[next]);
  photo.dirty = true;
  syncSliders(photo);
  updateAll();
}

function resetEdit() {
  const photo = getActivePhoto(state);
  if (!photo) return;
  pushHistory();
  photo.edits = createState().emptyEdits();
  photo.dirty = true;
  syncSliders(photo);
  updateAll();
}

function syncSliders(photo) {
  document.querySelectorAll('[data-filter]').forEach((input) => {
    input.value = photo.edits.filters[input.dataset.filter] ?? 0;
  });
}

async function saveAs() {
  const photo = getActivePhoto(state);
  if (!photo) return;
  const blob = await exportActivePhoto(photo, 'image/png', 0.92);
  const name = photo.name.replace(/\.[^.]+$/, '') + '-easyimage.png';
  const url = URL.createObjectURL(blob);
  const link = createEl('a', { href: url, download: name });
  link.click();
  URL.revokeObjectURL(url);
  photo.dirty = false;
  updateMeta();
  message('התמונה נשמרה בשם חדש');
}

async function copyImage() {
  const photo = getActivePhoto(state);
  if (!photo || !navigator.clipboard || !window.ClipboardItem) {
    message('העתקת תמונה אינה נתמכת בדפדפן הזה');
    return;
  }
  const blob = await exportActivePhoto(photo, 'image/png', 0.92);
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
  message('התמונה הועתקה');
}

async function shareImage() {
  const photo = getActivePhoto(state);
  if (!photo || !navigator.share) {
    message('שיתוף אינו נתמך במכשיר הזה');
    return;
  }
  const blob = await exportActivePhoto(photo, photo.type || 'image/png', 0.9);
  const file = new File([blob], photo.name, { type: blob.type });
  await navigator.share({ files: [file], title: photo.name });
}

function renameActive() {
  const photo = getActivePhoto(state);
  if (!photo) return;
  const next = prompt('שם חדש', photo.name);
  if (!next || next === photo.name) return;
  if (state.photos.some((item) => item.id !== photo.id && item.name === next)) {
    message('כבר קיימת תמונה בשם הזה');
    return;
  }
  photo.name = next;
  updateAll();
  message('השם עודכן ברשימה');
}

function removeActive() {
  const photo = getActivePhoto(state);
  if (!photo) return;
  if (photo.dirty && !confirm('יש שינויים שלא נשמרו. להסיר מהרשימה?')) return;
  if (!confirm(`להסיר את ${photo.name} מהרשימה? הקובץ המקורי לא יימחק.`)) return;
  const index = state.photos.findIndex((item) => item.id === photo.id);
  state.photos.splice(index, 1);
  state.selected.delete(photo.id);
  state.activeId = state.photos[Math.min(index, state.photos.length - 1)]?.id ?? null;
  updateAll();
}

function message(text) {
  toast(els.status, text);
}
