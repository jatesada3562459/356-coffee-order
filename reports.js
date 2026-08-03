const sb = supabase.createClient(
  APP_CONFIG.SUPABASE_URL,
  APP_CONFIG.SUPABASE_ANON_KEY
);

const startDateInput = document.getElementById("reportStartDate");
const endDateInput = document.getElementById("reportEndDate");
const todayReportButton = document.getElementById("todayReportButton");
const thisMonthReportButton = document.getElementById("thisMonthReportButton");
const loadReportButton = document.getElementById("loadReportButton");

const reportNetSales = document.getElementById("reportNetSales");
const reportOrderCount = document.getElementById("reportOrderCount");
const reportCashSales = document.getElementById("reportCashSales");
const reportPromptPaySales = document.getElementById("reportPromptPaySales");
const reportDiscountTotal = document.getElementById("reportDiscountTotal");
const reportRefundTotal = document.getElementById("reportRefundTotal");
const reportDrinkCount = document.getElementById("reportDrinkCount");
const reportBreadCount = document.getElementById("reportBreadCount");
const reportMemberOrders = document.getElementById("reportMemberOrders");
const reportNewMembers = document.getElementById("reportNewMembers");
const reportAverageOrder = document.getElementById("reportAverageOrder");
const topSellingList = document.getElementById("topSellingList");
const dailySalesList = document.getElementById("dailySalesList");
const reportError = document.getElementById("reportError");
const reportLoadStatus = document.getElementById("reportLoadStatus");
const reportSummarySection = document.getElementById("reportSummarySection");
const topSellingSort = document.getElementById("topSellingSort");
const categorySalesGrid = document.getElementById("categorySalesGrid");

const BREAD_PRODUCTS = new Set([
  "เนยนม",
  "เนยน้ำตาล",
  "เนยช็อกโกแลต",
  "เนยคาราเมล"
]);

const ADDON_PRODUCTS = new Set([
  "ปั่น",
  "ไข่มุกบุก",
  "ปีโป้",
  "ครีมชีส",
  "ช็อตกาแฟ",
  "โยเกิร์ต"
]);

let latestTopItems = [];
let menuCategoryMap = new Map();

function bangkokDateKey(value = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(value));
}

function numberBaht(value) {
  return `฿${Number(value || 0).toLocaleString("th-TH", {
    maximumFractionDigits: 2
  })}`;
}

function thaiDate(dateKey) {
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date(`${dateKey}T12:00:00+07:00`));
}

function dateRangeIso(startKey, endKey) {
  const start = new Date(`${startKey}T00:00:00+07:00`).toISOString();
  const endDate = new Date(`${endKey}T00:00:00+07:00`);
  endDate.setDate(endDate.getDate() + 1);
  return { start, end: endDate.toISOString() };
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

function setReportStatus(message, type = "info") {
  reportLoadStatus.textContent = message;
  reportLoadStatus.className = `report-load-status ${type}`;
}

async function loadMenuCategoryMap() {
  const map = new Map();

  try {
    const response = await fetch("menu.json", { cache: "no-store" });
    if (response.ok) {
      const menu = await response.json();
      (menu.products || []).forEach(product => {
        map.set(product.name, product.category || "อื่น ๆ");
      });
      (menu.addons || []).forEach(addon => {
        map.set(addon.name, "ADD-ON");
      });
    }
  } catch (error) {
    console.warn("โหลดหมวดหมู่จาก menu.json ไม่สำเร็จ", error);
  }

  const { data, error } = await sb
    .from("menu_settings")
    .select("item_name,category,item_type");

  if (!error) {
    (data || []).forEach(item => {
      map.set(
        item.item_name,
        item.item_type === "addon"
          ? "ADD-ON"
          : (item.category || "อื่น ๆ")
      );
    });
  }

  menuCategoryMap = map;
}

function productCategory(name) {
  if (BREAD_PRODUCTS.has(name)) return "ขนมปังปิ้ง";
  return menuCategoryMap.get(name) || "อื่น ๆ";
}

function renderTopSelling(items) {
  topSellingList.innerHTML = "";

  if (!items.length) {
    topSellingList.innerHTML =
      '<div class="empty-state">ยังไม่มีข้อมูลเมนูในช่วงที่เลือก</div>';
    return;
  }

  const sorted = [...items].sort((a, b) => {
    if (topSellingSort.value === "sales") {
      return b.sales - a.sales || b.quantity - a.quantity;
    }
    return b.quantity - a.quantity || b.sales - a.sales;
  });

  const maxValue = Math.max(
    1,
    ...sorted.map(item =>
      topSellingSort.value === "sales" ? item.sales : item.quantity
    )
  );

  sorted.slice(0, 10).forEach((item, index) => {
    const value =
      topSellingSort.value === "sales" ? item.sales : item.quantity;
    const percent = Math.max(5, Math.round((value / maxValue) * 100));

    const row = document.createElement("div");
    row.className = "report-row top-menu-row";
    row.innerHTML = `
      <span class="report-rank">${index + 1}</span>
      <div class="report-row-main">
        <div class="top-menu-title-line">
          <strong>${item.name}</strong>
          <span class="category-badge">${item.category}</span>
        </div>
        <small>
          ${item.quantity.toLocaleString("th-TH")} ${item.unit}
          • ${numberBaht(item.sales)}
        </small>
        <div class="report-progress">
          <span style="width:${percent}%"></span>
        </div>
      </div>
    `;
    topSellingList.appendChild(row);
  });
}

function renderCategorySales(items) {
  categorySalesGrid.innerHTML = "";

  if (!items.length) {
    categorySalesGrid.innerHTML =
      '<div class="empty-state">ยังไม่มีข้อมูลหมวดหมู่ในช่วงที่เลือก</div>';
    return;
  }

  const totalSales = items.reduce((sum, item) => sum + item.sales, 0);

  items.forEach(item => {
    const percent = totalSales
      ? Math.round((item.sales / totalSales) * 100)
      : 0;

    const card = document.createElement("article");
    card.className = "category-sales-card";
    card.innerHTML = `
      <div class="category-sales-head">
        <strong>${item.category}</strong>
        <span>${percent}%</span>
      </div>
      <div class="category-sales-value">${numberBaht(item.sales)}</div>
      <small>
        ${item.quantity.toLocaleString("th-TH")} รายการ
        • ${item.orders.toLocaleString("th-TH")} ออเดอร์
      </small>
      <div class="category-progress">
        <span style="width:${Math.max(3, percent)}%"></span>
      </div>
    `;
    categorySalesGrid.appendChild(card);
  });
}

function renderDailySales(items) {
  dailySalesList.innerHTML = "";

  if (!items.length) {
    dailySalesList.innerHTML =
      '<div class="empty-state">ยังไม่มีข้อมูลยอดขายในช่วงที่เลือก</div>';
    return;
  }

  items.forEach(item => {
    const row = document.createElement("div");
    row.className = "report-row";
    row.innerHTML = `
      <div class="report-row-main">
        <strong>${thaiDate(item.date)}</strong>
        <small>${item.orders.toLocaleString("th-TH")} ออเดอร์</small>
      </div>
      <b>${numberBaht(item.sales)}</b>
    `;
    dailySalesList.appendChild(row);
  });
}

async function loadReport() {
  const startKey = startDateInput.value;
  const endKey = endDateInput.value;

  reportError.textContent = "";
  setReportStatus("กำลังโหลดรายงาน...", "loading");

  if (!startKey || !endKey) {
    reportError.textContent = "กรุณาเลือกวันที่เริ่มต้นและสิ้นสุด";
    setReportStatus("ยังไม่ได้เลือกรายงาน", "error");
    return;
  }

  if (startKey > endKey) {
    reportError.textContent = "วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด";
    setReportStatus("ช่วงวันที่ไม่ถูกต้อง", "error");
    return;
  }

  loadReportButton.disabled = true;
  loadReportButton.textContent = "กำลังโหลด...";

  const { start, end } = dateRangeIso(startKey, endKey);

  if (!menuCategoryMap.size) {
    await loadMenuCategoryMap();
  }

  const [ordersResult, membersResult] = await Promise.all([
    sb
      .from("orders")
      .select(`
        id,
        order_no,
        final_total,
        total,
        discount_amount,
        refund_amount,
        refund_status,
        actual_payment_method,
        payment_method,
        payment_status,
        paid_at,
        member_id,
        cancelled,
        order_items (
          product_name,
          quantity,
          unit_price
        )
      `)
      .eq("payment_status", "paid")
      .gte("paid_at", start)
      .lt("paid_at", end),
    sb
      .from("members")
      .select("id", { count: "exact", head: true })
      .gte("created_at", start)
      .lt("created_at", end)
  ]);

  loadReportButton.disabled = false;
  loadReportButton.textContent = "ดูรายงาน";

  if (ordersResult.error) {
    reportError.textContent = "โหลดรายงานไม่สำเร็จ: " + ordersResult.error.message;
    setReportStatus("โหลดรายงานไม่สำเร็จ", "error");
    return;
  }

  if (membersResult.error) {
    reportError.textContent = "โหลดสมาชิกใหม่ไม่สำเร็จ: " + membersResult.error.message;
    setReportStatus("โหลดข้อมูลสมาชิกไม่สำเร็จ", "error");
    return;
  }

  const orders = (ordersResult.data || []).filter(order => !order.cancelled);

  let netSales = 0;
  let cashSales = 0;
  let promptPaySales = 0;
  let discountTotal = 0;
  let refundTotal = 0;
  let drinkCount = 0;
  let breadCount = 0;
  let memberOrders = 0;

  const productMap = new Map();
  const categoryMap = new Map();
  const dailyMap = new Map();

  orders.forEach(order => {
    const gross = Number(order.final_total ?? order.total ?? 0);
    const refund = Number(order.refund_amount || 0);
    const net = Math.max(0, gross - refund);
    const method = order.actual_payment_method || order.payment_method;
    const dateKey = bangkokDateKey(order.paid_at);

    netSales += net;
    discountTotal += Number(order.discount_amount || 0);
    refundTotal += refund;

    if (method === "promptpay") promptPaySales += net;
    else cashSales += net;

    if (order.member_id) memberOrders += 1;

    const daily = dailyMap.get(dateKey) || {
      date: dateKey,
      orders: 0,
      sales: 0
    };
    daily.orders += 1;
    daily.sales += net;
    dailyMap.set(dateKey, daily);

    (order.order_items || []).forEach(item => {
      const name = item.product_name;
      const quantity = Number(item.quantity || 0);
      const unitPrice = Number(item.unit_price || 0);

      if (BREAD_PRODUCTS.has(name)) {
        breadCount += quantity;
      } else if (!ADDON_PRODUCTS.has(name)) {
        drinkCount += quantity;
      }

      if (ADDON_PRODUCTS.has(name)) return;

      const category = productCategory(name);

      const current = productMap.get(name) || {
        name,
        category,
        quantity: 0,
        sales: 0,
        unit: BREAD_PRODUCTS.has(name) ? "ชิ้น" : "แก้ว"
      };

      current.quantity += quantity;
      current.sales += unitPrice * quantity;
      productMap.set(name, current);

      const categoryCurrent = categoryMap.get(category) || {
        category,
        quantity: 0,
        sales: 0,
        orderIds: new Set()
      };

      categoryCurrent.quantity += quantity;
      categoryCurrent.sales += unitPrice * quantity;
      categoryCurrent.orderIds.add(order.id);
      categoryMap.set(category, categoryCurrent);
    });
  });

  const orderCount = orders.length;
  const averageOrder = orderCount ? netSales / orderCount : 0;

  reportNetSales.textContent = numberBaht(netSales);
  reportOrderCount.textContent = orderCount.toLocaleString("th-TH");
  reportCashSales.textContent = numberBaht(cashSales);
  reportPromptPaySales.textContent = numberBaht(promptPaySales);
  reportDiscountTotal.textContent = numberBaht(discountTotal);
  reportRefundTotal.textContent = numberBaht(refundTotal);
  reportDrinkCount.textContent = drinkCount.toLocaleString("th-TH");
  reportBreadCount.textContent = breadCount.toLocaleString("th-TH");
  reportMemberOrders.textContent = memberOrders.toLocaleString("th-TH");
  reportNewMembers.textContent = Number(membersResult.count || 0)
    .toLocaleString("th-TH");
  reportAverageOrder.textContent = numberBaht(averageOrder);

  const topItems = [...productMap.values()]
    .sort((a, b) => b.quantity - a.quantity || b.sales - a.sales);

  const categoryItems = [...categoryMap.values()]
    .map(item => ({
      category: item.category,
      quantity: item.quantity,
      sales: item.sales,
      orders: item.orderIds.size
    }))
    .sort((a, b) => b.sales - a.sales || b.quantity - a.quantity);

  const dailyItems = [...dailyMap.values()]
    .sort((a, b) => b.date.localeCompare(a.date));

  latestTopItems = topItems;
  renderTopSelling(latestTopItems);
  renderCategorySales(categoryItems);
  renderDailySales(dailyItems);

  const rangeText = startKey === endKey
    ? thaiDate(startKey)
    : `${thaiDate(startKey)} – ${thaiDate(endKey)}`;

  setReportStatus(
    `✅ อัปเดตรายงานแล้ว: ${rangeText} • ${orderCount.toLocaleString("th-TH")} ออเดอร์`,
    "success"
  );

  reportSummarySection.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

todayReportButton.addEventListener("click", () => {
  setToday();
  loadReport();
});

thisMonthReportButton.addEventListener("click", () => {
  setThisMonth();
  loadReport();
});

loadReportButton.addEventListener("click", loadReport);
topSellingSort.addEventListener("change", () => {
  renderTopSelling(latestTopItems);
});

window.addEventListener("manager-unlocked", () => {
  setToday();
  loadReport();
});
