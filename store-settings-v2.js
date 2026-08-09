const sb = supabase.createClient(
  APP_CONFIG.SUPABASE_URL,
  APP_CONFIG.SUPABASE_ANON_KEY
);

const coverPlaceholder = document.getElementById("coverPlaceholder");
const coverPreview = document.getElementById("coverPreview");
const coverFileInput = document.getElementById("coverFileInput");
const removeCoverButton = document.getElementById("removeCoverButton");

const logoPlaceholder = document.getElementById("logoPlaceholder");
const logoPreview = document.getElementById("logoPreview");
const logoFileInput = document.getElementById("logoFileInput");
const removeLogoButton = document.getElementById("removeLogoButton");

const storeNameInput = document.getElementById("storeNameInput");
const storeDescriptionInput = document.getElementById("storeDescriptionInput");
const storeOpenTime = document.getElementById("storeOpenTime");
const storeCloseTime = document.getElementById("storeCloseTime");
const storeAcceptingOrders = document.getElementById("storeAcceptingOrders");
const storeImageStatus = document.getElementById("storeImageStatus");
const storeSettingsError = document.getElementById("storeSettingsError");
const saveStoreSettingsButton = document.getElementById("saveStoreSettingsButton");
const weeklyHoursList = document.getElementById("weeklyHoursList");
const weeklyHoursError = document.getElementById("weeklyHoursError");


let coverFile = null;
let logoFile = null;
let coverPreviewUrl = null;
let logoPreviewUrl = null;
let currentCoverUrl = null;
let currentLogoUrl = null;
let removeCover = false;
let removeLogo = false;
let loaded = false;

function showPreview(imageEl, placeholderEl, url) {
  if (url) {
    imageEl.src = url;
    imageEl.style.display = "block";
    imageEl.classList.remove("hidden");
    placeholderEl.style.display = "none";
    placeholderEl.classList.add("hidden");
  } else {
    imageEl.removeAttribute("src");
    imageEl.style.display = "none";
    imageEl.classList.add("hidden");
    placeholderEl.style.display = "flex";
    placeholderEl.classList.remove("hidden");
  }
}

function validateFile(file) {
  if (!file) return "ไม่พบไฟล์รูป";
  if (file.size > 25 * 1024 * 1024) return "รูปมีขนาดเกิน 25 MB";
  return "";
}

function storageFileName() {
  const id = globalThis.crypto?.randomUUID?.() ||
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${Date.now()}-${String(id).replace(/[^a-zA-Z0-9-]/g, "")}.jpg`;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("อ่านรูปไม่สำเร็จ"));
    reader.readAsDataURL(file);
  });
}

async function convertToJpeg(file, maxSize = 2200, quality = 0.9) {
  const dataUrl = await fileToDataUrl(file);

  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(
      "ระบบเปิดรูปนี้ไม่ได้ กรุณาเลือกภาพ Screenshot หรือ JPG/PNG"
    ));
    img.src = dataUrl;
  });

  const w = image.naturalWidth || image.width;
  const h = image.naturalHeight || image.height;
  const scale = Math.min(1, maxSize / Math.max(w, h));
  const width = Math.max(1, Math.round(w * scale));
  const height = Math.max(1, Math.round(h * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);

  const blob = await new Promise(resolve =>
    canvas.toBlob(resolve, "image/jpeg", quality)
  );

  if (!blob) throw new Error("แปลงรูปเป็น JPG ไม่สำเร็จ");
  return blob;
}

async function uploadImage(file, folder) {
  const jpeg = await convertToJpeg(file);
  const path = `${folder}/${storageFileName()}`;

  const { error } = await sb.storage
    .from("store-images")
    .upload(path, jpeg, {
      cacheControl: "3600",
      contentType: "image/jpeg",
      upsert: false
    });

  if (error) throw new Error(`อัปโหลด${folder === "cover" ? "หน้าปก" : "โลโก้"}ไม่สำเร็จ: ${error.message}`);

  const { data } = sb.storage.from("store-images").getPublicUrl(path);
  if (!data?.publicUrl) throw new Error("สร้างลิงก์รูปไม่สำเร็จ");

  return data.publicUrl;
}

async function selectImage(input, type) {
  const file = input.files?.[0];
  const error = validateFile(file);
  storeSettingsError.textContent = "";

  if (error) {
    storeSettingsError.textContent = error;
    return;
  }

  const objectUrl = URL.createObjectURL(file);

  if (type === "cover") {
    if (coverPreviewUrl) URL.revokeObjectURL(coverPreviewUrl);
    coverPreviewUrl = objectUrl;
    coverFile = file;
    removeCover = false;
    showPreview(coverPreview, coverPlaceholder, objectUrl);
    storeImageStatus.textContent = `✅ เลือกรูปหน้าปกแล้ว: ${file.name || "รูปภาพ"}`;
  } else {
    if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl);
    logoPreviewUrl = objectUrl;
    logoFile = file;
    removeLogo = false;
    showPreview(logoPreview, logoPlaceholder, objectUrl);
    storeImageStatus.textContent = `✅ เลือกโลโก้แล้ว: ${file.name || "รูปภาพ"}`;
  }
}

coverFileInput.addEventListener("click", () => {
  coverFileInput.value = "";
});
logoFileInput.addEventListener("click", () => {
  logoFileInput.value = "";
});

coverFileInput.addEventListener("change", () =>
  selectImage(coverFileInput, "cover")
);
logoFileInput.addEventListener("change", () =>
  selectImage(logoFileInput, "logo")
);

removeCoverButton.addEventListener("click", () => {
  coverFile = null;
  removeCover = true;
  coverFileInput.value = "";
  showPreview(coverPreview, coverPlaceholder, null);
  storeImageStatus.textContent = "ลบรูปหน้าปกเมื่อกดบันทึก";
});

removeLogoButton.addEventListener("click", () => {
  logoFile = null;
  removeLogo = true;
  logoFileInput.value = "";
  showPreview(logoPreview, logoPlaceholder, null);
  storeImageStatus.textContent = "ลบโลโก้เมื่อกดบันทึก";
});

async function requestPin() {
  return new Promise(resolve => {
    const overlay = document.createElement("div");
    overlay.className = "approval-overlay";
    overlay.innerHTML = `
      <div class="approval-card">
        <div class="approval-icon">🔐</div>
        <h2>ยืนยันแก้ไขหน้าร้าน</h2>
        <p>กรอก PIN ผู้จัดการก่อนบันทึก</p>
        <label class="approval-field">
          <span>PIN ผู้จัดการ 4 หลัก</span>
          <input class="approval-pin" type="password" inputmode="numeric"
            maxlength="4" placeholder="••••">
        </label>
        <div class="approval-error"></div>
        <div class="approval-actions">
          <button class="approval-cancel" type="button">ยกเลิก</button>
          <button class="approval-confirm primary" type="button">ยืนยัน</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);
    const input = overlay.querySelector(".approval-pin");
    const errorEl = overlay.querySelector(".approval-error");
    const confirmButton = overlay.querySelector(".approval-confirm");

    const finish = value => {
      overlay.remove();
      resolve(value);
    };

    overlay.querySelector(".approval-cancel")
      .addEventListener("click", () => finish(null));

    async function verify() {
      const pin = input.value.trim();

      if (!/^\d{4}$/.test(pin)) {
        errorEl.textContent = "กรุณากรอก PIN 4 หลัก";
        return;
      }

      confirmButton.disabled = true;
      confirmButton.textContent = "กำลังตรวจสอบ...";

      const { data, error } = await sb.rpc("verify_manager_pin", { p_pin: pin });

      confirmButton.disabled = false;
      confirmButton.textContent = "ยืนยัน";

      if (error) {
        errorEl.textContent = error.message;
      } else if (!data) {
        errorEl.textContent = "PIN ไม่ถูกต้อง";
        input.value = "";
        input.focus();
      } else {
        finish(pin);
      }
    }

    confirmButton.addEventListener("click", verify);
    input.addEventListener("keydown", event => {
      if (event.key === "Enter") verify();
    });
    setTimeout(() => input.focus(), 80);
  });
}

const WEEKLY_DAYS_356 = [
  { day: 0, name: "วันอาทิตย์" },
  { day: 1, name: "วันจันทร์" },
  { day: 2, name: "วันอังคาร" },
  { day: 3, name: "วันพุธ" },
  { day: 4, name: "วันพฤหัสบดี" },
  { day: 5, name: "วันศุกร์" },
  { day: 6, name: "วันเสาร์" }
];

let weeklySchedule356 = [];

function normalizeWeeklyRow356(row, day) {
  return {
    day_of_week: Number(row?.day_of_week ?? day),
    is_open: row ? row.is_open !== false : day !== 0,
    open_time: String(row?.open_time || "10:00").slice(0, 5),
    close_time: String(row?.close_time || "15:00").slice(0, 5)
  };
}

function renderWeeklyHours356() {
  if (!weeklyHoursList) return;

  const byDay = new Map(
    (weeklySchedule356 || []).map(row => [Number(row.day_of_week), row])
  );

  weeklyHoursList.innerHTML = "";

  WEEKLY_DAYS_356.forEach(meta => {
    const row = normalizeWeeklyRow356(byDay.get(meta.day), meta.day);

    const el = document.createElement("div");
    el.className = "weekly-hours-row" + (row.is_open ? "" : " is-closed");
    el.dataset.day = String(meta.day);

    el.innerHTML = `
      <div class="weekly-day-name">${meta.name}</div>

      <label class="weekly-open-toggle">
        <input class="weekly-is-open" type="checkbox" ${row.is_open ? "checked" : ""}>
        <span>${row.is_open ? "เปิด" : "ปิด"}</span>
      </label>

      <label class="weekly-time-label">
        <span>เวลาเปิด</span>
        <input class="weekly-open-time" type="time"
          value="${row.open_time}" ${row.is_open ? "" : "disabled"}>
      </label>

      <label class="weekly-time-label">
        <span>เวลาปิด</span>
        <input class="weekly-close-time" type="time"
          value="${row.close_time}" ${row.is_open ? "" : "disabled"}>
      </label>
    `;

    const toggle = el.querySelector(".weekly-is-open");
    const toggleText = el.querySelector(".weekly-open-toggle span");
    const openInput = el.querySelector(".weekly-open-time");
    const closeInput = el.querySelector(".weekly-close-time");

    toggle.addEventListener("change", () => {
      const enabled = toggle.checked;
      toggleText.textContent = enabled ? "เปิด" : "ปิด";
      openInput.disabled = !enabled;
      closeInput.disabled = !enabled;
      el.classList.toggle("is-closed", !enabled);
    });

    weeklyHoursList.appendChild(el);
  });
}

function collectWeeklyHours356() {
  return [...weeklyHoursList.querySelectorAll(".weekly-hours-row")].map(el => ({
    day_of_week: Number(el.dataset.day),
    is_open: el.querySelector(".weekly-is-open").checked,
    open_time: el.querySelector(".weekly-open-time").value || "10:00",
    close_time: el.querySelector(".weekly-close-time").value || "15:00"
  }));
}

async function loadWeeklyHours356() {
  if (!weeklyHoursError) return;

  weeklyHoursError.textContent = "";

  const { data, error } = await sb
    .from("store_weekly_hours")
    .select("day_of_week,is_open,open_time,close_time")
    .order("day_of_week", { ascending: true });

  if (error) {
    weeklySchedule356 = [];
    weeklyHoursError.textContent =
      "ยังโหลดตารางเวลาไม่ได้ — กรุณาตรวจว่าได้รัน SQL ตาราง store_weekly_hours แล้ว";
    renderWeeklyHours356();
    return;
  }

  weeklySchedule356 = data || [];
  renderWeeklyHours356();
}

async function loadStoreSettings() {
  if (loaded) return;
  loaded = true;

  const { data, error } = await sb
    .from("store_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    loaded = false;
    storeSettingsError.textContent = "โหลดข้อมูลไม่สำเร็จ: " + error.message;
    return;
  }

  const settings = data || {};
  storeNameInput.value = settings.store_name || "356 Coffee & Drink";
  storeDescriptionInput.value =
    settings.description || "เครื่องดื่มและขนมจากร้าน 356";
  storeOpenTime.value = String(settings.open_time || "09:00").slice(0, 5);
  storeCloseTime.value = String(settings.close_time || "16:00").slice(0, 5);
  storeAcceptingOrders.checked = settings.accepting_orders !== false;

  currentCoverUrl = settings.cover_url || null;
  currentLogoUrl = settings.logo_url || null;

  showPreview(
    coverPreview,
    coverPlaceholder,
    currentCoverUrl ? `${currentCoverUrl}?v=${Date.now()}` : null
  );
  showPreview(
    logoPreview,
    logoPlaceholder,
    currentLogoUrl ? `${currentLogoUrl}?v=${Date.now()}` : null
  );

  storeImageStatus.textContent =
    currentCoverUrl || currentLogoUrl
      ? "โหลดรูปที่บันทึกไว้แล้ว"
      : "ยังไม่ได้เลือกรูปใหม่";

  await loadWeeklyHours356();
}

saveStoreSettingsButton.addEventListener("click", async () => {
  const name = storeNameInput.value.trim();
  const description = storeDescriptionInput.value.trim();
  const openTime = storeOpenTime.value;
  const closeTime = storeCloseTime.value;

  storeSettingsError.textContent = "";

  if (!name) {
    storeSettingsError.textContent = "กรุณากรอกชื่อร้าน";
    return;
  }

  const pin = await requestPin();
  if (!pin) return;

  saveStoreSettingsButton.disabled = true;
  saveStoreSettingsButton.textContent = "กำลังอัปโหลดและบันทึก...";

  try {
    let coverUrl = removeCover ? null : currentCoverUrl;
    let logoUrl = removeLogo ? null : currentLogoUrl;

    if (coverFile) coverUrl = await uploadImage(coverFile, "cover");
    if (logoFile) logoUrl = await uploadImage(logoFile, "logo");

    const { error } = await sb.rpc("manager_save_store_settings", {
      p_pin: pin,
      p_store_name: name,
      p_description: description,
      p_cover_url: coverUrl,
      p_logo_url: logoUrl,
      p_open_time: openTime,
      p_close_time: closeTime,
      p_accepting_orders: storeAcceptingOrders.checked
    });

    if (error) throw new Error(error.message);

    const schedule356 = collectWeeklyHours356();
    const { error: weeklyError356 } = await sb.rpc("manager_save_store_weekly_hours", {
      p_pin: pin,
      p_schedule: schedule356
    });
    if (weeklyError356) throw new Error("บันทึกตารางเวลาไม่สำเร็จ: " + weeklyError356.message);
    weeklySchedule356 = schedule356;

    currentCoverUrl = coverUrl;
    currentLogoUrl = logoUrl;
    coverFile = null;
    logoFile = null;
    removeCover = false;
    removeLogo = false;

    showPreview(
      coverPreview,
      coverPlaceholder,
      currentCoverUrl ? `${currentCoverUrl}?v=${Date.now()}` : null
    );
    showPreview(
      logoPreview,
      logoPlaceholder,
      currentLogoUrl ? `${currentLogoUrl}?v=${Date.now()}` : null
    );

    storeImageStatus.textContent = "✅ บันทึกรูปหน้าร้านเรียบร้อย";
    alert("บันทึกหน้าร้านเรียบร้อย");
  } catch (error) {
    storeSettingsError.textContent = "บันทึกไม่สำเร็จ: " + error.message;
  } finally {
    saveStoreSettingsButton.disabled = false;
    saveStoreSettingsButton.textContent = "บันทึกหน้าร้าน";
  }
});

window.addEventListener("manager-unlocked", loadStoreSettings);
setTimeout(loadStoreSettings, 300);
