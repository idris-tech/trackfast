// =====================
// TrackFast Admin Dashboard
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

const updateModal = document.getElementById("updateModal");
const updateStatus = document.getElementById("updateStatus");
const updateLocation = document.getElementById("updateLocation");
const cancelUpdate = document.getElementById("cancelUpdate");
const saveUpdate = document.getElementById("saveUpdate");

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

let parcels = [];
let selectedParcelId = null;
let editParcelId = null;

// =====================
// AUTH HELPERS
// =====================

function getToken() {
  return localStorage.getItem("adminToken");
}

function logout(msg = "Session expired") {
  localStorage.removeItem("adminToken");
  showToast?.(msg, "warning", "Auth");
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
  return ct.includes("application/json")
    ? res.json()
    : { message: await res.text() };
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
    logout("Session expired");
    throw new Error("Unauthorized");
  }

  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
}

// =====================
// FETCH DATA
// =====================
async function fetchParcels() {
  parcels = await apiFetch(`${BASE_URL}/api/parcels`);
}

// =====================
// RENDER
// =====================

function renderDashboard() {
  table.innerHTML = "";

  const list = [...parcels]; // filtered if needed

  list.forEach((p) => {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${p.id}</td>
      <td>${p.status}</td>
      <td>${
        p.timeline?.length
          ? p.timeline[p.timeline.length - 1].location
          : p.origin
      }</td>
      <td>${p.state}</td>
      <td class="actions">
        <button class="pause">${
          p.state === "paused" ? "Resume" : "Pause"
        }</button>
        <button class="update" ${
          p.state === "paused" ? "disabled" : ""
        }>Update</button>
        <button class="edit">Edit</button>
        <button class="delete">Delete</button>
      </td>
    `;

    table.appendChild(row);

    // Pause / Resume
    row.querySelector(".pause").onclick = async () => {
      const newState = p.state === "paused" ? "active" : "paused";
      await apiFetch(`${BASE_URL}/api/parcels/${p.id}/state`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: newState }),
      });
      showToast?.(`Parcel ${newState}`, "success", "Updated");
      refresh();
    };

    // Update
    row.querySelector(".update").onclick = () => {
      if (p.state === "paused") {
        showToast?.("Parcel is paused", "warning", "Paused");
        return;
      }
      openUpdateModal(p);
    };

    // Edit
    row.querySelector(".edit").onclick = () => openEditModal(p);

    // Delete
    row.querySelector(".delete").onclick = async () => {
      showToast?.("Deleting parcel...", "warning", "Please wait");

      await apiFetch(`${BASE_URL}/api/parcels/${p.id}`, {
        method: "DELETE",
      });

      showToast?.("Parcel deleted", "success", "Done");
      refresh();
    };
  });
}

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

  updateLocation.value = parcel.timeline?.length
    ? parcel.timeline[parcel.timeline.length - 1].location
    : parcel.origin;

  updateModal.style.display = "flex";
}

saveUpdate.onclick = async () => {
  await apiFetch(`${BASE_URL}/api/parcels/${selectedParcelId}/status`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      status: updateStatus.value,
      location: updateLocation.value.trim(),
    }),
  });

  updateModal.style.display = "none";
  showToast?.("Updated successfully", "success", "Done");
  refresh();
};

// =====================
// EDIT MODAL
// =====================
function openEditModal(p) {
  editParcelId = p.id;

  editSender.value = p.sender;
  editReceiver.value = p.receiver;
  editContact.value = p.contact;
  editOrigin.value = p.origin;
  editDestination.value = p.destination;
  editEstimated.value = p.estimated_delivery?.slice(0, 10) || "";

  editStatus.innerHTML = statuses
    .map(
      (s) =>
        `<option value="${s}" ${s === p.status ? "selected" : ""}>${s}</option>`
    )
    .join("");

  editModal.style.display = "flex";
}

saveEdit.onclick = async () => {
  await apiFetch(`${BASE_URL}/api/parcels/${editParcelId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sender: editSender.value.trim(),
      receiver: editReceiver.value.trim(),
      contact: editContact.value.trim(),
      origin: editOrigin.value.trim(),
      destination: editDestination.value.trim(),
      estimated_delivery: editEstimated.value,
      status: editStatus.value,
    }),
  });

  editModal.style.display = "none";
  showToast?.("Changes saved", "success", "Done");
  refresh();
};

// =====================
// REFRESH ALL
// =====================
async function refresh() {
  await fetchParcels();
  renderDashboard();
}

if (requireAuthOrRedirect()) refresh();
