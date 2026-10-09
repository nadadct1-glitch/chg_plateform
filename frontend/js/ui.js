/**
 * Petites fonctions utilitaires partagées par toutes les pages de
 * l'application (formatage de dates, statuts colorés, avatars, modales...).
 */

const STATUS_META = {
  non_entame: { label: "Non entamé", color: "red", dot: "dot-red", badge: "badge-red" },
  en_cours: { label: "En cours", color: "orange", dot: "dot-orange", badge: "badge-orange" },
  valide: { label: "Validé", color: "green", dot: "dot-green", badge: "badge-green" },
};

function statusMeta(status) {
  return STATUS_META[status] || STATUS_META.non_entame;
}

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function initials(fullName) {
  if (!fullName) return "?";
  const parts = fullName.trim().split(/\s+/);
  const first = parts[0]?.[0] || "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

function avatarHtml(user, size = "") {
  const cls = `avatar ${size}`.trim();
  const name = user ? user.full_name : "";
  const initialsHtml = escapeHtml(initials(name));
  if (user && user.photo_url) {
    // Les initiales restent en dessous : si la photo ne charge pas (URL cassée),
    // "onerror" la retire et les initiales apparaissent naturellement à la place.
    return `<div class="${cls}">${initialsHtml}<img src="${escapeHtml(user.photo_url)}" alt="" onerror="this.remove()"></div>`;
  }
  return `<div class="${cls}">${initialsHtml}</div>`;
}

/**
 * Relie un champ "nom" et un input de fichier (galerie/appareil) à un
 * aperçu d'avatar en direct : l'image choisie est envoyée à l'API, qui
 * renvoie son URL, stockée dans le champ caché `hiddenUrlInputId`.
 */
function wireAvatarUpload(previewId, nameInputId, fileInputId, hiddenUrlInputId, statusId) {
  const preview = document.getElementById(previewId);
  const nameInput = document.getElementById(nameInputId);
  const fileInput = document.getElementById(fileInputId);
  const hiddenUrl = document.getElementById(hiddenUrlInputId);
  const statusEl = document.getElementById(statusId);
  if (!preview || !nameInput || !fileInput || !hiddenUrl) return;

  function renderPreview() {
    preview.innerHTML = avatarHtml(
      { full_name: nameInput.value.trim(), photo_url: hiddenUrl.value || null },
      "lg"
    );
  }
  renderPreview();
  nameInput.addEventListener("input", renderPreview);

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      if (statusEl) statusEl.textContent = "Image trop volumineuse (5 Mo maximum).";
      fileInput.value = "";
      return;
    }
    if (statusEl) statusEl.textContent = "Envoi en cours...";
    try {
      const formData = new FormData();
      formData.append("file", file);
      const token = Api.getToken();
      const res = await fetch("/api/uploads/photo", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Échec de l'envoi de la photo.");
      hiddenUrl.value = data.url;
      renderPreview();
      if (statusEl) statusEl.textContent = "Photo chargée ✓";
    } catch (err) {
      if (statusEl) statusEl.textContent = "";
      toast(err.message || "Échec de l'envoi de la photo.", "error");
      fileInput.value = "";
    }
  });
}

function formatDate(value, opts = {}) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric", ...opts });
}

function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("fr-FR", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function timeAgo(value) {
  if (!value) return "—";
  const diffMs = Date.now() - new Date(value).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `il y a ${d} j`;
  return formatDate(value);
}

function progressBarHtml(percent, color = "gold") {
  const p = Math.max(0, Math.min(100, percent ?? 0));
  return `
    <div class="progress-row">
      <div class="progress-track"><div class="progress-fill ${color}" style="width:${p}%"></div></div>
      <div class="progress-pct">${p}%</div>
    </div>`;
}

function rankTrackHtml(rank, rankMax) {
  let segs = "";
  for (let i = 1; i <= rankMax; i++) {
    segs += `<div class="rank-seg ${i <= rank ? "filled" : ""}"></div>`;
  }
  return `<div class="rank-track">${segs}</div>`;
}

// ---------------------------------------------------------------------
// Carte de tâche (réutilisée sur accueil / tâches / profil)
// ---------------------------------------------------------------------
function taskCardHtml(t, { showAssignee = true } = {}) {
  const sm = statusMeta(t.status);
  const who = t.assignee ? t.assignee.full_name : "Non affectée";
  return `
    <div class="task-card" onclick="window.location.href='/app/tache.html?id=${t.id}'">
      <div class="status-bar ${sm.color}"></div>
      <div class="body">
        <div class="title">${escapeHtml(t.title)}</div>
        <div class="text-sm text-muted">${escapeHtml(t.category || "Général")}${showAssignee ? " · " + escapeHtml(who) : ""}</div>
        ${progressBarHtml(t.progress_percent, sm.color)}
        <div class="meta">
          <span class="badge ${sm.badge}"><span class="dot ${sm.dot}"></span>${sm.label}</span>
          ${t.end_date ? `<span>Échéance : ${formatDate(t.end_date)}</span>` : ""}
        </div>
      </div>
    </div>`;
}

// ---------------------------------------------------------------------
// Modale générique
// ---------------------------------------------------------------------
function openModal(innerHtml, { onClose } = {}) {
  closeModal();
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.id = "active-modal";
  backdrop.innerHTML = `<div class="modal">${innerHtml}</div>`;
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) closeModal();
  });
  document.body.appendChild(backdrop);
  if (onClose) backdrop._onClose = onClose;
  return backdrop;
}

function closeModal() {
  const el = document.getElementById("active-modal");
  if (el) {
    if (el._onClose) el._onClose();
    el.remove();
  }
}

// ---------------------------------------------------------------------
// Icônes (SVG en ligne, traits simples cohérents avec la maquette)
// ---------------------------------------------------------------------
const ICONS = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9"/></svg>',
  members: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1"/><circle cx="9" cy="7" r="4"/><path d="M23 20v-1a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  tasks: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="3"/><path d="m8 12 3 3 5-6"/></svg>',
  process: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="12" r="3"/><path d="M6 9v6M8.5 7.5 15.5 10.5M8.5 16.5 15.5 13.5"/></svg>',
  meetings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>',
  chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>',
  bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/></svg>',
  logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>',
  inbox: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  finances: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="13" rx="2"/><path d="M2 10h20"/><circle cx="16" cy="14.5" r="1.7"/></svg>',
};
