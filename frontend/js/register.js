const PUBLIC_ROLES = ["associe", "associe_junior", "employe", "employe_junior", "etudiant"];

(async function initRegisterPage() {
  const select = document.getElementById("requested_role");
  try {
    const roles = await Api.get("/api/content/roles");
    select.innerHTML = roles
      .filter((r) => PUBLIC_ROLES.includes(r.value))
      .map((r) => `<option value="${r.value}">${escapeHtml(r.label)}</option>`)
      .join("");
  } catch {
    select.innerHTML = `
      <option value="associe">Associé</option>
      <option value="associe_junior">Associé Junior</option>
      <option value="employe">Employé</option>
      <option value="employe_junior">Employé Junior</option>
      <option value="etudiant">Étudiant / Stagiaire</option>`;
  }

  // Pré-remplit le domaine si l'on arrive depuis la liste des domaines de la page d'accueil
  const params = new URLSearchParams(window.location.search);
  const domaine = params.get("domaine");
  if (domaine) document.getElementById("domain_interest").value = domaine;
})();

document.getElementById("apply-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = document.getElementById("submit-btn");
  const msgBox = document.getElementById("msg-box");
  msgBox.innerHTML = "";
  btn.disabled = true;
  btn.textContent = "Envoi en cours...";

  const payload = {
    full_name: document.getElementById("full_name").value.trim(),
    email: document.getElementById("email").value.trim() || null,
    phone: document.getElementById("phone").value.trim() || null,
    requested_role: document.getElementById("requested_role").value,
    domain_interest: document.getElementById("domain_interest").value.trim() || null,
    motivation: document.getElementById("motivation").value.trim() || null,
  };

  try {
    await Api.post("/api/registrations", payload);
    document.getElementById("form-panel").innerHTML = `
      <div class="success-box">
        Votre candidature a bien été envoyée. L'administration du conglomérat va l'examiner
        et vous contactera avec vos identifiants de connexion si elle est retenue.
      </div>
      <a href="/index.html" class="btn btn-ghost btn-block mt-2">Retour à l'accueil</a>`;
  } catch (err) {
    msgBox.innerHTML = `<div class="error-box">${escapeHtml(apiErrorMessage(err))}</div>`;
    btn.disabled = false;
    btn.textContent = "Envoyer ma candidature";
  }
});
