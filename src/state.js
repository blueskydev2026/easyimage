export function createState() {
  const emptyEdits = () => ({
    rotation: 0,
    flipX: false,
    flipY: false,
    filters: {
      brightness: 0,
      contrast: 0,
      saturation: 0,
      sharpness: 0,
    },
  });
  return {
    photos: [],
    selected: new Set(),
    activeId: null,
    lastSelectedId: null,
    mode: 'view',
    zoom: 0,
    compare: false,
    sort: 'name-asc',
    lightTheme: false,
    emptyEdits,
  };
}

export function makePhoto(file, sourceUrl) {
  const edits = createState().emptyEdits();
  return {
    id: crypto.randomUUID(),
    file,
    name: file.name || 'image',
    size: file.size || 0,
    type: file.type || 'image/png',
    lastModified: file.lastModified || Date.now(),
    sourceUrl,
    bitmap: null,
    thumbUrl: null,
    edits,
    history: [JSON.stringify(edits)],
    historyIndex: 0,
    dirty: false,
  };
}

export function getActivePhoto(state) {
  return state.photos.find((photo) => photo.id === state.activeId) ?? null;
}

export function sortPhotos(state) {
  const [field, dir] = state.sort.split('-');
  const sign = dir === 'desc' ? -1 : 1;
  state.photos.sort((a, b) => {
    if (field === 'name') return sign * a.name.localeCompare(b.name, ['he', 'en'], { numeric: true, sensitivity: 'base' });
    if (field === 'date') return sign * ((a.lastModified || 0) - (b.lastModified || 0));
    if (field === 'size') return sign * ((a.size || 0) - (b.size || 0));
    if (field === 'type') return sign * (a.type || '').localeCompare(b.type || '');
    return 0;
  });
}
