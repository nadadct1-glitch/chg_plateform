/**
 * Coquille applicative commune à toutes les pages authentifiées :
 * vérifie la connexion, récupère l'utilisateur courant, puis injecte
 * la barre latérale (bureau), la barre de navigation basse (mobile)
 * et l'en-tête de page.
 *
 * Utilisation, en fin de <body> de chaque page de /app ou /admin :
 *   initShell({ active: "accueil", title: "Accueil" }).then((user) => { ... });
 */

const NAV_ITEMS = [
  { key: "accueil", label: "Accueil", href: "/app/accueil.html", icon: "home" },
  { key: "membres", label: "Membres", href: "/app/membres.html", icon: "members" },
  { key: "taches", label: "Tâches", href: "/app/taches.html", icon: "tasks" },
  { key: "processus", label: "Processus", href: "/app/processus.html", icon: "process" },
  { key: "reunions", label: "Réunions", href: "/app/reunions.html", icon: "meetings" },
  { key: "chat", label: "Discussion", href: "/app/chat.html", icon: "chat" },
];

const BOTTOM_NAV_KEYS = ["accueil", "taches", "membres", "reunions", "profil"];

const ADMIN_ITEMS = [
  { key: "admin-utilisateurs", label: "Utilisateurs", href: "/admin/utilisateurs.html", icon: "shield" },
  { key: "admin-candidatures", label: "Candidatures", href: "/admin/candidatures.html", icon: "inbox" },
  { key: "admin-finances", label: "Finances", href: "/admin/finances.html", icon: "finances" },
  { key: "admin-contenu", label: "Contenu du site", href: "/admin/contenu.html", icon: "edit" },
];

async function initShell({ active, title, subtitle }) {
  if (!Api.isLoggedIn()) {
    window.location.href = "/login.html";
    return null;
  }

  let user;
  try {
    user = await Api.get("/api/auth/me");
  } catch (err) {
    window.location.href = "/login.html";
    return null;
  }

  window.__CHG_USER__ = user;
  const isAdmin = user.role === "admin";
  const isStaff = isAdmin || user.role === "fondateur";

  renderSidebar(user, active, isAdmin);
  renderBottomNav(user, active);
  renderTopbar(user, title, subtitle);
  maybeShowPasswordBanner(user);

  document.body.dataset.role = user.role;
  document.body.classList.toggle("is-staff", isStaff);
  document.body.classList.toggle("is-admin", isAdmin);

  return user;
}

function navLinkHtml(item, active) {
  return `<a href="${item.href}" class="${item.key === active ? "active" : ""}">
    ${ICONS[item.icon] || ""}<span>${item.label}</span>
  </a>`;
}

function renderSidebar(user, active, isAdmin) {
  const el = document.getElementById("sidebar");
  if (!el) return;
  const adminBlock = isAdmin
    ? `<div class="nav-section-label">Administration</div>` +
      ADMIN_ITEMS.map((it) => navLinkHtml(it, active)).join("")
    : "";
  el.innerHTML = `
    <a href="/app/accueil.html" class="brand">
      <img src="/assets/logo-chg.png" alt="CHG">
      <div class="name">Concorde Holding<span class="sub">Plateforme du Conglomérat</span></div>
    </a>
    <nav>
      ${NAV_ITEMS.map((it) => navLinkHtml(it, active)).join("")}
      ${adminBlock}
    </nav>
    <a href="/app/parametres.html" class="side-user" style="text-decoration:none;">
      ${avatarHtml(user, "sm")}
      <div class="who">
        <div class="n">${escapeHtml(user.full_name)}</div>
        <div class="r">${escapeHtml(user.role_label)}</div>
      </div>
      ${ICONS.chevron}
    </a>`;
}

function renderBottomNav(user, active) {
  const el = document.getElementById("bottom-nav");
  if (!el) return;
  const map = {
    accueil: NAV_ITEMS[0],
    taches: NAV_ITEMS[2],
    membres: NAV_ITEMS[1],
    reunions: NAV_ITEMS[4],
    profil: { key: "profil", label: "Profil", href: "/app/parametres.html", icon: "settings" },
  };
  el.innerHTML = BOTTOM_NAV_KEYS.map((k) => {
    const it = map[k];
    const isActive = active === it.key || (k === "profil" && active === "parametres");
    return `<a href="${it.href}" class="${isActive ? "active" : ""}">${ICONS[it.icon]}<span>${it.label}</span></a>`;
  }).join("");
}

function renderTopbar(user, title, subtitle) {
  const el = document.getElementById("topbar");
  if (!el) return;
  el.innerHTML = `
    <div class="tb-title">
      <span>${escapeHtml(title || "")}</span>
      ${subtitle ? `<span class="sub">${escapeHtml(subtitle)}</span>` : ""}
    </div>
    <div class="tb-actions">
      <a href="/app/parametres.html" class="btn-icon" style="display:flex;align-items:center;justify-content:center;text-decoration:none;" title="Mon profil">
        ${avatarHtml(user, "sm")}
      </a>
    </div>`;
}

function maybeShowPasswordBanner(user) {
  if (!user.must_change_password) return;
  const content = document.getElementById("page-content");
  if (!content || document.getElementById("pwd-banner")) return;
  const banner = document.createElement("div");
  banner.id = "pwd-banner";
  banner.className = "card mb-2";
  banner.style.borderColor = "var(--gold)";
  banner.innerHTML = `
    <div class="flex items-center justify-between gap-2" style="flex-wrap:wrap;">
      <span class="text-sm">Pensez à définir votre propre mot de passe pour sécuriser votre compte.</span>
      <a href="/app/parametres.html" class="btn btn-primary btn-sm">Changer mon mot de passe</a>
    </div>`;
  content.prepend(banner);
}

function logout() {
  Api.clearToken();
  window.location.href = "/index.html";
}
