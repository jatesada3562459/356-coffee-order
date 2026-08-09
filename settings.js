const sb = supabase.createClient(
  APP_CONFIG.SUPABASE_URL,
  APP_CONFIG.SUPABASE_ANON_KEY
);

const menuSettingsSearch = document.getElementById("menuSettingsSearch");
const menuSettingsCategory = document.getElementById("menuSettingsCategory");
const menuSettingsList = document.getElementById("menuSettingsList");
const allMenuCount = document.getElementById("allMenuCount");
const activeMenuCount = document.getElementById("activeMenuCount");
const inactiveMenuCount = document.getElementById("inactiveMenuCount");
const menuSettingsStatus = document.getElementById("menuSettingsStatus");
const saveMenuSettingsButton = document.getElementById("saveMenuSettingsButton");
const addMenuButton = document.getElementById("addMenuButton");
const addCategoryButton = document.getElementById("addCategoryButton");
const categoryManagerList = document.getElementById("categoryManagerList");
const categoryEditorModal = document.getElementById("categoryEditorModal");
const categoryEditorTitle = document.getElementById("categoryEditorTitle");
const closeCategoryEditorButton = document.getElementById("closeCategoryEditorButton");
const categoryDisplayName = document.getElementById("categoryDisplayName");
const categoryIsActive = document.getElementById("categoryIsActive");
const categoryEditorError = document.getElementById("categoryEditorError");
const saveCategoryButton = document.getElementById("saveCategoryButton");
const deleteCategoryButton = document.getElementById("deleteCategoryButton");

const menuEditorModal = document.getElementById("menuEditorModal");
const menuEditorTitle = document.getElementById("menuEditorTitle");
const closeMenuEditorButton = document.getElementById("closeMenuEditorButton");
const editorItemType = document.getElementById("editorItemType");
const editorItemName = document.getElementById("editorItemName");
const editorCategoryWrap = document.getElementById("editorCategoryWrap");
const editorCategory = document.getElementById("editorCategory");
const editorPrice = document.getElementById("editorPrice");
const editorOptionsWrap = document.getElementById("editorOptionsWrap");
const editorIsActive = document.getElementById("editorIsActive");
const editorRecommendedWrap = document.getElementById("editorRecommendedWrap");
const editorRecommended = document.getElementById("editorRecommended");
const menuEditorError = document.getElementById("menuEditorError");
const saveMenuEditorButton = document.getElementById("saveMenuEditorButton");
const deleteCustomMenuButton = document.getElementById("deleteCustomMenuButton");
const editorImageFile = document.getElementById("editorImageFile");
const editorImagePreview = document.getElementById("editorImagePreview");
const editorImagePlaceholder = document.getElementById("editorImagePlaceholder");
const removeEditorImageButton = document.getElementById("removeEditorImageButton");

let items = [];
let originalItems = [];
let dirty = false;
let editingItem = null;
let pendingImageFile = null;
let editorImageUrl = null;
let removeCurrentImage = false;
let categories = [];
let editingCategory = null;

function itemKey(item) {
  return `${item.item_type}:${item.item_name}`;
}

function cloneItems(value) {
  return JSON.parse(JSON.stringify(value));
}

function setDirty(value) {
  dirty = value;
  saveMenuSettingsButton.disabled = !dirty;
  menuSettingsStatus.textContent = dirty
    ? "มีการแก้ไขที่ยังไม่ได้บันทึก"
    : "บันทึกข้อมูลล่าสุดแล้ว";
}

function updateSummary() {
  allMenuCount.textContent = items.length.toLocaleString("th-TH");
  activeMenuCount.textContent = items.filter(item => item.is_active).length.toLocaleString("th-TH");
  inactiveMenuCount.textContent = items.filter(item => !item.is_active).length.toLocaleString("th-TH");
}

function categoryLabel(key) {
  return categories.find(c => c.category_key === key)?.display_name || key || "อื่น ๆ";
}

function activeCategoryRows() {
  return categories
    .filter(c => c.is_active !== false)
    .sort((a,b) => Number(a.sort_order||0) - Number(b.sort_order||0));
}

function buildCategories() {
  const previous = menuSettingsCategory.value;
  const rows = categories.length
    ? categories.slice().sort((a,b)=>Number(a.sort_order||0)-Number(b.sort_order||0))
    : [...new Set(items.filter(i=>i.item_type==="product").map(i=>i.category).filter(Boolean))]
        .map((name,index)=>({category_key:name,display_name:name,sort_order:index+1,is_active:true}));

  menuSettingsCategory.innerHTML =
    '<option value="ทั้งหมด">ทุกหมวดหมู่</option>' +
    rows.map(c => `<option value="${c.category_key}">${c.display_name}${c.is_active===false?" (ซ่อน)":""}</option>`).join("") +
    '<option value="ADD-ON">ADD-ON</option>';

  editorCategory.innerHTML =
    '<option value="">เลือกหมวดหมู่</option>' +
    rows.filter(c=>c.is_active!==false).map(c => `<option value="${c.category_key}">${c.display_name}</option>`).join("");

  if ([...menuSettingsCategory.options].some(option => option.value === previous)) {
    menuSettingsCategory.value = previous;
  }
}

function renderCategoryManager(){
  if(!categoryManagerList) return;
  const rows=categories.slice().sort((a,b)=>Number(a.sort_order||0)-Number(b.sort_order||0));
  if(!rows.length){
    categoryManagerList.innerHTML='<div class="empty-state">ยังไม่มีข้อมูลหมวดหมู่</div>';
    return;
  }
  categoryManagerList.innerHTML='';
  rows.forEach((c,index)=>{
    const row=document.createElement('div');
    row.className=`category-row ${c.is_active===false?'hidden-category':''}`;
    const count=items.filter(i=>i.item_type==='product'&&i.category===c.category_key).length;
    row.innerHTML=`
      <div><div class="category-row-name">${c.display_name}</div><div class="category-row-meta">${count} เมนู • ${c.is_active===false?'ซ่อนจากหน้าลูกค้า':'แสดงบนหน้าลูกค้า'}</div></div>
      <div class="category-row-actions">
        <button class="category-move up" type="button" ${index===0?'disabled':''}>↑</button>
        <button class="category-move down" type="button" ${index===rows.length-1?'disabled':''}>↓</button>
        <button class="category-edit" type="button">แก้ไข</button>
      </div>`;
    row.querySelector('.category-edit').addEventListener('click',()=>openCategoryEditor(c));
    row.querySelector('.up').addEventListener('click',()=>moveCategory(c,-1));
    row.querySelector('.down').addEventListener('click',()=>moveCategory(c,1));
    categoryManagerList.appendChild(row);
  });
}

function renderItems() {
  const query = menuSettingsSearch.value.trim().toLowerCase();
  const category = menuSettingsCategory.value;

  const filtered = items.filter(item => {
    const matchesQuery =
      `${item.item_name} ${item.category || ""}`.toLowerCase().includes(query);

    const shownCategory =
      item.item_type === "addon" ? "ADD-ON" : item.category;

    return matchesQuery &&
      (category === "ทั้งหมด" || shownCategory === category);
  });

  menuSettingsList.innerHTML = "";

  if (!filtered.length) {
    menuSettingsList.innerHTML =
      '<div class="empty-state">ไม่พบเมนูที่ค้นหา</div>';
    return;
  }

  filtered.forEach(item => {
    const card = document.createElement("article");
    card.className = `menu-setting-card ${item.is_active ? "" : "inactive"}`;
    card.innerHTML = `
      ${item.image_url
        ? `<img class="menu-setting-thumb" src="${item.image_url}" alt="${item.item_name}" loading="lazy">`
        : `<div class="menu-setting-thumb-placeholder">356</div>`}

      <div class="menu-setting-info">
        <div>
          <span class="menu-setting-category">
            ${item.item_type === "addon" ? "ADD-ON" : categoryLabel(item.category)}
          </span>
          ${item.is_custom ? '<span class="custom-menu-badge">เมนูเพิ่มเอง</span>' : ""}
          ${item.item_type === "product" && item.item_data?.recommended ? '<span class="recommended-menu-badge">⭐ แนะนำ</span>' : ""}
          <h3>${item.item_name}</h3>
        </div>

        <label class="menu-active-switch">
          <input class="active-input" type="checkbox" ${item.is_active ? "checked" : ""}>
          <span>${item.is_active ? "เปิดขาย" : "ปิดขาย"}</span>
        </label>
      </div>

      <label class="menu-price-field">
        <span>ราคา (บาท)</span>
        <input class="price-input" type="number" min="0" step="1"
          inputmode="decimal" value="${Number(item.price)}">
      </label>

      <button class="edit-menu-button" type="button">
        ✏️ ${item.is_custom ? "แก้ไขรายละเอียด/ลบ" : "ดูและแก้ตัวเลือก"}
      </button>
    `;

    const priceInput = card.querySelector(".price-input");
    const activeInput = card.querySelector(".active-input");
    const activeLabel = card.querySelector(".menu-active-switch span");

    priceInput.addEventListener("input", () => {
      item.price = Math.max(0, Number(priceInput.value || 0));
      setDirty(true);
    });

    activeInput.addEventListener("change", () => {
      item.is_active = activeInput.checked;
      activeLabel.textContent = item.is_active ? "เปิดขาย" : "ปิดขาย";
      card.classList.toggle("inactive", !item.is_active);
      updateSummary();
      setDirty(true);
    });

    card.querySelector(".edit-menu-button")
      .addEventListener("click", () => openMenuEditor(item));

    menuSettingsList.appendChild(card);
  });
}

async function loadSettings() {
  menuSettingsList.innerHTML =
    '<div class="empty-state">กำลังโหลดรายการเมนู...</div>';

  const menuResponse = await fetch("menu.json", { cache: "no-store" });
  if (!menuResponse.ok) {
    menuSettingsList.innerHTML =
      '<div class="empty-state">โหลด menu.json ไม่สำเร็จ</div>';
    return;
  }

  const menu = await menuResponse.json();

  const defaults = [
    ...menu.products.map(product => ({
      item_type: "product",
      item_name: product.name,
      category: product.category,
      price: Number(product.price),
      is_active: true,
      is_custom: false,
      item_data: { groups: Array.isArray(product.groups) ? product.groups : [] },
      image_url: product.image_url || null
    })),
    ...menu.addons.map(addon => ({
      item_type: "addon",
      item_name: addon.name,
      category: "ADD-ON",
      price: Number(addon.price),
      is_active: true,
      is_custom: false,
      item_data: {},
      image_url: addon.image_url || null
    }))
  ];

  const { data: categoryData, error: categoryError } = await sb
    .from("menu_categories")
    .select("category_key,display_name,sort_order,is_active")
    .order("sort_order", { ascending: true });

  if (categoryError) {
    console.warn("โหลดหมวดหมู่แบบจัดการเองไม่สำเร็จ ใช้หมวดจากเมนูเดิมแทน", categoryError);
    categories = [];
  } else {
    categories = categoryData || [];
  }

  const { data: settings, error } = await sb
    .from("menu_settings")
    .select("item_type,item_name,category,price,is_active,is_custom,item_data,image_url");

  if (error) {
    menuSettingsList.innerHTML =
      `<div class="empty-state">โหลดการตั้งค่าไม่สำเร็จ: ${error.message}</div>`;
    return;
  }

  const settingMap = new Map(
    (settings || []).map(setting => [itemKey(setting), setting])
  );

  const defaultItems = defaults.map(item => {
    const saved = settingMap.get(itemKey(item));
    return saved ? {
      ...item,
      price: Number(saved.price),
      is_active: Boolean(saved.is_active),
      category: saved.category || item.category,
      is_custom: Boolean(saved.is_custom),
      item_data: saved.item_data || item.item_data,
      image_url: saved.image_url || item.image_url || null
    } : item;
  });

  const customItems = (settings || [])
    .filter(setting => setting.is_custom)
    .filter(setting => !defaults.some(item => itemKey(item) === itemKey(setting)))
    .map(setting => ({
      item_type: setting.item_type,
      item_name: setting.item_name,
      category: setting.item_type === "addon"
        ? "ADD-ON"
        : (setting.category || "อื่น ๆ"),
      price: Number(setting.price),
      is_active: Boolean(setting.is_active),
      is_custom: true,
      item_data: setting.item_data || {},
      image_url: setting.image_url || null
    }));

  items = [...defaultItems, ...customItems];
  originalItems = cloneItems(items);
  buildCategories();
  renderCategoryManager();
  updateSummary();
  renderItems();
  setDirty(false);
}

function selectedGroups() {
  const groups = [];

  const sweetMode = editorOptionsWrap.querySelector(
    'input[name="editorSweetMode"]:checked'
  )?.value;
  const extrasMode = editorOptionsWrap.querySelector(
    'input[name="editorExtrasMode"]:checked'
  )?.value;

  if (sweetMode) groups.push(sweetMode);
  if (document.getElementById("editorMilkOption").checked) groups.push("milk");
  if (extrasMode) groups.push(extrasMode);
  if (document.getElementById("editorYogurtOption").checked) groups.push("yogurt");
  if (document.getElementById("editorSizeOption").checked) groups.push("size");

  return groups;
}

function setSelectedGroups(groups = []) {
  const sweetMode = groups.includes("sweet")
    ? "sweet"
    : groups.includes("sweet_no_zero")
      ? "sweet_no_zero"
      : "";

  const extrasMode = groups.includes("extras_all")
    ? "extras_all"
    : groups.includes("extras_no_blend")
      ? "extras_no_blend"
      : groups.includes("extras_soda")
        ? "extras_soda"
        : "";

  const sweetInput = editorOptionsWrap.querySelector(
    `input[name="editorSweetMode"][value="${sweetMode}"]`
  );
  const extrasInput = editorOptionsWrap.querySelector(
    `input[name="editorExtrasMode"][value="${extrasMode}"]`
  );

  if (sweetInput) sweetInput.checked = true;
  if (extrasInput) extrasInput.checked = true;

  document.getElementById("editorMilkOption").checked = groups.includes("milk");
  document.getElementById("editorYogurtOption").checked = groups.includes("yogurt");
  document.getElementById("editorSizeOption").checked = groups.includes("size");
}

function updateImagePreview(url = null) {
  editorImageUrl = url || null;

  if (editorImageUrl) {
    editorImagePreview.src = editorImageUrl;
    editorImagePreview.classList.remove("hidden");
    editorImagePlaceholder.classList.add("hidden");
    removeEditorImageButton.disabled = false;
  } else {
    editorImagePreview.removeAttribute("src");
    editorImagePreview.classList.add("hidden");
    editorImagePlaceholder.classList.remove("hidden");
    removeEditorImageButton.disabled = true;
  }
}

function makeSafeStorageFileName(extension = "jpg") {
  const randomPart =
    (globalThis.crypto?.randomUUID?.() ||
      `${Date.now()}-${Math.random().toString(36).slice(2)}`)
      .replace(/[^a-zA-Z0-9-]/g, "");

  return `${Date.now()}-${randomPart}.${extension}`;
}

async function uploadMenuImage(file, itemType, itemName) {
  if (!file) return editorImageUrl;

  if (file.size > 10 * 1024 * 1024) {
    throw new Error("รูปมีขนาดเกิน 10 MB");
  }

  const extension = (file.name.split(".").pop() || "jpg")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "") || "jpg";

  const path =
    `${itemType}/${makeSafeStorageFileName(extension)}`;

  const { error: uploadError } = await sb.storage
    .from("menu-images")
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || undefined
    });

  if (uploadError) {
    throw new Error("อัปโหลดรูปไม่สำเร็จ: " + uploadError.message);
  }

  const { data } = sb.storage
    .from("menu-images")
    .getPublicUrl(path);

  return data.publicUrl;
}

function updateEditorTypeUI() {
  const isAddon = editorItemType.value === "addon";
  editorCategoryWrap.classList.toggle("hidden", isAddon);
  editorOptionsWrap.classList.toggle("hidden", isAddon);
  if (editorRecommendedWrap) editorRecommendedWrap.classList.toggle("hidden", isAddon);
  if (isAddon && editorRecommended) editorRecommended.checked = false;
}

function applySuggestedOptionsForCategory() {
  if (editingItem || editorItemType.value === "addon") return;

  const category = editorCategory.value;
  let groups = [];

  if (category === "กาแฟ") {
    groups = ["sweet", "milk", "extras_all", "size"];
  } else if (category === "ชา & นม") {
    groups = ["sweet", "milk", "extras_all", "size"];
  } else if (category === "สมูทตี้") {
    groups = ["sweet", "yogurt", "size"];
  } else if (category === "โซดา") {
    groups = ["sweet_no_zero", "extras_soda", "size"];
  } else if (category === "ปังเย็น") {
    groups = ["sweet", "extras_no_blend"];
  } else if (category === "ขนมปังปิ้ง") {
    groups = [];
  }

  setSelectedGroups(groups);
}

function openMenuEditor(item = null) {
  editingItem = item;
  menuEditorError.textContent = "";

  if (item) {
    menuEditorTitle.textContent = item.is_custom
      ? "แก้ไขเมนู"
      : "แก้ไขตัวเลือกเมนู";
    editorItemType.value = item.item_type;
    editorItemName.value = item.item_name;
    if (item.item_type === "product" && item.category && ![...editorCategory.options].some(o=>o.value===item.category)) {
      const opt=document.createElement("option");
      opt.value=item.category; opt.textContent=categoryLabel(item.category)+" (ซ่อน)";
      editorCategory.appendChild(opt);
    }
    editorCategory.value = item.category || "";
    editorPrice.value = Number(item.price);
    editorIsActive.checked = Boolean(item.is_active);
    editorRecommended.checked = item.item_type === "product" && Boolean(item.item_data?.recommended);
    setSelectedGroups(item.item_data?.groups || []);
    pendingImageFile = null;
    removeCurrentImage = false;
    editorImageFile.value = "";
    updateImagePreview(item.image_url || null);

    editorItemType.disabled = !item.is_custom;
    editorItemName.disabled = !item.is_custom;
    deleteCustomMenuButton.classList.toggle("hidden", !item.is_custom);
  } else {
    menuEditorTitle.textContent = "เพิ่มเมนูใหม่";
    editorItemType.value = "product";
    editorItemName.value = "";
    editorCategory.value = "";
    editorPrice.value = "";
    editorIsActive.checked = true;
    editorRecommended.checked = false;
    setSelectedGroups([]);
    pendingImageFile = null;
    removeCurrentImage = false;
    editorImageFile.value = "";
    updateImagePreview(null);

    editorItemType.disabled = false;
    editorItemName.disabled = false;
    deleteCustomMenuButton.classList.add("hidden");
  }

  updateEditorTypeUI();
  menuEditorModal.classList.add("show");
  menuEditorModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeMenuEditor() {
  menuEditorModal.classList.remove("show");
  menuEditorModal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  editingItem = null;
}

async function requestManagerPin(title = "ยืนยันการเปลี่ยนแปลง") {
  return new Promise(resolve => {
    const overlay = document.createElement("div");
    overlay.className = "approval-overlay";
    overlay.innerHTML = `
      <div class="approval-card">
        <div class="approval-icon">🔐</div>
        <h2>${title}</h2>
        <p>กรอก PIN ผู้จัดการเพื่อดำเนินการ</p>
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
    const input = overlay.querySelector(".approval-pin");
    const errorEl = overlay.querySelector(".approval-error");
    const confirm = overlay.querySelector(".approval-confirm");

    function finish(value) {
      overlay.remove();
      resolve(value);
    }

    overlay.querySelector(".approval-cancel")
      .addEventListener("click", () => finish(null));

    async function verify() {
      const pin = input.value.trim();
      if (!/^\d{4}$/.test(pin)) {
        errorEl.textContent = "กรุณากรอก PIN 4 หลัก";
        return;
      }

      confirm.disabled = true;
      confirm.textContent = "กำลังตรวจสอบ...";

      const { data, error } = await sb.rpc("verify_manager_pin", { p_pin: pin });

      confirm.disabled = false;
      confirm.textContent = "ยืนยัน";

      if (error) {
        errorEl.textContent = error.message;
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

    confirm.addEventListener("click", verify);
    input.addEventListener("keydown", event => {
      if (event.key === "Enter") verify();
    });
    setTimeout(() => input.focus(), 80);
  });
}

function openCategoryEditor(category=null){
  editingCategory=category;
  categoryEditorError.textContent="";
  categoryEditorTitle.textContent=category?"แก้ไขหมวดหมู่":"เพิ่มหมวดหมู่";
  categoryDisplayName.value=category?.display_name||"";
  categoryIsActive.checked=category?category.is_active!==false:true;
  deleteCategoryButton.classList.toggle("hidden",!category);
  categoryEditorModal.classList.add("show");
  categoryEditorModal.setAttribute("aria-hidden","false");
  document.body.style.overflow="hidden";
  setTimeout(()=>categoryDisplayName.focus(),80);
}

function closeCategoryEditor(){
  categoryEditorModal.classList.remove("show");
  categoryEditorModal.setAttribute("aria-hidden","true");
  document.body.style.overflow="";
  editingCategory=null;
}

async function saveCategoryOrder(){
  const pin=await requestManagerPin("ยืนยันเรียงลำดับหมวดหมู่");
  if(!pin) return false;
  const payload=categories
    .slice().sort((a,b)=>Number(a.sort_order||0)-Number(b.sort_order||0))
    .map((c,index)=>({category_key:c.category_key,sort_order:index+1}));
  const {error}=await sb.rpc("manager_reorder_menu_categories",{p_pin:pin,p_categories:payload});
  if(error){alert("เรียงหมวดหมู่ไม่สำเร็จ: "+error.message);return false;}
  return true;
}

async function moveCategory(category,direction){
  const rows=categories.slice().sort((a,b)=>Number(a.sort_order||0)-Number(b.sort_order||0));
  const index=rows.findIndex(c=>c.category_key===category.category_key);
  const target=index+direction;
  if(index<0||target<0||target>=rows.length) return;
  [rows[index],rows[target]]=[rows[target],rows[index]];
  rows.forEach((c,i)=>c.sort_order=i+1);
  categories=rows;
  renderCategoryManager(); buildCategories();
  if(await saveCategoryOrder()){ await loadSettings(); }
  else { await loadSettings(); }
}

saveCategoryButton.addEventListener("click",async()=>{
  const name=categoryDisplayName.value.trim();
  categoryEditorError.textContent="";
  if(!name){categoryEditorError.textContent="กรุณากรอกชื่อหมวดหมู่";return;}
  if(categories.some(c=>c.display_name.trim().toLowerCase()===name.toLowerCase()&&c!==editingCategory)){
    categoryEditorError.textContent="มีชื่อหมวดหมู่นี้อยู่แล้ว";return;
  }
  const pin=await requestManagerPin(editingCategory?"ยืนยันแก้ไขหมวดหมู่":"ยืนยันเพิ่มหมวดหมู่");
  if(!pin) return;
  saveCategoryButton.disabled=true; saveCategoryButton.textContent="กำลังบันทึก...";
  const {error}=await sb.rpc("manager_upsert_menu_category",{
    p_pin:pin,
    p_category_key:editingCategory?.category_key||null,
    p_display_name:name,
    p_is_active:categoryIsActive.checked,
    p_sort_order:editingCategory?.sort_order||categories.length+1
  });
  saveCategoryButton.disabled=false; saveCategoryButton.textContent="บันทึกหมวดหมู่";
  if(error){categoryEditorError.textContent="บันทึกไม่สำเร็จ: "+error.message;return;}
  closeCategoryEditor(); await loadSettings();
});

deleteCategoryButton.addEventListener("click",async()=>{
  if(!editingCategory) return;
  const used=items.filter(i=>i.item_type==='product'&&i.category===editingCategory.category_key).length;
  const msg=used?`หมวดนี้มี ${used} เมนู หากลบ หมวดและเมนูในหมวดนี้จะไม่แสดงบนหน้าลูกค้า แต่ข้อมูลเมนูจะไม่ถูกลบ\n\nยืนยันลบหมวด “${editingCategory.display_name}” หรือไม่?`:`ยืนยันลบหมวด “${editingCategory.display_name}” หรือไม่?`;
  if(!confirm(msg)) return;
  const pin=await requestManagerPin("ยืนยันลบหมวดหมู่"); if(!pin) return;
  deleteCategoryButton.disabled=true; deleteCategoryButton.textContent="กำลังลบ...";
  const {error}=await sb.rpc("manager_delete_menu_category",{p_pin:pin,p_category_key:editingCategory.category_key});
  deleteCategoryButton.disabled=false; deleteCategoryButton.textContent="ลบหมวดหมู่";
  if(error){categoryEditorError.textContent="ลบไม่สำเร็จ: "+error.message;return;}
  closeCategoryEditor(); await loadSettings();
});

addCategoryButton.addEventListener("click",()=>openCategoryEditor());
closeCategoryEditorButton.addEventListener("click",closeCategoryEditor);
categoryEditorModal.querySelector("[data-close-category-editor]").addEventListener("click",closeCategoryEditor);

saveMenuEditorButton.addEventListener("click", async () => {
  const type = editorItemType.value;
  const name = editorItemName.value.trim();
  const category = type === "addon" ? "ADD-ON" : editorCategory.value.trim();
  const price = Number(editorPrice.value || 0);
  const isActive = editorIsActive.checked;
  const isRecommended = type === "product" && editorRecommended.checked;
  const groups = type === "product" ? selectedGroups() : [];

  menuEditorError.textContent = "";

  if (!name) {
    menuEditorError.textContent = "กรุณากรอกชื่อเมนู";
    return;
  }

  if (type === "product" && !category) {
    menuEditorError.textContent = "กรุณากรอกหมวดหมู่";
    return;
  }

  if (!Number.isFinite(price) || price < 0) {
    menuEditorError.textContent = "ราคาต้องเป็น 0 บาทขึ้นไป";
    return;
  }

  const duplicate = items.find(item =>
    itemKey(item) === `${type}:${name}` &&
    item !== editingItem
  );

  if (duplicate) {
    menuEditorError.textContent = "มีชื่อเมนูนี้อยู่แล้ว";
    return;
  }

  const pin = await requestManagerPin(
    editingItem ? "ยืนยันแก้ไขเมนู" : "ยืนยันเพิ่มเมนูใหม่"
  );
  if (!pin) return;

  saveMenuEditorButton.disabled = true;
  saveMenuEditorButton.textContent = "กำลังบันทึก...";

  let finalImageUrl = removeCurrentImage ? null : editorImageUrl;

  try {
    if (pendingImageFile) {
      finalImageUrl = await uploadMenuImage(
        pendingImageFile,
        type,
        name
      );
    }
  } catch (uploadError) {
    saveMenuEditorButton.disabled = false;
    saveMenuEditorButton.textContent = "บันทึกเมนู";
    menuEditorError.textContent = uploadError.message;
    return;
  }

  const { error } = await sb.rpc("manager_upsert_custom_menu", {
    p_pin: pin,
    p_old_item_type: editingItem?.item_type || null,
    p_old_item_name: editingItem?.item_name || null,
    p_item_type: type,
    p_item_name: name,
    p_category: category,
    p_price: price,
    p_is_active: isActive,
    p_item_data: { groups, recommended: isRecommended },
    p_is_custom: editingItem ? Boolean(editingItem.is_custom) : true,
    p_image_url: finalImageUrl
  });

  saveMenuEditorButton.disabled = false;
  saveMenuEditorButton.textContent = "บันทึกเมนู";

  if (error) {
    menuEditorError.textContent = "บันทึกไม่สำเร็จ: " + error.message;
    return;
  }

  closeMenuEditor();
  await loadSettings();
  alert(editingItem ? "แก้ไขเมนูเรียบร้อย" : "เพิ่มเมนูใหม่เรียบร้อย");
});

deleteCustomMenuButton.addEventListener("click", async () => {
  if (!editingItem?.is_custom) return;

  if (!confirm(`ยืนยันลบเมนู “${editingItem.item_name}” หรือไม่?`)) return;

  const pin = await requestManagerPin("ยืนยันลบเมนู");
  if (!pin) return;

  deleteCustomMenuButton.disabled = true;
  deleteCustomMenuButton.textContent = "กำลังลบ...";

  const { error } = await sb.rpc("manager_delete_custom_menu", {
    p_pin: pin,
    p_item_type: editingItem.item_type,
    p_item_name: editingItem.item_name
  });

  deleteCustomMenuButton.disabled = false;
  deleteCustomMenuButton.textContent = "ลบเมนู";

  if (error) {
    menuEditorError.textContent = "ลบเมนูไม่สำเร็จ: " + error.message;
    return;
  }

  closeMenuEditor();
  await loadSettings();
  alert("ลบเมนูเรียบร้อย");
});

saveMenuSettingsButton.addEventListener("click", async () => {
  if (!dirty) return;

  const pin = await requestManagerPin("ยืนยันบันทึกราคาและสถานะขาย");
  if (!pin) return;

  const changedItems = items.filter(item => {
    const original = originalItems.find(old => itemKey(old) === itemKey(item));
    return !original ||
      Number(original.price) !== Number(item.price) ||
      Boolean(original.is_active) !== Boolean(item.is_active);
  });

  saveMenuSettingsButton.disabled = true;
  saveMenuSettingsButton.textContent = "กำลังบันทึก...";

  const { data, error } = await sb.rpc("manager_save_menu_settings", {
    p_pin: pin,
    p_items: changedItems
  });

  saveMenuSettingsButton.textContent = "บันทึกการเปลี่ยนแปลง";

  if (error) {
    saveMenuSettingsButton.disabled = false;
    alert("บันทึกเมนูไม่สำเร็จ: " + error.message);
    return;
  }

  originalItems = cloneItems(items);
  setDirty(false);
  alert(`บันทึกเรียบร้อย ${Number(data || changedItems.length)} รายการ`);
});

editorImageFile.addEventListener("change", () => {
  const file = editorImageFile.files?.[0] || null;
  menuEditorError.textContent = "";

  if (!file) return;

  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    menuEditorError.textContent = "รองรับเฉพาะ JPG, PNG และ WebP";
    editorImageFile.value = "";
    return;
  }

  if (file.size > 10 * 1024 * 1024) {
    menuEditorError.textContent = "รูปมีขนาดเกิน 10 MB";
    editorImageFile.value = "";
    return;
  }

  pendingImageFile = file;
  removeCurrentImage = false;

  const objectUrl = URL.createObjectURL(file);
  updateImagePreview(objectUrl);
});

removeEditorImageButton.addEventListener("click", () => {
  pendingImageFile = null;
  removeCurrentImage = true;
  editorImageFile.value = "";
  updateImagePreview(null);
});

addMenuButton.addEventListener("click", () => openMenuEditor());
closeMenuEditorButton.addEventListener("click", closeMenuEditor);
menuEditorModal.querySelector("[data-close-menu-editor]")
  .addEventListener("click", closeMenuEditor);
editorItemType.addEventListener("change", updateEditorTypeUI);
editorCategory.addEventListener("change", applySuggestedOptionsForCategory);

menuSettingsSearch.addEventListener("input", renderItems);
menuSettingsCategory.addEventListener("change", renderItems);

window.addEventListener("manager-unlocked", loadSettings);

window.addEventListener("beforeunload", event => {
  if (!dirty) return;
  event.preventDefault();
  event.returnValue = "";
});
