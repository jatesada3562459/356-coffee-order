const sb = supabase.createClient(
  APP_CONFIG.SUPABASE_URL,
  APP_CONFIG.SUPABASE_ANON_KEY
);

const startDateInput = document.getElementById("stockReportStartDate");
const endDateInput = document.getElementById("stockReportEndDate");
const categorySelect = document.getElementById("stockReportCategory");
const todayButton = document.getElementById("stockReportTodayButton");
const monthButton = document.getElementById("stockReportMonthButton");
const loadButton = document.getElementById("loadStockReportButton");
const exportButton = document.getElementById("exportStockReportButton");
const printButton = document.getElementById("printStockReportButton");

const statusElement = document.getElementById("stockReportStatus");
const errorElement = document.getElementById("stockReportError");
const inTotalElement = document.getElementById("stockReportInTotal");
const outTotalElement = document.getElementById("stockReportOutTotal");
const setCountElement = document.getElementById("stockReportSetCount");
const movementCountElement = document.getElementById("stockReportMovementCount");
const attentionCountElement = document.getElementById("stockAttentionCount");
const attentionList = document.getElementById("stockAttentionList");
const usageSummaryList = document.getElementById("stockUsageSummaryList");
const movementList = document.getElementById("stockReportMovementList");

let latestMovements = [];
let latestStockItems = [];
let latestUsageRows = [];
let latestRange = { startKey: "", endKey: "" };

function bangkokDateKey(value = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(value));
}

function dateRangeIso(startKey, endKey) {
  const start = new Date(`${startKey}T00:00:00+07:00`).toISOString();
  const endDate = new Date(`${endKey}T00:00:00+07:00`);
  endDate.setDate(endDate.getDate() + 1);

  return {
    start,
    end: endDate.toISOString()
  };
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("th-TH", {
    maximumFractionDigits: 2
  });
}

function formatDateTime(value) {
  return new Date(value).toLocaleString("th-TH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function thaiDate(dateKey) {
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date(`${dateKey}T12:00:00+07:00`));
}

function movementTypeText(item) {
  if (item.reason === "ขายอัตโนมัติ") return "ตัดจากการขาย";
  if (item.reason === "คืนจากคืนเงินเต็มจำนวน") return "คืนจากคืนเงิน";
  if (item.reason === "คืนจากยกเลิกออเดอร์") return "คืนจากยกเลิก";

  return {
    in: "รับเข้า",
    out: "เบิกออก",
    set: "ปรับยอด"
  }[item.movement_type] || item.movement_type;
}

function movementNet(item) {
  if (item.movement_type === "in") return Number(item.amount || 0);
  if (item.movement_type === "out") return -Number(item.amount || 0);

  return Number(item.quantity_after || 0) -
    Number(item.quantity_before || 0);
}

function setStatus(message, type = "info") {
  statusElement.textContent = message;
  statusElement.className = `report-load-status ${type}`;
}

function setToday() {
  const today = bangkokDateKey();
  startDateInput.value = today;
  endDateInput.value = today;
}

function setThisMonth() {
  const today = bangkokDateKey();
  startDateInput.value = `${today.slice(0, 8)}01`;
  endDateInput.value = today;
}

function stockStatus(item) {
  const quantity = Number(item.quantity || 0);
  const minimum = Number(item.minimum_quantity || 0);

  if (quantity <= 0) return "out";
  if (quantity <= minimum) return "low";
  return "ok";
}

function renderCategoryOptions(items) {
  const current = categorySelect.value || "all";
  const categories = [...new Set(
    items.map(item => item.category || "ทั่วไป")
  )].sort((a, b) => a.localeCompare(b, "th"));

  categorySelect.innerHTML =
    '<option value="all">ทุกหมวดหมู่</option>' +
    categories
      .map(category => `<option value="${category}">${category}</option>`)
      .join("");

  categorySelect.value = categories.includes(current) ? current : "all";
}

function renderAttention(items) {
  const filtered = items
    .filter(item => stockStatus(item) !== "ok")
    .filter(item =>
      categorySelect.value === "all" ||
      (item.category || "ทั่วไป") === categorySelect.value
    )
    .sort((a, b) => {
      const rank = { out: 0, low: 1 };
      return rank[stockStatus(a)] - rank[stockStatus(b)] ||
        a.name.localeCompare(b.name, "th");
    });

  attentionCountElement.textContent =
    `${filtered.length.toLocaleString("th-TH")} รายการ`;

  if (!filtered.length) {
    attentionList.innerHTML =
      '<div class="empty-state">สต็อกในหมวดนี้อยู่ในระดับปกติ</div>';
    return;
  }

  attentionList.innerHTML = filtered.map(item => {
    const status = stockStatus(item);

    return `
      <article class="stock-attention-card ${status}">
        <div>
          <strong>${item.name}</strong>
          <small>${item.category || "ทั่วไป"}</small>
        </div>
        <div class="stock-attention-value">
          <b>${formatNumber(item.quantity)} ${item.unit}</b>
          <small>ขั้นต่ำ ${formatNumber(item.minimum_quantity)} ${item.unit}</small>
        </div>
      </article>
    `;
  }).join("");
}

function buildUsageRows(movements, stockItems) {
  const map = new Map();

  stockItems.forEach(item => {
    map.set(item.id, {
      stock_item_id: item.id,
      name: item.name,
      category: item.category || "ทั่วไป",
      unit: item.unit,
      current_quantity: Number(item.quantity || 0),
      received: 0,
      used: 0,
      adjusted_net: 0,
      movement_count: 0
    });
  });

  movements.forEach(item => {
    const stockItem = item.stock_items;
    if (!stockItem) return;

    const row = map.get(item.stock_item_id) || {
      stock_item_id: item.stock_item_id,
      name: stockItem.name,
      category: stockItem.category || "ทั่วไป",
      unit: stockItem.unit,
      current_quantity: Number(stockItem.quantity || 0),
      received: 0,
      used: 0,
      adjusted_net: 0,
      movement_count: 0
    };

    if (item.movement_type === "in") {
      row.received += Number(item.amount || 0);
    } else if (item.movement_type === "out") {
      row.used += Number(item.amount || 0);
    } else if (item.movement_type === "set") {
      row.adjusted_net += movementNet(item);
    }

    row.movement_count += 1;
    map.set(item.stock_item_id, row);
  });

  return [...map.values()]
    .filter(row =>
      categorySelect.value === "all" ||
      row.category === categorySelect.value
    )
    .sort((a, b) =>
      b.used - a.used ||
      b.received - a.received ||
      a.name.localeCompare(b.name, "th")
    );
}

function renderUsageRows(rows) {
  latestUsageRows = rows;

  if (!rows.length) {
    usageSummaryList.innerHTML =
      '<div class="empty-state">ไม่พบข้อมูลในหมวดที่เลือก</div>';
    return;
  }

  usageSummaryList.innerHTML = rows.map(row => `
    <article class="stock-usage-row">
      <div class="stock-usage-main">
        <span>${row.category}</span>
        <strong>${row.name}</strong>
        <small>${row.movement_count.toLocaleString("th-TH")} รายการเคลื่อนไหว</small>
      </div>

      <div class="stock-usage-metrics">
        <div class="in">
          <span>รับเข้า</span>
          <b>+${formatNumber(row.received)}</b>
        </div>

        <div class="out">
          <span>ใช้ออก</span>
          <b>-${formatNumber(row.used)}</b>
        </div>

        <div class="set">
          <span>ปรับสุทธิ</span>
          <b>${row.adjusted_net > 0 ? "+" : ""}${formatNumber(row.adjusted_net)}</b>
        </div>

        <div class="current">
          <span>คงเหลือปัจจุบัน</span>
          <b>${formatNumber(row.current_quantity)} ${row.unit}</b>
        </div>
      </div>
    </article>
  `).join("");
}

function renderMovements(items) {
  const filtered = items.filter(item =>
    categorySelect.value === "all" ||
    (item.stock_items?.category || "ทั่วไป") === categorySelect.value
  );

  if (!filtered.length) {
    movementList.innerHTML =
      '<div class="empty-state">ไม่มีรายการเคลื่อนไหวในช่วงวันที่เลือก</div>';
    return;
  }

  movementList.innerHTML = filtered.slice(0, 300).map(item => {
    const net = movementNet(item);
    const sign = net > 0 ? "+" : "";

    return `
      <article class="stock-report-movement ${item.movement_type}">
        <div class="stock-report-movement-main">
          <div class="stock-report-movement-title">
            <strong>${item.stock_items?.name || "ไม่พบชื่อสินค้า"}</strong>
            <span>${movementTypeText(item)}</span>
          </div>
          <div>${item.reason || "-"}${item.note ? ` • ${item.note}` : ""}</div>
          <small>${formatDateTime(item.created_at)}</small>
        </div>

        <div class="stock-report-movement-value">
          <b>${sign}${formatNumber(net)} ${item.stock_items?.unit || ""}</b>
          <small>
            ${formatNumber(item.quantity_before)}
            → ${formatNumber(item.quantity_after)}
          </small>
        </div>
      </article>
    `;
  }).join("");
}

function renderTotals(movements) {
  const filtered = movements.filter(item =>
    categorySelect.value === "all" ||
    (item.stock_items?.category || "ทั่วไป") === categorySelect.value
  );

  const received = filtered
    .filter(item => item.movement_type === "in")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const used = filtered
    .filter(item => item.movement_type === "out")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const setCount = filtered
    .filter(item => item.movement_type === "set").length;

  inTotalElement.textContent = formatNumber(received);
  outTotalElement.textContent = formatNumber(used);
  setCountElement.textContent = setCount.toLocaleString("th-TH");
  movementCountElement.textContent = filtered.length.toLocaleString("th-TH");
}

function renderAll() {
  renderTotals(latestMovements);
  renderAttention(latestStockItems);
  renderUsageRows(buildUsageRows(latestMovements, latestStockItems));
  renderMovements(latestMovements);
}

async function loadReport() {
  const startKey = startDateInput.value;
  const endKey = endDateInput.value;

  errorElement.textContent = "";

  if (!startKey || !endKey) {
    errorElement.textContent = "กรุณาเลือกวันที่เริ่มต้นและสิ้นสุด";
    return;
  }

  if (startKey > endKey) {
    errorElement.textContent = "วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด";
    return;
  }

  setStatus("กำลังโหลดรายงาน...", "loading");
  loadButton.disabled = true;
  loadButton.textContent = "กำลังโหลด...";

  const range = dateRangeIso(startKey, endKey);

  const [movementResult, stockResult] = await Promise.all([
    sb
      .from("stock_movements")
      .select(`
        id,
        stock_item_id,
        movement_type,
        amount,
        quantity_before,
        quantity_after,
        reason,
        note,
        actor,
        created_at,
        stock_items (
          name,
          category,
          unit,
          quantity
        )
      `)
      .gte("created_at", range.start)
      .lt("created_at", range.end)
      .order("created_at", { ascending: false })
      .limit(2000),

    sb
      .from("stock_items")
      .select(`
        id,
        name,
        category,
        unit,
        quantity,
        minimum_quantity,
        is_active
      `)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true })
  ]);

  loadButton.disabled = false;
  loadButton.textContent = "ดูรายงาน";

  if (movementResult.error) {
    setStatus("โหลดรายงานไม่สำเร็จ", "error");
    errorElement.textContent = movementResult.error.message;
    return;
  }

  if (stockResult.error) {
    setStatus("โหลดข้อมูลคงเหลือไม่สำเร็จ", "error");
    errorElement.textContent = stockResult.error.message;
    return;
  }

  latestMovements = movementResult.data || [];
  latestStockItems = stockResult.data || [];
  latestRange = { startKey, endKey };

  renderCategoryOptions(latestStockItems);
  renderAll();

  const rangeText = startKey === endKey
    ? thaiDate(startKey)
    : `${thaiDate(startKey)} – ${thaiDate(endKey)}`;

  setStatus(
    `✅ อัปเดตรายงานแล้ว: ${rangeText} • ${latestMovements.length.toLocaleString("th-TH")} รายการ`,
    "success"
  );
}

function csvEscape(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function exportCsv() {
  if (!latestRange.startKey) {
    alert("กรุณาโหลดรายงานก่อน");
    return;
  }

  const rows = [[
    "ชื่อสินค้า",
    "หมวดหมู่",
    "หน่วย",
    "รับเข้า",
    "ใช้ออก",
    "ปรับยอดสุทธิ",
    "คงเหลือปัจจุบัน",
    "จำนวนรายการเคลื่อนไหว"
  ]];

  latestUsageRows.forEach(row => {
    rows.push([
      row.name,
      row.category,
      row.unit,
      row.received,
      row.used,
      row.adjusted_net,
      row.current_quantity,
      row.movement_count
    ]);
  });

  const csv = "\uFEFF" +
    rows.map(row => row.map(csvEscape).join(",")).join("\r\n");

  const blob = new Blob([csv], {
    type: "text/csv;charset=utf-8"
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const rangeName = latestRange.startKey === latestRange.endKey
    ? latestRange.startKey
    : `${latestRange.startKey}_to_${latestRange.endKey}`;

  link.href = url;
  link.download = `356-stock-report-${rangeName}.csv`;

  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  setStatus("✅ ดาวน์โหลด CSV เรียบร้อย", "success");
}

function printReport() {
  if (!latestRange.startKey) {
    alert("กรุณาโหลดรายงานก่อน");
    return;
  }

  const oldTitle = document.title;
  document.title =
    `356 Stock Report ${latestRange.startKey} ${latestRange.endKey}`;

  window.print();

  setTimeout(() => {
    document.title = oldTitle;
  }, 300);
}

todayButton.addEventListener("click", () => {
  setToday();
  loadReport();
});

monthButton.addEventListener("click", () => {
  setThisMonth();
  loadReport();
});

loadButton.addEventListener("click", loadReport);
categorySelect.addEventListener("change", renderAll);
exportButton.addEventListener("click", exportCsv);
printButton.addEventListener("click", printReport);

window.addEventListener("manager-unlocked", () => {
  setToday();
  loadReport();
});
