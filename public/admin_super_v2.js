
// =====================
// SUPER ADMIN LOGIC (UPDATED)
// =====================
const newAdminModal = document.getElementById("newAdminModal");
const newAdminEmail = document.getElementById("newAdminEmail");
const newAdminPassword = document.getElementById("newAdminPassword");
const createAdminBtn = document.getElementById("createAdminBtn");
const adminsList = document.getElementById("adminsList");

function openAdminModal() {
  if (newAdminModal) {
      newAdminModal.style.display = "flex";
      newAdminEmail.value = "";
      newAdminPassword.value = "";
      loadAdmins();
  }
}

async function loadAdmins() {
    if(!adminsList) return;
    adminsList.innerHTML = '<p style="color:#888; text-align:center;">Loading...</p>';
    
    try {
        const admins = await apiFetch("/api/admins");
        renderAdmins(admins);
    } catch(err) {
        adminsList.innerHTML = `<p style="color:red; text-align:center;">Error: ${err.message}</p>`;
    }
}

function renderAdmins(list) {
    if(!list || list.length === 0) {
        adminsList.innerHTML = '<p style="color:#888; text-align:center;">No other admins found.</p>';
        return;
    }
    
    adminsList.innerHTML = '';
    const startTable = document.createElement('table');
    startTable.style.width = '100%';
    startTable.style.fontSize = '13px';
    
    list.forEach(a => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid #f0f0f0';
        
        tr.innerHTML = `
            <td style="padding: 8px;">
                <strong>${a.email}</strong><br>
                <span style="color:#888; font-size:11px;">${a.role}</span>
            </td>
            <td style="padding: 8px; text-align: right;">
                <button class="action-btn delete-admin" style="color:red; background:none; border:none; cursor:pointer;">✕</button>
            </td>
        `;
        
        // Prevent deleting self (already handled by backend but UI feedback nice)
        // We'd need to know current user ID. Decoding token again to match?
        
        tr.querySelector('.delete-admin').onclick = () => deleteAdmin(a._id, a.email);
        startTable.appendChild(tr);
    });
    
    adminsList.appendChild(startTable);
}

async function deleteAdmin(id, email) {
    if(!confirm(`Delete admin ${email}? This cannot be undone.`)) return;
    
    try {
       await apiFetch(`/api/admins/${id}`, { method: 'DELETE' });
       window.showToast?.("Admin deleted", "success");
       loadAdmins();
    } catch(err) {
       window.showToast?.(err.message, "error");
    }
}


// Check if superadmin to show the nav item
async function checkSuperAdmin() {
    try {
        const token = getToken();
        if(!token) return;
        
        // Simple heuristic: payload is base64
        const payload = JSON.parse(atob(token.split('.')[1]));
        if(payload.role === 'superadmin') {
             const navTeam = document.getElementById("navTeam");
             if(navTeam) navTeam.style.display = "block";
        }
    } catch(e) {
        // ignore
    }
}
// Run on load
checkSuperAdmin();

createAdminBtn?.addEventListener("click", async () => {
    const email = newAdminEmail.value.trim();
    const password = newAdminPassword.value.trim();
    
    if(!email || !password) {
        window.showToast?.("Email and Password required", "warning");
        return;
    }
    
    createAdminBtn.disabled = true;
    createAdminBtn.innerText = "Creating...";
    
    try {
        await apiFetch("/api/admins", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });
        
        window.showToast?.("New Admin Created!", "success");
        newAdminEmail.value = "";
        newAdminPassword.value = "";
        loadAdmins();
    } catch (err) {
        window.showToast?.(err.message, "error");
    } finally {
        createAdminBtn.disabled = false;
        createAdminBtn.innerText = "Create Admin";
    }
});
