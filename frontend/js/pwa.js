if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js").catch(() => {
      /* silencieux : l'application fonctionne normalement même sans PWA */
    });
  });
}
