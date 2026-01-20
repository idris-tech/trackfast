
// =====================
// SUPER ADMIN LOGIC
// =====================
const newAdminModal = document.getElementById("newAdminModal");
const newAdminEmail = document.getElementById("newAdminEmail");
const newAdminPassword = document.getElementById("newAdminPassword");
const createAdminBtn = document.getElementById("createAdminBtn");

function openAdminModal() {
  // Simple check or just open. The backend protects the route anyway.
  if (newAdminModal) {
      newAdminModal.style.display = "flex";
      newAdminEmail.value = "";
      newAdminPassword.value = "";
  }
}

// Check if superadmin to show the nav item
// We stored role in localStorage in script.js login? 
// script.js: localStorage.setItem("adminToken", data.token); 
// It didn't store role explicitly in localStorage, but maybe we can decode it or just fetch '/api/admins' to check access.
// Let's decode token if possible or just try to fetch admins list.
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
        closeModal(newAdminModal);
    } catch (err) {
        window.showToast?.(err.message, "error");
    } finally {
        createAdminBtn.disabled = false;
        createAdminBtn.innerText = "Create Admin";
    }
});
