// =====================
// TrackFast Front Page + Admin Login (PRODUCTION SAFE)
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

function statusTone(status = "") {
  const s = String(status).toLowerCase();
  if (s.includes("delivered")) return "success";
  if (s.includes("out for delivery")) return "info";
  if (s.includes("transit") || s.includes("dispatched")) return "warning";
  if (s.includes("processing")) return "neutral";
  return "neutral";
}

function iconForStatus(status = "") {
  const s = String(status).toLowerCase();
  if (s.includes("delivered")) return "✅";
  if (s.includes("out for delivery")) return "🛵";
  if (s.includes("transit")) return "🚚";
  if (s.includes("dispatched")) return "📦";
  if (s.includes("processing")) return "⚙️";
  if (s.includes("received")) return "🧾";
  return "📍";
}

function getCurrentLocation(parcel) {
  const tl = Array.isArray(parcel.timeline) ? parcel.timeline : [];
  return tl.length ? tl[tl.length - 1].location : parcel.origin || "—";
}

async function safeJson(res) {
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  return { message: await res.text() };
}

// =====================
// TRACK PARCEL
// =====================
async function trackParcel() {
  if (!trackingInput) return;

  hideResult();
  showLoader();

  const trackingId = trackingInput.value.trim();

  if (!trackingId) {
    hideLoader();
    showResult();
    showToast?.("Please enter a tracking ID", "warning", "Tracking");
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
      const msg = data?.message || "Parcel not found";
      result.innerHTML = `<p class="error">❌ ${escapeHtml(msg)}</p>`;
      showToast?.(msg, "error", "Failed");
      return;
    }

    // ✅ PAUSED — SHOW HISTORY + PAUSE LOCATION
    if (data.paused) {
      const pauseMsg =
        data.pauseMessage ||
        data.pause_message ||
        "Tracking temporarily unavailable";

      const pauseLoc = data.pauseLocation || getCurrentLocation(data) || "—";

      // clone timeline safely
      const timeline = Array.isArray(data.timeline) ? [...data.timeline] : [];

      // add PAUSE event (virtual, not saved)
      timeline.push({
        status: "Paused",
        location: pauseLoc,
        time: new Date().toISOString(),
        _paused: true,
      });

      // reuse normal renderer logic
      renderParcel({
        ...data,
        timeline,
        status: data.status, // keep last real status
      });

      // inject pause banner ABOVE history
      const banner = document.createElement("div");
      banner.innerHTML = `
    <div class="tf-banner paused">
      <div class="tf-banner-left">
        <div class="tf-banner-icon">⏸️</div>
        <div>
          <div class="tf-banner-title">Tracking Paused</div>
          <div class="tf-banner-sub">
            ${escapeHtml(pauseMsg)}<br />
            <small>📍 Paused at: <b>${escapeHtml(pauseLoc)}</b></small>
          </div>
        </div>
      </div>
      <div class="tf-banner-chip">Hold</div>
    </div>
  `;

      const card = result.querySelector(".tf-card");
      if (card) card.insertBefore(banner.firstElementChild, card.children[1]);

      showToast?.("Tracking paused", "warning", "Paused");
      return;
    }

    // ✅ ACTIVE → RENDER FULL TRACKING
    renderParcel(data);
    showToast?.("Tracking loaded", "success", "Success");
  } catch (err) {
    hideLoader();
    showResult();
    result.innerHTML = `<p class="error">❌ Server not reachable</p>`;
    showToast?.("Server unreachable. Try again.", "error", "Network");
  }
}

if (trackBtn) trackBtn.addEventListener("click", trackParcel);

if (trackingInput) {
  trackingInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") trackParcel();
  });
}

// =====================
// ADMIN LOGIN
// =====================
function openAdminModal() {
  if (!adminModal) return;
  adminModal.style.display = "flex";
  setTimeout(() => adminEmail?.focus(), 50);
}

function closeAdminModal() {
  if (!adminModal) return;
  adminModal.style.display = "none";
}

if (adminBtn) {
  adminBtn.addEventListener("click", (e) => {
    e.preventDefault();
    const token = localStorage.getItem("adminToken");
    if (token) {
      window.location.href = "admin.html";
      return;
    }
    openAdminModal();
  });
}

if (adminModal) {
  adminModal.addEventListener("click", (e) => {
    if (e.target === adminModal) closeAdminModal();
  });
}

async function loginAdmin() {
  const email = adminEmail.value.trim();
  const password = adminPassword.value.trim();

  if (!email || !password) {
    showToast?.("Enter email and password", "warning", "Login");
    return;
  }

  try {
    adminLoginBtn.disabled = true;
    adminLoginBtn.textContent = "Logging in...";

    const res = await fetch(`${BASE_URL}/api/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await safeJson(res);

    if (!res.ok) {
      showToast?.(data.message || "Login failed", "error", "Denied");
      return;
    }

    localStorage.setItem("adminToken", data.token);
    showToast?.("Login successful", "success", "Welcome");
    closeAdminModal();

    adminEmail.value = "";
    adminPassword.value = "";

    setTimeout(() => {
      window.location.href = "admin.html";
    }, 400);
  } catch {
    showToast?.("Server unreachable", "error", "Network");
  } finally {
    adminLoginBtn.disabled = false;
    adminLoginBtn.textContent = "Login";
  }
}

if (adminLoginBtn) adminLoginBtn.addEventListener("click", loginAdmin);

[adminEmail, adminPassword].forEach((el) => {
  el?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") loginAdmin();
  });
});
