let SITE = {};

function listEditorHtml(id, items) {
  return `
    <div id="${id}">
      ${items.map((it, i) => listRowHtml(id, i, it)).join("")}
    </div>
    <button type="button" class="btn btn-ghost btn-sm mt-1" data-add-row="${id}">+ Ajouter une ligne</button>`;
}

function listRowHtml(id, i, item) {
  return `
    <div class="card mb-1" data-row="${id}-${i}">
      <div class="form-row">
        <div class="field" style="flex:0 0 160px;"><label>Titre</label><input class="input list-title" value="${escapeHtml(item.title || "")}"></div>
        <div class="field"><label>Description</label><input class="input list-desc" value="${escapeHtml(item.description || "")}"></div>
      </div>
      <button type="button" class="btn btn-ghost btn-sm" data-remove-row="${id}-${i}">Retirer cette ligne</button>
    </div>`;
}

function collectListEditor(id) {
  const items = [];
  document.querySelectorAll(`#${id} [data-row]`).forEach((row) => {
    const title = row.querySelector(".list-title").value.trim();
    const description = row.querySelector(".list-desc").value.trim();
    if (title || description) items.push({ title, description });
  });
  return items;
}

function renderForm() {
  let valeurs = [], modules = [];
  try { valeurs = JSON.parse(SITE.valeurs_json || "[]"); } catch {}
  try { modules = JSON.parse(SITE.modules_json || "[]"); } catch {}

  document.getElementById("content-form").innerHTML = `
    <form id="site-form">
      <div class="card mb-2">
        <div class="field"><label>Nom complet de l'organisation</label><input class="input" id="f-org_full_name" value="${escapeHtml(SITE.org_full_name || "")}"></div>
        <div class="field"><label>Slogan</label><input class="input" id="f-tagline" value="${escapeHtml(SITE.tagline || "")}"></div>
        <div class="form-row">
          <div class="field"><label>Adresse (pied de page)</label><input class="input" id="f-contact_address" value="${escapeHtml(SITE.contact_address || "")}"></div>
          <div class="field"><label>E-mail de contact</label><input class="input" id="f-contact_email" value="${escapeHtml(SITE.contact_email || "")}"></div>
          <div class="field"><label>Téléphone de contact</label><input class="input" id="f-contact_phone" value="${escapeHtml(SITE.contact_phone || "")}"></div>
        </div>
        <div class="field"><label>Introduction</label><textarea class="input" id="f-intro" rows="3">${escapeHtml(SITE.intro || "")}</textarea></div>
        <div class="field"><label>Mission</label><textarea class="input" id="f-mission" rows="3">${escapeHtml(SITE.mission || "")}</textarea></div>
        <div class="field"><label>Vision</label><textarea class="input" id="f-vision" rows="3">${escapeHtml(SITE.vision || "")}</textarea></div>
        <div class="field"><label>Conclusion</label><textarea class="input" id="f-conclusion" rows="3">${escapeHtml(SITE.conclusion || "")}</textarea></div>
      </div>

      <div class="section-label" style="margin-top:0;">Valeurs</div>
      <div class="card mb-2">${listEditorHtml("valeurs-list", valeurs)}</div>

      <div class="section-label">Modules de la plateforme</div>
      <div class="card mb-2">${listEditorHtml("modules-list", modules)}</div>

      <div id="sf-msg"></div>
      <button type="submit" class="btn btn-primary">Enregistrer les modifications</button>
    </form>`;

  document.querySelectorAll("[data-add-row]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const id = btn.dataset.addRow;
      const container = document.getElementById(id);
      const idx = container.querySelectorAll("[data-row]").length;
      container.insertAdjacentHTML("beforeend", listRowHtml(id, idx, { title: "", description: "" }));
      attachRemoveHandlers();
    })
  );
  attachRemoveHandlers();

  document.getElementById("site-form").addEventListener("submit", saveAll);
}

function attachRemoveHandlers() {
  document.querySelectorAll("[data-remove-row]").forEach((btn) => {
    btn.onclick = () => {
      const row = document.querySelector(`[data-row="${btn.dataset.removeRow}"]`);
      if (row) row.remove();
    };
  });
}

async function saveAll(e) {
  e.preventDefault();
  const msg = document.getElementById("sf-msg");
  msg.innerHTML = "";
  const updates = {
    org_full_name: document.getElementById("f-org_full_name").value.trim(),
    tagline: document.getElementById("f-tagline").value.trim(),
    contact_address: document.getElementById("f-contact_address").value.trim(),
    contact_email: document.getElementById("f-contact_email").value.trim(),
    contact_phone: document.getElementById("f-contact_phone").value.trim(),
    intro: document.getElementById("f-intro").value.trim(),
    mission: document.getElementById("f-mission").value.trim(),
    vision: document.getElementById("f-vision").value.trim(),
    conclusion: document.getElementById("f-conclusion").value.trim(),
    valeurs_json: JSON.stringify(collectListEditor("valeurs-list")),
    modules_json: JSON.stringify(collectListEditor("modules-list")),
  };
  try {
    for (const [key, value] of Object.entries(updates)) {
      await Api.patch(`/api/content/site/${key}`, { value });
    }
    SITE = { ...SITE, ...updates };
    msg.innerHTML = `<div class="success-box">Contenu mis à jour. La page d'accueil publique reflète désormais ces changements.</div>`;
  } catch (err) {
    msg.innerHTML = `<div class="error-box">${escapeHtml(apiErrorMessage(err))}</div>`;
  }
}

function domainCardHtml(d) {
  return `<div class="domain-card"><div class="num">${d.number}</div><h3>${escapeHtml(d.title)}</h3><p class="text-xs">${d.specialties.length} spécialités</p></div>`;
}
function projectCardHtml(p) {
  return `<div class="project-card"><div class="num">${p.number}</div><h3>${escapeHtml(p.title)}</h3><p class="text-xs">${escapeHtml((p.summary || "").slice(0, 140))}${(p.summary || "").length > 140 ? "…" : ""}</p></div>`;
}

(async function () {
  const user = await initShell({ active: "admin-contenu", title: "Contenu du site" });
  if (!user) return;
  if (user.role !== "admin") {
    document.getElementById("page-content").innerHTML = `<div class="empty-state">Accès réservé à l'administration.</div>`;
    return;
  }
  try {
    SITE = await Api.get("/api/content/site");
    renderForm();
    const [domains, projects] = await Promise.all([Api.get("/api/content/domains"), Api.get("/api/content/projects")]);
    document.getElementById("domains-ref").innerHTML = domains.map(domainCardHtml).join("");
    document.getElementById("projects-ref").innerHTML = projects.map(projectCardHtml).join("");
  } catch (err) {
    document.getElementById("content-form").innerHTML = `<div class="empty-state">${escapeHtml(apiErrorMessage(err))}</div>`;
  }
})();
