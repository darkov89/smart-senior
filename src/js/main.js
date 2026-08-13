/**
 * Bootstrap frontendu — rejestracja Alpine stores przed startem Alpine CDN.
 *
 * Kolejność w index.html:
 * 1) ten plik (type="module" — defer z natury)
 * 2) Alpine.js (defer) — ostatni skrypt
 */

import { registerAuthStore } from './stores/authStore.js';

document.addEventListener('alpine:init', () => {
  registerAuthStore();
  // Inicjalizacja sesji zaraz po utworzeniu store (async, nie blokuje Alpine).
  queueMicrotask(() => {
    Alpine.store('auth').init();
  });
});
