import {
  playerIdsFromLogMessage,
  looksLikeErrorOrBlock,
} from './player-card-log-feed.js';

/** Max stored log rows; consecutive same-type lines coalesce into one row with repeatCount. */
const MAX_LINES = 100;
let logEl = null;
/** @type {Set<HTMLElement>} */
const mirrors = new Set();
/** @type {Array<{ id: number, msg: string, tags: Set<string>, classes: string[], repeatCount?: number }>} */
const entries = [];
let nextEntryId = 1;
/** @type {Set<string>} */
const activeFilters = new Set();
/** @type {Set<string>} */
const expandedGroupKeys = new Set();
let controlsWired = false;

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

function tagsFromMessage(msg) {
  const tags = new Set();
  const pids = playerIdsFromLogMessage(msg);
  const isMatchLifecycle = /\bmatch\s+(started|reset|over)\b/i.test(msg);
  if (looksLikeErrorOrBlock(msg)) tags.add('error');
  if (pids.includes(1)) tags.add('p1');
  if (pids.includes(2)) tags.add('p2');
  if (isMatchLifecycle || (!pids.includes(1) && !pids.includes(2))) tags.add('system');
  return tags;
}

function classesFromTags(tags) {
  const classes = [];
  if (tags.has('error')) classes.push('event-log-line--error');
  if (tags.has('p1')) classes.push('event-log-line--p1');
  if (tags.has('p2')) classes.push('event-log-line--p2');
  return classes;
}

function createLogLineElement(entry) {
  const line = document.createElement('div');
  line.className = 'event-log-line';
  line.textContent = entry.msg;
  for (const cls of entry.classes) {
    line.classList.add(cls);
  }
  return line;
}

/**
 * Map full log text to a stable key so similar lines (e.g. same failure, different hex) collapse together.
 */
function messageGroupingKey(msg) {
  const offGrid = /^Bot (\d+) tried to move to .+, but it's not in the grid$/.exec(msg);
  if (offGrid) {
    return `Bot ${offGrid[1]} tried to move to an off-map hex`;
  }
  return msg;
}

function groupKeyFor(entry) {
  const tags = [...entry.tags].sort().join(',');
  return `${messageGroupingKey(entry.msg)}::${tags}`;
}

/**
 * Cap stored rows by array length (each coalesced run = one entry).
 * Do not sum repeatCount toward the cap — otherwise one collapsed group of 100
 * would count as 100 lines and evict everything before it.
 */
function trimEntriesToMax() {
  while (entries.length > MAX_LINES) {
    entries.shift();
  }
}

function buildGroups() {
  const groups = [];
  for (const entry of entries) {
    const n = entry.repeatCount ?? 1;
    const items = Array.from({ length: n }, () => entry);
    const key = groupKeyFor(entry);
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.items.push(...items);
      continue;
    }
    const previewMsg =
      n > 1 ? messageGroupingKey(entry.msg) : entry.msg;
    groups.push({
      key,
      msg: previewMsg,
      tags: entry.tags,
      classes: entry.classes,
      items,
    });
  }
  return groups;
}

function matchesFilters(tags) {
  if (activeFilters.size === 0) return true;
  for (const f of activeFilters) {
    if (tags.has(f)) return true;
  }
  return false;
}

function renderSink(sink) {
  if (!sink) return;
  const shouldStickBottom = Math.abs(sink.scrollHeight - sink.scrollTop - sink.clientHeight) < 24;
  sink.innerHTML = '';

  const groups = buildGroups();
  for (const g of groups) {
    if (!matchesFilters(g.tags)) continue;
    if (g.items.length === 1) {
      sink.appendChild(createLogLineElement(g.items[0]));
      continue;
    }

    const expanded = expandedGroupKeys.has(g.key);
    const wrap = document.createElement('div');
    wrap.className = 'event-log-group';

    const header = document.createElement('button');
    header.type = 'button';
    header.className = 'event-log-group-toggle';
    header.dataset.groupKey = g.key;
    header.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    header.textContent = expanded
      ? `▾ ${g.items.length} similar messages (click to collapse)`
      : `▸ ${g.items.length} similar messages (click to expand)`;
    wrap.appendChild(header);

    if (expanded) {
      const items = document.createElement('div');
      items.className = 'event-log-group-items';
      for (const item of g.items) {
        const row = createLogLineElement({
          msg: messageGroupingKey(item.msg),
          classes: item.classes,
        });
        row.classList.add('event-log-group-item');
        items.appendChild(row);
      }
      wrap.appendChild(items);
    } else {
      const preview = createLogLineElement({
        msg: g.msg,
        classes: g.classes,
      });
      preview.classList.add('event-log-group-preview');
      wrap.appendChild(preview);
    }
    sink.appendChild(wrap);
  }

  if (shouldStickBottom) {
    sink.scrollTop = sink.scrollHeight;
  }
}

function updateFilterButtonUi() {
  const toggle = document.getElementById('event-log-filter-toggle');
  const defs = [
    ['event-log-filter-error', 'error'],
    ['event-log-filter-p1', 'p1'],
    ['event-log-filter-p2', 'p2'],
    ['event-log-filter-system', 'system'],
  ];
  let anyOn = false;
  for (const [id, tag] of defs) {
    const input = document.getElementById(id);
    if (!(input instanceof HTMLInputElement)) continue;
    const on = activeFilters.has(tag);
    input.checked = on;
    const option = input.closest('.event-log-filter-option');
    if (option) option.setAttribute('aria-checked', on ? 'true' : 'false');
    if (on) anyOn = true;
  }
  if (toggle) {
    toggle.classList.toggle('event-log-filter-toggle--active', anyOn);
  }
}

function renderAllSinks() {
  renderSink(logEl);
  for (const m of mirrors) {
    renderSink(m);
  }
}

function onSinkClick(e) {
  const target = e.target;
  if (!(target instanceof Element)) return;
  const btn = target.closest('.event-log-group-toggle');
  if (!btn) return;
  const key = btn.getAttribute('data-group-key');
  if (!key) return;
  if (expandedGroupKeys.has(key)) expandedGroupKeys.delete(key);
  else expandedGroupKeys.add(key);
  renderAllSinks();
}

function closeFilterMenu() {
  const menu = document.getElementById('event-log-filter-menu');
  const toggle = document.getElementById('event-log-filter-toggle');
  if (menu) menu.setAttribute('hidden', '');
  if (toggle) toggle.setAttribute('aria-expanded', 'false');
}

function openFilterMenu() {
  const menu = document.getElementById('event-log-filter-menu');
  const toggle = document.getElementById('event-log-filter-toggle');
  if (menu) menu.removeAttribute('hidden');
  if (toggle) toggle.setAttribute('aria-expanded', 'true');
}

function toggleFilterMenu() {
  const menu = document.getElementById('event-log-filter-menu');
  if (!menu) return;
  if (menu.hasAttribute('hidden')) openFilterMenu();
  else closeFilterMenu();
}

function wireControlsOnce() {
  if (controlsWired) return;
  controlsWired = true;
  const wrap = document.querySelector('.event-log-filter-wrap');
  const menuToggle = document.getElementById('event-log-filter-toggle');
  if (menuToggle) {
    menuToggle.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleFilterMenu();
    });
  }
  const defs = [
    ['event-log-filter-error', 'error'],
    ['event-log-filter-p1', 'p1'],
    ['event-log-filter-p2', 'p2'],
    ['event-log-filter-system', 'system'],
  ];
  for (const [id, tag] of defs) {
    const input = document.getElementById(id);
    if (!(input instanceof HTMLInputElement)) continue;
    input.addEventListener('change', () => {
      if (input.checked) activeFilters.add(tag);
      else activeFilters.delete(tag);
      updateFilterButtonUi();
      renderAllSinks();
    });
  }
  const clearBtn = document.getElementById('event-log-filter-clear');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      activeFilters.clear();
      updateFilterButtonUi();
      renderAllSinks();
      closeFilterMenu();
    });
  }
  document.addEventListener('click', (e) => {
    const target = e.target;
    if (!(target instanceof Node)) return;
    if (wrap && !wrap.contains(target)) closeFilterMenu();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeFilterMenu();
  });
}

export function initEventConsole(element) {
  logEl = element;
  if (logEl) {
    logEl.addEventListener('click', onSinkClick);
  }
  wireControlsOnce();
  updateFilterButtonUi();
  renderAllSinks();
}

/**
 * Copy current main log lines into a mirror (e.g. after opening a pop-out).
 * @param {HTMLElement} mirrorEl
 */
export function syncMirrorFromMain(mirrorEl) {
  if (!mirrorEl) return;
  renderSink(mirrorEl);
}

/**
 * Live-duplicate new log lines to this element. Returns detach function.
 * @param {HTMLElement} mirrorEl
 * @returns {() => void}
 */
export function attachEventLogMirror(mirrorEl) {
  if (!mirrorEl) return () => {};
  mirrors.add(mirrorEl);
  mirrorEl.addEventListener('click', onSinkClick);
  syncMirrorFromMain(mirrorEl);
  return () => {
    mirrorEl.removeEventListener('click', onSinkClick);
    mirrors.delete(mirrorEl);
  };
}

export function logEvent(msg) {
  const tags = tagsFromMessage(msg);
  const classes = classesFromTags(tags);
  const candidate = { msg, tags, classes };
  const last = entries[entries.length - 1];
  if (last && groupKeyFor(candidate) === groupKeyFor(last)) {
    last.repeatCount = (last.repeatCount ?? 1) + 1;
  } else {
    entries.push({
      id: nextEntryId++,
      msg,
      tags,
      classes,
      repeatCount: 1,
    });
  }
  trimEntriesToMax();
  renderAllSinks();
  for (const fn of lineListeners) {
    try {
      fn(msg);
    } catch (e) {
      console.error(e);
    }
  }
}

export function clearLog() {
  entries.length = 0;
  expandedGroupKeys.clear();
  renderAllSinks();
  for (const fn of clearListeners) {
    try {
      fn();
    } catch (e) {
      console.error(e);
    }
  }
}
