const MANAGER_UNLOCK_KEY = "356_manager_unlocked_until";
const MANAGER_UNLOCK_MINUTES = 30;

function managerIsUnlocked() {
  const until = Number(sessionStorage.getItem(MANAGER_UNLOCK_KEY) || 0);
  return Date.now() < until;
}

function managerSetUnlocked() {
  const until = Date.now() + MANAGER_UNLOCK_MINUTES * 60 * 1000;
  sessionStorage.setItem(MANAGER_UNLOCK_KEY, String(until));
}

function managerLockNow() {
  sessionStorage.removeItem(MANAGER_UNLOCK_KEY);
  location.reload();
}

async function ensureManagerUnlocked() {
  if (managerIsUnlocked()) {
    window.dispatchEvent(new CustomEvent("manager-unlocked"));
    return;
  }

  const authSb = supabase.createClient(
    APP_CONFIG.SUPABASE_URL,
    APP_CONFIG.SUPABASE_ANON_KEY
  );

  const { data: hasPin, error: pinCheckError } = await authSb.rpc("manager_pin_exists");

  if (pinCheckError) {
    alert("ตรวจสอบโหมดผู้จัดการไม่สำเร็จ: " + pinCheckError.message);
    return;
  }

  if (!hasPin) {
    location.href = "manager.html?setup=1";
    return;
  }

  const overlay = document.createElement("div");
  overlay.className = "manager-lock-overlay";
  overlay.innerHTML = `
    <div class="manager-lock-card">
      <div class="manager-lock-icon">🔐</div>
      <h2>โหมดผู้จัดการ</h2>
      <p>กรอก PIN 4 หลักเพื่อเข้าใช้งาน</p>
      <input id="managerPinInput" type="password" inputmode="numeric"
        maxlength="4" pattern="[0-9]*" placeholder="••••" autocomplete="off">
      <div id="managerPinError" class="manager-pin-error"></div>
      <button id="managerUnlockButton" class="primary" type="button">ปลดล็อก</button>
      <a class="manager-back-link" href="kitchen.html">← กลับหลังร้าน</a>
    </div>
  `;
  document.body.appendChild(overlay);

  const input = overlay.querySelector("#managerPinInput");
  const errorEl = overlay.querySelector("#managerPinError");
  const button = overlay.querySelector("#managerUnlockButton");

  async function unlock() {
    const pin = input.value.trim();
    errorEl.textContent = "";

    if (!/^\d{4}$/.test(pin)) {
      errorEl.textContent = "กรุณากรอก PIN 4 หลัก";
      return;
    }

    button.disabled = true;
    button.textContent = "กำลังตรวจสอบ...";

    const { data, error } = await authSb.rpc("verify_manager_pin", {
      p_pin: pin
    });

    button.disabled = false;
    button.textContent = "ปลดล็อก";

    if (error) {
      errorEl.textContent = "ตรวจสอบ PIN ไม่สำเร็จ: " + error.message;
      return;
    }

    if (!data) {
      errorEl.textContent = "PIN ไม่ถูกต้อง";
      input.value = "";
      input.focus();
      return;
    }

    managerSetUnlocked();
    overlay.remove();
    window.dispatchEvent(new CustomEvent("manager-unlocked"));
  }

  button.addEventListener("click", unlock);
  input.addEventListener("keydown", event => {
    if (event.key === "Enter") unlock();
  });

  setTimeout(() => input.focus(), 100);
}

document.addEventListener("DOMContentLoaded", ensureManagerUnlocked);
