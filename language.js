/* 356 Coffee & Drink - Customer storefront Thai / English display layer
   IMPORTANT: This file changes DISPLAY TEXT only.
   Product names/options sent to Supabase remain the original Thai values,
   so Android/back-office/auto-print keep working in Thai. */

var currentLanguage356 = localStorage.getItem("356_customer_language") === "en" ? "en" : "th";
var storeDescriptionThai356 = "เครื่องดื่มและขนมจากร้าน 356";

const UI_TEXT_356 = {
  th: {
    cart:"ตะกร้า", back:"กลับ", quantity:"จำนวน", cartTitle:"ตะกร้า",
    customerName:"ชื่อลูกค้า", customerPlaceholder:"กรอกชื่อลูกค้า",
    payment:"ชำระเงิน", payCounter:"จ่ายที่เคาน์เตอร์", promptPay:"พร้อมเพย์",
    submitOrder:"ยืนยันออร์เดอร์", all:"ทั้งหมด", addOns:"ADD-ON",
    add:"เพิ่ม", selectMenu:"เลือกเมนู", sweetness:"ความหวาน", milkType:"ชนิดนม",
    yogurt:"โยเกิร์ต", extras:"เพิ่มเติม", cupSize:"ขนาดแก้ว",
    noOptions:"เมนูนี้ไม่มีตัวเลือกเพิ่มเติม", addToCart:"เพิ่มลงตะกร้า",
    saveChanges:"บันทึกการแก้ไข", edit:"แก้ไข", remove:"ลบ", total:"รวม",
    chooseMainFirst:"กรุณาเลือกเมนูหลักก่อน", chooseItem:"กรุณาเลือกสินค้า",
    storeOpen:"เปิดรับออเดอร์", storeClosed:"ปิดร้าน", storePaused:"ปิดรับออเดอร์ชั่วคราว",
    checkingStore:"กำลังตรวจสอบสถานะร้าน", counterTakeaway:"สั่งที่เคาน์เตอร์ / กลับบ้าน",
    table:"โต๊ะ", defaultDescription:"เครื่องดื่มและขนมจากร้าน 356",
    addPrefix:"เพิ่ม", to:"ให้", added:"แล้ว", orderFailed:"ส่งออร์เดอร์ไม่สำเร็จ",
    itemSaveFailed:"บันทึกรายการสินค้าไม่สำเร็จ", orderSuccess:"ส่งออร์เดอร์สำเร็จ",
    orderNumber:"เลขที่", totalAmount:"ยอดรวม", menuLoadFailed:"โหลดเมนูไม่สำเร็จ",
    noSelectedOptions:"ไม่มีตัวเลือกเพิ่มเติม", itemNote:"หมายเหตุ (ไม่บังคับ)", itemNotePlaceholder:"เช่น ไม่ใส่น้ำแข็ง / แยกครีมชีส / อื่น ๆ", noteLabel:"หมายเหตุ"
  },
  en: {
    cart:"Cart", back:"Back", quantity:"Quantity", cartTitle:"Cart",
    customerName:"Customer name", customerPlaceholder:"Enter customer name",
    payment:"Payment", payCounter:"Pay at Counter / Cash", promptPay:"PromptPay",
    submitOrder:"Place Order", all:"All", addOns:"Add-ons",
    add:"Add", selectMenu:"Select", sweetness:"Sweetness", milkType:"Milk",
    yogurt:"Yogurt", extras:"Add-ons", cupSize:"Cup Size",
    noOptions:"No additional options for this item", addToCart:"Add to Cart",
    saveChanges:"Save Changes", edit:"Edit", remove:"Remove", total:"Total",
    chooseMainFirst:"Please select a drink or food item first", chooseItem:"Please select an item",
    storeOpen:"Open for Orders", storeClosed:"Closed", storePaused:"Orders Temporarily Paused",
    checkingStore:"Checking store status", counterTakeaway:"Order at Counter / Takeaway",
    table:"Table", defaultDescription:"Drinks and snacks from 356 Coffee & Drink",
    addPrefix:"Add", to:"to", added:"added", orderFailed:"Order could not be sent",
    itemSaveFailed:"Could not save order items", orderSuccess:"Order placed successfully",
    orderNumber:"Order No.", totalAmount:"Total", menuLoadFailed:"Could not load menu",
    noSelectedOptions:"No additional options", itemNote:"Special request (optional)", itemNotePlaceholder:"e.g. No ice / Cream cheese on the side / Other request", noteLabel:"Special request"
  }
};

const CATEGORY_EN_356 = {
  "ทั้งหมด":"All",
  "กาแฟ":"Coffee",
  "ชา & นม":"Tea & Milk",
  "สมูทตี้":"Smoothies",
  "โซดา":"Soda",
  "ปังเย็น":"Shaved Ice",
  "ขนมปังปิ้ง":"Toast",
  "ADD-ON":"Add-ons",
  "อื่น ๆ":"Others",
  "ซิกเนเจอร์":"Signature"
};

const PRODUCT_EN_356 = {
  "เอสเพรสโซ่":"Espresso",
  "อเมริกาโน่":"Americano",
  "คาปูชิโน่":"Cappuccino",
  "มอคค่า":"Mocha",
  "ลาเต้":"Latte",
  "คาราเมลมัคคิอาโต":"Caramel Macchiato",
  "คาราเมลมัคคิอาโต้":"Caramel Macchiato",
  "คาราเมลมักคิอาโต้":"Caramel Macchiato",
  "คาราเมล มัคคิอาโต้":"Caramel Macchiato",
  "กาแฟส้ม":"Orange Coffee",
  "กาแฟมะพร้าว":"Coconut Coffee",
  "เนสกาแฟ":"Nescafe",

  "เฉาก๊วยนมสด":"Grass Jelly Fresh Milk",
  "นมสด":"Fresh Milk",
  "ชาไทย":"Thai Tea",
  "ชาเขียว":"Green Tea",
  "นมชมพู":"Pink Milk",
  "นมสดมิ้นท์":"Fresh Milk Mint",
  "นมสดมิ้นต์":"Fresh Milk Mint",
  "นมสดบราวน์ชูก้า":"Brown Sugar Fresh Milk",
  "นมสดบราวน์ชูการ์":"Brown Sugar Fresh Milk",
  "โกโก้":"Cocoa",
  "ดาร์กช็อกโกแลต":"Dark Chocolate",
  "โกโก้มิ้นท์":"Cocoa Mint",
  "โกโก้มิ้นต์":"Cocoa Mint",
  "นมสดคาราเมล":"Caramel Fresh Milk",
  "นมสดน้ำผึ้ง":"Honey Fresh Milk",
  "ชาพีช":"Peach Tea",
  "ชามะนาว":"Lemon Tea",
  "น้ำผึ้งมะนาว":"Honey Lemon",
  "ปีโป้นมสดปั่น":"Pipo Jelly Fresh Milk Shake",
  "นมสดโอริโอ้ปั่น":"Oreo Fresh Milk Shake",
  "นมสดโอรีโอ้ปั่น":"Oreo Fresh Milk Shake",
  "โกโก้โอริโอ้ปั่น":"Oreo Cocoa Shake",
  "โกโก้โอรีโอ้ปั่น":"Oreo Cocoa Shake",
  "กล้วยปั่นนมสดโอริโอ้":"Banana Oreo Fresh Milk Shake",
  "กล้วยปั่นนมสดโอรีโอ้":"Banana Oreo Fresh Milk Shake",
  "กล้วยปั่นโกโก้โอริโอ้":"Banana Oreo Cocoa Shake",
  "กล้วยปั่นโกโก้โอรีโอ้":"Banana Oreo Cocoa Shake",

  "มิกซ์เบอร์รี่ สมูทตี้":"Mixed Berry Smoothie",
  "มิกซ์เบอร์รี่สมูทตี้":"Mixed Berry Smoothie",
  "มะม่วง สมูทตี้":"Mango Smoothie",
  "มะม่วงสมูทตี้":"Mango Smoothie",
  "สตรอว์เบอร์รี่ สมูทตี้":"Strawberry Smoothie",
  "สตรอว์เบอร์รี่สมูทตี้":"Strawberry Smoothie",
  "สตรอว์เบอร์รี สมูทตี้":"Strawberry Smoothie",
  "สตรอว์เบอร์รีสมูทตี้":"Strawberry Smoothie",
  "กีวี่ สมูทตี้":"Kiwi Smoothie",
  "กีวี่สมูทตี้":"Kiwi Smoothie",
  "กีวี สมูทตี้":"Kiwi Smoothie",
  "กีวีสมูทตี้":"Kiwi Smoothie",
  "เสาวรส สมูทตี้":"Passion Fruit Smoothie",
  "เสาวรสสมูทตี้":"Passion Fruit Smoothie",
  "สับปะรด สมูทตี้":"Pineapple Smoothie",
  "สับปะรดสมูทตี้":"Pineapple Smoothie",
  "มะพร้าวนมสดสมูทตี้":"Coconut Fresh Milk Smoothie",
  "อาโวคาโดนมสดสมูทตี้":"Avocado Fresh Milk Smoothie",
  "แตงโมสมูทตี้":"Watermelon Smoothie",

  "สตรอว์เบอร์รีโซดา":"Strawberry Soda",
  "สตรอว์เบอร์รี่โซดา":"Strawberry Soda",
  "กีวี่โซดา":"Kiwi Soda",
  "กีวีโซดา":"Kiwi Soda",
  "เสาวรสโซดา":"Passion Fruit Soda",
  "บลูฮาวายโซดา":"Blue Hawaii Soda",
  "ลิ้นจี่โซดา":"Lychee Soda",
  "มะม่วงโซดา":"Mango Soda",
  "มะนาวโซดา":"Lime Soda",
  "แดงมะนาวโซดา":"Red Syrup Lime Soda",
  "ส้มโซดา":"Orange Soda",
  "โยเกิร์ตโซดา":"Yogurt Soda",
  "มะพร้าวโซดา":"Coconut Soda",

  "ปังเย็นนมสด":"Fresh Milk Shaved Ice",
  "ปังเย็นนมชมพู":"Pink Milk Shaved Ice",
  "ปังเย็นชาไทย":"Thai Tea Shaved Ice",
  "ปังเย็นชาเขียว":"Green Tea Shaved Ice",
  "ปังเย็นโกโก้":"Cocoa Shaved Ice",

  "เนยนม":"Butter Milk Toast",
  "เนยน้ำตาล":"Butter Sugar Toast",
  "เนยช็อกโกแลต":"Butter Chocolate Toast",
  "เนยคาราเมล":"Butter Caramel Toast"
};

const OPTION_EN_356 = {
  "ไม่หวาน":"No Sugar",
  "หวานน้อย":"Less Sweet",
  "ปกติ":"Regular Sweetness",
  "เพิ่มหวาน":"Extra Sweet",
  "นมสด":"Fresh Milk",
  "นมโอ๊ต":"Oat Milk",
  "ไม่ใส่โยเกิร์ต":"No Yogurt",
  "ใส่โยเกิร์ต":"Add Yogurt",
  "ปั่น":"Blended",
  "ไข่มุกบุก":"Konjac Boba",
  "ปีโป้":"Pipo Jelly",
  "โยเกิร์ต":"Yogurt",
  "ครีมชีส":"Cream Cheese",
  "ช็อตกาแฟ":"Extra Coffee Shot",
  "อัปไซส์แก้วใหญ่":"Large Size"
};

function tr356(key){
  return (UI_TEXT_356[currentLanguage356] && UI_TEXT_356[currentLanguage356][key]) || UI_TEXT_356.th[key] || key;
}

function displayCategory356(value){
  return currentLanguage356 === "en" ? (CATEGORY_EN_356[value] || value) : value;
}

function displayProduct356(value){
  return currentLanguage356 === "en" ? (PRODUCT_EN_356[value] || value) : value;
}

function displayOption356(value){
  return currentLanguage356 === "en" ? (OPTION_EN_356[value] || value) : value;
}

function setStaticLanguage356(){
  document.documentElement.lang = currentLanguage356;
  document.querySelectorAll("[data-i18n]").forEach(function(el){
    var key = el.getAttribute("data-i18n");
    if(UI_TEXT_356[currentLanguage356][key]) el.textContent = UI_TEXT_356[currentLanguage356][key];
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach(function(el){
    var key = el.getAttribute("data-i18n-placeholder");
    if(UI_TEXT_356[currentLanguage356][key]) el.setAttribute("placeholder", UI_TEXT_356[currentLanguage356][key]);
  });

  var thBtn = document.getElementById("langThBtn");
  var enBtn = document.getElementById("langEnBtn");
  if(thBtn) thBtn.classList.toggle("active", currentLanguage356 === "th");
  if(enBtn) enBtn.classList.toggle("active", currentLanguage356 === "en");

  var tableEl = document.getElementById("table");
  if(tableEl){
    tableEl.textContent = tableNo === "counter" ? tr356("counterTakeaway") : tr356("table") + " " + tableNo;
  }

  var desc = document.getElementById("storeDescription");
  if(desc){
    if(currentLanguage356 === "en"){
      desc.textContent = tr356("defaultDescription");
    }else if(storeDescriptionThai356){
      desc.textContent = storeDescriptionThai356;
    }
  }

  translateStatus356();
}

function translateStatus356(){
  var el = document.getElementById("storeStatusBadge");
  if(!el) return;
  var text = (el.textContent || "").trim();
  var target = null;
  var isPaused = text === "ปิดรับออเดอร์ชั่วคราว" || text === "Orders Temporarily Paused";
  var isOpen = text === "เปิดรับออเดอร์" || text === "Open for Orders";
  var isClosed = text === "ปิดร้าน" || text === "Closed";
  var isChecking = text === "กำลังตรวจสอบสถานะร้าน" || text === "Checking store status";
  if(isPaused) target = tr356("storePaused");
  else if(isOpen) target = tr356("storeOpen");
  else if(isClosed) target = tr356("storeClosed");
  else if(isChecking) target = tr356("checkingStore");
  // IMPORTANT: write only when the text actually changes.
  // Writing the same text inside MutationObserver can create an endless loop in Safari/iOS.
  if(target !== null && text !== target) el.textContent = target;
}

function setLanguage356(lang){
  currentLanguage356 = lang === "en" ? "en" : "th";
  localStorage.setItem("356_customer_language", currentLanguage356);
  setStaticLanguage356();
  try{ renderTabs(); }catch(e){}
  try{ renderMenu(); }catch(e){}
  try{ renderCart(); }catch(e){}
}
window.setLanguage356 = setLanguage356;

/* Keep original calculation, but translate status returned to async loadStoreSettings(). */
var originalCalculateStoreStatus356 = calculateStoreStatus;
calculateStoreStatus = function(settings){
  var result = originalCalculateStoreStatus356(settings);
  if(settings && settings.accepting_orders === false){
    return {open:false, text:tr356("storePaused")};
  }
  return {open:result.open, text:result.open ? tr356("storeOpen") : tr356("storeClosed")};
};

/* Translate category tabs while keeping raw category values for filtering. */
renderTabs = function(){
  var cats = ["ทั้งหมด"].concat(Array.from(new Set(db.products.filter(function(x){return x.is_active!==false;}).map(function(x){return x.category;})))).concat(["ADD-ON"]);
  document.getElementById("tabs").innerHTML = "";
  cats.forEach(function(c){
    var b = document.createElement("button");
    b.textContent = displayCategory356(c);
    b.className = c === cat ? "active" : "";
    b.onclick = function(){ cat=c; renderTabs(); renderMenu(); };
    document.getElementById("tabs").appendChild(b);
  });
};

/* Translate menu cards only. Raw Thai names remain in db and orders. */
renderMenu = function(){
  var menuEl = document.getElementById("menu");
  menuEl.innerHTML = "";

  if(cat === "ADD-ON"){
    db.addons.filter(function(a){return a.is_active!==false;}).forEach(function(a){
      var d = document.createElement("div");
      var shownName = displayOption356(a.name);
      d.className = "card";
      d.innerHTML = (a.image_url
        ? '<img class="menu-card-image" src="'+a.image_url+'" alt="'+shownName+'" loading="lazy">'
        : '<div class="menu-card-placeholder">356</div>')+
        '<div class="name">'+shownName+'</div>'+
        '<div class="price">+฿'+a.price+'</div>'+
        '<button>'+tr356("add")+'</button>';
      d.onclick = function(){ if(!window.ensureStoreOpen356 || ensureStoreOpen356()) openAddon(a); };
      menuEl.appendChild(d);
    });
    return;
  }

  db.products
    .filter(function(x){return x.is_active!==false && (cat==="ทั้งหมด" || x.category===cat);})
    .forEach(function(p){
      var d = document.createElement("div");
      var shownName = displayProduct356(p.name);
      d.className = "card";
      d.innerHTML = (p.image_url
        ? '<img class="menu-card-image" src="'+p.image_url+'" alt="'+shownName+'" loading="lazy">'
        : '<div class="menu-card-placeholder">356</div>')+
        '<div class="name">'+shownName+'</div>'+
        '<div class="price">฿'+p.price+'</div>'+
        '<button>'+tr356("selectMenu")+'</button>';
      d.onclick = function(){ if(!window.ensureStoreOpen356 || ensureStoreOpen356()) openProduct(p); };
      menuEl.appendChild(d);
    });
};

radios = function(title,name,opts,selected){
  return '<h3>'+title+'</h3>'+
    opts.map(function(o){
      return '<label><input type="radio" name="'+name+'" value="'+o.value+'" data-price="'+(o.price||0)+'" '+(o.value===selected?'checked':'')+'> '+o.label+'</label>';
    }).join("");
};

checks = function(title,name,opts,selected){
  return '<h3>'+title+'</h3>'+
    opts.map(function(o){
      var label = displayOption356(o.name);
      var priceText = currentLanguage356 === "en" ? ' +'+o.price+' THB' : ' +'+o.price;
      return '<label><input type="checkbox" name="'+name+'" value="'+o.name+'" data-price="'+o.price+'" '+(selected.includes(o.name)?'checked':'')+'> '+label+priceText+'</label>';
    }).join("");
};

openProduct = function(p,i){
  if(window.ensureStoreOpen356 && !ensureStoreOpen356()) return;
  if(typeof i === "undefined") i = null;
  current = p;
  editIndex = i;
  qty = i===null ? 1 : cart[i].qty;
  document.getElementById("qtyValue").textContent = qty;
  document.getElementById("pname").textContent = displayProduct356(p.name);

  var old = i===null ? [] : cart[i].options;
  var oldNote = i===null ? "" : (cart[i].note || "");
  var h = "";

  if(p.groups.includes("sweet")){
    var valuesSweet = ["ไม่หวาน","หวานน้อย","ปกติ","เพิ่มหวาน"];
    h += radios(tr356("sweetness"),"sweet",valuesSweet.map(function(v){return {label:displayOption356(v),value:v,price:0};}),old.find(function(x){return valuesSweet.includes(x);})||"ปกติ");
  }

  if(p.groups.includes("sweet_no_zero")){
    var valuesSweet3 = ["หวานน้อย","ปกติ","เพิ่มหวาน"];
    h += radios(tr356("sweetness"),"sweet",valuesSweet3.map(function(v){return {label:displayOption356(v),value:v,price:0};}),old.find(function(x){return valuesSweet3.includes(x);})||"ปกติ");
  }

  if(p.groups.includes("milk")){
    var valuesMilk = ["นมสด","นมโอ๊ต"];
    h += radios(tr356("milkType"),"milk",valuesMilk.map(function(v){return {label:displayOption356(v),value:v,price:0};}),old.find(function(x){return valuesMilk.includes(x);})||"นมสด");
  }

  if(p.groups.includes("yogurt")){
    var yogurtSelected = old.includes("ใส่โยเกิร์ต") ? "ใส่โยเกิร์ต" : "ไม่ใส่โยเกิร์ต";
    h += radios(tr356("yogurt"),"yogurt",[
      {label:displayOption356("ไม่ใส่โยเกิร์ต"),value:"ไม่ใส่โยเกิร์ต",price:0},
      {label:displayOption356("ใส่โยเกิร์ต")+(currentLanguage356==="en"?" +10 THB":" +10 บาท"),value:"ใส่โยเกิร์ต",price:10}
    ],yogurtSelected);
  }

  if(p.groups.includes("extras_all")){
    h += checks(tr356("extras"),"extra",[
      {name:"ปั่น",price:10},{name:"ไข่มุกบุก",price:10},{name:"ปีโป้",price:10},{name:"โยเกิร์ต",price:10},{name:"ครีมชีส",price:15}
    ],old);
  }

  if(p.groups.includes("extras_no_blend")){
    h += checks(tr356("extras"),"extra",[
      {name:"ไข่มุกบุก",price:10},{name:"ปีโป้",price:10},{name:"โยเกิร์ต",price:10},{name:"ครีมชีส",price:15}
    ],old);
  }

  if(p.groups.includes("extras_soda")){
    h += checks(tr356("extras"),"extra",[
      {name:"ไข่มุกบุก",price:10},{name:"ปีโป้",price:10},{name:"ครีมชีส",price:15}
    ],old);
  }

  if(p.groups.includes("size")){
    h += checks(tr356("cupSize"),"size",[{name:"อัปไซส์แก้วใหญ่",price:10}],old);
  }

  if(!h) h = '<p>'+tr356("noOptions")+'</p>';

  var safeNote = oldNote.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  h += '<h3>'+tr356("itemNote")+'</h3><textarea id="itemNote356" maxlength="150" rows="3" placeholder="'+tr356("itemNotePlaceholder")+'" style="width:100%;box-sizing:border-box;padding:12px;border:1px solid #ddd;border-radius:12px;font:inherit;resize:vertical">'+safeNote+'</textarea>';
  document.getElementById("modifierArea").innerHTML = h;
  document.getElementById("saveBtn").textContent = i===null ? tr356("addToCart") : tr356("saveChanges");
  document.getElementById("product").classList.add("show");
};

renderCart = function(){
  document.getElementById("count").textContent = cart.reduce(function(s,x){return s+x.qty;},0);
  var itemsEl = document.getElementById("items");
  itemsEl.innerHTML = "";

  cart.forEach(function(x,i){
    var d = document.createElement("div");
    var translatedOptions = x.options.map(displayOption356);
    d.className = "row";
    d.innerHTML = '<b>'+displayProduct356(x.name)+' × '+x.qty+'</b>'+
      '<div class="muted">'+(translatedOptions.join(" • ") || tr356("noSelectedOptions"))+'</div>'+
      (x.note ? '<div class="muted"><b>'+tr356("noteLabel")+':</b> '+x.note+'</div>' : '')+
      '<div>฿'+(x.unit*x.qty)+'</div>'+
      '<div class="actions"><button class="edit">'+tr356("edit")+'</button><button class="remove">'+tr356("remove")+'</button></div>';

    d.querySelector(".edit").onclick = function(){ closeCart(); openProduct(x.product,i); };
    d.querySelector(".remove").onclick = function(){ cart.splice(i,1); renderCart(); };
    itemsEl.appendChild(d);
  });

  document.getElementById("total").textContent = tr356("total")+' ฿'+cart.reduce(function(s,x){return s+x.unit*x.qty;},0);
};

openAddon = function(a){
  if(window.ensureStoreOpen356 && !ensureStoreOpen356()) return;
  currentAddon = a;
  if(!cart.length){ alert(tr356("chooseMainFirst")); return; }
  if(cart.length===1){ applyAddon(0); return; }

  document.getElementById("addonTitle").textContent = tr356("addPrefix")+' '+displayOption356(a.name)+' +'+a.price+(currentLanguage356==="en"?' THB':'');
  var targets = document.getElementById("addonTargets");
  targets.innerHTML = "";
  cart.forEach(function(x,i){
    var b = document.createElement("button");
    b.className = "row";
    b.style.width = "100%";
    b.textContent = displayProduct356(x.name)+' × '+x.qty;
    b.onclick = function(){ applyAddon(i); };
    targets.appendChild(b);
  });
  document.getElementById("addonPanel").classList.add("show");
};

applyAddon = function(i){
  cart[i].options.push(currentAddon.name);
  cart[i].unit += currentAddon.price;
  closeAddon();
  if(currentLanguage356 === "en"){
    alert(displayOption356(currentAddon.name)+' '+tr356("added")+' '+tr356("to")+' '+displayProduct356(cart[i].name));
  }else{
    alert('เพิ่ม '+currentAddon.name+' ให้ '+cart[i].name+' แล้ว');
  }
  renderCart();
};

submitOrder = async function(){
  try{ await loadStoreSettings(); }catch(e){}
  if(window.ensureStoreOpen356 && !ensureStoreOpen356()) return;
  if(!cart.length){ alert(tr356("chooseItem")); return; }

  var customer_name = document.getElementById("customer").value.trim() || null;
  if(customer_name) localStorage.setItem("356_customer_name",customer_name);

  var id = crypto.randomUUID();
  var order_no = "356-"+Date.now().toString().slice(-8);
  var payment_method = document.querySelector('input[name="pay"]:checked').value;
  var total = cart.reduce(function(s,x){return s+x.unit*x.qty;},0);

  var insertOrder = await sb.from("orders").insert({
    id:id,
    order_no:order_no,
    table_no:tableNo,
    customer_name:customer_name,
    payment_method:payment_method,
    total:total
  });

  if(insertOrder.error){
    alert(tr356("orderFailed")+': '+insertOrder.error.message);
    return;
  }

  /* IMPORTANT: raw Thai names/options are stored so Android/printing remains unchanged. */
  var rows = cart.map(function(x){
    return {
      order_id:id,
      product_name:x.name,
      quantity:x.qty,
      unit_price:x.unit,
      options:x.note ? x.options.concat(["หมายเหตุ: "+x.note]) : x.options,
      line_total:x.unit*x.qty
    };
  });

  var result = await sb.from("order_items").insert(rows);
  if(result.error){
    alert(tr356("itemSaveFailed")+': '+result.error.message);
    return;
  }

  if(currentLanguage356 === "en"){
    alert(tr356("orderSuccess")+'\n'+tr356("orderNumber")+' '+order_no+'\n'+tr356("totalAmount")+' ฿'+total);
  }else{
    alert('ส่งออร์เดอร์สำเร็จ\nเลขที่ '+order_no+'\nยอดรวม ฿'+total);
  }
  cart = [];
  renderCart();
  closeCart();
};

/* Keep Thai store description so switching back restores it. */
(function watchStoreText356(){
  var desc = document.getElementById("storeDescription");
  if(desc){
    var descObserver = new MutationObserver(function(){
      var text = (desc.textContent || "").trim();
      if(currentLanguage356 === "th" && text) storeDescriptionThai356 = text;
      if(currentLanguage356 === "en" && text !== tr356("defaultDescription")){
        if(text) storeDescriptionThai356 = text;
        desc.textContent = tr356("defaultDescription");
      }
    });
    descObserver.observe(desc,{childList:true,subtree:true});
  }

  var status = document.getElementById("storeStatusBadge");
  if(status){
    var statusObserver = new MutationObserver(function(){ translateStatus356(); });
    statusObserver.observe(status,{childList:true,subtree:true});
  }
})();

setStaticLanguage356();
/* Re-apply after async store/menu load on slower connections. */
setTimeout(function(){ setStaticLanguage356(); try{renderTabs();renderMenu();}catch(e){} },500);
setTimeout(function(){ setStaticLanguage356(); try{renderTabs();renderMenu();}catch(e){} },1800);
