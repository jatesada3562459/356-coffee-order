const sb = supabase.createClient(
  APP_CONFIG.SUPABASE_URL,
  APP_CONFIG.SUPABASE_ANON_KEY
);

const closingMonthFilter = document.getElementById("closingMonthFilter");
const showAllClosingsButton = document.getElementById("showAllClosingsButton");
const closingDaysCount = document.getElementById("closingDaysCount");
const closingTotalSales = document.getElementById("closingTotalSales");
const closingNetDifference = document.getElementById("closingNetDifference");
const closingList = document.getElementById("closingList");

const closingDetailPanel = document.getElementById("closingDetailPanel");
const closingDetailTitle = document.getElementById("closingDetailTitle");
const closingDetailDate = document.getElementById("closingDetailDate");
const closeDetailButton = document.getElementById("closeDetailButton");
const detailOpening = document.getElementById("detailOpening");
const detailCashSystem = document.getElementById("detailCashSystem");
const detailPromptSystem = document.getElementById("detailPromptSystem");
const detailActualCash = document.getElementById("detailActualCash");
const detailActualPrompt = document.getElementById("detailActualPrompt");
const detailNetDifference = document.getElementById("detailNetDifference");
const detailNote = document.getElementById("detailNote");
const anomalyList = document.getElementById("anomalyList");

let closings = [];

function numberBaht(value) {
  return `฿${Number(value || 0).toLocaleString("th-TH", {
    maximumFractionDigits: 2
  })}`;
}

function thaiDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(new Date(`${value}T12:00:00+07:00`));
}

function currentMonthKey() {
  const now = new Date();
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit"
  }).format(now);
}

function diffClass(value) {
  const number = Number(value || 0);
  if (number > 0) return "difference-positive";
  if (number < 0) return "difference-negative";
  return "difference-zero";
}

function renderSummary(items) {
  const totalSales = items.reduce(
    (sum, item) =>
      sum +
      Number(item.cash_sales_system || 0) +
      Number(item.promptpay_system || 0),
    0
  );

  const netDiff = items.reduce(
    (sum, item) => sum + Number(item.net_difference || 0),
    0
  );

  closingDaysCount.textContent = items.length.toLocaleString("th-TH");
  closingTotalSales.textContent = numberBaht(totalSales);
  closingNetDifference.textContent = numberBaht(netDiff);
  closingNetDifference.className = diffClass(netDiff);
}

function renderClosings() {
  const month = closingMonthFilter.value;

  const filtered = closings.filter(item => {
    if (!month) return true;
    return String(item.business_date || "").startsWith(month);
  });

  renderSummary(filtered);
  closingList.innerHTML = "";

  if (!filtered.length) {
    closingList.innerHTML =
      '<div class="empty-state">ยังไม่มีประวัติปิดยอดในช่วงที่เลือก</div>';
    return;
  }

  filtered.forEach(item => {
    const totalSales =
      Number(item.cash_sales_system || 0) +
      Number(item.promptpay_system || 0);

    const card = document.createElement("article");
    card.className = "closing-card";
    card.innerHTML = `
      <div class="closing-card-top">
        <div>
          <h3>${thaiDate(item.business_date)}</h3>
          <span>ยอดขาย ${numberBaht(totalSales)}</span>
        </div>
        <strong class="${diffClass(item.net_difference)}">
          ${numberBaht(item.net_difference)}
        </strong>
      </div>

      <div class="closing-card-meta">
        💵 เงินสดตามระบบ ${numberBaht(item.cash_sales_system)}<br>
        📱 พร้อมเพย์ตามระบบ ${numberBaht(item.promptpay_system)}<br>
        🧾 ปิดยอดเมื่อ ${new Date(item.closed_at).toLocaleTimeString("th-TH", {
          hour: "2-digit",
          minute: "2-digit"
        })} น.
      </div>

      <button class="view-closing-button" type="button">
        ดูรายละเอียดและรายการผิดปกติ
      </button>
    `;

    card.querySelector(".view-closing-button")
      .addEventListener("click", () => openClosingDetail(item));

    closingList.appendChild(card);
  });
}

async function loadClosings() {
  const { data, error } = await sb
    .from("daily_closings")
    .select("*")
    .order("business_date", { ascending: false });

  if (error) {
    closingList.innerHTML =
      `<div class="empty-state">โหลดประวัติปิดยอดไม่สำเร็จ: ${error.message}</div>`;
    return;
  }

  closings = data || [];
  renderClosings();
}

async function loadAnomalies(businessDate) {
  anomalyList.innerHTML =
    '<div class="empty-state">กำลังตรวจสอบรายการ...</div>';

  const start = new Date(`${businessDate}T00:00:00+07:00`).toISOString();
  const endDate = new Date(`${businessDate}T00:00:00+07:00`);
  endDate.setDate(endDate.getDate() + 1);
  const end = endDate.toISOString();

  const { data, error } = await sb
    .from("orders")
    .select(`
      id,
      order_no,
      customer_name,
      discount_amount,
      discount_reason,
      payment_method,
      actual_payment_method,
      reward_used,
      final_total,
      paid_at
    `)
    .eq("payment_status", "paid")
    .gte("paid_at", start)
    .lt("paid_at", end)
    .order("paid_at", { ascending: false });

  if (error) {
    anomalyList.innerHTML =
      `<div class="empty-state">โหลดรายการตรวจสอบไม่สำเร็จ: ${error.message}</div>`;
    return;
  }

  const anomalies = [];

  (data || []).forEach(order => {
    if (Number(order.discount_amount || 0) > 0) {
      anomalies.push({
        type: "ส่วนลด",
        order,
        detail:
          `${numberBaht(order.discount_amount)} • ${order.discount_reason || "ไม่ระบุเหตุผล"}`
      });
    }

    if (order.reward_used) {
      anomalies.push({
        type: "ใช้สิทธิ์สมาชิก",
        order,
        detail: "ใช้สิทธิ์ลด 30 บาท"
      });
    }

    if (
      order.actual_payment_method &&
      order.payment_method &&
      order.actual_payment_method !== order.payment_method
    ) {
      anomalies.push({
        type: "เปลี่ยนวิธีชำระ",
        order,
        detail:
          `${order.payment_method === "promptpay" ? "พร้อมเพย์" : "เงินสด"} → ` +
          `${order.actual_payment_method === "promptpay" ? "พร้อมเพย์" : "เงินสด"}`
      });
    }
  });

  anomalyList.innerHTML = "";

  if (!anomalies.length) {
    anomalyList.innerHTML =
      '<div class="anomaly-ok">✅ ไม่พบรายการผิดปกติที่ต้องตรวจสอบ</div>';
    return;
  }

  anomalies.forEach(item => {
    const row = document.createElement("div");
    row.className = "anomaly-item";
    row.innerHTML = `
      <div>
        <b>${item.type}</b>
        <div>${item.order.order_no} • ${item.order.customer_name || "ไม่ระบุชื่อ"}</div>
        <small>${item.detail}</small>
      </div>
      <strong>${numberBaht(item.order.final_total)}</strong>
    `;
    anomalyList.appendChild(row);
  });
}

function openClosingDetail(item) {
  closingDetailTitle.textContent = "รายละเอียดปิดยอด";
  closingDetailDate.textContent = thaiDate(item.business_date);

  detailOpening.textContent = numberBaht(item.opening_float);
  detailCashSystem.textContent = numberBaht(item.cash_sales_system);
  detailPromptSystem.textContent = numberBaht(item.promptpay_system);
  detailActualCash.textContent = numberBaht(item.actual_cash);
  detailActualPrompt.textContent = numberBaht(item.actual_promptpay);
  detailNetDifference.textContent = numberBaht(item.net_difference);
  detailNetDifference.className = diffClass(item.net_difference);

  detailNote.textContent = item.note
    ? `หมายเหตุ: ${item.note}`
    : "ไม่มีหมายเหตุการปิดยอด";

  closingDetailPanel.classList.remove("hidden");
  closingDetailPanel.scrollIntoView({ behavior: "smooth", block: "start" });

  loadAnomalies(item.business_date);
}

closeDetailButton.addEventListener("click", () => {
  closingDetailPanel.classList.add("hidden");
});

closingMonthFilter.value = currentMonthKey();
closingMonthFilter.addEventListener("change", renderClosings);

showAllClosingsButton.addEventListener("click", () => {
  closingMonthFilter.value = "";
  renderClosings();
});

loadClosings();
