// =====================
// TrackFast Create Parcel
// =====================

// AUTO BASE URL
const BASE_URL = window.location.hostname.includes("localhost")
  ? "http://localhost:5000"
  : "https://trackfast.onrender.com";

const form = document.getElementById("parcelForm");
const submitBtn = form?.querySelector("button[type='submit']");

function getToken() {
  return localStorage.getItem("adminToken");
}

function logout(msg = "Session expired") {
  localStorage.removeItem("adminToken");
  showToast?.(msg, "warning", "Auth");
  window.location.replace("index.html");
}

async function safeJson(res) {
  const ct = res.headers.get("content-type") || "";
  return ct.includes("application/json")
    ? res.json()
    : { message: await res.text() };
}

async function apiFetch(url, options = {}) {
  const token = getToken();
  if (!token) logout();

  const res = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
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

if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const payload = {
      sender: form.sender.value.trim(),
      receiver: form.receiver.value.trim(),
      contact: form.contact.value.trim(),
      description: form.description.value.trim(),
      origin: form.origin.value.trim(),
      destination: form.destination.value.trim(),
      status: form.status.value,
      estimated_delivery: form.estimated_delivery.value,
    };

    if (
      !payload.sender ||
      !payload.receiver ||
      !payload.origin ||
      !payload.destination
    ) {
      showToast?.("Fill all required fields", "warning", "Missing");
      return;
    }

    try {
      submitBtn.disabled = true;
      submitBtn.textContent = "Creating...";

      const newParcel = await apiFetch(`${BASE_URL}/api/parcels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      showToast?.(`Parcel created! ID: ${newParcel.id}`, "success", "Done");
      form.reset();
    } catch (err) {
      showToast?.(err.message, "error", "Failed");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Create Parcel";
    }
  });
}
