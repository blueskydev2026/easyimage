const state = {
  images: [],
  index: -1,
  rotation: 0,
  zoom: 1,
  cropMode: false,
  crop: null,
  dragStart: null,
  fitZoom: 1,
  panX: 0,
  panY: 0,
  panStart: null,
  panOrigin: null,
};

const els = {
  filePicker: document.querySelector("#filePicker"),
  openFilesBtn: document.querySelector("#openFilesBtn"),
  openFolderBtn: document.querySelector("#openFolderBtn"),
  installBtn: document.querySelector("#installBtn"),
  emptyOpenFilesBtn: document.querySelector("#emptyOpenFilesBtn"),
  emptyOpenFolderBtn: document.querySelector("#emptyOpenFolderBtn"),
  thumbs: document.querySelector("#thumbs"),
  mainImage: document.querySelector("#mainImage"),
  stage: document.querySelector("#stage"),
  cropBox: document.querySelector("#cropBox"),
  editCanvas: document.querySelector("#editCanvas"),
  prevBtn: document.querySelector("#prevBtn"),
  nextBtn: document.querySelector("#nextBtn"),
  collectionMeta: document.querySelector("#collectionMeta"),
  imageCounter: document.querySelector("#imageCounter"),
  activeFileName: document.querySelector("#activeFileName"),
  filmstrip: document.querySelector(".filmstrip"),
  toggleFilmstripBtn: document.querySelector("#toggleFilmstripBtn"),
  detailsPanel: document.querySelector("#detailsPanel"),
  toggleToolsBtn: document.querySelector("#toggleToolsBtn"),
  closeToolsBtn: document.querySelector("#closeToolsBtn"),
  scrim: document.querySelector("#scrim"),
  rotateLeftBtn: document.querySelector("#rotateLeftBtn"),
  rotateRightBtn: document.querySelector("#rotateRightBtn"),
  fitBtn: document.querySelector("#fitBtn"),
  actualBtn: document.querySelector("#actualBtn"),
  zoomSlider: document.querySelector("#zoomSlider"),
  zoomValue: document.querySelector("#zoomValue"),
  cropModeBtn: document.querySelector("#cropModeBtn"),
  saveCropBtn: document.querySelector("#saveCropBtn"),
  renameInput: document.querySelector("#renameInput"),
  renameBtn: document.querySelector("#renameBtn"),
  copyBtn: document.querySelector("#copyBtn"),
  downloadBtn: document.querySelector("#downloadBtn"),
  printBtn: document.querySelector("#printBtn"),
  batchPattern: document.querySelector("#batchPattern"),
  batchStart: document.querySelector("#batchStart"),
  batchRenameBtn: document.querySelector("#batchRenameBtn"),
  statusLine: document.querySelector("#statusLine"),
};

const imageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/bmp", "image/svg+xml"]);
let deferredInstallPrompt = null;
const minZoom = 0.25;
const maxZoom = 4;

function setStatus(message) {
  els.statusLine.textContent = message;
}

function extensionOf(name) {
  const index = name.lastIndexOf(".");
  return index > -1 ? name.slice(index) : ".png";
}

function baseName(name) {
  const index = name.lastIndexOf(".");
  return index > -1 ? name.slice(0, index) : name;
}

function naturalSort(a, b) {
  return a.name.localeCompare(b.name, "he", { numeric: true, sensitivity: "base" });
}

function imageFromFile(file, handle = null, dirHandle = null) {
  return {
    id: crypto.randomUUID(),
    file,
    handle,
    dirHandle,
    name: file.name,
    url: URL.createObjectURL(file),
    rotation: 0,
  };
}

function clearImages() {
  state.images.forEach((image) => URL.revokeObjectURL(image.url));
  state.images = [];
  state.index = -1;
}

function setImages(images, sourceName = "") {
  clearImages();
  state.images = images.sort(naturalSort);
  state.index = images.length ? 0 : -1;
  state.rotation = 0;
  state.zoom = 1;
  renderAll(sourceName);
}

function activeImage() {
  return state.images[state.index] ?? null;
}

function renderAll(sourceName = "") {
  renderThumbs();
  renderViewer();
  els.collectionMeta.textContent = state.images.length
    ? `${state.images.length} תמונות${sourceName ? ` מתוך ${sourceName}` : ""}`
    : "בחרו תמונות או תיקייה כדי להתחיל";
}

function updatePanels() {
  const anyOpen = els.detailsPanel.classList.contains("open") || els.filmstrip.classList.contains("open");
  els.scrim.hidden = !anyOpen;
  els.toggleToolsBtn.setAttribute("aria-expanded", String(els.detailsPanel.classList.contains("open")));
  els.toggleFilmstripBtn.setAttribute("aria-expanded", String(els.filmstrip.classList.contains("open")));
}

function togglePanel(panel) {
  const target = panel === "tools" ? els.detailsPanel : els.filmstrip;
  const other = panel === "tools" ? els.filmstrip : els.detailsPanel;
  const willOpen = !target.classList.contains("open");
  other.classList.remove("open");
  target.classList.toggle("open", willOpen);
  updatePanels();
}

function closePanels() {
  els.detailsPanel.classList.remove("open");
  els.filmstrip.classList.remove("open");
  updatePanels();
}

function renderThumbs() {
  els.thumbs.replaceChildren();
  state.images.forEach((image, index) => {
    const button = document.createElement("button");
    button.className = `thumb${index === state.index ? " active" : ""}`;
    button.type = "button";
    button.title = image.name;
    button.setAttribute("aria-label", `פתח ${image.name}`);
    button.addEventListener("click", () => selectImage(index));

    const thumb = document.createElement("img");
    thumb.src = image.url;
    thumb.alt = "";
    button.append(thumb);
    els.thumbs.append(button);
  });
}

function renderViewer() {
  const image = activeImage();
  els.stage.classList.toggle("has-image", Boolean(image));
  els.imageCounter.textContent = image ? `${state.index + 1} / ${state.images.length}` : "0 / 0";
  els.activeFileName.textContent = image?.name ?? "אין תמונה";
  els.renameInput.value = image ? baseName(image.name) : "";
  els.mainImage.src = image?.url ?? "";
  els.mainImage.alt = image?.name ?? "";
  state.rotation = image?.rotation ?? 0;
  els.mainImage.style.setProperty("--rotation", `${state.rotation}deg`);
  applyFitSize();
  applyZoomUi();
  els.prevBtn.disabled = state.images.length < 2;
  els.nextBtn.disabled = state.images.length < 2;
  setToolDisabled(!image);
  resetCrop();
}

function setToolDisabled(disabled) {
  [
    els.rotateLeftBtn, els.rotateRightBtn, els.fitBtn, els.actualBtn, els.cropModeBtn,
    els.saveCropBtn, els.renameBtn, els.copyBtn, els.downloadBtn, els.printBtn,
    els.batchRenameBtn,
  ].forEach((button) => { button.disabled = disabled; });
  els.zoomSlider.disabled = disabled;
}

function setZoom(value) {
  state.zoom = Math.min(maxZoom, Math.max(minZoom, value));
  clampPan();
  applyZoomUi();
}

function applyZoomUi() {
  els.mainImage.style.setProperty("--zoom", state.zoom);
  els.mainImage.style.setProperty("--pan-x", `${state.panX}px`);
  els.mainImage.style.setProperty("--pan-y", `${state.panY}px`);
  els.zoomSlider.value = Math.round(state.zoom * 100);
  els.zoomValue.textContent = `${Math.round(state.zoom * 100)}%`;
}

function calculateFitZoom() {
  const image = activeImage();
  if (!image || !els.mainImage.naturalWidth || !els.mainImage.naturalHeight) return 1;
  applyFitSize();
  state.fitZoom = 1;
  return state.fitZoom;
}

function applyFitSize() {
  const image = activeImage();
  if (!image || !els.mainImage.naturalWidth || !els.mainImage.naturalHeight) {
    els.mainImage.style.removeProperty("--fit-width");
    els.mainImage.style.removeProperty("--fit-height");
    return;
  }
  const stageRect = els.stage.getBoundingClientRect();
  const availableWidth = Math.max(80, stageRect.width);
  const availableHeight = Math.max(80, stageRect.height);
  const rotated = image.rotation % 180 !== 0;
  const naturalWidth = els.mainImage.naturalWidth;
  const naturalHeight = els.mainImage.naturalHeight;
  const fitScale = rotated
    ? Math.min(availableWidth / naturalHeight, availableHeight / naturalWidth)
    : Math.min(availableWidth / naturalWidth, availableHeight / naturalHeight);
  els.mainImage.style.setProperty("--fit-width", `${Math.max(1, naturalWidth * fitScale)}px`);
  els.mainImage.style.setProperty("--fit-height", `${Math.max(1, naturalHeight * fitScale)}px`);
}

function fitImageToStage() {
  resetPan();
  setZoom(calculateFitZoom());
}

function resetPan() {
  state.panX = 0;
  state.panY = 0;
  state.panStart = null;
  state.panOrigin = null;
}

function panBounds() {
  const image = activeImage();
  if (!image || !els.mainImage.naturalWidth || !els.mainImage.naturalHeight) return { x: 0, y: 0 };
  const stageRect = els.stage.getBoundingClientRect();
  const imageRect = els.mainImage.getBoundingClientRect();
  const overflowX = Math.max(0, imageRect.width - stageRect.width);
  const overflowY = Math.max(0, imageRect.height - stageRect.height);
  return { x: overflowX / 2, y: overflowY / 2 };
}

function clampPan() {
  const bounds = panBounds();
  state.panX = Math.min(bounds.x, Math.max(-bounds.x, state.panX));
  state.panY = Math.min(bounds.y, Math.max(-bounds.y, state.panY));
}

function panBy(deltaX, deltaY) {
  state.panX -= deltaX;
  state.panY -= deltaY;
  clampPan();
  applyZoomUi();
}

function canPan() {
  const bounds = panBounds();
  return bounds.x > 1 || bounds.y > 1;
}

function selectImage(index) {
  if (!state.images.length) return;
  state.index = (index + state.images.length) % state.images.length;
  state.zoom = 1;
  resetPan();
  renderThumbs();
  renderViewer();
  if (els.mainImage.complete) fitImageToStage();
  if (state.images.length) closePanels();
}

async function openFiles(files) {
  const images = [...files].filter((file) => file.type.startsWith("image/") || imageTypes.has(file.type));
  setImages(images.map((file) => imageFromFile(file)));
  setStatus(images.length ? "התמונות נטענו" : "לא נמצאו קבצי תמונה");
}

async function openFileHandles(handles) {
  const images = [];
  for (const handle of handles) {
    const file = await handle.getFile();
    if (file.type.startsWith("image/") || imageTypes.has(file.type)) {
      images.push(imageFromFile(file, handle));
    }
  }
  setImages(images);
  setStatus(images.length ? "התמונות נפתחו מהמערכת" : "לא נמצאו קבצי תמונה");
}

async function openFolder() {
  if (!("showDirectoryPicker" in window)) {
    setStatus("פתיחת תיקייה נתמכת בעיקר בכרום וב-Edge. אפשר לבחור כמה תמונות ידנית.");
    els.filePicker.click();
    return;
  }

  try {
    const dir = await window.showDirectoryPicker();
    const images = [];
    for await (const entry of dir.values()) {
      if (entry.kind !== "file") continue;
      const file = await entry.getFile();
      if (file.type.startsWith("image/") || imageTypes.has(file.type)) {
        images.push(imageFromFile(file, entry, dir));
      }
    }
    setImages(images, dir.name);
    setStatus(images.length ? "התיקייה נטענה" : "לא נמצאו תמונות בתיקייה");
  } catch (error) {
    if (error.name !== "AbortError") setStatus("לא הצלחתי לפתוח את התיקייה");
  }
}

function rotate(delta) {
  const image = activeImage();
  if (!image) return;
  image.rotation = (image.rotation + delta + 360) % 360;
  resetPan();
  renderViewer();
  fitImageToStage();
}

async function imageToCanvas(image) {
  const bitmap = await createImageBitmap(image.file);
  const canvas = els.editCanvas;
  const rotated = image.rotation % 180 !== 0;
  canvas.width = rotated ? bitmap.height : bitmap.width;
  canvas.height = rotated ? bitmap.width : bitmap.height;
  const ctx = canvas.getContext("2d");
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((image.rotation * Math.PI) / 180);
  ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
  ctx.restore();
  bitmap.close?.();
  return canvas;
}

async function downloadActive() {
  const image = activeImage();
  if (!image) return;
  const canvas = await imageToCanvas(image);
  canvas.toBlob((blob) => {
    saveBlob(blob, image.name);
  }, image.file.type || "image/png", .95);
}

function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function copyImage() {
  const image = activeImage();
  if (!image) return;
  try {
    const canvas = await imageToCanvas(image);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    setStatus("התמונה הועתקה ללוח");
  } catch {
    setStatus("הדפדפן לא אישר העתקת תמונה. אפשר להשתמש בשמירת עותק.");
  }
}

async function renameActive() {
  const image = activeImage();
  if (!image) return;
  const clean = els.renameInput.value.trim();
  if (!clean) return setStatus("צריך להזין שם קובץ");
  const oldName = image.name;
  const newName = `${clean}${extensionOf(image.name)}`;
  const renamedOnDisk = await renameOnDisk(image, newName);
  image.name = newName;
  renderThumbs();
  renderViewer();
  setStatus(renamedOnDisk ? "שם הקובץ שונה בתיקייה" : `השם עודכן בתצוגה. נשמר עותק בשם ${newName} במקום שינוי ${oldName}`);
}

async function batchRename() {
  const pattern = els.batchPattern.value.trim() || "תמונה-{n}";
  let number = Number(els.batchStart.value) || 1;
  let diskChanges = 0;
  for (const image of state.images) {
    const name = pattern.replaceAll("{n}", String(number).padStart(3, "0"));
    const newName = `${name}${extensionOf(image.name)}`;
    if (await renameOnDisk(image, newName)) diskChanges += 1;
    image.name = newName;
    number += 1;
  }
  renderAll();
  setStatus(diskChanges ? `${diskChanges} קבצים שונו בתיקייה` : "שמות הקבוצה עודכנו בתצוגה");
}

async function renameOnDisk(image, newName) {
  if (!image.dirHandle || !("removeEntry" in image.dirHandle)) return false;
  try {
    const permission = await image.dirHandle.requestPermission?.({ mode: "readwrite" });
    if (permission && permission !== "granted") return false;
    const newHandle = await image.dirHandle.getFileHandle(newName, { create: true });
    const writable = await newHandle.createWritable();
    await writable.write(image.file);
    await writable.close();
    if (newName !== image.name) await image.dirHandle.removeEntry(image.name);
    image.handle = newHandle;
    image.file = await newHandle.getFile();
    URL.revokeObjectURL(image.url);
    image.url = URL.createObjectURL(image.file);
    return true;
  } catch {
    return false;
  }
}

function printActive() {
  const image = activeImage();
  if (!image) return;
  const printWindow = window.open("", "_blank", "popup,width=900,height=700");
  if (!printWindow) return setStatus("הדפדפן חסם את חלון ההדפסה");
  printWindow.document.write(`
    <!doctype html><html lang="he" dir="rtl"><head><title>${image.name}</title>
    <style>body{margin:0;background:#fff;display:grid;place-items:center;min-height:100vh}img{max-width:96vw;max-height:96vh;object-fit:contain;transform:rotate(${image.rotation}deg)}</style>
    </head><body><img src="${image.url}" alt=""></body></html>
  `);
  printWindow.document.close();
  printWindow.addEventListener("load", () => {
    printWindow.focus();
    printWindow.print();
  });
}

function resetCrop() {
  state.crop = null;
  state.dragStart = null;
  els.cropBox.hidden = true;
}

function stagePoint(event) {
  const rect = els.stage.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(event.clientX - rect.left, rect.width)),
    y: Math.max(0, Math.min(event.clientY - rect.top, rect.height)),
  };
}

function drawCrop(a, b) {
  const left = Math.min(a.x, b.x);
  const top = Math.min(a.y, b.y);
  const width = Math.abs(a.x - b.x);
  const height = Math.abs(a.y - b.y);
  state.crop = { left, top, width, height };
  Object.assign(els.cropBox.style, {
    left: `${left}px`,
    top: `${top}px`,
    width: `${width}px`,
    height: `${height}px`,
  });
  els.cropBox.hidden = width < 8 || height < 8;
}

async function saveCrop() {
  const image = activeImage();
  if (!image || !state.crop) return setStatus("בחרו אזור חיתוך קודם");

  const imgRect = els.mainImage.getBoundingClientRect();
  const stageRect = els.stage.getBoundingClientRect();
  const crop = state.crop;
  const visible = {
    left: Math.max(crop.left, imgRect.left - stageRect.left),
    top: Math.max(crop.top, imgRect.top - stageRect.top),
    right: Math.min(crop.left + crop.width, imgRect.right - stageRect.left),
    bottom: Math.min(crop.top + crop.height, imgRect.bottom - stageRect.top),
  };
  const width = visible.right - visible.left;
  const height = visible.bottom - visible.top;
  if (width < 8 || height < 8) return setStatus("אזור החיתוך קטן מדי");

  const source = await imageToCanvas(image);
  const scaleX = source.width / imgRect.width;
  const scaleY = source.height / imgRect.height;
  const sx = (visible.left - (imgRect.left - stageRect.left)) * scaleX;
  const sy = (visible.top - (imgRect.top - stageRect.top)) * scaleY;
  const sw = width * scaleX;
  const sh = height * scaleY;
  const target = document.createElement("canvas");
  target.width = Math.round(sw);
  target.height = Math.round(sh);
  target.getContext("2d").drawImage(source, sx, sy, sw, sh, 0, 0, target.width, target.height);
  target.toBlob(async (blob) => {
    const saved = await writeBlobToActiveFile(blob);
    if (saved) {
      setStatus("החיתוך נשמר בקובץ הפעיל");
      return;
    }
    saveBlob(blob, `cropped-${image.name}`);
    setStatus("החיתוך נשמר כעותק");
  }, image.file.type || "image/png", .95);
}

async function writeBlobToActiveFile(blob) {
  const image = activeImage();
  if (!image?.handle || !("createWritable" in image.handle)) return false;
  try {
    const permission = await image.handle.requestPermission?.({ mode: "readwrite" });
    if (permission && permission !== "granted") return false;
    const writable = await image.handle.createWritable();
    await writable.write(blob);
    await writable.close();
    image.file = await image.handle.getFile();
    URL.revokeObjectURL(image.url);
    image.url = URL.createObjectURL(image.file);
    image.rotation = 0;
    renderAll();
    return true;
  } catch {
    return false;
  }
}

function openDroppedItems(event) {
  event.preventDefault();
  document.body.classList.remove("dragging");
  const files = event.dataTransfer?.files;
  if (files?.length) openFiles(files);
}

function bindEvents() {
  els.openFilesBtn.addEventListener("click", () => els.filePicker.click());
  els.emptyOpenFilesBtn.addEventListener("click", () => els.filePicker.click());
  els.filePicker.addEventListener("change", (event) => openFiles(event.target.files));
  els.openFolderBtn.addEventListener("click", openFolder);
  els.emptyOpenFolderBtn.addEventListener("click", openFolder);
  els.prevBtn.addEventListener("click", () => selectImage(state.index - 1));
  els.nextBtn.addEventListener("click", () => selectImage(state.index + 1));
  els.toggleToolsBtn.addEventListener("click", () => togglePanel("tools"));
  els.toggleFilmstripBtn.addEventListener("click", () => togglePanel("filmstrip"));
  els.closeToolsBtn.addEventListener("click", closePanels);
  els.scrim.addEventListener("click", closePanels);
  els.rotateLeftBtn.addEventListener("click", () => rotate(-90));
  els.rotateRightBtn.addEventListener("click", () => rotate(90));
  els.fitBtn.addEventListener("click", fitImageToStage);
  els.actualBtn.addEventListener("click", () => setZoom(1.8));
  els.zoomSlider.addEventListener("input", () => setZoom(Number(els.zoomSlider.value) / 100));
  els.downloadBtn.addEventListener("click", downloadActive);
  els.copyBtn.addEventListener("click", copyImage);
  els.renameBtn.addEventListener("click", renameActive);
  els.batchRenameBtn.addEventListener("click", batchRename);
  els.printBtn.addEventListener("click", printActive);
  els.installBtn.addEventListener("click", async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    els.installBtn.hidden = true;
  });
  els.cropModeBtn.addEventListener("click", () => {
    state.cropMode = !state.cropMode;
    document.body.classList.toggle("crop-active", state.cropMode);
    els.cropModeBtn.textContent = state.cropMode ? "כבה חיתוך" : "הפעל חיתוך";
    resetCrop();
  });
  els.saveCropBtn.addEventListener("click", saveCrop);

  els.stage.addEventListener("pointerdown", (event) => {
    if (!activeImage()) return;
    if (!state.cropMode && canPan()) {
      state.panStart = { x: event.clientX, y: event.clientY };
      state.panOrigin = { x: state.panX, y: state.panY };
      els.stage.setPointerCapture(event.pointerId);
      document.body.classList.add("panning");
      return;
    }
    if (!state.cropMode) return;
    state.dragStart = stagePoint(event);
    els.stage.setPointerCapture(event.pointerId);
    drawCrop(state.dragStart, state.dragStart);
  });
  els.stage.addEventListener("pointermove", (event) => {
    if (state.panStart && state.panOrigin) {
      state.panX = state.panOrigin.x + event.clientX - state.panStart.x;
      state.panY = state.panOrigin.y + event.clientY - state.panStart.y;
      clampPan();
      applyZoomUi();
      return;
    }
    if (!state.dragStart) return;
    drawCrop(state.dragStart, stagePoint(event));
  });
  els.stage.addEventListener("pointerup", () => {
    state.dragStart = null;
    state.panStart = null;
    state.panOrigin = null;
    document.body.classList.remove("panning");
  });
  els.stage.addEventListener("pointercancel", () => {
    state.dragStart = null;
    state.panStart = null;
    state.panOrigin = null;
    document.body.classList.remove("panning");
  });
  els.stage.addEventListener("wheel", (event) => {
    if (!activeImage()) return;
    event.preventDefault();
    if (event.ctrlKey || event.metaKey) {
      const direction = event.deltaY > 0 ? -1 : 1;
      const factor = direction > 0 ? 1.1 : 0.9;
      setZoom(state.zoom * factor);
      return;
    }
    if (canPan()) panBy(event.deltaX, event.deltaY);
  }, { passive: false });
  els.mainImage.addEventListener("load", fitImageToStage);
  window.addEventListener("resize", () => {
    if (activeImage() && Math.abs(state.zoom - state.fitZoom) < 0.02) fitImageToStage();
  });

  window.addEventListener("keydown", (event) => {
    if (event.target instanceof HTMLInputElement) return;
    if (event.key === "ArrowLeft") selectImage(state.index + 1);
    if (event.key === "ArrowRight") selectImage(state.index - 1);
    if (event.key === "Escape") closePanels();
    if (event.key.toLowerCase() === "t") togglePanel("tools");
    if (event.key.toLowerCase() === "g") togglePanel("filmstrip");
  });

  window.addEventListener("dragover", (event) => {
    event.preventDefault();
    document.body.classList.add("dragging");
  });
  window.addEventListener("dragleave", (event) => {
    if (event.clientX === 0 && event.clientY === 0) document.body.classList.remove("dragging");
  });
  window.addEventListener("drop", openDroppedItems);
  window.addEventListener("paste", (event) => {
    const files = [...(event.clipboardData?.files ?? [])];
    if (files.length) openFiles(files);
  });
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    els.installBtn.hidden = false;
  });
}

bindEvents();
renderViewer();
updatePanels();

if ("serviceWorker" in navigator) {
  const serviceWorkerUrl = new URL("./sw.js", document.baseURI);
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    const reloadKey = "pwa-service-worker-reload";
    if (sessionStorage.getItem(reloadKey)) return;
    sessionStorage.setItem(reloadKey, "1");
    window.location.reload();
  });
  navigator.serviceWorker.register(serviceWorkerUrl, { scope: "./" }).catch((error) => {
    console.error("Service worker registration failed:", error);
  });
}

if ("launchQueue" in window) {
  window.launchQueue.setConsumer((launchParams) => {
    if (launchParams.files?.length) openFileHandles(launchParams.files);
  });
}
