import { getActivePhoto } from './state.js';

export function openPrintDialog(state) {
  const dialog = document.querySelector('#printDialog');
  renderPrintPreview(state);
  dialog.showModal();
}

export function renderPrintPreview(state) {
  const preview = document.querySelector('#printPreview');
  const active = getActivePhoto(state);
  preview.replaceChildren();
  if (!active) {
    preview.textContent = 'אין תמונה להדפסה';
    return;
  }
  const mode = document.querySelector('#printMode')?.value ?? 'quick';
  const cols = Number(document.querySelector('#printCols')?.value ?? 2);
  const rows = Number(document.querySelector('#printRows')?.value ?? 2);
  const copies = Number(document.querySelector('#printCopies')?.value ?? 4);
  const names = document.querySelector('#printNames')?.checked;
  const page = document.createElement('div');
  page.className = 'paper';
  if (mode === 'quick' || mode === 'size') {
    page.append(printItem(active, names));
  } else {
    const selected = state.photos.filter((photo) => state.selected.has(photo.id));
    const photos = mode === 'copies' ? Array.from({ length: copies }, () => active) : (selected.length ? selected : [active]);
    page.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    page.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
    photos.slice(0, cols * rows).forEach((photo) => page.append(printItem(photo, names)));
  }
  preview.append(page);
}

function printItem(photo, names) {
  const item = document.createElement('figure');
  item.className = 'print-item';
  const image = document.createElement('img');
  image.src = photo.sourceUrl;
  image.alt = photo.name;
  item.append(image);
  if (names) {
    const caption = document.createElement('figcaption');
    caption.textContent = photo.name;
    item.append(caption);
  }
  return item;
}
