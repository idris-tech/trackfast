// =====================
// TrackFast Admin Dashboard (JWT + Filters + Stats + Pause Message)
// =====================

// AUTO BASE URL
const BASE_URL = window.location.hostname.includes("localhost")
  ? "http://localhost:5000"
  : "https://trackfast.onrender.com";

const statuses = [
  "Order Received",
  "Processing",
  "Dispatched",
  "In Transit",
  "Out for Delivery",
  "Delivered",
];

// ===== DOM =====
const searchInput = document.getElementById("searchInput");
const statusFilter = document.getElementById("statusFilter");
const stateFilter = document.getElementById("stateFilter");
const table = document.getElementById("parcelTable");

// Stats DOM
const totalEl = document.getElementById("total");
const activeEl = document.getElementById("active");
const pausedEl = document.getElementById("paused");
const deliveredEl = document.getElementById("delivered");

// Update modal DOM
const updateModal = document.getElementById("updateModal");
const updateStatus = document.getElementById("updateStatus");
const updateLocation = document.getElementById("updateLocation");
const cancelUpdate = document.getElementById("cancelUpdate");
const saveUpdate = document.getElementById("saveUpdate");

// Edit modal DOM
const editModal = document.getElementById("editModal");
const editSender = document.getElementById("editSender");
const editReceiver = document.getElementById("editReceiver");
const editContact = document.getElementById("editContact");
const editOrigin = document.getElementById("editOrigin");
const editDestination = document.getElementById("editDestination");
const editEstimated = document.getElementById("editEstimated");
const editStatus = document.getElementById("editStatus");
const cancelEdit = document.getElementById("cancelEdit");
const saveEdit = document.getElementById("saveEdit");

// ✅ Pause modal DOM
const pauseModal = document.getElementById("pauseModal");
const pauseParcelIdEl = document.getElementById("pauseParcelId");
const pauseMessageEl = document.getElementById("pauseMessage");
const cancelPause = document.getElementById("cancelPause");
const confirmPause = document.getElementById("confirmPause");

// ===== STATE =====
let parcels = [];
let selectedParcelId = null;
let editParcelId = null;

// pause flow state
let pauseTargetId = null;

// =====================
// AUTH HELPERS
// =====================
function getToken() {
  return localStorage.getItem("adminToken");
}

function logout(msg = "Session expired") {
  localStorage.removeItem("adminToken");
  window.showToast?.(msg, "warning", "Auth");
  window.location.replace("index.html");
}

function requireAuthOrRedirect() {
  if (!getToken()) {
    logout("Please login again");
    return false;
  }
  return true;
}

async function safeJson(res) {
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  return { message: await res.text() };
}

async function apiFetch(url, options = {}) {
  if (!requireAuthOrRedirect()) throw new Error("Not authenticated");

  const res = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${getToken()}`,
    },
  });

  const data = await safeJson(res);

  if (res.status === 401 || res.status === 403) {
    logout("Session expired. Login again.");
    throw new Error(data.message || "Unauthorized");
  }
  if (!res.ok) {
    const msg = data?.message || "Request failed";

    // ✅ show pause reason if provided
    const pauseReason =
      res.status === 403 && data?.pauseMessage ? data.pauseMessage : "";

    if (result) {
      result.innerHTML = `
      <p class="error">❌ ${escapeHtml(msg)}</p>
      ${
        pauseReason
          ? `<div class="tf-empty-sub" style="margin-top:10px; padding:12px; border-radius:12px; background:#fff7ed; color:#9a3412;">
              <b>Reason:</b> ${escapeHtml(pauseReason)}
            </div>`
          : ""
      }
    `;
    }

    const type = res.status === 403 ? "warning" : "error";
    const title = res.status === 403 ? "Paused" : "Not Found";
    showToast?.(pauseReason || msg, type, title);
    return;
  }
}

// =====================
// HELPERS (LOCATION, STATS, FILTERS)
// =====================
function getCurrentLocation(p) {
  return p.timeline?.length
    ? p.timeline[p.timeline.length - 1].location
    : p.origin || "—";
}

function renderStats(list) {
  if (!totalEl) return;
  totalEl.innerText = list.length;
  activeEl.innerText = list.filter((p) => p.state === "active").length;
  pausedEl.innerText = list.filter((p) => p.state === "paused").length;
  deliveredEl.innerText = list.filter((p) => p.status === "Delivered").length;
}

function applyFilters() {
  let list = [...parcels];

  const term = (searchInput?.value || "").trim().toLowerCase();
  if (term) {
    list = list.filter((p) =>
      String(p.id || "")
        .toLowerCase()
        .includes(term)
    );
  }

  const st = statusFilter?.value || "";
  if (st) list = list.filter((p) => p.status === st);

  const state = stateFilter?.value || "";
  if (state) list = list.filter((p) => p.state === state);

  return list;
}

function isDelivered(p) {
  return String(p.status || "").toLowerCase() === "delivered";
}

// =====================
// FETCH DATA
// =====================
async function fetchParcels() {
  parcels = await apiFetch(`${BASE_URL}/api/parcels`);
}

// =====================
// MODAL HELPERS
// =====================
function openModal(modalEl) {
  if (!modalEl) return;
  modalEl.style.display = "flex";
}

function closeModal(modalEl) {
  if (!modalEl) return;
  modalEl.style.display = "none";
}

// Close by overlay click + data-close buttons
document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-close]");
  if (btn) {
    const id = btn.getAttribute("data-close");
    const modal = document.getElementById(id);
    closeModal(modal);
    return;
  }

  if (e.target === updateModal) closeUpdateModal();
  if (e.target === editModal) closeEditModal();
  if (e.target === pauseModal) closePauseModal();
});

// Esc closes
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (updateModal?.style.display === "flex") closeUpdateModal();
  if (editModal?.style.display === "flex") closeEditModal();
  if (pauseModal?.style.display === "flex") closePauseModal();
});

// =====================
// RENDER TABLE
// =====================
function renderDashboard() {
  if (!table) return;

  const list = applyFilters();
  renderStats(list);

  table.innerHTML = "";

  list.forEach((p) => {
    const row = document.createElement("tr");
    const paused = p.state === "paused";
    const delivered = isDelivered(p);

    const statusText = delivered ? `✅ ${p.status}` : p.status;

    row.innerHTML = `
      <td>${p.id}</td>
      <td>${statusText}</td>
      <td>${getCurrentLocation(p)}</td>
      <td>${p.state}</td>
      <td class="actions">
        <button class="${paused ? "resume" : "pause"}">
          ${paused ? "Resume" : "Pause"}
        </button>
        <button class="update" ${paused ? "disabled" : ""}>Update</button>
        <button class="edit">Edit</button>
        <button class="delete">Delete</button>
      </td>
    `;

    table.appendChild(row);

    // Pause / Resume
    row.querySelector(".pause, .resume").onclick = async () => {
      try {
        if (paused) {
          // resume immediately
          await apiFetch(`${BASE_URL}/api/parcels/${p.id}/state`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ state: "active" }),
          });

          window.showToast?.("Parcel resumed", "success", "Updated");
          await refresh();
          return;
        }

        // pause -> open modal to collect reason
        openPauseModal(p.id);
      } catch (err) {
        window.showToast?.(err.message, "error", "Failed");
      }
    };

    // Update
    row.querySelector(".update").onclick = () => {
      if (paused) {
        window.showToast?.(
          "Parcel is paused. Resume first.",
          "warning",
          "Paused"
        );
        return;
      }
      openUpdateModal(p);
    };

    // Edit
    row.querySelector(".edit").onclick = () => openEditModal(p);

    // Delete (simple, no ugly confirm)
    row.querySelector(".delete").onclick = async () => {
      try {
        window.showToast?.("Deleting parcel...", "warning", "Please wait");
        await apiFetch(`${BASE_URL}/api/parcels/${p.id}`, { method: "DELETE" });
        window.showToast?.("Parcel deleted", "success", "Done");
        await refresh();
      } catch (err) {
        window.showToast?.(err.message, "error", "Delete Failed");
      }
    };
  });
}

// =====================
// PAUSE MODAL (✅ NEW)
// =====================
function openPauseModal(parcelId) {
  pauseTargetId = parcelId;
  if (pauseParcelIdEl) pauseParcelIdEl.textContent = parcelId;
  if (pauseMessageEl) pauseMessageEl.value = "";
  openModal(pauseModal);
  setTimeout(() => pauseMessageEl?.focus(), 50);
}

function closePauseModal() {
  pauseTargetId = null;
  if (pauseMessageEl) pauseMessageEl.value = "";
  closeModal(pauseModal);
}

cancelPause?.addEventListener("click", closePauseModal);

confirmPause?.addEventListener("click", async () => {
  if (!pauseTargetId) return;

  const msg = String(pauseMessageEl?.value || "").trim();

  if (!msg) {
    window.showToast?.("Please write a pause reason", "warning", "Required");
    return;
  }

  try {
    confirmPause.disabled = true;
    confirmPause.textContent = "Pausing...";

    await apiFetch(`${BASE_URL}/api/parcels/${pauseTargetId}/state`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state: "paused", pauseMessage: msg }),
    });

    closePauseModal();
    window.showToast?.("Parcel paused with message", "success", "Done");
    await refresh();
  } catch (err) {
    window.showToast?.(err.message, "error", "Pause Failed");
  } finally {
    confirmPause.disabled = false;
    confirmPause.textContent = "Pause Now";
  }
});

// =====================
// UPDATE MODAL
// =====================
function openUpdateModal(parcel) {
  selectedParcelId = parcel.id;

  updateStatus.innerHTML = statuses
    .map(
      (s) =>
        `<option value="${s}" ${
          s === parcel.status ? "selected" : ""
        }>${s}</option>`
    )
    .join("");

  updateLocation.value = getCurrentLocation(parcel);

  openModal(updateModal);
  updateLocation?.focus();
}

function closeUpdateModal() {
  selectedParcelId = null;
  if (updateLocation) updateLocation.value = "";
  closeModal(updateModal);
}

cancelUpdate?.addEventListener("click", closeUpdateModal);

saveUpdate?.addEventListener("click", async () => {
  try {
    const loc = updateLocation.value.trim();
    if (!loc) {
      window.showToast?.("Enter location", "warning", "Required");
      return;
    }

    await apiFetch(`${BASE_URL}/api/parcels/${selectedParcelId}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: updateStatus.value,
        location: loc,
      }),
    });

    closeUpdateModal();
    window.showToast?.("Updated successfully", "success", "Done");
    await refresh();
  } catch (err) {
    window.showToast?.(err.message, "error", "Update Failed");
  }
});

// =====================
// EDIT MODAL
// =====================
function openEditModal(p) {
  editParcelId = p.id;

  editSender.value = p.sender || "";
  editReceiver.value = p.receiver || "";
  editContact.value = p.contact || "";
  editOrigin.value = p.origin || "";
  editDestination.value = p.destination || "";
  editEstimated.value = p.estimated_delivery
    ? String(p.estimated_delivery).slice(0, 10)
    : "";

  editStatus.innerHTML = statuses
    .map(
      (s) =>
        `<option value="${s}" ${s === p.status ? "selected" : ""}>${s}</option>`
    )
    .join("");

  openModal(editModal);
  editSender?.focus();
}

function closeEditModal() {
  editParcelId = null;
  closeModal(editModal);
}

cancelEdit?.addEventListener("click", closeEditModal);

saveEdit?.addEventListener("click", async () => {
  try {
    const payload = {
      sender: editSender.value.trim(),
      receiver: editReceiver.value.trim(),
      contact: editContact.value.trim(),
      origin: editOrigin.value.trim(),
      destination: editDestination.value.trim(),
      estimated_delivery: editEstimated.value,
      status: editStatus.value,
    };

    if (
      !payload.sender ||
      !payload.receiver ||
      !payload.origin ||
      !payload.destination
    ) {
      window.showToast?.(
        "Fill Sender, Receiver, Origin, Destination",
        "warning",
        "Missing"
      );
      return;
    }

    await apiFetch(`${BASE_URL}/api/parcels/${editParcelId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    closeEditModal();
    window.showToast?.("Changes saved", "success", "Done");
    await refresh();
  } catch (err) {
    window.showToast?.(err.message, "error", "Save Failed");
  }
});

// =====================
// REFRESH
// =====================
async function refresh() {
  await fetchParcels();
  renderDashboard();
}

// Filters listeners
searchInput?.addEventListener("input", renderDashboard);
statusFilter?.addEventListener("change", renderDashboard);
stateFilter?.addEventListener("change", renderDashboard);

// Init
if (requireAuthOrRedirect()) refresh();
