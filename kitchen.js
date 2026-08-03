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
const todayDrinkCount = document.getElementById("todayDrinkCount");
const todayBreadCount = document.getElementById("todayBreadCount");
const todayNewMemberCount = document.getElementById("todayNewMemberCount");
const todayDiscountTotal = document.getElementById("todayDiscountTotal");
const todayMemberOrderCount = document.getElementById("todayMemberOrderCount");
const averageOrderValue = document.getElementById("averageOrderValue");
const dashboardDate = document.getElementById("dashboardDate");
const topProductsList = document.getElementById("topProductsList");
const newCount = document.getElementById("newCount");
const makingCount = document.getElementById("makingCount");
const readyCount = document.getElementById("readyCount");
const activeTabCount = document.getElementById("activeTabCount");
const readyTabCount = document.getElementById("readyTabCount");
const historyTabCount = document.getElementById("historyTabCount");
const historyDateFilterWrap = document.getElementById("historyDateFilterWrap");
const historyDateFilter = document.getElementById("historyDateFilter");
const historyTodayButton = document.getElementById("historyTodayButton");
const historyAllButton = document.getElementById("historyAllButton");
const tabButtons = [...document.querySelectorAll(".order-tab")];

const checkoutModal = document.getElementById("checkoutModal");
const closeCheckoutButton = document.getElementById("closeCheckoutButton");
const checkoutDoneButton = document.getElementById("checkoutDoneButton");
const checkoutOrderInfo = document.getElementById("checkoutOrderInfo");
const checkoutTotal = document.getElementById("checkoutTotal");
const discountAmount = document.getElementById("discountAmount");
const discountReason = document.getElementById("discountReason");
const otherReasonWrap = document.getElementById("otherReasonWrap");
const otherDiscountReason = document.getElementById("otherDiscountReason");
const checkoutNetTotal = document.getElementById("checkoutNetTotal");
const cashFields = document.getElementById("cashFields");
const cashReceived = document.getElementById("cashReceived");
const changeAmount = document.getElementById("changeAmount");
const discountError = document.getElementById("discountError");
const checkoutMemberSearch = document.getElementById("checkoutMemberSearch");
const checkoutMemberResults = document.getElementById("checkoutMemberResults");
const selectedMemberBox = document.getElementById("selectedMemberBox");
const selectedMemberInfo = document.getElementById("selectedMemberInfo");
const clearSelectedMember = document.getElementById("clearSelectedMember");
const cupCountPreview = document.getElementById("cupCountPreview");
const rewardUseBox = document.getElementById("rewardUseBox");
const rewardUseMessage = document.getElementById("rewardUseMessage");
const useMemberReward = document.getElementById("useMemberReward");

let firstLoadFinished = false;
let knownOrderIds = new Set();
let remindedOrderIds = new Set();
let soundEnabled = false;
let allOrders = [];
let searchText = "";
let currentTab = "active";
let historyDate = bangkokDateKey();
let checkoutOrder = null;
let checkoutMembers = [];
let selectedMember = null;
let rewardDiscountApplied = false;
let todayNewMembers = 0;

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
        console.error(error);
        soundEnabled = false;
        updateSoundButton();
        alert("Safari ยังไม่อนุญาตเสียง กรุณากดปุ่มเปิดเสียงอีกครั้ง");
      });
    }
  } catch (error) {
    console.error(error);
  }
}

function playDoubleDing() {
  playDing();
  setTimeout(playDing, 600);
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
      console.error(error);
      soundEnabled = false;
      updateSoundButton();
      alert("เปิดเสียงไม่สำเร็จ กรุณาเพิ่มระดับเสียงแล้วลองอีกครั้ง");
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
    historyDateFilterWrap.classList.toggle("hidden", currentTab !== "history");
    renderOrders();
  });
});

historyDateFilter.value = historyDate;

historyDateFilter.addEventListener("change", () => {
  historyDate = historyDateFilter.value || "";
  renderOrders();
});

historyTodayButton.addEventListener("click", () => {
  historyDate = bangkokDateKey();
  historyDateFilter.value = historyDate;
  renderOrders();
});

historyAllButton.addEventListener("click", () => {
  historyDate = "";
  historyDateFilter.value = "";
  renderOrders();
});

function statusText(status) {
  return {
    new: "NEW",
    making: "กำลังทำ",
    ready: "พร้อมเสิร์ฟ",
    cancelled: "ยกเลิก"
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

async function askManagerApproval(title, detail) {
  return new Promise(resolve => {
    const overlay = document.createElement("div");
    overlay.className = "approval-overlay";
    overlay.innerHTML = `
      <div class="approval-card">
        <div class="approval-icon">🔐</div>
        <h2>${title}</h2>
        <p>${detail}</p>

        <label class="approval-field">
          <span>PIN ผู้จัดการ 4 หลัก</span>
          <input class="approval-pin" type="password" inputmode="numeric"
            maxlength="4" pattern="[0-9]*" placeholder="••••" autocomplete="off">
        </label>

        <div class="approval-error"></div>

        <div class="approval-actions">
          <button class="approval-cancel" type="button">ยกเลิก</button>
          <button class="approval-confirm primary" type="button">อนุมัติ</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const input = overlay.querySelector(".approval-pin");
    const errorEl = overlay.querySelector(".approval-error");
    const confirmButton = overlay.querySelector(".approval-confirm");
    const cancelButton = overlay.querySelector(".approval-cancel");

    function finish(value) {
      overlay.remove();
      resolve(value);
    }

    cancelButton.addEventListener("click", () => finish(null));
    overlay.addEventListener("click", event => {
      if (event.target === overlay) finish(null);
    });

    async function verify() {
      const pin = input.value.trim();
      errorEl.textContent = "";

      if (!/^\d{4}$/.test(pin)) {
        errorEl.textContent = "กรุณากรอก PIN 4 หลัก";
        return;
      }

      confirmButton.disabled = true;
      confirmButton.textContent = "กำลังตรวจสอบ...";

      const { data, error } = await sb.rpc("verify_manager_pin", {
        p_pin: pin
      });

      confirmButton.disabled = false;
      confirmButton.textContent = "อนุมัติ";

      if (error) {
        errorEl.textContent = "ตรวจสอบ PIN ไม่สำเร็จ: " + error.message;
        return;
      }

      if (!data) {
        errorEl.textContent = "PIN ไม่ถูกต้อง";
        input.value = "";
        input.focus();
        return;
      }

      finish(pin);
    }

    confirmButton.addEventListener("click", verify);
    input.addEventListener("keydown", event => {
      if (event.key === "Enter") verify();
    });

    setTimeout(() => input.focus(), 80);
  });
}

async function writeManagerAudit(action, details = {}) {
  const { error } = await sb.rpc("write_audit_log", {
    p_action: action,
    p_details: details,
    p_actor: "manager"
  });

  if (error) {
    console.error("บันทึก Audit Log ไม่สำเร็จ", error);
  }
}

function isPaid(order) {
  return order.payment_status === "paid";
}

function orderFinalTotal(order) {
  const paid = Number(order.final_total ?? order.total ?? 0);
  const refunded = Number(order.refund_amount || 0);
  return Math.max(0, paid - refunded);
}

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

function classifySoldItems(orders) {
  let drinks = 0;
  let breads = 0;

  orders.forEach(order => {
    (order.order_items || []).forEach(item => {
      const quantity = Number(item.quantity || 0);

      if (BREAD_PRODUCTS.has(item.product_name)) {
        breads += quantity;
      } else if (!ADDON_PRODUCTS.has(item.product_name)) {
        drinks += quantity;
      }
    });
  });

  return { drinks, breads };
}

function formatThaiDashboardDate() {
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(new Date());
}

function getTopProducts(orders, limit = 5) {
  const totals = new Map();

  orders.forEach(order => {
    (order.order_items || []).forEach(item => {
      if (ADDON_PRODUCTS.has(item.product_name)) return;

      const quantity = Number(item.quantity || 0);
      totals.set(
        item.product_name,
        (totals.get(item.product_name) || 0) + quantity
      );
    });
  });

  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "th"))
    .slice(0, limit);
}

function renderTopProducts(products) {
  if (!products.length) {
    topProductsList.innerHTML =
      '<div class="top-product-empty">ยังไม่มีข้อมูลการขายวันนี้</div>';
    return;
  }

  topProductsList.innerHTML = products.map(([name, quantity], index) => `
    <div class="top-product-row">
      <span class="top-product-rank">${index + 1}</span>
      <span class="top-product-name">${name}</span>
      <strong>${quantity.toLocaleString("th-TH")} ${BREAD_PRODUCTS.has(name) ? "ชิ้น" : "แก้ว"}</strong>
    </div>
  `).join("");
}

async function loadTodayNewMemberCount() {
  const todayKey = bangkokDateKey();
  const start = new Date(`${todayKey}T00:00:00+07:00`).toISOString();
  const endDate = new Date(`${todayKey}T00:00:00+07:00`);
  endDate.setDate(endDate.getDate() + 1);
  const end = endDate.toISOString();

  const { count, error } = await sb
    .from("members")
    .select("id", { count: "exact", head: true })
    .gte("created_at", start)
    .lt("created_at", end);

  if (error) {
    console.error("โหลดจำนวนสมาชิกใหม่ไม่สำเร็จ", error);
    todayNewMembers = 0;
    return;
  }

  todayNewMembers = Number(count || 0);
}

function updateDashboard() {
  const todayKey = bangkokDateKey();
  const todayPaidOrders = allOrders.filter(order =>
    isPaid(order) &&
    !order.cancelled &&
    bangkokDateKey(order.paid_at || order.created_at) === todayKey
  );

  const total = todayPaidOrders.reduce(
    (sum, order) => sum + orderFinalTotal(order),
    0
  );

  const cash = todayPaidOrders
    .filter(order =>
      (order.actual_payment_method || order.payment_method) !== "promptpay"
    )
    .reduce((sum, order) => sum + orderFinalTotal(order), 0);

  const promptPay = todayPaidOrders
    .filter(order =>
      (order.actual_payment_method || order.payment_method) === "promptpay"
    )
    .reduce((sum, order) => sum + orderFinalTotal(order), 0);

  const soldItems = classifySoldItems(todayPaidOrders);
  const discountTotal = todayPaidOrders.reduce(
    (sum, order) => sum + Number(order.discount_amount || 0),
    0
  );
  const memberOrderCount = todayPaidOrders.filter(order => order.member_id).length;
  const averageValue = todayPaidOrders.length > 0
    ? total / todayPaidOrders.length
    : 0;
  const topProducts = getTopProducts(todayPaidOrders);

  const countNew = allOrders.filter(
    order => !isPaid(order) && order.status === "new"
  ).length;
  const countMaking = allOrders.filter(
    order => !isPaid(order) && order.status === "making"
  ).length;
  const countReady = allOrders.filter(
    order => !isPaid(order) && order.status === "ready"
  ).length;

  todayOrderCount.textContent = todayPaidOrders.length.toLocaleString("th-TH");
  todaySales.textContent = numberBaht(total);
  todayCash.textContent = numberBaht(cash);
  todayPromptPay.textContent = numberBaht(promptPay);
  todayDrinkCount.textContent = soldItems.drinks.toLocaleString("th-TH");
  todayBreadCount.textContent = soldItems.breads.toLocaleString("th-TH");
  todayNewMemberCount.textContent = todayNewMembers.toLocaleString("th-TH");
  todayDiscountTotal.textContent = numberBaht(discountTotal);
  todayMemberOrderCount.textContent = memberOrderCount.toLocaleString("th-TH");
  averageOrderValue.textContent = numberBaht(averageValue);
  dashboardDate.textContent = formatThaiDashboardDate();
  renderTopProducts(topProducts);
  newCount.textContent = countNew;
  makingCount.textContent = countMaking;
  readyCount.textContent = countReady;
  activeTabCount.textContent = countNew + countMaking;
  readyTabCount.textContent = countReady;
  historyTabCount.textContent = allOrders.filter(isPaid).length;
}

function orderMatchesSearch(order) {
  if (!searchText) return true;

  const productText = (order.order_items || [])
    .map(item =>
      `${item.product_name} ${(item.options || []).join(" ")}`
    )
    .join(" ");

  const searchableText = [
    order.order_no,
    order.customer_name,
    order.table_no,
    order.table_no === "counter" ? "เคาน์เตอร์ counter" : "",
    paymentText(order.actual_payment_method || order.payment_method),
    statusText(order.status),
    order.discount_reason,
    productText
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return searchableText.includes(searchText);
}

function orderMatchesTab(order) {
  if (currentTab === "active") {
    return !order.cancelled && !isPaid(order) &&
      (order.status === "new" || order.status === "making");
  }

  if (currentTab === "ready") {
    return !order.cancelled && !isPaid(order) && order.status === "ready";
  }

  if (currentTab === "history") {
    if (!isPaid(order) && !order.cancelled) return false;
    if (!historyDate) return true;
    return bangkokDateKey(order.paid_at || order.created_at) === historyDate;
  }

  return false;
}

const NON_CUP_PRODUCTS = new Set([
  "เนยนม",
  "เนยน้ำตาล",
  "เนยช็อกโกแลต",
  "เนยคาราเมล",
  "ปั่น",
  "ไข่มุกบุก",
  "ปีโป้",
  "ครีมชีส",
  "ช็อตกาแฟ",
  "โยเกิร์ต"
]);

function countDrinkCups(order) {
  return (order.order_items || []).reduce((sum, item) => {
    if (NON_CUP_PRODUCTS.has(item.product_name)) return sum;
    return sum + Number(item.quantity || 0);
  }, 0);
}

function memberRewardText(member) {
  const stamps = Number(member.stamp_count || 0);

  if (member.reward_available) {
    return "🎉 สะสมครบ 10 แก้วแล้ว • ใช้ส่วนลด 30 บาทได้ในออเดอร์ถัดไป";
  }

  const remaining = Math.max(10 - stamps, 0);
  return `⭐ เหลืออีก ${remaining} แก้ว รับส่วนลด 30 บาท`;
}

function renderSelectedMember() {
  if (!selectedMember) {
    selectedMemberBox.classList.add("hidden");
    selectedMemberInfo.innerHTML = "";
    rewardUseBox.classList.add("hidden");
    useMemberReward.checked = false;
    rewardDiscountApplied = false;
    return;
  }

  selectedMemberBox.classList.remove("hidden");
  selectedMemberInfo.innerHTML = `
    <b>${selectedMember.name}</b><br>
    📞 ${selectedMember.phone}<br>
    ☕ สะสม ${selectedMember.stamp_count || 0}/10<br>
    ${memberRewardText(selectedMember)}
  `;

  updateRewardAvailability();
}

function updateRewardAvailability() {
  if (!selectedMember || !checkoutOrder) {
    rewardUseBox.classList.add("hidden");
    return;
  }

  const currentStamps = Number(selectedMember.stamp_count || 0);
  const cupsThisOrder = countDrinkCups(checkoutOrder);
  const totalProgress = currentStamps + cupsThisOrder;
  const alreadyHasReward = Boolean(selectedMember.reward_available);

  // ใช้ได้เมื่อมีสิทธิ์ค้างอยู่แล้ว
  // หรือออเดอร์นี้มีแก้วมากพอให้ครบ 10 และมีแก้วที่ 11 สำหรับใช้ส่วนลด
  const canUseRewardNow = alreadyHasReward || totalProgress >= 11;

  rewardUseBox.classList.toggle("hidden", !canUseRewardNow);

  if (!canUseRewardNow) {
    useMemberReward.checked = false;
    rewardDiscountApplied = false;
    return;
  }

  rewardUseMessage.textContent = alreadyHasReward
    ? `มีสิทธิ์ค้างอยู่แล้ว • แก้วแรกที่ใช้ส่วนลดไม่นับแต้ม • ออเดอร์นี้มี ${cupsThisOrder} แก้ว`
    : `ออเดอร์นี้รวมเป็น ${totalProgress} แก้ว • ใช้ส่วนลดกับแก้วที่ 11 ได้ทันที • แก้วหลังจากนั้นเริ่มนับรอบใหม่`;
}

function applyRewardDiscountState() {
  rewardDiscountApplied = useMemberReward.checked;

  if (rewardDiscountApplied) {
    discountAmount.value = "30";
    discountReason.value = "บัตรสะสมครบ 10 แก้ว";
    otherReasonWrap.classList.add("hidden");
  } else if (
    discountReason.value === "บัตรสะสมครบ 10 แก้ว" &&
    Number(discountAmount.value || 0) === 30
  ) {
    discountAmount.value = "0";
    discountReason.value = "";
  }

  calculateCheckout();
}

function renderCheckoutMemberResults() {
  const query = checkoutMemberSearch.value.trim().toLowerCase();
  checkoutMemberResults.innerHTML = "";

  if (!query) return;

  const matches = checkoutMembers
    .filter(member =>
      `${member.name || ""} ${member.phone || ""}`
        .toLowerCase()
        .includes(query)
    )
    .slice(0, 8);

  if (matches.length === 0) {
    checkoutMemberResults.innerHTML =
      `<div class="member-result-empty">ไม่พบสมาชิก</div>`;
    return;
  }

  matches.forEach(member => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "checkout-member-result";
    button.innerHTML = `
      <span><b>${member.name}</b><br>${member.phone}</span>
      <span>${member.stamp_count || 0}/10</span>
    `;

    button.addEventListener("click", () => {
      selectedMember = member;
      checkoutMemberSearch.value = "";
      checkoutMemberResults.innerHTML = "";
      useMemberReward.checked = false;
      rewardDiscountApplied = false;
      renderSelectedMember();
      calculateCheckout();
    });

    checkoutMemberResults.appendChild(button);
  });
}

async function loadCheckoutMembers() {
  const { data, error } = await sb
    .from("members")
    .select("id,name,phone,stamp_count,reward_available,total_cups,total_spent")
    .order("name", { ascending: true });

  if (error) {
    checkoutMemberResults.innerHTML =
      `<div class="member-result-empty">โหลดสมาชิกไม่สำเร็จ</div>`;
    return;
  }

  checkoutMembers = data || [];
}

function selectedCheckoutPayment() {
  return document.querySelector(
    'input[name="checkoutPayment"]:checked'
  )?.value || "counter";
}

function calculateCheckout() {
  if (!checkoutOrder) return null;

  const total = Number(checkoutOrder.total || 0);
  const discount = Math.max(0, Number(discountAmount.value || 0));
  const net = Math.max(0, total - discount);
  const reason = discountReason.value;
  const otherReason = otherDiscountReason.value.trim();
  const paymentMethod = selectedCheckoutPayment();
  const received = Math.max(0, Number(cashReceived.value || 0));
  const change = paymentMethod === "counter"
    ? Math.max(0, received - net)
    : 0;

  checkoutNetTotal.textContent = numberBaht(net);
  changeAmount.textContent = numberBaht(change);
  cashFields.style.display = paymentMethod === "counter" ? "block" : "none";
  discountError.textContent = "";

  if (discount > total) {
    discountError.textContent = "ส่วนลดต้องไม่มากกว่ายอดสินค้า";
  } else if (discount > 0 && !reason) {
    discountError.textContent = "กรุณาเลือกเหตุผลส่วนลด";
  } else if (reason === "อื่น ๆ" && !otherReason) {
    discountError.textContent = "กรุณาระบุเหตุผลส่วนลด";
  } else if (paymentMethod === "counter" && received < net) {
    discountError.textContent = "จำนวนเงินที่รับยังไม่พอยอดสุทธิ";
  }

  return {
    total,
    discount,
    net,
    paymentMethod,
    received,
    change,
    reason: reason === "อื่น ๆ" ? otherReason : reason
  };
}

function openCheckout(order) {
  checkoutOrder = order;

  checkoutOrderInfo.innerHTML = `
    <b>${order.order_no}</b><br>
    ลูกค้า: ${order.customer_name || "ไม่ระบุชื่อ"}<br>
    โต๊ะ: ${order.table_no === "counter" ? "เคาน์เตอร์" : order.table_no}
  `;

  checkoutTotal.textContent = numberBaht(order.total);

  selectedMember = null;
  rewardDiscountApplied = false;
  useMemberReward.checked = false;
  checkoutMemberSearch.value = "";
  checkoutMemberResults.innerHTML = "";
  renderSelectedMember();

  const cupCount = countDrinkCups(order);
  cupCountPreview.textContent = cupCount > 0
    ? `ออเดอร์นี้นับสะสมได้ ${cupCount} แก้ว`
    : "ออเดอร์นี้ไม่มีเครื่องดื่มที่นับแต้ม";

  loadCheckoutMembers();

  discountAmount.value = "0";
  discountReason.value = "";
  otherDiscountReason.value = "";
  otherReasonWrap.classList.add("hidden");
  cashReceived.value = "";

  const defaultPayment =
    order.payment_method === "promptpay" ? "promptpay" : "counter";

  const paymentRadio = document.querySelector(
    `input[name="checkoutPayment"][value="${defaultPayment}"]`
  );

  if (paymentRadio) paymentRadio.checked = true;

  checkoutModal.classList.add("show");
  checkoutModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  calculateCheckout();
}

function closeCheckout() {
  checkoutModal.classList.remove("show");
  checkoutModal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  checkoutOrder = null;
}

closeCheckoutButton.addEventListener("click", closeCheckout);
checkoutModal
  .querySelector("[data-close-checkout]")
  .addEventListener("click", closeCheckout);

discountAmount.addEventListener("input", () => {
  if (useMemberReward.checked && Number(discountAmount.value || 0) !== 30) {
    useMemberReward.checked = false;
    rewardDiscountApplied = false;
  }
  calculateCheckout();
});
cashReceived.addEventListener("input", calculateCheckout);
otherDiscountReason.addEventListener("input", calculateCheckout);

discountReason.addEventListener("change", () => {
  if (
    useMemberReward.checked &&
    discountReason.value !== "บัตรสะสมครบ 10 แก้ว"
  ) {
    useMemberReward.checked = false;
    rewardDiscountApplied = false;
  }

  otherReasonWrap.classList.toggle(
    "hidden",
    discountReason.value !== "อื่น ๆ"
  );
  calculateCheckout();
});

document
  .querySelectorAll('input[name="checkoutPayment"]')
  .forEach(input => input.addEventListener("change", calculateCheckout));

checkoutMemberSearch.addEventListener("input", renderCheckoutMemberResults);

clearSelectedMember.addEventListener("click", () => {
  selectedMember = null;
  rewardDiscountApplied = false;
  useMemberReward.checked = false;
  renderSelectedMember();
  calculateCheckout();
});

useMemberReward.addEventListener("change", applyRewardDiscountState);

checkoutDoneButton.addEventListener("click", async () => {
  if (!checkoutOrder) return;

  const result = calculateCheckout();
  if (!result || discountError.textContent) return;

  const needsManagerApproval =
    result.discount > 0 || Boolean(useMemberReward.checked);

  if (needsManagerApproval) {
    const actionText = useMemberReward.checked
      ? "อนุมัติใช้สิทธิ์สมาชิกและส่วนลด 30 บาท"
      : `อนุมัติส่วนลด ${numberBaht(result.discount)}`;

    const approvedPin = await askManagerApproval(
      "ขออนุมัติผู้จัดการ",
      `${checkoutOrder.order_no}<br>${actionText}`
    );

    if (!approvedPin) return;
  }

  checkoutDoneButton.disabled = true;
  checkoutDoneButton.textContent = "กำลังบันทึก...";

  const { data, error } = await sb.rpc("finalize_order_payment_v1", {
    p_order_id: checkoutOrder.id,
    p_discount_amount: result.discount,
    p_discount_reason: result.reason || null,
    p_final_total: result.net,
    p_payment_method: result.paymentMethod,
    p_cash_received:
      result.paymentMethod === "counter" ? result.received : null,
    p_change_amount:
      result.paymentMethod === "counter" ? result.change : 0,
    p_member_id: selectedMember?.id || null,
    p_use_reward: Boolean(useMemberReward.checked)
  });

  checkoutDoneButton.disabled = false;
  checkoutDoneButton.textContent = "ยืนยันชำระเงิน";

  if (error) {
    alert("บันทึกการชำระเงินไม่สำเร็จ: " + error.message);
    return;
  }

  const saved = Array.isArray(data) ? data[0] : data;
  const pointsAdded = Number(saved?.points_added || 0);
  const newStampCount = saved?.new_stamp_count;
  const rewardAvailable = saved?.reward_available;
  const rewardUsed = Boolean(saved?.reward_used);

  if (result.discount > 0 || rewardUsed) {
    await writeManagerAudit(
      rewardUsed
        ? "อนุมัติใช้สิทธิ์สมาชิก"
        : "อนุมัติส่วนลด",
      {
        order_no: checkoutOrder.order_no,
        customer: checkoutOrder.customer_name || "ไม่ระบุชื่อ",
        discount_amount: result.discount,
        discount_reason: result.reason || "",
        final_total: result.net,
        member: selectedMember?.name || ""
      }
    );
  }

  closeCheckout();

  currentTab = "history";
  historyDate = bangkokDateKey();
  historyDateFilter.value = historyDate;
  historyDateFilterWrap.classList.remove("hidden");

  tabButtons.forEach(button =>
    button.classList.toggle(
      "active",
      button.dataset.tab === "history"
    )
  );

  await loadOrders();

  let message =
    `ชำระเงินเรียบร้อย\nยอดสุทธิ ${numberBaht(result.net)}`;

  if (result.paymentMethod === "counter") {
    message += `\nเงินทอน ${numberBaht(result.change)}`;
  }

  if (selectedMember) {
    message += `\n\nสมาชิก: ${selectedMember.name}`;
    message += `\nเพิ่มแต้ม ${pointsAdded} แก้ว`;
    message += `\nสะสมใหม่ ${newStampCount}/10`;
    if (rewardUsed) {
      message += `\n🎁 ใช้สิทธิ์ลด 30 บาทแล้ว`;
    } else if (rewardAvailable) {
      message += `\n🎁 มีสิทธิ์ลด 30 บาท`;
    }
  }

  alert(message);
});

async function cancelOrderWithApproval(order) {
  const reason = prompt("เหตุผลที่ยกเลิกออเดอร์");
  if (reason === null) return;

  const cleanReason = reason.trim();
  if (!cleanReason) {
    alert("กรุณาระบุเหตุผลที่ยกเลิก");
    return;
  }

  const pin = await askManagerApproval(
    "อนุมัติยกเลิกออเดอร์",
    `${order.order_no}<br>ลูกค้า: ${order.customer_name || "ไม่ระบุชื่อ"}`
  );

  if (!pin) return;

  const { error } = await sb.rpc("manager_cancel_order", {
    p_order_id: order.id,
    p_pin: pin,
    p_reason: cleanReason
  });

  if (error) {
    alert("ยกเลิกออเดอร์ไม่สำเร็จ: " + error.message);
    return;
  }

  alert("ยกเลิกออเดอร์เรียบร้อย");
  await loadOrders();
}

async function refundOrderWithApproval(order) {
  const refundable = orderFinalTotal(order);

  if (refundable <= 0 || order.refund_status === "refunded") {
    alert("บิลนี้คืนเงินแล้ว");
    return;
  }

  const reason = prompt(
    `คืนเงินเต็มจำนวน ${numberBaht(refundable)}\\nกรุณาระบุเหตุผล`
  );
  if (reason === null) return;

  const cleanReason = reason.trim();
  if (!cleanReason) {
    alert("กรุณาระบุเหตุผลการคืนเงิน");
    return;
  }

  const pin = await askManagerApproval(
    "อนุมัติคืนเงิน",
    `${order.order_no}<br>คืนเงิน ${numberBaht(refundable)}`
  );

  if (!pin) return;

  const { error } = await sb.rpc("manager_refund_order", {
    p_order_id: order.id,
    p_pin: pin,
    p_reason: cleanReason
  });

  if (error) {
    alert("คืนเงินไม่สำเร็จ: " + error.message);
    return;
  }

  alert(`บันทึกคืนเงิน ${numberBaht(refundable)} เรียบร้อย`);
  await loadOrders();
}

function renderOrders(newOrderIds = []) {
  const filteredOrders = allOrders
    .filter(orderMatchesTab)
    .filter(orderMatchesSearch);

  ordersEl.innerHTML = "";
  searchResultCount.textContent = searchText
    ? `พบ ${filteredOrders.length} ออเดอร์`
    : "";

  if (filteredOrders.length === 0) {
    ordersEl.innerHTML = `<div class="empty-state">ไม่พบออเดอร์</div>`;
    return;
  }

  filteredOrders.forEach(order => {
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
          ${isPaid(order) ? '<span class="paid-badge">ชำระแล้ว</span>' : ""}
          ${order.cancelled ? '<span class="cancelled-badge">ยกเลิกแล้ว</span>' : ""}
          ${order.refund_status === "refunded" ? '<span class="refund-badge">คืนเงินแล้ว</span>' : ""}
          <h3>${order.order_no}</h3>
        </div>
        <div class="price">${numberBaht(orderFinalTotal(order))}</div>
      </div>

      <div class="order-meta">
        👤 ลูกค้า: ${order.customer_name || "ไม่ระบุชื่อ"}<br>
        🪑 โต๊ะ: ${tableText}<br>
        💳 ชำระเงิน: ${paymentText(
          order.actual_payment_method || order.payment_method
        )}<br>
        🕒 เวลา: ${orderTime(order.created_at)} น.
        ${isPaid(order) ? `<br>✅ ชำระเวลา: ${orderTime(order.paid_at)} น.` : ""}
        ${order.members ? `<br>👤 สมาชิก: ${order.members.name} (${order.members.phone})` : ""}
        ${Number(order.loyalty_points_added || 0) > 0 ? `<br>☕ แต้มที่เพิ่ม: ${order.loyalty_points_added} แก้ว` : ""}
        ${order.reward_used ? `<br>🎁 ใช้สิทธิ์ลด 30 บาท` : ""}
        ${order.member_stamp_after != null ? `<br>⭐ แต้มหลังจบบิล: ${order.member_stamp_after}/10` : ""}
        ${Number(order.discount_amount || 0) > 0
          ? `<br>🏷️ ส่วนลด: ${numberBaht(order.discount_amount)} (${order.discount_reason || "-"})`
          : ""}
        ${order.actual_payment_method === "counter" &&
          order.cash_received != null
          ? `<br>💵 รับเงิน: ${numberBaht(order.cash_received)} • ทอน: ${numberBaht(order.change_amount)}`
          : ""}
        ${order.cancelled ? `<br>❌ ยกเลิก: ${order.cancel_reason || "-"}` : ""}
        ${order.refund_status === "refunded" ? `<br>↩️ คืนเงิน: ${numberBaht(order.refund_amount)} (${order.refund_reason || "-"})` : ""}
      </div>

      ${(order.order_items || []).map(item => `
        <div class="row">
          <b>${item.product_name} × ${item.quantity}</b>
          <div class="muted">
            ${(item.options || []).join(" • ") || "ไม่มีตัวเลือกเพิ่มเติม"}
          </div>
        </div>
      `).join("")}

      ${currentTab === "history" ? `
        <div class="payment-summary">
          <div><span>ยอดสินค้า</span><b>${numberBaht(order.total)}</b></div>
          <div><span>ส่วนลด</span><b>-${numberBaht(order.discount_amount || 0)}</b></div>
          <div class="payment-summary-net"><span>ยอดสุทธิ</span><b>${numberBaht(orderFinalTotal(order))}</b></div>
        </div>
      ` : ""}

      ${currentTab === "active" ? `
        <div class="actions">
          <button class="making-btn">กำลังทำ</button>
          <button class="ready-btn">พร้อมเสิร์ฟ</button>
          <button class="cancel-order-btn danger-action">❌ ยกเลิก</button>
        </div>
      ` : currentTab === "ready" ? `
        <div class="actions">
          <button class="checkout-btn">💰 คิดเงิน</button>
          <button class="cancel-order-btn danger-action">❌ ยกเลิก</button>
        </div>
      ` : currentTab === "history" && isPaid(order) && order.refund_status !== "refunded" ? `
        <div class="actions">
          <button class="refund-order-btn refund-action">↩️ คืนเงินเต็มจำนวน</button>
        </div>
      ` : ""}
    `;

    card.querySelector(".making-btn")
      ?.addEventListener("click", () =>
        setStatus(order.id, "making")
      );

    card.querySelector(".ready-btn")
      ?.addEventListener("click", () =>
        setStatus(order.id, "ready")
      );

    card.querySelector(".checkout-btn")
      ?.addEventListener("click", () =>
        openCheckout(order)
      );

    card.querySelector(".cancel-order-btn")
      ?.addEventListener("click", () =>
        cancelOrderWithApproval(order)
      );

    card.querySelector(".refund-order-btn")
      ?.addEventListener("click", () =>
        refundOrderWithApproval(order)
      );

    ordersEl.appendChild(card);
  });
}

function checkSecondReminders() {
  if (!firstLoadFinished || !soundEnabled) return;

  const now = Date.now();

  allOrders.forEach(order => {
    const ageMs = now - new Date(order.created_at).getTime();

    if (
      !isPaid(order) &&
      order.status === "new" &&
      ageMs >= 60_000 &&
      !remindedOrderIds.has(order.id)
    ) {
      remindedOrderIds.add(order.id);
      playDoubleDing();
    }
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
      discount_amount,
      discount_reason,
      final_total,
      actual_payment_method,
      cash_received,
      change_amount,
      payment_status,
      paid_at,
      member_id,
      loyalty_points_added,
      reward_used,
      member_stamp_after,
      cancelled,
      cancel_reason,
      cancelled_at,
      refund_status,
      refund_amount,
      refund_reason,
      refunded_at,
      members (
        name,
        phone
      ),
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
      `<p>โหลดออเดอร์ไม่สำเร็จ: ${error.message}</p>`;
    return;
  }

  const currentIds = new Set(data.map(order => order.id));

  const newOrderIds = firstLoadFinished
    ? data
        .filter(order => !knownOrderIds.has(order.id))
        .map(order => order.id)
    : [];

  if (newOrderIds.length > 0 && soundEnabled) {
    newOrderIds.forEach((_, index) =>
      setTimeout(playDing, index * 650)
    );
  }

  allOrders = data;
  await loadTodayNewMemberCount();
  updateDashboard();
  renderOrders(newOrderIds);

  if (newOrderIds.length > 0) {
    currentTab = "active";
    tabButtons.forEach(button =>
      button.classList.toggle(
        "active",
        button.dataset.tab === "active"
      )
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  knownOrderIds = currentIds;
  firstLoadFinished = true;
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
  }

  loadOrders();
}

loadOrders();
setInterval(loadOrders, 3000);
