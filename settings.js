const sb = supabase.createClient(
  APP_CONFIG.SUPABASE_URL,
  APP_CONFIG.SUPABASE_ANON_KEY
);

const menuSettingsSearch = document.getElementById("menuSettingsSearch");
const menuSettingsCategory = document.getElementById("menuSettingsCategory");
const menuSettingsList = document.getElementById("menuSettingsList");
const allMenuCount = document.getElementById("allMenuCount");
const activeMenuCount = document.getElementById("activeMenuCount");
const inactiveMenuCount = document.getElementById("inactiveMenuCount");
const menuSettingsStatus = document.getElementById("menuSettingsStatus");
const saveMenuSettingsButton = document.getElementById("saveMenuSettingsButton");

let items = [];
let originalItems = [];
let dirty = false;

function itemKey(item) {
  return `${item.item_type}:${item.item_name}`;
}

function cloneItems(value) {
  return JSON.parse(JSON.stringify(value));
}

function setDirty(value) {
  dirty = value;
  saveMenuSettingsButton.disabled = !dirty;
  menuSettingsStatus.textContent = dirty
    ? "มีการแก้ไขที่ยังไม่ได้บันทึก"
    : "บันทึกข้อมูลล่าสุดแล้ว";
}

function updateSummary() {
  allMenuCount.textContent = items.length.toLocaleString("th-TH");
  activeMenuCount.textContent = items.filter(item => item.is_active).length.toLocaleString("th-TH");
  inactiveMenuCount.textContent = items.filter(item => !item.is_active).length.toLocaleString("th-TH");
}

function buildCategories() {
  const categories = [...new Set(
    items
      .filter(item => item.item_type === "product")
      .map(item => item.category)
      .filter(Boolean)
  )].sort((a,b)=>a.localeCompare(b,"th"));

  menuSettingsCategory.innerHTML =
    '<option value="ทั้งหมด">ทุกหมวดหมู่</option>' +
    categories.map(category =>
      `<option value="${category}">${category}</option>`
    ).join("") +
    '<option value="ADD-ON">ADD-ON</option>';
}

function renderItems() {
  const query = menuSettingsSearch.value.trim().toLowerCase();
  const category = menuSettingsCategory.value;

  const filtered = items.filter(item => {
    const matchesQuery =
      `${item.item_name} ${item.category || ""}`.toLowerCase().includes(query);

    const shownCategory =
      item.item_type === "addon" ? "ADD-ON" : item.category;

    return matchesQuery &&
      (category === "ทั้งหมด" || shownCategory === category);
  });

  menuSettingsList.innerHTML = "";

  if (!filtered.length) {
    menuSettingsList.innerHTML =
      '<div class="empty-state">ไม่พบเมนูที่ค้นหา</div>';
    return;
  }

  filtered.forEach(item => {
    const card = document.createElement("article");
    card.className = `menu-setting-card ${item.is_active ? "" : "inactive"}`;
    card.innerHTML = `
      <div class="menu-setting-info">
        <div>
          <span class="menu-setting-category">
            ${item.item_type === "addon" ? "ADD-ON" : item.category}
          </span>
          <h3>${item.item_name}</h3>
        </div>

        <label class="menu-active-switch">
          <input class="active-input" type="checkbox" ${item.is_active ? "checked" : ""}>
          <span>${item.is_active ? "เปิดขาย" : "ปิดขาย"}</span>
        </label>
      </div>

      <label class="menu-price-field">
        <span>ราคา (บาท)</span>
        <input class="price-input" type="number" min="0" step="1"
          inputmode="decimal" value="${Number(item.price)}">
      </label>
    `;

    const priceInput = card.querySelector(".price-input");
    const activeInput = card.querySelector(".active-input");
    const activeLabel = card.querySelector(".menu-active-switch span");

    priceInput.addEventListener("input", () => {
      item.price = Math.max(0, Number(priceInput.value || 0));
      setDirty(true);
    });

    activeInput.addEventListener("change", () => {
      item.is_active = activeInput.checked;
      activeLabel.textContent = item.is_active ? "เปิดขาย" : "ปิดขาย";
      card.classList.toggle("inactive", !item.is_active);
      updateSummary();
      setDirty(true);
    });

    menuSettingsList.appendChild(card);
  });
}

async function loadSettings() {
  menuSettingsList.innerHTML =
    '<div class="empty-state">กำลังโหลดรายการเมนู...</div>';

  const menuResponse = await fetch("menu.json", { cache: "no-store" });
  if (!menuResponse.ok) {
    menuSettingsList.innerHTML =
      '<div class="empty-state">โหลด menu.json ไม่สำเร็จ</div>';
    return;
  }

  const menu = await menuResponse.json();

  const defaults = [
    ...menu.products.map(product => ({
      item_type: "product",
      item_name: product.name,
      category: product.category,
      price: Number(product.price),
      is_active: true
    })),
    ...menu.addons.map(addon => ({
      item_type: "addon",
      item_name: addon.name,
      category: "ADD-ON",
      price: Number(addon.price),
      is_active: true
    }))
  ];

  const { data: settings, error } = await sb
    .from("menu_settings")
    .select("item_type,item_name,category,price,is_active");

  if (error) {
    menuSettingsList.innerHTML =
      `<div class="empty-state">โหลดการตั้งค่าไม่สำเร็จ: ${error.message}</div>`;
    return;
  }

  const settingMap = new Map(
    (settings || []).map(setting => [itemKey(setting), setting])
  );

  items = defaults.map(item => {
    const saved = settingMap.get(itemKey(item));
    return saved ? {
      ...item,
      price: Number(saved.price),
      is_active: Boolean(saved.is_active),
      category: saved.category || item.category
    } : item;
  });

  originalItems = cloneItems(items);
  buildCategories();
  updateSummary();
  renderItems();
  setDirty(false);
}

async function requestManagerPin() {
  return new Promise(resolve => {
    const overlay = document.createElement("div");
    overlay.className = "approval-overlay";
    overlay.innerHTML = `
      <div class="approval-card">
        <div class="approval-icon">🔐</div>
        <h2>ยืนยันการแก้ไขเมนู</h2>
        <p>กรอก PIN ผู้จัดการก่อนบันทึกราคาและสถานะขาย</p>
        <label class="approval-field">
          <span>PIN ผู้จัดการ 4 หลัก</span>
          <input class="approval-pin" type="password" inputmode="numeric"
            maxlength="4" placeholder="••••">
        </label>
        <div class="approval-error"></div>
        <div class="approval-actions">
          <button class="approval-cancel" type="button">ยกเลิก</button>
          <button class="approval-confirm primary" type="button">ยืนยัน</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    const input = overlay.querySelector(".approval-pin");
    const errorEl = overlay.querySelector(".approval-error");
    const confirm = overlay.querySelector(".approval-confirm");

    function finish(value) {
      overlay.remove();
      resolve(value);
    }

    overlay.querySelector(".approval-cancel")
      .addEventListener("click", () => finish(null));

    async function verify() {
      const pin = input.value.trim();

      if (!/^\d{4}$/.test(pin)) {
        errorEl.textContent = "กรุณากรอก PIN 4 หลัก";
        return;
      }

      confirm.disabled = true;
      confirm.textContent = "กำลังตรวจสอบ...";

      const { data, error } = await sb.rpc("verify_manager_pin", {
        p_pin: pin
      });

      confirm.disabled = false;
      confirm.textContent = "ยืนยัน";

      if (error) {
        errorEl.textContent = error.message;
        return;
      }

      if (!data) {
        errorEl.textContent = "PIN ไม่ถูกต้อง";
        input.value = "";
        input.focus();
        return;
      }

      finish(pin);
    }

    confirm.addEventListener("click", verify);
    input.addEventListener("keydown", event => {
      if (event.key === "Enter") verify();
    });
    setTimeout(() => input.focus(), 80);
  });
}

saveMenuSettingsButton.addEventListener("click", async () => {
  if (!dirty) return;

  const invalid = items.find(item =>
    !Number.isFinite(Number(item.price)) || Number(item.price) < 0
  );

  if (invalid) {
    alert(`ราคาของ ${invalid.item_name} ไม่ถูกต้อง`);
    return;
  }

  const pin = await requestManagerPin();
  if (!pin) return;

  saveMenuSettingsButton.disabled = true;
  saveMenuSettingsButton.textContent = "กำลังบันทึก...";

  const changedItems = items.filter(item => {
    const original = originalItems.find(old => itemKey(old) === itemKey(item));
    return !original ||
      Number(original.price) !== Number(item.price) ||
      Boolean(original.is_active) !== Boolean(item.is_active);
  });

  const { data, error } = await sb.rpc("manager_save_menu_settings", {
    p_pin: pin,
    p_items: changedItems
  });

  saveMenuSettingsButton.textContent = "บันทึกการเปลี่ยนแปลง";

  if (error) {
    saveMenuSettingsButton.disabled = false;
    alert("บันทึกเมนูไม่สำเร็จ: " + error.message);
    return;
  }

  originalItems = cloneItems(items);
  setDirty(false);
  alert(`บันทึกเรียบร้อย ${Number(data || changedItems.length)} รายการ\nราคาหน้าลูกค้าจะเปลี่ยนเมื่อรีเฟรช`);
});

menuSettingsSearch.addEventListener("input", renderItems);
menuSettingsCategory.addEventListener("change", renderItems);

window.addEventListener("manager-unlocked", loadSettings);

window.addEventListener("beforeunload", event => {
  if (!dirty) return;
  event.preventDefault();
  event.returnValue = "";
});
