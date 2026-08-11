"use strict";

const $ = (id) => document.getElementById(id);
const imageExtensions = /\.(png|jpe?g|webp|gif|bmp|avif)$/i;
const viewFitPadding = 4;

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
  cropIntent: "crop",
  crop: null,
  draggingCanvas: false,
  dragStart: null,
  deferredInstall: null,
  chromeVisible: false,
  selectedIds: new Set(),
  printPreviewMode: "quick"
};

const els = {
  openFolderBtn: $("openFolderBtn"),
  filePicker: $("filePicker"),
  installBtn: $("installBtn"),
  windowsInstallBtn: $("windowsInstallBtn"),
  dialogInstallBtn: $("dialogInstallBtn"),
  installHelpDialog: $("installHelpDialog"),
  installSupportStatus: $("installSupportStatus"),
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
  batchSort: $("batchSort"),
  quickPrintBtn: $("quickPrintBtn"),
  printDialog: $("printDialog"),
  printSelectionLabel: $("printSelectionLabel"),
  printSizePreset: $("printSizePreset"),
  printPageOrientation: $("printPageOrientation"),
  printPreviewMode: $("printPreviewMode"),
  printSizeFit: $("printSizeFit"),
  printCustomWidth: $("printCustomWidth"),
  printCustomHeight: $("printCustomHeight"),
  printMultiCols: $("printMultiCols"),
  printMultiRows: $("printMultiRows"),
  printCopies: $("printCopies"),
  printCopiesCols: $("printCopiesCols"),
  printPreviewPage: $("printPreviewPage"),
  printPreviewLabel: $("printPreviewLabel")
};

const ctx = els.canvas.getContext("2d", { alpha: true });

function setStatus(text) {
  els.statusLabel.textContent = text;
}

function isStandaloneApp() {
  return window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
}

function updateInstallUi() {
  if (!els.installBtn) return;
  const canInstall = Boolean(state.deferredInstall);
  els.installBtn.hidden = !canInstall;
  if (els.dialogInstallBtn) {
    els.dialogInstallBtn.disabled = !canInstall;
    els.dialogInstallBtn.textContent = canInstall ? "התקן כאפליקציה" : "הדפדפן לא מציע התקנה כרגע";
  }
}

function updateInstallSupportStatus() {
  if (!els.installSupportStatus) return;
  const protocol = window.location.protocol;
  const canUsePwa = protocol === "https:" || protocol === "http:";
  if (isStandaloneApp()) {
    els.installSupportStatus.textContent = "האפליקציה כבר פתוחה במצב מותקן. את ברירת המחדל בוחרים ידנית בהגדרות Windows.";
  } else if (state.deferredInstall) {
    els.installSupportStatus.textContent = "הדפדפן מוכן להתקנה. לחצו על \"התקן כאפליקציה\".";
  } else if (!canUsePwa) {
    els.installSupportStatus.textContent = "פתיחה ישירה מקובץ אינה מאפשרת התקנת PWA. פתחו דרך שרת מקומי או HTTPS.";
  } else {
    els.installSupportStatus.textContent = "אם Chrome/Edge לא מציעים התקנה, ודאו שהדף נטען משרת, רעננו, או השתמשו בתפריט הדפדפן.";
  }
}

function showInstallHelp() {
  updateInstallSupportStatus();
  updateInstallUi();
  if (els.installHelpDialog && !els.installHelpDialog.open) {
    els.installHelpDialog.showModal();
  }
}

async function installOrShowHelp() {
  if (!state.deferredInstall) {
    showInstallHelp();
    setStatus("נפתח הסבר התקנה וברירת מחדל");
    return;
  }

  const promptEvent = state.deferredInstall;
  state.deferredInstall = null;
  updateInstallUi();
  promptEvent.prompt();
  const choice = await promptEvent.userChoice;
  setStatus(choice.outcome === "accepted" ? "התקנת האפליקציה החלה" : "ההתקנה בוטלה");
}

function currentItem() {
  return state.items[state.index] || null;
}

function updatePrintSelectionLabel() {
  if (!els.printSelectionLabel) return;
  els.printSelectionLabel.textContent = `נבחרו ${state.selectedIds.size} תמונות`;
  if (els.printDialog?.open) updatePrintPreview();
}

function updateModeClasses() {
  document.body.classList.add("viewer-mode");
  document.body.classList.toggle("has-images", state.items.length > 0);
  document.body.classList.toggle("no-images", state.items.length === 0);
  document.body.classList.toggle("chrome-visible", state.chromeVisible || state.items.length === 0);
}

function chromeElementFrom(target) {
  return target?.closest?.(".topbar, .sidebar, .inspector, .toolbar, .statusbar, .install-dialog, .print-dialog");
}

function hideChrome() {
  if (!state.items.length) return;
  state.chromeVisible = false;
  updateModeClasses();
}

function showChrome() {
  if (!state.items.length) return;
  state.chromeVisible = true;
  updateModeClasses();
}

function clickedScreenEdge(event) {
  const edge = Math.max(38, Math.min(84, Math.round(Math.min(window.innerWidth, window.innerHeight) * 0.08)));
  return event.clientX <= edge ||
    event.clientX >= window.innerWidth - edge ||
    event.clientY <= edge ||
    event.clientY >= window.innerHeight - edge;
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
          ownsObjectUrl: true,
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
    ownsObjectUrl: true,
    lastModified: file.lastModified
  })).sort(bySort("name"));
  replaceItems(loaded, label);
}

function loadServerItems(payload) {
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const loaded = items.filter((item) => item?.url && imageExtensions.test(item.name || item.path || "")).map((item) => ({
    id: crypto.randomUUID(),
    name: item.name || splitName(item.path || "image").base,
    path: item.path || "",
    url: item.url,
    ownsObjectUrl: false,
    lastModified: item.lastModified || Date.now(),
    size: item.size || 0
  }));
  replaceItems(loaded, payload?.label || "תמונות מהתיקייה", payload?.selectedIndex || 0);
}

function replaceItems(items, label, selectedIndex = 0) {
  cleanupUrls();
  state.items = items;
  state.selectedIds.clear();
  const nextIndex = items.length ? Math.max(0, Math.min(items.length - 1, Number(selectedIndex) || 0)) : -1;
  state.index = nextIndex;
  state.rotation = 0;
  state.dirty = false;
  els.folderLabel.textContent = label;
  els.countLabel.textContent = String(items.length);
  if (items[nextIndex]) state.selectedIds.add(items[nextIndex].id);
  updatePrintSelectionLabel();
  updateModeClasses();
  renderThumbs();
  if (items.length) selectImage(nextIndex);
  else clearViewer();
}

function cleanupUrls() {
  for (const item of state.items) {
    if (item.url && item.ownsObjectUrl) URL.revokeObjectURL(item.url);
  }
}

function clearViewer() {
  state.image = null;
  state.bitmap = null;
  els.emptyState.hidden = false;
  els.fileLabel.textContent = "אין תמונה פתוחה";
  els.metaLabel.textContent = "";
  els.renameInput.value = "";
  updateModeClasses();
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
    if (item.handle) {
      item.file = await item.handle.getFile();
    }
    if (item.file) {
      if (item.url && item.ownsObjectUrl) URL.revokeObjectURL(item.url);
      item.url = URL.createObjectURL(item.file);
      item.ownsObjectUrl = true;
      state.bitmap = await createImageBitmap(item.file);
      item.size = item.file.size;
      item.lastModified = item.file.lastModified;
    } else {
      const response = await fetch(item.url, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      state.bitmap = await createImageBitmap(blob);
      item.size = item.size || blob.size;
    }
    state.image = state.bitmap;
    resetView();
    els.emptyState.hidden = true;
    els.fileLabel.textContent = item.name;
    els.renameInput.value = item.name;
    els.metaLabel.textContent = `${state.image.width}×${state.image.height} | ${Math.round((item.size || item.file?.size || 0) / 1024)}KB | ${formatDate(fileDate(item))}`;
    updateModeClasses();
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
    const button = document.createElement("div");
    button.className = `thumb${index === state.index ? " active" : ""}`;
    button.role = "button";
    button.tabIndex = 0;
    button.title = item.name;
    button.addEventListener("click", () => selectImage(index));
    button.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectImage(index);
      }
    });
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "thumb-check";
    checkbox.checked = state.selectedIds.has(item.id);
    checkbox.title = "בחר להדפסה";
    checkbox.addEventListener("click", (event) => event.stopPropagation());
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) state.selectedIds.add(item.id);
      else state.selectedIds.delete(item.id);
      updatePrintSelectionLabel();
    });
    const img = document.createElement("img");
    img.src = item.url;
    img.alt = "";
    const span = document.createElement("span");
    span.textContent = item.name;
    button.append(checkbox, img, span);
    frag.append(button);
  });
  els.thumbList.append(frag);
  const active = els.thumbList.querySelector(".active");
  active?.scrollIntoView({ block: "nearest" });
}

function resetView() {
  resizeCanvas(false);
  const stage = els.dropZone.getBoundingClientRect();
  const size = rotatedSize();
  const viewPadding = viewFitPadding;
  const fitWidth = Math.max(1, stage.width - viewPadding * 2) / size.width;
  const fitHeight = Math.max(1, stage.height - viewPadding * 2) / size.height;
  state.fitZoom = Math.min(fitWidth, fitHeight);
  state.zoom = state.fitZoom || 1;
  state.panX = 0;
  state.panY = 0;
  updateZoomLabel();
  draw();
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function rotatedSize() {
  if (!state.image) return { width: 1, height: 1 };
  const quarter = Math.abs(state.rotation / 90) % 2 === 1;
  return {
    width: quarter ? state.image.height : state.image.width,
    height: quarter ? state.image.width : state.image.height
  };
}

function resizeCanvas(shouldDraw = true) {
  const rect = els.dropZone.getBoundingClientRect();
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  els.canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  els.canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  els.canvas.style.width = `${rect.width}px`;
  els.canvas.style.height = `${rect.height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (shouldDraw) draw();
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

function constrainViewPan() {
  if (!state.image) return;
  const rect = els.dropZone.getBoundingClientRect();
  const size = rotatedSize();
  const width = size.width * state.zoom;
  const height = size.height * state.zoom;
  const maxX = Math.max(0, (width - rect.width) / 2);
  const maxY = Math.max(0, (height - rect.height) / 2);
  state.panX = maxX ? clamp(state.panX, -maxX, maxX) : 0;
  state.panY = maxY ? clamp(state.panY, -maxY, maxY) : 0;
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
  const minZoom = state.fitZoom || 0.05;
  const next = Math.min(8, Math.max(minZoom, state.zoom * factor));
  const ratio = next / state.zoom;
  state.panX -= before.x * (ratio - 1);
  state.panY -= before.y * (ratio - 1);
  state.zoom = next;
  constrainViewPan();
  updateZoomLabel();
  draw();
}

function move(delta) {
  if (!state.items.length) return;
  const next = Math.max(0, Math.min(state.items.length - 1, state.index + delta));
  if (next === state.index) return;
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
  if (item.url && item.ownsObjectUrl) URL.revokeObjectURL(item.url);
  item.url = URL.createObjectURL(item.file);
  item.ownsObjectUrl = true;
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

function updateCropControls() {
  const cropBtn = $("cropBtn");
  const copyCropBtn = $("copyCropBtn");
  const cancelCropBtn = $("cancelCropBtn");
  if (cropBtn) {
    cropBtn.textContent = state.cropMode ? "אישור" : "חיתוך";
    cropBtn.title = state.cropMode ? "אישור" : "חיתוך";
  }
  if (copyCropBtn) {
    copyCropBtn.disabled = state.cropMode;
  }
  if (cancelCropBtn) {
    cancelCropBtn.hidden = !state.cropMode;
  }
}

function beginCrop(intent = "crop") {
  if (!state.image) return;
  state.cropMode = true;
  state.cropIntent = intent;
  const t = imageTransform();
  const w = Math.max(80, t.width * 0.55);
  const h = Math.max(80, t.height * 0.55);
  state.crop = { x: t.cx - w / 2, y: t.cy - h / 2, width: w, height: h };
  els.cropOverlay.hidden = false;
  syncCropOverlay();
  updateCropControls();
  setStatus(intent === "copy" ? "סמנו קטע להעתקה. לאחר השחרור הוא יועתק ללוח." : "סמנו קטע לחיתוך, ואז לחצו אישור או בטל.");
}

function hideCrop() {
  els.cropOverlay.hidden = true;
  state.cropMode = false;
  state.cropIntent = "crop";
  state.crop = null;
  updateCropControls();
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

async function finishCropSelection() {
  if (!state.cropMode) {
    beginCrop("crop");
    return;
  }
  if (state.cropIntent === "copy") {
    await copyCrop();
    hideCrop();
    return;
  }
  await applyCrop();
}

function beginCopyCrop() {
  beginCrop("copy");
}

function selectedItemsForPrint() {
  const selected = state.items.filter((item) => state.selectedIds.has(item.id));
  const item = currentItem();
  return selected.length ? selected : (item ? [item] : []);
}

function clampPrintNumber(value, min, max, fallback) {
  const number = Math.round(Number(value));
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function selectedPrintOrientation() {
  return els.printPageOrientation?.value || "default";
}

function pageSizeForPrint(defaultOrientation = "portrait") {
  const orientation = selectedPrintOrientation() === "default" ? defaultOrientation : selectedPrintOrientation();
  return orientation === "landscape"
    ? { width: 297, height: 210, orientation }
    : { width: 210, height: 297, orientation: "portrait" };
}

function orientPrintSize(base, image) {
  const orientation = selectedPrintOrientation();
  const shortSide = Math.min(base.width, base.height);
  const longSide = Math.max(base.width, base.height);
  if (orientation === "portrait") return { width: shortSide, height: longSide, mode: "לאורך" };
  if (orientation === "landscape") return { width: longSide, height: shortSide, mode: "לרוחב" };

  const imageLandscape = (image?.width || 1) >= (image?.height || 1);
  return imageLandscape
    ? { width: longSide, height: shortSide, mode: "לפי התמונה" }
    : { width: shortSide, height: longSide, mode: "לפי התמונה" };
}

function getPrintSizeCm(image) {
  const preset = els.printSizePreset?.value || "10x15";
  const sizes = {
    "10x15": { width: 10, height: 15 },
    "13x18": { width: 13, height: 18 },
    "15x21": { width: 15, height: 21 },
    "20x25": { width: 20, height: 25 },
    a6: { width: 10.5, height: 14.8 },
    a5: { width: 14.8, height: 21 },
    a4: { width: 21, height: 29.7 }
  };
  const base = preset !== "custom" ? sizes[preset] || sizes["10x15"] : {
    width: Math.max(1, Number(els.printCustomWidth?.value) || 10),
    height: Math.max(1, Number(els.printCustomHeight?.value) || 15)
  };
  const oriented = orientPrintSize(base, image);
  const fit = els.printSizeFit?.value || "auto";
  const imageWidth = Math.max(1, image?.width || 1);
  const imageHeight = Math.max(1, image?.height || 1);
  const aspect = imageWidth / imageHeight;

  if (fit === "width") {
    return { width: oriented.width, height: oriented.width / aspect, mode: `${oriented.mode}, לפי רוחב` };
  }
  if (fit === "height") {
    return { width: oriented.height * aspect, height: oriented.height, mode: `${oriented.mode}, לפי גובה` };
  }
  if (fit === "box") {
    return { ...oriented, mode: `${oriented.mode}, מסגרת` };
  }
  return oriented;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[char]));
}

function canvasDataUrl(canvas) {
  return canvas ? canvas.toDataURL("image/png") : "";
}

function currentAreaPreviewSrc() {
  const rect = cropScreenToImage();
  if (!rect) return currentItem()?.url || "";
  return canvasDataUrl(canvasFromCurrent(rect));
}

async function currentPrintImage(cropRect = null) {
  const item = currentItem();
  if (!item || !state.image) return null;
  const canvas = canvasFromCurrent(cropRect);
  return { src: canvasDataUrl(canvas), name: item.name, width: canvas.width, height: canvas.height };
}

function printStyles(page, extra = "") {
  return `
    @page { size: A4 ${page.orientation}; margin: 0; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fff; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page {
      width: ${page.width}mm;
      height: ${page.height}mm;
      overflow: hidden;
      page-break-after: always;
      break-after: page;
      background: #fff;
    }
    .page:last-child { page-break-after: auto; break-after: auto; }
    .fit-page {
      display: grid;
      place-items: center;
    }
    .fit-page img {
      width: auto;
      height: auto;
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
      display: block;
    }
    .sized-page {
      display: grid;
      place-items: center;
    }
    .sized-frame {
      width: min(var(--print-frame-width), 100%);
      height: min(var(--print-frame-height), 100%);
      max-width: 100%;
      max-height: 100%;
      display: grid;
      place-items: center;
      overflow: hidden;
    }
    .sized-frame img {
      width: auto;
      height: auto;
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
      display: block;
    }
    .grid-page {
      display: grid;
      gap: 4mm;
      padding: 8mm;
    }
    .print-cell {
      min-width: 0;
      min-height: 0;
      display: grid;
      place-items: center;
      overflow: hidden;
      border: 0.2mm solid #ddd;
    }
    .print-cell img {
      width: auto;
      height: auto;
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
      display: block;
    }
    ${extra}
  `;
}

function chunk(items, size) {
  const pages = [];
  for (let i = 0; i < items.length; i += size) pages.push(items.slice(i, i + size));
  return pages;
}

async function openPrintDocument(title, bodyHtml, options = {}) {
  const page = pageSizeForPrint(options.defaultOrientation || "portrait");
  const frame = document.createElement("iframe");
  frame.className = "print-frame";
  frame.title = title;
  document.body.append(frame);
  const doc = frame.contentDocument;
  doc.open();
  doc.write(`<!doctype html><html lang="he" dir="rtl"><head><meta charset="UTF-8"><title>${escapeHtml(title)}</title><style>${printStyles(page, options.extraCss || "")}</style></head><body>${bodyHtml}</body></html>`);
  doc.close();

  const images = Array.from(doc.images);
  await Promise.all(images.map((img) => img.complete ? Promise.resolve() : new Promise((resolve) => {
    img.onload = resolve;
    img.onerror = resolve;
  })));

  frame.contentWindow.focus();
  frame.contentWindow.print();
  setTimeout(() => frame.remove(), 1200);
}

async function printQuick() {
  state.printPreviewMode = "quick";
  if (els.printPreviewMode) els.printPreviewMode.value = "quick";
  updatePrintPreview();
  const image = await currentPrintImage();
  if (!image) {
    setStatus("אין תמונה להדפסה");
    return;
  }
  await openPrintDocument("הדפסה מהירה", `<section class="page fit-page"><img src="${escapeHtml(image.src)}" alt="${escapeHtml(image.name)}"></section>`);
  setStatus("נשלחה הדפסה מהירה בגודל A4");
}

async function printSized() {
  state.printPreviewMode = "sized";
  if (els.printPreviewMode) els.printPreviewMode.value = "sized";
  updatePrintPreview();
  const image = await currentPrintImage();
  if (!image) {
    setStatus("אין תמונה להדפסה");
    return;
  }
  const size = getPrintSizeCm(image);
  const css = `.sized-frame { --print-frame-width: ${size.width}cm; --print-frame-height: ${size.height}cm; }`;
  await openPrintDocument("הדפסה לפי גודל", `<section class="page sized-page"><div class="sized-frame"><img src="${escapeHtml(image.src)}" alt="${escapeHtml(image.name)}"></div></section>`, { extraCss: css });
  setStatus(`נשלחה הדפסה בגודל ${size.width.toFixed(1)}x${size.height.toFixed(1)} ס"מ (${size.mode})`);
}

async function printImageGrid(items, cols, rows, title) {
  if (!items.length) {
    setStatus("אין תמונות להדפסה");
    return;
  }
  const perPage = Math.max(1, cols * rows);
  const pages = chunk(items, perPage).map((pageItems) => `
    <section class="page grid-page" style="grid-template-columns: repeat(${cols}, 1fr); grid-template-rows: repeat(${rows}, 1fr);">
      ${pageItems.map((item) => `<div class="print-cell"><img src="${escapeHtml(item.src)}" alt="${escapeHtml(item.name)}"></div>`).join("")}
    </section>
  `).join("");
  await openPrintDocument(title, pages);
  setStatus("נשלחה הדפסה בפריסת דף");
}

async function printSelectedImages() {
  state.printPreviewMode = "multi";
  if (els.printPreviewMode) els.printPreviewMode.value = "multi";
  updatePrintPreview();
  const cols = clampPrintNumber(els.printMultiCols?.value, 1, 6, 2);
  const rows = clampPrintNumber(els.printMultiRows?.value, 1, 8, 2);
  const items = selectedItemsForPrint().map((item) => ({ src: item.url, name: item.name }));
  await printImageGrid(items, cols, rows, "הדפסת תמונות נבחרות");
}

async function printCurrentCopies() {
  state.printPreviewMode = "copies";
  if (els.printPreviewMode) els.printPreviewMode.value = "copies";
  updatePrintPreview();
  const image = await currentPrintImage();
  if (!image) {
    setStatus("אין תמונה להדפסה");
    return;
  }
  const copies = clampPrintNumber(els.printCopies?.value, 1, 40, 4);
  const cols = clampPrintNumber(els.printCopiesCols?.value, 1, 6, 2);
  const rows = Math.ceil(copies / cols);
  await printImageGrid(Array.from({ length: copies }, () => image), cols, rows, "הדפסת עותקים");
}

function openPrintManager() {
  updatePrintSelectionLabel();
  updatePrintPreview();
  if (els.printDialog && !els.printDialog.open) els.printDialog.showModal();
}

function choosePrintArea() {
  state.printPreviewMode = "area";
  if (els.printPreviewMode) els.printPreviewMode.value = "area";
  updatePrintPreview();
  beginCrop();
  els.printDialog?.close();
  setStatus("בחרו איזור בתמונה, ואז פתחו ניהול הדפסה ולחצו על הדפס איזור");
}

async function printSelectedArea() {
  state.printPreviewMode = "area";
  if (els.printPreviewMode) els.printPreviewMode.value = "area";
  updatePrintPreview();
  const rect = cropScreenToImage();
  if (!rect) {
    setStatus("בחרו קודם איזור להדפסה");
    beginCrop();
    return;
  }
  const image = await currentPrintImage(rect);
  await openPrintDocument("הדפסת איזור נבחר", `<section class="page fit-page"><img src="${escapeHtml(image.src)}" alt="${escapeHtml(image.name)}"></section>`);
  setStatus("נשלחה הדפסת האיזור המסומן");
}

function previewItems() {
  const items = selectedItemsForPrint();
  return items.length ? items : [];
}

function updatePrintPreview() {
  if (!els.printPreviewPage || !els.printPreviewLabel) return;
  state.printPreviewMode = els.printPreviewMode?.value || state.printPreviewMode || "quick";
  const items = previewItems();
  const page = pageSizeForPrint("portrait");
  const orientationText = page.orientation === "landscape" ? "לרוחב" : "לאורך";
  els.printPreviewPage.textContent = "";
  els.printPreviewPage.className = `print-preview-page${page.orientation === "landscape" ? " landscape" : ""}`;
  els.printPreviewPage.style.aspectRatio = `${page.width} / ${page.height}`;
  els.printPreviewPage.style.gridTemplateColumns = "";
  els.printPreviewPage.style.gridTemplateRows = "";

  if (!items.length) {
    els.printPreviewPage.className = `print-preview-page empty${page.orientation === "landscape" ? " landscape" : ""}`;
    els.printPreviewLabel.textContent = "בחרו תמונה כדי לראות תצוגה מקדימה";
    return;
  }

  const addImage = (parent, src) => {
    const img = document.createElement("img");
    img.src = src;
    img.alt = "";
    parent.append(img);
  };

  const addGrid = (gridItems, cols, rows) => {
    els.printPreviewPage.classList.add("grid");
    els.printPreviewPage.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    els.printPreviewPage.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
    for (const item of gridItems) {
      const cell = document.createElement("div");
      addImage(cell, item.src || item.url);
      els.printPreviewPage.append(cell);
    }
  };

  if (state.printPreviewMode === "multi") {
    const cols = clampPrintNumber(els.printMultiCols?.value, 1, 6, 2);
    const rows = clampPrintNumber(els.printMultiRows?.value, 1, 8, 2);
    const pageItems = items.slice(0, Math.max(1, cols * rows));
    addGrid(pageItems, cols, rows);
    els.printPreviewLabel.textContent = `${pageItems.length} מתוך ${items.length} תמונות בדף ${orientationText}`;
    return;
  }

  if (state.printPreviewMode === "copies") {
    const copies = clampPrintNumber(els.printCopies?.value, 1, 40, 4);
    const cols = clampPrintNumber(els.printCopiesCols?.value, 1, 6, 2);
    const rows = Math.ceil(copies / cols);
    addGrid(Array.from({ length: copies }, () => ({ src: currentItem()?.url || items[0].url })), cols, rows);
    els.printPreviewLabel.textContent = `${copies} עותקים בדף ${orientationText}`;
    return;
  }

  if (state.printPreviewMode === "sized") {
    const item = currentItem() || items[0];
    const size = getPrintSizeCm({ width: state.image?.width || 1, height: state.image?.height || 1 });
    const pageWidthCm = page.width / 10;
    const pageHeightCm = page.height / 10;
    const widthPct = (size.width / pageWidthCm) * 100;
    const heightPct = (size.height / pageHeightCm) * 100;
    const scale = Math.min(1, 100 / Math.max(widthPct, 1), 100 / Math.max(heightPct, 1));
    const frame = document.createElement("div");
    frame.className = "print-preview-sized-frame";
    frame.style.width = `${widthPct * scale}%`;
    frame.style.height = `${heightPct * scale}%`;
    addImage(frame, item.url);
    els.printPreviewPage.append(frame);
    els.printPreviewLabel.textContent = `${size.width.toFixed(1)}x${size.height.toFixed(1)} ס"מ במרכז דף ${orientationText}`;
    return;
  }

  if (state.printPreviewMode === "area") {
    addImage(els.printPreviewPage, currentAreaPreviewSrc());
    els.printPreviewLabel.textContent = `איזור נבחר במרכז דף ${orientationText}`;
    return;
  }

  addImage(els.printPreviewPage, currentItem()?.url || items[0].url);
  els.printPreviewLabel.textContent = `תמונה אחת במרכז דף ${orientationText}`;
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
    state.selectedIds.delete(item.id);
    updatePrintSelectionLabel();
    if (item.url && item.ownsObjectUrl) URL.revokeObjectURL(item.url);
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

  els.cropBox.addEventListener("pointerup", async () => {
    const shouldCopy = state.cropIntent === "copy" && action && start;
    action = null;
    start = null;
    if (shouldCopy) {
      await copyCrop();
      hideCrop();
    }
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
    constrainViewPan();
    draw();
  });
  els.canvas.addEventListener("pointerup", () => {
    state.draggingCanvas = false;
    state.dragStart = null;
  });
  els.dropZone.addEventListener("wheel", (event) => {
    event.preventDefault();
    zoomBy(event.deltaY < 0 ? 1.12 : 0.88, event.clientX, event.clientY);
  }, { passive: false });
}

function setupChromeReveal() {
  window.addEventListener("pointerdown", (event) => {
    if (!state.items.length) return;
    if (chromeElementFrom(event.target)) return;
    if (clickedScreenEdge(event)) {
      showChrome();
    } else if (state.chromeVisible) {
      hideChrome();
    }
  });
}

function bindUi() {
  els.openFolderBtn.addEventListener("click", loadFolder);
  els.filePicker.addEventListener("change", (event) => loadFiles(event.target.files));
  $("prevBtn").addEventListener("click", () => move(-1));
  $("nextBtn").addEventListener("click", () => move(1));
  $("viewPrevBtn").addEventListener("click", () => move(-1));
  $("viewNextBtn").addEventListener("click", () => move(1));
  $("hideToolsBtn").addEventListener("click", hideChrome);
  $("zoomInBtn").addEventListener("click", () => zoomBy(1.18));
  $("zoomOutBtn").addEventListener("click", () => zoomBy(0.82));
  $("fitBtn").addEventListener("click", resetView);
  $("rotateLeftBtn").addEventListener("click", () => rotate(-90));
  $("rotateRightBtn").addEventListener("click", () => rotate(90));
  $("saveBtn").addEventListener("click", saveImage);
  $("copyImageBtn").addEventListener("click", copyImage);
  els.quickPrintBtn?.addEventListener("click", printQuick);
  $("printBtn").addEventListener("click", openPrintManager);
  $("dialogQuickPrintBtn").addEventListener("click", printQuick);
  $("printSizedBtn").addEventListener("click", printSized);
  $("printSelectedBtn").addEventListener("click", printSelectedImages);
  $("printCopiesBtn").addEventListener("click", printCurrentCopies);
  [
    els.printPageOrientation,
    els.printPreviewMode,
    els.printSizePreset,
    els.printSizeFit,
    els.printCustomWidth,
    els.printCustomHeight,
    els.printMultiCols,
    els.printMultiRows,
    els.printCopies,
    els.printCopiesCols
  ].forEach((el) => {
    el?.addEventListener("input", updatePrintPreview);
    el?.addEventListener("change", updatePrintPreview);
  });
  [
    ["dialogQuickPrintBtn", "quick"],
    ["printSizedBtn", "sized"],
    ["printSelectedBtn", "multi"],
    ["printCopiesBtn", "copies"]
  ].forEach(([id, mode]) => {
    const el = $(id);
    el?.addEventListener("pointerenter", () => {
      if (els.printDialog?.open) {
        state.printPreviewMode = mode;
        if (els.printPreviewMode) els.printPreviewMode.value = mode;
        updatePrintPreview();
      }
    });
    el?.addEventListener("focus", () => {
      if (els.printDialog?.open) {
        state.printPreviewMode = mode;
        if (els.printPreviewMode) els.printPreviewMode.value = mode;
        updatePrintPreview();
      }
    });
  });
  $("cropBtn").addEventListener("click", finishCropSelection);
  $("cancelCropBtn").addEventListener("click", hideCrop);
  $("copyCropBtn").addEventListener("click", beginCopyCrop);
  document.querySelectorAll(".more-menu button").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.closest(".more-zoom")) return;
      button.closest("details")?.removeAttribute("open");
    });
  });
  els.renameBtn.addEventListener("click", renameCurrent);
  els.renameInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") renameCurrent();
  });
  $("batchRenameBtn").addEventListener("click", batchRename);
  $("deleteBtn").addEventListener("click", deleteCurrent);
  $("sortNameBtn").addEventListener("click", () => sortItems("name"));
  $("sortDateBtn").addEventListener("click", () => sortItems("date"));
  $("sortTimeBtn").addEventListener("click", () => sortItems("time"));
  els.windowsInstallBtn?.addEventListener("click", installOrShowHelp);
  els.installBtn?.addEventListener("click", installOrShowHelp);
  els.dialogInstallBtn?.addEventListener("click", installOrShowHelp);
}

function setupKeyboard() {
  window.addEventListener("keydown", (event) => {
    const editing = ["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement?.tagName);
    if (editing && !event.ctrlKey) return;
    if (event.key === "ArrowLeft") move(1);
    if (event.key === "ArrowRight") move(-1);
    if (event.key === "Delete") deleteCurrent();
    if (event.key.toLowerCase() === "f") resetView();
    if (event.key === "Escape") {
      if (state.cropMode) {
        hideCrop();
      } else if (state.chromeVisible) {
        hideChrome();
      }
    }
    if (event.ctrlKey && event.key.toLowerCase() === "s") {
      event.preventDefault();
      saveImage();
    }
    if (event.ctrlKey && event.key.toLowerCase() === "c") {
      event.preventDefault();
      state.cropMode ? copyCrop() : copyImage();
    }
    if (event.ctrlKey && event.key.toLowerCase() === "p") {
      event.preventDefault();
      openPrintManager();
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

async function loadWindowsLaunchData() {
  try {
    const response = await fetch(`launch-data.json?ts=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) return;
    const payload = await response.json();
    if (Array.isArray(payload?.items) && payload.items.length) {
      loadServerItems(payload);
      setStatus(`${(payload.selectedIndex || 0) + 1} מתוך ${payload.items.length}`);
    }
  } catch {
    // No Windows launch payload is expected during regular browser use.
  }
}

function registerServiceWorker() {
  updateInstallUi();
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  }
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    state.deferredInstall = event;
    updateInstallUi();
    setStatus("האפליקציה מוכנה להתקנה");
  });
  window.addEventListener("appinstalled", () => {
    state.deferredInstall = null;
    updateInstallUi();
    showInstallHelp();
    setStatus("האפליקציה הותקנה. ברירת מחדל מגדירים ב-Windows.");
  });
}

window.addEventListener("resize", () => {
  resizeCanvas();
  if (state.image) resetView();
});
window.addEventListener("beforeunload", cleanupUrls);

bindUi();
setupDragDrop();
setupCanvasPan();
setupChromeReveal();
setupCropDrag();
setupKeyboard();
handleLaunchFiles();
registerServiceWorker();
loadWindowsLaunchData();
updateModeClasses();
resizeCanvas();
setStatus("מוכן");
