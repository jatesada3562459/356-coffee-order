const sb = supabase.createClient(
  APP_CONFIG.SUPABASE_URL,
  APP_CONFIG.SUPABASE_ANON_KEY
);

const ordersEl = document.getElementById("orders");
const soundToggle = document.getElementById("soundToggle");
const soundHint = document.getElementById("soundHint");
const dingAudio = document.getElementById("dingAudio");
const searchInput = document.getElementById("orderSearch");
const searchResultNote = document.getElementById("searchResultNote");
const todayOrderCount = document.getElementById("todayOrderCount");
const todaySales = document.getElementById("todaySales");
const todayCounter = document.getElementById("todayCounter");
const todayPromptPay = document.getElementById("todayPromptPay");

let allOrders = [];
let firstLoadFinished = false;
let knownOrderIds = new Set();
let soundEnabled = false;
let loadingOrders = false;

const REMINDER_AFTER_MS = 60 * 1000;
const reminderStorageKey = "356_reminded_order_ids";
const remindedOrderIds = new Set(
  JSON.parse(sessionStorage.getItem(reminderStorageKey) || "[]")
);

injectKitchenStyles();
updateSoundButton();

function injectKitchenStyles() {
  const style = document.createElement("style");
  style.textContent = `
    .sound-hint{
      background:#fff8d8;
      border:1px solid #ead98b;
      border-radius:12px;
      padding:10px 12px;
      margin-bottom:12px;
      font-size:14px;
    }
    .sound-hint.hidden{display:none}
    .new-order-flash{animation:newOrderFlash 2s ease-in-out}
    @keyframes newOrderFlash{
      0%,100%{box-shadow:none}
      20%,60%{
        box-shadow:0 0 0 5px rgba(217,45,32,.35);
        background:#fff1f0;
      }
    }
    #soundToggle.sound-on{background:#171513;color:#fff}
  `;
  document.head.appendChild(style);
}

function updateSoundButton() {
  soundToggle.textContent = soundEnabled
    ? "🔊 เปิดเสียงอยู่"
    : "🔇 เปิดเสียง";

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

function playReminderTwice() {
  if (!soundEnabled) return;
  playDing();
  setTimeout(playDing, 650);
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

searchInput.addEventListener("input", renderOrders);

function statusText(status) {
  return {
    new: "NEW",
    making: "กำลังทำ",
    ready: "พร้อมเสิร์ฟ"
  }[status] || status;
}

function paymentText(method) {
  return method === "promptpay" ? "พร้อมเพย์" : "จ่ายที่เคาน์เตอร์";
}

function orderTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function currency(value) {
  return `฿${Number(value || 0).toLocaleString("th-TH", {
    maximumFractionDigits: 0
  })}`;
}

function isToday(value) {
  const date = new Date(value);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function updateDashboard() {
  const todayOrders = allOrders.filter(order => isToday(order.created_at));
  const sales = todayOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const counter = todayOrders
    .filter(order => order.payment_method !== "promptpay")
    .reduce((sum, order) => sum + Number(order.total || 0), 0);
  const promptPay = todayOrders
    .filter(order => order.payment_method === "promptpay")
    .reduce((sum, order) => sum + Number(order.total || 0), 0);

  todayOrderCount.textContent = todayOrders.length.toLocaleString("th-TH");
  todaySales.textContent = currency(sales);
  todayCounter.textContent = currency(counter);
  todayPromptPay.textContent = currency(promptPay);
}

function searchableText(order) {
  const tableText = order.table_no === "counter" ? "เคาน์เตอร์" : `โต๊ะ ${order.table_no}`;
  const itemText = (order.order_items || [])
    .map(item => `${item.product_name} ${(item.options || []).join(" ")}`)
    .join(" ");

  return [
    order.order_no,
    order.customer_name || "",
    tableText,
    paymentText(order.payment_method),
    statusText(order.status),
    itemText
  ].join(" ").toLocaleLowerCase("th-TH");
}

function getFilteredOrders() {
  const query = searchInput.value.trim().toLocaleLowerCase("th-TH");
  if (!query) return allOrders;
  return allOrders.filter(order => searchableText(order).includes(query));
}

function renderOrders(newOrderIds = []) {
  const orders = getFilteredOrders();
  const query = searchInput.value.trim();

  searchResultNote.textContent = query
    ? `พบ ${orders.length} ออเดอร์จากทั้งหมด ${allOrders.length} ออเดอร์`
    : `เรียงตามเวลาสั่ง: สั่งก่อนอยู่บนสุด`;

  ordersEl.innerHTML = "";

  if (!orders.length) {
    ordersEl.innerHTML = `<div class="empty-orders">ไม่พบออเดอร์ที่ค้นหา</div>`;
    return;
  }

  orders.forEach(order => {
    const card = document.createElement("section");
    card.className = "order";

    if (newOrderIds.includes(order.id)) {
      card.classList.add("new-order-flash");
    }

    const tableText = order.table_no === "counter" ? "เคาน์เตอร์" : order.table_no;
    const waitingReminder =
      order.status === "new" &&
      Date.now() - new Date(order.created_at).getTime() >= REMINDER_AFTER_MS;

    card.innerHTML = `
      <div class="order-top">
        <div>
          <span class="status status-${order.status}">${statusText(order.status)}</span>
          ${waitingReminder ? '<span class="reminder-badge">รอรับออเดอร์</span>' : ""}
          <h3>${order.order_no}</h3>
        </div>
        <div class="price">${currency(order.total)}</div>
      </div>

      <div class="order-meta">
        👤 ลูกค้า: ${order.customer_name || "ไม่ระบุชื่อ"}<br>
        🪑 โต๊ะ: ${tableText}<br>
        💳 ชำระเงิน: ${paymentText(order.payment_method)}<br>
        🕒 เวลา: ${orderTime(order.created_at)} น.
      </div>

      ${(order.order_items || []).map(item => `
        <div class="row">
          <b>${item.product_name} × ${item.quantity}</b>
          <div class="muted">
            ${(item.options || []).join(" • ") || "ไม่มีตัวเลือกเพิ่มเติม"}
          </div>
        </div>
      `).join("")}

      <div class="actions">
        <button class="making-btn">กำลังทำ</button>
        <button class="ready-btn">พร้อมเสิร์ฟ</button>
      </div>
    `;

    card.querySelector(".making-btn").addEventListener("click", () => {
      setStatus(order.id, "making");
    });

    card.querySelector(".ready-btn").addEventListener("click", () => {
      setStatus(order.id, "ready");
    });

    ordersEl.appendChild(card);
  });
}

function saveRemindedIds() {
  sessionStorage.setItem(reminderStorageKey, JSON.stringify([...remindedOrderIds]));
}

function checkSecondReminders() {
  allOrders.forEach(order => {
    const age = Date.now() - new Date(order.created_at).getTime();
    const shouldRemind =
      order.status === "new" &&
      age >= REMINDER_AFTER_MS &&
      !remindedOrderIds.has(order.id);

    if (shouldRemind) {
      remindedOrderIds.add(order.id);
      saveRemindedIds();
      playReminderTwice();
    }
  });
}

async function loadOrders() {
  if (loadingOrders) return;
  loadingOrders = true;

  const { data, error } = await sb
    .from("orders")
    .select(`
      id,
      order_no,
      table_no,
      customer_name,
      payment_method,
      total,
      status,
      created_at,
      order_items (
        product_name,
        quantity,
        options,
        line_total
      )
    `)
    .order("created_at", { ascending: true });

  loadingOrders = false;

  if (error) {
    ordersEl.innerHTML = `<p>โหลดออร์เดอร์ไม่สำเร็จ: ${error.message}</p>`;
    return;
  }

  const currentIds = new Set(data.map(order => order.id));
  const newOrderIds = firstLoadFinished
    ? data.filter(order => !knownOrderIds.has(order.id)).map(order => order.id)
    : [];

  if (newOrderIds.length > 0 && soundEnabled) {
    newOrderIds.forEach((_, index) => setTimeout(playDing, index * 650));
  }

  allOrders = data;
  knownOrderIds = currentIds;
  firstLoadFinished = true;

  updateDashboard();
  renderOrders(newOrderIds);
  checkSecondReminders();
}

async function setStatus(id, status) {
  const { error } = await sb
    .from("orders")
    .update({ status })
    .eq("id", id);

  if (error) {
    alert("เปลี่ยนสถานะไม่สำเร็จ: " + error.message);
    return;
  }

  if (status !== "new") {
    remindedOrderIds.add(id);
    saveRemindedIds();
  }

  loadOrders();
}

loadOrders();
setInterval(loadOrders, 3000);
