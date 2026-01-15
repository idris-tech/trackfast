// =====================
// TrackFast Admin Dashboard (JWT + Filters + Stats + Pause Message FIXED)
// =====================

const BASE_URL = window.location.hostname.includes("localhost")
  ? "http://localhost:5000"
  : "https://trackfast.onrender.com";

const API = (path) => `${BASE_URL}${path}`;

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

// Stats
const totalEl = document.getElementById("total");
const activeEl = document.getElementById("active");
const pausedEl = document.getElementById("paused");
const deliveredEl = document.getElementById("delivered");

// Update modal
const updateModal = document.getElementById("updateModal");
const updateStatus = document.getElementById("updateStatus");
const updateLocation = document.getElementById("updateLocation");
const cancelUpdate = document.getElementById("cancelUpdate");
const saveUpdate = document.getElementById("saveUpdate");

// Edit modal
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

// Delete modal
const deleteModal = document.getElementById("deleteModal");
const deleteParcelIdEl = document.getElementById("deleteParcelId");
const cancelDelete = document.getElementById("cancelDelete");
const confirmDelete = document.getElementById("confirmDelete");

// Pause modal (✅ IDs must match admin.html)
const pauseModal = document.getElementById("pauseModal");
const pauseParcelIdEl = document.getElementById("pauseParcelId");
const pauseMessageEl = document.getElementById("pauseMessage"); // ✅ correct id
const cancelPause = document.getElementById("cancelPause");
const confirmPause = document.getElementById("confirmPause");

// ===== STATE =====
let parcels = [];
let selectedParcelId = null;
let editParcelId = null;
let pendingDeleteId = null;
let pendingPauseId = null;

// =====================
// AUTH
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

async function apiFetch(path, options = {}) {
  if (!requireAuthOrRedirect()) throw new Error("Not authenticated");

  const res = await fetch(API(path), {
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

  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
}

// =====================
// HELPERS
// =====================
function getCurrentLocation(p) {
  return p.timeline?.length
    ? p.timeline[p.timeline.length - 1].location
    : p.origin || "—";
}

function renderStats(list) {
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

// =====================
// MODAL HELPERS
// =====================
function openModal(el) {
  if (el) el.style.display = "flex";
}
function closeModal(el) {
  if (el) el.style.display = "none";
}

document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-close]");
  if (!btn) return;
  const id = btn.getAttribute("data-close");
  closeModal(document.getElementById(id));
});

[updateModal, editModal, deleteModal, pauseModal].forEach((m) => {
  m?.addEventListener("click", (e) => {
    if (e.target === m) closeModal(m);
  });
});

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  [updateModal, editModal, deleteModal, pauseModal].forEach((m) =>
    closeModal(m)
  );
});

// =====================
// DATA
// =====================
async function fetchParcels() {
  parcels = await apiFetch("/api/parcels");
}

// =====================
// RENDER
// =====================
function renderDashboard() {
  if (!table) return;

  const list = applyFilters();
  renderStats(list);

  table.innerHTML = "";

  list.forEach((p) => {
    const row = document.createElement("tr");

    const isPaused = p.state === "paused";
    const isDelivered = p.status === "Delivered";

    row.innerHTML = `
      <td>${p.id}</td>
      <td>${isDelivered ? "✅ Delivered" : p.status}</td>
      <td>${getCurrentLocation(p)}</td>
      <td>${p.state}</td>
      <td class="actions">
        <button class="${isPaused ? "resume" : "pause"}">${
      isPaused ? "Resume" : "Pause"
    }</button>
        <button class="update" ${isPaused ? "disabled" : ""}>Update</button>
        <button class="edit">Edit</button>
        <button class="delete">Delete</button>
      </td>
    `;

    table.appendChild(row);

    // Pause / Resume
    row.querySelector(".pause, .resume").onclick = async () => {
      try {
        // If pausing -> open pause modal to type message
        if (!isPaused) {
          pendingPauseId = p.id;
          if (pauseParcelIdEl) pauseParcelIdEl.textContent = p.id;
          if (pauseMessageEl) pauseMessageEl.value = "";
          openModal(pauseModal);
          setTimeout(() => pauseMessageEl?.focus(), 50);
          return;
        }

        // Resume
        await apiFetch(`/api/parcels/${p.id}/state`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ state: "active" }),
        });

        window.showToast?.("Parcel resumed", "success", "Updated");
        await refresh();
      } catch (err) {
        window.showToast?.(err.message, "error", "Failed");
      }
    };

    // Update
    row.querySelector(".update").onclick = () => {
      if (isPaused) {
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

    // Delete
    row.querySelector(".delete").onclick = () => {
      pendingDeleteId = p.id;
      deleteParcelIdEl.textContent = p.id;
      openModal(deleteModal);
    };
  });
}

// =====================
// PAUSE MODAL (✅ FIXED)
// =====================
cancelPause?.addEventListener("click", () => {
  pendingPauseId = null;
  closeModal(pauseModal);
});

confirmPause?.addEventListener("click", async () => {
  try {
    if (!pendingPauseId) return;

    const msg = String(pauseMessageEl?.value || "").trim();
    if (!msg) {
      window.showToast?.("Please enter a pause message", "warning", "Required");
      pauseMessageEl?.focus();
      return;
    }

    confirmPause.disabled = true;
    confirmPause.textContent = "Pausing...";

    // ✅ IMPORTANT: send pauseMessage (backend expects pauseMessage)
    await apiFetch(`/api/parcels/${pendingPauseId}/state`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state: "paused", pauseMessage: msg }),
    });

    window.showToast?.("Parcel paused", "success", "Updated");
    pendingPauseId = null;
    closeModal(pauseModal);
    await refresh();
  } catch (err) {
    window.showToast?.(err.message, "error", "Failed");
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
  closeModal(updateModal);
  updateLocation.value = "";
}

cancelUpdate?.addEventListener("click", closeUpdateModal);

saveUpdate?.addEventListener("click", async () => {
  try {
    const loc = updateLocation.value.trim();
    if (!loc) {
      window.showToast?.("Enter location", "warning", "Required");
      return;
    }

    await apiFetch(`/api/parcels/${selectedParcelId}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: updateStatus.value, location: loc }),
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

    await apiFetch(`/api/parcels/${editParcelId}`, {
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
// DELETE
// =====================
async function doDelete(id) {
  await apiFetch(`/api/parcels/${id}`, { method: "DELETE" });
}

cancelDelete?.addEventListener("click", () => {
  pendingDeleteId = null;
  closeModal(deleteModal);
});

confirmDelete?.addEventListener("click", async () => {
  try {
    if (!pendingDeleteId) return;

    confirmDelete.disabled = true;
    confirmDelete.textContent = "Deleting...";

    window.showToast?.("Deleting parcel...", "warning", "Please wait");
    await doDelete(pendingDeleteId);

    window.showToast?.("Parcel deleted", "success", "Done");
    pendingDeleteId = null;
    closeModal(deleteModal);
    await refresh();
  } catch (err) {
    window.showToast?.(err.message, "error", "Delete Failed");
  } finally {
    confirmDelete.disabled = false;
    confirmDelete.textContent = "Yes, Delete";
  }
});

// =====================
// REFRESH
// =====================
async function refresh() {
  await fetchParcels();
  renderDashboard();
}

// Filters
searchInput?.addEventListener("input", renderDashboard);
statusFilter?.addEventListener("change", renderDashboard);
stateFilter?.addEventListener("change", renderDashboard);

// Init
if (requireAuthOrRedirect()) refresh();
