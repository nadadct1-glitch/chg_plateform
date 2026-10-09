let VIEWER = null;
let CURRENT_CHANNEL = "general";
let LAST_ID = 0;
let POLL_TIMER = null;
let IS_FOUNDER = false;

const CHANNELS = [
  { value: "general", label: "Général" },
  { value: "fondateurs", label: "Fondateurs" },
];

function msgHtml(m) {
  const mine = m.sender_id === VIEWER.id;
  return `
    <div class="chat-msg ${mine ? "mine" : ""}">
      ${avatarHtml({ full_name: m.sender_name, photo_url: m.sender_photo }, "sm")}
      <div>
        ${!mine ? `<div class="who">${escapeHtml(m.sender_name)}</div>` : ""}
        <div class="bubble">${escapeHtml(m.content)}</div>
        <div class="text-xs text-muted mt-1">${timeAgo(m.created_at)}</div>
      </div>
    </div>`;
}

function renderTabs() {
  const channels = IS_FOUNDER ? CHANNELS : CHANNELS.filter((c) => c.value === "general");
  document.getElementById("channel-tabs").innerHTML = channels
    .map((c) => `<button data-c="${c.value}" class="${CURRENT_CHANNEL === c.value ? "active" : ""}">${c.label}</button>`)
    .join("");
  document.querySelectorAll("#channel-tabs button").forEach((btn) =>
    btn.addEventListener("click", () => switchChannel(btn.dataset.c))
  );
}

function switchChannel(channel) {
  if (channel === CURRENT_CHANNEL) return;
  CURRENT_CHANNEL = channel;
  LAST_ID = 0;
  document.getElementById("messages").innerHTML = "";
  renderTabs();
  fetchMessages(true);
}

async function fetchMessages(initial = false) {
  try {
    const msgs = await Api.get(`/api/chat/${CURRENT_CHANNEL}?after_id=${LAST_ID}&limit=200`);
    if (!msgs.length) return;
    const box = document.getElementById("messages");
    const wasAtBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
    box.insertAdjacentHTML("beforeend", msgs.map(msgHtml).join(""));
    LAST_ID = msgs[msgs.length - 1].id;
    if (initial || wasAtBottom) box.scrollTop = box.scrollHeight;
  } catch (err) {
    if (initial) document.getElementById("messages").innerHTML = `<div class="empty-state">${escapeHtml(apiErrorMessage(err))}</div>`;
  }
}

(async function () {
  const user = await initShell({ active: "chat", title: "Discussion" });
  if (!user) return;
  VIEWER = user;
  IS_FOUNDER = user.role === "admin" || user.role === "fondateur";

  renderTabs();
  await fetchMessages(true);
  POLL_TIMER = setInterval(() => fetchMessages(false), 4000);
  window.addEventListener("beforeunload", () => clearInterval(POLL_TIMER));

  document.getElementById("chat-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = document.getElementById("chat-input");
    const content = input.value.trim();
    if (!content) return;
    input.value = "";
    try {
      await Api.post(`/api/chat/${CURRENT_CHANNEL}`, { channel: CURRENT_CHANNEL, content });
      await fetchMessages(false);
    } catch (err) {
      toast(apiErrorMessage(err), "error");
    }
  });
})();
