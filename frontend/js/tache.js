let TASK_ID = null;
let TASK = null;
let VIEWER = null;
let MEMBERS = [];

function canManage() {
  return VIEWER.role === "admin" || VIEWER.role === "fondateur";
}
function canTouchSteps() {
  return canManage() || (TASK.assignee && TASK.assignee.id === VIEWER.id);
}

function stepStatusButtons(step) {
  const options = [
    { v: "non_entame", cls: "dot-red", title: "Non entamé" },
    { v: "en_cours", cls: "dot-orange", title: "En cours" },
    { v: "valide", cls: "dot-green", title: "Validé" },
  ];
  return options
    .map(
      (o) => `<button class="btn-icon" data-step="${step.id}" data-status="${o.v}"
        style="width:26px;height:26px;border-color:${step.status === o.v ? "var(--gold)" : "var(--border)"};"
        title="${o.title}"><span class="dot ${o.cls}"></span></button>`
    )
    .join("");
}

function stepRowHtml(step) {
  const sm = statusMeta(step.status);
  return `
    <div class="step-row" data-step-row="${step.id}">
      <div class="step-dot" style="background:${sm.badge === "badge-red" ? "var(--status-red-soft)" : sm.badge === "badge-orange" ? "var(--status-orange-soft)" : "var(--status-green-soft)"}; color:var(--${sm.color === "gold" ? "gold" : "status-" + sm.color});">
        ${step.status === "valide" ? "✓" : ""}
      </div>
      <div class="step-body">
        <div class="step-title">${escapeHtml(step.title)}</div>
        <div class="step-date">${step.step_date ? formatDate(step.step_date) : "Date non définie"}</div>
      </div>
      ${canTouchSteps() ? `<div class="flex gap-1">${stepStatusButtons(step)}</div>` : `<span class="badge ${sm.badge}">${sm.label}</span>`}
      ${canManage() ? `<button class="btn-icon" data-delete-step="${step.id}" title="Supprimer" style="width:26px;height:26px;">✕</button>` : ""}
    </div>`;
}

function attachStepHandlers() {
  document.querySelectorAll("[data-step][data-status]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        TASK = await Api.patch(`/api/tasks/${TASK_ID}/steps/${btn.dataset.step}`, { status: btn.dataset.status });
        renderTask();
      } catch (err) {
        toast(apiErrorMessage(err), "error");
      }
    });
  });
  document.querySelectorAll("[data-delete-step]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Supprimer cette étape ?")) return;
      try {
        TASK = await Api.delete(`/api/tasks/${TASK_ID}/steps/${btn.dataset.deleteStep}`);
        renderTask();
      } catch (err) {
        toast(apiErrorMessage(err), "error");
      }
    });
  });
}

function openAddStepModal() {
  openModal(`
    <div class="modal-head"><h3>Ajouter une étape</h3><button class="btn-icon" onclick="closeModal()">✕</button></div>
    <form id="add-step-form">
      <div class="field"><label>Titre de l'étape</label><input class="input" id="as-title" required></div>
      <div class="field"><label>Date prévue</label><input class="input" id="as-date" type="date"></div>
      <div id="as-error"></div>
      <button type="submit" class="btn btn-primary btn-block">Ajouter</button>
    </form>`);
  document.getElementById("add-step-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      TASK = await Api.post(`/api/tasks/${TASK_ID}/steps`, {
        title: document.getElementById("as-title").value.trim(),
        step_date: document.getElementById("as-date").value || null,
        status: "non_entame",
      });
      closeModal();
      renderTask();
    } catch (err) {
      document.getElementById("as-error").innerHTML = `<div class="error-box">${escapeHtml(apiErrorMessage(err))}</div>`;
    }
  });
}

function openEditTaskModal() {
  const memberOptions = MEMBERS.map(
    (m) => `<option value="${m.id}" ${TASK.assignee && TASK.assignee.id === m.id ? "selected" : ""}>${escapeHtml(m.full_name)} - ${escapeHtml(m.role_label)}</option>`
  ).join("");
  openModal(`
    <div class="modal-head"><h3>Modifier la tâche</h3><button class="btn-icon" onclick="closeModal()">✕</button></div>
    <form id="edit-task-form">
      <div class="field"><label>Titre</label><input class="input" id="et-title" value="${escapeHtml(TASK.title)}" required></div>
      <div class="field"><label>Description</label><textarea class="input" id="et-desc" rows="3">${escapeHtml(TASK.description || "")}</textarea></div>
      <div class="form-row">
        <div class="field"><label>Catégorie</label><input class="input" id="et-cat" value="${escapeHtml(TASK.category || "")}"></div>
        <div class="field"><label>Affectée à</label><select class="input" id="et-assignee"><option value="">- Non affectée -</option>${memberOptions}</select></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Début</label><input class="input" id="et-start" type="date" value="${TASK.start_date || ""}"></div>
        <div class="field"><label>Fin</label><input class="input" id="et-end" type="date" value="${TASK.end_date || ""}"></div>
      </div>
      <div id="et-error"></div>
      <div class="flex gap-1">
        <button type="submit" class="btn btn-primary btn-block">Enregistrer</button>
      </div>
    </form>
    <button class="btn btn-danger btn-block mt-1" id="delete-task-btn">Supprimer la tâche</button>`);

  document.getElementById("edit-task-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const assigneeVal = document.getElementById("et-assignee").value;
      TASK = await Api.patch(`/api/tasks/${TASK_ID}`, {
        title: document.getElementById("et-title").value.trim(),
        description: document.getElementById("et-desc").value.trim() || null,
        category: document.getElementById("et-cat").value.trim() || null,
        assigned_to_id: assigneeVal ? Number(assigneeVal) : null,
        start_date: document.getElementById("et-start").value || null,
        end_date: document.getElementById("et-end").value || null,
      });
      closeModal();
      renderTask();
    } catch (err) {
      document.getElementById("et-error").innerHTML = `<div class="error-box">${escapeHtml(apiErrorMessage(err))}</div>`;
    }
  });
  document.getElementById("delete-task-btn").addEventListener("click", async () => {
    if (!confirm("Supprimer définitivement cette tâche ?")) return;
    try {
      await Api.delete(`/api/tasks/${TASK_ID}`);
      window.location.href = "/app/taches.html";
    } catch (err) {
      toast(apiErrorMessage(err), "error");
    }
  });
}

function renderTask() {
  const sm = statusMeta(TASK.status);
  document.title = `${TASK.title} - CHG`;
  document.getElementById("task-root").innerHTML = `
    <div class="card mb-2">
      <div class="flex items-center justify-between" style="flex-wrap:wrap; gap:.7rem;">
        <div>
          <span class="badge badge-neutral">${escapeHtml(TASK.category || "Général")}</span>
          <h2 style="margin:.5rem 0 .2rem;">${escapeHtml(TASK.title)}</h2>
        </div>
        <span class="badge ${sm.badge}"><span class="dot ${sm.dot}"></span>${sm.label}</span>
      </div>
      ${TASK.description ? `<p class="mt-1">${escapeHtml(TASK.description)}</p>` : ""}
      <div class="mt-1">${progressBarHtml(TASK.progress_percent, sm.color)}</div>
      <div class="grid grid-3 mt-2">
        <div class="text-sm"><span class="text-muted">Créée par</span><br>${TASK.creator ? escapeHtml(TASK.creator.full_name) : "—"}</div>
        <div class="text-sm"><span class="text-muted">Affectée à</span><br>${TASK.assignee ? escapeHtml(TASK.assignee.full_name) : "Non affectée"}</div>
        <div class="text-sm"><span class="text-muted">Période</span><br>${TASK.start_date ? formatDate(TASK.start_date) : "?"} → ${TASK.end_date ? formatDate(TASK.end_date) : "?"}</div>
      </div>
      ${canManage() ? `<button class="btn btn-ghost btn-sm mt-2" id="edit-task-btn">${ICONS.edit} Modifier</button>` : ""}
    </div>

    <div class="flex items-center justify-between">
      <div class="section-label" style="margin-top:0;">Calendrier de déroulement</div>
      ${canManage() ? `<button class="btn btn-ghost btn-sm" id="add-step-btn">+ Étape</button>` : ""}
    </div>
    <div class="card">
      ${TASK.steps.length ? TASK.steps.map(stepRowHtml).join("") : `<p class="text-sm text-muted" style="margin:0;">Aucune étape définie pour cette tâche.</p>`}
    </div>
  `;

  const editBtn = document.getElementById("edit-task-btn");
  if (editBtn) editBtn.addEventListener("click", openEditTaskModal);
  const addStepBtn = document.getElementById("add-step-btn");
  if (addStepBtn) addStepBtn.addEventListener("click", openAddStepModal);
  attachStepHandlers();
}

(async function () {
  const user = await initShell({ active: "taches", title: "Détail de la tâche" });
  if (!user) return;
  VIEWER = user;

  const params = new URLSearchParams(window.location.search);
  TASK_ID = params.get("id");
  if (!TASK_ID) {
    window.location.href = "/app/taches.html";
    return;
  }

  try {
    TASK = await Api.get(`/api/tasks/${TASK_ID}`);
    renderTask();
    if (canManage()) MEMBERS = await Api.get("/api/users");
  } catch (err) {
    document.getElementById("task-root").innerHTML = `<div class="empty-state">${escapeHtml(apiErrorMessage(err))}</div>`;
  }
})();
