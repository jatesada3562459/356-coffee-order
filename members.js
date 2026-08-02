const sb = supabase.createClient(
  APP_CONFIG.SUPABASE_URL,
  APP_CONFIG.SUPABASE_ANON_KEY
);

const memberName = document.getElementById("memberName");
const memberPhone = document.getElementById("memberPhone");
const memberFormError = document.getElementById("memberFormError");
const saveMemberButton = document.getElementById("saveMemberButton");
const memberSearch = document.getElementById("memberSearch");
const memberCount = document.getElementById("memberCount");
const memberList = document.getElementById("memberList");

let allMembers = [];

function cleanPhone(value) {
  return String(value || "").replace(/[^\d+]/g, "").trim();
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("th-TH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

function renderMembers() {
  const query = memberSearch.value.trim().toLowerCase();

  const filtered = allMembers.filter(member => {
    const text = `${member.name || ""} ${member.phone || ""}`.toLowerCase();
    return text.includes(query);
  });

  memberCount.textContent = `สมาชิก ${filtered.length} คน`;
  memberList.innerHTML = "";

  if (filtered.length === 0) {
    memberList.innerHTML = `<div class="empty-state">ไม่พบสมาชิก</div>`;
    return;
  }

  filtered.forEach(member => {
    const card = document.createElement("article");
    card.className = "member-card";
    card.innerHTML = `
      <div class="member-card-top">
        <div>
          <h3>${member.name}</h3>
          <div class="member-phone">📞 ${member.phone}</div>
        </div>
        <span class="member-stamp">${member.stamp_count || 0}/10</span>
      </div>

      <div class="member-meta">
        🎁 สิทธิ์ลด 30 บาท: ${member.reward_available ? "มีสิทธิ์" : "ยังไม่มี"}<br>
        🥤 ซื้อสะสมทั้งหมด: ${member.total_cups || 0} แก้ว<br>
        📅 สมัครเมื่อ: ${formatDate(member.created_at)}
      </div>

      <button class="edit-member-button" type="button">✏️ แก้ไขชื่อ/เบอร์</button>
    `;

    card.querySelector(".edit-member-button").addEventListener("click", async () => {
      const newName = prompt("แก้ไขชื่อลูกค้า", member.name);
      if (newName === null) return;

      const newPhone = prompt("แก้ไขเบอร์โทร", member.phone);
      if (newPhone === null) return;

      const name = newName.trim();
      const phone = cleanPhone(newPhone);

      if (!name || !phone) {
        alert("กรุณากรอกชื่อและเบอร์โทรให้ครบ");
        return;
      }

      const { error } = await sb
        .from("members")
        .update({
          name,
          phone,
          updated_at: new Date().toISOString()
        })
        .eq("id", member.id);

      if (error) {
        alert("แก้ไขสมาชิกไม่สำเร็จ: " + error.message);
        return;
      }

      loadMembers();
    });

    memberList.appendChild(card);
  });
}

async function loadMembers() {
  const { data, error } = await sb
    .from("members")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    memberList.innerHTML = `<div class="empty-state">โหลดสมาชิกไม่สำเร็จ: ${error.message}</div>`;
    return;
  }

  allMembers = data || [];
  renderMembers();
}

saveMemberButton.addEventListener("click", async () => {
  const name = memberName.value.trim();
  const phone = cleanPhone(memberPhone.value);

  memberFormError.textContent = "";

  if (!name) {
    memberFormError.textContent = "กรุณากรอกชื่อลูกค้า";
    return;
  }

  if (!phone) {
    memberFormError.textContent = "กรุณากรอกเบอร์โทร";
    return;
  }

  saveMemberButton.disabled = true;
  saveMemberButton.textContent = "กำลังบันทึก...";

  const { error } = await sb
    .from("members")
    .insert({
      name,
      phone
    });

  saveMemberButton.disabled = false;
  saveMemberButton.textContent = "บันทึกสมาชิก";

  if (error) {
    memberFormError.textContent = error.code === "23505"
      ? "เบอร์โทรนี้เป็นสมาชิกอยู่แล้ว"
      : "บันทึกไม่สำเร็จ: " + error.message;
    return;
  }

  memberName.value = "";
  memberPhone.value = "";
  await loadMembers();
  alert("เพิ่มสมาชิกเรียบร้อย");
});

memberSearch.addEventListener("input", renderMembers);

loadMembers();
