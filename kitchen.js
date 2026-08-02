
const sb=supabase.createClient(APP_CONFIG.SUPABASE_URL,APP_CONFIG.SUPABASE_ANON_KEY);
async function load(){let {data,error}=await sb.from('orders').select('*,order_items(*)').order('created_at',{ascending:false});if(error)return orders.innerHTML='<p>'+error.message+'</p>';orders.innerHTML=data.map(o=>`<div class="row"><b>${o.order_no}</b> • โต๊ะ ${o.table_no}<div>฿${o.total} • ${o.status}</div>${o.order_items.map(i=>`<div>${i.product_name} × ${i.quantity}<br><small>${(i.options||[]).join(' • ')}</small></div>`).join('')}<button onclick="status('${o.id}','making')">กำลังทำ</button> <button onclick="status('${o.id}','ready')">เสร็จแล้ว</button></div>`).join('')}
async function status(id,status){let {error}=await sb.from('orders').update({status}).eq('id',id);if(error)alert(error.message);load()}
setInterval(load,3000);load();
