const sb = supabase.createClient(
  APP_CONFIG.SUPABASE_URL,
  APP_CONFIG.SUPABASE_ANON_KEY
);

const stockHistorySearch = document.getElementById("stockHistorySearch");
const stockHistoryType = document.getElementById("stockHistoryType");
const stockHistoryList = document.getElementById("stockHistoryList");

let historyItems = [];

function formatDateTime(value) {
  return new Date(value).toLocaleString("th-TH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function movementText(type, reason = "") {
  if (reason === "ขายอัตโนมัติ") return "ตัดจากการขาย";
  if (reason === "คืนจากยกเลิกออเดอร์") return "คืนจากยกเลิก";
  return {
    in: "รับเข้า",
    out: "เบิกออก",
    set: "ตั้งยอดใหม่"
  }[type] || type;
}

function renderHistory() {
  const query = stockHistorySearch.value.trim().toLowerCase();
  const type = stockHistoryType.value;

  const filtered = historyItems.filter(item => {
    const text =
      `${item.stock_items?.name || ""} ${item.reason || ""} ${item.note || ""}`
        .toLowerCase();

    return text.includes(query) &&
      (type === "all" || item.movement_type === type);
  });

  stockHistoryList.innerHTML = "";

  if (!filtered.length) {
    stockHistoryList.innerHTML =
      '<div class="empty-state">ยังไม่มีประวัติสต็อกที่ตรงกับการค้นหา</div>';
    return;
  }

  filtered.forEach(item => {
    const row = document.createElement("article");
    row.className = `stock-history-item ${item.movement_type}`;

    row.innerHTML = `
      <div>
        <div class="stock-history-title">
          <strong>${item.stock_items?.name || "ไม่พบชื่อสินค้า"}</strong>
          <span>${movementText(item.movement_type, item.reason)}</span>
        </div>
        <div>${item.reason}${item.note ? ` • ${item.note}` : ""}</div>
        <small>${formatDateTime(item.created_at)}</small>
      </div>

      <div class="stock-history-values">
        <b>
          ${item.movement_type === "in" ? "+" : item.movement_type === "out" ? "-" : "="}
          ${Number(item.amount || 0).toLocaleString("th-TH")}
          ${item.stock_items?.unit || ""}
        </b>
        <small>
          ${Number(item.quantity_before || 0).toLocaleString("th-TH")}
          → ${Number(item.quantity_after || 0).toLocaleString("th-TH")}
        </small>
      </div>
    `;

    stockHistoryList.appendChild(row);
  });
}

async function loadHistory() {
  stockHistoryList.innerHTML =
    '<div class="empty-state">กำลังโหลดประวัติ...</div>';

  const { data, error } = await sb
    .from("stock_movements")
    .select(`
      *,
      stock_items (
        name,
        unit
      )
    `)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    stockHistoryList.innerHTML =
      `<div class="empty-state">โหลดประวัติไม่สำเร็จ: ${error.message}</div>`;
    return;
  }

  historyItems = data || [];
  renderHistory();
}

stockHistorySearch.addEventListener("input", renderHistory);
stockHistoryType.addEventListener("change", renderHistory);
window.addEventListener("manager-unlocked", loadHistory);
