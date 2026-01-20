// =====================
// TrackFast Admin Dashboard (Consolidated & Cleaned)
// =====================

// =====================
// 1. CONFIG & STATE
// =====================
const BASE_URL = (window.location.hostname.includes("localhost") || window.location.hostname.includes("127.0.0.1"))
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

// State
let parcels = [];
let selectedParcelId = null; // for Update
let editParcelId = null;     // for Edit
let pendingDeleteId = null;  // for Delete
let pendingPauseId = null;   // for Pause
let msgParcelId = null;      // for Messages
let adminChatInterval = null;

// =====================
// 2. AUTH
// =====================
function getToken() {
  return localStorage.getItem("adminToken") || localStorage.getItem("token");
}

function logout(msg = "Session expired") {
  localStorage.removeItem("adminToken");
  localStorage.removeItem("token");
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
// 3. DOM ELEMENTS
// =====================
const searchInput = document.getElementById("tf_search_query");
const statusFilter = document.getElementById("statusFilter");
const stateFilter = document.getElementById("stateFilter");
const table = document.getElementById("parcelTable");

// Stats
const totalEl = document.getElementById("total");
const activeEl = document.getElementById("active");
const pausedEl = document.getElementById("paused");
const deliveredEl = document.getElementById("delivered");

// Modals
const updateModal = document.getElementById("updateModal");
const editModal = document.getElementById("editModal");
const deleteModal = document.getElementById("deleteModal");
const pauseModal = document.getElementById("pauseModal");
const messagesModal = document.getElementById("messagesModal");
const viewModalEl = document.getElementById("viewModal");

// Super Admin Elements
const newAdminModalEl = document.getElementById("newAdminModal");
const adminsListEl = document.getElementById("adminsList");
const resetPassModalEl = document.getElementById("resetPasswordModal");

console.log("Admin.js Loaded. Checking crucial elements:", {
    table: !!table,
    updateModal: !!updateModal,
    viewModal: !!viewModalEl
});

// =====================
// 4. HELPER FUNCTIONS
// =====================
function getCurrentLocation(p) {
  return p.timeline?.length
    ? p.timeline[p.timeline.length - 1].location
    : p.origin || "—";
}

function renderStats(list) {
  if(totalEl) totalEl.innerText = list.length;
  if(activeEl) activeEl.innerText = list.filter((p) => p.state === "active").length;
  if(pausedEl) pausedEl.innerText = list.filter((p) => p.state === "paused").length;
  if(deliveredEl) deliveredEl.innerText = list.filter((p) => p.status === "Delivered").length;
}

function applyFilters() {
  let list = [...parcels];

  const term = (searchInput?.value || "").trim().toLowerCase();
  if (term) {
    list = list.filter((p) =>
      String(p.id || "").toLowerCase().includes(term)
    );
  }

  const st = statusFilter?.value || "";
  if (st) list = list.filter((p) => p.status === st);

  const state = stateFilter?.value || "";
  if (state) list = list.filter((p) => p.state === state);

  return list;
}

// =====================
// 5. MODAL LOGIC (GENERIC)
// =====================
function openModal(el) {
  if (el) el.style.display = "flex";
}

function closeModal(el) {
  if (el) el.style.display = "none";
  if (el && el.id === "messagesModal") stopAdminChatPolling();
}

// Global Close Listeners
document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-close]");
  if (!btn) return;
  const id = btn.getAttribute("data-close");
  const modal = document.getElementById(id);
  if(modal) closeModal(modal);
});

[updateModal, editModal, deleteModal, pauseModal, messagesModal, viewModalEl, newAdminModalEl, resetPassModalEl].forEach((m) => {
  m?.addEventListener("click", (e) => {
    if (e.target === m) closeModal(m);
  });
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    document.querySelectorAll('.modal').forEach(m => {
        if(m.style.display === 'flex') closeModal(m);
    });
  }
});

// =====================
// 6. RENDER DASHBOARD (Event Delegation)
// =====================
async function fetchParcels() {
  parcels = await apiFetch("/api/parcels");
}

function renderDashboard() {
  if (!table) return;

  const list = applyFilters();
  renderStats(list);

  table.innerHTML = "";

  if (list.length === 0) {
      table.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 20px;">No parcels found</td></tr>`;
      return;
  }

  list.forEach((p) => {
    const row = document.createElement("tr");

    const isPaused = p.state === "paused";
    const isDelivered = p.status === "Delivered";

    row.innerHTML = `
      <td class="clickable-id" onclick="handleAction('view', '${p.id}')" style="cursor: pointer; color: #2563eb; font-weight: bold;">${p.id}</td>

      <td>${isDelivered ? "✅ Delivered" : p.status}</td>
      <td>${getCurrentLocation(p)}</td>
      <td>${p.state}</td>
      <td class="actions">
        <button type="button" class="invoice" onclick="handleAction('invoice', '${p.id}')">
            Invoice
        </button>
        
        <button type="button" class="${isPaused ? "resume" : "pause"}" onclick="handleAction('pause', '${p.id}')">
            ${isPaused ? "Resume" : "Pause"}
        </button>
        
        <button type="button" class="update" onclick="handleAction('update', '${p.id}')" ${isPaused ? "disabled" : ""}>
            Update
        </button>
        
        <button type="button" class="edit" onclick="handleAction('edit', '${p.id}')">
            Edit
        </button>
        
        <button type="button" class="msg-btn" onclick="handleAction('msg', '${p.id}')" style="background:none; border:none; cursor:pointer; font-size:18px;" title="Messages">
            💬
        </button>
        
        <button type="button" class="delete" onclick="handleAction('delete', '${p.id}')" style="margin-left: 5px;">
            Delete
        </button>
      </td>
    `;
    table.appendChild(row);
  });
}

async function refresh() {
  await fetchParcels();
  renderDashboard();
}

// Aggressive Search Clear to defeat Browser Autofill
if (searchInput) {
    const aggressiveClear = () => {
        if (searchInput.value === "admin" || (searchInput.value && searchInput.value.includes("@"))) {
            console.log("Defisiting persistent autofill:", searchInput.value);
            searchInput.value = "";
            renderDashboard();
        }
    };

    // Stage 1: Immediate & Fast
    searchInput.value = "";
    setTimeout(aggressiveClear, 100);
    setTimeout(aggressiveClear, 500);
    
    // Stage 2: Late-firing autofills
    setTimeout(aggressiveClear, 1000);
    setTimeout(aggressiveClear, 2000);
    setTimeout(aggressiveClear, 5000);

    searchInput.addEventListener("input", renderDashboard);
    searchInput.addEventListener("focus", aggressiveClear);
}
statusFilter?.addEventListener("change", renderDashboard);
stateFilter?.addEventListener("change", renderDashboard);

// Global Nav Function to prevent reloads
window.navTo = function(page) {
    if (window.location.pathname.includes(page)) {
        console.log("Already on", page, "- skipping reload");
        return;
    }
    window.location.href = page;
};

// Note: Reverted to inline onclick handlers for better compatibility.
window.handleAction = handleAction;

async function handleAction(action, id) {
    console.log("Handling Action:", action, id);
    const p = parcels.find((x) => x.id === id);
    if (!p) return;

    if (action === 'view') {
        renderViewModal(p);
        openModal(viewModalEl);
        return;
    }
    if (action === 'msg') {
        openMessages(p);
        return;
    }
    if (action === 'pause') {
        handlePause(p);
        return;
    }
    if (action === 'update') {
        if (p.state === "paused") {
            window.showToast?.("Parcel is paused. Resume first.", "warning");
            return;
        }
        openUpdateModal(p);
        return;
    }
    if (action === 'edit') {
        openEditModal(p);
        return;
    }
    if (action === 'invoice') {
        window.open(`invoice.html?id=${id}`, '_blank');
        return;
    }
    if (action === 'delete') {
        pendingDeleteId = p.id;
        const el = document.getElementById("deleteParcelId");
        if(el) el.textContent = p.id;
        openModal(deleteModal);
        return;
    }
}

// =====================
// 7. SPECIFIC MODAL ACTIONS
// =====================

// --- View ---
function renderViewModal(parcel) {
    const content = document.querySelector(".id-view-wrap");
    if(!content) return;
    
    const timeline = [...(parcel.timeline || [])].reverse();
    const delivered = parcel.status === "Delivered";
    const date = (d) => { try { return new Date(d).toLocaleString() } catch{ return '-' } };

    let html = `
        <div style="background: #f8fafc; padding: 15px; border-radius: 12px; margin-bottom: 15px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <div><div style="font-size:11px;color:#64748b;font-weight:bold;">ID</div><div style="font-size:18px;font-weight:900;">${parcel.id}</div></div>
                <div><span style="background:${delivered?'#dcfce7':'#eff6ff'};color:${delivered?'#166534':'#1e40af'};padding:4px 8px;border-radius:99px;font-size:11px;font-weight:bold;">${parcel.status}</span></div>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:10px; font-size:13px;">
                <div style="background:#fff;padding:8px;border:1px solid #e2e8f0;border-radius:8px;"><strong>Sender:</strong><br>${parcel.sender||'-'}</div>
                <div style="background:#fff;padding:8px;border:1px solid #e2e8f0;border-radius:8px;"><strong>Receiver:</strong><br>${parcel.receiver||'-'}</div>
                <div style="background:#fff;padding:8px;border:1px solid #e2e8f0;border-radius:8px;"><strong>Origin:</strong><br>${parcel.origin||'-'}</div>
                <div style="background:#fff;padding:8px;border:1px solid #e2e8f0;border-radius:8px;"><strong>Dest:</strong><br>${parcel.destination||'-'}</div>
            </div>
        </div>
        <h4>History</h4>
        <div style="border-left:2px solid #e2e8f0; margin-left:10px; padding-left:15px;">
            ${timeline.map((t,i) => `
                <div style="position:relative; margin-bottom:15px;">
                    <div style="position:absolute;left:-21px;top:0;width:10px;height:10px;border-radius:50%;background:${i===0?'#2563eb':'#cbd5e1'};border:2px solid #fff;"></div>
                    <div style="font-weight:bold;font-size:13px;">${t.status}</div>
                    <div style="font-size:11px;color:#64748b;">${date(t.time)}</div>
                    <div style="font-size:12px;">📍 ${t.location}</div>
                </div>
            `).join('')}
        </div>
    `;
    content.innerHTML = html;
}

// --- Pause/Resume ---
async function handlePause(p) {
    if (p.state === "paused") {
        // Resume
        try {
            await apiFetch(`/api/parcels/${p.id}/state`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ state: "active" })
            });
            window.showToast?.("Parcel resumed", "success");
            await refresh();
        } catch(err) {
            window.showToast?.(err.message, "error");
        }
    } else {
        // Pause
        pendingPauseId = p.id;
        const idEl = document.getElementById("pauseParcelId");
        const msgEl = document.getElementById("pauseMessage");
        if (idEl) idEl.textContent = p.id;
        if (msgEl) msgEl.value = "";
        openModal(pauseModal);
        setTimeout(() => msgEl?.focus(), 50);
    }
}

const confirmPause = document.getElementById("confirmPause");
const cancelPause = document.getElementById("cancelPause");
cancelPause?.addEventListener("click", () => closeModal(pauseModal));

confirmPause?.addEventListener("click", async () => {
    try {
        if (!pendingPauseId) return;
        const msgEl = document.getElementById("pauseMessage");
        const msg = String(msgEl?.value || "").trim();
        
        if (!msg) {
            window.showToast?.("Enter pause message", "warning");
            msgEl?.focus();
            return;
        }

        confirmPause.disabled = true;
        confirmPause.textContent = "Pausing...";

        await apiFetch(`/api/parcels/${pendingPauseId}/state`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ state: "paused", pauseMessage: msg }),
        });

        window.showToast?.("Parcel paused", "success");
        closeModal(pauseModal);
        await refresh();
    } catch (err) {
        window.showToast?.(err.message, "error");
    } finally {
        confirmPause.disabled = false;
        confirmPause.textContent = "Pause Now";
        pendingPauseId = null;
    }
});

// --- Update ---
function openUpdateModal(parcel) {
    selectedParcelId = parcel.id;
    const updateStatus = document.getElementById("updateStatus");
    const updateLocation = document.getElementById("updateLocation");
    
    updateStatus.innerHTML = statuses.map(s => 
        `<option value="${s}" ${s === parcel.status ? "selected" : ""}>${s}</option>`
    ).join("");
    
    updateLocation.value = getCurrentLocation(parcel);
    openModal(updateModal);
    updateLocation?.focus();
}

const saveUpdate = document.getElementById("saveUpdate");
const cancelUpdate = document.getElementById("cancelUpdate");
cancelUpdate?.addEventListener("click", () => closeModal(updateModal));

saveUpdate?.addEventListener("click", async () => {
    try {
        const status = document.getElementById("updateStatus").value;
        const loc = document.getElementById("updateLocation").value.trim();
        if(!loc) return window.showToast?.("Location required", "warning");
        
        saveUpdate.disabled = true;
        await apiFetch(`/api/parcels/${selectedParcelId}/status`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status, location: loc }),
        });

        window.showToast?.("Updated!", "success");
        closeModal(updateModal);
        await refresh();
    } catch(err) {
        window.showToast?.(err.message, "error");
    } finally {
        saveUpdate.disabled = false;
    }
});

// --- Edit ---
function openEditModal(p) {
    editParcelId = p.id;
    document.getElementById("editSender").value = p.sender || "";
    document.getElementById("editReceiver").value = p.receiver || "";
    document.getElementById("editOrigin").value = p.origin || "";
    document.getElementById("editDestination").value = p.destination || "";
    
    const editStatus = document.getElementById("editStatus");
    editStatus.innerHTML = statuses.map(s => 
        `<option value="${s}" ${s === p.status ? "selected" : ""}>${s}</option>`
    ).join("");
    
    openModal(editModal);
}

const saveEdit = document.getElementById("saveEdit");
const cancelEdit = document.getElementById("cancelEdit");
cancelEdit?.addEventListener("click", () => closeModal(editModal));

saveEdit?.addEventListener("click", async () => {
   try {
       const payload = {
           sender: document.getElementById("editSender").value.trim(),
           receiver: document.getElementById("editReceiver").value.trim(),
           origin: document.getElementById("editOrigin").value.trim(),
           destination: document.getElementById("editDestination").value.trim(),
           status: document.getElementById("editStatus").value
       };
       if(!payload.sender || !payload.receiver) return window.showToast?.("Missing fields", "warning");

       saveEdit.disabled = true;
       await apiFetch(`/api/parcels/${editParcelId}`, {
          method: "PUT",
           headers: { "Content-Type": "application/json" },
           body: JSON.stringify(payload)
       });
       window.showToast?.("Saved!", "success");
       closeModal(editModal);
       await refresh();
   } catch(err) {
       window.showToast?.(err.message, "error");
   } finally {
       saveEdit.disabled = false;
   }
});

// --- Delete ---
const confirmDelete = document.getElementById("confirmDelete");
const cancelDelete = document.getElementById("cancelDelete");
cancelDelete?.addEventListener("click", () => closeModal(deleteModal));

confirmDelete?.addEventListener("click", async () => {
    try {
        if(!pendingDeleteId) return;
        confirmDelete.disabled = true;
        confirmDelete.innerText = "Deleting...";
        
        await apiFetch(`/api/parcels/${pendingDeleteId}`, { method: "DELETE" });
        window.showToast?.("Deleted", "success");
        closeModal(deleteModal);
        await refresh();
    } catch(err) {
        window.showToast?.(err.message, "error");
    } finally {
        confirmDelete.disabled = false;
        confirmDelete.innerText = "Yes, Delete";
    }
});

// =====================
// 8. MESSAGES (CHAT)
// =====================
function openMessages(p) {
  msgParcelId = p.id;
  const el = document.getElementById("msgParcelId");
  if(el) el.innerText = p.id;
  openModal(messagesModal);
  loadAdminMessages();
  startAdminChatPolling();
}

const adminChatBody = document.getElementById("adminChatBody");
const adminChatInput = document.getElementById("adminChatInput");
const adminChatSendBtn = document.getElementById("adminChatSendBtn");

async function loadAdminMessages() {
  if (!msgParcelId) return;
  try {
    const res = await apiFetch(`/api/support/messages/${msgParcelId}`);
    renderAdminMessages(res);
  } catch (err) { console.error(err); }
}

function renderAdminMessages(messages) {
  if(!adminChatBody) return;
  adminChatBody.innerHTML = "";
  if (!messages || messages.length === 0) {
    adminChatBody.innerHTML = `<div style="text-align:center; padding:20px; color:#ccc">No messages yet</div>`;
    return;
  }
  messages.forEach(msg => {
    const div = document.createElement("div");
    const role = msg.sender === 'user' ? 'user' : 'admin';
    div.className = `chat-msg ${role}`;
    div.textContent = msg.content;
    adminChatBody.appendChild(div);
  });
  adminChatBody.scrollTop = adminChatBody.scrollHeight;
}

async function sendAdminMessage() {
  const content = adminChatInput.value.trim();
  if (!content || !msgParcelId) return;

  adminChatInput.value = "";
  // Optimistic
  const temp = document.createElement("div");
  // ...simpler optimistic or just rely on poll
  
  try {
     await apiFetch('/api/support/messages', {
       method: "POST",
       headers: { "Content-Type": "application/json" },
       body: JSON.stringify({
         parcelId: msgParcelId,
         sender: "admin",
         token: getToken(),
         content
       })
     });
     loadAdminMessages();
  } catch (err) {
    window.showToast?.("Failed to send", "error");
  }
}

adminChatSendBtn?.addEventListener("click", sendAdminMessage);
adminChatInput?.addEventListener("keydown", (e) => {
    if(e.key === "Enter") sendAdminMessage();
});

function startAdminChatPolling() {
  stopAdminChatPolling();
  adminChatInterval = setInterval(loadAdminMessages, 3000);
}

function stopAdminChatPolling() {
  if (adminChatInterval) clearInterval(adminChatInterval);
}

// =====================
// 9. SUPER ADMIN LOGIC
// =====================
async function checkSuperAdmin() {
    try {
        const token = getToken();
        if(!token) return;
        const payload = JSON.parse(atob(token.split('.')[1]));
        if(payload.role === 'superadmin') {
             const navTeam = document.getElementById("navTeam");
             if(navTeam) navTeam.style.display = "block";
        }
    } catch(e) { console.error(e); }
}

const createAdminBtnEl = document.getElementById("createAdminBtn");

function openAdminModal() {
  if (newAdminModalEl) {
      newAdminModalEl.style.display = "flex";
      document.getElementById("newAdminEmail").value = "";
      document.getElementById("newAdminPassword").value = "";
      loadAdmins();
  }
}

async function loadAdmins() {
    if(!adminsListEl) return;
    adminsListEl.innerHTML = '<p>Loading...</p>';
    try {
        const result = await apiFetch("/api/admins");
        renderAdmins(Array.isArray(result) ? result : []);
    } catch(err) {
        adminsListEl.innerHTML = `<p style="color:red">Error: ${err.message}</p>`;
    }
}

function renderAdmins(list) {
    adminsListEl.innerHTML = '';
    const table = document.createElement('table');
    table.style.width = '100%';
    
    list.forEach(a => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="padding: 8px;"><strong>${a.email}</strong><br><small>${a.role}</small></td>
            <td style="text-align: right;">
                <button class="reset-pass-btn" data-id="${a._id}" data-email="${a.email}" style="cursor:pointer;margin-right:8px;">🔑</button>
                <button class="del-admin-btn" data-id="${a._id}" data-email="${a.email}" style="cursor:pointer;color:red;">✕</button>
            </td>
        `;
        table.appendChild(tr);
    });
    
    // Delegation for dynamic admin buttons
    table.addEventListener('click', async (e) => {
        const resetBtn = e.target.closest('.reset-pass-btn');
        const delBtn = e.target.closest('.del-admin-btn');
        
        if (resetBtn) {
            const id = resetBtn.getAttribute('data-id');
            const email = resetBtn.getAttribute('data-email');
            openResetPass(id, email);
        }
        if (delBtn) {
            const id = delBtn.getAttribute('data-id');
            const email = delBtn.getAttribute('data-email');
            if(confirm(`Delete ${email}?`)) {
                try {
                    await apiFetch(`/api/admins/${id}`, { method: 'DELETE' });
                    loadAdmins();
                    window.showToast?.("Deleted", "success");
                } catch(err) { window.showToast?.(err.message, "error"); }
            }
        }
    });

    adminsListEl.appendChild(table);
}

// Create Admin
createAdminBtnEl?.addEventListener("click", async () => {
    const email = document.getElementById("newAdminEmail").value.trim();
    const pass = document.getElementById("newAdminPassword").value.trim();
    if(!email || !pass) return window.showToast?.("Required", "warning");

    createAdminBtnEl.disabled = true;
    try {
        await apiFetch("/api/admins", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password: pass })
        });
        window.showToast?.("Created", "success");
        document.getElementById("newAdminEmail").value = "";
        document.getElementById("newAdminPassword").value = "";
        loadAdmins();
    } catch(err) {
        window.showToast?.(err.message, "error");
    } finally {
        createAdminBtnEl.disabled = false;
    }
});

// Reset Password Logic
let resetAdminId = null;
const saveResetPassBtn = document.getElementById("saveResetPass");
const cancelResetPassBtn = document.getElementById("cancelResetPass");

function openResetPass(id, email) {
    resetAdminId = id;
    if(resetPassModalEl) {
        document.getElementById("resetAdminEmail").textContent = email;
        document.getElementById("resetAdminNewPass").value = "";
        resetPassModalEl.style.display = "flex";
    }
}

cancelResetPassBtn?.addEventListener("click", () => {
    if(resetPassModalEl) resetPassModalEl.style.display = "none";
});

saveResetPassBtn?.addEventListener("click", async () => {
    const pass = document.getElementById("resetAdminNewPass").value.trim();
    if(!pass) return window.showToast?.("Enter password", "warning");
    
    try {
        await apiFetch(`/api/admins/${resetAdminId}/password`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password: pass })
        });
        window.showToast?.("Reset!", "success");
        if(resetPassModalEl) resetPassModalEl.style.display = "none";
    } catch(err) {
        window.showToast?.(err.message, "error");
    }
});

// Link global openAdminModal
window.openAdminModal = openAdminModal;

// =====================
// INIT
// =====================
if (requireAuthOrRedirect()) {
    checkSuperAdmin();
    refresh();
}
