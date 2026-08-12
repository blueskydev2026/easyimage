export function $(selector) {
  return document.querySelector(selector);
}

export function createEl(tag, props = {}) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key in el) el[key] = value;
    else el.setAttribute(key, value);
  }
  return el;
}

export function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}

export const naturalCompare = {
  includes(value, query) {
    return value.toLocaleLowerCase('he-IL').includes(query.toLocaleLowerCase('he-IL'));
  },
};

export function isTypingTarget(target) {
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName) || target?.isContentEditable;
}

export function toast(el, text) {
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), 2400);
}
