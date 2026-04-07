/**
 * Browser copy of `scripts/bot-runnable.mjs` — keep definitions in sync when editing either file.
 * Used by docs “Try it out” (and any other UI that must match `npm run docs:build` bot checks).
 */
(function (global) {
  'use strict';

  var BOT_CLASS_RE = /\bclass\s+Bot\b/;
  var BOT_INSTANCE_DECIDE_RE = /\bdef\s+decide\s*\(\s*self\b/;

  /**
   * @param {string} source
   * @returns {boolean}
   */
  function looksLikeRunnableBot(source) {
    return BOT_CLASS_RE.test(source) && BOT_INSTANCE_DECIDE_RE.test(source);
  }

  global.splatbotLooksLikeRunnableBot = looksLikeRunnableBot;
})(typeof globalThis !== 'undefined' ? globalThis : window);
