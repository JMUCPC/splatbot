import config from '../config.js';

/** Minimal valid bot so workers can init before a real script is fetched. */
export const STUB_BOT_CODE = `from utils.actions import Actions

def decide(game_state):
    return Actions.skip()
`;

function formatBotLabel(key) {
  return key
    .split('_')
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : ''))
    .join(' ');
}

/**
 * Entries for UI and fetching: id is stable, path is fetch URL path.
 */
export function buildBotCatalog() {
  const entries = [];
  if (config.LOAD_BUILTIN_BOTS) {
    for (const [key, file] of Object.entries(config.BUILTIN_BOTS)) {
      entries.push({
        id: `builtin:${key}`,
        group: 'Built-in',
        label: formatBotLabel(key),
        path: `${config.BUILTIN_BOTS_PATH}${file}`,
      });
    }
  }
  if (config.LOAD_DEBUG_BOTS) {
    for (const [key, file] of Object.entries(config.DEBUG_BOTS)) {
      entries.push({
        id: `debug:${key}`,
        group: 'Debug',
        label: formatBotLabel(key),
        path: `${config.DEBUG_BOT_PATH}${file}`,
      });
    }
  }
  return entries;
}

export function getDefaultBotId(catalog) {
  return catalog[0]?.id ?? null;
}
