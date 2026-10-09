let ALL_USERS = [];
let CATEGORIES = [];
let ROLES = [];
let CURRENT_CAT = "tous";

function userRowHtml(u) {
  return `
    <div class="task-card" style="cursor:default;">
      <div class="status-bar" style="background:${u.is_active ? "var(--status-green)" : "var(--status-red)"}"></div>
      <div class="flex items-center gap-2" style="flex:1; min-width:0;">
        ${avatarHtml(u, "md")}
        <div style="flex:1; min-width:0;">
          <div class="title">${escapeHtml(u.full_name)} <span class="text-xs text-muted">@${escapeHtml(u.username)}</span></div>
          <div class="meta">
            <span class="role-chip">${escapeHtml(u.role_label)}</span>
            ${!u.is_active ? `<span class="badge badge-red">Désactivé</span>` : ""}
            ${u.email ? `<span>${escapeHtml(u.email)}</span>` : ""}
          </div>
        </div>
      </div>
      <div class="flex gap-1">
        <button class="btn btn-ghost btn-sm" data-statusbtn="${u.id}">Statut</button>
        <button class="btn btn-ghost btn-sm" data-toggle="${u.id}">${u.is_active ? "Désactiver" : "Activer"}</button>
        <a class="btn btn-ghost btn-sm" href="/app/profil.html?id=${u.id}">Profil</a>
      </div>
    </div>`;
}

function renderTabs() {
  const counts = { tous: ALL_USERS.length };
  for (const c of CATEGORIES) counts[c.value] = ALL_USERS.filter((u) => u.category === c.value).length;
  const tabs = [{ value: "tous", label: "Tous" }, ...CATEGORIES];
  document.getElementById("category-tabs").innerHTML = tabs
    .map((t) => `<button data-cat="${t.value}" class="${CURRENT_CAT === t.value ? "active" : ""}">${t.label} (${counts[t.value] || 0})</button>`)
    .join("");
  document.querySelectorAll("#category-tabs button").forEach((btn) =>
    btn.addEventListener("click", () => { CURRENT_CAT = btn.dataset.cat; renderTabs(); renderList(); })
  );
}

function renderList() {
  const list = CURRENT_CAT === "tous" ? ALL_USERS : ALL_USERS.filter((u) => u.category === CURRENT_CAT);
  document.getElementById("users-list").innerHTML = list.length
    ? list.map(userRowHtml).join("")
    : `<div class="empty-state">Aucun utilisateur dans cette catégorie.</div>`;

  document.querySelectorAll("[data-statusbtn]").forEach((btn) =>
    btn.addEventListener("click", () => openRoleModal(ALL_USERS.find((u) => u.id === Number(btn.dataset.statusbtn))))
  );
  document.querySelectorAll("[data-toggle]").forEach((btn) =>
    btn.addEventListener("click", () => toggleActive(ALL_USERS.find((u) => u.id === Number(btn.dataset.toggle))))
  );
}

async function toggleActive(u) {
  try {
    await Api.patch(`/api/users/${u.id}`, { is_active: !u.is_active });
    toast(`Compte ${!u.is_active ? "activé" : "désactivé"}.`, "success");
    await loadUsers();
  } catch (err) {
    toast(apiErrorMessage(err), "error");
  }
}

function openRoleModal(u) {
  const options = ROLES.map((r) => `<option value="${r.value}" ${r.value === u.role ? "selected" : ""}>${escapeHtml(r.label)}</option>`).join("");
  openModal(`
    <div class="modal-head"><h3>Statut de ${escapeHtml(u.full_name)}</h3><button class="btn-icon" onclick="closeModal()">✕</button></div>
    <form id="role-form">
      <div class="field"><label>Nouveau statut</label><select class="input" id="rl-role">${options}</select></div>
      <div class="field"><label>Note (optionnel)</label><input class="input" id="rl-note"></div>
      <div id="rl-error"></div>
      <button type="submit" class="btn btn-primary btn-block">Valider</button>
    </form>`);
  document.getElementById("role-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await Api.patch(`/api/users/${u.id}/role`, {
        new_role: document.getElementById("rl-role").value,
        note: document.getElementById("rl-note").value.trim() || null,
      });
      closeModal();
      toast("Statut mis à jour.", "success");
      await loadUsers();
    } catch (err) {
      document.getElementById("rl-error").innerHTML = `<div class="error-box">${escapeHtml(apiErrorMessage(err))}</div>`;
    }
  });
}

function openNewMemberModal() {
  const roleOptions = ROLES.map((r) => `<option value="${r.value}">${escapeHtml(r.label)}</option>`).join("");
  openModal(`
    <div class="modal-head"><h3>Nouveau membre</h3><button class="btn-icon" onclick="closeModal()">✕</button></div>
    <form id="new-member-form">
      <div class="flex items-center gap-2 mb-2">
        <div id="nm-photo-preview"></div>
        <div class="field" style="flex:1; margin-bottom:0;">
          <label>Photo de profil</label>
          <label class="btn btn-ghost btn-sm" for="nm-photo-file" style="cursor:pointer;">Choisir une photo…</label>
          <input type="file" id="nm-photo-file" accept="image/*" style="display:none;">
          <input type="hidden" id="nm-photo">
          <div class="hint" id="nm-photo-status">Depuis la galerie ou l'appareil - JPEG/PNG/WEBP, 5 Mo maximum.</div>
        </div>
      </div>
      <div class="field"><label>Nom complet</label><input class="input" id="nm-full-name" required></div>
      <div class="form-row">
        <div class="field"><label>Identifiant de connexion</label><input class="input" id="nm-username" required></div>
        <div class="field"><label>Mot de passe initial</label><input class="input" id="nm-password" required></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Statut</label><select class="input" id="nm-role">${roleOptions}</select></div>
        <div class="field"><label>E-mail</label><input class="input" id="nm-email" type="email"></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Téléphone</label><input class="input" id="nm-phone"></div>
        <div class="field"><label>Domaine d'activité</label><input class="input" id="nm-domain"></div>
      </div>
      <div id="nm-error"></div>
      <button type="submit" class="btn btn-primary btn-block">Créer le compte</button>
    </form>`);
  wireAvatarUpload("nm-photo-preview", "nm-full-name", "nm-photo-file", "nm-photo", "nm-photo-status");
  document.getElementById("new-member-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const created = await Api.post("/api/users", {
        full_name: document.getElementById("nm-full-name").value.trim(),
        username: document.getElementById("nm-username").value.trim(),
        password: document.getElementById("nm-password").value,
        role: document.getElementById("nm-role").value,
        email: document.getElementById("nm-email").value.trim() || null,
        phone: document.getElementById("nm-phone").value.trim() || null,
        domain_interest: document.getElementById("nm-domain").value.trim() || null,
        photo_url: document.getElementById("nm-photo").value.trim() || null,
      });
      closeModal();
      toast(`Compte créé pour ${created.full_name}. Identifiant : ${created.username}`, "success");
      await loadUsers();
    } catch (err) {
      document.getElementById("nm-error").innerHTML = `<div class="error-box">${escapeHtml(apiErrorMessage(err))}</div>`;
    }
  });
}

async function loadUsers() {
  ALL_USERS = await Api.get("/api/users?include_inactive=true");
  renderTabs();
  renderList();
}

(async function () {
  const user = await initShell({ active: "admin-utilisateurs", title: "Utilisateurs" });
  if (!user) return;
  if (user.role !== "admin") {
    document.getElementById("page-content").innerHTML = `<div class="empty-state">Accès réservé à l'administration.</div>`;
    return;
  }
  CATEGORIES = await Api.get("/api/content/categories");
  ROLES = await Api.get("/api/content/roles");
  await loadUsers();
  document.getElementById("new-member-btn").addEventListener("click", openNewMemberModal);
})();
