const DuitMedia=(()=>{
  const b64=bytes=>{let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s)};
  const bytes=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
  async function microphone(){if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia)throw Error('请用支持麦克风的 HTTPS 浏览器打开小屋。');return navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false})}
  function resample(data,from,to){const n=Math.floor(data.length*to/from),out=new Float32Array(n);
    for(let i=0;i<n;i++){let a=Math.floor(i*from/to),b=Math.max(a+1,Math.floor((i+1)*from/to)),sum=0;for(let k=a;k<b&&k<data.length;k++)sum+=data[k];out[i]=sum/(b-a)}return out}
  function merge(chunks){const all=new Float32Array(chunks.reduce((n,c)=>n+c.length,0));let off=0;for(const c of chunks){all.set(c,off);off+=c.length}return all}
  function mp3(data,rate){const pcm=resample(data,rate,16000),i16=Int16Array.from(pcm,x=>Math.max(-1,Math.min(1,x))*32767),encoder=new lamejs.Mp3Encoder(1,16000,48),out=[];
    for(let i=0;i<i16.length;i+=1152){const r=encoder.encodeBuffer(i16.subarray(i,i+1152));if(r.length)out.push(new Uint8Array(r))}out.push(new Uint8Array(encoder.flush()));
    const all=new Uint8Array(out.reduce((n,c)=>n+c.length,0));let at=0;for(const c of out){all.set(c,at);at+=c.length}return 'data:audio/mpeg;base64,'+b64(all)}
  async function reference(file){if(file.size>8*1024*1024)throw Error('参考录音请小于 8 MB。');const a=new AudioContext();try{const b=await a.decodeAudioData(await file.arrayBuffer());if(b.duration<1||b.duration>30)throw Error('请选择 1 至 30 秒的单人录音。');return mp3(b.getChannelData(0).subarray(0,b.sampleRate*12),b.sampleRate)}finally{await a.close()}}
  async function capture(stream,onSamples){const ac=new AudioContext();await ac.resume();const src=ac.createMediaStreamSource(stream),proc=ac.createScriptProcessor(2048,1,1),quiet=ac.createGain();quiet.gain.value=0;
    src.connect(proc);proc.connect(quiet);quiet.connect(ac.destination);proc.onaudioprocess=e=>onSamples(e.inputBuffer.getChannelData(0),ac.sampleRate);
    return ()=>{proc.onaudioprocess=null;src.disconnect();proc.disconnect();quiet.disconnect();ac.close().catch(()=>{})}}
  function vad(onTurn,canListen){let parts=[],lead=[],loud=0,silence=0,samples=0;
    return (frame,rate)=>{if(!canListen()){parts=[];lead=[];loud=silence=samples=0;return}
      let e=0;for(const x of frame)e+=x*x;const talking=Math.sqrt(e/frame.length)>.019;
      if(!parts.length){lead.push(new Float32Array(frame));if(lead.length>4)lead.shift();if(!talking)return;parts=lead;lead=[];samples=parts.reduce((n,c)=>n+c.length,0)}else{parts.push(new Float32Array(frame));samples+=frame.length}
      if(talking){loud+=frame.length;silence=0}else silence+=frame.length;
      if(silence>rate*.75||samples>=rate*14){const utterance=parts,ok=loud>rate*.14;parts=[];lead=[];samples=silence=loud=0;if(ok)onTurn(mp3(merge(utterance),rate))}
    }}
  async function parseChat(file){if(file.size>2000000)throw Error('聊天文件请控制在 2 MB 以内。');const raw=await file.arrayBuffer();let t;try{t=new TextDecoder('utf-8',{fatal:true}).decode(raw)}catch{t=new TextDecoder('gb18030').decode(raw)}
    if(/\.json$/i.test(file.name)){const obj=JSON.parse(t),rows=Array.isArray(obj)?obj:obj?.messages;if(!Array.isArray(rows))throw Error('JSON 需为消息数组或包含 messages 数组。');t=rows.slice(0,10000).map(r=>typeof r==='string'?r:r&&typeof (r.content??r.text??r.message)==='string'?[r.sender??r.name??r.role,r.content??r.text??r.message].filter(Boolean).join('：'):'').filter(Boolean).join('\n')}
    if(!/\.(txt|csv|json)$/i.test(file.name)||!t.trim()||t.includes('\u0000'))throw Error('请选择可读的 TXT、CSV 或 JSON 聊天导出。');return t.trim()}
  async function photo(file){if(file.size>12*1024*1024)throw Error('截图过大。');const url=URL.createObjectURL(file),img=new Image();try{img.src=url;await img.decode();const c=document.createElement('canvas'),scale=Math.min(1,1150/Math.max(img.width,img.height));c.width=Math.round(img.width*scale);c.height=Math.round(img.height*scale);c.getContext('2d').drawImage(img,0,0,c.width,c.height);const s=c.toDataURL('image/jpeg',.76);if(s.length>610000)throw Error('请裁剪至一段对话后重试。');return s}finally{URL.revokeObjectURL(url)}}
  return {b64,bytes,microphone,capture,vad,mp3,reference,parseChat,photo,resample,merge};
})();
const DuitPrivate=(()=>{
  let promise;
  function db(){if(!promise)promise=new Promise((ok,no)=>{const req=indexedDB.open('duit-companion-private',1);req.onupgradeneeded=()=>req.result.createObjectStore('vault');req.onsuccess=()=>ok(req.result);req.onerror=()=>no(req.error)});return promise}
  async function use(mode,fn){const d=await db();return new Promise((ok,no)=>{const t=d.transaction('vault',mode),req=fn(t.objectStore('vault'));t.oncomplete=()=>ok(req.result);t.onabort=t.onerror=()=>no(t.error)})}
  async function key(uid){const id='key:'+uid,k=await use('readonly',s=>s.get(id));if(k)return k;
    const next=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);try{await use('readwrite',s=>s.add(next,id));return next}catch{const stored=await use('readonly',s=>s.get(id));if(stored)return stored;throw Error('无法保存本机私有数据。')}}
  async function get(uid,id){const rec=await use('readonly',s=>s.get(uid+':'+id));if(!rec)return null;const data=await crypto.subtle.decrypt({name:'AES-GCM',iv:rec.iv},await key(uid),rec.data);return rec.binary?new Blob([data],{type:rec.mime}):JSON.parse(new TextDecoder().decode(data))}
  async function put(uid,id,value){const binary=value instanceof Blob,iv=crypto.getRandomValues(new Uint8Array(12)),buffer=binary?await value.arrayBuffer():new TextEncoder().encode(JSON.stringify(value));const data=await crypto.subtle.encrypt({name:'AES-GCM',iv},await key(uid),buffer);return use('readwrite',s=>s.put({iv,data,binary,mime:binary?value.type:null},uid+':'+id))}
  const remove=(uid,id)=>use('readwrite',s=>s.delete(uid+':'+id));return {get,put,remove};
})();
