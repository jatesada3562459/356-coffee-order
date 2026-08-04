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
const createStandardRulesButton = document.getElementById("createStandardRulesButton");
const standardRulesResult = document.getElementById("standardRulesResult");
const refreshRuleAuditButton = document.getElementById("refreshRuleAuditButton");
const stockRuleAuditResult = document.getElementById("stockRuleAuditResult");
const auditAllCount = document.getElementById("auditAllCount");
const auditOkCount = document.getElementById("auditOkCount");
const auditCheckCount = document.getElementById("auditCheckCount");
const auditMissingCount = document.getElementById("auditMissingCount");

let menuNames = [];
let stockItems = [];
let rules = [];
let ruleAuditItems = [];
let ruleAuditFilter = "all";

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
  renderRuleAudit();
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

function normalizedName(value) {
  return String(value || "")
    .replace(/\s+/g, "")
    .replace(/โอริโอ/g, "โอรีโอ")
    .replace(/โอลิโอ/g, "โอรีโอ")
    .replace(/มักคิอาโต้/g, "มัคคิอาโต้")
    .toLowerCase();
}

const STOCK_NAMES = {
  cup16: "แก้ว PET 16 oz",
  cup22: "แก้ว PET 22 oz",
  jar22: "แก้วโอ่ง 22 oz",
  hot8: "แก้วร้อน 8 oz",
  flat98: "ฝาเรียบ 98",
  dome98: "ฝาโดม 98",
  flat22: "ฝาเรียบ 22 oz",
  jarDome22: "ฝาโดมแก้วโอ่ง 22 oz",
  whip98: "ฝาหลุม / ฝาวิปครีม 98",
  hotLid8: "ฝาร้อน 8 oz",
  straw: "หลอดธรรมดา",
  bubbleStraw: "หลอดไข่มุก",
  hotFlatStraw: "หลอดแบนร้อน",
  spoonStraw: "หลอดช้อน"
};

const COFFEE_DOME = [
  "คาปูชิโน่",
  "มอคค่า",
  "คาราเมลมัคคิอาโต้"
].map(normalizedName);

const TEA_MILK_FLAT = [
  "ดาร์กช็อกโกแลต",
  "ชามะนาว",
  "น้ำผึ้งมะนาว",
  "ชาพีช",
  "โกโก้มิ้นท์"
].map(normalizedName);

const TEA_MILK_DOME = [
  "นมสด",
  "ชาไทย",
  "ชาเขียว",
  "นมชมพู",
  "นมสดมิ้นท์",
  "นมสดบราวน์ชูก้า",
  "โกโก้",
  "นมสดคาราเมล",
  "นมสดน้ำผึ้ง"
].map(normalizedName);

const BLENDED_SPOON = [
  "ปีโป้นมสดปั่น",
  "นมสดโอรีโอปั่น",
  "โกโก้โอรีโอปั่น",
  "กล้วยปั่น",
  "นมสดโอรีโอกล้วยปั่น",
  "โกโก้โอรีโอกล้วยปั่น",
  "เฉาก๊วย",
  "เฉาก๊วยนมสด"
].map(normalizedName);

function containsAny(name, words) {
  return words.some(word => name.includes(normalizedName(word)));
}

function packagingForMenu(menuName) {
  const n = normalizedName(menuName);

  // เมนูร้อน
  if (n.includes("ร้อน")) {
    return [STOCK_NAMES.hot8, STOCK_NAMES.hotLid8, STOCK_NAMES.hotFlatStraw];
  }

  // ปังเย็น
  if (n.includes("ปังเย็น")) {
    return [STOCK_NAMES.jar22, STOCK_NAMES.jarDome22, STOCK_NAMES.spoonStraw];
  }

  // Signature 22 oz
  if (n.includes("ซิกเนเจอร์")) {
    const hasCream = n.includes("ครีมชีส") || n.includes("ดับเบิ้ล");
    return [
      STOCK_NAMES.cup22,
      hasCream ? STOCK_NAMES.dome98 : STOCK_NAMES.flat22,
      STOCK_NAMES.straw
    ];
  }

  // เมนูปั่น/โอรีโอ/ปีโป้/กล้วย/เฉาก๊วย
  if (
    BLENDED_SPOON.includes(n) ||
    n.includes("ปั่น") ||
    n.includes("โอรีโอ") ||
    n.includes("ปีโป้") ||
    n.includes("กล้วย")
  ) {
    return [STOCK_NAMES.cup16, STOCK_NAMES.whip98, STOCK_NAMES.spoonStraw];
  }

  // สมูทตี้
  if (n.includes("สมูทตี้")) {
    return [STOCK_NAMES.cup16, STOCK_NAMES.whip98, STOCK_NAMES.spoonStraw];
  }

  // กาแฟมีฟองนม
  if (COFFEE_DOME.includes(n)) {
    return [STOCK_NAMES.cup16, STOCK_NAMES.dome98, STOCK_NAMES.straw];
  }

  // ชาและนมฝาเรียบ
  if (TEA_MILK_FLAT.includes(n)) {
    return [STOCK_NAMES.cup16, STOCK_NAMES.dome98, STOCK_NAMES.straw];
  }

  // ชาและนมฝาโดม
  if (TEA_MILK_DOME.includes(n)) {
    return [STOCK_NAMES.cup16, STOCK_NAMES.dome98, STOCK_NAMES.straw];
  }

  // โซดาใช้ฝาโดม
  if (containsAny(n, ["โซดา", "บลูฮาวาย", "สตรอว์เบอร์รี", "ลิ้นจี่", "กีวี่", "เสาวรส"])) {
    return [STOCK_NAMES.cup16, STOCK_NAMES.flat98, STOCK_NAMES.straw];
  }

  // กาแฟทั่วไปไม่มีฟองนม และเครื่องดื่มเย็นทั่วไป
  return [STOCK_NAMES.cup16, STOCK_NAMES.flat98, STOCK_NAMES.straw];
}


function packagingStockNameSet() {
  return new Set(Object.values(STOCK_NAMES));
}

function actualPackagingRulesForMenu(menuName) {
  const target = normalizedName(menuName);
  const packagingNames = packagingStockNameSet();

  return rules
    .filter(rule => normalizedName(rule.menu_name) === target)
    .map(rule => rule.stock_items?.name || "")
    .filter(name => packagingNames.has(name));
}

function buildRuleAuditItems() {
  ruleAuditItems = menuNames.map(menuName => {
    const expected = packagingForMenu(menuName);
    const actual = actualPackagingRulesForMenu(menuName);

    const expectedSet = new Set(expected);
    const actualSet = new Set(actual);

    const missing = expected.filter(name => !actualSet.has(name));
    const extra = [...actualSet].filter(name => !expectedSet.has(name));

    let status = "ok";

    if (!actual.length) {
      status = "missing";
    } else if (missing.length || extra.length) {
      status = "check";
    }

    return {
      menuName,
      expected,
      actual: [...actualSet],
      missing,
      extra,
      status
    };
  });
}

function auditStatusText(status) {
  return {
    ok: "สูตรครบ",
    check: "ต้องตรวจ",
    missing: "ไม่มีสูตร"
  }[status] || status;
}

function renderRuleAudit() {
  if (!stockRuleAuditResult) return;

  buildRuleAuditItems();

  const okItems = ruleAuditItems.filter(item => item.status === "ok");
  const checkItems = ruleAuditItems.filter(item => item.status === "check");
  const missingItems = ruleAuditItems.filter(item => item.status === "missing");

  auditAllCount.textContent = ruleAuditItems.length.toLocaleString("th-TH");
  auditOkCount.textContent = okItems.length.toLocaleString("th-TH");
  auditCheckCount.textContent = checkItems.length.toLocaleString("th-TH");
  auditMissingCount.textContent = missingItems.length.toLocaleString("th-TH");

  const filtered = ruleAuditItems.filter(item =>
    ruleAuditFilter === "all" || item.status === ruleAuditFilter
  );

  if (!filtered.length) {
    stockRuleAuditResult.innerHTML =
      '<div class="stock-rule-audit-empty">ไม่มีรายการในกลุ่มนี้</div>';
    return;
  }

  stockRuleAuditResult.innerHTML = filtered.map(item => {
    const missingHtml = item.missing.length
      ? `<div class="audit-detail missing">
          <strong>ขาด:</strong> ${item.missing.join(" • ")}
        </div>`
      : "";

    const extraHtml = item.extra.length
      ? `<div class="audit-detail extra">
          <strong>เกิน/ไม่ตรง:</strong> ${item.extra.join(" • ")}
        </div>`
      : "";

    const actualHtml = item.actual.length
      ? item.actual.join(" • ")
      : "ยังไม่มีสูตร";

    return `
      <article class="stock-rule-audit-card ${item.status}">
        <div class="stock-rule-audit-card-head">
          <div>
            <h3>${item.menuName}</h3>
            <span>${auditStatusText(item.status)}</span>
          </div>
          <button type="button" data-audit-menu="${item.menuName}">
            ดูสูตร
          </button>
        </div>

        <div class="audit-detail">
          <strong>ควรใช้:</strong> ${item.expected.join(" • ")}
        </div>

        <div class="audit-detail">
          <strong>สูตรปัจจุบัน:</strong> ${actualHtml}
        </div>

        ${missingHtml}
        ${extraHtml}
      </article>
    `;
  }).join("");

  stockRuleAuditResult
    .querySelectorAll("[data-audit-menu]")
    .forEach(button => {
      button.addEventListener("click", () => {
        stockRuleSearch.value = button.dataset.auditMenu;
        renderRules();

        document.getElementById("stockRuleList")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
}

async function createStandardRules() {
  if (!menuNames.length) {
    standardRulesResult.textContent = "ยังโหลดรายชื่อเมนูไม่สำเร็จ";
    return;
  }

  const pin = await requestPin();
  if (!pin) return;

  createStandardRulesButton.disabled = true;
  createStandardRulesButton.textContent = "กำลังสร้างสูตร...";
  standardRulesResult.className = "standard-rules-result loading";
  standardRulesResult.textContent = "กำลังสร้างรายการสต็อกและสูตรมาตรฐาน...";

  const rulePayload = [];

  menuNames.forEach(menuName => {
    packagingForMenu(menuName).forEach(stockName => {
      rulePayload.push({
        menu_name: menuName,
        stock_name: stockName,
        quantity_per_unit: 1
      });
    });
  });

  const { data, error } = await sb.rpc("manager_create_356_standard_stock_rules", {
    p_pin: pin,
    p_rules: rulePayload
  });

  createStandardRulesButton.disabled = false;
  createStandardRulesButton.textContent = "⚡ สร้างสูตรมาตรฐานร้าน 356";

  if (error) {
    standardRulesResult.className = "standard-rules-result error";
    standardRulesResult.textContent = "สร้างสูตรไม่สำเร็จ: " + error.message;
    return;
  }

  const result = data || {};
  standardRulesResult.className = "standard-rules-result success";
  standardRulesResult.innerHTML = `
    <strong>✅ สร้างสูตรมาตรฐานเรียบร้อย</strong>
    <span>${Number(result.menu_count || menuNames.length).toLocaleString("th-TH")} เมนู</span>
    <span>${Number(result.rule_count || rulePayload.length).toLocaleString("th-TH")} สูตร</span>
    <span>${Number(result.stock_count || 14).toLocaleString("th-TH")} รายการสต็อก</span>
    <small>ท็อปปิ้งไม่ถูกนำมานับสต็อก</small>
  `;

  await Promise.all([loadStockItems(), loadRules()]);
}

async function initialize() {
  try {
    await Promise.all([loadMenuNames(), loadStockItems()]);
    await loadRules();
  } catch (error) {
    stockRuleError.textContent = "โหลดข้อมูลไม่สำเร็จ: " + error.message;
  }
}

refreshRuleAuditButton?.addEventListener("click", async () => {
  refreshRuleAuditButton.disabled = true;
  refreshRuleAuditButton.textContent = "กำลังตรวจ...";

  await Promise.all([loadMenuNames(), loadStockItems()]);
  await loadRules();

  refreshRuleAuditButton.disabled = false;
  refreshRuleAuditButton.textContent = "ตรวจใหม่";
});

document.querySelectorAll("[data-audit-filter]").forEach(button => {
  button.addEventListener("click", () => {
    ruleAuditFilter = button.dataset.auditFilter;

    document.querySelectorAll("[data-audit-filter]")
      .forEach(item => item.classList.toggle(
        "active",
        item.dataset.auditFilter === ruleAuditFilter
      ));

    renderRuleAudit();
  });
});

document.querySelector('[data-audit-filter="all"]')?.classList.add("active");

createStandardRulesButton.addEventListener("click", createStandardRules);
addStockRuleButton.addEventListener("click", addRule);
stockRuleSearch.addEventListener("input", renderRules);
window.addEventListener("manager-unlocked", initialize);
