function heroSlideArt(kind) {
  // Illustrations SVG abstraites (dégradés + formes géométriques), 100% autonomes
  // (aucune image externe), dans les tons de la charte CHG (or / anthracite).
  const defs = `
    <defs>
      <linearGradient id="g-${kind}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${GRADS[kind][0]}"/>
        <stop offset="100%" stop-color="${GRADS[kind][1]}"/>
      </linearGradient>
    </defs>`;
  return `<svg viewBox="0 0 800 420" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
    ${defs}
    <rect width="800" height="420" fill="url(#g-${kind})"/>
    <circle cx="680" cy="80" r="160" fill="rgba(255,255,255,0.06)"/>
    <circle cx="140" cy="380" r="120" fill="rgba(255,255,255,0.05)"/>
    <circle cx="620" cy="360" r="60" fill="rgba(255,255,255,0.07)"/>
    ${ICON_PATHS[kind]}
  </svg>`;
}

const GRADS = {
  bienvenue: ["#2E3040", "#CFAC5A"],
  domaines: ["#B08D3E", "#2E3040"],
  projets: ["#2E8B6E", "#2E3040"],
  plateforme: ["#5B8DEF", "#2E3040"],
  rejoindre: ["#CFAC5A", "#C24B4B"],
};

const ICON_PATHS = {
  bienvenue: `<g transform="translate(560,190)" opacity="0.5" stroke="#fff" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="0" cy="-40" r="34"/><path d="M-60 70 a60 60 0 0 1 120 0Z"/></g>`,
  domaines: `<g transform="translate(560,150)" opacity="0.5" stroke="#fff" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <rect x="-70" y="30" width="140" height="90"/><path d="M-70 30 0 -40 70 30"/><rect x="-16" y="70" width="32" height="50"/></g>`,
  projets: `<g transform="translate(560,160)" opacity="0.5" stroke="#fff" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path d="M-60 90 L-60 -20 L0 -60 L60 -20 L60 90"/><path d="M-60 20 L60 20"/><path d="M-20 90 L-20 20 M20 90 L20 20"/></g>`,
  plateforme: `<g transform="translate(560,160)" opacity="0.5" stroke="#fff" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <rect x="-70" y="-50" width="140" height="90" rx="10"/><circle cx="0" cy="-5" r="22"/>
    <path d="M-40 70 h80 M-20 40 l-10 30 M20 40 l10 30"/></g>`,
  rejoindre: `<g transform="translate(560,170)" opacity="0.5" stroke="#fff" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="-20" cy="-30" r="26"/><path d="M-70 70 a50 50 0 0 1 100 0Z"/>
    <path d="M55 -30 v40 M35 -10 h40"/></g>`,
};

const HERO_SLIDES = [
  { kind: "bienvenue", eyebrow: "CONCORDE HOLDING GROUP", title: "Un conglomérat, toutes les expertises", text: "Seize domaines d'activité réunis sous une seule bannière, au service de toute la population togolaise." },
  { kind: "domaines", eyebrow: "16 DOMAINES D'ACTIVITÉ", title: "Du bâtiment au numérique", text: "Des centaines de spécialités couvertes par des professionnels formés et encadrés." },
  { kind: "projets", eyebrow: "7 PROJETS STRATÉGIQUES", title: "Des initiatives structurantes", text: "De la restauration intégrée à la banque numérique, des projets concrets au service du développement." },
  { kind: "plateforme", eyebrow: "PLATEFORME INTÉGRÉE DE GESTION", title: "Tout, connecté en temps réel", text: "Sept modules relient clients, spécialistes, formateurs et direction sur une seule plateforme." },
  { kind: "rejoindre", eyebrow: "REJOIGNEZ-NOUS", title: "Associés, employés, étudiants", text: "Déposez votre candidature et prenez part à l'aventure du conglomérat." },
];

let heroIndex = 0;
let heroTimer = null;

function renderHeroSlider() {
  const slidesEl = document.getElementById("hero-slides");
  const dotsEl = document.getElementById("hs-dots");
  if (!slidesEl) return;
  slidesEl.innerHTML = HERO_SLIDES.map(
    (s, i) => `
    <div class="hero-slide ${i === 0 ? "active" : ""}" data-i="${i}">
      <div class="hs-art">${heroSlideArt(s.kind)}</div>
      <div class="hs-content">
        <div class="hs-eyebrow">${escapeHtml(s.eyebrow)}</div>
        <h2 class="hs-title">${escapeHtml(s.title)}</h2>
        <p class="hs-text">${escapeHtml(s.text)}</p>
      </div>
    </div>`
  ).join("");
  dotsEl.innerHTML = HERO_SLIDES.map((_, i) => `<button class="hs-dot ${i === 0 ? "active" : ""}" data-i="${i}" aria-label="Diapositive ${i + 1}"></button>`).join("");

  function goTo(i) {
    heroIndex = (i + HERO_SLIDES.length) % HERO_SLIDES.length;
    document.querySelectorAll(".hero-slide").forEach((el) => el.classList.toggle("active", Number(el.dataset.i) === heroIndex));
    document.querySelectorAll(".hs-dot").forEach((el) => el.classList.toggle("active", Number(el.dataset.i) === heroIndex));
  }
  function next() { goTo(heroIndex + 1); }
  function restartTimer() { clearInterval(heroTimer); heroTimer = setInterval(next, 5500); }

  document.getElementById("hs-prev").addEventListener("click", () => { goTo(heroIndex - 1); restartTimer(); });
  document.getElementById("hs-next").addEventListener("click", () => { goTo(heroIndex + 1); restartTimer(); });
  dotsEl.querySelectorAll(".hs-dot").forEach((d) => d.addEventListener("click", () => { goTo(Number(d.dataset.i)); restartTimer(); }));
  restartTimer();
}

function founderCardHtml(f) {
  return `
    <div class="founder-card">
      ${avatarHtml({ full_name: f.full_name, photo_url: f.photo_url }, "lg")}
      <h3>${escapeHtml(f.full_name)}</h3>
      <div class="f-role">${escapeHtml(f.role_label)}</div>
      ${f.specialty ? `<div class="f-specialty">${escapeHtml(f.specialty)}</div>` : ""}
    </div>`;
}

function valeurCardHtml(v) {
  return `<div class="value-card"><h3>${escapeHtml(v.title)}</h3><p>${escapeHtml(v.description)}</p></div>`;
}
function moduleCardHtml(m) {
  return `<div class="module-card"><h3>${escapeHtml(m.title)}</h3><p>${escapeHtml(m.description)}</p></div>`;
}
function domainListRowHtml(d) {
  return `
    <a class="list-row" href="/rejoindre.html?domaine=${encodeURIComponent(d.title)}" style="text-decoration:none; color:inherit;">
      <div>
        <div class="lr-title">${d.number.toString().padStart(2, "0")} - ${escapeHtml(d.title)}</div>
        <div class="lr-desc">${d.specialties.length} spécialités disponibles${d.description ? " - " + escapeHtml(d.description.slice(0, 110)) + (d.description.length > 110 ? "…" : "") : ""}</div>
      </div>
      <div class="lr-arrow">${ICONS.chevron}</div>
    </a>`;
}

const PROJECT_ICONS = {
  1: '<path d="M3 17h13l3-6h-4l-2-4H8L6 11H3z"/><circle cx="7" cy="17" r="2"/><circle cx="16" cy="17" r="2"/>',
  2: '<path d="M6 3v7a3 3 0 0 0 3 3v8M6 3v7M9 3v7M12 3v18"/><path d="M18 3c-2 2-2 5 0 8v10"/>',
  3: '<path d="M6 3l6 4 6-4M6 3l2 6-2 12h12l-2-12 2-6M12 7v14"/>',
  4: '<circle cx="7" cy="6" r="3"/><circle cx="7" cy="18" r="3"/><path d="M20 4 8.5 15.5M11 12l9 8"/>',
  5: '<path d="M2 9l10-5 10 5-10 5-10-5Z"/><path d="M6 11v5c0 2 3 3 6 3s6-1 6-3v-5"/>',
  6: '<path d="M12 22c5-4 8-8 8-13a8 8 0 1 0-16 0c0 5 3 9 8 13Z"/><path d="M12 13v-4M9 9h6"/>',
  7: '<circle cx="9" cy="9" r="6"/><circle cx="15" cy="15" r="6"/>',
};
function projectIconBadge(number) {
  const d = PROJECT_ICONS[number] || PROJECT_ICONS[1];
  return `<div class="num" style="background:var(--gold-soft);"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg></div>`;
}
function projectCardHtml(p) {
  const short = (p.summary || "").length > 170 ? p.summary.slice(0, 170) + "…" : (p.summary || "");
  return `<div class="card-dark">
    <div class="big-num">${p.number.toString().padStart(2, "0")}</div>
    <h3 style="font-size:1rem;">${escapeHtml(p.title)}</h3>
    <p style="font-size:.86rem;">${escapeHtml(short)}</p>
  </div>`;
}

(async function () {
  renderHeroSlider();

  if (Api.isLoggedIn()) {
    // Un membre déjà connecté est redirigé directement vers son espace.
    // (on laisse tout de même la vitrine accessible si l'on revient en arrière)
  }

  try {
    const site = await Api.get("/api/content/site");
    document.getElementById("hero-eyebrow").textContent = "CONGLOMÉRAT MULTI-SECTORIEL - " + (site.org_full_name || "CHG");
    if (site.tagline) document.getElementById("hero-title").textContent = site.tagline;
    document.getElementById("hero-intro").textContent = site.intro || "";
    document.getElementById("mission-text").textContent = site.mission || "";
    document.getElementById("vision-text").textContent = site.vision || "";
    document.getElementById("footer-org").textContent = "Concorde Holding Group";
    document.getElementById("footer-tagline").textContent = site.tagline || "";
    document.getElementById("footer-copy").innerHTML =
      `© <span id="footer-year"></span> ${escapeHtml(site.org_full_name || "Concorde Holding Group (CHG)")}. Tous droits réservés.`;

    const contactBits = [];
    if (site.contact_address) contactBits.push(`<div>📍 ${escapeHtml(site.contact_address)}</div>`);
    if (site.contact_email) contactBits.push(`<a href="mailto:${escapeHtml(site.contact_email)}">✉️ ${escapeHtml(site.contact_email)}</a>`);
    if (site.contact_phone) contactBits.push(`<a href="tel:${escapeHtml(site.contact_phone)}">📞 ${escapeHtml(site.contact_phone)}</a>`);
    document.getElementById("footer-contact").innerHTML = `<h4>Contact</h4>${contactBits.join("")}`;

    try {
      const valeurs = JSON.parse(site.valeurs_json || "[]");
      document.getElementById("valeurs-grid").innerHTML = valeurs.map(valeurCardHtml).join("");
    } catch {}
    try {
      const modules = JSON.parse(site.modules_json || "[]");
      document.getElementById("modules-grid").innerHTML = modules.map(moduleCardHtml).join("");
    } catch {}
  } catch (err) {
    document.getElementById("hero-intro").textContent =
      "Le conglomérat multi-sectoriel togolais : services professionnels et formation, coordonnés par une plateforme numérique unifiée.";
  }

  document.getElementById("stat-row").innerHTML = `
    <div class="stat"><div class="n">16</div><div class="l">Domaines d'activité</div></div>
    <div class="stat"><div class="n">7</div><div class="l">Projets stratégiques</div></div>
    <div class="stat"><div class="n">333</div><div class="l">Actions planifiées</div></div>
    <div class="stat"><div class="n">7</div><div class="l">Modules de la plateforme</div></div>`;

  document.getElementById("process-stats").innerHTML = `
    <div class="stat-feature-card"><div class="n">8</div><div class="l">Sections</div></div>
    <div class="stat-feature-card"><div class="n">43</div><div class="l">Phases</div></div>
    <div class="stat-feature-card"><div class="n">71</div><div class="l">Tâches</div></div>
    <div class="stat-feature-card"><div class="n">333</div><div class="l">Actions détaillées</div></div>`;

  try {
    const domains = await Api.get("/api/content/domains");
    document.getElementById("domaines-list").innerHTML = domains.map(domainListRowHtml).join("");
  } catch {
    document.getElementById("domaines-list").innerHTML = `<p class="text-muted" style="margin:0;">Impossible de charger les domaines pour le moment.</p>`;
  }

  try {
    const projects = await Api.get("/api/content/projects");
    document.getElementById("projets-grid").innerHTML = projects.map(projectCardHtml).join("");
  } catch {
    document.getElementById("projets-grid").innerHTML = `<p class="text-muted">Impossible de charger les projets pour le moment.</p>`;
  }

  try {
    const founders = await Api.get("/api/content/founders");
    document.getElementById("fondateurs-grid").innerHTML = founders.length
      ? founders.map(founderCardHtml).join("")
      : `<p class="text-muted">La liste des membres fondateurs sera bientôt disponible.</p>`;
  } catch {
    document.getElementById("fondateurs-grid").innerHTML = `<p class="text-muted">Impossible de charger les membres fondateurs pour le moment.</p>`;
  }

  document.getElementById("footer-year").textContent = new Date().getFullYear();

  if (window.refreshReveal) window.refreshReveal();
})();
