const sb = supabase.createClient(
  APP_CONFIG.SUPABASE_URL,
  APP_CONFIG.SUPABASE_ANON_KEY
);

const receiveSearch = document.getElementById("receiveSearch");
const receiveCategory = document.getElementById("receiveCategory");
const clearReceiveButton = document.getElementById("clearReceiveButton");
const receiveList = document.getElementById("receiveList");
const receiveAllCount = document.getElementById("receiveAllCount");
const receiveSelectedCount = document.getElementById("receiveSelectedCount");
const receiveTotalAmount = document.getElementById("receiveTotalAmount");
const receiveNote = document.getElementById("receiveNote");
const receiveError = document.getElementById("receiveError");
const saveReceiveButton = document.getElementById("saveReceiveButton");

let stockItems = [];
const receiveValues = new Map();

function numericValue(value) {
  if (value === "" || value === null || value === undefined) return 0;
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function formatNumber(value) {
  return numericValue(value).toLocaleString("th-TH", {
    maximumFractionDigits: 2
  });
}

function filteredItems() {
  const query = receiveSearch.value.trim().toLowerCase();
  const category = receiveCategory.value;

  return stockItems.filter(item => {
    const matchesQuery =
      `${item.name} ${item.category || ""} ${item.unit || ""}`
        .toLowerCase()
        .includes(query);

    const matchesCategory =
      category === "all" || (item.category || "ทั่วไป") === category;

    return matchesQuery && matchesCategory;
  });
}

function updateSummary() {
  const selected = stockItems.filter(
    item => numericValue(receiveValues.get(item.id)) > 0
  );

  const total = selected.reduce(
    (sum, item) => sum + numericValue(receiveValues.get(item.id)),
    0
  );

  receiveAllCount.textContent = stockItems.length.toLocaleString("th-TH");
  receiveSelectedCount.textContent = selected.length.toLocaleString("th-TH");
  receiveTotalAmount.textContent = formatNumber(total);
}

function renderCategories() {
  const current = receiveCategory.value || "all";
  const categories = [...new Set(
    stockItems.map(item => item.category || "ทั่วไป")
  )].sort((a, b) => a.localeCompare(b, "th"));

  receiveCategory.innerHTML =
    '<option value="all">ทุกหมวดหมู่</option>' +
    categories.map(category =>
      `<option value="${category}">${category}</option>`
    ).join("");

  receiveCategory.value = categories.includes(current) ? current : "all";
}

function renderList() {
  const items = filteredItems();
  receiveList.innerHTML = "";

  if (!items.length) {
    receiveList.innerHTML =
      '<div class="empty-state">ไม่พบรายการสต็อก</div>';
    updateSummary();
    return;
  }

  items.forEach(item => {
    const amount = receiveValues.get(item.id) || "";
    const after = Number(item.quantity || 0) + numericValue(amount);

    const card = document.createElement("article");
    card.className = "bulk-receive-card";

    if (numericValue(amount) > 0) {
      card.classList.add("filled");
    }

    card.innerHTML = `
      <div class="bulk-receive-info">
        <span>${item.category || "ทั่วไป"}</span>
        <h3>${item.name}</h3>
        <div class="bulk-receive-current">
          คงเหลือปัจจุบัน
          <b>${formatNumber(item.quantity)} ${item.unit}</b>
        </div>
      </div>

      <label class="bulk-receive-input">
        <span>จำนวนรับเข้า (${item.unit})</span>
        <input type="number" min="0" step="0.01" inputmode="decimal"
          value="${amount}" data-receive-id="${item.id}"
          placeholder="0">
        <small>
          หลังรับเข้า ${formatNumber(after)} ${item.unit}
        </small>
      </label>
    `;

    const input = card.querySelector(`[data-receive-id="${item.id}"]`);
    input.addEventListener("change", () => {
      const cleanValue = Math.max(0, numericValue(input.value));

      if (cleanValue > 0) {
        receiveValues.set(item.id, String(cleanValue));
      } else {
        receiveValues.delete(item.id);
      }

      renderList();
    });

    receiveList.appendChild(card);
  });

  updateSummary();
}

async function requestManagerPin() {
  return new Promise(resolve => {
    const overlay = document.createElement("div");
    overlay.className = "approval-overlay";
    overlay.innerHTML = `
      <div class="approval-card">
        <div class="approval-icon">🔐</div>
        <h2>ยืนยันรับสต็อก</h2>
        <p>กรอก PIN ผู้จัดการก่อนเพิ่มยอดสต็อก</p>

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

async function saveReceive() {
  receiveError.textContent = "";

  const items = stockItems
    .map(item => ({
      stock_item_id: item.id,
      amount: numericValue(receiveValues.get(item.id))
    }))
    .filter(item => item.amount > 0);

  if (!items.length) {
    receiveError.textContent =
      "กรุณากรอกจำนวนรับเข้าอย่างน้อย 1 รายการ";
    return;
  }

  const pin = await requestManagerPin();
  if (!pin) return;

  saveReceiveButton.disabled = true;
  saveReceiveButton.textContent = "กำลังบันทึก...";

  const { data, error } = await sb.rpc("manager_bulk_stock_receive", {
    p_pin: pin,
    p_items: items,
    p_note: receiveNote.value.trim() || null
  });

  saveReceiveButton.disabled = false;
  saveReceiveButton.textContent = "บันทึกรับเข้าหลายรายการ";

  if (error) {
    receiveError.textContent = "บันทึกไม่สำเร็จ: " + error.message;
    return;
  }

  alert(
    `รับสต็อกสำเร็จ ${Number(data?.item_count || 0)} รายการ`
  );

  receiveValues.clear();
  receiveNote.value = "";
  await loadStockItems();
}

async function loadStockItems() {
  const { data, error } = await sb
    .from("stock_items")
    .select(`
      id,
      name,
      category,
      unit,
      quantity,
      sort_order,
      is_active
    `)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    receiveList.innerHTML =
      `<div class="empty-state">โหลดข้อมูลไม่สำเร็จ: ${error.message}</div>`;
    return;
  }

  stockItems = data || [];
  renderCategories();
  renderList();
}

receiveSearch.addEventListener("input", renderList);
receiveCategory.addEventListener("change", renderList);

clearReceiveButton.addEventListener("click", () => {
  receiveValues.clear();
  renderList();
});

saveReceiveButton.addEventListener("click", saveReceive);

loadStockItems();
