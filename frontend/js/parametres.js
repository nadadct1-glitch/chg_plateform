(async function () {
  const user = await initShell({ active: "parametres", title: "Paramètres" });
  if (!user) return;

  document.getElementById("account-card").innerHTML = `
    <div class="flex items-center gap-2">
      ${avatarHtml(user, "lg")}
      <div>
        <div style="font-weight:700; font-size:1.05rem;">${escapeHtml(user.full_name)}</div>
        <span class="role-chip">${escapeHtml(user.role_label)}</span>
        <div class="text-sm text-muted mt-1">Identifiant : ${escapeHtml(user.username)}</div>
      </div>
    </div>
    <a href="/app/profil.html?id=${user.id}" class="btn btn-ghost btn-sm mt-2">Voir / modifier mon profil complet</a>`;

  document.getElementById("password-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = document.getElementById("pwd-msg");
    msg.innerHTML = "";
    try {
      await Api.post("/api/auth/change-password", {
        current_password: document.getElementById("cur-pwd").value,
        new_password: document.getElementById("new-pwd").value,
      });
      msg.innerHTML = `<div class="success-box">Mot de passe mis à jour avec succès.</div>`;
      document.getElementById("password-form").reset();
    } catch (err) {
      msg.innerHTML = `<div class="error-box">${escapeHtml(apiErrorMessage(err))}</div>`;
    }
  });

  if (user.role === "admin") {
    document.getElementById("admin-links").innerHTML = `
      <div class="section-label">Administration</div>
      <div class="grid grid-4 mb-2">
        <a href="/admin/utilisateurs.html" class="card card-hover" style="text-decoration:none; text-align:center;">
          <div style="color:var(--gold); margin-bottom:.4rem;">${ICONS.shield}</div>
          <div class="text-sm" style="font-weight:700; color:var(--text-primary);">Utilisateurs</div>
        </a>
        <a href="/admin/candidatures.html" class="card card-hover" style="text-decoration:none; text-align:center;">
          <div style="color:var(--gold); margin-bottom:.4rem;">${ICONS.inbox}</div>
          <div class="text-sm" style="font-weight:700; color:var(--text-primary);">Candidatures</div>
        </a>
        <a href="/admin/finances.html" class="card card-hover" style="text-decoration:none; text-align:center;">
          <div style="color:var(--gold); margin-bottom:.4rem;">${ICONS.finances}</div>
          <div class="text-sm" style="font-weight:700; color:var(--text-primary);">Finances</div>
        </a>
        <a href="/admin/contenu.html" class="card card-hover" style="text-decoration:none; text-align:center;">
          <div style="color:var(--gold); margin-bottom:.4rem;">${ICONS.edit}</div>
          <div class="text-sm" style="font-weight:700; color:var(--text-primary);">Contenu du site</div>
        </a>
      </div>`;
  }

  document.getElementById("logout-btn").addEventListener("click", logout);
})();
