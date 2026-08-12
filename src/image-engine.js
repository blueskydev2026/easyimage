export async function loadBitmap(photo) {
  if (photo.bitmap) return photo.bitmap;
  if ('createImageBitmap' in window) {
    photo.bitmap = await createImageBitmap(photo.file);
    return photo.bitmap;
  }
  const image = new Image();
  image.src = photo.sourceUrl;
  await image.decode();
  photo.bitmap = image;
  return image;
}

export async function renderCanvas(photo, canvas, options = {}) {
  const image = await loadBitmap(photo);
  const edits = options.compare ? zeroEdits() : photo.edits;
  const rotated = edits.rotation % 180 !== 0;
  const width = rotated ? image.height : image.width;
  const height = rotated ? image.width : image.height;
  const fitScale = Math.min(canvas.parentElement.clientWidth / width, canvas.parentElement.clientHeight / height, 1);
  const scale = options.zoom || fitScale || 1;
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  canvas.style.width = `${canvas.width}px`;
  canvas.style.height = `${canvas.height}px`;
  drawEdited(photo, canvas.getContext('2d'), canvas.width, canvas.height, edits);
}

export async function renderThumb(photo, canvas) {
  const image = await loadBitmap(photo);
  const size = 72;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#111418';
  ctx.fillRect(0, 0, size, size);
  const scale = Math.min(size / image.width, size / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  ctx.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
}

export async function exportActivePhoto(photo, type = 'image/png', quality = 0.92) {
  const image = await loadBitmap(photo);
  const rotated = photo.edits.rotation % 180 !== 0;
  const canvas = document.createElement('canvas');
  canvas.width = rotated ? image.height : image.width;
  canvas.height = rotated ? image.width : image.height;
  drawEdited(photo, canvas.getContext('2d'), canvas.width, canvas.height, photo.edits);
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

function drawEdited(photo, ctx, width, height, edits) {
  const image = photo.bitmap;
  ctx.save();
  ctx.clearRect(0, 0, width, height);
  ctx.translate(width / 2, height / 2);
  ctx.rotate((edits.rotation * Math.PI) / 180);
  ctx.scale(edits.flipX ? -1 : 1, edits.flipY ? -1 : 1);
  const filters = edits.filters;
  ctx.filter = [
    `brightness(${100 + filters.brightness}%)`,
    `contrast(${100 + filters.contrast}%)`,
    `saturate(${100 + filters.saturation}%)`,
  ].join(' ');
  const rotated = edits.rotation % 180 !== 0;
  const drawWidth = rotated ? height : width;
  const drawHeight = rotated ? width : height;
  ctx.drawImage(image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
  ctx.restore();
}

function zeroEdits() {
  return {
    rotation: 0,
    flipX: false,
    flipY: false,
    filters: { brightness: 0, contrast: 0, saturation: 0, sharpness: 0 },
  };
}
