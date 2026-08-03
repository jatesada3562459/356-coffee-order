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
const addMenuButton = document.getElementById("addMenuButton");

const menuEditorModal = document.getElementById("menuEditorModal");
const menuEditorTitle = document.getElementById("menuEditorTitle");
const closeMenuEditorButton = document.getElementById("closeMenuEditorButton");
const editorItemType = document.getElementById("editorItemType");
const editorItemName = document.getElementById("editorItemName");
const editorCategoryWrap = document.getElementById("editorCategoryWrap");
const editorCategory = document.getElementById("editorCategory");
const editorPrice = document.getElementById("editorPrice");
const editorOptionsWrap = document.getElementById("editorOptionsWrap");
const editorIsActive = document.getElementById("editorIsActive");
const menuEditorError = document.getElementById("menuEditorError");
const saveMenuEditorButton = document.getElementById("saveMenuEditorButton");
const deleteCustomMenuButton = document.getElementById("deleteCustomMenuButton");

let items = [];
let originalItems = [];
let dirty = false;
let editingItem = null;

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
  const previous = menuSettingsCategory.value;
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

  if ([...menuSettingsCategory.options].some(option => option.value === previous)) {
    menuSettingsCategory.value = previous;
  }
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
          ${item.is_custom ? '<span class="custom-menu-badge">เมนูเพิ่มเอง</span>' : ""}
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

      <button class="edit-menu-button" type="button">
        ✏️ ${item.is_custom ? "แก้ไขรายละเอียด/ลบ" : "ดูและแก้ตัวเลือก"}
      </button>
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

    card.querySelector(".edit-menu-button")
      .addEventListener("click", () => openMenuEditor(item));

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
      is_active: true,
      is_custom: false,
      item_data: { groups: Array.isArray(product.groups) ? product.groups : [] }
    })),
    ...menu.addons.map(addon => ({
      item_type: "addon",
      item_name: addon.name,
      category: "ADD-ON",
      price: Number(addon.price),
      is_active: true,
      is_custom: false,
      item_data: {}
    }))
  ];

  const { data: settings, error } = await sb
    .from("menu_settings")
    .select("item_type,item_name,category,price,is_active,is_custom,item_data");

  if (error) {
    menuSettingsList.innerHTML =
      `<div class="empty-state">โหลดการตั้งค่าไม่สำเร็จ: ${error.message}</div>`;
    return;
  }

  const settingMap = new Map(
    (settings || []).map(setting => [itemKey(setting), setting])
  );

  const defaultItems = defaults.map(item => {
    const saved = settingMap.get(itemKey(item));
    return saved ? {
      ...item,
      price: Number(saved.price),
      is_active: Boolean(saved.is_active),
      category: saved.category || item.category,
      is_custom: Boolean(saved.is_custom),
      item_data: saved.item_data || item.item_data
    } : item;
  });

  const customItems = (settings || [])
    .filter(setting => setting.is_custom)
    .filter(setting => !defaults.some(item => itemKey(item) === itemKey(setting)))
    .map(setting => ({
      item_type: setting.item_type,
      item_name: setting.item_name,
      category: setting.item_type === "addon"
        ? "ADD-ON"
        : (setting.category || "อื่น ๆ"),
      price: Number(setting.price),
      is_active: Boolean(setting.is_active),
      is_custom: true,
      item_data: setting.item_data || {}
    }));

  items = [...defaultItems, ...customItems];
  originalItems = cloneItems(items);
  buildCategories();
  updateSummary();
  renderItems();
  setDirty(false);
}

function selectedGroups() {
  const groups = [];

  const sweetMode = editorOptionsWrap.querySelector(
    'input[name="editorSweetMode"]:checked'
  )?.value;
  const extrasMode = editorOptionsWrap.querySelector(
    'input[name="editorExtrasMode"]:checked'
  )?.value;

  if (sweetMode) groups.push(sweetMode);
  if (document.getElementById("editorMilkOption").checked) groups.push("milk");
  if (extrasMode) groups.push(extrasMode);
  if (document.getElementById("editorYogurtOption").checked) groups.push("yogurt");
  if (document.getElementById("editorSizeOption").checked) groups.push("size");

  return groups;
}

function setSelectedGroups(groups = []) {
  const sweetMode = groups.includes("sweet")
    ? "sweet"
    : groups.includes("sweet_no_zero")
      ? "sweet_no_zero"
      : "";

  const extrasMode = groups.includes("extras_all")
    ? "extras_all"
    : groups.includes("extras_no_blend")
      ? "extras_no_blend"
      : groups.includes("extras_soda")
        ? "extras_soda"
        : "";

  const sweetInput = editorOptionsWrap.querySelector(
    `input[name="editorSweetMode"][value="${sweetMode}"]`
  );
  const extrasInput = editorOptionsWrap.querySelector(
    `input[name="editorExtrasMode"][value="${extrasMode}"]`
  );

  if (sweetInput) sweetInput.checked = true;
  if (extrasInput) extrasInput.checked = true;

  document.getElementById("editorMilkOption").checked = groups.includes("milk");
  document.getElementById("editorYogurtOption").checked = groups.includes("yogurt");
  document.getElementById("editorSizeOption").checked = groups.includes("size");
}

function updateEditorTypeUI() {
  const isAddon = editorItemType.value === "addon";
  editorCategoryWrap.classList.toggle("hidden", isAddon);
  editorOptionsWrap.classList.toggle("hidden", isAddon);
}

function applySuggestedOptionsForCategory() {
  if (editingItem || editorItemType.value === "addon") return;

  const category = editorCategory.value;
  let groups = [];

  if (category === "กาแฟ") {
    groups = ["sweet", "milk", "extras_all", "size"];
  } else if (category === "ชา & นม") {
    groups = ["sweet", "milk", "extras_all", "size"];
  } else if (category === "สมูทตี้") {
    groups = ["sweet", "yogurt", "size"];
  } else if (category === "โซดา") {
    groups = ["sweet_no_zero", "extras_soda", "size"];
  } else if (category === "ปังเย็น") {
    groups = ["sweet", "extras_no_blend"];
  } else if (category === "ขนมปังปิ้ง") {
    groups = [];
  }

  setSelectedGroups(groups);
}

function openMenuEditor(item = null) {
  editingItem = item;
  menuEditorError.textContent = "";

  if (item) {
    menuEditorTitle.textContent = item.is_custom
      ? "แก้ไขเมนู"
      : "แก้ไขตัวเลือกเมนู";
    editorItemType.value = item.item_type;
    editorItemName.value = item.item_name;
    editorCategory.value = item.category || "";
    editorPrice.value = Number(item.price);
    editorIsActive.checked = Boolean(item.is_active);
    setSelectedGroups(item.item_data?.groups || []);

    editorItemType.disabled = !item.is_custom;
    editorItemName.disabled = !item.is_custom;
    deleteCustomMenuButton.classList.toggle("hidden", !item.is_custom);
  } else {
    menuEditorTitle.textContent = "เพิ่มเมนูใหม่";
    editorItemType.value = "product";
    editorItemName.value = "";
    editorCategory.value = "";
    editorPrice.value = "";
    editorIsActive.checked = true;
    setSelectedGroups([]);

    editorItemType.disabled = false;
    editorItemName.disabled = false;
    deleteCustomMenuButton.classList.add("hidden");
  }

  updateEditorTypeUI();
  menuEditorModal.classList.add("show");
  menuEditorModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeMenuEditor() {
  menuEditorModal.classList.remove("show");
  menuEditorModal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  editingItem = null;
}

async function requestManagerPin(title = "ยืนยันการเปลี่ยนแปลง") {
  return new Promise(resolve => {
    const overlay = document.createElement("div");
    overlay.className = "approval-overlay";
    overlay.innerHTML = `
      <div class="approval-card">
        <div class="approval-icon">🔐</div>
        <h2>${title}</h2>
        <p>กรอก PIN ผู้จัดการเพื่อดำเนินการ</p>
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

      const { data, error } = await sb.rpc("verify_manager_pin", { p_pin: pin });

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

saveMenuEditorButton.addEventListener("click", async () => {
  const type = editorItemType.value;
  const name = editorItemName.value.trim();
  const category = type === "addon" ? "ADD-ON" : editorCategory.value.trim();
  const price = Number(editorPrice.value || 0);
  const isActive = editorIsActive.checked;
  const groups = type === "product" ? selectedGroups() : [];

  menuEditorError.textContent = "";

  if (!name) {
    menuEditorError.textContent = "กรุณากรอกชื่อเมนู";
    return;
  }

  if (type === "product" && !category) {
    menuEditorError.textContent = "กรุณากรอกหมวดหมู่";
    return;
  }

  if (!Number.isFinite(price) || price < 0) {
    menuEditorError.textContent = "ราคาต้องเป็น 0 บาทขึ้นไป";
    return;
  }

  const duplicate = items.find(item =>
    itemKey(item) === `${type}:${name}` &&
    item !== editingItem
  );

  if (duplicate) {
    menuEditorError.textContent = "มีชื่อเมนูนี้อยู่แล้ว";
    return;
  }

  const pin = await requestManagerPin(
    editingItem ? "ยืนยันแก้ไขเมนู" : "ยืนยันเพิ่มเมนูใหม่"
  );
  if (!pin) return;

  saveMenuEditorButton.disabled = true;
  saveMenuEditorButton.textContent = "กำลังบันทึก...";

  const { error } = await sb.rpc("manager_upsert_custom_menu", {
    p_pin: pin,
    p_old_item_type: editingItem?.item_type || null,
    p_old_item_name: editingItem?.item_name || null,
    p_item_type: type,
    p_item_name: name,
    p_category: category,
    p_price: price,
    p_is_active: isActive,
    p_item_data: { groups },
    p_is_custom: editingItem ? Boolean(editingItem.is_custom) : true
  });

  saveMenuEditorButton.disabled = false;
  saveMenuEditorButton.textContent = "บันทึกเมนู";

  if (error) {
    menuEditorError.textContent = "บันทึกไม่สำเร็จ: " + error.message;
    return;
  }

  closeMenuEditor();
  await loadSettings();
  alert(editingItem ? "แก้ไขเมนูเรียบร้อย" : "เพิ่มเมนูใหม่เรียบร้อย");
});

deleteCustomMenuButton.addEventListener("click", async () => {
  if (!editingItem?.is_custom) return;

  if (!confirm(`ยืนยันลบเมนู “${editingItem.item_name}” หรือไม่?`)) return;

  const pin = await requestManagerPin("ยืนยันลบเมนู");
  if (!pin) return;

  deleteCustomMenuButton.disabled = true;
  deleteCustomMenuButton.textContent = "กำลังลบ...";

  const { error } = await sb.rpc("manager_delete_custom_menu", {
    p_pin: pin,
    p_item_type: editingItem.item_type,
    p_item_name: editingItem.item_name
  });

  deleteCustomMenuButton.disabled = false;
  deleteCustomMenuButton.textContent = "ลบเมนู";

  if (error) {
    menuEditorError.textContent = "ลบเมนูไม่สำเร็จ: " + error.message;
    return;
  }

  closeMenuEditor();
  await loadSettings();
  alert("ลบเมนูเรียบร้อย");
});

saveMenuSettingsButton.addEventListener("click", async () => {
  if (!dirty) return;

  const pin = await requestManagerPin("ยืนยันบันทึกราคาและสถานะขาย");
  if (!pin) return;

  const changedItems = items.filter(item => {
    const original = originalItems.find(old => itemKey(old) === itemKey(item));
    return !original ||
      Number(original.price) !== Number(item.price) ||
      Boolean(original.is_active) !== Boolean(item.is_active);
  });

  saveMenuSettingsButton.disabled = true;
  saveMenuSettingsButton.textContent = "กำลังบันทึก...";

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
  alert(`บันทึกเรียบร้อย ${Number(data || changedItems.length)} รายการ`);
});

addMenuButton.addEventListener("click", () => openMenuEditor());
closeMenuEditorButton.addEventListener("click", closeMenuEditor);
menuEditorModal.querySelector("[data-close-menu-editor]")
  .addEventListener("click", closeMenuEditor);
editorItemType.addEventListener("change", updateEditorTypeUI);
editorCategory.addEventListener("change", applySuggestedOptionsForCategory);

menuSettingsSearch.addEventListener("input", renderItems);
menuSettingsCategory.addEventListener("change", renderItems);

window.addEventListener("manager-unlocked", loadSettings);

window.addEventListener("beforeunload", event => {
  if (!dirty) return;
  event.preventDefault();
  event.returnValue = "";
});
