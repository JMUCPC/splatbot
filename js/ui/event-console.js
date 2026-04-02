const MAX_LINES = 100;
let logEl = null;

export function initEventConsole(element) {
  logEl = element;
}

export function logEvent(msg) {
  if (!logEl) return;
  const line = document.createElement('div');
  line.textContent = msg;
  logEl.appendChild(line);
  while (logEl.children.length > MAX_LINES) {
    logEl.removeChild(logEl.firstChild);
  }
  logEl.scrollTop = logEl.scrollHeight;
}

export function clearLog() {
  if (!logEl) return;
  logEl.innerHTML = '';
}
