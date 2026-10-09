let CURRENT_STATUS = "tous";
let ALL_TASKS = [];
let IS_STAFF = false;
let MEMBERS = [];

const STATUS_TABS = [
  { value: "tous", label: "Toutes" },
  { value: "non_entame", label: "Non entamées" },
  { value: "en_cours", label: "En cours" },
  { value: "valide", label: "Validées" },
];

function renderTabs() {
  document.getElementById("status-tabs").innerHTML = STATUS_TABS.map((t) => {
    const count = t.value === "tous" ? ALL_TASKS.length : ALL_TASKS.filter((x) => x.status === t.value).length;
    return `<button data-v="${t.value}" class="${CURRENT_STATUS === t.value ? "active" : ""}">${t.label} (${count})</button>`;
  }).join("");
  document.querySelectorAll("#status-tabs button").forEach((btn) =>
    btn.addEventListener("click", () => {
      CURRENT_STATUS = btn.dataset.v;
      renderTabs();
      renderList();
    })
  );
}

function renderList() {
  const list = CURRENT_STATUS === "tous" ? ALL_TASKS : ALL_TASKS.filter((t) => t.status === CURRENT_STATUS);
  document.getElementById("tasks-list").innerHTML = list.length
    ? list.map((t) => taskCardHtml(t)).join("")
    : `<div class="empty-state"><div class="icon">🗂️</div>Aucune tâche ici pour le moment.</div>`;
}

function openNewTaskModal() {
  const memberOptions = MEMBERS.map((m) => `<option value="${m.id}">${escapeHtml(m.full_name)} - ${escapeHtml(m.role_label)}</option>`).join("");
  openModal(`
    <div class="modal-head"><h3>Nouvelle tâche</h3><button class="btn-icon" onclick="closeModal()">✕</button></div>
    <form id="new-task-form">
      <div class="field"><label>Titre</label><input class="input" id="nt-title" required></div>
      <div class="field"><label>Description</label><textarea class="input" id="nt-desc" rows="3"></textarea></div>
      <div class="form-row">
        <div class="field"><label>Catégorie</label><input class="input" id="nt-cat" placeholder="Ex : Juridique, Communication..."></div>
        <div class="field"><label>Affectée à</label><select class="input" id="nt-assignee"><option value="">- Non affectée -</option>${memberOptions}</select></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Date de début</label><input class="input" id="nt-start" type="date"></div>
        <div class="field"><label>Date de fin</label><input class="input" id="nt-end" type="date"></div>
      </div>
      <div id="nt-error"></div>
      <button type="submit" class="btn btn-primary btn-block">Créer la tâche</button>
    </form>`);
  document.getElementById("new-task-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errBox = document.getElementById("nt-error");
    try {
      const assigneeVal = document.getElementById("nt-assignee").value;
      const created = await Api.post("/api/tasks", {
        title: document.getElementById("nt-title").value.trim(),
        description: document.getElementById("nt-desc").value.trim() || null,
        category: document.getElementById("nt-cat").value.trim() || null,
        assigned_to_id: assigneeVal ? Number(assigneeVal) : null,
        start_date: document.getElementById("nt-start").value || null,
        end_date: document.getElementById("nt-end").value || null,
      });
      closeModal();
      window.location.href = `/app/tache.html?id=${created.id}`;
    } catch (err) {
      errBox.innerHTML = `<div class="error-box">${escapeHtml(apiErrorMessage(err))}</div>`;
    }
  });
}

(async function () {
  const user = await initShell({ active: "taches", title: "Tâches" });
  if (!user) return;
  IS_STAFF = user.role === "admin" || user.role === "fondateur";

  try {
    const scope = IS_STAFF ? "" : "?mine=true";
    ALL_TASKS = await Api.get(`/api/tasks${scope}`);
    renderTabs();
    renderList();
  } catch (err) {
    document.getElementById("tasks-list").innerHTML = `<div class="empty-state">Impossible de charger les tâches.</div>`;
  }

  if (IS_STAFF) {
    document.getElementById("new-task-btn").style.display = "inline-flex";
    document.getElementById("fab-add").style.display = "flex";
    try {
      MEMBERS = await Api.get("/api/users");
    } catch {}
    document.getElementById("new-task-btn").addEventListener("click", openNewTaskModal);
    document.getElementById("fab-add").addEventListener("click", openNewTaskModal);
  }
})();
