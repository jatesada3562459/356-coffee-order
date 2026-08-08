const sb = supabase.createClient(
  APP_CONFIG.SUPABASE_URL,
  APP_CONFIG.SUPABASE_ANON_KEY
);

const openSessionPanel = document.getElementById("openSessionPanel");
const activeSessionPanel = document.getElementById("activeSessionPanel");
const openingFloat = document.getElementById("openingFloat");
const openSessionButton = document.getElementById("openSessionButton");
const openSessionError = document.getElementById("openSessionError");

const cashBusinessDate = document.getElementById("cashBusinessDate");
const sessionStatusBadge = document.getElementById("sessionStatusBadge");
const summaryOpening = document.getElementById("summaryOpening");
const summaryCashSales = document.getElementById("summaryCashSales");
const summaryCashIn = document.getElementById("summaryCashIn");
const summaryCashOut = document.getElementById("summaryCashOut");
const summaryExpectedCash = document.getElementById("summaryExpectedCash");
const summaryPromptPay = document.getElementById("summaryPromptPay");

const showCashInButton = document.getElementById("showCashInButton");
const showCashOutButton = document.getElementById("showCashOutButton");
const movementForm = document.getElementById("movementForm");
const movementType = document.getElementById("movementType");
const movementAmount = document.getElementById("movementAmount");
const movementCategory = document.getElementById("movementCategory");
const movementNote = document.getElementById("movementNote");
const movementError = document.getElementById("movementError");
const cancelMovementButton = document.getElementById("cancelMovementButton");
const movementList = document.getElementById("movementList");

const actualCash = document.getElementById("actualCash");
const actualPromptPay = document.getElementById("actualPromptPay");
const cashDifference = document.getElementById("cashDifference");
const promptPayDifference = document.getElementById("promptPayDifference");
const netDifference = document.getElementById("netDifference");
const reconcileMessage = document.getElementById("reconcileMessage");
const closingNote = document.getElementById("closingNote");
const closeDayError = document.getElementById("closeDayError");
const closeDayButton = document.getElementById("closeDayButton");

let session = null;
let movements = [];
let systemCashSales = 0;
let systemPromptPay = 0;
let expectedCash = 0;

async function writeAudit(action, details = {}) {
  const { error } = await sb.rpc("write_audit_log", {
    p_action: action,
    p_details: details,
    p_actor: "manager"
  });
  if (error) console.error("บันทึก Audit Log ไม่สำเร็จ", error);
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
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  })}`;
}

function formatTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatThaiDate(dateKey) {
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(new Date(`${dateKey}T12:00:00+07:00`));
}

function setDifferenceStyle(element, value) {
  element.classList.remove("difference-positive", "difference-negative", "difference-zero");
  if (value > 0) element.classList.add("difference-positive");
  else if (value < 0) element.classList.add("difference-negative");
  else element.classList.add("difference-zero");
}

function updateReconciliation() {
  const countedCash = Number(actualCash.value || 0);
  const countedPromptPay = Number(actualPromptPay.value || 0);
  const cashDiff = countedCash - expectedCash;
  const promptDiff = countedPromptPay - systemPromptPay;
  const netDiff = cashDiff + promptDiff;

  cashDifference.textContent = numberBaht(cashDiff);
  promptPayDifference.textContent = numberBaht(promptDiff);
  netDifference.textContent = numberBaht(netDiff);

  setDifferenceStyle(cashDifference, cashDiff);
  setDifferenceStyle(promptPayDifference, promptDiff);
  setDifferenceStyle(netDifference, netDiff);

  if (!actualCash.value && !actualPromptPay.value) {
    reconcileMessage.textContent = "";
    return;
  }

  if (cashDiff === 0 && promptDiff === 0) {
    reconcileMessage.textContent = "✅ เงินสดและพร้อมเพย์ตรงตามระบบ";
    reconcileMessage.className = "reconcile-message reconcile-ok";
  } else if (netDiff === 0 && cashDiff !== 0 && promptDiff !== 0) {
    reconcileMessage.textContent =
      "⚠️ ยอดรวมตรง แต่เงินสดกับพร้อมเพย์อาจถูกบันทึกสลับช่องทาง";
    reconcileMessage.className = "reconcile-message reconcile-warning";
  } else {
    reconcileMessage.textContent =
      `ผลต่างสุทธิ ${numberBaht(netDiff)} กรุณาตรวจรายการที่แก้ไขหรือช่องทางชำระ`;
    reconcileMessage.className = "reconcile-message reconcile-error";
  }
}

async function loadSession() {
  const today = bangkokDateKey();

  const { data, error } = await sb
    .from("cash_sessions")
    .select("*")
    .eq("business_date", today)
    .maybeSingle();

  if (error) {
    openSessionError.textContent = "โหลดข้อมูลเก๊ะไม่สำเร็จ: " + error.message;
    return;
  }

  session = data;

  if (!session) {
    openSessionPanel.classList.remove("hidden");
    activeSessionPanel.classList.add("hidden");
    return;
  }

  openSessionPanel.classList.add("hidden");
  activeSessionPanel.classList.remove("hidden");

  cashBusinessDate.textContent = formatThaiDate(session.business_date);
  sessionStatusBadge.textContent =
    session.status === "closed" ? "ปิดยอดแล้ว" : "เปิดอยู่";
  sessionStatusBadge.classList.toggle("closed", session.status === "closed");

  if (session.status === "closed") {
    closeDayButton.disabled = true;
    closeDayButton.textContent = "ปิดยอดแล้ว";
  }

  await Promise.all([
    loadMovements(),
    loadSystemSales()
  ]);

  renderSummary();
}

async function loadMovements() {
  if (!session) return;

  const { data, error } = await sb
    .from("cash_movements")
    .select("*")
    .eq("session_id", session.id)
    .order("created_at", { ascending: false });

  if (error) {
    movementList.innerHTML =
      `<div class="empty-state">โหลดรายการเงินสดไม่สำเร็จ: ${error.message}</div>`;
    return;
  }

  movements = data || [];
  renderMovements();
}

async function loadSystemSales() {
  const dateKey = session?.business_date || bangkokDateKey();
  const start = new Date(`${dateKey}T00:00:00+07:00`).toISOString();
  const endDate = new Date(`${dateKey}T00:00:00+07:00`);
  endDate.setDate(endDate.getDate() + 1);
  const end = endDate.toISOString();

  const { data, error } = await sb
    .from("orders")
    .select("final_total,total,refund_amount,refund_status,actual_payment_method,payment_method,cash_paid_amount,promptpay_paid_amount,payment_status,paid_at")
    .eq("payment_status", "paid")
    .gte("paid_at", start)
    .lt("paid_at", end);

  if (error) {
    closeDayError.textContent = "โหลดยอดขายไม่สำเร็จ: " + error.message;
    return;
  }

  systemCashSales = 0;
  systemPromptPay = 0;

  (data || []).forEach(order => {
    const gross = Number(order.final_total ?? order.total ?? 0);
    const refunded = Number(order.refund_amount || 0);
    const total = Math.max(0, gross - refunded);
    const method = order.actual_payment_method || order.payment_method;

    if (method === "mixed") {
      const cashGross = Number(order.cash_paid_amount || 0);
      const promptGross = Number(order.promptpay_paid_amount || 0);
      const paidGross = cashGross + promptGross;
      const ratio = paidGross > 0 ? total / paidGross : 0;
      systemCashSales += cashGross * ratio;
      systemPromptPay += promptGross * ratio;
    } else if (method === "promptpay") {
      systemPromptPay += total;
    } else {
      systemCashSales += total;
    }
  });
}

function renderSummary() {
  const cashIn = movements
    .filter(item => item.movement_type === "in")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const cashOut = movements
    .filter(item => item.movement_type === "out")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  expectedCash =
    Number(session?.opening_float || 0) +
    systemCashSales +
    cashIn -
    cashOut;

  summaryOpening.textContent = numberBaht(session?.opening_float);
  summaryCashSales.textContent = numberBaht(systemCashSales);
  summaryCashIn.textContent = numberBaht(cashIn);
  summaryCashOut.textContent = numberBaht(cashOut);
  summaryExpectedCash.textContent = numberBaht(expectedCash);
  summaryPromptPay.textContent = numberBaht(systemPromptPay);

  updateReconciliation();
}

function renderMovements() {
  movementList.innerHTML = "";

  if (!movements.length) {
    movementList.innerHTML =
      `<div class="empty-state">ยังไม่มีรายการเงินเข้า–ออก</div>`;
    return;
  }

  movements.forEach(item => {
    const row = document.createElement("article");
    row.className = `cash-movement-item ${item.movement_type}`;
    row.innerHTML = `
      <div>
        <b>${item.movement_type === "in" ? "➕ เงินเข้า" : "➖ เงินออก"}</b>
        <div>${item.category || "ไม่ระบุหมวด"}${item.note ? ` • ${item.note}` : ""}</div>
        <small>${formatTime(item.created_at)} น.</small>
      </div>
      <strong>${item.movement_type === "in" ? "+" : "-"}${numberBaht(item.amount)}</strong>
    `;
    movementList.appendChild(row);
  });
}

function showMovementForm(type) {
  movementType.value = type;
  movementForm.classList.remove("hidden");
  movementAmount.value = "";
  movementNote.value = "";
  movementCategory.value = type === "in" ? "เติมเงินทอน" : "";
  movementError.textContent = "";
  movementAmount.focus();
}

showCashInButton.addEventListener("click", () => showMovementForm("in"));
showCashOutButton.addEventListener("click", () => showMovementForm("out"));
cancelMovementButton.addEventListener("click", () => {
  movementForm.classList.add("hidden");
});

movementForm.addEventListener("submit", async event => {
  event.preventDefault();

  if (!session || session.status === "closed") return;

  const type = movementType.value;
  const amount = Number(movementAmount.value || 0);
  const category = movementCategory.value;
  const note = movementNote.value.trim();

  movementError.textContent = "";

  if (!["in", "out"].includes(type)) {
    movementError.textContent = "ประเภทรายการไม่ถูกต้อง";
    return;
  }

  if (amount <= 0) {
    movementError.textContent = "กรุณากรอกจำนวนเงิน";
    return;
  }

  if (!category) {
    movementError.textContent = "กรุณาเลือกหมวดหมู่";
    return;
  }

  const { error } = await sb
    .from("cash_movements")
    .insert({
      session_id: session.id,
      movement_type: type,
      amount,
      category,
      note: note || null
    });

  if (error) {
    movementError.textContent = "บันทึกไม่สำเร็จ: " + error.message;
    return;
  }

  await writeAudit(
    type === "in" ? "บันทึกเงินเข้า" : "บันทึกเงินออก",
    {
      amount,
      category,
      note: note || ""
    }
  );

  movementForm.classList.add("hidden");
  await loadMovements();
  renderSummary();
});

openSessionButton.addEventListener("click", async () => {
  const amount = Number(openingFloat.value || 0);
  openSessionError.textContent = "";

  if (amount < 0) {
    openSessionError.textContent = "เงินทอนตั้งต้นต้องไม่ติดลบ";
    return;
  }

  openSessionButton.disabled = true;
  openSessionButton.textContent = "กำลังเปิดเก๊ะ...";

  const { error } = await sb
    .from("cash_sessions")
    .insert({
      business_date: bangkokDateKey(),
      opening_float: amount,
      status: "open"
    });

  openSessionButton.disabled = false;
  openSessionButton.textContent = "เปิดเก๊ะวันนี้";

  if (error) {
    openSessionError.textContent =
      error.code === "23505"
        ? "วันนี้เปิดเก๊ะไว้แล้ว"
        : "เปิดเก๊ะไม่สำเร็จ: " + error.message;
    return;
  }

  await writeAudit("เปิดเก๊ะ", {
    business_date: bangkokDateKey(),
    opening_float: amount
  });

  await loadSession();
});

actualCash.addEventListener("input", updateReconciliation);
actualPromptPay.addEventListener("input", updateReconciliation);

closeDayButton.addEventListener("click", async () => {
  if (!session || session.status === "closed") return;

  const countedCash = Number(actualCash.value || 0);
  const countedPromptPay = Number(actualPromptPay.value || 0);
  const note = closingNote.value.trim();

  closeDayError.textContent = "";

  if (!actualCash.value) {
    closeDayError.textContent = "กรุณากรอกเงินสดจริง";
    return;
  }

  if (!actualPromptPay.value) {
    closeDayError.textContent = "กรุณากรอกพร้อมเพย์จริง";
    return;
  }

  const cashDiff = countedCash - expectedCash;
  const promptDiff = countedPromptPay - systemPromptPay;
  const netDiff = cashDiff + promptDiff;

  const confirmed = confirm(
    `ยืนยันปิดยอดวันนี้?\n\n` +
    `เงินสดตามระบบ ${numberBaht(expectedCash)}\n` +
    `เงินสดจริง ${numberBaht(countedCash)}\n` +
    `พร้อมเพย์ตามระบบ ${numberBaht(systemPromptPay)}\n` +
    `พร้อมเพย์จริง ${numberBaht(countedPromptPay)}\n` +
    `ผลต่างสุทธิ ${numberBaht(netDiff)}`
  );

  if (!confirmed) return;

  closeDayButton.disabled = true;
  closeDayButton.textContent = "กำลังปิดยอด...";

  const { error: closingError } = await sb
    .from("daily_closings")
    .upsert({
      session_id: session.id,
      business_date: session.business_date,
      opening_float: Number(session.opening_float || 0),
      cash_sales_system: systemCashSales,
      promptpay_system: systemPromptPay,
      expected_cash: expectedCash,
      actual_cash: countedCash,
      actual_promptpay: countedPromptPay,
      cash_difference: cashDiff,
      promptpay_difference: promptDiff,
      net_difference: netDiff,
      note: note || null,
      closed_at: new Date().toISOString()
    }, {
      onConflict: "business_date"
    });

  if (closingError) {
    closeDayButton.disabled = false;
    closeDayButton.textContent = "ปิดยอดวันนี้";
    closeDayError.textContent = "บันทึกปิดยอดไม่สำเร็จ: " + closingError.message;
    return;
  }

  const { error: sessionError } = await sb
    .from("cash_sessions")
    .update({
      status: "closed",
      closed_at: new Date().toISOString()
    })
    .eq("id", session.id);

  if (sessionError) {
    closeDayButton.disabled = false;
    closeDayButton.textContent = "ปิดยอดวันนี้";
    closeDayError.textContent = "เปลี่ยนสถานะเก๊ะไม่สำเร็จ: " + sessionError.message;
    return;
  }

  await writeAudit("ปิดยอดประจำวัน", {
    business_date: session.business_date,
    expected_cash: expectedCash,
    actual_cash: countedCash,
    promptpay_system: systemPromptPay,
    actual_promptpay: countedPromptPay,
    cash_difference: cashDiff,
    promptpay_difference: promptDiff,
    net_difference: netDiff,
    note: note || ""
  });

  alert("ปิดยอดวันนี้เรียบร้อย");
  await loadSession();
});

window.addEventListener("manager-unlocked", loadSession);
