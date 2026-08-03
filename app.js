const sb=supabase.createClient(APP_CONFIG.SUPABASE_URL,APP_CONFIG.SUPABASE_ANON_KEY);
let db={products:[],addons:[]},cat="ทั้งหมด",cart=[],current=null,editIndex=null,qty=1,currentAddon=null;
const $=id=>document.getElementById(id),tableNo=new URLSearchParams(location.search).get("table")||"counter";

$("table").textContent=tableNo==="counter"?"สั่งที่เคาน์เตอร์ / กลับบ้าน":`โต๊ะ ${tableNo}`;
$("customer").value=localStorage.getItem("356_customer_name")||"";

function setImageState(imageEl, placeholderEl, url){
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

function calculateStoreStatus(settings){
  if(settings.accepting_orders===false){
    return {open:false,text:"ปิดรับออเดอร์ชั่วคราว"};
  }

  const now=new Date();
  const bangkokTime=new Intl.DateTimeFormat("en-GB",{
    timeZone:"Asia/Bangkok",
    hour:"2-digit",
    minute:"2-digit",
    hour12:false
  }).format(now);

  const openTime=settings.open_time||"09:00";
  const closeTime=settings.close_time||"16:00";
  const open=bangkokTime>=openTime&&bangkokTime<closeTime;

  return {
    open,
    text:open?"เปิดรับออเดอร์":"ปิดร้าน"
  };
}

async function loadStoreSettings(){
  const {data,error}=await sb
    .from("store_settings")
    .select("*")
    .eq("id",1)
    .maybeSingle();

  if(error){
    console.warn("โหลดข้อมูลหน้าร้านไม่สำเร็จ",error);
    return;
  }

  const settings=data||{};
  $("storeName").textContent=settings.store_name||"356 Coffee & Drink";
  $("storeDescription").textContent=
    settings.description||"เครื่องดื่มและขนมจากร้าน 356";

  const openTime=settings.open_time||"09:00";
  const closeTime=settings.close_time||"16:00";
  $("storeHours").textContent=`${openTime}–${closeTime}`;

  setImageState(
    $("storeCoverImage"),
    $("storeCoverPlaceholder"),
    settings.cover_url
  );

  setImageState(
    $("storeLogoImage"),
    $("storeLogoPlaceholder"),
    settings.logo_url
  );

  const status=calculateStoreStatus(settings);
  $("storeStatusBadge").textContent=status.text;
  $("storeStatusBadge").classList.toggle("closed",!status.open);
}

async function loadMenu(){
  try{
    const response=await fetch("menu.json",{cache:"no-store"});
    if(!response.ok) throw new Error("โหลดเมนูไม่สำเร็จ");

    db=await response.json();

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
                image_url:setting.image_url||addon.image_url||null
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
                image_url:setting.image_url||product.image_url||null
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

    renderTabs();
    renderMenu();
  }catch(error){
    $("menu").innerHTML=`<p>${error.message}</p>`;
  }
}

loadStoreSettings();
loadMenu();

function renderTabs(){
  const cats=["ทั้งหมด",...new Set(db.products.filter(x=>x.is_active!==false).map(x=>x.category)),"ADD-ON"];
  $("tabs").innerHTML="";
  cats.forEach(c=>{
    const b=document.createElement("button");
    b.textContent=c;
    b.className=c===cat?"active":"";
    b.onclick=()=>{cat=c;renderTabs();renderMenu()};
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
          ? `<img class="menu-card-image" src="${a.image_url}" alt="${a.name}" loading="lazy">`
          : `<div class="menu-card-placeholder">356</div>`}
        <div class="name">${a.name}</div>
        <div class="price">+฿${a.price}</div>
        <button>เพิ่ม</button>
      `;
      d.onclick=()=>openAddon(a);
      $("menu").appendChild(d);
    });
    return;
  }

  db.products
    .filter(x=>x.is_active!==false&&(cat==="ทั้งหมด"||x.category===cat))
    .forEach(p=>{
      const d=document.createElement("div");
      d.className="card";
      d.innerHTML=`
        ${p.image_url
          ? `<img class="menu-card-image" src="${p.image_url}" alt="${p.name}" loading="lazy">`
          : `<div class="menu-card-placeholder">356</div>`}
        <div class="name">${p.name}</div>
        <div class="price">฿${p.price}</div>
        <button>เลือกเมนู</button>
      `;
      d.onclick=()=>openProduct(p);
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
  current=p;
  editIndex=i;
  qty=i===null?1:cart[i].qty;
  $("qtyValue").textContent=qty;
  $("pname").textContent=p.name;

  const old=i===null?[]:cart[i].options;
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

  const item={
    product:current,
    name:current.name,
    qty,
    unit:current.price+extra,
    options
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
