let VIEWER = null;
let MEMBERS = [];
let ALL_MEETINGS = [];
let IS_STAFF = false;

function responseBadge(resp) {
  if (resp === "accepte") return `<span class="badge badge-green">Confirmé</span>`;
  if (resp === "decline") return `<span class="badge badge-red">Décliné</span>`;
  return `<span class="badge badge-neutral">En attente</span>`;
}

function meetingCardHtml(m) {
  const mine = m.participants.find((p) => p.user.id === VIEWER.id);
  return `
    <div class="task-card" data-open-meeting="${m.id}">
      <div class="status-bar" style="background:var(--blue)"></div>
      <div class="body">
        <div class="title">${escapeHtml(m.title)}</div>
        <div class="meta">
          <span>📅 ${formatDateTime(m.starts_at)}</span>
          ${m.location ? `<span>📍 ${escapeHtml(m.location)}</span>` : ""}
          <span>👥 ${m.participants.length}</span>
          ${mine ? responseBadge(mine.response) : ""}
          ${m.minutes ? `<span class="badge badge-gold">Compte-rendu disponible</span>` : ""}
        </div>
      </div>
    </div>`;
}

function openMeetingModal(m) {
  const rows = m.participants
    .map((p) => `
      <div class="flex items-center justify-between" style="padding:.4rem 0; border-bottom:1px solid var(--border);">
        <div class="flex items-center gap-1">${avatarHtml(p.user, "sm")}<span class="text-sm">${escapeHtml(p.user.full_name)}</span></div>
        ${responseBadge(p.response)}
      </div>`)
    .join("");
  const mine = m.participants.find((p) => p.user.id === VIEWER.id);

  openModal(`
    <div class="modal-head"><h3>${escapeHtml(m.title)}</h3><button class="btn-icon" onclick="closeModal()">✕</button></div>
    <div class="text-sm text-muted mb-2">
      📅 ${formatDateTime(m.starts_at)}${m.ends_at ? " → " + formatDateTime(m.ends_at) : ""}<br>
      ${m.location ? "📍 " + escapeHtml(m.location) : ""}
    </div>
    ${m.description ? `<p>${escapeHtml(m.description)}</p>` : ""}
    ${mine ? `
      <div class="flex gap-1 mb-2">
        <button class="btn btn-primary btn-sm" id="rsvp-yes">Je serai présent(e)</button>
        <button class="btn btn-ghost btn-sm" id="rsvp-no">Décliner</button>
      </div>` : ""}
    <div class="section-label" style="margin-top:.5rem;">Participants</div>
    <div class="mb-2">${rows}</div>

    <div class="section-label">Compte-rendu / grandes lignes</div>
    ${IS_STAFF ? `
      <form id="minutes-form" class="mb-2">
        <textarea class="input" id="mn-text" rows="5" placeholder="Décisions prises, points clés abordés, actions à suivre...">${escapeHtml(m.minutes || "")}</textarea>
        <div id="mn-error"></div>
        <button type="submit" class="btn btn-primary btn-sm mt-1">Enregistrer le compte-rendu</button>
      </form>` : `
      <div class="card mb-2"><p style="margin:0; white-space:pre-wrap;">${m.minutes ? escapeHtml(m.minutes) : '<span class="text-muted">Aucun compte-rendu pour le moment.</span>'}</p></div>`}

    ${IS_STAFF ? `<button class="btn btn-danger btn-block" id="delete-meeting-btn">Supprimer la réunion</button>` : ""}
  `);

  const yes = document.getElementById("rsvp-yes");
  const no = document.getElementById("rsvp-no");
  if (yes) yes.addEventListener("click", () => rsvp(m.id, "accepte"));
  if (no) no.addEventListener("click", () => rsvp(m.id, "decline"));
  const minutesForm = document.getElementById("minutes-form");
  if (minutesForm) {
    minutesForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        await Api.patch(`/api/meetings/${m.id}/minutes`, { minutes: document.getElementById("mn-text").value.trim() });
        toast("Compte-rendu enregistré.", "success");
        await loadMeetings();
        closeModal();
      } catch (err) {
        document.getElementById("mn-error").innerHTML = `<div class="error-box">${escapeHtml(apiErrorMessage(err))}</div>`;
      }
    });
  }
  const del = document.getElementById("delete-meeting-btn");
  if (del) del.addEventListener("click", async () => {
    if (!confirm("Supprimer cette réunion ?")) return;
    try {
      await Api.delete(`/api/meetings/${m.id}`);
      closeModal();
      toast("Réunion supprimée.", "success");
      await loadMeetings();
    } catch (err) {
      toast(apiErrorMessage(err), "error");
    }
  });
}

async function rsvp(meetingId, response) {
  try {
    await Api.patch(`/api/meetings/${meetingId}/rsvp`, { response });
    closeModal();
    toast("Réponse enregistrée.", "success");
    await loadMeetings();
  } catch (err) {
    toast(apiErrorMessage(err), "error");
  }
}

function attachCardHandlers() {
  document.querySelectorAll("[data-open-meeting]").forEach((el) => {
    el.addEventListener("click", () => {
      const m = ALL_MEETINGS.find((x) => x.id === Number(el.dataset.openMeeting));
      if (m) openMeetingModal(m);
    });
  });
}

function openNewMeetingModal() {
  const checks = MEMBERS.map(
    (m) => `<label class="checkbox-row" style="padding:.3rem 0;"><input type="checkbox" value="${m.id}" class="nm-participant"><span class="text-sm">${escapeHtml(m.full_name)} - ${escapeHtml(m.role_label)}</span></label>`
  ).join("");
  openModal(`
    <div class="modal-head"><h3>Nouvelle réunion</h3><button class="btn-icon" onclick="closeModal()">✕</button></div>
    <form id="new-meeting-form">
      <div class="field"><label>Titre</label><input class="input" id="nm-title" required></div>
      <div class="field"><label>Description</label><textarea class="input" id="nm-desc" rows="2"></textarea></div>
      <div class="form-row">
        <div class="field"><label>Début</label><input class="input" id="nm-start" type="datetime-local" required></div>
        <div class="field"><label>Fin</label><input class="input" id="nm-end" type="datetime-local"></div>
      </div>
      <div class="field"><label>Lieu</label><input class="input" id="nm-location" placeholder="Siège, visioconférence..."></div>
      <div class="field"><label>Participants</label><div style="max-height:180px; overflow-y:auto; border:1px solid var(--border); border-radius:var(--radius-sm); padding:.5rem .8rem;">${checks}</div></div>
      <div id="nm-error"></div>
      <button type="submit" class="btn btn-primary btn-block">Planifier la réunion</button>
    </form>`);
  document.getElementById("new-meeting-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const participantIds = Array.from(document.querySelectorAll(".nm-participant:checked")).map((c) => Number(c.value));
    try {
      await Api.post("/api/meetings", {
        title: document.getElementById("nm-title").value.trim(),
        description: document.getElementById("nm-desc").value.trim() || null,
        starts_at: document.getElementById("nm-start").value,
        ends_at: document.getElementById("nm-end").value || null,
        location: document.getElementById("nm-location").value.trim() || null,
        participant_ids: participantIds,
      });
      closeModal();
      toast("Réunion planifiée.", "success");
      await loadMeetings();
    } catch (err) {
      document.getElementById("nm-error").innerHTML = `<div class="error-box">${escapeHtml(apiErrorMessage(err))}</div>`;
    }
  });
}

async function loadMeetings() {
  ALL_MEETINGS = await Api.get("/api/meetings");
  const now = new Date();
  const upcoming = ALL_MEETINGS.filter((m) => new Date(m.starts_at) >= now);
  const past = ALL_MEETINGS.filter((m) => new Date(m.starts_at) < now).slice(0, 10);

  document.getElementById("upcoming-list").innerHTML = upcoming.length
    ? upcoming.map(meetingCardHtml).join("")
    : `<div class="empty-state"><div class="icon">📅</div>Aucune réunion à venir.</div>`;
  document.getElementById("past-list").innerHTML = past.length
    ? past.map(meetingCardHtml).join("")
    : `<div class="empty-state"><div class="icon">🗓️</div>Aucune réunion passée.</div>`;
  attachCardHandlers();

  const params = new URLSearchParams(window.location.search);
  const focusId = params.get("id");
  if (focusId) {
    const m = ALL_MEETINGS.find((x) => x.id === Number(focusId));
    if (m) openMeetingModal(m);
  }
}

(async function () {
  const user = await initShell({ active: "reunions", title: "Réunions" });
  if (!user) return;
  VIEWER = user;
  IS_STAFF = user.role === "admin" || user.role === "fondateur";

  try {
    await loadMeetings();
  } catch (err) {
    document.getElementById("upcoming-list").innerHTML = `<div class="empty-state">${escapeHtml(apiErrorMessage(err))}</div>`;
  }

  if (IS_STAFF) {
    document.getElementById("new-meeting-btn").style.display = "inline-flex";
    document.getElementById("fab-add").style.display = "flex";
    try {
      MEMBERS = await Api.get("/api/users");
    } catch {}
    document.getElementById("new-meeting-btn").addEventListener("click", openNewMeetingModal);
    document.getElementById("fab-add").addEventListener("click", openNewMeetingModal);
  }
})();
