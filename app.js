
const sb=supabase.createClient(APP_CONFIG.SUPABASE_URL,APP_CONFIG.SUPABASE_ANON_KEY);
let products=[],cat='ทั้งหมด',current=null,cart=[];const table=new URLSearchParams(location.search).get('table')||'counter';
document.getElementById('table').textContent=table==='counter'?'สั่งที่เคาน์เตอร์ / กลับบ้าน':'โต๊ะ '+table;
document.getElementById('qty').innerHTML=Array.from({length:10},(_,i)=>`<option>${i+1}</option>`).join('');
fetch('menu.json').then(r=>r.json()).then(d=>{products=d;renderTabs();renderMenu()});
function renderTabs(){let c=['ทั้งหมด',...new Set(products.map(x=>x.category))];tabs.innerHTML=c.map(x=>`<button onclick="cat='${x}';renderMenu()">${x}</button>`).join('')}
function renderMenu(){menu.innerHTML=products.filter(x=>cat==='ทั้งหมด'||x.category===cat).map((x,i)=>`<div class="card"><div class="name">${x.name}</div><div class="price">฿${x.price}</div><button onclick='openProduct(${JSON.stringify(x)})'>เลือกเมนู</button></div>`).join('')}
function openProduct(p){current=p;document.getElementById('pname').textContent=p.name;document.querySelectorAll('.add').forEach(x=>x.checked=false);product.classList.add('show')}
function closeProduct(){product.classList.remove('show')}
function addCart(){let opts=[document.querySelector('input[name=sweet]:checked').value,document.querySelector('input[name=milk]:checked').value];let extra=0;document.querySelectorAll('.add:checked').forEach(x=>{opts.push(x.value);extra+=Number(x.dataset.price)});let qty=Number(document.getElementById('qty').value);cart.push({name:current.name,qty,unit:current.price+extra,opts});closeProduct();renderCart()}
function renderCart(){count.textContent=cart.reduce((s,x)=>s+x.qty,0);items.innerHTML=cart.map((x,i)=>`<div class="row"><b>${x.name} × ${x.qty}</b><div>${x.opts.join(' • ')}</div><div>฿${x.unit*x.qty}</div><button onclick="cart.splice(${i},1);renderCart()">ลบ</button></div>`).join('');total.textContent='รวม ฿'+cart.reduce((s,x)=>s+x.unit*x.qty,0)}
function openCart(){renderCart();cart.classList.add('show')} function closeCart(){cart.classList.remove('show')}
async function submitOrder(){if(!cart.length)return alert('กรุณาเลือกสินค้า');let order_no='356-'+Date.now().toString().slice(-8),payment_method=document.querySelector('input[name=pay]:checked').value,total=cart.reduce((s,x)=>s+x.unit*x.qty,0),customer_name=document.getElementById('customer').value||null;
let {data:o,error}=await sb.from('orders').insert({order_no,table_no:table,customer_name,payment_method,total}).select().single();if(error)return alert(error.message);
let rows=cart.map(x=>({order_id:o.id,product_name:x.name,quantity:x.qty,unit_price:x.unit,options:x.opts,line_total:x.unit*x.qty}));let {error:e}=await sb.from('order_items').insert(rows);if(e)return alert(e.message);alert('ส่งออร์เดอร์สำเร็จ '+order_no);cart=[];renderCart();closeCart()}
