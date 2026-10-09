let SECTIONS = [];
let VIEWER = null;
let MEMBERS = [];
let MEMBER_MAP = {};

function isAdmin() {
  return VIEWER.role === "admin";
}
function isStaff() {
  return VIEWER.role === "admin" || VIEWER.role === "fondateur";
}

function progressColor(pct) {
  if (pct >= 100) return "green";
  if (pct <= 0) return "red";
  return "orange";
}

function canEditItem(item) {
  if (isStaff()) return true;
  return item.assigned_to_id === VIEWER.id;
}

function itemRowHtml(item) {
  const sm = statusMeta(item.status);
  return `
    <div class="process-item-row">
      <span class="num">${item.number}.</span>
      <span class="dot ${sm.dot}" style="margin-top:6px;"></span>
      <div style="flex:1; min-width:0;">
        <div>${escapeHtml(item.description)}</div>
        ${item.assignee_name || item.target_date ? `<div class="text-xs text-muted mt-1">${item.assignee_name ? "Assignée à " + escapeHtml(item.assignee_name) : ""}${item.assignee_name && item.target_date ? " · " : ""}${item.target_date ? "Échéance " + formatDate(item.target_date) : ""}</div>` : ""}
      </div>
      ${canEditItem(item) ? `<button class="btn-icon" data-edit-item="${item.id}" style="width:26px;height:26px;flex:none;" title="Modifier">${ICONS.edit}</button>` : ""}
      ${isAdmin() ? `<button class="btn-icon item-delete-btn" data-delete-item="${item.id}" style="width:26px;height:26px;flex:none;" title="Supprimer">✕</button>` : ""}
    </div>`;
}

function taskBlockHtml(task) {
  return `
    <div class="process-task" data-task-block="${task.id}">
      <div class="pt-title flex items-center justify-between">
        <span>${task.code ? task.code + " - " : ""}${escapeHtml(task.title)} <span class="text-muted" style="font-weight:400;">(${task.progress_percent}%)</span></span>
        ${isAdmin() ? `<button class="btn-icon item-delete-btn" data-delete-task="${task.id}" style="width:24px;height:24px;flex:none;" title="Supprimer la tâche">✕</button>` : ""}
      </div>
      ${task.items.map(itemRowHtml).join("")}
      ${isAdmin() ? `<button class="btn btn-ghost btn-sm mt-1" data-add-item="${task.id}">+ Ajouter une action</button>` : ""}
    </div>`;
}

function phaseBlockHtml(phase) {
  const color = progressColor(phase.progress_percent);
  return `
    <details class="process-phase">
      <summary>
        <span class="badge badge-${color === "green" ? "green" : color === "orange" ? "orange" : "red"}">Phase ${phase.number}</span>
        <strong style="flex:1;">${escapeHtml(phase.title)}</strong>
        <span class="text-xs text-muted">${phase.progress_percent}%</span>
        ${isAdmin() ? `<button class="btn-icon item-delete-btn" data-delete-phase="${phase.id}" style="width:24px;height:24px;" title="Supprimer la phase" onclick="event.preventDefault(); event.stopPropagation();">✕</button>` : ""}
        <span class="chev">${ICONS.chevron}</span>
      </summary>
      <div class="mt-1">${progressBarHtml(phase.progress_percent, color)}</div>
      <div class="mt-2">${phase.tasks.map(taskBlockHtml).join("")}</div>
      ${isAdmin() ? `<div class="process-add-row"><button class="btn btn-ghost btn-sm" data-add-task="${phase.id}">+ Ajouter une tâche</button></div>` : ""}
    </details>`;
}

function sectionBlockHtml(section) {
  const color = progressColor(section.progress_percent);
  const nItems = section.phases.reduce((a, p) => a + p.tasks.reduce((b, t) => b + t.items.length, 0), 0);
  return `
    <details class="process-section">
      <summary>
        <span class="badge badge-gold">${escapeHtml(section.code)}</span>
        <div style="flex:1;">
          <strong>${escapeHtml(section.title)}</strong>
          <div class="text-xs text-muted">${section.phases.length} phase(s) · ${nItems} actions</div>
        </div>
        <span class="text-sm" style="font-weight:700;">${section.progress_percent}%</span>
        <span class="chev">${ICONS.chevron}</span>
      </summary>
      <div style="padding:0 1.1rem 1.1rem;">
        ${progressBarHtml(section.progress_percent, color)}
      </div>
      ${section.phases.map(phaseBlockHtml).join("")}
      ${isAdmin() ? `<div class="process-add-row" style="padding:0 1.1rem 1.1rem;"><button class="btn btn-light btn-sm" data-add-phase="${section.id}">+ Ajouter une étape générale (phase)</button></div>` : ""}
    </details>`;
}

function openItemModal(item) {
  const memberOptions = MEMBERS.map(
    (m) => `<option value="${m.id}" ${item.assigned_to_id === m.id ? "selected" : ""}>${escapeHtml(m.full_name)}</option>`
  ).join("");
  const isStaff = VIEWER.role === "admin" || VIEWER.role === "fondateur";
  openModal(`
    <div class="modal-head"><h3>Action n°${item.number}</h3><button class="btn-icon" onclick="closeModal()">✕</button></div>
    <p class="text-sm">${escapeHtml(item.description)}</p>
    <form id="item-form">
      <div class="field">
        <label>Statut</label>
        <select class="input" id="pi-status">
          <option value="non_entame" ${item.status === "non_entame" ? "selected" : ""}>Non entamé</option>
          <option value="en_cours" ${item.status === "en_cours" ? "selected" : ""}>En cours</option>
          <option value="valide" ${item.status === "valide" ? "selected" : ""}>Validé</option>
        </select>
      </div>
      ${isStaff ? `
      <div class="field"><label>Assignée à</label><select class="input" id="pi-assignee"><option value="">- Non assignée -</option>${memberOptions}</select></div>
      <div class="field"><label>Échéance</label><input class="input" id="pi-date" type="date" value="${item.target_date || ""}"></div>
      ` : ""}
      <div id="pi-error"></div>
      <button type="submit" class="btn btn-primary btn-block">Enregistrer</button>
    </form>`);
  document.getElementById("item-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = { status: document.getElementById("pi-status").value };
    if (isStaff) {
      const av = document.getElementById("pi-assignee").value;
      payload.assigned_to_id = av ? Number(av) : null;
      payload.target_date = document.getElementById("pi-date").value || null;
    }
    try {
      await Api.patch(`/api/process/items/${item.id}`, payload);
      closeModal();
      toast("Action mise à jour.", "success");
      await loadProcess();
    } catch (err) {
      document.getElementById("pi-error").innerHTML = `<div class="error-box">${escapeHtml(apiErrorMessage(err))}</div>`;
    }
  });
}

function openAddPhaseModal(sectionId) {
  openModal(`
    <div class="modal-head"><h3>Nouvelle étape générale (phase)</h3><button class="btn-icon" onclick="closeModal()">✕</button></div>
    <form id="add-phase-form">
      <div class="field"><label>Titre de la phase</label><input class="input" id="ap-title" required placeholder="Ex : Évaluation post-lancement"></div>
      <div class="field"><label>Numéro (optionnel, auto si vide)</label><input class="input" id="ap-number" type="number" min="1"></div>
      <div id="ap-error"></div>
      <button type="submit" class="btn btn-primary btn-block">Ajouter la phase</button>
    </form>`);
  document.getElementById("add-phase-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const numberVal = document.getElementById("ap-number").value;
      await Api.post(`/api/process/sections/${sectionId}/phases`, {
        title: document.getElementById("ap-title").value.trim(),
        number: numberVal ? Number(numberVal) : null,
      });
      closeModal();
      toast("Phase ajoutée.", "success");
      await loadProcess();
    } catch (err) {
      document.getElementById("ap-error").innerHTML = `<div class="error-box">${escapeHtml(apiErrorMessage(err))}</div>`;
    }
  });
}

function openAddTaskModal(phaseId) {
  openModal(`
    <div class="modal-head"><h3>Nouvelle tâche</h3><button class="btn-icon" onclick="closeModal()">✕</button></div>
    <form id="add-task-form">
      <div class="field"><label>Titre de la tâche</label><input class="input" id="at-title" required></div>
      <div class="field"><label>Code (optionnel, ex : 1.5)</label><input class="input" id="at-code"></div>
      <div id="at-error"></div>
      <button type="submit" class="btn btn-primary btn-block">Ajouter la tâche</button>
    </form>`);
  document.getElementById("add-task-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await Api.post(`/api/process/phases/${phaseId}/tasks`, {
        title: document.getElementById("at-title").value.trim(),
        code: document.getElementById("at-code").value.trim() || null,
      });
      closeModal();
      toast("Tâche ajoutée.", "success");
      await loadProcess();
    } catch (err) {
      document.getElementById("at-error").innerHTML = `<div class="error-box">${escapeHtml(apiErrorMessage(err))}</div>`;
    }
  });
}

function openAddItemModal(taskId) {
  const memberOptions = MEMBERS.map((m) => `<option value="${m.id}">${escapeHtml(m.full_name)}</option>`).join("");
  openModal(`
    <div class="modal-head"><h3>Nouvelle action</h3><button class="btn-icon" onclick="closeModal()">✕</button></div>
    <form id="add-item-form">
      <div class="field"><label>Description de l'action</label><textarea class="input" id="ai-desc" rows="3" required></textarea></div>
      <div class="form-row">
        <div class="field"><label>Assignée à</label><select class="input" id="ai-assignee"><option value="">- Non assignée -</option>${memberOptions}</select></div>
        <div class="field"><label>Échéance</label><input class="input" id="ai-date" type="date"></div>
      </div>
      <div id="ai-error"></div>
      <button type="submit" class="btn btn-primary btn-block">Ajouter l'action</button>
    </form>`);
  document.getElementById("add-item-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const av = document.getElementById("ai-assignee").value;
      await Api.post(`/api/process/tasks/${taskId}/items`, {
        description: document.getElementById("ai-desc").value.trim(),
        assigned_to_id: av ? Number(av) : null,
        target_date: document.getElementById("ai-date").value || null,
      });
      closeModal();
      toast("Action ajoutée.", "success");
      await loadProcess();
    } catch (err) {
      document.getElementById("ai-error").innerHTML = `<div class="error-box">${escapeHtml(apiErrorMessage(err))}</div>`;
    }
  });
}

async function deletePhase(id) {
  if (!confirm("Supprimer cette phase ainsi que toutes ses tâches et actions ?")) return;
  try {
    await Api.delete(`/api/process/phases/${id}`);
    toast("Phase supprimée.", "success");
    await loadProcess();
  } catch (err) { toast(apiErrorMessage(err), "error"); }
}
async function deleteTask(id) {
  if (!confirm("Supprimer cette tâche ainsi que toutes ses actions ?")) return;
  try {
    await Api.delete(`/api/process/tasks/${id}`);
    toast("Tâche supprimée.", "success");
    await loadProcess();
  } catch (err) { toast(apiErrorMessage(err), "error"); }
}
async function deleteItem(id) {
  if (!confirm("Supprimer cette action ?")) return;
  try {
    await Api.delete(`/api/process/items/${id}`);
    toast("Action supprimée.", "success");
    await loadProcess();
  } catch (err) { toast(apiErrorMessage(err), "error"); }
}

function attachTreeHandlers() {
  document.querySelectorAll("[data-edit-item]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = Number(btn.dataset.editItem);
      for (const s of SECTIONS) {
        for (const p of s.phases) {
          for (const t of p.tasks) {
            const item = t.items.find((i) => i.id === id);
            if (item) return openItemModal(item);
          }
        }
      }
    });
  });
  document.querySelectorAll("[data-add-phase]").forEach((btn) =>
    btn.addEventListener("click", () => openAddPhaseModal(Number(btn.dataset.addPhase)))
  );
  document.querySelectorAll("[data-add-task]").forEach((btn) =>
    btn.addEventListener("click", () => openAddTaskModal(Number(btn.dataset.addTask)))
  );
  document.querySelectorAll("[data-add-item]").forEach((btn) =>
    btn.addEventListener("click", () => openAddItemModal(Number(btn.dataset.addItem)))
  );
  document.querySelectorAll("[data-delete-phase]").forEach((btn) =>
    btn.addEventListener("click", () => deletePhase(Number(btn.dataset.deletePhase)))
  );
  document.querySelectorAll("[data-delete-task]").forEach((btn) =>
    btn.addEventListener("click", () => deleteTask(Number(btn.dataset.deleteTask)))
  );
  document.querySelectorAll("[data-delete-item]").forEach((btn) =>
    btn.addEventListener("click", () => deleteItem(Number(btn.dataset.deleteItem)))
  );
}

function renderOverall() {
  let totalItems = 0, valide = 0, enCours = 0, nonEntame = 0;
  for (const s of SECTIONS) for (const p of s.phases) for (const t of p.tasks) for (const i of t.items) {
    totalItems++;
    if (i.status === "valide") valide++;
    else if (i.status === "en_cours") enCours++;
    else nonEntame++;
  }
  const overallPct = totalItems ? Math.round(((valide * 100 + enCours * 50) / (totalItems * 100)) * 100) : 0;
  document.getElementById("overall-card").innerHTML = `
    <div class="flex items-center justify-between mb-1">
      <strong>Avancement global</strong><span style="font-weight:700; color:var(--gold);">${overallPct}%</span>
    </div>
    ${progressBarHtml(overallPct, "gold")}
    <div class="flex gap-2 mt-2" style="flex-wrap:wrap;">
      <span class="badge badge-red"><span class="dot dot-red"></span>${nonEntame} non entamées</span>
      <span class="badge badge-orange"><span class="dot dot-orange"></span>${enCours} en cours</span>
      <span class="badge badge-green"><span class="dot dot-green"></span>${valide} validées</span>
      <span class="badge badge-neutral">${totalItems} actions au total · ${SECTIONS.length} sections</span>
    </div>`;
}

async function loadProcess() {
  SECTIONS = await Api.get("/api/process");
  renderOverall();
  document.getElementById("process-tree").innerHTML = SECTIONS.map(sectionBlockHtml).join("");
  attachTreeHandlers();
}

(async function () {
  const user = await initShell({ active: "processus", title: "Processus de création" });
  if (!user) return;
  VIEWER = user;

  try {
    await loadProcess();
    MEMBERS = await Api.get("/api/users");
  } catch (err) {
    document.getElementById("process-tree").innerHTML = `<div class="empty-state">${escapeHtml(apiErrorMessage(err))}</div>`;
  }
})();
