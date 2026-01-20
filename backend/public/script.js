// =====================
// TrackFast Front Page + Admin Login (FINAL – PAUSE FIXED)
// =====================

const BASE_URL = window.location.hostname.includes("localhost")
  ? "http://localhost:5000"
  : "https://trackfast.onrender.com";

// ===== ELEMENTS =====
const trackBtn = document.getElementById("trackBtn");
const trackingInput = document.getElementById("trackingInput");
const result = document.getElementById("result");
const loader = document.getElementById("loader");

const adminBtn = document.getElementById("adminBtn");
const adminModal = document.getElementById("adminModal");
const adminLoginBtn = document.getElementById("adminLoginBtn");
const adminEmail = document.getElementById("adminEmail");
const adminPassword = document.getElementById("adminPassword");
// Chat Elements
const chatToggleBtn = document.getElementById("chatToggleBtn");
const chatWidget = document.getElementById("chatWidget");
const chatCloseBtn = document.getElementById("chatCloseBtn");
const chatBody = document.getElementById("chatBody");
const chatInput = document.getElementById("chatInput");
const chatSendBtn = document.getElementById("chatSendBtn");

let currentParcelId = null;
let chatInterval = null;

// =====================
// HELPERS
// =====================
function showResult() {
  if (result) result.style.display = "block";
}
function hideResult() {
  if (result) result.style.display = "none";
}
function showLoader() {
  if (loader) loader.style.display = "block";
}
function hideLoader() {
  if (loader) loader.style.display = "none";
}

function escapeHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function fmtDate(d) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString();
  } catch {
    return "—";
  }
}

function getSteps() {
  return [
    "Order Received",
    "Processing",
    "Dispatched",
    "In Transit",
    "Out for Delivery",
    "Delivered",
  ];
}

function getProgress(status) {
  const steps = getSteps();
  const idx = steps.indexOf(status);
  if (idx === -1) return 10;
  return Math.round(((idx + 1) / steps.length) * 100);
}

function isDelivered(status = "") {
  return String(status).toLowerCase() === "delivered";
}

function iconForStatus(status = "") {
  const s = status.toLowerCase();
  if (s.includes("delivered")) return "✅";
  if (s.includes("out")) return "🛵";
  if (s.includes("transit")) return "🚚";
  if (s.includes("dispatched")) return "📦";
  if (s.includes("processing")) return "⚙️";
  if (s.includes("order")) return "🧾";
  return "📍";
}

function getCurrentLocation(parcel) {
  if (parcel.paused && parcel.pauseLocation) return parcel.pauseLocation;
  const tl = Array.isArray(parcel.timeline) ? parcel.timeline : [];
  return tl.length ? tl[tl.length - 1].location : parcel.origin || "—";
}

async function safeJson(res) {
  const ct = res.headers.get("content-type") || "";
  return ct.includes("application/json")
    ? res.json()
    : { message: await res.text() };
}

// =====================
// TRACK PARCEL
// =====================
async function trackParcel() {
  hideResult();
  showLoader();

  const trackingId = trackingInput.value.trim();
  if (!trackingId) {
    hideLoader();
    showResult();
    result.innerHTML = "";
    showToast?.("Enter tracking ID", "warning", "Tracking");
    return;
  }

  try {
    const res = await fetch(
      `${BASE_URL}/api/parcels/${encodeURIComponent(trackingId)}`
    );
    const data = await safeJson(res);

    hideLoader();
    showResult();

    if (!res.ok) {
      result.innerHTML = `<p class="error">❌ ${escapeHtml(
        data.message || "Not found"
      )}</p>`;
      return;
    }

    renderParcel(data);
  } catch {
    hideLoader();
    showResult();
    result.innerHTML = `<p class="error">❌ Server not reachable</p>`;
  }
}

trackBtn?.addEventListener("click", trackParcel);
trackingInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") trackParcel();
});

// =====================
// RENDER PARCEL (PAUSE FIXED)
// =====================
function renderParcel(parcel) {
  currentParcelId = parcel.id;
  if (chatToggleBtn) chatToggleBtn.classList.remove("hidden");

  const id = escapeHtml(parcel.id);
  const status = escapeHtml(parcel.status);
  const created = fmtDate(parcel.createdAt);
  const origin = escapeHtml(parcel.origin);
  const destination = escapeHtml(parcel.destination);
  const currentLoc = escapeHtml(getCurrentLocation(parcel));
  const delivered = isDelivered(parcel.status);
  const progress = delivered ? 100 : getProgress(parcel.status);

  const pausedBanner = parcel.paused
    ? `
      <div class="tf-banner paused">
        <div class="tf-banner-left">
          <div class="tf-banner-icon">⏸️</div>
          <div>
            <div class="tf-banner-title">Shipment Paused</div>
            <div class="tf-banner-sub">
              ${escapeHtml(parcel.pauseMessage || "Temporarily on hold")}
            </div>
            ${
              parcel.pauseLocation
                ? `<div class="tf-mini">Paused at <b>${escapeHtml(
                    parcel.pauseLocation
                  )}</b></div>`
                : ""
            }
          </div>
        </div>
        <div class="tf-banner-chip">Paused</div>
      </div>
    `
    : "";

  const timeline = [...(parcel.timeline || [])].reverse();

  result.innerHTML = `
    <div class="tf-wrap">
      <div class="tf-card">
        <div class="tf-head">
          <div>
            <div class="tf-kicker">Tracking ID</div>
            <div class="tf-id">${id}</div>
          </div>
          <div class="tf-head-right">
            <span class="tf-badge ${
              delivered ? "success" : parcel.paused ? "warning" : "info"
            }">
              ${iconForStatus(parcel.status)} ${status}
            </span>
            <div class="tf-sub">Created: ${escapeHtml(created)}</div>
          </div>
        </div>

        ${pausedBanner}

        <div class="tf-route">
          <div class="tf-route-box">
            <div class="tf-mini">From</div>
            <div class="tf-route-main">${origin}</div>
          </div>
          <div class="tf-route-mid">
            <div class="tf-mini">Current</div>
            <div class="tf-loc-pill">${currentLoc}</div>
          </div>
          <div class="tf-route-box">
            <div class="tf-mini">To</div>
            <div class="tf-route-main">${destination}</div>
          </div>
        </div>

        <div class="tf-progress">
          <div class="tf-mini">Delivery progress</div>
          <div class="tf-bar">
            <div class="tf-fill" style="width:${progress}%"></div>
          </div>
        </div>

        <div class="tf-history">
          <div class="tf-section-title">Tracking history</div>
          ${
            timeline.length
              ? timeline
                  .map(
                    (t, i) => `
                <div class="tf-event ${i === 0 ? "latest" : ""}">
                  <div class="tf-event-dot"></div>
                  <div class="tf-event-card compact">
                    <div class="tf-event-top">
                      <div class="tf-event-status">
                        ${iconForStatus(t.status)} ${escapeHtml(t.status)}
                        ${i === 0 ? `<span class="tf-chip">Latest</span>` : ""}
                      </div>
                      <div class="tf-event-time">${fmtDate(t.time)}</div>
                    </div>
                    <div class="tf-event-loc">📍 ${escapeHtml(t.location)}</div>
                  </div>
                </div>
              `
                  )
                  .join("")
              : `<div class="tf-empty">No tracking history yet</div>`
          }
        </div>
      </div>
    </div>
  `;
}

// =====================
// ADMIN LOGIN
// =====================
adminBtn?.addEventListener("click", () => {
  const token = localStorage.getItem("adminToken");
  if (token) window.location.href = "admin.html";
  else adminModal.style.display = "flex";
});

adminModal?.addEventListener("click", (e) => {
  if (e.target === adminModal) adminModal.style.display = "none";
});

adminLoginBtn?.addEventListener("click", loginAdmin);
[adminEmail, adminPassword].forEach((el) =>
  el?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") loginAdmin();
  })
);

async function loginAdmin() {
  const email = adminEmail.value.trim();
  const password = adminPassword.value.trim();
  if (!email || !password) return;

  try {
    adminLoginBtn.disabled = true;
    const res = await fetch(`${BASE_URL}/api/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.message);

    localStorage.setItem("adminToken", data.token);
    window.location.href = "admin.html";
  } catch {
    showToast?.("Login failed", "error", "Admin");
  } finally {
    adminLoginBtn.disabled = false;
  }
}

// =====================
// TESTIMONIALS SLIDER
// =====================
const sliderTrack = document.getElementById("sliderTrack");
if (sliderTrack) {
  // Duplicate for infinite scroll visual
  sliderTrack.innerHTML += sliderTrack.innerHTML;
}

// =====================
// CHAT LOGIC
// =====================
chatToggleBtn?.addEventListener("click", () => {
    chatWidget.classList.remove("hidden");
    chatToggleBtn.classList.add("hidden");
    loadMessages();
    startChatPolling();
});

chatCloseBtn?.addEventListener("click", () => {
    chatWidget.classList.add("hidden");
    chatToggleBtn.classList.remove("hidden");
    stopChatPolling();
});

chatSendBtn?.addEventListener("click", sendMessage);
chatInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendMessage();
});

async function sendMessage() {
    const content = chatInput.value.trim();
    if (!content || !currentParcelId) return;

    // Optimistic UI
    appendMessage({ sender: "user", content }, true);
    chatInput.value = "";

    try {
        await fetch(`${BASE_URL}/api/support/messages`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                parcelId: currentParcelId,
                sender: "user",
                content
            })
        });
        loadMessages(); // Sync
    } catch (err) {
        // console.error(err);
    }
}

async function loadMessages() {
    if (!currentParcelId) return;
    try {
        const res = await fetch(`${BASE_URL}/api/support/messages/${currentParcelId}`);
        const msgs = await safeJson(res);
        renderMessages(msgs);
    } catch (err) {
        console.error(err);
    }
}

function renderMessages(msgs) {
    if (!Array.isArray(msgs)) return;
    
    // Only rebuild if count changes to avoid flicker or sophisticated diffing
    // For now simple rebuild is fine for small chats
    const currentCount = chatBody.querySelectorAll('.chat-msg').length;
    if (msgs.length === currentCount) return;

    chatBody.innerHTML = "";
    
    // Intro message
    const intro = document.createElement("div");
    intro.className = "chat-placeholder";
    intro.innerHTML = `Connected to support<br><small>Tracking ID: ${currentParcelId}</small>`;
    chatBody.appendChild(intro);

    msgs.forEach(msg => appendMessage(msg, false));
    chatBody.scrollTop = chatBody.scrollHeight;
}

function appendMessage(msg, scroll = true) {
    const div = document.createElement("div");
    // Admin/Superadmin = admin style
    const isAdmin = msg.sender === "admin" || msg.sender === "superadmin";
    div.className = `chat-msg ${isAdmin ? "admin" : "user"}`;
    div.textContent = msg.content;
    
    // If append mode vs rebuild
    // verify not duplicate if optimistic? 
    // In this simple implementation, loadMessages wipes and rebuilds, so duplicates are transient
    
    chatBody.appendChild(div);
    if (scroll) chatBody.scrollTop = chatBody.scrollHeight;
}

function startChatPolling() {
    stopChatPolling();
    chatInterval = setInterval(loadMessages, 3500);
}

function stopChatPolling() {
    if (chatInterval) clearInterval(chatInterval);
}
