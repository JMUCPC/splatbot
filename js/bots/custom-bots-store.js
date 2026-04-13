const STORAGE_KEY = 'splatbot_custom_bots_v1';

/** Stable id for code imported from the docs site (replaced on each import). */
const CUSTOM_BOT_DOCS_IMPORT_ID = 'custom:from-docs';

const DUPLICATE_SUFFIX_RE = / \((\d+)\)$/;

function safeParse(raw) {
  try {
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.entries)) return [];
    return data.entries.filter(
      (e) =>
        e &&
        typeof e.id === 'string' &&
        e.id.startsWith('custom:') &&
        typeof e.source === 'string' &&
        typeof e.name === 'string',
    );
  } catch {
    return [];
  }
}

export function loadCustomBotEntries() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return safeParse(raw);
  } catch {
    return [];
  }
}

function saveEntries(entries) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 1, entries }));
  } catch (err) {
    if (err && err.name === 'QuotaExceededError') {
      throw new Error('Browser storage is full — try a smaller bot or clear old custom bots.');
    }
    throw err;
  }
}

function sanitizeDisplayName(name) {
  const t = String(name || '').trim();
  return t || 'bot.py';
}

/** Same as uploaded filename normalization (used for duplicate-family matching). */
export function baseDisplayName(name) {
  return sanitizeDisplayName(name);
}

/** Strip one trailing ` (digits)` suffix (our disambiguation pattern). */
export function stripDuplicateSuffix(displayName) {
  const s = String(displayName || '');
  return s.replace(DUPLICATE_SUFFIX_RE, '');
}

export function familyCountForBase(base) {
  const b = String(base || '');
  return loadCustomBotEntries().filter((e) => stripDuplicateSuffix(e.name) === b).length;
}

export function hasDuplicateFamily(base) {
  return familyCountForBase(base) > 0;
}

/**
 * True if this name cannot be used for a new saved copy from the duplicate modal:
 * - exact match with an existing entry name, or
 * - the name has no trailing ` (n)` suffix but matches another entry’s family key
 *   (`stripDuplicateSuffix`), e.g. `my_bot (2)` saved and user types `my_bot`.
 * If the name ends with ` (digits)`, only an exact duplicate collides so `base (K)`
 * suggestions still work alongside a bare `base` row.
 */
export function customBotDisplayNameCollides(displayName) {
  const cand = sanitizeDisplayName(displayName);
  const entries = loadCustomBotEntries();
  if (entries.some((e) => e.name === cand)) return true;
  const stripped = stripDuplicateSuffix(cand);
  if (stripped !== cand) return false;
  return entries.some((e) => stripDuplicateSuffix(e.name) === stripped);
}

function newCustomId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `custom:${crypto.randomUUID()}`;
  }
  return `custom:${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Append with an exact display name (e.g. `my_bot.py (1)`).
 */
export function appendCustomBotWithDisplayName(displayName, source) {
  const id = newCustomId();
  const entries = loadCustomBotEntries();
  entries.push({
    id,
    name: sanitizeDisplayName(displayName),
    source,
  });
  saveEntries(entries);
  return id;
}

/**
 * Append a new saved bot (file upload). Returns id.
 */
export function appendCustomBotUpload(name, source) {
  return appendCustomBotWithDisplayName(sanitizeDisplayName(name), source);
}

/**
 * Prefer exact `name === base`; else first entry whose stripped base matches (array order).
 * Updates `source` in place, same id. Returns id and previous source for rollback.
 */
export function overwriteCustomBotFamilyMember(base, source) {
  const b = String(base || '');
  const entries = loadCustomBotEntries();
  let idx = entries.findIndex((e) => e.name === b);
  if (idx < 0) {
    /* No canonical row — e.g. only `my_bot.py (1)` saved; update first same-base entry. */
    idx = entries.findIndex((e) => stripDuplicateSuffix(e.name) === b);
  }
  if (idx < 0) {
    throw new Error('No matching saved bot to overwrite.');
  }
  const previousSource = entries[idx].source;
  entries[idx] = { ...entries[idx], source };
  saveEntries(entries);
  return { id: entries[idx].id, previousSource };
}

/** Restore or patch source for rollback after failed Python load. */
export function setCustomBotEntrySource(id, source) {
  const entries = loadCustomBotEntries();
  const i = entries.findIndex((e) => e.id === id);
  if (i < 0) return;
  entries[i] = { ...entries[i], source };
  saveEntries(entries);
}

/**
 * Replace or add the single docs-import slot.
 */
export function upsertDocsImportBot(name, source) {
  const entries = loadCustomBotEntries().filter((e) => e.id !== CUSTOM_BOT_DOCS_IMPORT_ID);
  entries.push({
    id: CUSTOM_BOT_DOCS_IMPORT_ID,
    name: sanitizeDisplayName(name),
    source,
  });
  saveEntries(entries);
  return CUSTOM_BOT_DOCS_IMPORT_ID;
}

export function getCustomBotEntry(id) {
  return loadCustomBotEntries().find((e) => e.id === id) ?? null;
}

export function getCustomBotSource(id) {
  return getCustomBotEntry(id)?.source ?? null;
}

export function getCustomBotDisplayName(id) {
  return getCustomBotEntry(id)?.name ?? id;
}

export function removeCustomBotById(id) {
  const next = loadCustomBotEntries().filter((e) => e.id !== id);
  saveEntries(next);
}
