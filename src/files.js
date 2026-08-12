import { makePhoto } from './state.js';

export async function fileToPhoto(file) {
  return makePhoto(file, URL.createObjectURL(file));
}

export function bindFileOpening({ state, onLoaded, onMessage }) {
  window.addEventListener('dragover', (event) => event.preventDefault());
  window.addEventListener('drop', async (event) => {
    event.preventDefault();
    const files = [...event.dataTransfer.files].filter((file) => file.type.startsWith('image/'));
    const photos = await Promise.all(files.map(fileToPhoto));
    state.photos.push(...photos);
    if (!state.activeId && photos[0]) state.activeId = photos[0].id;
    onLoaded();
    onMessage(`${photos.length} תמונות נוספו בגרירה`);
  });
}

export function openWithLaunchQueue({ state, onLoaded, onMessage }) {
  if (!('launchQueue' in window) || !('files' in LaunchParams.prototype)) return;
  window.launchQueue.setConsumer(async (launchParams) => {
    const files = [];
    for (const handle of launchParams.files) {
      const file = await handle.getFile();
      if (file.type.startsWith('image/')) files.push(file);
    }
    const photos = await Promise.all(files.map(fileToPhoto));
    state.photos.push(...photos);
    if (!state.activeId && photos[0]) state.activeId = photos[0].id;
    onLoaded();
    onMessage('קבצים נפתחו דרך מערכת ההפעלה');
  });
}
