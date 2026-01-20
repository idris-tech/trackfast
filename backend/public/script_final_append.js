
// =====================
// TESTIMONIALS SLIDER
// =====================
function initSlider() {
  const track = document.getElementById("sliderTrack");
  if (!track) return;

  // Duplicate items for infinite seamless scroll
  const items = Array.from(track.children);
  items.forEach((item) => {
    const clone = item.cloneNode(true);
    track.appendChild(clone);
  });
}

// Initialize on load
document.addEventListener("DOMContentLoaded", () => {
  initSlider();
});

// =====================
// CHAT LOGIC
// =====================
chatToggleBtn?.addEventListener("click", () => {
  chatWidget.classList.remove("hidden");
  chatToggleBtn.classList.add("hidden");
  loadMessages();
  startChatPolling();
});

chatCloseBtn?.addEventListener("click", () => {
  chatWidget.classList.add("hidden");
  chatToggleBtn.classList.remove("hidden");
  stopChatPolling();
});

async function loadMessages() {
  if (!currentParcelId) return;
  try {
    const res = await fetch(`${BASE_URL}/api/support/messages/${currentParcelId}`);
    const data = await safeJson(res);
    if (res.ok && Array.isArray(data)) {
      renderMessages(data);
    }
  } catch (err) {
    console.error("Failed to load messages", err);
  }
}

function renderMessages(messages) {
  // Keep placeholder if empty? No, clear it.
  chatBody.innerHTML = "";
  if (messages.length === 0) {
    chatBody.innerHTML = `<div class="chat-placeholder">How can we help with your parcel?</div>`;
    return;
  }
  
  messages.forEach(msg => {
    const div = document.createElement("div");
    div.className = `msg ${msg.sender === "user" ? "user" : "admin"}`;
    div.innerText = msg.content;
    chatBody.appendChild(div);
  });
  
  // Scroll to bottom
  chatBody.scrollTop = chatBody.scrollHeight;
}

async function sendMessage() {
  const content = chatInput.value.trim();
  if (!content || !currentParcelId) return;
  
  // Optimistic UI
  const tempDiv = document.createElement("div");
  tempDiv.className = "msg user";
  tempDiv.innerText = content;
  chatBody.appendChild(tempDiv);
  chatBody.scrollTop = chatBody.scrollHeight;
  chatInput.value = "";

  try {
    const res = await fetch(`${BASE_URL}/api/support/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        parcelId: currentParcelId,
        sender: "user",
        content
      })
    });
    
    if (!res.ok) {
        tempDiv.innerText = "❌ Failed to send";
        tempDiv.style.color = "red";
    }
  } catch {
      tempDiv.innerText = "❌ Network error";
      tempDiv.style.color = "red";
  }
}

chatSendBtn?.addEventListener("click", sendMessage);
chatInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendMessage();
});

function startChatPolling() {
  if (chatInterval) clearInterval(chatInterval);
  chatInterval = setInterval(loadMessages, 3000);
}

function stopChatPolling() {
  if (chatInterval) clearInterval(chatInterval);
}
