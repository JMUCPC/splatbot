/** @type {Record<number, HTMLElement | null>} */
let feeds = { 1: null, 2: null };
/** @type {Record<number, HTMLElement | null>} */
let cards = { 1: null, 2: null };

/**
 * Which players does this log line refer to? (P1 / Bot 1 / collision lists, etc.)
 * @param {string} msg
 * @returns {number[]}
 */
export function playerIdsFromLogMessage(msg) {
  const set = new Set();
  for (const m of msg.matchAll(/\bP\s*([12])\b/gi)) set.add(Number(m[1]));
  for (const m of msg.matchAll(/\b[Bb]ot\s+([12])\b/g)) set.add(Number(m[1]));
  const coll = msg.match(/bots\s+([\d,\s]+)\)/i);
  if (coll) {
    for (const part of coll[1].split(',')) {
      const n = parseInt(part.trim(), 10);
      if (n === 1 || n === 2) set.add(n);
    }
  }
  return [...set];
}

function looksLikeErrorOrBlock(msg) {
  return /\b(error|failed|invalid|cannot|blocked|exceeded|skip)\b/i.test(msg);
}

function pulseCard(card) {
  card.classList.remove('player-card--feed-flash');
  void card.offsetWidth;
  card.classList.add('player-card--feed-flash');
}

export function initPlayerCardEventFeed() {
  feeds = {
    1: document.getElementById('player-card-feed-1'),
    2: document.getElementById('player-card-feed-2'),
  };
  cards = {
    1: document.getElementById('player-card-1'),
    2: document.getElementById('player-card-2'),
  };
}

/** Call for each new event log line (via onLogLine). */
export function syncPlayerCardsFromLogLine(msg) {
  const pids = playerIdsFromLogMessage(msg);
  if (pids.length === 0) return;

  for (const pid of pids) {
    const feed = feeds[pid];
    const card = cards[pid];
    if (!feed || !card) continue;
    feed.textContent = msg;
    card.classList.toggle('player-card--feed-error', looksLikeErrorOrBlock(msg));
    pulseCard(card);
  }
}

export function clearPlayerCardFeeds() {
  for (const pid of [1, 2]) {
    if (feeds[pid]) feeds[pid].textContent = '';
    if (cards[pid]) {
      cards[pid].classList.remove('player-card--feed-error', 'player-card--feed-flash');
    }
  }
}
