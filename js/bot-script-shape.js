/** Must match worker expectations before `runPython` (see also `bot-worker.js`). */
const BOT_CLASS_RE = /\bclass\s+Bot\b/;
const BOT_INSTANCE_DECIDE_RE = /\bdef\s+decide\s*\(\s*self\b/;

/** Pre-Pyodide checks: must match what the worker expects before `runPython`. */
export function describeBotScriptShapeIssues(source) {
  const issues = [];
  if (!BOT_CLASS_RE.test(source)) {
    const m = source.match(/\bclass\s+(\w+)/);
    if (m && m[1] !== 'Bot') {
      issues.push(`Found class \`${m[1]}\`, but it must be named exactly \`Bot\` (case-sensitive).`);
    } else {
      issues.push('Must declare `class Bot:` — the main bot class cannot use another name.');
    }
  }
  if (!BOT_INSTANCE_DECIDE_RE.test(source)) {
    issues.push('Must define `def decide(self, game_state):` on `Bot` that returns an Action.');
  }
  if (issues.length === 0) return null;
  return issues.join('\n');
}
