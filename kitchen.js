const sb = supabase.createClient(
  APP_CONFIG.SUPABASE_URL,
  APP_CONFIG.SUPABASE_ANON_KEY
);

const ordersEl = document.getElementById("orders");

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
    ordersEl.innerHTML = `<p>โหลดออร์เดอร์ไม่สำเร็จ: ${error.message}</p>`;
    return;
  }

  ordersEl.innerHTML = "";

  data.forEach((order) => {
    const card = document.createElement("section");
    card.className = "order";

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

      ${(order.order_items || []).map((item) => `
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
