const sb=supabase.createClient(APP_CONFIG.SUPABASE_URL,APP_CONFIG.SUPABASE_ANON_KEY);
let db={products:[],addons:[]},cat="ทั้งหมด",cart=[],current=null,editIndex=null,qty=1,currentAddon=null;
const $=id=>document.getElementById(id),tableNo=new URLSearchParams(location.search).get("table")||"counter";
$("table").textContent=tableNo==="counter"?"สั่งที่เคาน์เตอร์ / กลับบ้าน":`โต๊ะ ${tableNo}`;
$("customer").value=localStorage.getItem("356_customer_name")||"";
fetch("menu.json").then(r=>r.json()).then(d=>{db=d;renderTabs();renderMenu()});

function renderTabs(){const cats=["ทั้งหมด",...new Set(db.products.map(x=>x.category)),"ADD-ON"];$("tabs").innerHTML="";cats.forEach(c=>{const b=document.createElement("button");b.textContent=c;b.className=c===cat?"active":"";b.onclick=()=>{cat=c;renderTabs();renderMenu()};$("tabs").appendChild(b)})}
function renderMenu(){$("menu").innerHTML="";if(cat==="ADD-ON"){db.addons.forEach(a=>{const d=document.createElement("div");d.className="card";d.innerHTML=`<div class=name>${a.name}</div><div class=price>+฿${a.price}</div><button>เพิ่ม</button>`;d.onclick=()=>openAddon(a);$("menu").appendChild(d)});return}
db.products.filter(x=>cat==="ทั้งหมด"||x.category===cat).forEach(p=>{const d=document.createElement("div");d.className="card";d.innerHTML=`<div class=name>${p.name}</div><div class=price>฿${p.price}</div><button>เลือกเมนู</button>`;d.onclick=()=>openProduct(p);$("menu").appendChild(d)})}
function radios(title,name,opts,sel){return `<h3>${title}</h3>`+opts.map(o=>`<label><input type=radio name=${name} value="${o}" ${o===sel?"checked":""}> ${o}</label>`).join("")}
function checks(title,name,opts,sel){return `<h3>${title}</h3>`+opts.map(o=>`<label><input type=checkbox name=${name} value="${o.n}" data-price=${o.p} ${sel.includes(o.n)?"checked":""}> ${o.n} +${o.p}</label>`).join("")}
function openProduct(p,i=null){
  current=p;editIndex=i;qty=i===null?1:cart[i].qty;$("qtyValue").textContent=qty;$("pname").textContent=p.name;
  const old=i===null?[]:cart[i].options;let h="";
  if(p.groups.includes("sweet")){
    const opts=["ไม่หวาน","หวานน้อย","ปกติ","เพิ่มหวาน"];
    h+=radios("ความหวาน","sweet",opts,old.find(x=>opts.includes(x))||"ปกติ");
  }
  if(p.groups.includes("sweet_no_zero")){
    const opts=["หวานน้อย","ปกติ","เพิ่มหวาน"];
    h+=radios("ความหวาน","sweet",opts,old.find(x=>opts.includes(x))||"ปกติ");
  }
  if(p.groups.includes("milk"))h+=radios("ชนิดนม","milk",["นมสด","นมโอ๊ต"],old.find(x=>["นมสด","นมโอ๊ต"].includes(x))||"นมสด");
  if(p.groups.includes("extras_all"))h+=checks("เพิ่มเติม","extra",[{n:"ปั่น",p:10},{n:"ไข่มุกบุก",p:10},{n:"ปีโป้",p:10},{n:"โยเกิร์ต",p:10},{n:"ครีมชีส",p:15}],old);
  if(p.groups.includes("extras_no_blend"))h+=checks("เพิ่มเติม","extra",[{n:"ไข่มุกบุก",p:10},{n:"ปีโป้",p:10},{n:"โยเกิร์ต",p:10},{n:"ครีมชีส",p:15}],old);
  if(p.groups.includes("extras_soda"))h+=checks("เพิ่มเติม","extra",[{n:"ไข่มุกบุก",p:10},{n:"ปีโป้",p:10},{n:"ครีมชีส",p:15}],old);
  if(p.groups.includes("size"))h+=checks("ขนาดแก้ว","size",[{n:"อัปไซส์แก้วใหญ่",p:10}],old);
  if(!h)h="<p>เมนูนี้ไม่มีตัวเลือกเพิ่มเติม</p>";
  $("modifierArea").innerHTML=h;$("saveBtn").textContent=i===null?"เพิ่มลงตะกร้า":"บันทึกการแก้ไข";$("product").classList.add("show")
}
function closeProduct(){$("product").classList.remove("show")}function changeQty(n){qty=Math.max(1,Math.min(20,qty+n));$("qtyValue").textContent=qty}
function saveProduct(){let options=[],extra=0;["sweet","milk"].forEach(n=>{const e=document.querySelector(`input[name=${n}]:checked`);if(e)options.push(e.value)});document.querySelectorAll('input[name=extra]:checked,input[name=size]:checked').forEach(e=>{options.push(e.value);extra+=Number(e.dataset.price||0)});const item={product:current,name:current.name,qty,unit:current.price+extra,options};if(editIndex===null)cart.push(item);else cart[editIndex]=item;closeProduct();renderCart()}
function renderCart(){$("count").textContent=cart.reduce((s,x)=>s+x.qty,0);$("items").innerHTML="";cart.forEach((x,i)=>{const d=document.createElement("div");d.className="row";d.innerHTML=`<b>${x.name} × ${x.qty}</b><div class=muted>${x.options.join(" • ")||"ไม่มีตัวเลือกเพิ่มเติม"}</div><div>฿${x.unit*x.qty}</div><div class=actions><button class=edit>แก้ไข</button><button class=remove>ลบ</button></div>`;d.querySelector(".edit").onclick=()=>{closeCart();openProduct(x.product,i)};d.querySelector(".remove").onclick=()=>{cart.splice(i,1);renderCart()};$("items").appendChild(d)});$("total").textContent="รวม ฿"+cart.reduce((s,x)=>s+x.unit*x.qty,0)}
function openCart(){renderCart();$("cart").classList.add("show")}function closeCart(){$("cart").classList.remove("show")}
function openAddon(a){currentAddon=a;if(!cart.length)return alert("กรุณาเลือกเมนูหลักก่อน");if(cart.length===1)return applyAddon(0);$("addonTitle").textContent=`เพิ่ม ${a.name} +${a.price}`;$("addonTargets").innerHTML="";cart.forEach((x,i)=>{const b=document.createElement("button");b.className="row";b.style.width="100%";b.textContent=`${x.name} × ${x.qty}`;b.onclick=()=>applyAddon(i);$("addonTargets").appendChild(b)});$("addonPanel").classList.add("show")}
function closeAddon(){$("addonPanel").classList.remove("show")}function applyAddon(i){cart[i].options.push(currentAddon.name);cart[i].unit+=currentAddon.price;closeAddon();alert(`เพิ่ม ${currentAddon.name} ให้ ${cart[i].name} แล้ว`);renderCart()}
async function submitOrder(){if(!cart.length)return alert("กรุณาเลือกสินค้า");const customer_name=$("customer").value.trim()||null;if(customer_name)localStorage.setItem("356_customer_name",customer_name);const id=crypto.randomUUID(),order_no="356-"+Date.now().toString().slice(-8),payment_method=document.querySelector('input[name=pay]:checked').value,total=cart.reduce((s,x)=>s+x.unit*x.qty,0);let {error}=await sb.from("orders").insert({id,order_no,table_no:tableNo,customer_name,payment_method,total});if(error)return alert(error.message);let rows=cart.map(x=>({order_id:id,product_name:x.name,quantity:x.qty,unit_price:x.unit,options:x.options,line_total:x.unit*x.qty}));let r=await sb.from("order_items").insert(rows);if(r.error)return alert(r.error.message);alert(`ส่งออร์เดอร์สำเร็จ\nเลขที่ ${order_no}\nยอดรวม ฿${total}`);cart=[];renderCart();closeCart()}
