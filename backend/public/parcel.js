const form = document.getElementById("parcelForm");
const submitBtn = form?.querySelector('button[type="submit"]');

function getToken() {
  return localStorage.getItem("adminToken");
}

function logout(msg = "Session expired") {
  localStorage.removeItem("adminToken");
  window.showToast?.(msg, "warning", "Auth");
  window.location.replace("index.html");
}

async function safeJson(res) {
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  return { message: await res.text() };
}

async function apiFetch(url, options = {}) {
  const token = getToken();
  if (!token) {
    logout("Please login again");
    throw new Error("No token");
  }

  const res = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await safeJson(res);

  if (res.status === 401 || res.status === 403) {
    logout(data.message || "Session expired");
    throw new Error(data.message || "Unauthorized");
  }

  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
}

if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const data = {
      sender: form.elements["sender"].value.trim(),
      receiver: form.elements["receiver"].value.trim(),
      contact: form.elements["contact"].value.trim(),
      description: form.elements["description"].value.trim(),
      origin: form.elements["origin"].value.trim(),
      destination: form.elements["destination"].value.trim(),
      status: form.elements["status"].value,
      estimated_delivery: form.elements["estimated_delivery"].value,
    };

    if (
      !data.sender ||
      !data.receiver ||
      !data.origin ||
      !data.destination ||
      !data.status
    ) {
      window.showToast?.(
        "Please fill all required fields",
        "warning",
        "Missing"
      );
      return;
    }

    try {
      submitBtn.disabled = true;
      submitBtn.textContent = "Creating...";

      const payload = await apiFetch("/api/parcels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      window.showToast?.(`Tracking ID: ${payload.id}`, "success", "Created");
      form.reset();
    } catch (err) {
      window.showToast?.(err.message, "error", "Create Failed");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Create Parcel";
    }
  });
}
