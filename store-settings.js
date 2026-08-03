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
const storeSettingsError = document.getElementById("storeSettingsError");
const saveStoreSettingsButton = document.getElementById("saveStoreSettingsButton");

let coverFile = null;
let logoFile = null;
let currentCoverUrl = null;
let currentLogoUrl = null;
let removeCover = false;
let removeLogo = false;

function updatePreview(imageEl,placeholderEl,url){
  if(url){
    imageEl.src=url;
    imageEl.classList.remove("hidden");
    placeholderEl.classList.add("hidden");
  }else{
    imageEl.removeAttribute("src");
    imageEl.classList.add("hidden");
    placeholderEl.classList.remove("hidden");
  }
}

function validateImage(file){
  if(!file) return "ไม่พบไฟล์รูป";
  if(!["image/jpeg","image/png","image/webp"].includes(file.type)){
    return "รองรับเฉพาะ JPG, PNG และ WebP";
  }
  if(file.size>10*1024*1024){
    return "รูปมีขนาดเกิน 10 MB";
  }
  return "";
}

function safeStorageName(extension){
  const id=(globalThis.crypto?.randomUUID?.()||
    `${Date.now()}-${Math.random().toString(36).slice(2)}`)
    .replace(/[^a-zA-Z0-9-]/g,"");
  return `${Date.now()}-${id}.${extension}`;
}

async function uploadStoreImage(file,type){
  const extension=(file.name.split(".").pop()||"jpg")
    .toLowerCase()
    .replace(/[^a-z0-9]/g,"")||"jpg";

  const path=`${type}/${safeStorageName(extension)}`;

  const {error}=await sb.storage
    .from("store-images")
    .upload(path,file,{
      cacheControl:"3600",
      upsert:false,
      contentType:file.type||undefined
    });

  if(error) throw new Error(error.message);

  const {data}=sb.storage
    .from("store-images")
    .getPublicUrl(path);

  return data.publicUrl;
}

async function requestPin(){
  return new Promise(resolve=>{
    const overlay=document.createElement("div");
    overlay.className="approval-overlay";
    overlay.innerHTML=`
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
      </div>
    `;
    document.body.appendChild(overlay);

    const input=overlay.querySelector(".approval-pin");
    const errorEl=overlay.querySelector(".approval-error");
    const confirmButton=overlay.querySelector(".approval-confirm");

    function finish(value){
      overlay.remove();
      resolve(value);
    }

    overlay.querySelector(".approval-cancel")
      .addEventListener("click",()=>finish(null));

    async function verify(){
      const pin=input.value.trim();
      if(!/^\d{4}$/.test(pin)){
        errorEl.textContent="กรุณากรอก PIN 4 หลัก";
        return;
      }

      confirmButton.disabled=true;
      confirmButton.textContent="กำลังตรวจสอบ...";

      const {data,error}=await sb.rpc("verify_manager_pin",{p_pin:pin});

      confirmButton.disabled=false;
      confirmButton.textContent="ยืนยัน";

      if(error){
        errorEl.textContent=error.message;
        return;
      }

      if(!data){
        errorEl.textContent="PIN ไม่ถูกต้อง";
        input.value="";
        input.focus();
        return;
      }

      finish(pin);
    }

    confirmButton.addEventListener("click",verify);
    input.addEventListener("keydown",event=>{
      if(event.key==="Enter") verify();
    });
    setTimeout(()=>input.focus(),80);
  });
}

async function loadStoreSettings(){
  const {data,error}=await sb
    .from("store_settings")
    .select("*")
    .eq("id",1)
    .maybeSingle();

  if(error){
    storeSettingsError.textContent="โหลดข้อมูลไม่สำเร็จ: "+error.message;
    return;
  }

  const settings=data||{};
  storeNameInput.value=settings.store_name||"356 Coffee & Drink";
  storeDescriptionInput.value=settings.description||"เครื่องดื่มและขนมจากร้าน 356";
  storeOpenTime.value=settings.open_time||"09:00";
  storeCloseTime.value=settings.close_time||"16:00";
  storeAcceptingOrders.checked=settings.accepting_orders!==false;

  currentCoverUrl=settings.cover_url||null;
  currentLogoUrl=settings.logo_url||null;

  updatePreview(coverPreview,coverPlaceholder,currentCoverUrl);
  updatePreview(logoPreview,logoPlaceholder,currentLogoUrl);
}

coverFileInput.addEventListener("change",()=>{
  const file=coverFileInput.files?.[0]||null;
  const error=validateImage(file);
  storeSettingsError.textContent=error;
  if(error){
    coverFileInput.value="";
    return;
  }

  coverFile=file;
  removeCover=false;
  updatePreview(coverPreview,coverPlaceholder,URL.createObjectURL(file));
});

logoFileInput.addEventListener("change",()=>{
  const file=logoFileInput.files?.[0]||null;
  const error=validateImage(file);
  storeSettingsError.textContent=error;
  if(error){
    logoFileInput.value="";
    return;
  }

  logoFile=file;
  removeLogo=false;
  updatePreview(logoPreview,logoPlaceholder,URL.createObjectURL(file));
});

removeCoverButton.addEventListener("click",()=>{
  coverFile=null;
  removeCover=true;
  coverFileInput.value="";
  updatePreview(coverPreview,coverPlaceholder,null);
});

removeLogoButton.addEventListener("click",()=>{
  logoFile=null;
  removeLogo=true;
  logoFileInput.value="";
  updatePreview(logoPreview,logoPlaceholder,null);
});

saveStoreSettingsButton.addEventListener("click",async()=>{
  const name=storeNameInput.value.trim();
  const description=storeDescriptionInput.value.trim();
  const openTime=storeOpenTime.value;
  const closeTime=storeCloseTime.value;

  storeSettingsError.textContent="";

  if(!name){
    storeSettingsError.textContent="กรุณากรอกชื่อร้าน";
    return;
  }

  if(!openTime||!closeTime){
    storeSettingsError.textContent="กรุณากรอกเวลาเปิดและเวลาปิด";
    return;
  }

  const pin=await requestPin();
  if(!pin) return;

  saveStoreSettingsButton.disabled=true;
  saveStoreSettingsButton.textContent="กำลังบันทึก...";

  try{
    let coverUrl=removeCover?null:currentCoverUrl;
    let logoUrl=removeLogo?null:currentLogoUrl;

    if(coverFile) coverUrl=await uploadStoreImage(coverFile,"cover");
    if(logoFile) logoUrl=await uploadStoreImage(logoFile,"logo");

    const {error}=await sb.rpc("manager_save_store_settings",{
      p_pin:pin,
      p_store_name:name,
      p_description:description,
      p_cover_url:coverUrl,
      p_logo_url:logoUrl,
      p_open_time:openTime,
      p_close_time:closeTime,
      p_accepting_orders:storeAcceptingOrders.checked
    });

    if(error) throw new Error(error.message);

    currentCoverUrl=coverUrl;
    currentLogoUrl=logoUrl;
    coverFile=null;
    logoFile=null;
    removeCover=false;
    removeLogo=false;

    alert("บันทึกหน้าร้านเรียบร้อย");
  }catch(error){
    storeSettingsError.textContent="บันทึกไม่สำเร็จ: "+error.message;
  }finally{
    saveStoreSettingsButton.disabled=false;
    saveStoreSettingsButton.textContent="บันทึกหน้าร้าน";
  }
});

window.addEventListener("manager-unlocked",loadStoreSettings);
