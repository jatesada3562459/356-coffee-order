const sb=supabase.createClient(APP_CONFIG.SUPABASE_URL,APP_CONFIG.SUPABASE_ANON_KEY);
let db={products:[],addons:[]},cat="ทั้งหมด",cart=[],current=null,editIndex=null,qty=1,currentAddon=null;
let menuCategories356=[];
let storeOpen356=false;
let storeStatusReason356="checking";
let lastStoreSettings356=null;
const $=id=>document.getElementById(id),tableNo=new URLSearchParams(location.search).get("table")||"counter";

$("table").textContent=tableNo==="counter"?"สั่งที่เคาน์เตอร์ / กลับบ้าน":`โต๊ะ ${tableNo}`;
$("customer").value=localStorage.getItem("356_customer_name")||"";

function setImageState(imageEl, placeholderEl, url){
  imageEl.onerror=null;

  if(url){
    const separator=url.includes("?")?"&":"?";
    imageEl.src=`${url}${separator}v=${Date.now()}`;
    imageEl.classList.remove("hidden");
    placeholderEl.classList.add("hidden");

    imageEl.onerror=()=>{
      imageEl.classList.add("hidden");
      placeholderEl.classList.remove("hidden");
    };
  }else{
    imageEl.removeAttribute("src");
    imageEl.classList.add("hidden");
    placeholderEl.classList.remove("hidden");
  }
}

function bangkokNow356(){
  const parts=new Intl.DateTimeFormat("en-CA",{
    timeZone:"Asia/Bangkok",year:"numeric",month:"2-digit",day:"2-digit",
    hour:"2-digit",minute:"2-digit",hour12:false
  }).formatToParts(new Date()).reduce((a,p)=>{a[p.type]=p.value;return a;},{});
  return {date:`${parts.year}-${parts.month}-${parts.day}`,time:`${parts.hour}:${parts.minute}`};
}

function bangkokWeekday356(){
  const short=new Intl.DateTimeFormat("en-US",{
    timeZone:"Asia/Bangkok",weekday:"short"
  }).format(new Date());
  return ({Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6})[short] ?? 0;
}

async function loadTodayWeeklyHours356(){
  const day=bangkokWeekday356();
  try{
    const url=
      `${APP_CONFIG.SUPABASE_URL.replace(/\/$/,"")}/rest/v1/store_weekly_hours`+
      `?select=day_of_week,is_open,open_time,close_time&day_of_week=eq.${day}&limit=1`;

    const res=await fetch(url,{
      method:"GET",
      cache:"no-store",
      headers:{
        "apikey":APP_CONFIG.SUPABASE_ANON_KEY,
        "Authorization":"Bearer "+APP_CONFIG.SUPABASE_ANON_KEY,
        "Accept":"application/json"
      }
    });

    if(!res.ok){
      console.warn("โหลดตารางเวลาร้านไม่สำเร็จ",res.status,await res.text());
      return null;
    }

    const rows=await res.json();
    return Array.isArray(rows)&&rows.length?rows[0]:null;
  }catch(err){
    console.warn("โหลดตารางเวลาร้านไม่สำเร็จ",err);
    return null;
  }
}

function calculateStoreStatus(settings,weekly=null){
  // accepting_orders=false ใช้เฉพาะเป็นการหยุดรับออเดอร์ฉุกเฉิน
  // แต่ accepting_orders=true ไม่มีสิทธิ์เปิดร้านนอกตาราง
  if(settings.accepting_orders===false){
    return {open:false,text:"ปิดรับออเดอร์ชั่วคราว",reason:"paused"};
  }

  if(!weekly){
    return {open:false,text:"ปิดร้าน",reason:"schedule_missing"};
  }

  if(weekly.is_open===false){
    return {open:false,text:"ปิดทั้งวัน",reason:"weekly_closed",weekly};
  }

  const now=bangkokNow356();
  const openTime=String(weekly.open_time||"10:00").slice(0,5);
  const closeTime=String(weekly.close_time||"15:00").slice(0,5);

  let open=false;
  if(openTime===closeTime){
    open=true;
  }else if(openTime<closeTime){
    open=now.time>=openTime && now.time<closeTime;
  }else{
    // รองรับเวลาข้ามเที่ยงคืน
    open=now.time>=openTime || now.time<closeTime;
  }

  return {
    open,
    text:open?"เปิดรับออเดอร์":"ปิดร้าน",
    reason:open?"schedule_open":"schedule_closed",
    weekly
  };
}

function storeHoursMessage356(){
  const weekly=lastStoreSettings356?.weekly_hours;
  if(!weekly || weekly.is_open===false) return "วันนี้ปิด";
  const openTime=String(weekly.open_time||"10:00").slice(0,5);
  const closeTime=String(weekly.close_time||"15:00").slice(0,5);
  return `${openTime} ถึง ${closeTime}`;
}

function closedMessage356(){
  if(storeStatusReason356==="paused") return "ร้านหยุดรับออเดอร์ชั่วคราว";
  if(storeStatusReason356==="weekly_closed") return "วันนี้ร้านปิดทั้งวัน";
  return `ร้านปิด จะเปิดในวันถัดไปเวลา ${storeHoursMessage356()}`;
}

function ensureStoreOpen356(){
  if(storeOpen356) return true;
  alert(closedMessage356());
  return false;
}

function applyStoreLock356(status){
  storeOpen356=Boolean(status&&status.open);
  storeStatusReason356=status?.reason||"closed";
  document.body.classList.toggle("store-closed-356",!storeOpen356);

  let banner=document.getElementById("storeClosedBanner356");
  if(!banner){
    banner=document.createElement("div");
    banner.id="storeClosedBanner356";
    banner.style.cssText="margin:12px 0;padding:12px 14px;border-radius:12px;background:#fff3f3;border:1px solid #efb4b4;color:#9b1c1c;font-weight:700;text-align:center;display:none";
    const hero=document.querySelector(".store-hero");
    if(hero) hero.appendChild(banner);
  }
  if(!storeOpen356){
    banner.textContent=storeStatusReason356==="paused"
      ? "ร้านหยุดรับออเดอร์ชั่วคราว"
      : storeStatusReason356==="weekly_closed"
        ? "วันนี้ร้านปิดทั้งวัน"
        : `ร้านปิด — เวลาทำการวันนี้ ${storeHoursMessage356()}`;
    banner.style.display="block";
  }else{
    banner.style.display="none";
  }

  document.querySelectorAll("#menu .card button,#saveBtn,#cart .primary").forEach(btn=>{
    btn.disabled=!storeOpen356;
    btn.style.opacity=storeOpen356?"":"0.45";
    btn.style.cursor=storeOpen356?"":"not-allowed";
  });
}

async function loadStoreSettings(){
  const {data,error}=await sb
    .from("store_settings")
    .select("*")
    .eq("id",1)
    .maybeSingle();

  if(error){
    console.warn("โหลดข้อมูลหน้าร้านไม่สำเร็จ ใช้เวลาร้านมาตรฐานแทน",error);
    const fallback={open_time:"09:00",close_time:"16:00",accepting_orders:true,manual_override:"auto"};
    lastStoreSettings356=fallback;
    const status=calculateStoreStatus(fallback);
    $("storeStatusBadge").textContent=status.text;
    $("storeStatusBadge").classList.toggle("closed",!status.open);
    $("storeHours").textContent="09:00–16:00";
    applyStoreLock356(status);
    return;
  }

  const settings=data||{};
  lastStoreSettings356=settings;

  const weekly356=await loadTodayWeeklyHours356();
  settings.weekly_hours=weekly356;
  $("storeName").textContent=settings.store_name||"356 Coffee & Drink";
  $("storeDescription").textContent=
    settings.description||"เครื่องดื่มและขนมจากร้าน 356";

  if(weekly356 && weekly356.is_open!==false){
    const openTime=String(weekly356.open_time||"10:00").slice(0,5);
    const closeTime=String(weekly356.close_time||"15:00").slice(0,5);
    $("storeHours").textContent=`${openTime}–${closeTime}`;
  }else{
    $("storeHours").textContent="ปิดวันนี้";
  }

  setImageState(
    $("storeCoverImage"),
    $("storeCoverPlaceholder"),
    settings.cover_url
  );

  const logoUrl=settings.logo_url||null;
  const logoWrap=$("storeLogoWrap");
  const logoImage=$("storeLogoImage");
  const logoPlaceholder=$("storeLogoPlaceholder");

  if(logoUrl){
    const separator=logoUrl.includes("?")?"&":"?";
    const freshLogoUrl=`${logoUrl}${separator}v=${Date.now()}`;

    logoWrap.style.backgroundImage=`url("${freshLogoUrl}")`;
    logoWrap.style.backgroundSize="cover";
    logoWrap.style.backgroundPosition="center";
    logoWrap.style.backgroundRepeat="no-repeat";

    logoPlaceholder.style.display="none";
    logoPlaceholder.classList.add("hidden");

    logoImage.src=freshLogoUrl;
    logoImage.style.display="block";
    logoImage.classList.remove("hidden");

    logoImage.onerror=()=>{
      logoImage.style.display="none";
      logoImage.classList.add("hidden");
      logoPlaceholder.style.display="none";
    };
  }else{
    logoWrap.style.backgroundImage="none";
    logoImage.removeAttribute("src");
    logoImage.style.display="none";
    logoImage.classList.add("hidden");
    logoPlaceholder.style.display="flex";
    logoPlaceholder.classList.remove("hidden");
  }

  const status=calculateStoreStatus(settings,weekly356||null);
  $("storeStatusBadge").textContent=status.text;
  $("storeStatusBadge").classList.toggle("closed",!status.open);
  applyStoreLock356(status);
}

async function loadMenu(){
  try{
    const response=await fetch("menu.json",{cache:"no-store"});
    if(!response.ok) throw new Error("โหลดเมนูไม่สำเร็จ");

    db=await response.json();

    // แสดงเมนูพื้นฐานทันที ไม่ต้องรอ Supabase
    renderTabs();
    renderMenu();

    // โหลดข้อมูลเมนูก่อน เพื่อให้ราคา/รูปแสดงทันที ไม่ต้องรอข้อมูลหมวดหมู่
    const {data:settings,error}=await sb
      .from("menu_settings")
      .select("item_type,item_name,category,price,is_active,is_custom,item_data,image_url");

    if(error){
      console.warn("โหลดการตั้งค่าเมนูไม่สำเร็จ ใช้ราคาในไฟล์เดิมแทน",error);
    }else{
      const settingMap=new Map(
        (settings||[]).map(item=>[
          `${item.item_type}:${item.item_name}`,
          item
        ])
      );

      db.products=db.products
        .map(product=>{
          const setting=settingMap.get(`product:${product.name}`);
          return setting
            ? {
                ...product,
                ...(setting.item_data||{}),
                category:setting.category||product.category,
                price:Number(setting.price),
                is_active:setting.is_active,
                is_custom:Boolean(setting.is_custom),
                image_url:setting.image_url||product.image_url||null
              }
            : {...product,is_active:true,is_custom:false,image_url:product.image_url||null};
        });

      db.addons=db.addons
        .map(addon=>{
          const setting=settingMap.get(`addon:${addon.name}`);
          return setting
            ? {
                ...addon,
                ...(setting.item_data||{}),
                price:Number(setting.price),
                is_active:setting.is_active,
                is_custom:Boolean(setting.is_custom),
                image_url:setting.image_url||addon.image_url||null
              }
            : {...addon,is_active:true,is_custom:false,image_url:addon.image_url||null};
        });

      const customProducts=(settings||[])
        .filter(item=>item.item_type==="product"&&item.is_custom)
        .filter(item=>!db.products.some(product=>product.name===item.item_name))
        .map(item=>({
          name:item.item_name,
          category:item.category||"อื่น ๆ",
          price:Number(item.price),
          groups:Array.isArray(item.item_data?.groups)?item.item_data.groups:[],
          recommended:Boolean(item.item_data?.recommended),
          is_active:item.is_active,
          is_custom:true,
          image_url:item.image_url||null
        }));

      const customAddons=(settings||[])
        .filter(item=>item.item_type==="addon"&&item.is_custom)
        .filter(item=>!db.addons.some(addon=>addon.name===item.item_name))
        .map(item=>({
          name:item.item_name,
          price:Number(item.price),
          is_active:item.is_active,
          is_custom:true,
          image_url:item.image_url||null
        }));

      db.products.push(...customProducts);
      db.addons.push(...customAddons);
    }

    // ตอนนี้ข้อมูลรูป/ราคาได้แล้ว แสดงก่อนทันที
    renderTabs();
    renderMenu();

    // โหลดหมวดหมู่แยกภายหลัง เพื่อไม่ให้การโหลดหมวดใหม่ทำให้รูปเมนูหาย/ค้าง
    const {data:categoryRows,error:categoryError}=await sb
      .from("menu_categories")
      .select("category_key,display_name,sort_order,is_active")
      .order("sort_order",{ascending:true});

    if(categoryError){
      console.warn("โหลดการจัดการหมวดหมู่ไม่สำเร็จ ใช้หมวดจากเมนูเดิมแทน",categoryError);
      menuCategories356=[];
    }else{
      menuCategories356=categoryRows||[];
    }

    // Step 16.5.4.2:
    // ให้หมวด “ซิกเนเจอร์” แสดงบนหน้าลูกค้าได้ทันที
    // แม้หมวดนี้ยังไม่มีเมนูอยู่ข้างใน
    if(!menuCategories356.some(c=>c.category_key==="ซิกเนเจอร์")){
      menuCategories356.push({
        category_key:"ซิกเนเจอร์",
        display_name:"ซิกเนเจอร์",
        sort_order:5,
        is_active:true
      });
    }

    renderTabs();
    renderMenu();
  }catch(error){
    $("menu").innerHTML=`<p>${error.message}</p>`;
  }
}

loadStoreSettings();
loadMenu();
setInterval(loadStoreSettings,10000);

function visibleCategoryKeys356(){
  if(!menuCategories356.length) return null;
  return new Set(menuCategories356.filter(c=>c.is_active!==false).map(c=>c.category_key));
}

function renderTabs(){
  let cats;
  if(menuCategories356.length){
    cats=[
      {key:"ทั้งหมด",label:"ทั้งหมด"},
      {key:"แนะนำ",label:"แนะนำ"},
      ...menuCategories356
        .filter(c=>c.is_active!==false)
        .sort((a,b)=>Number(a.sort_order||0)-Number(b.sort_order||0))
        .map(c=>({key:c.category_key,label:c.display_name})),
      {key:"ADD-ON",label:"ADD-ON"}
    ];
  }else{
    cats=[
      {key:"ทั้งหมด",label:"ทั้งหมด"},
      {key:"แนะนำ",label:"แนะนำ"},
      ...[...new Set(db.products.filter(x=>x.is_active!==false).map(x=>x.category))].map(x=>({key:x,label:x})),
      {key:"ADD-ON",label:"ADD-ON"}
    ];
  }

  // กันชื่อซ้ำ เช่น มีหมวดชื่อ “แนะนำ” หรือ ADD-ON อยู่ในฐานข้อมูล
  const seen=new Set();
  cats=cats.filter(c=>{
    if(seen.has(c.key)) return false;
    seen.add(c.key);
    return true;
  });

  if(cat!=="ทั้งหมด"&&!cats.some(c=>c.key===cat)) cat="ทั้งหมด";
  $("tabs").innerHTML="";
  cats.forEach(c=>{
    const b=document.createElement("button");
    b.textContent=c.label;
    b.className=c.key===cat?"active":"";
    b.onclick=()=>{cat=c.key;renderTabs();renderMenu()};
    $("tabs").appendChild(b);
  });
}

function renderMenu(){
  $("menu").innerHTML="";
  if(cat==="ADD-ON"){
    db.addons.filter(a=>a.is_active!==false).forEach(a=>{
      const d=document.createElement("div");
      d.className="card";
      d.innerHTML=`
        ${a.image_url
          ? `<img class="menu-card-image" src="${a.image_url}" alt="${a.name}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div class="menu-card-placeholder" style="display:none">356</div>`
          : `<div class="menu-card-placeholder">356</div>`}
        <div class="name">${a.name}</div>
        <div class="price">+฿${a.price}</div>
        <button>เพิ่ม</button>
      `;
      d.onclick=()=>{if(ensureStoreOpen356()) openAddon(a)};
      $("menu").appendChild(d);
    });
    return;
  }

  db.products
    .filter(x=>{const visible=visibleCategoryKeys356(); return x.is_active!==false && (!visible || visible.has(x.category)) && (cat==="ทั้งหมด"||(cat==="แนะนำ"&&x.recommended===true)||x.category===cat)})
    .forEach(p=>{
      const d=document.createElement("div");
      d.className="card";
      d.innerHTML=`
        ${p.image_url
          ? `<img class="menu-card-image" src="${p.image_url}" alt="${p.name}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div class="menu-card-placeholder" style="display:none">356</div>`
          : `<div class="menu-card-placeholder">356</div>`}
        <div class="name">${p.name}</div>
        <div class="price">฿${p.price}</div>
        <button>เลือกเมนู</button>
      `;
      d.onclick=()=>{if(ensureStoreOpen356()) openProduct(p)};
      $("menu").appendChild(d);
    });
}

function radios(title,name,opts,selected){
  return `<h3>${title}</h3>`+
    opts.map(o=>`<label><input type="radio" name="${name}" value="${o.value}" data-price="${o.price||0}" ${o.value===selected?"checked":""}> ${o.label}</label>`).join("");
}

function checks(title,name,opts,selected){
  return `<h3>${title}</h3>`+
    opts.map(o=>`<label><input type="checkbox" name="${name}" value="${o.name}" data-price="${o.price}" ${selected.includes(o.name)?"checked":""}> ${o.name} +${o.price}</label>`).join("");
}

function openProduct(p,i=null){
  if(!ensureStoreOpen356()) return;
  current=p;
  editIndex=i;
  qty=i===null?1:cart[i].qty;
  $("qtyValue").textContent=qty;
  $("pname").textContent=p.name;

  const old=i===null?[]:cart[i].options;
  const oldNote=i===null?"":(cart[i].note||"");
  let h="";

  if(p.groups.includes("sweet")){
    const values=["ไม่หวาน","หวานน้อย","ปกติ","เพิ่มหวาน"];
    h+=radios("ความหวาน","sweet",values.map(v=>({label:v,value:v,price:0})),old.find(x=>values.includes(x))||"ปกติ");
  }

  if(p.groups.includes("sweet_no_zero")){
    const values=["หวานน้อย","ปกติ","เพิ่มหวาน"];
    h+=radios("ความหวาน","sweet",values.map(v=>({label:v,value:v,price:0})),old.find(x=>values.includes(x))||"ปกติ");
  }

  if(p.groups.includes("milk")){
    const values=["นมสด","นมโอ๊ต"];
    h+=radios("ชนิดนม","milk",values.map(v=>({label:v,value:v,price:0})),old.find(x=>values.includes(x))||"นมสด");
  }

  if(p.groups.includes("yogurt")){
    const yogurtSelected=old.includes("ใส่โยเกิร์ต")?"ใส่โยเกิร์ต":"ไม่ใส่โยเกิร์ต";
    h+=radios("โยเกิร์ต","yogurt",[
      {label:"ไม่ใส่โยเกิร์ต",value:"ไม่ใส่โยเกิร์ต",price:0},
      {label:"ใส่โยเกิร์ต +10 บาท",value:"ใส่โยเกิร์ต",price:10}
    ],yogurtSelected);
  }

  if(p.groups.includes("extras_all")){
    h+=checks("เพิ่มเติม","extra",[
      {name:"ปั่น",price:10},
      {name:"ไข่มุกบุก",price:10},
      {name:"ปีโป้",price:10},
      {name:"โยเกิร์ต",price:10},
      {name:"ครีมชีส",price:15}
    ],old);
  }

  if(p.groups.includes("extras_no_blend")){
    h+=checks("เพิ่มเติม","extra",[
      {name:"ไข่มุกบุก",price:10},
      {name:"ปีโป้",price:10},
      {name:"โยเกิร์ต",price:10},
      {name:"ครีมชีส",price:15}
    ],old);
  }

  if(p.groups.includes("extras_soda")){
    h+=checks("เพิ่มเติม","extra",[
      {name:"ไข่มุกบุก",price:10},
      {name:"ปีโป้",price:10},
      {name:"ครีมชีส",price:15}
    ],old);
  }

  if(p.groups.includes("size")){
    h+=checks("ขนาดแก้ว","size",[
      {name:"อัปไซส์แก้วใหญ่",price:10}
    ],old);
  }

  if(!h) h="<p>เมนูนี้ไม่มีตัวเลือกเพิ่มเติม</p>";

  h+=`<h3>หมายเหตุ (ไม่บังคับ)</h3><textarea id="itemNote356" maxlength="150" rows="3" placeholder="เช่น ไม่ใส่น้ำแข็ง / แยกครีมชีส / อื่น ๆ" style="width:100%;box-sizing:border-box;padding:12px;border:1px solid #ddd;border-radius:12px;font:inherit;resize:vertical">${oldNote.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}</textarea>`;
  $("modifierArea").innerHTML=h;
  $("saveBtn").textContent=i===null?"เพิ่มลงตะกร้า":"บันทึกการแก้ไข";
  $("product").classList.add("show");
}

function closeProduct(){$("product").classList.remove("show")}

function changeQty(n){
  qty=Math.max(1,Math.min(20,qty+n));
  $("qtyValue").textContent=qty;
}

function saveProduct(){
  if(!ensureStoreOpen356()) return;
  let options=[],extra=0;

  ["sweet","milk","yogurt"].forEach(name=>{
    const e=document.querySelector(`input[name="${name}"]:checked`);
    if(e){
      options.push(e.value);
      extra+=Number(e.dataset.price||0);
    }
  });

  document.querySelectorAll('input[name="extra"]:checked,input[name="size"]:checked').forEach(e=>{
    options.push(e.value);
    extra+=Number(e.dataset.price||0);
  });

  const noteEl=$("itemNote356");
  const note=noteEl?noteEl.value.trim().slice(0,150):"";
  const item={
    product:current,
    name:current.name,
    qty,
    unit:current.price+extra,
    options,
    note
  };

  if(editIndex===null) cart.push(item);
  else cart[editIndex]=item;

  closeProduct();
  renderCart();
}

function renderCart(){
  $("count").textContent=cart.reduce((s,x)=>s+x.qty,0);
  $("items").innerHTML="";

  cart.forEach((x,i)=>{
    const d=document.createElement("div");
    d.className="row";
    d.innerHTML=`
      <b>${x.name} × ${x.qty}</b>
      <div class="muted">${x.options.join(" • ")||"ไม่มีตัวเลือกเพิ่มเติม"}</div>
      ${x.note?`<div class="muted"><b>หมายเหตุ:</b> ${x.note}</div>`:""}
      <div>฿${x.unit*x.qty}</div>
      <div class="actions">
        <button class="edit">แก้ไข</button>
        <button class="remove">ลบ</button>
      </div>`;

    d.querySelector(".edit").onclick=()=>{
      closeCart();
      openProduct(x.product,i);
    };

    d.querySelector(".remove").onclick=()=>{
      cart.splice(i,1);
      renderCart();
    };

    $("items").appendChild(d);
  });

  $("total").textContent="รวม ฿"+cart.reduce((s,x)=>s+x.unit*x.qty,0);
}

function openCart(){renderCart();$("cart").classList.add("show")}
function closeCart(){$("cart").classList.remove("show")}

function openAddon(a){
  if(!ensureStoreOpen356()) return;
  currentAddon=a;

  if(!cart.length){
    alert("กรุณาเลือกเมนูหลักก่อน");
    return;
  }

  if(cart.length===1){
    applyAddon(0);
    return;
  }

  $("addonTitle").textContent=`เพิ่ม ${a.name} +${a.price}`;
  $("addonTargets").innerHTML="";

  cart.forEach((x,i)=>{
    const b=document.createElement("button");
    b.className="row";
    b.style.width="100%";
    b.textContent=`${x.name} × ${x.qty}`;
    b.onclick=()=>applyAddon(i);
    $("addonTargets").appendChild(b);
  });

  $("addonPanel").classList.add("show");
}

function closeAddon(){$("addonPanel").classList.remove("show")}

function applyAddon(i){
  cart[i].options.push(currentAddon.name);
  cart[i].unit+=currentAddon.price;
  closeAddon();
  alert(`เพิ่ม ${currentAddon.name} ให้ ${cart[i].name} แล้ว`);
  renderCart();
}

async function submitOrder(){
  await loadStoreSettings();
  if(!ensureStoreOpen356()) return;
  if(!cart.length){
    alert("กรุณาเลือกสินค้า");
    return;
  }

  const customer_name=$("customer").value.trim()||null;
  if(customer_name) localStorage.setItem("356_customer_name",customer_name);

  const id=crypto.randomUUID();
  const order_no="356-"+Date.now().toString().slice(-8);
  const payment_method=document.querySelector('input[name="pay"]:checked').value;
  const total=cart.reduce((s,x)=>s+x.unit*x.qty,0);

  const {error}=await sb.from("orders").insert({
    id,
    order_no,
    table_no:tableNo,
    customer_name,
    payment_method,
    total
  });

  if(error){
    alert("ส่งออร์เดอร์ไม่สำเร็จ: "+error.message);
    return;
  }

  const rows=cart.map(x=>({
    order_id:id,
    product_name:x.name,
    quantity:x.qty,
    unit_price:x.unit,
    options:x.options,
    line_total:x.unit*x.qty
  }));

  const result=await sb.from("order_items").insert(rows);

  if(result.error){
    alert("บันทึกรายการสินค้าไม่สำเร็จ: "+result.error.message);
    return;
  }

  alert(`ส่งออร์เดอร์สำเร็จ\nเลขที่ ${order_no}\nยอดรวม ฿${total}`);
  cart=[];
  renderCart();
  closeCart();
}

window.ensureStoreOpen356=ensureStoreOpen356;
window.applyStoreLock356=applyStoreLock356;
