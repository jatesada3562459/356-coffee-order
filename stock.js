const sb = supabase.createClient(
  APP_CONFIG.SUPABASE_URL,
  APP_CONFIG.SUPABASE_ANON_KEY
);

const stockItemCount = document.getElementById("stockItemCount");
const lowStockCount = document.getElementById("lowStockCount");
const outOfStockCount = document.getElementById("outOfStockCount");
const stockSearch = document.getElementById("stockSearch");
const stockStatusFilter = document.getElementById("stockStatusFilter");
const stockList = document.getElementById("stockList");

const stockAdjustModal = document.getElementById("stockAdjustModal");
const stockAdjustTitle = document.getElementById("stockAdjustTitle");
const stockAdjustCurrent = document.getElementById("stockAdjustCurrent");
const closeStockAdjustButton = document.getElementById("closeStockAdjustButton");
const stockMovementType = document.getElementById("stockMovementType");
const stockMovementAmount = document.getElementById("stockMovementAmount");
const stockMovementReason = document.getElementById("stockMovementReason");
const stockMovementNote = document.getElementById("stockMovementNote");
const stockAmountLabel = document.getElementById("stockAmountLabel");
const stockAdjustError = document.getElementById("stockAdjustError");
const saveStockAdjustmentButton = document.getElementById("saveStockAdjustmentButton");

let stockItems = [];
let selectedStockItem = null;

function stockStatus(item) {
  const quantity = Number(item.quantity || 0);
  const minimum = Number(item.minimum_quantity || 0);

  if (quantity <= 0) return "out";
  if (quantity <= minimum) return "low";
  return "ok";
}

function statusText(status) {
  return {
    ok: "ปกติ",
    low: "ใกล้หมด",
    out: "หมดแล้ว"
  }[status];
}

function updateSummary() {
  stockItemCount.textContent = stockItems.length.toLocaleString("th-TH");
  lowStockCount.textContent = stockItems
    .filter(item => stockStatus(item) === "low")
    .length.toLocaleString("th-TH");
  outOfStockCount.textContent = stockItems
    .filter(item => stockStatus(item) === "out")
    .length.toLocaleString("th-TH");
}

function renderStock() {
  const query = stockSearch.value.trim().toLowerCase();
  const filter = stockStatusFilter.value;

  const filtered = stockItems.filter(item => {
    const matchesQuery =
      `${item.name} ${item.category || ""} ${item.unit || ""}`
        .toLowerCase()
        .includes(query);

    const status = stockStatus(item);
    const matchesStatus = filter === "all" || filter === status;

    return matchesQuery && matchesStatus;
  });

  stockList.innerHTML = "";

  if (!filtered.length) {
    stockList.innerHTML =
      '<div class="empty-state">ไม่พบรายการสต็อก</div>';
    return;
  }

  filtered.forEach(item => {
    const status = stockStatus(item);
    const card = document.createElement("article");
    card.className = `stock-card ${status}`;

    card.innerHTML = `
      <div class="stock-card-head">
        <div>
          <span class="stock-category">${item.category || "ทั่วไป"}</span>
          <h3>${item.name}</h3>
        </div>
        <span class="stock-status ${status}">${statusText(status)}</span>
      </div>

      <div class="stock-quantity-row">
        <strong>${Number(item.quantity || 0).toLocaleString("th-TH")}</strong>
        <span>${item.unit}</span>
      </div>

      <div class="stock-minimum">
        แจ้งเตือนเมื่อเหลือ ${Number(item.minimum_quantity || 0).toLocaleString("th-TH")} ${item.unit}
      </div>

      <button class="stock-adjust-button" type="button">ปรับสต็อก</button>
    `;

    card.querySelector(".stock-adjust-button")
      .addEventListener("click", () => openStockAdjustment(item));

    stockList.appendChild(card);
  });
}

async function loadStock() {
  stockList.innerHTML = '<div class="empty-state">กำลังโหลดสต็อก...</div>';

  const { data, error } = await sb
    .from("stock_items")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    stockList.innerHTML =
      `<div class="empty-state">โหลดสต็อกไม่สำเร็จ: ${error.message}</div>`;
    return;
  }

  stockItems = data || [];
  updateSummary();
  renderStock();
}

function openStockAdjustment(item) {
  selectedStockItem = item;
  stockAdjustTitle.textContent = item.name;
  stockAdjustCurrent.textContent =
    `คงเหลือ ${Number(item.quantity || 0).toLocaleString("th-TH")} ${item.unit}`;
  stockMovementType.value = "in";
  stockMovementAmount.value = "";
  stockMovementReason.value = "";
  stockMovementNote.value = "";
  stockAdjustError.textContent = "";
  updateAmountLabel();

  stockAdjustModal.classList.add("show");
  stockAdjustModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeStockAdjustment() {
  stockAdjustModal.classList.remove("show");
  stockAdjustModal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  selectedStockItem = null;
}

function updateAmountLabel() {
  stockAmountLabel.textContent =
    stockMovementType.value === "set"
      ? "ยอดคงเหลือใหม่"
      : "จำนวน";
}

async function requestManagerPin() {
  return new Promise(resolve => {
    const overlay = document.createElement("div");
    overlay.className = "approval-overlay";
    overlay.innerHTML = `
      <div class="approval-card">
        <div class="approval-icon">🔐</div>
        <h2>ยืนยันปรับสต็อก</h2>
        <p>กรอก PIN ผู้จัดการเพื่อบันทึก</p>
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
      } else if (!data) {
        errorEl.textContent = "PIN ไม่ถูกต้อง";
        input.value = "";
        input.focus();
      } else {
        finish(pin);
      }
    }

    confirm.addEventListener("click", verify);
    input.addEventListener("keydown", event => {
      if (event.key === "Enter") verify();
    });

    setTimeout(() => input.focus(), 80);
  });
}

saveStockAdjustmentButton.addEventListener("click", async () => {
  if (!selectedStockItem) return;

  const movementType = stockMovementType.value;
  const amount = Number(stockMovementAmount.value);
  const reason = stockMovementReason.value;
  const note = stockMovementNote.value.trim();

  stockAdjustError.textContent = "";

  if (!Number.isFinite(amount) || amount < 0) {
    stockAdjustError.textContent = "กรุณากรอกจำนวนให้ถูกต้อง";
    return;
  }

  if (movementType !== "set" && amount <= 0) {
    stockAdjustError.textContent = "จำนวนต้องมากกว่า 0";
    return;
  }

  if (!reason) {
    stockAdjustError.textContent = "กรุณาเลือกเหตุผล";
    return;
  }

  const pin = await requestManagerPin();
  if (!pin) return;

  saveStockAdjustmentButton.disabled = true;
  saveStockAdjustmentButton.textContent = "กำลังบันทึก...";

  const { error } = await sb.rpc("manager_adjust_stock", {
    p_pin: pin,
    p_stock_item_id: selectedStockItem.id,
    p_movement_type: movementType,
    p_amount: amount,
    p_reason: reason,
    p_note: note || null
  });

  saveStockAdjustmentButton.disabled = false;
  saveStockAdjustmentButton.textContent = "บันทึกการปรับสต็อก";

  if (error) {
    stockAdjustError.textContent = "บันทึกไม่สำเร็จ: " + error.message;
    return;
  }

  closeStockAdjustment();
  await loadStock();
});

stockMovementType.addEventListener("change", updateAmountLabel);
stockSearch.addEventListener("input", renderStock);
stockStatusFilter.addEventListener("change", renderStock);
closeStockAdjustButton.addEventListener("click", closeStockAdjustment);
stockAdjustModal.querySelector("[data-close-stock-modal]")
  .addEventListener("click", closeStockAdjustment);

window.addEventListener("manager-unlocked", loadStock);
