let ALL_USERS = [];
let ROLES = [];
let CATEGORIES = [];
let CURRENT_CATEGORY = "tous";

function memberCardHtml(u) {
  return `
    <div class="member-card" onclick="window.location.href='/app/profil.html?id=${u.id}'">
      ${avatarHtml(u, "lg")}
      <div class="name">${escapeHtml(u.full_name)}</div>
      <div class="role">${escapeHtml(u.role_label)}</div>
      ${u.rank_max > 1 ? rankTrackHtml(u.rank, u.rank_max) : `<span class="role-chip">${escapeHtml(CATEGORIES.find(c=>c.value===u.category)?.label || u.category)}</span>`}
    </div>`;
}

function renderGrid() {
  const list = CURRENT_CATEGORY === "tous" ? ALL_USERS : ALL_USERS.filter((u) => u.category === CURRENT_CATEGORY);
  const grid = document.getElementById("members-grid");
  grid.innerHTML = list.length
    ? list.map(memberCardHtml).join("")
    : `<div class="empty-state" style="grid-column:1/-1;"><div class="icon">👥</div>Aucun membre dans cette catégorie.</div>`;
}

function renderTabs() {
  const counts = { tous: ALL_USERS.length };
  for (const c of CATEGORIES) counts[c.value] = ALL_USERS.filter((u) => u.category === c.value).length;
  const tabs = [{ value: "tous", label: "Tous" }, ...CATEGORIES];
  document.getElementById("category-tabs").innerHTML = tabs
    .map(
      (t) => `<button data-cat="${t.value}" class="${CURRENT_CATEGORY === t.value ? "active" : ""}">
        ${t.label} (${counts[t.value] || 0})
      </button>`
    )
    .join("");
  document.querySelectorAll("#category-tabs button").forEach((btn) => {
    btn.addEventListener("click", () => {
      CURRENT_CATEGORY = btn.dataset.cat;
      renderTabs();
      renderGrid();
    });
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
        <div class="field"><label>Mot de passe initial</label><input class="input" id="nm-password" type="text" required></div>
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
    </form>
  `);
  wireAvatarUpload("nm-photo-preview", "nm-full-name", "nm-photo-file", "nm-photo", "nm-photo-status");
  document.getElementById("new-member-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errBox = document.getElementById("nm-error");
    errBox.innerHTML = "";
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
      await loadMembers();
    } catch (err) {
      errBox.innerHTML = `<div class="error-box">${escapeHtml(apiErrorMessage(err))}</div>`;
    }
  });
}

async function loadMembers() {
  ALL_USERS = await Api.get("/api/users");
  renderTabs();
  renderGrid();
}

(async function () {
  const user = await initShell({ active: "membres", title: "Membres" });
  if (!user) return;

  try {
    CATEGORIES = await Api.get("/api/content/categories");
    ROLES = await Api.get("/api/content/roles");
    await loadMembers();
  } catch (err) {
    document.getElementById("members-grid").innerHTML = `<div class="empty-state">Impossible de charger l'annuaire.</div>`;
  }

  if (user.role === "admin") {
    document.getElementById("new-member-btn").style.display = "inline-flex";
    document.getElementById("fab-add").style.display = "flex";
    document.getElementById("new-member-btn").addEventListener("click", openNewMemberModal);
    document.getElementById("fab-add").addEventListener("click", openNewMemberModal);
  }
})();
