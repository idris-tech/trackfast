// ===== ELEMENTS =====
const trackBtn = document.getElementById("trackBtn");
const result = document.getElementById("result");
const loader = document.getElementById("loader");

const adminBtn = document.getElementById("adminBtn");
const adminModal = document.getElementById("adminModal");
const adminLoginBtn = document.getElementById("adminLoginBtn");
const adminEmail = document.getElementById("adminEmail");
const adminPassword = document.getElementById("adminPassword");

// ✅ AUTO BASE URL
// - If you opened frontend from backend (localhost:5000) => BASE_URL = ""
// - If you opened frontend from Live Server (5500) => BASE_URL = "http://localhost:5000"
const BASE_URL = window.location.port === "5000" ? "" : "http://localhost:5000";

// ===== HELPERS =====
async function safeJson(res) {
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  return { message: await res.text() };
}

function showError(msg) {
  result.style.display = "block";
  result.innerHTML = `<p class="error">❌ ${msg}</p>`;
  window.showToast?.(msg, "error", "Error");
}

function setLoading(isLoading) {
  loader.style.display = isLoading ? "block" : "none";
  if (isLoading) result.style.display = "none";
}

// ===== TRACK PARCEL =====
trackBtn?.addEventListener("click", async () => {
  const trackingId = document.getElementById("trackingInput").value.trim();

  if (!trackingId) {
    result.innerHTML = "";
    window.showToast?.("Please enter a tracking ID", "warning", "Tracking");
    return;
  }

  setLoading(true);

  try {
    const res = await fetch(
      `${BASE_URL}/api/parcels/${encodeURIComponent(trackingId)}`
    );

    const data = await safeJson(res);
    setLoading(false);

    if (!res.ok) {
      const msg = data?.message || "Request failed";
      result.style.display = "block";
      result.innerHTML = `<p class="error">❌ ${msg}</p>`;

      const type = res.status === 403 ? "warning" : "error";
      const title = res.status === 403 ? "Paused" : "Not Found";
      window.showToast?.(msg, type, title);
      return;
    }

    renderParcel(data);
    window.showToast?.("Tracking loaded successfully", "success", "Done");
  } catch (err) {
    setLoading(false);
    showError("Server not reachable. Make sure backend is running.");
  }
});

function renderParcel(parcel) {
  const createdText = parcel.createdAt
    ? new Date(parcel.createdAt).toLocaleString()
    : "—";

  result.style.display = "block";
  result.innerHTML = `
    <div class="tracking-ui">
      <div class="tracking-header">
        <span class="tracking-id">Tracking ID: ${parcel.id}</span>
        <span class="tracking-status">${parcel.status}</span>
      </div>

      <div class="tracking-route">
        <div>
          <small>From</small>
          <p>${parcel.origin}</p>
        </div>
        <div class="arrow">→</div>
        <div>
          <small>To</small>
          <p>${parcel.destination}</p>
        </div>
      </div>

      <div class="estimated">
        <small>Estimated Delivery</small>
        <p>${parcel.estimated_delivery || "—"}</p>
      </div>

      ${
        parcel.timeline?.length
          ? `<div class="tracking-history">
              <h4>Tracking History</h4>
              ${parcel.timeline
                .slice()
                .reverse()
                .map(
                  (t) => `
                  <div class="history-item">
                    <span class="dot"></span>
                    <div>
                      <strong>${t.status}</strong>
                      <small>${t.location} • ${
                    t.time ? new Date(t.time).toLocaleString() : "—"
                  }</small>
                    </div>
                  </div>
                `
                )
                .join("")}
            </div>`
          : `<p class="no-history">No updates yet</p>`
      }

      <div class="shipment-details">
        <h4>Shipment Details</h4>
        <div class="detail-row"><span>Sender</span><span>${
          parcel.sender || "—"
        }</span></div>
        <div class="detail-row"><span>Receiver</span><span>${
          parcel.receiver || "—"
        }</span></div>
        <div class="detail-row"><span>Created</span><span>${createdText}</span></div>
      </div>
    </div>
  `;
}

// ===== ADMIN MODAL =====
function openAdminModal() {
  adminModal.style.display = "flex";
  adminEmail?.focus();
}
function closeAdminModal() {
  adminModal.style.display = "none";
}

adminBtn?.addEventListener("click", () => {
  const token = localStorage.getItem("adminToken");
  if (token) return (window.location.href = "admin.html");
  openAdminModal();
});

adminModal?.addEventListener("click", (e) => {
  if (e.target === adminModal) closeAdminModal();
});

adminEmail?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") adminLoginBtn?.click();
});
adminPassword?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") adminLoginBtn?.click();
});

// ===== ADMIN LOGIN =====
adminLoginBtn?.addEventListener("click", async () => {
  const email = adminEmail?.value.trim();
  const password = adminPassword?.value.trim();

  if (!email || !password) {
    window.showToast?.("Enter email and password", "warning", "Login");
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
      window.showToast?.(data.message || "Login failed", "error", "Denied");
      return;
    }

    localStorage.setItem("adminToken", data.token);

    window.showToast?.("Login successful", "success", "Welcome");
    closeAdminModal();

    adminEmail.value = "";
    adminPassword.value = "";

    setTimeout(() => {
      window.location.href = "admin.html";
    }, 300);
  } catch (err) {
    window.showToast?.("Server not reachable", "error", "Network");
  } finally {
    adminLoginBtn.disabled = false;
    adminLoginBtn.textContent = "Login";
  }
});
