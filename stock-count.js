const sb = supabase.createClient(
  APP_CONFIG.SUPABASE_URL,
  APP_CONFIG.SUPABASE_ANON_KEY
);

const stockCountSearch = document.getElementById("stockCountSearch");
const stockCountList = document.getElementById("stockCountList");
const countAllItems = document.getElementById("countAllItems");
const countChangedItems = document.getElementById("countChangedItems");
const countPositiveItems = document.getElementById("countPositiveItems");
const countNegativeItems = document.getElementById("countNegativeItems");
const fillSystemQuantityButton = document.getElementById("fillSystemQuantityButton");
const clearCountButton = document.getElementById("clearCountButton");
const stockCountNote = document.getElementById("stockCountNote");
const stockCountError = document.getElementById("stockCountError");
const saveStockCountButton = document.getElementById("saveStockCountButton");

let stockItems = [];
const actualValues = new Map();

function formatNumber(value) {
  return Number(value || 0).toLocaleString("th-TH", {
    maximumFractionDigits: 2
  });
}

function numericValue(value) {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function differenceFor(item) {
  const actual = numericValue(actualValues.get(item.id));
  if (actual === null) return null;
  return actual - Number(item.quantity || 0);
}

function updateSummary() {
  let changed = 0;
  let positive = 0;
  let negative = 0;

  stockItems.forEach(item => {
    const difference = differenceFor(item);
    if (difference === null || difference === 0) return;

    changed += 1;
    if (difference > 0) positive += 1;
    if (difference < 0) negative += 1;
  });

  countAllItems.textContent = stockItems.length.toLocaleString("th-TH");
  countChangedItems.textContent = changed.toLocaleString("th-TH");
  countPositiveItems.textContent = positive.toLocaleString("th-TH");
  countNegativeItems.textContent = negative.toLocaleString("th-TH");
}

function differenceText(difference, unit) {
  if (difference === null) return "ยังไม่กรอก";
  if (difference === 0) return "ตรงกับระบบ";
  if (difference > 0) return `เกินระบบ +${formatNumber(difference)} ${unit}`;
  return `ขาดจากระบบ ${formatNumber(difference)} ${unit}`;
}

function renderStockCount() {
  const query = stockCountSearch.value.trim().toLowerCase();

  const filtered = stockItems.filter(item =>
    `${item.name} ${item.category || ""} ${item.unit || ""}`
      .toLowerCase()
      .includes(query)
  );

  stockCountList.innerHTML = "";

  if (!filtered.length) {
    stockCountList.innerHTML =
      '<div class="empty-state">ไม่พบรายการสต็อก</div>';
    return;
  }

  filtered.forEach(item => {
    const difference = differenceFor(item);
    const row = document.createElement("article");
    row.className = "stock-count-card";

    if (difference > 0) row.classList.add("positive");
    if (difference < 0) row.classList.add("negative");
    if (difference === 0) row.classList.add("equal");

    const currentActual = actualValues.has(item.id)
      ? actualValues.get(item.id)
      : "";

    row.innerHTML = `
      <div class="stock-count-card-info">
        <span>${item.category || "ทั่วไป"}</span>
        <h3>${item.name}</h3>
        <div>ยอดในระบบ <b>${formatNumber(item.quantity)} ${item.unit}</b></div>
      </div>

      <label class="stock-count-input-wrap">
        <span>นับได้จริง (${item.unit})</span>
        <input type="number" min="0" step="0.01" inputmode="decimal"
          value="${currentActual}" data-count-item-id="${item.id}">
        <small class="stock-count-difference">
          ${differenceText(difference, item.unit)}
        </small>
      </label>
    `;

    const input = row.querySelector("[data-count-item-id]");
    input.addEventListener("input", () => {
      actualValues.set(item.id, input.value);
      updateSummary();
      renderStockCount();
      requestAnimationFrame(() => {
        const nextInput = stockCountList.querySelector(
          `[data-count-item-id="${item.id}"]`
        );
        nextInput?.focus();
        if (nextInput) {
          const length = nextInput.value.length;
          nextInput.setSelectionRange?.(length, length);
        }
      });
    });

    stockCountList.appendChild(row);
  });
}

async function loadStockItems() {
  const { data, error } = await sb
    .from("stock_items")
    .select("id,name,category,unit,quantity,sort_order,is_active")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    stockCountList.innerHTML =
      `<div class="empty-state">โหลดข้อมูลไม่สำเร็จ: ${error.message}</div>`;
    return;
  }

  stockItems = data || [];
  updateSummary();
  renderStockCount();
}

function requestManagerPin() {
  return new Promise(resolve => {
    const overlay = document.createElement("div");
    overlay.className = "approval-overlay";
    overlay.innerHTML = `
      <div class="approval-card">
        <div class="approval-icon">🔐</div>
        <h2>ยืนยันตรวจนับสต็อก</h2>
        <p>กรอก PIN ผู้จัดการก่อนปรับยอดจริง</p>

        <label class="approval-field">
          <span>PIN ผู้จัดการ 4 หลัก</span>
          <input class="approval-pin" type="password"
            inputmode="numeric" maxlength="4" placeholder="••••">
        </label>

        <div class="approval-error"></div>

        <div class="approval-actions">
          <button class="approval-cancel" type="button">ยกเลิก</button>
          <button class="approval-confirm primary" type="button">ยืนยัน</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const pinInput = overlay.querySelector(".approval-pin");
    const errorElement = overlay.querySelector(".approval-error");
    const confirmButton = overlay.querySelector(".approval-confirm");

    const finish = value => {
      overlay.remove();
      resolve(value);
    };

    overlay.querySelector(".approval-cancel")
      .addEventListener("click", () => finish(null));

    const confirm = async () => {
      const pin = pinInput.value.trim();

      if (!/^\d{4}$/.test(pin)) {
        errorElement.textContent = "กรุณากรอก PIN 4 หลัก";
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
        errorElement.textContent = error.message;
      } else if (!data) {
        errorElement.textContent = "PIN ไม่ถูกต้อง";
        pinInput.value = "";
        pinInput.focus();
      } else {
        finish(pin);
      }
    };

    confirmButton.addEventListener("click", confirm);
    pinInput.addEventListener("keydown", event => {
      if (event.key === "Enter") confirm();
    });

    setTimeout(() => pinInput.focus(), 50);
  });
}

async function saveStockCount() {
  stockCountError.textContent = "";

  const changedItems = stockItems
    .map(item => {
      const actual = numericValue(actualValues.get(item.id));
      if (actual === null) return null;

      const systemQuantity = Number(item.quantity || 0);
      if (actual === systemQuantity) return null;

      return {
        stock_item_id: item.id,
        actual_quantity: actual
      };
    })
    .filter(Boolean);

  if (!changedItems.length) {
    stockCountError.textContent =
      "ยังไม่มีรายการที่ยอดจริงต่างจากยอดในระบบ";
    return;
  }

  if (changedItems.some(item => item.actual_quantity < 0)) {
    stockCountError.textContent = "จำนวนจริงต้องไม่ติดลบ";
    return;
  }

  const pin = await requestManagerPin();
  if (!pin) return;

  saveStockCountButton.disabled = true;
  saveStockCountButton.textContent = "กำลังบันทึก...";

  const { data, error } = await sb.rpc("manager_bulk_stock_count", {
    p_pin: pin,
    p_counts: changedItems,
    p_note: stockCountNote.value.trim() || null
  });

  saveStockCountButton.disabled = false;
  saveStockCountButton.textContent = "บันทึกผลตรวจนับ";

  if (error) {
    stockCountError.textContent = "บันทึกไม่สำเร็จ: " + error.message;
    return;
  }

  const result = data || {};
  alert(
    `บันทึกผลตรวจนับสำเร็จ ${Number(result.changed_count || 0)} รายการ`
  );

  actualValues.clear();
  stockCountNote.value = "";
  await loadStockItems();
}

fillSystemQuantityButton.addEventListener("click", () => {
  stockItems.forEach(item => {
    actualValues.set(item.id, String(Number(item.quantity || 0)));
  });
  updateSummary();
  renderStockCount();
});

clearCountButton.addEventListener("click", () => {
  actualValues.clear();
  updateSummary();
  renderStockCount();
});

stockCountSearch.addEventListener("input", renderStockCount);
saveStockCountButton.addEventListener("click", saveStockCount);

loadStockItems();
