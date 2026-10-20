/**
 * Применяет сохранённую тему до первой отрисовки. Внешний файл, а не inline:
 * CSP в Caddy разрешает только script-src 'self'.
 */
(function () {
  try {
    var preference = window.localStorage.getItem('staynest.theme');
    if (preference === 'dark' || preference === 'light') {
      document.documentElement.dataset.theme = preference;
    }
    var dark =
      preference === 'dark' ||
      (preference !== 'light' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#141A17' : '#FAF7F2');
  } catch {
    // Приватный режим: системная тема применится через CSS.
  }
})();
