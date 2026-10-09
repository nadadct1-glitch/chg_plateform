let ALL_EVENTS = [];
let CURRENT_EVENT_FILTER = "tous";
let ALL_MEMBERS = [];

function eventCardHtml(ev) {
  const isTask = ev.kind === "tache";
  const icon = isTask ? ICONS.tasks : ICONS.meetings;
  let badgeHtml = "";
  if (isTask) {
    const sm = statusMeta(ev.status);
    badgeHtml = `<span class="ec-badge" style="background:var(--status-${sm.color}-soft, var(--surface-hover)); color:var(--status-${sm.color}, var(--text-secondary));">${sm.label}</span>`;
  } else {
    const upcoming = new Date(ev.date) >= new Date();
    badgeHtml = `<span class="ec-badge" style="background:${upcoming ? "var(--gold-soft)" : "var(--surface-hover)"}; color:${upcoming ? "var(--gold)" : "var(--text-tertiary)"};">${upcoming ? "À venir" : "Passée"}</span>`;
  }
  return `
    <div class="event-card" data-href="${ev.href}">
      <div class="ec-thumb">${icon}</div>
      <div class="ec-body">
        <div class="ec-title">${escapeHtml(ev.title)}</div>
        <div class="ec-meta">
          ${ev.date ? formatDateTime(ev.date) : "Date non définie"}<br>
          ${escapeHtml(ev.subtitle || "")}
        </div>
        <div class="mt-1">${badgeHtml}</div>
      </div>
    </div>`;
}

function renderEvents() {
  const list = ALL_EVENTS.filter((e) => CURRENT_EVENT_FILTER === "tous" || e.kind === (CURRENT_EVENT_FILTER === "taches" ? "tache" : "reunion"));
  const el = document.getElementById("events-list");
  el.innerHTML = list.length
    ? list.slice(0, 8).map(eventCardHtml).join("")
    : `<div class="empty-state"><div class="icon">🗓️</div>Rien à afficher pour le moment.</div>`;
  el.querySelectorAll("[data-href]").forEach((card) =>
    card.addEventListener("click", () => (window.location.href = card.dataset.href))
  );
}

function feedPostHtml(item) {
  return `
    <div class="feed-post" data-href="${item.link || "#"}" style="cursor:${item.link ? "pointer" : "default"};">
      <div class="fp-head">
        ${item.actor_photo || item.actor_name
          ? avatarHtml({ full_name: item.actor_name, photo_url: item.actor_photo }, "")
          : `<div class="fp-icon">${ICONS[item.icon] || ICONS.bell}</div>`}
        <div class="who">
          <div class="n">${escapeHtml(item.title)}</div>
          <div class="s">${escapeHtml(item.description || "")}</div>
        </div>
        <div class="t">${timeAgo(item.timestamp)}</div>
      </div>
    </div>`;
}

async function loadEventsAndFeed() {
  const [tasks, meetings, activity] = await Promise.all([
    Api.get("/api/tasks"), Api.get("/api/meetings"), Api.get("/api/activity?limit=25"),
  ]);

  ALL_EVENTS = [
    ...tasks.filter((t) => t.status !== "valide").map((t) => ({
      kind: "tache", title: t.title, subtitle: t.assignee ? "Affectée à " + t.assignee.full_name : "Non affectée",
      date: t.end_date, status: t.status, href: `/app/tache.html?id=${t.id}`,
    })),
    ...meetings.filter((m) => new Date(m.starts_at) >= new Date(Date.now() - 86400000)).map((m) => ({
      kind: "reunion", title: m.title, subtitle: m.location || "Lieu non défini",
      date: m.starts_at, href: `/app/reunions.html?id=${m.id}`,
    })),
  ].sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));

  renderEvents();
  document.getElementById("event-filter").addEventListener("change", (e) => {
    CURRENT_EVENT_FILTER = e.target.value;
    renderEvents();
  });

  const feedEl = document.getElementById("feed-list");
  feedEl.innerHTML = activity.length
    ? activity.map(feedPostHtml).join("")
    : `<div class="empty-state"><div class="icon">📰</div>Aucune actualité pour le moment.</div>`;
  feedEl.querySelectorAll("[data-href]").forEach((card) => {
    if (card.dataset.href !== "#") card.addEventListener("click", () => (window.location.href = card.dataset.href));
  });
}

function featuredDomainRowHtml(d) {
  return `
    <div class="featured-row-card" onclick="window.location.href='/index.html#domaines'">
      <div class="fr-icon">${d.number}</div>
      <div><div class="fr-name">${escapeHtml(d.title)}</div><div class="fr-meta">${d.specialties.length} spécialités</div></div>
    </div>`;
}
function featuredProjectRowHtml(p) {
  return `
    <div class="featured-row-card" onclick="window.location.href='/index.html#projets'">
      <div class="fr-icon">${p.number}</div>
      <div><div class="fr-name">${escapeHtml(p.title)}</div><div class="fr-meta">Projet stratégique</div></div>
    </div>`;
}

async function loadFeatured() {
  try {
    const domains = await Api.get("/api/content/domains");
    document.getElementById("featured-domains").innerHTML = domains.slice(0, 3).map(featuredDomainRowHtml).join("");
  } catch {}
  try {
    const projects = await Api.get("/api/content/projects");
    document.getElementById("featured-projects").innerHTML = projects.slice(0, 3).map(featuredProjectRowHtml).join("");
  } catch {}
}

function personRowHtml(u) {
  const online = Math.random() > 0.4; // aucune présence en temps réel : simple indication visuelle
  return `
    <div class="people-row" data-person="${u.id}" onclick="window.location.href='/app/profil.html?id=${u.id}'">
      <div class="avatar-wrap">${avatarHtml(u, "sm")}${online ? '<span class="online-dot"></span>' : ""}</div>
      <div class="p-who">
        <div class="p-name">${escapeHtml(u.full_name)}</div>
        <div class="p-sub">${escapeHtml(u.role_label)}</div>
      </div>
    </div>`;
}

async function loadPeople() {
  try {
    const [founders, members] = await Promise.all([
      Api.get("/api/content/founders"), Api.get("/api/users"),
    ]);
    ALL_MEMBERS = members;
    document.getElementById("founders-label").textContent = `Fondateurs (${founders.length})`;
    document.getElementById("founders-people").innerHTML = founders.length
      ? founders.slice(0, 4).map((f) => personRowHtml({ id: f.id, full_name: f.full_name, role_label: f.role_label, photo_url: f.photo_url })).join("")
      : `<p class="text-sm text-muted">Aucun fondateur enregistré.</p>`;

    renderAllPeople(members);
    document.getElementById("people-search-input").addEventListener("input", (e) => {
      const q = e.target.value.trim().toLowerCase();
      renderAllPeople(q ? members.filter((m) => m.full_name.toLowerCase().includes(q)) : members);
    });
  } catch (err) {
    document.getElementById("all-people").innerHTML = `<p class="text-sm text-muted">Impossible de charger les membres.</p>`;
  }
}

function renderAllPeople(members) {
  document.getElementById("allpeople-label").textContent = `Tous les membres (${members.length})`;
  document.getElementById("all-people").innerHTML = members.slice(0, 8).map(personRowHtml).join("")
    || `<p class="text-sm text-muted">Aucun membre trouvé.</p>`;
}

(async function () {
  const user = await initShell({ active: "accueil", title: "Accueil" });
  if (!user) return;

  document.getElementById("greeting").textContent = `Bonjour, ${user.full_name.split(" ")[0]} 👋`;
  document.getElementById("greeting-sub").textContent =
    `${user.role_label}, voici un aperçu de votre activité sur la plateforme CHG.`;

  if (user.role === "admin" || user.role === "fondateur") {
    try {
      const stats = await Api.get("/api/dashboard");
      const catLabels = {
        administration: "Administration", direction: "Fondateurs", investisseur: "Investisseurs",
        partenaire: "Partenaires", associe: "Associés", employe: "Employés", etudiant: "Étudiants",
      };
      document.getElementById("admin-overview").innerHTML = `
        <div class="section-label" style="margin-top:0;">Vue d'ensemble</div>
        <div class="grid grid-4 mb-2">
          <div class="card"><div class="text-xs text-muted">Membres actifs</div><div style="font-size:1.6rem;font-weight:700;">${stats.total_members}</div></div>
          <div class="card"><div class="text-xs text-muted">Candidatures en attente</div><div style="font-size:1.6rem;font-weight:700;color:var(--gold);">${stats.pending_applications}</div></div>
          <div class="card"><div class="text-xs text-muted">Réunions à venir</div><div style="font-size:1.6rem;font-weight:700;">${stats.upcoming_meetings}</div></div>
          <div class="card"><div class="text-xs text-muted">Avancement global du processus</div><div style="font-size:1.6rem;font-weight:700;color:var(--status-green);">${stats.process_overall_percent}%</div></div>
        </div>`;
    } catch (err) { /* pas grave si indisponible */ }
  }

  try { await loadEventsAndFeed(); } catch (err) {
    document.getElementById("events-list").innerHTML = `<div class="empty-state">Impossible de charger les données.</div>`;
  }
  await loadFeatured();
  await loadPeople();
})();
