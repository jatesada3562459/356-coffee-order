/* 356 Coffee & Drink - tiny local Supabase REST client
   Purpose: remove dependency on the external jsDelivr supabase-js CDN.
   Supports only the operations used by the customer storefront. */
(function(){
  function timeoutFetch(url, options, timeoutMs){
    var controller = new AbortController();
    var timer = setTimeout(function(){ controller.abort(); }, timeoutMs || 6000);
    var opts = Object.assign({}, options || {}, {signal: controller.signal});
    return fetch(url, opts).finally(function(){ clearTimeout(timer); });
  }

  function encodeSelect(value){
    // PostgREST select expressions contain commas and *; keeping them readable is fine.
    return value || '*';
  }

  function makeError(err){
    if(!err) return null;
    if(err.name === 'AbortError') return {message:'การเชื่อมต่อใช้เวลานานเกินไป'};
    return {message: err.message || String(err)};
  }

  function createClient(baseUrl, anonKey){
    var restBase = String(baseUrl || '').replace(/\/$/, '') + '/rest/v1';
    var baseHeaders = {
      'apikey': anonKey,
      'Authorization': 'Bearer ' + anonKey
    };

    function from(table){
      var selectFields='*';
      var filters=[];
      var orderBy=null;

      async function runSelect(singleMode){
        try{
          var queryParts=['select='+encodeURIComponent(encodeSelect(selectFields))].concat(filters);
          if(orderBy){ queryParts.push('order='+encodeURIComponent(orderBy)); }
          var qs=queryParts.join('&');
          var res=await timeoutFetch(restBase+'/'+encodeURIComponent(table)+'?'+qs,{
            method:'GET',
            headers:Object.assign({},baseHeaders,{'Accept':'application/json'})
          },5000);
          var text=await res.text();
          if(!res.ok){
            var detail;
            try{ detail=JSON.parse(text); }catch(e){ detail={message:text||('HTTP '+res.status)}; }
            return {data:singleMode?null:[],error:{message:detail.message||detail.details||('HTTP '+res.status)}};
          }
          var data=text?JSON.parse(text):[];
          if(singleMode) return {data:Array.isArray(data)?(data[0]||null):data,error:null};
          return {data:Array.isArray(data)?data:[],error:null};
        }catch(err){
          return {data:singleMode?null:[],error:makeError(err)};
        }
      }

      var builder={
        select:function(fields){ selectFields=fields||'*'; return builder; },
        eq:function(column,value){
          filters.push(encodeURIComponent(column)+'=eq.'+encodeURIComponent(String(value)));
          return builder;
        },
        order:function(column,options){
          var ascending = !options || options.ascending !== false;
          orderBy = String(column) + '.' + (ascending ? 'asc' : 'desc');
          return builder;
        },
        maybeSingle:function(){ return runSelect(true); },
        insert:async function(payload){
          try{
            var res=await timeoutFetch(restBase+'/'+encodeURIComponent(table),{
              method:'POST',
              headers:Object.assign({},baseHeaders,{
                'Content-Type':'application/json',
                'Prefer':'return=minimal'
              }),
              body:JSON.stringify(payload)
            },10000);
            var text=await res.text();
            if(!res.ok){
              var detail;
              try{ detail=JSON.parse(text); }catch(e){ detail={message:text||('HTTP '+res.status)}; }
              return {data:null,error:{message:detail.message||detail.details||('HTTP '+res.status)}};
            }
            return {data:null,error:null};
          }catch(err){
            return {data:null,error:makeError(err)};
          }
        },
        then:function(resolve,reject){ return runSelect(false).then(resolve,reject); }
      };
      return builder;
    }

    return {from:from};
  }

  window.supabase = {createClient:createClient};
})();
