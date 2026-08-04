const sb = supabase.createClient(
  APP_CONFIG.SUPABASE_URL,
  APP_CONFIG.SUPABASE_ANON_KEY
);

const reorderList = document.getElementById("reorderList");
const reorderSearch = document.getElementById("reorderSearch");
const reorderCategory = document.getElementById("reorderCategory");
const reorderProblemCount = document.getElementById("reorderProblemCount");
const reorderOutCount = document.getElementById("reorderOutCount");
const reorderLowCount = document.getElementById("reorderLowCount");
const reorderAllCount = document.getElementById("reorderAllCount");
const reorderSelectedCount = document.getElementById("reorderSelectedCount");
const reorderSuggestedTotal = document.getElementById("reorderSuggestedTotal");
const selectProblemItemsButton = document.getElementById("selectProblemItemsButton");
const clearSelectedItemsButton = document.getElementById("clearSelectedItemsButton");
const copyReorderListButton = document.getElementById("copyReorderListButton");
const shareReorderListButton = document.getElementById("shareReorderListButton");
const reorderNote = document.getElementById("reorderNote");
const reorderMessage = document.getElementById("reorderMessage");

let stockItems = [];
let statusFilter = "problem";
const selectedIds = new Set();
const targetValues = new Map();

function numberValue(value) {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

function formatNumber(value) {
  return numberValue(value).toLocaleString("th-TH", {
    maximumFractionDigits: 2
  });
}

function itemStatus(item) {
  const quantity = numberValue(item.quantity);
  const minimum = numberValue(item.minimum_quantity);

  if (quantity <= 0) return "out";
  if (quantity <= minimum) return "low";
  return "ok";
}

function statusText(status) {
  return {
    out: "หมดแล้ว",
    low: "ใกล้หมด",
    ok: "ปกติ"
  }[status] || status;
}

function defaultTarget(item) {
  const quantity = numberValue(item.quantity);
  const minimum = numberValue(item.minimum_quantity);

  if (minimum > 0) {
    return Math.max(minimum * 2, minimum + 1);
  }

  return Math.max(quantity, 1);
}

function targetFor(item) {
  if (!targetValues.has(item.id)) {
    targetValues.set(item.id, String(defaultTarget(item)));
  }

  return Math.max(0, numberValue(targetValues.get(item.id)));
}

function suggestedBuy(item) {
  return Math.max(0, targetFor(item) - numberValue(item.quantity));
}

function matchesStatus(item) {
  const status = itemStatus(item);

  if (statusFilter === "problem") return status === "out" || status === "low";
  if (statusFilter === "all") return true;
  return status === statusFilter;
}

function filteredItems() {
  const query = reorderSearch.value.trim().toLowerCase();
  const category = reorderCategory.value;

  return stockItems.filter(item => {
    const matchesQuery = `${item.name} ${item.category || ""} ${item.unit || ""}`
      .toLowerCase()
      .includes(query);

    const matchesCategory =
      category === "all" || (item.category || "ทั่วไป") === category;

    return matchesQuery && matchesCategory && matchesStatus(item);
  });
}

function updateCounts() {
  const outCount = stockItems.filter(item => itemStatus(item) === "out").length;
  const lowCount = stockItems.filter(item => itemStatus(item) === "low").length;
  const problemCount = outCount + lowCount;

  reorderAllCount.textContent = stockItems.length.toLocaleString("th-TH");
  reorderOutCount.textContent = outCount.toLocaleString("th-TH");
  reorderLowCount.textContent = lowCount.toLocaleString("th-TH");
  reorderProblemCount.textContent = problemCount.toLocaleString("th-TH");

  const selectedItems = stockItems.filter(item => selectedIds.has(item.id));
  const total = selectedItems.reduce(
    (sum, item) => sum + suggestedBuy(item),
    0
  );

  reorderSelectedCount.textContent =
    `${selectedItems.length.toLocaleString("th-TH")} รายการ`;
  reorderSuggestedTotal.textContent =
    `${formatNumber(total)} หน่วย`;
}

function renderCategories() {
  const current = reorderCategory.value || "all";
  const categories = [...new Set(
    stockItems.map(item => item.category || "ทั่วไป")
  )].sort((a, b) => a.localeCompare(b, "th"));

  reorderCategory.innerHTML =
    '<option value="all">ทุกหมวดหมู่</option>' +
    categories.map(category =>
      `<option value="${category}">${category}</option>`
    ).join("");

  reorderCategory.value = categories.includes(current) ? current : "all";
}

function renderList() {
  const items = filteredItems();
  reorderList.innerHTML = "";

  if (!items.length) {
    reorderList.innerHTML =
      '<div class="empty-state">ไม่พบรายการในกลุ่มที่เลือก</div>';
    updateCounts();
    return;
  }

  items.forEach(item => {
    const status = itemStatus(item);
    const target = targetFor(item);
    const suggested = suggestedBuy(item);
    const selected = selectedIds.has(item.id);

    const card = document.createElement("article");
    card.className = `reorder-card ${status}${selected ? " selected" : ""}`;

    card.innerHTML = `
      <label class="reorder-check">
        <input type="checkbox" data-select-id="${item.id}" ${selected ? "checked" : ""}>
        <span></span>
      </label>

      <div class="reorder-card-info">
        <div class="reorder-card-title">
          <div>
            <small>${item.category || "ทั่วไป"}</small>
            <h3>${item.name}</h3>
          </div>
          <span class="reorder-status ${status}">${statusText(status)}</span>
        </div>

        <div class="reorder-current-grid">
          <div>
            <span>คงเหลือ</span>
            <b>${formatNumber(item.quantity)} ${item.unit}</b>
          </div>
          <div>
            <span>ขั้นต่ำ</span>
            <b>${formatNumber(item.minimum_quantity)} ${item.unit}</b>
          </div>
        </div>
      </div>

      <div class="reorder-quantity">
        <label>
          <span>ต้องการให้เหลือ</span>
          <input type="number" min="0" step="0.01" inputmode="decimal"
            data-target-id="${item.id}" value="${target}">
        </label>
        <div>
          ควรซื้อ
          <strong>${formatNumber(suggested)} ${item.unit}</strong>
        </div>
      </div>
    `;

    const checkbox = card.querySelector(`[data-select-id="${item.id}"]`);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        selectedIds.add(item.id);
      } else {
        selectedIds.delete(item.id);
      }

      renderList();
    });

    const targetInput = card.querySelector(`[data-target-id="${item.id}"]`);
    targetInput.addEventListener("change", () => {
      const cleanValue = Math.max(0, numberValue(targetInput.value));
      targetValues.set(item.id, String(cleanValue));
      renderList();
    });

    reorderList.appendChild(card);
  });

  updateCounts();
}

function selectedItemsForText() {
  return stockItems
    .filter(item => selectedIds.has(item.id))
    .map(item => ({
      ...item,
      buyQuantity: suggestedBuy(item)
    }))
    .filter(item => item.buyQuantity > 0);
}

function thaiDateNow() {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeZone: "Asia/Bangkok"
  }).format(new Date());
}

function buildOrderText() {
  const items = selectedItemsForText();

  if (!items.length) {
    return "";
  }

  const lines = [
    "🛒 รายการสั่งซื้อสต็อกร้าน 356",
    `วันที่ ${thaiDateNow()}`,
    ""
  ];

  items.forEach((item, index) => {
    lines.push(
      `${index + 1}. ${item.name} — ซื้อ ${formatNumber(item.buyQuantity)} ${item.unit}` +
      ` (เหลือ ${formatNumber(item.quantity)} / เป้าหมาย ${formatNumber(targetFor(item))})`
    );
  });

  const note = reorderNote.value.trim();
  if (note) {
    lines.push("", `หมายเหตุ: ${note}`);
  }

  return lines.join("\n");
}

function setMessage(text, type = "info") {
  reorderMessage.textContent = text;
  reorderMessage.className = `report-load-status ${type}`;
}

async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const area = document.createElement("textarea");
  area.value = text;
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  document.execCommand("copy");
  area.remove();
}

async function copyOrderList() {
  const text = buildOrderText();

  if (!text) {
    setMessage("กรุณาเลือกรายการที่ต้องซื้ออย่างน้อย 1 รายการ", "error");
    return;
  }

  try {
    await copyText(text);
    setMessage("✅ คัดลอกรายการสั่งซื้อเรียบร้อย", "success");
  } catch (error) {
    setMessage("คัดลอกไม่สำเร็จ: " + error.message, "error");
  }
}

async function shareOrderList() {
  const text = buildOrderText();

  if (!text) {
    setMessage("กรุณาเลือกรายการที่ต้องซื้ออย่างน้อย 1 รายการ", "error");
    return;
  }

  if (!navigator.share) {
    await copyOrderList();
    setMessage(
      "อุปกรณ์นี้ไม่รองรับปุ่มแชร์ จึงคัดลอกรายการให้แล้ว",
      "success"
    );
    return;
  }

  try {
    await navigator.share({
      title: "รายการสั่งซื้อสต็อกร้าน 356",
      text
    });
    setMessage("✅ เปิดหน้าต่างแชร์เรียบร้อย", "success");
  } catch (error) {
    if (error.name !== "AbortError") {
      setMessage("แชร์ไม่สำเร็จ: " + error.message, "error");
    }
  }
}

function selectProblemItems() {
  stockItems.forEach(item => {
    const status = itemStatus(item);
    if (status === "out" || status === "low") {
      selectedIds.add(item.id);
    }
  });

  renderList();
}

function clearSelectedItems() {
  selectedIds.clear();
  renderList();
  setMessage("");
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
      minimum_quantity,
      sort_order,
      is_active
    `)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    reorderList.innerHTML =
      `<div class="empty-state">โหลดข้อมูลไม่สำเร็จ: ${error.message}</div>`;
    return;
  }

  stockItems = data || [];

  stockItems.forEach(item => {
    if (itemStatus(item) === "out" || itemStatus(item) === "low") {
      selectedIds.add(item.id);
    }
  });

  renderCategories();
  renderList();
}

document.querySelectorAll("[data-reorder-status]").forEach(button => {
  button.addEventListener("click", () => {
    statusFilter = button.dataset.reorderStatus;

    document.querySelectorAll("[data-reorder-status]").forEach(item => {
      item.classList.toggle(
        "active",
        item.dataset.reorderStatus === statusFilter
      );
    });

    renderList();
  });
});

reorderSearch.addEventListener("input", renderList);
reorderCategory.addEventListener("change", renderList);
selectProblemItemsButton.addEventListener("click", selectProblemItems);
clearSelectedItemsButton.addEventListener("click", clearSelectedItems);
copyReorderListButton.addEventListener("click", copyOrderList);
shareReorderListButton.addEventListener("click", shareOrderList);

loadStockItems();
