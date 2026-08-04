const sb = supabase.createClient(
  APP_CONFIG.SUPABASE_URL,
  APP_CONFIG.SUPABASE_ANON_KEY
);

const issueSearch = document.getElementById("issueSearch");
const issueCategory = document.getElementById("issueCategory");
const clearIssueButton = document.getElementById("clearIssueButton");
const issueList = document.getElementById("issueList");
const issueAllCount = document.getElementById("issueAllCount");
const issueSelectedCount = document.getElementById("issueSelectedCount");
const issueTotalAmount = document.getElementById("issueTotalAmount");
const issueReason = document.getElementById("issueReason");
const issueNote = document.getElementById("issueNote");
const issueError = document.getElementById("issueError");
const saveIssueButton = document.getElementById("saveIssueButton");

let stockItems = [];
const issueValues = new Map();

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
  const query = issueSearch.value.trim().toLowerCase();
  const category = issueCategory.value;

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
    item => numericValue(issueValues.get(item.id)) > 0
  );

  const total = selected.reduce(
    (sum, item) => sum + numericValue(issueValues.get(item.id)),
    0
  );

  issueAllCount.textContent = stockItems.length.toLocaleString("th-TH");
  issueSelectedCount.textContent = selected.length.toLocaleString("th-TH");
  issueTotalAmount.textContent = formatNumber(total);
}

function renderCategories() {
  const current = issueCategory.value || "all";
  const categories = [...new Set(
    stockItems.map(item => item.category || "ทั่วไป")
  )].sort((a, b) => a.localeCompare(b, "th"));

  issueCategory.innerHTML =
    '<option value="all">ทุกหมวดหมู่</option>' +
    categories.map(category =>
      `<option value="${category}">${category}</option>`
    ).join("");

  issueCategory.value = categories.includes(current) ? current : "all";
}

function renderList() {
  const items = filteredItems();
  issueList.innerHTML = "";

  if (!items.length) {
    issueList.innerHTML =
      '<div class="empty-state">ไม่พบรายการสต็อก</div>';
    updateSummary();
    return;
  }

  items.forEach(item => {
    const amount = issueValues.get(item.id) || "";
    const quantity = Number(item.quantity || 0);
    const after = Math.max(0, quantity - numericValue(amount));

    const card = document.createElement("article");
    card.className = "bulk-issue-card";

    if (numericValue(amount) > 0) {
      card.classList.add("filled");
    }

    if (numericValue(amount) > quantity) {
      card.classList.add("invalid");
    }

    card.innerHTML = `
      <div class="bulk-issue-info">
        <span>${item.category || "ทั่วไป"}</span>
        <h3>${item.name}</h3>
        <div class="bulk-issue-current">
          คงเหลือปัจจุบัน
          <b>${formatNumber(quantity)} ${item.unit}</b>
        </div>
      </div>

      <label class="bulk-issue-input">
        <span>จำนวนที่ตัดออก (${item.unit})</span>
        <input type="number" min="0" max="${quantity}" step="0.01"
          inputmode="decimal" value="${amount}"
          data-issue-id="${item.id}" placeholder="0">
        <small>
          หลังตัดออก ${formatNumber(after)} ${item.unit}
        </small>
      </label>
    `;

    const input = card.querySelector(`[data-issue-id="${item.id}"]`);
    input.addEventListener("change", () => {
      const cleanValue = Math.max(0, numericValue(input.value));

      if (cleanValue > 0) {
        issueValues.set(item.id, String(cleanValue));
      } else {
        issueValues.delete(item.id);
      }

      renderList();
    });

    issueList.appendChild(card);
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
        <h2>ยืนยันตัดสต็อก</h2>
        <p>กรอก PIN ผู้จัดการก่อนตัดยอดออกจากระบบ</p>

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

async function saveIssue() {
  issueError.textContent = "";

  const items = stockItems
    .map(item => ({
      stock_item_id: item.id,
      amount: numericValue(issueValues.get(item.id)),
      available: Number(item.quantity || 0)
    }))
    .filter(item => item.amount > 0);

  if (!items.length) {
    issueError.textContent =
      "กรุณากรอกจำนวนที่จะตัดอย่างน้อย 1 รายการ";
    return;
  }

  if (!issueReason.value) {
    issueError.textContent = "กรุณาเลือกสาเหตุที่ตัดออก";
    return;
  }

  const overdrawn = items.find(item => item.amount > item.available);
  if (overdrawn) {
    issueError.textContent =
      "จำนวนที่ตัดออกต้องไม่มากกว่ายอดคงเหลือ";
    return;
  }

  const pin = await requestManagerPin();
  if (!pin) return;

  saveIssueButton.disabled = true;
  saveIssueButton.textContent = "กำลังบันทึก...";

  const payloadItems = items.map(item => ({
    stock_item_id: item.stock_item_id,
    amount: item.amount
  }));

  const { data, error } = await sb.rpc("manager_bulk_stock_issue", {
    p_pin: pin,
    p_items: payloadItems,
    p_reason: issueReason.value,
    p_note: issueNote.value.trim() || null
  });

  saveIssueButton.disabled = false;
  saveIssueButton.textContent = "ยืนยันตัดออกหลายรายการ";

  if (error) {
    issueError.textContent = "บันทึกไม่สำเร็จ: " + error.message;
    return;
  }

  alert(
    `ตัดสต็อกสำเร็จ ${Number(data?.item_count || 0)} รายการ`
  );

  issueValues.clear();
  issueReason.value = "";
  issueNote.value = "";
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
    issueList.innerHTML =
      `<div class="empty-state">โหลดข้อมูลไม่สำเร็จ: ${error.message}</div>`;
    return;
  }

  stockItems = data || [];
  renderCategories();
  renderList();
}

issueSearch.addEventListener("input", renderList);
issueCategory.addEventListener("change", renderList);

clearIssueButton.addEventListener("click", () => {
  issueValues.clear();
  renderList();
});

saveIssueButton.addEventListener("click", saveIssue);

loadStockItems();
