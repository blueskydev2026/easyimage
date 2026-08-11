"use strict";

const $ = (id) => document.getElementById(id);
const imageExtensions = /\.(png|jpe?g|webp|gif|bmp|avif)$/i;

const state = {
  items: [],
  index: -1,
  image: null,
  bitmap: null,
  rotation: 0,
  zoom: 1,
  fitZoom: 1,
  panX: 0,
  panY: 0,
  dirty: false,
  cropMode: false,
  crop: null,
  draggingCanvas: false,
  dragStart: null,
  deferredInstall: null
};

const els = {
  openFolderBtn: $("openFolderBtn"),
  filePicker: $("filePicker"),
  installBtn: $("installBtn"),
  folderLabel: $("folderLabel"),
  countLabel: $("countLabel"),
  thumbList: $("thumbList"),
  canvas: $("imageCanvas"),
  dropZone: $("dropZone"),
  emptyState: $("emptyState"),
  cropOverlay: $("cropOverlay"),
  cropBox: $("cropBox"),
  fileLabel: $("fileLabel"),
  metaLabel: $("metaLabel"),
  statusLabel: $("statusLabel"),
  zoomLabel: $("zoomLabel"),
  renameInput: $("renameInput"),
  renameBtn: $("renameBtn"),
  batchPattern: $("batchPattern"),
  batchStart: $("batchStart"),
  batchSort: $("batchSort")
};

const ctx = els.canvas.getContext("2d", { alpha: true });

function setStatus(text) {
  els.statusLabel.textContent = text;
}

function currentItem() {
  return state.items[state.index] || null;
}

function formatDate(date) {
  const d = date instanceof Date ? date : new Date(date || Date.now());
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatTime(date) {
  const d = date instanceof Date ? date : new Date(date || Date.now());
  return `${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}${String(d.getSeconds()).padStart(2, "0")}`;
}

function splitName(name) {
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return { base: name, ext: "" };
  return { base: name.slice(0, dot), ext: name.slice(dot) };
}

function fileDate(item) {
  return new Date(item.file?.lastModified || item.lastModified || Date.now());
}

function bySort(mode) {
  if (mode === "name") return (a, b) => a.name.localeCompare(b.name, "he", { numeric: true });
  if (mode === "time") return (a, b) => formatTime(fileDate(a)).localeCompare(formatTime(fileDate(b))) || a.name.localeCompare(b.name, "he", { numeric: true });
  return (a, b) => (fileDate(a) - fileDate(b)) || a.name.localeCompare(b.name, "he", { numeric: true });
}

async function loadFolder() {
  if (!window.showDirectoryPicker) {
    setStatus("הדפדפן לא תומך בפתיחת תיקייה. השתמשו בבחירת תמונות או גרירה.");
    els.filePicker.click();
    return;
  }

  try {
    const dirHandle = await window.showDirectoryPicker({ mode: "readwrite" });
    const loaded = [];
    for await (const [name, handle] of dirHandle.entries()) {
      if (handle.kind === "file" && imageExtensions.test(name)) {
        const file = await handle.getFile();
        loaded.push({
          id: crypto.randomUUID(),
          name,
          handle,
          directoryHandle: dirHandle,
          file,
          url: URL.createObjectURL(file),
          lastModified: file.lastModified
        });
      }
    }
    loaded.sort(bySort("name"));
    replaceItems(loaded, dirHandle.name || "תיקייה מקומית");
  } catch (error) {
    if (error.name !== "AbortError") setStatus(`שגיאה בפתיחת תיקייה: ${error.message}`);
  }
}

function loadFiles(fileList, label = "תמונות שנבחרו") {
  const files = Array.from(fileList).filter((file) => file.type.startsWith("image/") || imageExtensions.test(file.name));
  const loaded = files.map((file) => ({
    id: crypto.randomUUID(),
    name: file.name,
    file,
    url: URL.createObjectURL(file),
    lastModified: file.lastModified
  })).sort(bySort("name"));
  replaceItems(loaded, label);
}

function replaceItems(items, label) {
  cleanupUrls();
  state.items = items;
  state.index = items.length ? 0 : -1;
  state.rotation = 0;
  state.dirty = false;
  els.folderLabel.textContent = label;
  els.countLabel.textContent = String(items.length);
  renderThumbs();
  if (items.length) selectImage(0);
  else clearViewer();
}

function cleanupUrls() {
  for (const item of state.items) {
    if (item.url) URL.revokeObjectURL(item.url);
  }
}

function clearViewer() {
  state.image = null;
  state.bitmap = null;
  els.emptyState.hidden = false;
  els.fileLabel.textContent = "אין תמונה פתוחה";
  els.metaLabel.textContent = "";
  els.renameInput.value = "";
  draw();
}

async function selectImage(index) {
  if (index < 0 || index >= state.items.length) return;
  state.index = index;
  state.rotation = 0;
  state.dirty = false;
  state.cropMode = false;
  hideCrop();
  const item = currentItem();
  try {
    item.file = item.handle ? await item.handle.getFile() : item.file;
    if (item.url) URL.revokeObjectURL(item.url);
    item.url = URL.createObjectURL(item.file);
    state.bitmap = await createImageBitmap(item.file);
    state.image = state.bitmap;
    resetView();
    els.emptyState.hidden = true;
    els.fileLabel.textContent = item.name;
    els.renameInput.value = item.name;
    els.metaLabel.textContent = `${state.image.width}×${state.image.height} | ${Math.round(item.file.size / 1024)}KB | ${formatDate(fileDate(item))}`;
    renderThumbs();
    setStatus(`${index + 1} מתוך ${state.items.length}`);
  } catch (error) {
    setStatus(`לא ניתן לפתוח תמונה: ${error.message}`);
  }
}

function renderThumbs() {
  els.thumbList.textContent = "";
  const frag = document.createDocumentFragment();
  state.items.forEach((item, index) => {
    const button = document.createElement("button");
    button.className = `thumb${index === state.index ? " active" : ""}`;
    button.type = "button";
    button.title = item.name;
    button.addEventListener("click", () => selectImage(index));
    const img = document.createElement("img");
    img.src = item.url;
    img.alt = "";
    const span = document.createElement("span");
    span.textContent = item.name;
    button.append(img, span);
    frag.append(button);
  });
  els.thumbList.append(frag);
  const active = els.thumbList.querySelector(".active");
  active?.scrollIntoView({ block: "nearest" });
}

function resetView() {
  const stage = els.dropZone.getBoundingClientRect();
  const size = rotatedSize();
  state.fitZoom = Math.min(stage.width / size.width, stage.height / size.height, 1);
  state.zoom = state.fitZoom || 1;
  state.panX = 0;
  state.panY = 0;
  updateZoomLabel();
  draw();
}

function rotatedSize() {
  if (!state.image) return { width: 1, height: 1 };
  const quarter = Math.abs(state.rotation / 90) % 2 === 1;
  return {
    width: quarter ? state.image.height : state.image.width,
    height: quarter ? state.image.width : state.image.height
  };
}

function resizeCanvas() {
  const rect = els.dropZone.getBoundingClientRect();
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  els.canvas.width = Math.floor(rect.width * dpr);
  els.canvas.height = Math.floor(rect.height * dpr);
  els.canvas.style.width = `${rect.width}px`;
  els.canvas.style.height = `${rect.height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  draw();
}

function imageTransform() {
  const rect = els.dropZone.getBoundingClientRect();
  const size = rotatedSize();
  return {
    cx: rect.width / 2 + state.panX,
    cy: rect.height / 2 + state.panY,
    width: size.width * state.zoom,
    height: size.height * state.zoom
  };
}

function draw() {
  const rect = els.dropZone.getBoundingClientRect();
  ctx.clearRect(0, 0, rect.width, rect.height);
  if (!state.image) return;

  const t = imageTransform();
  ctx.save();
  ctx.translate(t.cx, t.cy);
  ctx.rotate((state.rotation * Math.PI) / 180);
  ctx.scale(state.zoom, state.zoom);
  ctx.drawImage(state.image, -state.image.width / 2, -state.image.height / 2);
  ctx.restore();
  syncCropOverlay();
}

function updateZoomLabel() {
  els.zoomLabel.textContent = `${Math.round(state.zoom * 100)}%`;
}

function zoomBy(factor, clientX, clientY) {
  if (!state.image) return;
  const rect = els.canvas.getBoundingClientRect();
  const x = clientX ?? rect.left + rect.width / 2;
  const y = clientY ?? rect.top + rect.height / 2;
  const before = { x: x - rect.left - rect.width / 2 - state.panX, y: y - rect.top - rect.height / 2 - state.panY };
  const next = Math.min(8, Math.max(0.05, state.zoom * factor));
  const ratio = next / state.zoom;
  state.panX -= before.x * (ratio - 1);
  state.panY -= before.y * (ratio - 1);
  state.zoom = next;
  updateZoomLabel();
  draw();
}

function move(delta) {
  if (!state.items.length) return;
  const next = (state.index + delta + state.items.length) % state.items.length;
  selectImage(next);
}

async function rotate(degrees) {
  if (!state.image) return;
  state.rotation = (state.rotation + degrees + 360) % 360;
  state.dirty = true;
  resetView();
  setStatus("סיבוב הוחל. לחצו שמור כדי לכתוב לקובץ.");
}

function canvasFromCurrent(cropRect = null) {
  if (!state.image) return null;
  const source = document.createElement("canvas");
  const sourceCtx = source.getContext("2d");
  const size = rotatedSize();
  source.width = size.width;
  source.height = size.height;
  sourceCtx.translate(size.width / 2, size.height / 2);
  sourceCtx.rotate((state.rotation * Math.PI) / 180);
  sourceCtx.drawImage(state.image, -state.image.width / 2, -state.image.height / 2);

  if (!cropRect) return source;
  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(cropRect.width));
  out.height = Math.max(1, Math.round(cropRect.height));
  out.getContext("2d").drawImage(source, cropRect.x, cropRect.y, cropRect.width, cropRect.height, 0, 0, out.width, out.height);
  return out;
}

function canvasToBlob(canvas, type = "image/png", quality = 0.92) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

async function saveImage() {
  const item = currentItem();
  if (!item || !state.image) return;

  const canvas = canvasFromCurrent();
  const type = item.file?.type && item.file.type !== "image/gif" ? item.file.type : "image/png";
  const blob = await canvasToBlob(canvas, type);

  try {
    if (item.handle?.createWritable) {
      const writable = await item.handle.createWritable();
      await writable.write(blob);
      await writable.close();
      item.file = await item.handle.getFile();
      state.bitmap = await createImageBitmap(item.file);
      state.image = state.bitmap;
      state.rotation = 0;
      state.dirty = false;
      resetView();
      setStatus("נשמר לקובץ המקורי");
    } else {
      downloadBlob(blob, item.name);
      setStatus("הורדה נוצרה. לשמירה ישירה פתחו תיקייה בדפדפן תומך.");
    }
  } catch (error) {
    setStatus(`שמירה נכשלה: ${error.message}`);
  }
}

async function writeBlobToHandle(handle, blob) {
  const writable = await handle.createWritable();
  await writable.write(blob);
  await writable.close();
}

async function renameItem(item, nextName) {
  if (!item.directoryHandle || !item.handle) {
    item.name = nextName;
    return false;
  }

  if (typeof item.handle.move === "function") {
    try {
      await item.directoryHandle.getFileHandle(nextName);
      throw new Error("כבר קיים קובץ בשם הזה");
    } catch (error) {
      if (error.name !== "NotFoundError") throw error;
    }
    await item.handle.move(nextName);
  } else {
    const file = await item.handle.getFile();
    try {
      await item.directoryHandle.getFileHandle(nextName);
      throw new Error("כבר קיים קובץ בשם הזה");
    } catch (error) {
      if (error.name !== "NotFoundError") throw error;
    }
    const nextHandle = await item.directoryHandle.getFileHandle(nextName, { create: true });
    await writeBlobToHandle(nextHandle, file);
    await item.directoryHandle.removeEntry(item.name);
  }

  item.name = nextName;
  item.handle = await item.directoryHandle.getFileHandle(nextName);
  item.file = await item.handle.getFile();
  if (item.url) URL.revokeObjectURL(item.url);
  item.url = URL.createObjectURL(item.file);
  return true;
}

function downloadBlob(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function copyCanvas(canvas) {
  if (!navigator.clipboard || !window.ClipboardItem) {
    setStatus("הדפדפן לא מאפשר העתקת תמונה ללוח.");
    return;
  }
  const blob = await canvasToBlob(canvas, "image/png");
  await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
  setStatus("התמונה הועתקה ללוח. אפשר להדביק במייל.");
}

async function copyImage() {
  const canvas = canvasFromCurrent();
  if (canvas) await copyCanvas(canvas);
}

function beginCrop() {
  if (!state.image) return;
  state.cropMode = true;
  const t = imageTransform();
  const w = Math.max(80, t.width * 0.55);
  const h = Math.max(80, t.height * 0.55);
  state.crop = { x: t.cx - w / 2, y: t.cy - h / 2, width: w, height: h };
  els.cropOverlay.hidden = false;
  syncCropOverlay();
}

function hideCrop() {
  els.cropOverlay.hidden = true;
  state.cropMode = false;
  state.crop = null;
}

function syncCropOverlay() {
  if (!state.cropMode || !state.crop) return;
  Object.assign(els.cropBox.style, {
    right: "auto",
    left: `${state.crop.x}px`,
    top: `${state.crop.y}px`,
    width: `${state.crop.width}px`,
    height: `${state.crop.height}px`
  });
}

function cropScreenToImage() {
  if (!state.crop || !state.image) return null;
  const t = imageTransform();
  const size = rotatedSize();
  const x = (state.crop.x - (t.cx - t.width / 2)) / state.zoom;
  const y = (state.crop.y - (t.cy - t.height / 2)) / state.zoom;
  return {
    x: Math.max(0, Math.min(size.width, x)),
    y: Math.max(0, Math.min(size.height, y)),
    width: Math.max(1, Math.min(size.width - x, state.crop.width / state.zoom)),
    height: Math.max(1, Math.min(size.height - y, state.crop.height / state.zoom))
  };
}

async function applyCrop() {
  const rect = cropScreenToImage();
  if (!rect) return;
  const canvas = canvasFromCurrent(rect);
  const blob = await canvasToBlob(canvas, "image/png");
  state.bitmap = await createImageBitmap(blob);
  state.image = state.bitmap;
  state.rotation = 0;
  state.dirty = true;
  hideCrop();
  resetView();
  setStatus("חיתוך הוחל. לחצו שמור כדי לכתוב לקובץ.");
}

async function copyCrop() {
  const rect = cropScreenToImage();
  if (!rect) return;
  await copyCanvas(canvasFromCurrent(rect));
}

async function renameCurrent() {
  const item = currentItem();
  if (!item) return;
  const nextName = els.renameInput.value.trim();
  if (!nextName || nextName === item.name) return;

  try {
    const renamedOnDisk = await renameItem(item, nextName);
    if (!renamedOnDisk) {
      setStatus("שם עודכן באפליקציה. שינוי שם אמיתי דורש פתיחת תיקייה בדפדפן תומך.");
    }
    els.fileLabel.textContent = item.name;
    renderThumbs();
    setStatus("שם הקובץ שונה");
  } catch (error) {
    setStatus(`שינוי שם נכשל: ${error.message}`);
  }
}

async function batchRename() {
  if (!state.items.length) return;
  const pattern = els.batchPattern.value.trim() || "תמונה-{date}-{num}";
  const start = Math.max(1, Number(els.batchStart.value) || 1);
  const selectedId = currentItem()?.id;
  const sorted = [...state.items].sort(bySort(els.batchSort.value));
  const width = String(start + sorted.length - 1).length;

  for (let i = 0; i < sorted.length; i += 1) {
    const item = sorted[i];
    const { ext } = splitName(item.name);
    const date = fileDate(item);
    const nextName = `${pattern
      .replaceAll("{date}", formatDate(date))
      .replaceAll("{time}", formatTime(date))
      .replaceAll("{num}", String(start + i).padStart(width, "0"))}${ext}`;
    if (item.name === nextName) continue;
    await renameItem(item, nextName);
  }
  state.items.sort(bySort(els.batchSort.value));
  state.index = Math.max(0, state.items.findIndex((item) => item.id === selectedId));
  renderThumbs();
  if (currentItem()) {
    els.fileLabel.textContent = currentItem().name;
    els.renameInput.value = currentItem().name;
  }
  setStatus("שינוי השמות הקבוצתי הסתיים");
}

async function deleteCurrent() {
  const item = currentItem();
  if (!item) return;
  if (!confirm(`למחוק את ${item.name}?`)) return;
  try {
    if (item.directoryHandle) {
      await item.directoryHandle.removeEntry(item.name);
    }
    if (item.url) URL.revokeObjectURL(item.url);
    const oldIndex = state.index;
    state.items.splice(state.index, 1);
    els.countLabel.textContent = String(state.items.length);
    if (!state.items.length) {
      state.index = -1;
      renderThumbs();
      clearViewer();
    } else {
      await selectImage(Math.min(oldIndex, state.items.length - 1));
    }
    setStatus(item.directoryHandle ? "הקובץ נמחק" : "התמונה הוסרה מהרשימה");
  } catch (error) {
    setStatus(`מחיקה נכשלה: ${error.message}`);
  }
}

function sortItems(mode) {
  const selectedId = currentItem()?.id;
  state.items.sort(bySort(mode));
  state.index = Math.max(0, state.items.findIndex((item) => item.id === selectedId));
  renderThumbs();
}

function setupCropDrag() {
  let action = null;
  let start = null;

  els.cropBox.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    const cls = event.target.className || "";
    action = typeof cls === "string" && cls.includes("handle") ? cls.split(" ").find((x) => ["nw", "ne", "sw", "se"].includes(x)) : "move";
    start = { x: event.clientX, y: event.clientY, crop: { ...state.crop } };
    els.cropBox.setPointerCapture(event.pointerId);
  });

  els.cropBox.addEventListener("pointermove", (event) => {
    if (!action || !start || !state.crop) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    const c = { ...start.crop };
    const min = 30;

    if (action === "move") {
      c.x += dx;
      c.y += dy;
    } else {
      if (action.includes("n")) {
        c.y += dy;
        c.height -= dy;
      }
      if (action.includes("s")) c.height += dy;
      if (action.includes("e")) {
        c.x += dx;
        c.width -= dx;
      }
      if (action.includes("w")) c.width += dx;
    }

    if (c.width < min) c.width = min;
    if (c.height < min) c.height = min;
    const stage = els.dropZone.getBoundingClientRect();
    c.x = Math.max(0, Math.min(stage.width - c.width, c.x));
    c.y = Math.max(0, Math.min(stage.height - c.height, c.y));
    state.crop = c;
    syncCropOverlay();
  });

  els.cropBox.addEventListener("pointerup", () => {
    action = null;
    start = null;
  });
}

function setupDragDrop() {
  ["dragenter", "dragover"].forEach((name) => {
    els.dropZone.addEventListener(name, (event) => {
      event.preventDefault();
      els.dropZone.classList.add("dragging");
    });
  });
  ["dragleave", "drop"].forEach((name) => {
    els.dropZone.addEventListener(name, () => els.dropZone.classList.remove("dragging"));
  });
  els.dropZone.addEventListener("drop", (event) => {
    event.preventDefault();
    const files = Array.from(event.dataTransfer.files || []);
    if (files.length) loadFiles(files, "תמונות שנגררו");
  });
}

function setupCanvasPan() {
  els.canvas.draggable = true;
  els.canvas.addEventListener("dragstart", (event) => {
    const item = currentItem();
    if (!item) return;
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData("text/uri-list", item.url);
    event.dataTransfer.setData("text/plain", item.name);
    try {
      if (item.file) event.dataTransfer.items.add(item.file);
    } catch {
      // Some browsers only permit URL/text payloads for drags that leave the page.
    }
  });
  els.canvas.addEventListener("pointerdown", (event) => {
    if (!state.image || state.cropMode) return;
    state.draggingCanvas = true;
    state.dragStart = { x: event.clientX, y: event.clientY, panX: state.panX, panY: state.panY };
    els.canvas.setPointerCapture(event.pointerId);
  });
  els.canvas.addEventListener("pointermove", (event) => {
    if (!state.draggingCanvas || !state.dragStart) return;
    state.panX = state.dragStart.panX + event.clientX - state.dragStart.x;
    state.panY = state.dragStart.panY + event.clientY - state.dragStart.y;
    draw();
  });
  els.canvas.addEventListener("pointerup", () => {
    state.draggingCanvas = false;
    state.dragStart = null;
  });
  els.canvas.addEventListener("wheel", (event) => {
    event.preventDefault();
    zoomBy(event.deltaY < 0 ? 1.12 : 0.88, event.clientX, event.clientY);
  }, { passive: false });
}

function bindUi() {
  els.openFolderBtn.addEventListener("click", loadFolder);
  els.filePicker.addEventListener("change", (event) => loadFiles(event.target.files));
  $("prevBtn").addEventListener("click", () => move(-1));
  $("nextBtn").addEventListener("click", () => move(1));
  $("zoomInBtn").addEventListener("click", () => zoomBy(1.18));
  $("zoomOutBtn").addEventListener("click", () => zoomBy(0.82));
  $("fitBtn").addEventListener("click", resetView);
  $("rotateLeftBtn").addEventListener("click", () => rotate(-90));
  $("rotateRightBtn").addEventListener("click", () => rotate(90));
  $("saveBtn").addEventListener("click", saveImage);
  $("copyImageBtn").addEventListener("click", copyImage);
  $("cropBtn").addEventListener("click", beginCrop);
  $("applyCropBtn").addEventListener("click", applyCrop);
  $("cancelCropBtn").addEventListener("click", hideCrop);
  $("copyCropBtn").addEventListener("click", copyCrop);
  els.renameBtn.addEventListener("click", renameCurrent);
  els.renameInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") renameCurrent();
  });
  $("batchRenameBtn").addEventListener("click", batchRename);
  $("deleteBtn").addEventListener("click", deleteCurrent);
  $("sortNameBtn").addEventListener("click", () => sortItems("name"));
  $("sortDateBtn").addEventListener("click", () => sortItems("date"));
  $("sortTimeBtn").addEventListener("click", () => sortItems("time"));
  els.installBtn.addEventListener("click", async () => {
    if (!state.deferredInstall) return;
    state.deferredInstall.prompt();
    await state.deferredInstall.userChoice;
    state.deferredInstall = null;
    els.installBtn.hidden = true;
  });
}

function setupKeyboard() {
  window.addEventListener("keydown", (event) => {
    const editing = ["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement?.tagName);
    if (editing && !event.ctrlKey) return;
    if (event.key === "ArrowLeft") move(1);
    if (event.key === "ArrowRight") move(-1);
    if (event.key === "Delete") deleteCurrent();
    if (event.key.toLowerCase() === "f") resetView();
    if (event.key === "Escape") hideCrop();
    if (event.ctrlKey && event.key.toLowerCase() === "s") {
      event.preventDefault();
      saveImage();
    }
    if (event.ctrlKey && event.key.toLowerCase() === "c") {
      event.preventDefault();
      state.cropMode ? copyCrop() : copyImage();
    }
  });
}

async function handleLaunchFiles() {
  if (!("launchQueue" in window)) return;
  window.launchQueue.setConsumer(async (launchParams) => {
    const files = [];
    for (const handle of launchParams.files || []) {
      files.push(await handle.getFile());
    }
    if (files.length) loadFiles(files, "תמונות שנפתחו מהמערכת");
  });
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  }
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    state.deferredInstall = event;
    els.installBtn.hidden = false;
  });
}

window.addEventListener("resize", resizeCanvas);
window.addEventListener("beforeunload", cleanupUrls);

bindUi();
setupDragDrop();
setupCanvasPan();
setupCropDrag();
setupKeyboard();
handleLaunchFiles();
registerServiceWorker();
resizeCanvas();
setStatus("מוכן");
