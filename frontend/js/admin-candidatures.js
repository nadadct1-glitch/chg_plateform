let ALL_APPS = [];
let CURRENT_STATUS = "en_attente";

const STATUS_TABS = [
  { value: "en_attente", label: "En attente" },
  { value: "approuvee", label: "Approuvées" },
  { value: "rejetee", label: "Rejetées" },
];

function appRowHtml(a) {
  const badge = a.status === "en_attente" ? "badge-orange" : a.status === "approuvee" ? "badge-green" : "badge-red";
  const badgeLabel = a.status === "en_attente" ? "En attente" : a.status === "approuvee" ? "Approuvée" : "Rejetée";
  return `
    <div class="card mb-1" data-open="${a.id}" style="cursor:pointer;">
      <div class="flex items-center justify-between" style="flex-wrap:wrap; gap:.5rem;">
        <div>
          <strong>${escapeHtml(a.full_name)}</strong>
          <div class="text-sm text-muted">${escapeHtml(a.role_label)}${a.domain_interest ? " · " + escapeHtml(a.domain_interest) : ""}</div>
        </div>
        <div class="flex items-center gap-1">
          <span class="badge ${badge}">${badgeLabel}</span>
          <span class="text-xs text-muted">${formatDate(a.submitted_at)}</span>
        </div>
      </div>
    </div>`;
}

function renderTabs() {
  document.getElementById("status-tabs").innerHTML = STATUS_TABS.map((t) => {
    const count = ALL_APPS.filter((a) => a.status === t.value).length;
    return `<button data-v="${t.value}" class="${CURRENT_STATUS === t.value ? "active" : ""}">${t.label} (${count})</button>`;
  }).join("");
  document.querySelectorAll("#status-tabs button").forEach((btn) =>
    btn.addEventListener("click", () => { CURRENT_STATUS = btn.dataset.v; renderTabs(); renderList(); })
  );
}

function renderList() {
  const list = ALL_APPS.filter((a) => a.status === CURRENT_STATUS);
  document.getElementById("applications-list").innerHTML = list.length
    ? list.map(appRowHtml).join("")
    : `<div class="empty-state"><div class="icon">📭</div>Aucune candidature ici.</div>`;
  document.querySelectorAll("[data-open]").forEach((el) =>
    el.addEventListener("click", () => openAppModal(ALL_APPS.find((a) => a.id === Number(el.dataset.open))))
  );
}

function suggestUsername(fullName) {
  return fullName
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().trim().replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "") || "membre";
}

function openAppModal(a) {
  const isPending = a.status === "en_attente";
  openModal(`
    <div class="modal-head"><h3>${escapeHtml(a.full_name)}</h3><button class="btn-icon" onclick="closeModal()">✕</button></div>
    <div class="text-sm mb-2">
      <div><span class="text-muted">Statut souhaité :</span> <strong>${escapeHtml(a.role_label)}</strong></div>
      ${a.email ? `<div><span class="text-muted">E-mail :</span> ${escapeHtml(a.email)}</div>` : ""}
      ${a.phone ? `<div><span class="text-muted">Téléphone :</span> ${escapeHtml(a.phone)}</div>` : ""}
      ${a.domain_interest ? `<div><span class="text-muted">Domaine d'intérêt :</span> ${escapeHtml(a.domain_interest)}</div>` : ""}
      <div><span class="text-muted">Déposée le :</span> ${formatDateTime(a.submitted_at)}</div>
    </div>
    ${a.motivation ? `<div class="card mb-2"><div class="text-xs text-muted mb-1">Motivation</div><p style="margin:0;">${escapeHtml(a.motivation)}</p></div>` : ""}
    ${a.review_note ? `<div class="text-sm text-muted mb-2">Note : ${escapeHtml(a.review_note)}</div>` : ""}

    ${isPending ? `
    <form id="approve-form" class="mb-2">
      <div class="section-label" style="margin-top:0;">Approuver et créer le compte</div>
      <div class="form-row">
        <div class="field"><label>Identifiant</label><input class="input" id="ap-username" value="${suggestUsername(a.full_name)}" required></div>
        <div class="field"><label>Mot de passe initial</label><input class="input" id="ap-password" value="Bienvenue${new Date().getFullYear()}!" required></div>
      </div>
      <div class="field"><label>Note (optionnel)</label><input class="input" id="ap-note"></div>
      <div id="ap-error"></div>
      <button type="submit" class="btn btn-primary btn-block">Approuver la candidature</button>
    </form>
    <button class="btn btn-danger btn-block" id="reject-btn">Rejeter la candidature</button>
    ` : ""}
  `);

  if (isPending) {
    document.getElementById("approve-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        const created = await Api.post(`/api/registrations/${a.id}/approve`, {
          username: document.getElementById("ap-username").value.trim(),
          password: document.getElementById("ap-password").value,
          note: document.getElementById("ap-note").value.trim() || null,
        });
        closeModal();
        toast(`Compte créé : ${created.username}`, "success");
        await loadApps();
      } catch (err) {
        document.getElementById("ap-error").innerHTML = `<div class="error-box">${escapeHtml(apiErrorMessage(err))}</div>`;
      }
    });
    document.getElementById("reject-btn").addEventListener("click", async () => {
      const note = prompt("Motif du rejet (optionnel) :") || null;
      try {
        await Api.post(`/api/registrations/${a.id}/reject`, { note });
        closeModal();
        toast("Candidature rejetée.", "success");
        await loadApps();
      } catch (err) {
        toast(apiErrorMessage(err), "error");
      }
    });
  }
}

async function loadApps() {
  ALL_APPS = await Api.get("/api/registrations");
  renderTabs();
  renderList();
}

(async function () {
  const user = await initShell({ active: "admin-candidatures", title: "Candidatures" });
  if (!user) return;
  if (user.role !== "admin") {
    document.getElementById("page-content").innerHTML = `<div class="empty-state">Accès réservé à l'administration.</div>`;
    return;
  }
  try {
    await loadApps();
  } catch (err) {
    document.getElementById("applications-list").innerHTML = `<div class="empty-state">${escapeHtml(apiErrorMessage(err))}</div>`;
  }
})();
