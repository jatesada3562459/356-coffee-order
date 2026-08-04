(() => {
  const ordersRoot = document.getElementById("orders");
  const testPrintButton = document.getElementById("testPrintButton");

  if (!ordersRoot) return;

  function toast(message, isError = false) {
    document.querySelector(".web-print-toast")?.remove();

    const el = document.createElement("div");
    el.className = `web-print-toast${isError ? " error" : ""}`;
    el.textContent = message;
    document.body.appendChild(el);

    setTimeout(() => el.remove(), 3200);
  }

  function cleanText(value) {
    return String(value || "")
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function orderCardCandidates() {
    return [...ordersRoot.children].filter(el => {
      if (!(el instanceof HTMLElement)) return false;
      const text = cleanText(el.innerText);
      return text.length > 10;
    });
  }

  function removeUiFromClone(clone) {
    clone.querySelectorAll(
      "button, input, select, textarea, audio, .web-print-button"
    ).forEach(el => el.remove());

    clone.querySelectorAll("[hidden], .hidden")
      .forEach(el => el.remove());

    clone.querySelectorAll("*").forEach(el => {
      el.removeAttribute("style");
      el.removeAttribute("onclick");
    });
  }

  function extractTicketText(card) {
    const clone = card.cloneNode(true);
    removeUiFromClone(clone);

    const lines = cleanText(clone.innerText)
      .split("\n")
      .map(line => cleanText(line))
      .filter(Boolean)
      .filter(line => ![
        "รับออเดอร์",
        "เริ่มทำ",
        "พร้อมเสิร์ฟ",
        "คิดเงิน",
        "ลบออเดอร์",
        "แก้ไขออเดอร์",
        "พิมพ์ใบออเดอร์"
      ].includes(line));

    return lines;
  }

  function ticketHtml(lines, isTest = false) {
    const now = new Date().toLocaleString("th-TH", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });

    const bodyLines = lines.length
      ? lines.map(line => `<div class="ticket-line">${escapeHtml(line)}</div>`).join("")
      : '<div class="ticket-line">ไม่พบรายละเอียดออเดอร์</div>';

    return `<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${isTest ? "ทดสอบเครื่องพิมพ์" : "ใบออเดอร์ 356"}</title>
<style>
  @page{
    size:58mm auto;
    margin:2mm;
  }
  *{box-sizing:border-box}
  html,body{
    width:54mm;
    margin:0;
    padding:0;
    background:#fff;
    color:#000;
    font-family:Tahoma,Arial,sans-serif;
  }
  .ticket{
    width:54mm;
    padding:0;
    font-size:12px;
    line-height:1.35;
  }
  .center{text-align:center}
  .shop{
    font-size:17px;
    font-weight:900;
  }
  .subtitle{
    font-size:10px;
  }
  .dash{
    border-top:1px dashed #000;
    margin:6px 0;
  }
  .ticket-line{
    white-space:pre-wrap;
    word-break:break-word;
    padding:1px 0;
  }
  .footer{
    margin-top:7px;
    font-size:9px;
    text-align:center;
  }
  @media print{
    html,body{width:54mm}
  }
</style>
</head>
<body>
  <main class="ticket">
    <div class="center shop">356 Coffee & Drink</div>
    <div class="center subtitle">${isTest ? "ทดสอบพิมพ์ 58 mm" : "ใบทำเครื่องดื่ม"}</div>
    <div class="dash"></div>
    ${bodyLines}
    <div class="dash"></div>
    <div class="footer">${escapeHtml(now)}</div>
  </main>
<script>
  window.onload = () => {
    setTimeout(() => {
      window.print();
      setTimeout(() => window.close(), 800);
    }, 250);
  };
<\/script>
</body>
</html>`;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function openPrintWindow(html) {
    const printWindow = window.open("", "_blank", "width=420,height=720");

    if (!printWindow) {
      toast("Safari/Chrome บล็อกหน้าพิมพ์ กรุณาอนุญาต Pop-up", true);
      return false;
    }

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    return true;
  }

  function printCard(card) {
    const lines = extractTicketText(card);

    if (!lines.length) {
      toast("ไม่พบรายละเอียดออเดอร์สำหรับพิมพ์", true);
      return;
    }

    if (openPrintWindow(ticketHtml(lines))) {
      toast("เปิดหน้าพิมพ์แล้ว ให้เลือกเครื่อง JK-5801H");
    }
  }

  function addPrintButton(card) {
    if (card.dataset.webPrintReady === "1") return;
    if (card.querySelector(".web-print-button")) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "web-print-button";
    button.textContent = "🖨️ พิมพ์ใบออเดอร์";
    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      printCard(card);
    });

    card.appendChild(button);
    card.dataset.webPrintReady = "1";
  }

  function enhanceOrderCards() {
    orderCardCandidates().forEach(addPrintButton);
  }

  const observer = new MutationObserver(() => {
    clearTimeout(observer._timer);
    observer._timer = setTimeout(enhanceOrderCards, 80);
  });

  observer.observe(ordersRoot, {
    childList: true,
    subtree: true
  });

  testPrintButton?.addEventListener("click", () => {
    const lines = [
      "TEST PRINT",
      "เครื่องพิมพ์: JK-5801H",
      "กระดาษ: 58 mm",
      "ภาษาไทย: ทดสอบ ชาไทย กาแฟ โกโก้",
      "1234567890"
    ];

    if (openPrintWindow(ticketHtml(lines, true))) {
      toast("เปิดหน้าทดสอบพิมพ์แล้ว");
    }
  });

  enhanceOrderCards();
})();
