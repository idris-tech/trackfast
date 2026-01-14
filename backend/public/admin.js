// =====================
// TrackFast Admin (JWT)
// =====================

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

// UPDATE modal
const updateModal = document.getElementById("updateModal");
const updateStatus = document.getElementById("updateStatus");
const updateLocation = document.getElementById("updateLocation");
const cancelUpdate = document.getElementById("cancelUpdate");
const saveUpdate = document.getElementById("saveUpdate");

// EDIT modal
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

// DELETE modal ✅
const deleteModal = document.getElementById("deleteModal");
const deleteParcelIdText = document.getElementById("deleteParcelId");
const cancelDelete = document.getElementById("cancelDelete");
const confirmDelete = document.getElementById("confirmDelete");

// ===== STATE =====
let parcels = [];
let selectedParcelId = null;
let editParcelId = null;
let parcelToDelete = null;

// =====================
// AUTH
// =====================
function getToken() {
  return localStorage.getItem("adminToken");
}

function logout(message = "Logged out") {
  localStorage.removeItem("adminToken");
  window.showToast?.(message, "warning", "Session");
  window.location.replace("index.html");
}

function requireAuthOrRedirect() {
  const token = getToken();
  if (!token) {
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

  const token = getToken();
  const headers = {
    ...(options.headers || {}),
    Authorization: `Bearer ${token}`,
  };

  const res = await fetch(url, { ...options, headers });
  const data = await safeJson(res);

  if (res.status === 401 || res.status === 403) {
    logout("Session expired. Login again.");
    throw new Error(data.message || "Unauthorized");
  }
  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
}

// =====================
// UI HELPERS
// =====================
function getCurrentLocation(parcel) {
  return parcel.timeline?.length
    ? parcel.timeline[parcel.timeline.length - 1].location
    : parcel.origin || "—";
}

function renderStats(list) {
  document.getElementById("total").innerText = list.length;
  document.getElementById("active").innerText = list.filter(
    (p) => p.state === "active"
  ).length;
  document.getElementById("paused").innerText = list.filter(
    (p) => p.state === "paused"
  ).length;
  document.getElementById("delivered").innerText = list.filter(
    (p) => p.status === "Delivered"
  ).length;
}

function applyFilters() {
  let filtered = [...parcels];

  const s = (searchInput?.value || "").trim().toLowerCase();
  if (s) filtered = filtered.filter((p) => p.id.toLowerCase().includes(s));

  const st = statusFilter?.value || "";
  if (st) filtered = filtered.filter((p) => p.status === st);

  const state = stateFilter?.value || "";
  if (state) filtered = filtered.filter((p) => p.state === state);

  return filtered;
}

// =====================
// MODAL UTILS
// =====================
function openModal(modalEl) {
  if (!modalEl) return;
  modalEl.style.display = "flex";
}
function closeModal(modalEl) {
  if (!modalEl) return;
  modalEl.style.display = "none";
}

// Close modal when clicking outside
[updateModal, editModal, deleteModal].forEach((m) => {
  m?.addEventListener("click", (e) => {
    if (e.target === m) closeModal(m);
  });
});

// Close modal by ✕ button (data-close)
document.querySelectorAll("[data-close]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const id = btn.getAttribute("data-close");
    const modal = document.getElementById(id);
    closeModal(modal);
  });
});

// ESC closes modals
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  [updateModal, editModal, deleteModal].forEach((m) => {
    if (m?.style.display === "flex") closeModal(m);
  });
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
  updateLocation.value = "";
  closeModal(updateModal);
}

cancelUpdate?.addEventListener("click", closeUpdateModal);

saveUpdate?.addEventListener("click", async () => {
  if (!selectedParcelId) return;

  const status = updateStatus.value;
  const location = updateLocation.value.trim();

  if (!status)
    return window.showToast?.("Select status", "warning", "Required");
  if (!location)
    return window.showToast?.("Enter location", "warning", "Required");

  try {
    await apiFetch(`/api/parcels/${selectedParcelId}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, location }),
    });

    closeUpdateModal();
    window.showToast?.("Tracking updated", "success", "Done");
    await refresh();
  } catch (err) {
    window.showToast?.(err.message, "error", "Failed");
  }
});

// =====================
// EDIT MODAL
// =====================
function openEditModal(parcel) {
  editParcelId = parcel.id;

  editSender.value = parcel.sender || "";
  editReceiver.value = parcel.receiver || "";
  editContact.value = parcel.contact || "";
  editOrigin.value = parcel.origin || "";
  editDestination.value = parcel.destination || "";

  editEstimated.value = parcel.estimated_delivery
    ? String(parcel.estimated_delivery).slice(0, 10)
    : "";

  editStatus.innerHTML = statuses
    .map(
      (s) =>
        `<option value="${s}" ${
          s === parcel.status ? "selected" : ""
        }>${s}</option>`
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
  if (!editParcelId) return;

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
    !payload.destination ||
    !payload.status
  ) {
    window.showToast?.("Fill all required fields", "warning", "Required");
    return;
  }

  try {
    await apiFetch(`/api/parcels/${editParcelId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    closeEditModal();
    window.showToast?.("Parcel updated", "success", "Saved");
    await refresh();
  } catch (err) {
    window.showToast?.(err.message, "error", "Failed");
  }
});

// =====================
// DELETE MODAL ✅ (NO ALERT)
// =====================
function openDeleteModal(parcelId) {
  parcelToDelete = parcelId;

  if (!deleteModal || !confirmDelete || !cancelDelete || !deleteParcelIdText) {
    // fallback (should not happen if HTML is correct)
    const ok = confirm(`Delete parcel ${parcelId}?`);
    if (ok) runDelete(parcelId);
    return;
  }

  deleteParcelIdText.textContent = parcelId;
  openModal(deleteModal);
}

function closeDeleteModal() {
  parcelToDelete = null;
  closeModal(deleteModal);
}

async function runDelete(parcelId) {
  await apiFetch(`/api/parcels/${parcelId}`, { method: "DELETE" });
}

cancelDelete?.addEventListener("click", closeDeleteModal);

confirmDelete?.addEventListener("click", async () => {
  if (!parcelToDelete) return;
  try {
    await runDelete(parcelToDelete);
    closeDeleteModal();
    window.showToast?.("Parcel deleted", "success", "Removed");
    await refresh();
  } catch (err) {
    window.showToast?.(err.message, "error", "Failed");
  }
});

// =====================
// DATA + RENDER
// =====================
async function fetchParcels() {
  parcels = await apiFetch("/api/parcels");
}

function renderDashboard() {
  if (!table) return;

  const list = applyFilters();
  renderStats(list);

  table.innerHTML = "";

  list.forEach((parcel) => {
    const row = document.createElement("tr");

    const isPaused = parcel.state === "paused";

    row.innerHTML = `
      <td>${parcel.id}</td>
      <td>${parcel.status}</td>
      <td>${getCurrentLocation(parcel)}</td>
      <td>${parcel.state}</td>
      <td class="actions">
        <button class="${isPaused ? "resume" : "pause"}">
          ${isPaused ? "Resume" : "Pause"}
        </button>
        <button class="update" ${isPaused ? "disabled" : ""}>
          Add Update
        </button>
        <button class="edit">Edit</button>
        <button class="delete">Delete</button>
      </td>
    `;

    table.appendChild(row);

    // Pause / Resume
    row.querySelector(".pause, .resume").addEventListener("click", async () => {
      try {
        const next = isPaused ? "active" : "paused";

        await apiFetch(`/api/parcels/${parcel.id}/state`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ state: next }),
        });

        window.showToast?.(`Parcel ${next}`, "success", "Updated");
        await refresh();
      } catch (err) {
        window.showToast?.(err.message, "error", "Failed");
      }
    });

    // Add Update
    row.querySelector(".update").addEventListener("click", () => {
      if (isPaused) {
        window.showToast?.("Resume parcel first", "warning", "Paused");
        return;
      }
      openUpdateModal(parcel);
    });

    // Edit
    row.querySelector(".edit").addEventListener("click", () => {
      openEditModal(parcel);
    });

    // Delete ✅
    row.querySelector(".delete").addEventListener("click", () => {
      openDeleteModal(parcel.id);
    });
  });
}

async function refresh() {
  try {
    await fetchParcels();
    renderDashboard();
  } catch (err) {
    window.showToast?.(err.message, "error", "Error");
  }
}

// Listeners
[searchInput, statusFilter, stateFilter].forEach((el) => {
  el?.addEventListener("input", renderDashboard);
});

// Init
if (requireAuthOrRedirect()) refresh();

// Optional: expose logout
window.logout = logout;
