import { initApp, preloadWorkers, hideLoading } from './ui/app.js';

async function main() {
  initApp();
  try {
    await preloadWorkers();
  } catch (err) {
    console.error('Failed to preload workers:', err);
    const statusEl = document.getElementById('loading-status');
    if (statusEl) {
      statusEl.textContent = `Sandbox failed to load: ${err.message || err}. Try refreshing.`;
    }
    return;
  }
  hideLoading();
}

main();
