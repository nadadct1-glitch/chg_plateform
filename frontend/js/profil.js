function statusHistoryItemHtml(h) {
  const fromLabel = h.old_role ? ROLE_LABELS[h.old_role] || h.old_role : "Création du compte";
  const toLabel = ROLE_LABELS[h.new_role] || h.new_role;
  return `
    <div class="t-item">
      <div class="date">${formatDateTime(h.changed_at)}${h.changed_by_name ? " · par " + escapeHtml(h.changed_by_name) : ""}</div>
      <div style="font-weight:600; margin:.15rem 0;">
        ${h.old_role ? `${escapeHtml(fromLabel)} → <span style="color:var(--gold)">${escapeHtml(toLabel)}</span>` : `Arrivée en tant que <span style="color:var(--gold)">${escapeHtml(toLabel)}</span>`}
      </div>
      ${h.note ? `<div class="text-sm text-muted">${escapeHtml(h.note)}</div>` : ""}
    </div>`;
}

let ROLE_LABELS = {};
let ROLES = [];

function openEditProfileModal(target, isSelf) {
  openModal(`
    <div class="modal-head"><h3>${isSelf ? "Modifier mon profil" : "Modifier le profil"}</h3><button class="btn-icon" onclick="closeModal()">✕</button></div>
    <form id="edit-profile-form">
      <div class="field"><label>Nom complet</label><input class="input" id="ep-full-name" value="${escapeHtml(target.full_name)}" ${isSelf ? "disabled" : ""}></div>
      <div class="form-row">
        <div class="field"><label>E-mail</label><input class="input" id="ep-email" type="email" value="${escapeHtml(target.email || "")}"></div>
        <div class="field"><label>Téléphone</label><input class="input" id="ep-phone" value="${escapeHtml(target.phone || "")}"></div>
      </div>
      <div class="field"><label>Domaine d'activité</label><input class="input" id="ep-domain" value="${escapeHtml(target.domain_interest || "")}"></div>
      <div class="field"><label>Photo (URL)</label><input class="input" id="ep-photo" value="${escapeHtml(target.photo_url || "")}" placeholder="https://..."></div>
      <div class="field"><label>Biographie</label><textarea class="input" id="ep-bio" rows="3">${escapeHtml(target.bio || "")}</textarea></div>
      <div id="ep-error"></div>
      <button type="submit" class="btn btn-primary btn-block">Enregistrer</button>
    </form>`);
  document.getElementById("edit-profile-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errBox = document.getElementById("ep-error");
    const payload = {
      email: document.getElementById("ep-email").value.trim() || null,
      phone: document.getElementById("ep-phone").value.trim() || null,
      domain_interest: document.getElementById("ep-domain").value.trim() || null,
      photo_url: document.getElementById("ep-photo").value.trim() || null,
      bio: document.getElementById("ep-bio").value.trim() || null,
    };
    if (!isSelf) payload.full_name = document.getElementById("ep-full-name").value.trim();
    try {
      await Api.patch(isSelf ? "/api/users/me" : `/api/users/${target.id}`, payload);
      closeModal();
      toast("Profil mis à jour.", "success");
      loadProfile();
    } catch (err) {
      errBox.innerHTML = `<div class="error-box">${escapeHtml(apiErrorMessage(err))}</div>`;
    }
  });
}

function openChangeRoleModal(target) {
  const options = ROLES.map((r) => `<option value="${r.value}" ${r.value === target.role ? "selected" : ""}>${escapeHtml(r.label)}</option>`).join("");
  openModal(`
    <div class="modal-head"><h3>Faire évoluer le statut</h3><button class="btn-icon" onclick="closeModal()">✕</button></div>
    <p class="text-sm">Statut actuel : <strong>${escapeHtml(target.role_label)}</strong></p>
    <form id="role-form">
      <div class="field"><label>Nouveau statut</label><select class="input" id="cr-role">${options}</select></div>
      <div class="field"><label>Note (optionnel)</label><input class="input" id="cr-note" placeholder="Ex : évolution après évaluation trimestrielle"></div>
      <div id="cr-error"></div>
      <button type="submit" class="btn btn-primary btn-block">Valider l'évolution</button>
    </form>`);
  document.getElementById("role-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errBox = document.getElementById("cr-error");
    try {
      await Api.patch(`/api/users/${target.id}/role`, {
        new_role: document.getElementById("cr-role").value,
        note: document.getElementById("cr-note").value.trim() || null,
      });
      closeModal();
      toast("Statut mis à jour.", "success");
      loadProfile();
    } catch (err) {
      errBox.innerHTML = `<div class="error-box">${escapeHtml(apiErrorMessage(err))}</div>`;
    }
  });
}

let CURRENT_VIEWER = null;
let TARGET_ID = null;

async function loadProfile() {
  const root = document.getElementById("profile-root");
  const [target, history, tasks] = await Promise.all([
    Api.get(`/api/users/${TARGET_ID}`),
    Api.get(`/api/users/${TARGET_ID}/history`),
    Api.get(`/api/users/${TARGET_ID}/tasks`),
  ]);

  const isSelf = target.id === CURRENT_VIEWER.id;
  const isAdmin = CURRENT_VIEWER.role === "admin";
  document.title = `${target.full_name} - CHG`;

  root.innerHTML = `
    <div class="card mb-2">
      <div class="flex items-center gap-2" style="flex-wrap:wrap; justify-content:space-between;">
        <div class="flex items-center gap-2">
          ${avatarHtml(target, "xl")}
          <div>
            <h2 style="margin-bottom:.2rem;">${escapeHtml(target.full_name)}</h2>
            <span class="role-chip">${escapeHtml(target.role_label)}</span>
            ${!target.is_active ? '<span class="badge badge-red" style="margin-left:.4rem;">Compte désactivé</span>' : ""}
          </div>
        </div>
        <div class="flex gap-1">
          ${isSelf ? `<button class="btn btn-ghost btn-sm" id="edit-btn">${ICONS.edit} Modifier</button>` : ""}
          ${isAdmin && !isSelf ? `<button class="btn btn-ghost btn-sm" id="edit-btn">${ICONS.edit} Modifier</button>` : ""}
          ${isAdmin ? `<button class="btn btn-primary btn-sm" id="role-btn">Faire évoluer le statut</button>` : ""}
        </div>
      </div>
      ${target.bio ? `<p class="mt-2">${escapeHtml(target.bio)}</p>` : ""}
      <div class="grid grid-3 mt-2">
        <div class="text-sm"><span class="text-muted">E-mail</span><br>${escapeHtml(target.email || "—")}</div>
        <div class="text-sm"><span class="text-muted">Téléphone</span><br>${escapeHtml(target.phone || "—")}</div>
        <div class="text-sm"><span class="text-muted">Domaine d'intérêt</span><br>${escapeHtml(target.domain_interest || "—")}</div>
      </div>
    </div>

    ${target.rank_max > 1 ? `
    <div class="card mb-2">
      <div class="flex items-center justify-between mb-1"><strong class="text-sm">Évolution de statut</strong><span class="text-sm text-muted">Niveau ${target.rank}/${target.rank_max}</span></div>
      ${rankTrackHtml(target.rank, target.rank_max)}
    </div>` : ""}

    <div class="grid grid-2" style="align-items:start;">
      <div>
        <div class="section-label" style="margin-top:0;">Historique</div>
        <div class="card">
          ${history.length ? `<div class="timeline">${history.map(statusHistoryItemHtml).join("")}</div>` : `<p class="text-sm text-muted">Aucun historique.</p>`}
        </div>
      </div>
      <div>
        <div class="section-label" style="margin-top:0;">Tâches assignées</div>
        ${tasks.length ? tasks.map((t) => taskCardHtml(t, { showAssignee: false })).join("") : `<div class="card"><p class="text-sm text-muted" style="margin:0;">Aucune tâche assignée.</p></div>`}
      </div>
    </div>
  `;

  const editBtn = document.getElementById("edit-btn");
  if (editBtn) editBtn.addEventListener("click", () => openEditProfileModal(target, isSelf));
  const roleBtn = document.getElementById("role-btn");
  if (roleBtn) roleBtn.addEventListener("click", () => openChangeRoleModal(target));
}

(async function () {
  const user = await initShell({ active: "membres", title: "Profil" });
  if (!user) return;
  CURRENT_VIEWER = user;

  const params = new URLSearchParams(window.location.search);
  TARGET_ID = params.get("id") || user.id;

  try {
    ROLES = await Api.get("/api/content/roles");
    ROLE_LABELS = Object.fromEntries(ROLES.map((r) => [r.value, r.label]));
    await loadProfile();
  } catch (err) {
    document.getElementById("profile-root").innerHTML = `<div class="empty-state">Impossible de charger ce profil.</div>`;
  }
})();
