const sb=supabase.createClient(APP_CONFIG.SUPABASE_URL,APP_CONFIG.SUPABASE_ANON_KEY);
let products=[],cat="ทั้งหมด",current=null,cartItems=[];
const tableNo=new URLSearchParams(location.search).get("table")||"counter";
const $=id=>document.getElementById(id);
$("table").textContent=tableNo==="counter"?"สั่งที่เคาน์เตอร์ / กลับบ้าน":`โต๊ะ ${tableNo}`;
$("qty").innerHTML=Array.from({length:10},(_,i)=>`<option>${i+1}</option>`).join("");
fetch("menu.json").then(r=>r.json()).then(d=>{products=d;renderTabs();renderMenu()});

function renderTabs(){const cats=["ทั้งหมด",...new Set(products.map(x=>x.category))];$("tabs").innerHTML="";cats.forEach(c=>{const b=document.createElement("button");b.textContent=c;b.onclick=()=>{cat=c;renderTabs();renderMenu()};if(c===cat)b.classList.add("active");$("tabs").appendChild(b)})}
function renderMenu(){$("menu").innerHTML="";products.filter(x=>cat==="ทั้งหมด"||x.category===cat).forEach(p=>{const d=document.createElement("div");d.className="card";d.innerHTML=`<div class="name">${p.name}</div><div class="price">฿${p.price}</div>`;const b=document.createElement("button");b.textContent="เลือกเมนู";b.onclick=()=>openProduct(p);d.appendChild(b);$("menu").appendChild(d)})}
function radio(title,name,opts){return `<h3>${title}</h3>`+opts.map((o,i)=>`<label style="display:block;padding:7px 0"><input type="radio" name="${name}" value="${o}" ${i===0?"checked":""}> ${o}</label>`).join("")}
function checks(title,name,opts){return `<h3>${title}</h3>`+opts.map(o=>`<label style="display:block;padding:7px 0"><input type="checkbox" name="${name}" value="${o.v}" data-price="${o.p}"> ${o.l}</label>`).join("")}
function openProduct(p){current=p;startOptions(p.mods||[]);$("pname").textContent=p.name;$("product").classList.add("show")}
function startOptions(mods){let h="";
if(mods.includes("sweet"))h+=radio("ความหวาน","sweet",["ตามสูตรร้าน","ไม่หวาน","หวานน้อย","เพิ่มหวาน"]);
if(mods.includes("ice"))h+=radio("น้ำแข็ง","ice",["ตามสูตรร้าน","น้ำแข็งน้อย","ไม่ใส่น้ำแข็ง","น้ำแข็งมาก"]);
if(mods.includes("milk"))h+=radio("ชนิดนม","milk",["ตามสูตรร้าน (นมสด)","นมโอ๊ต"]);
if(mods.includes("blend"))h+=checks("รูปแบบ","blend",[{l:"ปั่น +10 บาท",v:"ปั่น",p:10}]);
if(mods.includes("topping"))h+=checks("ท็อปปิ้ง","topping",[{l:"ปีโป้ +10 บาท",v:"ปีโป้",p:10},{l:"ไข่มุกบุก +10 บาท",v:"ไข่มุกบุก",p:10},{l:"โยเกิร์ต +10 บาท",v:"โยเกิร์ต",p:10},{l:"ครีมชีส +15 บาท",v:"ครีมชีส",p:15}]);
if(mods.includes("shot"))h+=checks("เพิ่มช็อต","shot",[{l:"ช็อตกาแฟ +20 บาท",v:"ช็อตกาแฟ",p:20}]);
if(mods.includes("size"))h+=checks("ขนาดแก้ว","size",[{l:"อัปไซส์แก้วใหญ่ +10 บาท",v:"แก้วใหญ่",p:10}]);
if(!h)h="<p>เมนูนี้ไม่มีตัวเลือกเพิ่มเติม</p>";$("modifierArea").innerHTML=h}
function closeProduct(){$("product").classList.remove("show")}
function addCart(){let opts=[],extra=0;["sweet","ice","milk"].forEach(n=>{const e=document.querySelector(`input[name=${n}]:checked`);if(e)opts.push(e.value)});["blend","topping","shot","size"].forEach(n=>document.querySelectorAll(`input[name=${n}]:checked`).forEach(e=>{opts.push(e.value);extra+=Number(e.dataset.price||0)}));const qty=Number($("qty").value);cartItems.push({name:current.name,qty,unit:current.price+extra,opts});closeProduct();renderCart()}
function renderCart(){$("count").textContent=cartItems.reduce((s,x)=>s+x.qty,0);$("items").innerHTML=cartItems.map((x,i)=>`<div class="row"><b>${x.name} × ${x.qty}</b><div>${x.opts.join(" • ")||"ไม่มีตัวเลือกเพิ่มเติม"}</div><div>฿${x.unit*x.qty}</div><button onclick="cartItems.splice(${i},1);renderCart()">ลบ</button></div>`).join("");$("total").textContent="รวม ฿"+cartItems.reduce((s,x)=>s+x.unit*x.qty,0)}
function openCart(){renderCart();$("cart").classList.add("show")}function closeCart(){$("cart").classList.remove("show")}
async function submitOrder(){if(!cartItems.length)return alert("กรุณาเลือกสินค้า");const id=crypto.randomUUID(),order_no="356-"+Date.now().toString().slice(-8),payment_method=document.querySelector('input[name=pay]:checked').value,total=cartItems.reduce((s,x)=>s+x.unit*x.qty,0),customer_name=$("customer").value.trim()||null;
let {error}=await sb.from("orders").insert({id,order_no,table_no:tableNo,customer_name,payment_method,total});if(error)return alert(error.message);
let rows=cartItems.map(x=>({order_id:id,product_name:x.name,quantity:x.qty,unit_price:x.unit,options:x.opts,line_total:x.unit*x.qty}));let r=await sb.from("order_items").insert(rows);if(r.error)return alert(r.error.message);alert(`ส่งออร์เดอร์สำเร็จ\nเลขที่ ${order_no}\nยอดรวม ฿${total}`);cartItems=[];renderCart();closeCart()}
