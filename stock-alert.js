(() => {
  const panel = document.getElementById("lowStockAlertPanel");
  const summary = document.getElementById("lowStockAlertSummary");
  const list = document.getElementById("lowStockAlertList");
  const refreshButton = document.getElementById("refreshLowStockButton");

  if (!panel || !summary || !list) return;

  const sb = supabase.createClient(
    APP_CONFIG.SUPABASE_URL,
    APP_CONFIG.SUPABASE_ANON_KEY
  );

  function statusOf(item) {
    const quantity = Number(item.quantity || 0);
    const minimum = Number(item.minimum_quantity || 0);

    if (quantity <= 0) return "out";
    if (quantity <= minimum) return "low";
    return "ok";
  }

  function formatNumber(value) {
    return Number(value || 0).toLocaleString("th-TH", {
      maximumFractionDigits: 2
    });
  }

  async function loadLowStockAlerts() {
    refreshButton && (refreshButton.disabled = true);
    summary.textContent = "กำลังตรวจสอบ...";
    list.innerHTML = "";

    const { data, error } = await sb
      .from("stock_items")
      .select("id,name,unit,quantity,minimum_quantity,category,is_active")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    refreshButton && (refreshButton.disabled = false);

    if (error) {
      panel.hidden = false;
      panel.classList.add("error");
      summary.textContent = "โหลดข้อมูลสต็อกไม่สำเร็จ";
      list.innerHTML = `<div class="low-stock-alert-error">${error.message}</div>`;
      return;
    }

    panel.classList.remove("error");

    const problemItems = (data || [])
      .map(item => ({ ...item, status: statusOf(item) }))
      .filter(item => item.status !== "ok");

    if (!problemItems.length) {
      panel.hidden = true;
      return;
    }

    panel.hidden = false;

    const outCount = problemItems.filter(item => item.status === "out").length;
    const lowCount = problemItems.filter(item => item.status === "low").length;

    summary.textContent =
      `หมดแล้ว ${outCount} รายการ • ใกล้หมด ${lowCount} รายการ`;

    list.innerHTML = problemItems
      .slice(0, 12)
      .map(item => `
        <article class="low-stock-alert-item ${item.status}">
          <div>
            <strong>${item.name}</strong>
            <small>${item.category || "ทั่วไป"}</small>
          </div>
          <div class="low-stock-alert-qty">
            <b>${formatNumber(item.quantity)} ${item.unit}</b>
            <small>ขั้นต่ำ ${formatNumber(item.minimum_quantity)} ${item.unit}</small>
          </div>
        </article>
      `)
      .join("");
  }

  refreshButton?.addEventListener("click", loadLowStockAlerts);

  window.addEventListener("manager-unlocked", () => {
    loadLowStockAlerts();

    setInterval(() => {
      if (!document.hidden) loadLowStockAlerts();
    }, 60000);
  });
})();
