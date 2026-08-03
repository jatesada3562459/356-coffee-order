const sb = supabase.createClient(
  APP_CONFIG.SUPABASE_URL,
  APP_CONFIG.SUPABASE_ANON_KEY
);

const auditSearch = document.getElementById("auditSearch");
const refreshAuditButton = document.getElementById("refreshAuditButton");
const auditList = document.getElementById("auditList");

let auditItems = [];

function formatDateTime(value) {
  return new Date(value).toLocaleString("th-TH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function renderAudit() {
  const query = auditSearch.value.trim().toLowerCase();

  const filtered = auditItems.filter(item => {
    const text = `${item.action || ""} ${JSON.stringify(item.details || {})}`
      .toLowerCase();
    return text.includes(query);
  });

  auditList.innerHTML = "";

  if (!filtered.length) {
    auditList.innerHTML = '<div class="empty-state">ยังไม่มีประวัติที่ตรงกับการค้นหา</div>';
    return;
  }

  filtered.forEach(item => {
    const row = document.createElement("article");
    row.className = "audit-item";

    const details = item.details || {};
    const detailLines = Object.entries(details)
      .filter(([, value]) => value !== null && value !== undefined && value !== "")
      .map(([key, value]) => `<div><span>${key}</span><b>${value}</b></div>`)
      .join("");

    row.innerHTML = `
      <div class="audit-item-top">
        <strong>${item.action}</strong>
        <time>${formatDateTime(item.created_at)}</time>
      </div>
      <div class="audit-actor">ผู้ทำรายการ: ${item.actor || "manager"}</div>
      ${detailLines ? `<div class="audit-details">${detailLines}</div>` : ""}
    `;

    auditList.appendChild(row);
  });
}

async function loadAudit() {
  auditList.innerHTML = '<div class="empty-state">กำลังโหลด...</div>';

  const { data, error } = await sb.rpc("get_audit_logs", {
    p_limit: 300
  });

  if (error) {
    auditList.innerHTML =
      `<div class="empty-state">โหลด Audit Log ไม่สำเร็จ: ${error.message}</div>`;
    return;
  }

  auditItems = data || [];
  renderAudit();
}

auditSearch.addEventListener("input", renderAudit);
refreshAuditButton.addEventListener("click", loadAudit);
window.addEventListener("manager-unlocked", loadAudit);
