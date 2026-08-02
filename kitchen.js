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
  return { new: "NEW", making: "กำลังทำ", ready: "พร้อมเสิร์ฟ" }[status] || status;
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

function isPaid(order) {
  return order.payment_status === "paid";
}

function orderFinalTotal(order) {
  return Number(order.final_total ?? order.total ?? 0);
}

function updateDashboard() {
  const todayKey = bangkokDateKey();
  const todayPaidOrders = allOrders.filter(order =>
    isPaid(order) &&
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
    return !isPaid(order) &&
      (order.status === "new" || order.status === "making");
  }

  if (currentTab === "ready") {
    return !isPaid(order) && order.status === "ready";
  }

  if (currentTab === "history") {
    if (!isPaid(order)) return false;
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
  return member.reward_available
    ? "🎁 มีสิทธิ์ลด 30 บาท"
    : "🎁 ยังไม่มีสิทธิ์ลด";
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
  const alreadyHasReward = Boolean(selectedMember.reward_available);
  const reachesRewardNow = currentStamps + cupsThisOrder >= 10;
  const canUseReward = alreadyHasReward || reachesRewardNow;

  rewardUseBox.classList.toggle("hidden", !canUseReward);

  if (!canUseReward) {
    useMemberReward.checked = false;
    rewardDiscountApplied = false;
    return;
  }

  rewardUseMessage.textContent = alreadyHasReward
    ? `มีสิทธิ์ค้างอยู่แล้ว • ออเดอร์นี้มี ${cupsThisOrder} แก้ว`
    : `ออเดอร์นี้ทำให้ครบ ${currentStamps + cupsThisOrder}/10 และใช้สิทธิ์ได้ทันที`;
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
        ${Number(order.discount_amount || 0) > 0
          ? `<br>🏷️ ส่วนลด: ${numberBaht(order.discount_amount)} (${order.discount_reason || "-"})`
          : ""}
        ${order.actual_payment_method === "counter" &&
          order.cash_received != null
          ? `<br>💵 รับเงิน: ${numberBaht(order.cash_received)} • ทอน: ${numberBaht(order.change_amount)}`
          : ""}
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
        </div>
      ` : currentTab === "ready" ? `
        <div class="actions">
          <button class="checkout-btn">💰 คิดเงิน</button>
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
