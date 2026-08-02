const sb = supabase.createClient(
  APP_CONFIG.SUPABASE_URL,
  APP_CONFIG.SUPABASE_ANON_KEY
);

let products = [];
let selectedCategory = "ทั้งหมด";
let currentProduct = null;
let cartItems = [];

const tableNo =
  new URLSearchParams(location.search).get("table") || "counter";

const tableEl = document.getElementById("table");
const qtyEl = document.getElementById("qty");
const tabsEl = document.getElementById("tabs");
const menuEl = document.getElementById("menu");
const productPanel = document.getElementById("product");
const cartPanel = document.getElementById("cart");
const countEl = document.getElementById("count");
const itemsEl = document.getElementById("items");
const totalEl = document.getElementById("total");

tableEl.textContent =
  tableNo === "counter" ? "สั่งที่เคาน์เตอร์ / กลับบ้าน" : `โต๊ะ ${tableNo}`;

qtyEl.innerHTML = Array.from(
  { length: 10 },
  (_, i) => `<option value="${i + 1}">${i + 1}</option>`
).join("");

fetch("menu.json")
  .then((response) => {
    if (!response.ok) throw new Error("โหลดรายการเมนูไม่สำเร็จ");
    return response.json();
  })
  .then((data) => {
    products = data;
    renderTabs();
    renderMenu();
  })
  .catch((error) => {
    menuEl.innerHTML = `<p>เกิดข้อผิดพลาด: ${error.message}</p>`;
  });

function renderTabs() {
  const categories = ["ทั้งหมด", ...new Set(products.map((x) => x.category))];

  tabsEl.innerHTML = categories
    .map(
      (category) =>
        `<button onclick="selectCategory(${JSON.stringify(category)})">${category}</button>`
    )
    .join("");
}

function selectCategory(category) {
  selectedCategory = category;
  renderMenu();
}

function renderMenu() {
  const visible = products.filter(
    (x) => selectedCategory === "ทั้งหมด" || x.category === selectedCategory
  );

  menuEl.innerHTML = visible
    .map(
      (product) => `
        <div class="card">
          <div class="name">${product.name}</div>
          <div class="price">฿${product.price}</div>
          <button onclick='openProduct(${JSON.stringify(product)})'>เลือกเมนู</button>
        </div>`
    )
    .join("");
}

function openProduct(product) {
  currentProduct = product;
  document.getElementById("pname").textContent = product.name;
  document.querySelectorAll(".add").forEach((x) => {
    x.checked = false;
  });
  productPanel.classList.add("show");
}

function closeProduct() {
  productPanel.classList.remove("show");
}

function addCart() {
  const sweet = document.querySelector(
    'input[name="sweet"]:checked'
  )?.value;
  const milk = document.querySelector('input[name="milk"]:checked')?.value;

  const options = [sweet, milk].filter(Boolean);
  let extraPrice = 0;

  document.querySelectorAll(".add:checked").forEach((x) => {
    options.push(x.value);
    extraPrice += Number(x.dataset.price || 0);
  });

  const quantity = Number(qtyEl.value);

  cartItems.push({
    name: currentProduct.name,
    qty: quantity,
    unit: Number(currentProduct.price) + extraPrice,
    opts: options,
  });

  closeProduct();
  renderCart();
}

function renderCart() {
  countEl.textContent = cartItems.reduce((sum, x) => sum + x.qty, 0);

  itemsEl.innerHTML = cartItems
    .map(
      (x, i) => `
        <div class="row">
          <b>${x.name} × ${x.qty}</b>
          <div>${x.opts.join(" • ")}</div>
          <div>฿${x.unit * x.qty}</div>
          <button onclick="removeCartItem(${i})">ลบ</button>
        </div>`
    )
    .join("");

  totalEl.textContent =
    "รวม ฿" + cartItems.reduce((sum, x) => sum + x.unit * x.qty, 0);
}

function removeCartItem(index) {
  cartItems.splice(index, 1);
  renderCart();
}

function openCart() {
  renderCart();
  cartPanel.classList.add("show");
}

function closeCart() {
  cartPanel.classList.remove("show");
}

async function submitOrder() {
  if (!cartItems.length) {
    alert("กรุณาเลือกสินค้า");
    return;
  }

  const orderId = crypto.randomUUID();
  const orderNo = "356-" + Date.now().toString().slice(-8);
  const paymentMethod = document.querySelector(
    'input[name="pay"]:checked'
  ).value;
  const total = cartItems.reduce((sum, x) => sum + x.unit * x.qty, 0);
  const customerName =
    document.getElementById("customer").value.trim() || null;

  const { error: orderError } = await sb.from("orders").insert({
    id: orderId,
    order_no: orderNo,
    table_no: tableNo,
    customer_name: customerName,
    payment_method: paymentMethod,
    total,
  });

  if (orderError) {
    alert("ส่งออร์เดอร์ไม่สำเร็จ: " + orderError.message);
    return;
  }

  const rows = cartItems.map((x) => ({
    order_id: orderId,
    product_name: x.name,
    quantity: x.qty,
    unit_price: x.unit,
    options: x.opts,
    line_total: x.unit * x.qty,
  }));

  const { error: itemError } = await sb.from("order_items").insert(rows);

  if (itemError) {
    alert("บันทึกรายการสินค้าไม่สำเร็จ: " + itemError.message);
    return;
  }

  alert(`ส่งออร์เดอร์สำเร็จ\nเลขที่ ${orderNo}\nยอดรวม ฿${total}`);
  cartItems = [];
  renderCart();
  closeCart();
}
