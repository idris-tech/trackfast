// =====================
// TrackFast Front Page + Admin Login
// =====================

// AUTO SELECT BASE URL
const BASE_URL = window.location.hostname.includes("localhost")
  ? "http://localhost:5000"
  : "https://trackfast.onrender.com";

// ===== ELEMENTS =====
const trackBtn = document.getElementById("trackBtn");
const result = document.getElementById("result");
const loader = document.getElementById("loader");

const adminBtn = document.getElementById("adminBtn");
const adminModal = document.getElementById("adminModal");
const adminLoginBtn = document.getElementById("adminLoginBtn");

const adminEmail = document.getElementById("adminEmail");
const adminPassword = document.getElementById("adminPassword");

// =====================
// TRACK PARCEL
// =====================
if (trackBtn) {
  trackBtn.addEventListener("click", async () => {
    result.style.display = "none";
    loader.style.display = "block";

    const trackingId = document.getElementById("trackingInput").value.trim();

    if (!trackingId) {
      loader.style.display = "none";
      result.style.display = "block";
      showToast?.("Please enter a tracking ID", "warning", "Tracking");
      return;
    }

    try {
      const res = await fetch(
        `${BASE_URL}/api/parcels/${encodeURIComponent(trackingId)}`
      );

      const contentType = res.headers.get("content-type") || "";
      const data = contentType.includes("application/json")
        ? await res.json()
        : { message: await res.text() };

      loader.style.display = "none";
      result.style.display = "block";

      if (!res.ok) {
        result.innerHTML = `<p class="error">❌ ${data.message}</p>`;
        showToast?.(data.message, "error", "Failed");
        return;
      }

      renderParcel(data);
      showToast?.("Tracking loaded", "success", "Success");
    } catch (err) {
      loader.style.display = "none";
      result.style.display = "block";
      result.innerHTML = `<p class="error">❌ Server not reachable</p>`;
      showToast?.("Server unreachable", "error", "Network");
    }
  });
}

function renderParcel(parcel) {
  const created = parcel.createdAt
    ? new Date(parcel.createdAt).toLocaleString()
    : "—";

  result.innerHTML = `
    <div class="tracking-ui">
      <div class="tracking-header">
        <span class="tracking-id">Tracking ID: ${parcel.id}</span>
        <span class="tracking-status">${parcel.status}</span>
      </div>

      <div class="tracking-route">
        <div><small>From</small><p>${parcel.origin}</p></div>
        <div class="arrow">→</div>
        <div><small>To</small><p>${parcel.destination}</p></div>
      </div>

      <div class="estimated">
        <small>Estimated Delivery</small>
        <p>${parcel.estimated_delivery || "—"}</p>
      </div>

      ${
        parcel.timeline?.length
          ? `<h4>Tracking History</h4>
           ${parcel.timeline
             .slice()
             .reverse()
             .map(
               (t) => `<div class="history-item"><strong>${t.status}</strong>
                    <small>${t.location} • ${new Date(
                 t.time
               ).toLocaleString()}</small></div>`
             )
             .join("")}`
          : `<p>No history yet</p>`
      }
    </div>`;
}

// =====================
// ADMIN LOGIN
// =====================

adminBtn.onclick = () => {
  const token = localStorage.getItem("adminToken");
  if (token) {
    window.location.href = "admin.html";
    return;
  }
  adminModal.style.display = "flex";
};

adminModal.onclick = (e) => {
  if (e.target === adminModal) adminModal.style.display = "none";
};

adminLoginBtn.addEventListener("click", async () => {
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

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      showToast?.(data.message || "Login failed", "error", "Denied");
      return;
    }

    localStorage.setItem("adminToken", data.token);
    showToast?.("Login successful", "success", "Welcome");

    setTimeout(() => {
      window.location.href = "admin.html";
    }, 500);
  } catch {
    showToast?.("Server unreachable", "error", "Network");
  } finally {
    adminLoginBtn.disabled = false;
    adminLoginBtn.textContent = "Login";
  }
});
