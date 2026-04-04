const MAX_LINES = 100;
let logEl = null;
/** @type {Set<HTMLElement>} */
const mirrors = new Set();

/** @type {Set<(msg: string) => void>} */
const lineListeners = new Set();
/** @type {Set<() => void>} */
const clearListeners = new Set();

/** @param {(msg: string) => void} fn @returns {() => void} */
export function onLogLine(fn) {
  lineListeners.add(fn);
  return () => lineListeners.delete(fn);
}

/** @param {() => void} fn @returns {() => void} */
export function onLogClear(fn) {
  clearListeners.add(fn);
  return () => clearListeners.delete(fn);
}

function appendLine(sink, msg) {
  if (!sink) return;
  const line = document.createElement('div');
  line.textContent = msg;
  sink.appendChild(line);
  while (sink.children.length > MAX_LINES) {
    sink.removeChild(sink.firstChild);
  }
  sink.scrollTop = sink.scrollHeight;
}

export function initEventConsole(element) {
  logEl = element;
}

/**
 * Copy current main log lines into a mirror (e.g. after opening a pop-out).
 * @param {HTMLElement} mirrorEl
 */
export function syncMirrorFromMain(mirrorEl) {
  if (!mirrorEl || !logEl) return;
  mirrorEl.innerHTML = '';
  for (const child of logEl.children) {
    mirrorEl.appendChild(child.cloneNode(true));
  }
  mirrorEl.scrollTop = mirrorEl.scrollHeight;
}

/**
 * Live-duplicate new log lines to this element. Returns detach function.
 * @param {HTMLElement} mirrorEl
 * @returns {() => void}
 */
export function attachEventLogMirror(mirrorEl) {
  if (!mirrorEl) return () => {};
  mirrors.add(mirrorEl);
  syncMirrorFromMain(mirrorEl);
  return () => mirrors.delete(mirrorEl);
}

export function logEvent(msg) {
  appendLine(logEl, msg);
  for (const m of mirrors) {
    appendLine(m, msg);
  }
  for (const fn of lineListeners) {
    try {
      fn(msg);
    } catch (e) {
      console.error(e);
    }
  }
}

export function clearLog() {
  if (logEl) logEl.innerHTML = '';
  for (const m of mirrors) {
    m.innerHTML = '';
  }
  for (const fn of clearListeners) {
    try {
      fn();
    } catch (e) {
      console.error(e);
    }
  }
}
