const sb = supabase.createClient(
  APP_CONFIG.SUPABASE_URL,
  APP_CONFIG.SUPABASE_ANON_KEY
);

const ordersEl = document.getElementById("orders");
const soundToggle = document.getElementById("soundToggle");
const soundHint = document.getElementById("soundHint");

let firstLoadFinished = false;
let knownOrderIds = new Set();
let soundEnabled = localStorage.getItem("356_sound_enabled") === "true";
let audioContext = null;

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
    .new-order-flash{
      animation:newOrderFlash 2s ease-in-out;
    }
    @keyframes newOrderFlash{
      0%,100%{box-shadow:none}
      20%,60%{
        box-shadow:0 0 0 5px rgba(217,45,32,.35);
        background:#fff1f0;
      }
    }
    #soundToggle.sound-on{
      background:#171513;
      color:white;
    }
  `;
  document.head.appendChild(style);
}

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

function updateSoundButton() {
  soundToggle.textContent = soundEnabled ? "🔊 เปิดเสียงอยู่" : "🔇 เปิดเสียง";
  soundToggle.classList.toggle("sound-on", soundEnabled);
  soundHint.classList.toggle("hidden", soundEnabled);
}

soundToggle.addEventListener("click", async () => {
  soundEnabled = !soundEnabled;
  localStorage.setItem("356_sound_enabled", String(soundEnabled));

  if (soundEnabled) {
    await ensureAudioContext();
    playDing(); // เสียงทดสอบ 1 ครั้งเมื่อเปิด
  }

  updateSoundButton();
});

async function ensureAudioContext() {
  if (!audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    audioContext = new AudioContextClass();
  }

  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }
}

function playDing() {
  if (!soundEnabled) return;

  try {
    ensureAudioContext().then(() => {
      const now = audioContext.currentTime;
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(880, now);
      oscillator.frequency.exponentialRampToValueAtTime(660, now + 0.18);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.28, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);

      oscillator.connect(gain);
      gain.connect(audioContext.destination);

      oscillator.start(now);
      oscillator.stop(now + 0.34);
    });
  } catch (error) {
    console.error("เล่นเสียงไม่ได้", error);
  }
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
    ordersEl.innerHTML = `<p>โหลดออร์เดอร์ไม่สำเร็จ: ${error.message}</p>`;
    return;
  }

  const currentIds = new Set(data.map(order => order.id));
  const newOrderIds = firstLoadFinished
    ? data
        .filter(order => !knownOrderIds.has(order.id))
        .map(order => order.id)
    : [];

  if (newOrderIds.length > 0) {
    // ดัง 1 ครั้งต่อออร์เดอร์ใหม่
    newOrderIds.forEach((_, index) => {
      setTimeout(playDing, index * 450);
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
      order.table_no === "counter" ? "เคาน์เตอร์" : order.table_no;

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

// โหลดทันที และตรวจออร์เดอร์ใหม่ทุก 3 วินาที
loadOrders();
setInterval(loadOrders, 3000);
