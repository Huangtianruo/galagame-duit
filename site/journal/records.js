(()=>{
  'use strict';
  const $=id=>document.getElementById(id),endpoint='https://zion-app.functorz.com/zero/X57jbwZOjLw/api/graphql-v2';
  const service='fz_af_407961b2_7a48_88c3_47d7_12d9548ba45b',worker='fz_af_7228f2df_ddcb_0d58_39eb_effdc8afcbbe',authKey='duit.house.auth';
  let user=readLogin(),items=[],selected='',task=null,events=[],more=false,moreEvents=false,epoch=0,listReq=0,detailReq=0,timer=0,authNext=null,locked=false,pendingKey=null,inspectJob=null;
  const states=['待整理','整理中','待交付','交付中','待检查','检查中','待确认','待补充','失败','已完成'];
  const active=new Set(states.slice(0,6)),when=value=>{const t=new Date(value);return value&&Number.isFinite(+t)?t.toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false}):'未记录'};
  const number=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v)),elapsed=v=>number(v)?(Number(v)/1000).toLocaleString('zh-CN',{maximumFractionDigits:1})+' 秒':'未记录';
  const byId=v=>String(v.id),put=(id,text)=>{$(id).textContent=text||''},message=t=>put('feedback',t);
  const tag=(name,text,cls)=>{const el=document.createElement(name);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el};
  function readLogin(){try{const u=JSON.parse(sessionStorage.getItem(authKey));return u?.id&&u?.token?u:null}catch{return null}}
  function same(v){return v===epoch}
  function resetSession(u){epoch++;user=u;items=[];task=null;events=[];selected='';more=moreEvents=false;inspectJob=null;pendingKey=null;locked=false;clearTimeout(timer);$('note').value='';message('');paint()}
  async function gql(query,variables,auth=true){const resp=await fetch(endpoint,{method:'POST',credentials:'omit',signal:AbortSignal.timeout(40000),headers:{'Content-Type':'application/json',...(auth&&user?{Authorization:'Bearer '+user.token}:{})},body:JSON.stringify({query,variables})});
    if(!resp.ok)throw Error('服务暂未响应（'+resp.status+'），请刷新重试。');const j=await resp.json();if(j.errors?.length)throw Error(String(j.errors[0].message||'请求失败').replace(/eyJ[\w.-]+/g,'').slice(0,210));return j.data}
  async function call(p){const j=await gql('mutation Journal($q:String!){'+service+'(question:$q)}',{q:JSON.stringify(p)});return JSON.parse(j[service])}
  function auth(next){authNext=next||null;put('authMsg','');$('auth').showModal();$('username').focus()}
  async function sign(register){const name=$('username').value.trim(),password=$('password').value;if(!name||!password){put('authMsg','请填写用户名和密码。');return}
    const buttons=$('authForm').querySelectorAll('button');buttons.forEach(b=>b.disabled=true);
    try{const d=await gql('mutation Login($u:String!,$p:String!,$r:Boolean!){authenticateWithUsername(username:$u,password:$p,register:$r){account{id} jwt{token}}}',{u:name,p:password,r:register},false),a=d.authenticateWithUsername;
      if(!a?.jwt?.token)throw Error('登录未完成。');const u={id:String(a.account.id),name,token:a.jwt.token};sessionStorage.setItem(authKey,JSON.stringify(u));resetSession(u);$('password').value='';$('auth').close();await list();const next=authNext;authNext=null;if(next)next()
    }catch(e){put('authMsg',e.message)}finally{buttons.forEach(b=>b.disabled=false)}}
  $('authForm').onsubmit=e=>{e.preventDefault();sign(false)};$('register').onclick=()=>sign(true);
  for(const b of document.querySelectorAll('[data-close]'))b.onclick=()=>b.closest('dialog').close();
  $('identity').onclick=()=>{if(!user)return auth();sessionStorage.removeItem(authKey);resetSession(null)};
  function paintList(){const box=$('tasks');box.replaceChildren();if(!items.length){box.append(tag('p',user?'没有符合条件的任务。':'登录后显示任务列表。','meta'))}
    for(const t of items){const b=tag('button');b.setAttribute('aria-current',String(byId(t)===selected));b.append(tag('small','#'+t.id+' · '+(t.task_status||'无状态')),tag('span',t.request_text||'未记录要求'));b.onclick=()=>choose(byId(t));box.append(b)}
    $('more').hidden=!more;$('filter').disabled=!user}
  function paint(){put('identity',user?(user.name||'当前账号')+' · 退出':'登录');paintList();$('detail').hidden=!task;$('empty').hidden=!!task;
    if(!task){put('emptyTitle',user?'选择一条任务':'登录查看运行记录');put('emptyHint',user?'提交新任务，或从列表打开已有记录。':'使用你的小屋账号，查看自己的任务和交付结果。');put('emptyAction',user?'提交任务':'登录小屋账号');return}
    put('taskNo','任务 #'+task.id);put('taskState',task.task_status||'未记录');put('request',task.request_text||'未记录用户要求');put('taskWhen','提交于 '+when(task.created_at)+' · 第 '+(task.attempt_count??'—')+' 次尝试');
    put('deliveryText',task.delivery_advice);$('delivery').hidden=!task.delivery_advice;paintMetrics();paintEvents();paintActions()}
  function paintMetrics(){const runs=events.filter(e=>!['submit','return','retry','confirm','attachment'].includes(e.stage_key)),dur=runs.filter(e=>number(e.duration_ms)),tokens=runs.filter(e=>number(e.total_tokens)),amounts=runs.filter(e=>number(e.cost_amount)&&e.cost_currency),sums=new Map();
    for(const r of amounts)sums.set(r.cost_currency,(sums.get(r.cost_currency)||0)+Number(r.cost_amount));const box=$('metrics');box.replaceChildren();
    function metric(label,value,n){const d=tag('div');d.append(tag('small',label),tag('strong',value),tag('small',n?'已记录 '+n+' / '+runs.length+' 个步骤'+(moreEvents?' · 当前页':''):'暂无可汇总记录'));box.append(d)}
    metric('执行耗时',dur.length?elapsed(dur.reduce((n,e)=>n+Number(e.duration_ms),0)):'未记录',dur.length);
    metric('Token 用量',tokens.length?tokens.reduce((n,e)=>n+Number(e.total_tokens),0).toLocaleString():'未提供',tokens.length);
    metric('费用',amounts.length?[...sums].map(([c,v])=>v.toLocaleString('zh-CN',{maximumFractionDigits:8})+' '+c).join(' / '):'未提供',amounts.length)}
  function safeURL(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null}catch{return null}}
  const imageCache=new Map();
  async function imageFor(id,img,v){try{const k=user?.id+':'+id;let u=imageCache.get(k);if(!u||Date.now()-u.at>60000){const d=await gql('query JournalImage($id:bigint!){getImageById(imageId:$id){id url}}',{id:String(id)});const url=safeURL(d.getImageById?.url);if(!url)throw Error();u={url,at:Date.now()};imageCache.set(k,u)}if(same(v)&&img.isConnected)img.src=u.url}catch{if(img.isConnected)img.alt='这张交付图片目前无法访问。'}}
  function paintEvents(){const list=$('timeline'),opened=new Set([...list.querySelectorAll('details[open]')].map(d=>d.dataset.id));list.replaceChildren();put('eventCount',events.length+' 条记录'+(moreEvents?' · 还有后续':''));$('moreEvents').hidden=!moreEvents;
    if(!events.length)list.append(tag('li','这项任务尚未写入事件。','meta'));
    for(const e of events){const li=tag('li',undefined,'event'+(e.failure_code?' error-mark':'')),h=tag('h4',e.stage_name||'任务事件');h.append(tag('span',e.stage_status||'已记录','etag'));li.append(h,tag('div',(e.agent_role||'角色未记录')+' · '+when(e.result_json?.finished_at||e.created_at)+' · 第 '+(e.attempt_number??'—')+' 次','meta'));
      if(e.summary)li.append(tag('p',e.summary));const d=tag('details');d.dataset.id=String(e.id);d.open=opened.has(d.dataset.id)||events.length===1||!!e.failure_code;d.append(tag('summary','查看判断、交接与结果'));
      function row(label,v){if(v===null||v===undefined||v==='')return;const p=tag('p');p.append(tag('strong',label),document.createTextNode(String(v)));d.append(p)}
      row('方案',e.decision);row('判断依据',e.reason);row('交给',e.handoff);row('人工决定',e.human_decision);
      const result=e.result_json;if(result?.text)row('结果',result.text);else if(result&&!result.image_id&&!result.finished_at)row('结果',typeof result==='string'?result:JSON.stringify(result,null,2));
      const link=safeURL(e.result_link);if(link){const a=tag('a','打开交付结果 ↗');a.href=link;a.rel='noopener noreferrer';a.target='_blank';d.append(a)}
      if(result?.image_id){const img=tag('img');img.alt='任务 #'+task.id+' 的交付图片';img.loading='lazy';li.append(img);queueMicrotask(()=>imageFor(result.image_id,img,epoch))}
      row('异常',[e.failure_code,e.failure_message].filter(Boolean).join(' · '));row('模型',e.model_name);
      if(number(e.duration_ms)||e.agent_role?.includes('Agent')){row('耗时',elapsed(e.duration_ms));row('Token',['输入 '+(e.input_tokens??'未提供'),'输出 '+(e.output_tokens??'未提供'),'合计 '+(e.total_tokens??'未提供')].join(' / '));row('费用',number(e.cost_amount)?String(e.cost_amount)+' '+(e.cost_currency||'币种未记'):'未提供');row('费用来源',e.cost_source)}
      li.append(d);list.append(li)}}
  function paintActions(){const s=task.task_status,managed=task.managed;put('nextAction',!managed?'这项任务由原工作流管理，此处可查阅其记录。':s==='失败'?(task.last_failure||'步骤失败，可重试。'):s==='待补充'?'检查发现缺口。可以退回补充，也可以写明原因后确认交付。':active.has(s)?'后台会保存每个步骤，离开后仍可回来查看。':'');
    $('noteRow').hidden=!managed||!['待确认','待补充','失败'].includes(s);$('advance').hidden=!managed||!active.has(s)||!!inspectJob;
    $('retry').hidden=!managed||s!=='失败';$('redo').hidden=!managed||!['待确认','待补充','失败'].includes(s);$('confirm').hidden=!managed||!['待确认','待补充'].includes(s);
    $('attach').hidden=!managed;for(const b of $('actions').querySelectorAll('button'))b.disabled=locked}
  async function list(append=false){if(!user)return;const v=epoch,n=++listReq;try{const r=await call({op:'list',status:$('filter').value,before:append&&items.length?byId(items.at(-1)):null});if(!same(v)||n!==listReq)return;
      items=append?[...items,...r.tasks.filter(t=>!items.some(a=>byId(a)===byId(t)))]:r.tasks;more=r.more;paintList();
      if(!selected&&items.length)await choose(byId(items[0]))
    }catch(e){if(same(v))message(e.message)}}
  function schedule(){clearTimeout(timer);if(task&&active.has(task.task_status)&&!document.hidden)timer=setTimeout(()=>detail(false),3500)}
  async function detail(append=false){if(!selected||!user)return;const id=selected,v=epoch,n=++detailReq;try{const r=await call({op:'detail',id,after:append&&events.length?byId(events.at(-1)):null});if(!same(v)||id!==selected||n!==detailReq)return;
      task=r.task;events=append?[...events,...r.events]:r.events;moreEvents=r.more;items=items.map(t=>byId(t)===id?task:t);if(!active.has(task.task_status))inspectJob=null;paint();
      if(inspectJob&&active.has(task.task_status)){const handle=inspectJob;
        const state=(await gql('query WorkerState($id:bigint!){'+worker+'_result(taskId:$id){status}}',{id:handle}))[worker+'_result']?.status;
        if(n===detailReq&&selected===id&&same(v)&&inspectJob===handle&&['COMPLETED','FAILED','CANCELLED','CANCELED'].includes(state)){inspectJob=null;paintActions();if(state!=='COMPLETED')message('后台执行已中断。可点「继续执行」从已保存的步骤恢复。')}}
    }catch(e){if(same(v)&&id===selected)message(e.message)}finally{if(n===detailReq&&same(v))schedule()}}
  async function choose(id){clearTimeout(timer);selected=String(id);inspectJob=null;events=[];task=null;$('note').value='';message('');paint();await detail()}
  async function start(id){const v=epoch;const data=await gql('mutation RunJournal($q:String!){'+worker+'(question:$q)}',{q:JSON.stringify({op:'run',id})});if(same(v)&&selected===id){inspectJob=String(data[worker]);message('后台已受理，可以离开页面。');await detail()}}
  function newTask(){put('submitMsg','');$('newTask').showModal();$('brief').focus()}
  $('compose').onclick=()=>user?newTask():auth(newTask);$('emptyAction').onclick=()=>user?newTask():auth();
  $('taskForm').onsubmit=async e=>{e.preventDefault();const text=$('brief').value.trim();if(!text)return;const v=epoch;if(!pendingKey||pendingKey.text!==text)pendingKey={text,key:crypto.randomUUID()};$('submit').disabled=true;
    try{put('submitMsg','正在提交…');const r=await call({op:'submit',...pendingKey});if(!same(v))return;pendingKey=null;$('brief').value='';$('newTask').close();$('filter').value='';await choose(byId(r.task));await list();await start(byId(r.task))}
    catch(e){put('submitMsg',e.message);message(e.message)}finally{$('submit').disabled=false}};
  async function act(fn){if(locked||!task)return;const id=selected,v=epoch;locked=true;paintActions();message('');try{await fn(id);if(same(v)&&id===selected)await detail()}catch(e){if(same(v))message(e.message)}finally{if(same(v)){locked=false;if(task)paintActions()}}}
  $('advance').onclick=()=>act(start);
  for(const [id,op] of [['confirm','confirm'],['redo','return'],['retry','retry']])$(id).onclick=()=>act(async taskId=>{const note=$('note').value.trim();if((op==='return'||op==='confirm'&&task.task_status==='待补充')&&!note)throw Error('请先填写处理意见。');
    await call({op,id:taskId,key:crypto.randomUUID(),attempt:Number(task.attempt_count),note});$('note').value='';if(op!=='confirm')await start(taskId);else message('人工确认已记录。')});
  $('attach').onclick=()=>$('file').click();
  $('file').onchange=()=>{const file=$('file').files[0];$('file').value='';if(!file)return;act(async id=>{
    const format={'image/png':'PNG','image/jpeg':'JPEG','image/webp':'WEBP'}[file.type];if(!format||file.size>10*1024*1024)throw Error('请选择 10 MB 以内的 PNG、JPEG 或 WebP 图片。');
    const bytes=await file.arrayBuffer();const img=await createImageBitmap(file);img.close();
    const sum=btoa(SparkMD5.ArrayBuffer.hash(bytes,true));message('正在上传交付图片…');
    const d=await gql('query Upload($m:String!,$f:MediaFormat!){imagePresignedUrlV2(imgMd5Base64:$m,imageSuffix:$f,acl:PRIVATE){imageId uploadUrl uploadHeaders}}',{m:sum,f:format}),a=d.imagePresignedUrlV2;
    if(!a?.imageId)throw Error('未取得图片编号。');if(a.uploadUrl){const url=safeURL(a.uploadUrl);if(!url)throw Error('无效上传地址。');
      let h=typeof a.uploadHeaders==='string'?JSON.parse(a.uploadHeaders):a.uploadHeaders||{};if(Array.isArray(h))h=Object.fromEntries(h.map(x=>Array.isArray(x)?x:[x.key||x.name,x.value]));
      const r=await fetch(url,{method:'PUT',headers:h,body:file,credentials:'omit'});if(!r.ok)throw Error('图片上传失败（'+r.status+'）。')}
    await call({op:'attach',id,image:String(a.imageId),key:crypto.randomUUID(),note:$('noteRow').hidden?'':$('note').value});message('图片已保存到本次任务。')})};
  $('filter').onchange=()=>{selected='';task=null;events=[];inspectJob=null;clearTimeout(timer);paint();list()};$('refresh').onclick=async()=>{await list();await detail()};$('more').onclick=()=>list(true);$('moreEvents').onclick=()=>detail(true);
  for(const state of states)$('filter').add(new Option(state,state));document.addEventListener('visibilitychange',()=>{if(!document.hidden&&task)detail();else clearTimeout(timer)});
  paint();list()
})();
