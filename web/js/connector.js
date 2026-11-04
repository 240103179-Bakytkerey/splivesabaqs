// Сайт ↔ JUZ40 LIVE кеңейтімі. Кеңейтімнің bridge.js скрипті осы бетте window.postMessage арқылы тыңдайды.
(function(root){
  'use strict';
  const OUT='juz40-live-site', IN='juz40-live-ext';
  const pending=new Map(), listeners=new Map();
  let info=null, seq=0;
  const emit=(event,data)=>{for(const fn of listeners.get(event)||[])fn(data);};
  function on(event,fn){if(!listeners.has(event))listeners.set(event,new Set());listeners.get(event).add(fn);return()=>listeners.get(event).delete(fn);}
  root.addEventListener('message',e=>{
    if(e.source!==root||e.origin!==location.origin)return;
    const m=e.data;if(!m||m.channel!==IN)return;
    if(m.event){if(m.event==='hello'){const first=!info;info=m.data||{};if(first)emit('connected',info);}emit(m.event,m.data);return;}
    const p=pending.get(m.id);if(!p)return;pending.delete(m.id);clearTimeout(p.timer);
    if(m.ok)p.resolve(m.data);else p.reject(Object.assign(Error(m.error||'Кеңейтім қате қайтарды.'),{safe:m.safe===true}));
  });
  // A request the extension never answered may still have changed the site, so a timeout is not "safe".
  function request(method,params={},timeout=30000){
    if(!info)return Promise.reject(Object.assign(Error('Кеңейтім қосылмаған. «Кеңейтім» бөліміндегі нұсқаулықты қараңыз.'),{safe:true}));
    const id='r'+(++seq)+'-'+Date.now();
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{pending.delete(id);reject(Error('Кеңейтім жауап бермеді. Әрекет нәтижесін ашық беттен тексеріңіз.'));},timeout);
      pending.set(id,{resolve,reject,timer});
      root.postMessage({channel:OUT,id,method,params},location.origin);
    });
  }
  function detect(ms=1500){
    if(info)return Promise.resolve(info);
    return new Promise(resolve=>{const off=on('hello',d=>{off();clearTimeout(t);resolve(d);});const t=setTimeout(()=>{off();resolve(null);},ms);root.postMessage({channel:OUT,method:'hello'},location.origin);});
  }
  root.LiveExtension={request,detect,on,get info(){return info;}};
})(globalThis);
