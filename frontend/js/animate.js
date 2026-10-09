/**
 * Révèle en douceur (fondu + léger déplacement) les éléments marqués
 * ".reveal" ou ".reveal-stagger" dès qu'ils entrent dans la zone visible.
 * Respecte automatiquement "prefers-reduced-motion" (voir style.css).
 */
(function () {
  function start() {
    const targets = document.querySelectorAll(".reveal, .reveal-stagger");
    if (!targets.length) return;

    if (!("IntersectionObserver" in window)) {
      targets.forEach((t) => t.classList.add("in-view"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    targets.forEach((t) => observer.observe(t));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }

  // Expose pour ré-appliquer après un rendu dynamique (ex: landing.js qui
  // injecte des cartes après un appel API).
  window.refreshReveal = start;
})();
