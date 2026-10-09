let CURRENT_TAB = "expenses";
let EXPENSES = [];
let INCOMES = [];

function fmtFCFA(n) {
  return new Intl.NumberFormat("fr-FR").format(n) + " FCFA";
}

function renderSummary(summary) {
  const balanceColor = summary.balance >= 0 ? "var(--status-green)" : "var(--status-red)";
  document.getElementById("finance-summary").innerHTML = `
    <div class="fs-card card"><div class="label">Total des entrées</div><div class="value" style="color:var(--status-green);">${fmtFCFA(summary.total_income)}</div></div>
    <div class="fs-card card"><div class="label">Total des dépenses</div><div class="value" style="color:var(--status-red);">${fmtFCFA(summary.total_expenses)}</div></div>
    <div class="fs-card card"><div class="label">Solde</div><div class="value" style="color:${balanceColor};">${fmtFCFA(summary.balance)}</div></div>`;
}

function renderTabs() {
  document.getElementById("finance-tabs").innerHTML = `
    <button data-t="expenses" class="${CURRENT_TAB === "expenses" ? "active" : ""}">Dépenses (${EXPENSES.length})</button>
    <button data-t="incomes" class="${CURRENT_TAB === "incomes" ? "active" : ""}">Entrées (${INCOMES.length})</button>`;
  document.querySelectorAll("#finance-tabs button").forEach((btn) =>
    btn.addEventListener("click", () => { CURRENT_TAB = btn.dataset.t; renderTabs(); renderForm(); renderPanel(); })
  );
}

/* ---------------------------------------------------------------------
 * Formulaire d'ajout : toujours visible en haut de page (plus de modale),
 * son contenu s'adapte à l'onglet actif (Dépenses / Entrées).
 * --------------------------------------------------------------------- */
function renderForm() {
  const isExpense = CURRENT_TAB === "expenses";
  document.getElementById("finance-list-label").textContent = isExpense ? "Historique des dépenses" : "Historique des entrées";
  document.getElementById("finance-form-card").innerHTML = `
    <h3 style="font-size:1rem; margin-bottom:.9rem;">${isExpense ? "Enregistrer une dépense" : "Enregistrer une entrée"}</h3>
    <form id="finance-form">
      <div class="form-row">
        <div class="field" style="flex:2 1 220px;"><label>Libellé</label><input class="input" id="ff-label" required placeholder="${isExpense ? "Ex : Achat de matériel de bureau" : "Ex : Apport d'un associé"}"></div>
        <div class="field"><label>Montant (FCFA)</label><input class="input" id="ff-amount" type="number" min="1" step="1" required></div>
      </div>
      <div class="form-row">
        <div class="field"><label>${isExpense ? "Catégorie" : "Source"}</label><input class="input" id="ff-cat" placeholder="${isExpense ? "Ex : Matériel, Salaires, Transport..." : "Ex : Associés, Client, Subvention..."}"></div>
        <div class="field"><label>Date</label><input class="input" id="ff-date" type="date" required value="${new Date().toISOString().slice(0, 10)}"></div>
      </div>
      <div class="field"><label>Note (optionnel)</label><input class="input" id="ff-note" placeholder="Précision facultative"></div>
      <div id="ff-error"></div>
      <button type="submit" class="btn btn-primary">${isExpense ? "Enregistrer la dépense" : "Enregistrer l'entrée"}</button>
    </form>`;

  document.getElementById("finance-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errBox = document.getElementById("ff-error");
    errBox.innerHTML = "";
    const amountVal = Number(document.getElementById("ff-amount").value);
    if (!amountVal || amountVal <= 0) {
      errBox.innerHTML = `<div class="error-box">Merci de saisir un montant valide.</div>`;
      return;
    }
    const base = {
      label: document.getElementById("ff-label").value.trim(),
      amount: amountVal,
      note: document.getElementById("ff-note").value.trim() || null,
    };
    const payload = isExpense
      ? { ...base, category: document.getElementById("ff-cat").value.trim() || null, expense_date: document.getElementById("ff-date").value }
      : { ...base, source: document.getElementById("ff-cat").value.trim() || null, income_date: document.getElementById("ff-date").value };
    try {
      await Api.post(`/api/finances/${isExpense ? "expenses" : "incomes"}`, payload);
      toast(isExpense ? "Dépense enregistrée." : "Entrée enregistrée.", "success");
      await loadAll();
      renderForm(); // formulaire réinitialisé, prêt pour une nouvelle saisie
    } catch (err) {
      errBox.innerHTML = `<div class="error-box">${escapeHtml(apiErrorMessage(err))}</div>`;
    }
  });
}

function expenseRowHtml(e) {
  return `
    <div class="finance-row">
      <div>
        <div class="fr-label">${escapeHtml(e.label)}</div>
        <div class="fr-meta">${e.category ? escapeHtml(e.category) + " · " : ""}${formatDate(e.expense_date)}${e.recorded_by_name ? " · " + escapeHtml(e.recorded_by_name) : ""}${e.note ? " · " + escapeHtml(e.note) : ""}</div>
      </div>
      <div class="flex items-center gap-1">
        <div class="fr-amount expense">- ${fmtFCFA(e.amount)}</div>
        <button class="btn-icon" data-del-expense="${e.id}" style="width:30px;height:30px;">✕</button>
      </div>
    </div>`;
}
function incomeRowHtml(i) {
  return `
    <div class="finance-row">
      <div>
        <div class="fr-label">${escapeHtml(i.label)}</div>
        <div class="fr-meta">${i.source ? escapeHtml(i.source) + " · " : ""}${formatDate(i.income_date)}${i.recorded_by_name ? " · " + escapeHtml(i.recorded_by_name) : ""}${i.note ? " · " + escapeHtml(i.note) : ""}</div>
      </div>
      <div class="flex items-center gap-1">
        <div class="fr-amount income">+ ${fmtFCFA(i.amount)}</div>
        <button class="btn-icon" data-del-income="${i.id}" style="width:30px;height:30px;">✕</button>
      </div>
    </div>`;
}

function renderPanel() {
  const panel = document.getElementById("finance-panel");
  if (CURRENT_TAB === "expenses") {
    panel.innerHTML = EXPENSES.length
      ? EXPENSES.map(expenseRowHtml).join("")
      : `<div class="empty-state"><div class="icon">🧾</div>Aucune dépense enregistrée pour le moment.</div>`;
    document.querySelectorAll("[data-del-expense]").forEach((btn) =>
      btn.addEventListener("click", () => deleteExpense(Number(btn.dataset.delExpense)))
    );
  } else {
    panel.innerHTML = INCOMES.length
      ? INCOMES.map(incomeRowHtml).join("")
      : `<div class="empty-state"><div class="icon">💰</div>Aucune entrée enregistrée pour le moment.</div>`;
    document.querySelectorAll("[data-del-income]").forEach((btn) =>
      btn.addEventListener("click", () => deleteIncome(Number(btn.dataset.delIncome)))
    );
  }
}

async function deleteExpense(id) {
  if (!confirm("Supprimer cette dépense ?")) return;
  try {
    await Api.delete(`/api/finances/expenses/${id}`);
    toast("Dépense supprimée.", "success");
    await loadAll();
  } catch (err) { toast(apiErrorMessage(err), "error"); }
}
async function deleteIncome(id) {
  if (!confirm("Supprimer cette entrée ?")) return;
  try {
    await Api.delete(`/api/finances/incomes/${id}`);
    toast("Entrée supprimée.", "success");
    await loadAll();
  } catch (err) { toast(apiErrorMessage(err), "error"); }
}

async function loadAll() {
  const [expenses, incomes, summary] = await Promise.all([
    Api.get("/api/finances/expenses"),
    Api.get("/api/finances/incomes"),
    Api.get("/api/finances/summary"),
  ]);
  EXPENSES = expenses;
  INCOMES = incomes;
  renderSummary(summary);
  renderTabs();
  renderPanel();
}

(async function () {
  const user = await initShell({ active: "admin-finances", title: "Finances" });
  if (!user) return;
  if (user.role !== "admin") {
    document.getElementById("page-content").innerHTML = `<div class="empty-state">Accès réservé à l'administration.</div>`;
    return;
  }
  renderForm();
  try {
    await loadAll();
  } catch (err) {
    document.getElementById("finance-summary").innerHTML = `<div class="empty-state">${escapeHtml(apiErrorMessage(err))}</div>`;
  }
})();
