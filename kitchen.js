const sb = supabase.createClient(
  APP_CONFIG.SUPABASE_URL,
  APP_CONFIG.SUPABASE_ANON_KEY
);

const ordersEl = document.getElementById("orders");
const soundToggle = document.getElementById("soundToggle");
const soundHint = document.getElementById("soundHint");
const dingAudio = document.getElementById("dingAudio");

let firstLoadFinished = false;
let knownOrderIds = new Set();
let soundEnabled = false;

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

/*
  สำคัญสำหรับ iPhone/iPad:
  ต้องเรียก audio.play() โดยตรงภายในเหตุการณ์แตะ
*/
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
    promise.then(() => {
      updateSoundButton();
    }).catch(error => {
      soundEnabled = false;
      updateSoundButton();
      console.error(error);
      alert("เปิดเสียงไม่สำเร็จ กรุณาเพิ่มระดับเสียงของ iPad และลองกดอีกครั้ง");
    });
  } else {
    updateSoundButton();
  }
});

function statusText(status) {
  return {
    new: "NEW",
    making: "กำลังทำ",
    ready: "พร้อมเสิร์ฟ"
  }[status] || status;
}

function paymentText(method) {
  return method === "promptpay"
    ? "พร้อมเพย์"
    : "จ่ายที่เคาน์เตอร์";
}

function orderTime(value) {
  if (!value) return "-";

  return new Date(value).toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

async function loadOrders() {
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
    .order("created_at", { ascending: false });

  if (error) {
    ordersEl.innerHTML =
      `<p>โหลดออร์เดอร์ไม่สำเร็จ: ${error.message}</p>`;
    return;
  }

  const currentIds = new Set(data.map(order => order.id));

  const newOrderIds = firstLoadFinished
    ? data
        .filter(order => !knownOrderIds.has(order.id))
        .map(order => order.id)
    : [];

  if (newOrderIds.length > 0 && soundEnabled) {
    newOrderIds.forEach((_, index) => {
      setTimeout(playDing, index * 650);
    });
  }

  ordersEl.innerHTML = "";

  data.forEach(order => {
    const card = document.createElement("section");
    card.className = "order";

    if (newOrderIds.includes(order.id)) {
      card.classList.add("new-order-flash");
    }

    const tableText =
      order.table_no === "counter"
        ? "เคาน์เตอร์"
        : order.table_no;

    card.innerHTML = `
      <div class="order-top">
        <div>
          <span class="status status-${order.status}">
            ${statusText(order.status)}
          </span>
          <h3>${order.order_no}</h3>
        </div>
        <div class="price">฿${Number(order.total).toFixed(0)}</div>
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
            ${(item.options || []).join(" • ")
              || "ไม่มีตัวเลือกเพิ่มเติม"}
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

  knownOrderIds = currentIds;
  firstLoadFinished = true;
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

  loadOrders();
}

loadOrders();
setInterval(loadOrders, 3000);
