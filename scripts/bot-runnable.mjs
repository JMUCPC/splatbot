/** Keep in sync with `js/bot-runnable.js`. `js/ui/app.js` still inlines upload checks for the game shell. */

export const BOT_CLASS_RE = /\bclass\s+Bot\b/;
export const BOT_INSTANCE_DECIDE_RE = /\bdef\s+decide\s*\(\s*self\b/;

export function looksLikeRunnableBot(source) {
  return BOT_CLASS_RE.test(source) && BOT_INSTANCE_DECIDE_RE.test(source);
}
