const sb = supabase.createClient(
  APP_CONFIG.SUPABASE_URL,
  APP_CONFIG.SUPABASE_ANON_KEY
);

const ordersEl = document.getElementById("orders");
const soundToggle = document.getElementById("soundToggle");
const soundHint = document.getElementById("soundHint");
const dingAudio = document.getElementById("dingAudio");
const refreshButton = document.getElementById("refreshButton");
const orderSearch = document.getElementById("orderSearch");
const searchResultCount = document.getElementById("searchResultCount");
const todayOrderCount = document.getElementById("todayOrderCount");
const todaySales = document.getElementById("todaySales");
const todayCash = document.getElementById("todayCash");
const todayPromptPay = document.getElementById("todayPromptPay");
const newCount = document.getElementById("newCount");
const makingCount = document.getElementById("makingCount");
const readyCount = document.getElementById("readyCount");
const activeTabCount = document.getElementById("activeTabCount");
const readyTabCount = document.getElementById("readyTabCount");
const historyTabCount = document.getElementById("historyTabCount");
const tabButtons = [...document.querySelectorAll(".order-tab")];
const checkoutModal = document.getElementById("checkoutModal");
const closeCheckoutButton = document.getElementById("closeCheckoutButton");
const checkoutDoneButton = document.getElementById("checkoutDoneButton");
const checkoutOrderInfo = document.getElementById("checkoutOrderInfo");
const checkoutTotal = document.getElementById("checkoutTotal");
const discountAmount = document.getElementById("discountAmount");
const checkoutNetTotal = document.getElementById("checkoutNetTotal");
const discountError = document.getElementById("discountError");

let firstLoadFinished = false;
let knownOrderIds = new Set();
let remindedOrderIds = new Set();
let soundEnabled = false;
let allOrders = [];
let searchText = "";
let currentTab = "active";
let checkoutOrder = null;

injectKitchenStyles();
updateSoundButton();

function injectKitchenStyles() {
  const style = document.createElement("style");
  style.textContent = `
    .sound-hint{background:#fff8d8;border:1px solid #ead98b;border-radius:12px;padding:10px 12px;margin-bottom:12px;font-size:14px}
    .sound-hint.hidden{display:none}
    .new-order-flash{animation:newOrderFlash 2s ease-in-out}
    @keyframes newOrderFlash{0%,100%{box-shadow:none}20%,60%{box-shadow:0 0 0 5px rgba(217,45,32,.35);background:#fff1f0}}
    #soundToggle.sound-on{background:#171513;color:#fff}
  `;
  document.head.appendChild(style);
}

function updateSoundButton() {
  soundToggle.textContent = soundEnabled ? "🔊 เปิดเสียงอยู่" : "🔇 เปิดเสียง";
  soundToggle.classList.toggle("sound-on", soundEnabled);
  soundHint.classList.toggle("hidden", soundEnabled);
}

function playDing() {
  if (!soundEnabled) return;
  try {
    dingAudio.pause();
    dingAudio.currentTime = 0;
    const promise = dingAudio.play();
    if (promise) {
      promise.catch(error => {
        console.error("Safari ไม่อนุญาตให้เล่นเสียง", error);
        soundEnabled = false;
        updateSoundButton();
        alert("Safari ยังไม่อนุญาตเสียง กรุณากดปุ่ม “เปิดเสียง” อีกครั้ง");
      });
    }
  } catch (error) {
    console.error("เล่นเสียงไม่ได้", error);
  }
}

function playDoubleDing() {
  playDing();
  window.setTimeout(playDing, 600);
}

soundToggle.addEventListener("click", () => {
  if (soundEnabled) {
    soundEnabled = false;
    dingAudio.pause();
    updateSoundButton();
    return;
  }

  soundEnabled = true;
  dingAudio.currentTime = 0;
  const promise = dingAudio.play();
  if (promise) {
    promise.then(updateSoundButton).catch(error => {
      soundEnabled = false;
      updateSoundButton();
      console.error(error);
      alert("เปิดเสียงไม่สำเร็จ กรุณาเพิ่มระดับเสียงของ iPad และลองกดอีกครั้ง");
    });
  } else {
    updateSoundButton();
  }
});

refreshButton.addEventListener("click", loadOrders);
orderSearch.addEventListener("input", event => {
  searchText = event.target.value.trim().toLowerCase();
  renderOrders();
});

tabButtons.forEach(button => {
  button.addEventListener("click", () => {
    currentTab = button.dataset.tab;
    tabButtons.forEach(item => item.classList.toggle("active", item === button));
    renderOrders();
  });
});

function statusText(status) {
  return { new: "NEW", making: "กำลังทำ", ready: "พร้อมเสิร์ฟ" }[status] || status;
}

function paymentText(method) {
  return method === "promptpay" ? "พร้อมเพย์" : "จ่ายที่เคาน์เตอร์";
}

function orderTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
}

function bangkokDateKey(value = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(value));
}

function numberBaht(value) {
  return `฿${Number(value || 0).toLocaleString("th-TH", { maximumFractionDigits: 2 })}`;
}

function updateDashboard() {
  const todayKey = bangkokDateKey();
  const todayOrders = allOrders.filter(order => bangkokDateKey(order.created_at) === todayKey);
  const total = todayOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const cash = todayOrders.filter(order => order.payment_method !== "promptpay").reduce((sum, order) => sum + Number(order.total || 0), 0);
  const promptPay = todayOrders.filter(order => order.payment_method === "promptpay").reduce((sum, order) => sum + Number(order.total || 0), 0);

  const countNew = allOrders.filter(order => order.status === "new").length;
  const countMaking = allOrders.filter(order => order.status === "making").length;
  const countReady = allOrders.filter(order => order.status === "ready").length;

  todayOrderCount.textContent = todayOrders.length.toLocaleString("th-TH");
  todaySales.textContent = numberBaht(total);
  todayCash.textContent = numberBaht(cash);
  todayPromptPay.textContent = numberBaht(promptPay);
  newCount.textContent = countNew;
  makingCount.textContent = countMaking;
  readyCount.textContent = countReady;
  activeTabCount.textContent = countNew + countMaking;
  readyTabCount.textContent = allOrders.filter(order => order.status === "ready" && bangkokDateKey(order.created_at) === todayKey).length;
  historyTabCount.textContent = countReady;
}

function orderMatchesSearch(order) {
  if (!searchText) return true;
  const productText = (order.order_items || []).map(item => `${item.product_name} ${(item.options || []).join(" ")}`).join(" ");
  const searchableText = [
    order.order_no,
    order.customer_name,
    order.table_no,
    order.table_no === "counter" ? "เคาน์เตอร์ counter" : "",
    paymentText(order.payment_method),
    statusText(order.status),
    productText
  ].filter(Boolean).join(" ").toLowerCase();
  return searchableText.includes(searchText);
}

function orderMatchesTab(order) {
  if (currentTab === "active") {
    return order.status === "new" || order.status === "making";
  }

  if (currentTab === "ready") {
    return order.status === "ready" && bangkokDateKey(order.created_at) === bangkokDateKey();
  }

  if (currentTab === "history") {
    return order.status === "ready";
  }

  return false;
}

function calculateDiscount() {
  if (!checkoutOrder) return;
  const total = Number(checkoutOrder.total || 0);
  const discount = Math.max(0, Number(discountAmount.value || 0));
  const net = Math.max(0, total - discount);

  checkoutNetTotal.textContent = numberBaht(net);
  discountError.textContent = discount > total
    ? "ส่วนลดต้องไม่มากกว่ายอดสินค้า"
    : "";
}

function openCheckout(order) {
  checkoutOrder = order;
  checkoutOrderInfo.innerHTML = `
    <b>${order.order_no}</b><br>
    ลูกค้า: ${order.customer_name || "ไม่ระบุชื่อ"}<br>
    โต๊ะ: ${order.table_no === "counter" ? "เคาน์เตอร์" : order.table_no}
  `;
  checkoutTotal.textContent = numberBaht(order.total);
  discountAmount.value = "0";
  checkoutModal.classList.add("show");
  checkoutModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  calculateDiscount();
}

function closeCheckout() {
  checkoutOrder = null;
  checkoutModal.classList.remove("show");
  checkoutModal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

closeCheckoutButton.addEventListener("click", closeCheckout);
checkoutDoneButton.addEventListener("click", closeCheckout);
discountAmount.addEventListener("input", calculateDiscount);
checkoutModal.querySelector("[data-close-checkout]").addEventListener("click", closeCheckout);

function renderOrders(newOrderIds = []) {
  const filteredOrders = allOrders.filter(orderMatchesTab).filter(orderMatchesSearch);
  ordersEl.innerHTML = "";
  searchResultCount.textContent = searchText ? `พบ ${filteredOrders.length} ออเดอร์` : "";

  if (filteredOrders.length === 0) {
    ordersEl.innerHTML = `<div class="empty-state">ไม่พบออเดอร์</div>`;
    return;
  }

  filteredOrders.forEach(order => {
    const card = document.createElement("section");
    card.className = "order";
    if (newOrderIds.includes(order.id)) card.classList.add("new-order-flash");

    const tableText = order.table_no === "counter" ? "เคาน์เตอร์" : order.table_no;
    card.innerHTML = `
      <div class="order-top">
        <div><span class="status status-${order.status}">${statusText(order.status)}</span><h3>${order.order_no}</h3></div>
        <div class="price">${numberBaht(order.total)}</div>
      </div>
      <div class="order-meta">
        👤 ลูกค้า: ${order.customer_name || "ไม่ระบุชื่อ"}<br>
        🪑 โต๊ะ: ${tableText}<br>
        💳 ชำระเงิน: ${paymentText(order.payment_method)}<br>
        🕒 เวลา: ${orderTime(order.created_at)} น.
      </div>
      ${(order.order_items || []).map(item => `
        <div class="row"><b>${item.product_name} × ${item.quantity}</b><div class="muted">${(item.options || []).join(" • ") || "ไม่มีตัวเลือกเพิ่มเติม"}</div></div>
      `).join("")}
      ${currentTab === "active" ? `
        <div class="actions">
          <button class="making-btn">กำลังทำ</button>
          <button class="ready-btn">พร้อมเสิร์ฟ</button>
        </div>
      ` : currentTab === "ready" ? `
        <div class="actions">
          <button class="checkout-btn">💰 คิดเงิน</button>
        </div>
      ` : ""}`;

    const makingButton = card.querySelector(".making-btn");
    const readyButton = card.querySelector(".ready-btn");

    if (makingButton) {
      makingButton.addEventListener("click", () => setStatus(order.id, "making"));
    }

    if (readyButton) {
      readyButton.addEventListener("click", () => setStatus(order.id, "ready"));
    }

    const checkoutButton = card.querySelector(".checkout-btn");
    if (checkoutButton) {
      checkoutButton.addEventListener("click", () => openCheckout(order));
    }

    ordersEl.appendChild(card);
  });
}

function checkSecondReminders() {
  if (!firstLoadFinished || !soundEnabled) return;
  const now = Date.now();
  allOrders.forEach(order => {
    const ageMs = now - new Date(order.created_at).getTime();
    if (order.status === "new" && ageMs >= 60_000 && !remindedOrderIds.has(order.id)) {
      remindedOrderIds.add(order.id);
      playDoubleDing();
    }
  });
}

async function loadOrders() {
  const { data, error } = await sb
    .from("orders")
    .select(`id,order_no,table_no,customer_name,payment_method,total,status,created_at,order_items(product_name,quantity,options,line_total)`)
    .order("created_at", { ascending: false });

  if (error) {
    ordersEl.innerHTML = `<p>โหลดออเดอร์ไม่สำเร็จ: ${error.message}</p>`;
    return;
  }

  const currentIds = new Set(data.map(order => order.id));
  const newOrderIds = firstLoadFinished ? data.filter(order => !knownOrderIds.has(order.id)).map(order => order.id) : [];

  if (newOrderIds.length > 0 && soundEnabled) {
    newOrderIds.forEach((_, index) => window.setTimeout(playDing, index * 650));
  }

  allOrders = data;
  updateDashboard();
  renderOrders(newOrderIds);

  if (newOrderIds.length > 0) {
    currentTab = "active";
    tabButtons.forEach(button => button.classList.toggle("active", button.dataset.tab === "active"));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  knownOrderIds = currentIds;
  firstLoadFinished = true;
  checkSecondReminders();
}

async function setStatus(id, status) {
  const { error } = await sb.from("orders").update({ status }).eq("id", id);
  if (error) {
    alert("เปลี่ยนสถานะไม่สำเร็จ: " + error.message);
    return;
  }
  if (status !== "new") remindedOrderIds.add(id);
  loadOrders();
}

loadOrders();
setInterval(loadOrders, 3000);
