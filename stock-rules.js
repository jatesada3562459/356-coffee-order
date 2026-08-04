const sb = supabase.createClient(
  APP_CONFIG.SUPABASE_URL,
  APP_CONFIG.SUPABASE_ANON_KEY
);

const ruleMenuName = document.getElementById("ruleMenuName");
const ruleStockItem = document.getElementById("ruleStockItem");
const ruleQuantity = document.getElementById("ruleQuantity");
const stockRuleError = document.getElementById("stockRuleError");
const addStockRuleButton = document.getElementById("addStockRuleButton");
const stockRuleSearch = document.getElementById("stockRuleSearch");
const stockRuleList = document.getElementById("stockRuleList");

let menuNames = [];
let stockItems = [];
let rules = [];

async function requestPin() {
  return new Promise(resolve => {
    const overlay = document.createElement("div");
    overlay.className = "approval-overlay";
    overlay.innerHTML = `
      <div class="approval-card">
        <div class="approval-icon">🔐</div>
        <h2>ยืนยันสูตรตัดสต็อก</h2>
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
      </div>`;

    document.body.appendChild(overlay);
    const input = overlay.querySelector(".approval-pin");
    const errorEl = overlay.querySelector(".approval-error");
    const confirmButton = overlay.querySelector(".approval-confirm");

    const finish = value => {
      overlay.remove();
      resolve(value);
    };

    overlay.querySelector(".approval-cancel")
      .addEventListener("click", () => finish(null));

    async function verify() {
      const pin = input.value.trim();

      if (!/^\d{4}$/.test(pin)) {
        errorEl.textContent = "กรุณากรอก PIN 4 หลัก";
        return;
      }

      confirmButton.disabled = true;
      confirmButton.textContent = "กำลังตรวจสอบ...";

      const { data, error } = await sb.rpc("verify_manager_pin", {
        p_pin: pin
      });

      confirmButton.disabled = false;
      confirmButton.textContent = "ยืนยัน";

      if (error) {
        errorEl.textContent = error.message;
      } else if (!data) {
        errorEl.textContent = "PIN ไม่ถูกต้อง";
        input.value = "";
        input.focus();
      } else {
        finish(pin);
      }
    }

    confirmButton.addEventListener("click", verify);
    input.addEventListener("keydown", event => {
      if (event.key === "Enter") verify();
    });

    setTimeout(() => input.focus(), 80);
  });
}

async function loadMenuNames() {
  const names = new Set();

  try {
    const response = await fetch("menu.json", { cache: "no-store" });
    if (response.ok) {
      const menu = await response.json();
      (menu.products || []).forEach(item => names.add(item.name));
    }
  } catch (error) {
    console.warn("โหลด menu.json ไม่สำเร็จ", error);
  }

  const { data } = await sb
    .from("menu_settings")
    .select("item_name,item_type,is_active");

  (data || [])
    .filter(item => item.item_type === "product")
    .forEach(item => names.add(item.item_name));

  menuNames = [...names].sort((a, b) => a.localeCompare(b, "th"));
  ruleMenuName.innerHTML = menuNames
    .map(name => `<option value="${name}">${name}</option>`)
    .join("");
}

async function loadStockItems() {
  const { data, error } = await sb
    .from("stock_items")
    .select("id,name,unit,is_active")
    .eq("is_active", true)
    .order("sort_order")
    .order("name");

  if (error) throw error;

  stockItems = data || [];
  ruleStockItem.innerHTML = stockItems
    .map(item =>
      `<option value="${item.id}">${item.name} (${item.unit})</option>`
    )
    .join("");
}

async function loadRules() {
  const { data, error } = await sb
    .from("stock_usage_rules")
    .select(`
      id,
      menu_name,
      quantity_per_unit,
      stock_item_id,
      stock_items (
        name,
        unit
      )
    `)
    .order("menu_name")
    .order("created_at");

  if (error) {
    stockRuleList.innerHTML =
      `<div class="empty-state">โหลดสูตรไม่สำเร็จ: ${error.message}</div>`;
    return;
  }

  rules = data || [];
  renderRules();
}

function renderRules() {
  const query = stockRuleSearch.value.trim().toLowerCase();

  const filtered = rules.filter(rule =>
    `${rule.menu_name} ${rule.stock_items?.name || ""}`
      .toLowerCase()
      .includes(query)
  );

  stockRuleList.innerHTML = "";

  if (!filtered.length) {
    stockRuleList.innerHTML =
      '<div class="empty-state">ยังไม่มีสูตรตัดสต็อกที่ตรงกับการค้นหา</div>';
    return;
  }

  const grouped = new Map();

  filtered.forEach(rule => {
    if (!grouped.has(rule.menu_name)) grouped.set(rule.menu_name, []);
    grouped.get(rule.menu_name).push(rule);
  });

  grouped.forEach((menuRules, menuName) => {
    const card = document.createElement("article");
    card.className = "stock-rule-card";

    card.innerHTML = `
      <h3>${menuName}</h3>
      <div class="stock-rule-lines"></div>
    `;

    const lines = card.querySelector(".stock-rule-lines");

    menuRules.forEach(rule => {
      const row = document.createElement("div");
      row.className = "stock-rule-row";
      row.innerHTML = `
        <div>
          <strong>${rule.stock_items?.name || "ไม่พบรายการสต็อก"}</strong>
          <small>
            ${Number(rule.quantity_per_unit).toLocaleString("th-TH")}
            ${rule.stock_items?.unit || ""} ต่อ 1 เมนู
          </small>
        </div>
        <button type="button" class="stock-rule-delete">ลบ</button>
      `;

      row.querySelector(".stock-rule-delete")
        .addEventListener("click", () => deleteRule(rule));

      lines.appendChild(row);
    });

    stockRuleList.appendChild(card);
  });
}

async function addRule() {
  const menuName = ruleMenuName.value;
  const stockItemId = ruleStockItem.value;
  const quantity = Number(ruleQuantity.value);

  stockRuleError.textContent = "";

  if (!menuName || !stockItemId) {
    stockRuleError.textContent = "กรุณาเลือกเมนูและรายการสต็อก";
    return;
  }

  if (!Number.isFinite(quantity) || quantity <= 0) {
    stockRuleError.textContent = "จำนวนต้องมากกว่า 0";
    return;
  }

  const pin = await requestPin();
  if (!pin) return;

  addStockRuleButton.disabled = true;
  addStockRuleButton.textContent = "กำลังบันทึก...";

  const { error } = await sb.rpc("manager_save_stock_usage_rule", {
    p_pin: pin,
    p_menu_name: menuName,
    p_stock_item_id: stockItemId,
    p_quantity_per_unit: quantity
  });

  addStockRuleButton.disabled = false;
  addStockRuleButton.textContent = "＋ เพิ่มสูตรตัดสต็อก";

  if (error) {
    stockRuleError.textContent = "บันทึกไม่สำเร็จ: " + error.message;
    return;
  }

  ruleQuantity.value = "1";
  await loadRules();
}

async function deleteRule(rule) {
  if (!confirm(
    `ลบสูตร ${rule.menu_name} → ${rule.stock_items?.name || ""} หรือไม่?`
  )) return;

  const pin = await requestPin();
  if (!pin) return;

  const { error } = await sb.rpc("manager_delete_stock_usage_rule", {
    p_pin: pin,
    p_rule_id: rule.id
  });

  if (error) {
    alert("ลบสูตรไม่สำเร็จ: " + error.message);
    return;
  }

  await loadRules();
}

async function initialize() {
  try {
    await Promise.all([loadMenuNames(), loadStockItems()]);
    await loadRules();
  } catch (error) {
    stockRuleError.textContent = "โหลดข้อมูลไม่สำเร็จ: " + error.message;
  }
}

addStockRuleButton.addEventListener("click", addRule);
stockRuleSearch.addEventListener("input", renderRules);
window.addEventListener("manager-unlocked", initialize);
