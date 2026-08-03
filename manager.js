const sb = supabase.createClient(
  APP_CONFIG.SUPABASE_URL,
  APP_CONFIG.SUPABASE_ANON_KEY
);

const setupPinPanel = document.getElementById("setupPinPanel");
const changePinPanel = document.getElementById("changePinPanel");
const setupPin = document.getElementById("setupPin");
const setupPinConfirm = document.getElementById("setupPinConfirm");
const setupPinError = document.getElementById("setupPinError");
const setupPinButton = document.getElementById("setupPinButton");
const currentPin = document.getElementById("currentPin");
const newPin = document.getElementById("newPin");
const newPinConfirm = document.getElementById("newPinConfirm");
const changePinError = document.getElementById("changePinError");
const changePinButton = document.getElementById("changePinButton");
const lockManagerButton = document.getElementById("lockManagerButton");

function validPin(pin) {
  return /^\d{4}$/.test(pin);
}

async function initialize() {
  const { data, error } = await sb.rpc("manager_pin_exists");

  if (error) {
    setupPinError.textContent = "ตรวจสอบ PIN ไม่สำเร็จ: " + error.message;
    return;
  }

  setupPinPanel.classList.toggle("hidden", Boolean(data));
  changePinPanel.classList.toggle("hidden", !data);
}

setupPinButton.addEventListener("click", async () => {
  const pin = setupPin.value.trim();
  const confirmPin = setupPinConfirm.value.trim();
  setupPinError.textContent = "";

  if (!validPin(pin)) {
    setupPinError.textContent = "PIN ต้องเป็นตัวเลข 4 หลัก";
    return;
  }

  if (pin !== confirmPin) {
    setupPinError.textContent = "PIN ทั้งสองช่องไม่ตรงกัน";
    return;
  }

  setupPinButton.disabled = true;
  setupPinButton.textContent = "กำลังบันทึก...";

  const { data, error } = await sb.rpc("set_initial_manager_pin", {
    p_pin: pin
  });

  setupPinButton.disabled = false;
  setupPinButton.textContent = "บันทึก PIN";

  if (error || !data) {
    setupPinError.textContent =
      error?.message || "ตั้ง PIN ไม่สำเร็จ อาจมี PIN อยู่แล้ว";
    return;
  }

  sessionStorage.setItem(
    "356_manager_unlocked_until",
    String(Date.now() + 30 * 60 * 1000)
  );

  alert("ตั้ง PIN ผู้จัดการเรียบร้อย");
  location.href = "kitchen.html";
});

changePinButton.addEventListener("click", async () => {
  const oldPin = currentPin.value.trim();
  const pin = newPin.value.trim();
  const confirmPin = newPinConfirm.value.trim();
  changePinError.textContent = "";

  if (!validPin(oldPin) || !validPin(pin)) {
    changePinError.textContent = "PIN ต้องเป็นตัวเลข 4 หลัก";
    return;
  }

  if (pin !== confirmPin) {
    changePinError.textContent = "PIN ใหม่ทั้งสองช่องไม่ตรงกัน";
    return;
  }

  changePinButton.disabled = true;
  changePinButton.textContent = "กำลังเปลี่ยน...";

  const { data, error } = await sb.rpc("change_manager_pin", {
    p_current_pin: oldPin,
    p_new_pin: pin
  });

  changePinButton.disabled = false;
  changePinButton.textContent = "เปลี่ยน PIN";

  if (error) {
    changePinError.textContent = "เปลี่ยน PIN ไม่สำเร็จ: " + error.message;
    return;
  }

  if (!data) {
    changePinError.textContent = "PIN ปัจจุบันไม่ถูกต้อง";
    return;
  }

  currentPin.value = "";
  newPin.value = "";
  newPinConfirm.value = "";
  alert("เปลี่ยน PIN เรียบร้อย");
});

lockManagerButton.addEventListener("click", () => {
  sessionStorage.removeItem("356_manager_unlocked_until");
  alert("ล็อกโหมดผู้จัดการแล้ว");
  location.href = "kitchen.html";
});

initialize();
