function setupClub({call,login,user,house,show}){
  const $=id=>document.getElementById(id),plans=$('clubPlans'),pool=$('clubPool');
  let sub=null,payment=null,payTimer=0,version=0,table=null,gameRoom=null,refreshTimer=0,anim=0,busy=false,gameEpoch=0;
  const names={basic:'基础版',deluxe:'豪华版'},states={PENDING:'待支付',PAID:'已支付',CANCELLED:'已取消',REFUNDED:'已退款'};
  const date=t=>new Date(t).toLocaleDateString('zh-CN',{timeZone:'Asia/Shanghai'}),money=c=>'¥'+(c/100).toFixed(2);
  const note=(id,t)=>$(id).textContent=t;
  function paintPlans(){
    $('clubLogin').hidden=!!user();
    note('clubAccount',sub&&names[sub.plan]?'当前为'+names[sub.plan]+'，有效至 '+date(sub.until):'按月开通，到期手动续订。');
    note('clubGate',sub?.ready?'用微信扫一扫支付，到账后在这里查看会员状态。':'微信扫码收款暂未开放。');
    $('clubHistory').hidden=!sub?.orders?.length;$('clubOrders').replaceChildren();
    for(const o of sub?.orders||[]){const li=document.createElement('li');li.textContent='订单 '+o.id+' · '+names[o.plan]+' · '+money(o.cents)+' · '+(states[o.state]||o.state);$('clubOrders').append(li)}
    for(const [id,plan] of [['clubBasic','basic'],['clubDeluxe','deluxe']]){$(id).textContent=sub?.plan===plan?'当前套餐':'选择'+names[plan];$(id).disabled=!!(sub&&sub.plan!=='none')}
  }
  async function plansOpen(){const v=++version;clearTimeout(payTimer);payment=null;$('clubCashier').hidden=true;$('clubQR').hidden=true;sub=null;paintPlans();show('clubPlans');
    if(user()){try{const data=await call('membership');if(v===version&&plans.open){sub=data;paintPlans()}}catch(e){if(v===version)note('clubGate',e.message)}}}
  async function requirePlan(plan){sub=await call('membership');if(sub.plan==='deluxe'||sub.plan===plan)return true;await plansOpen();note('clubGate','此功能需要'+names[plan]+'。'+(sub?.ready?'':'微信扫码收款暂未开放。'));return false}
  async function refreshPay(){if(!payment||!plans.open)return;const current=payment;clearTimeout(payTimer);
    try{let r=await call('orderStatus',{order:current.order.id});if(payment!==current)return;
      if(r.order.state==='PENDING'){const latest=await merchant('/status',current);if(latest.confirmed||latest.closed)r=await call('orderStatus',{order:current.order.id})}if(payment!==current)return;
      if(r.order.state!=='PENDING'){await plansOpen();note('clubGate',r.order.state==='PAID'?'已收到微信付款，会员已开通。':'订单状态：'+states[r.order.state]);return}
      note('clubGate','等待微信确认订单 '+r.order.id+' 的收款结果。')
    }catch(e){if(payment===current)note('clubGate',e.message)}
    if(payment===current&&plans.open)payTimer=setTimeout(refreshPay,4000)
  }
  async function merchant(path,current){const r=await fetch(current.endpoint+path,{method:'POST',credentials:'omit',headers:{'Content-Type':'application/json'},body:JSON.stringify({order:current.order.id,token:current.token}),signal:AbortSignal.timeout(16000)});const data=await r.json();if(!r.ok)throw Error(data.message||'微信收银台暂时不可用。');return data}
  $('clubLogin').onclick=()=>{plans.close();login(plansOpen)};
  async function purchase(plan){if(!user()){note('clubGate',names[plan]+' · '+money(plan==='basic'?3990:5990)+' / 月。登录后可查看开通状态。');return}
    $('clubBasic').disabled=$('clubDeluxe').disabled=true;
    const v=version;try{if(!sub?.ready){note('clubGate',names[plan]+' · '+money(plan==='basic'?3990:5990)+' / 月。微信收款暂未开放，当前无需付款。');return}
      const current=await call('checkout',{plan,key:crypto.randomUUID()});if(v!==version)return;payment=current;$('clubCashier').hidden=false;
      note('clubBill',names[current.order.plan]+' · '+money(current.order.cents)+' · 订单 '+current.order.id);$('clubQR').hidden=true;
      if(current.order.plan!==plan){note('clubGate','已有另一档套餐的待支付订单。请先取消，再选择新套餐。');return}
      const result=await merchant('/checkout',current);if(v!==version)return;if(result.qr&&/^data:image\/png;base64,[a-z\d+/=]+$/i.test(result.qr)){$('clubQR').src=result.qr;$('clubQR').hidden=false}await refreshPay()
    }catch(e){if(v===version)note('clubGate',e.message)}finally{if(v===version)$('clubBasic').disabled=$('clubDeluxe').disabled=!!(sub&&sub.plan!=='none')}}
  plans.addEventListener('close',()=>{version++;clearTimeout(payTimer);payment=null;$('clubQR').removeAttribute('src')});
  $('clubBasic').onclick=()=>purchase('basic');$('clubDeluxe').onclick=()=>purchase('deluxe');$('clubRefresh').onclick=refreshPay;
  $('clubCancel').onclick=async()=>{if(!payment)return;const current=payment;try{await merchant('/cancel',current);if(current===payment)await refreshPay()}catch(e){note('clubGate',e.message)}};
  $('clubEntry').onclick=plansOpen;
  const canvas=$('poolTable'),ctx=canvas.getContext('2d'),palette=['#fff5d9','#e2ae40','#477fc1','#be5543','#936aab','#d8824e','#65886c'];
  function draw(balls){ctx.clearRect(0,0,720,360);ctx.fillStyle='#70513d';ctx.fillRect(0,0,720,360);ctx.fillStyle='#2c6b58';ctx.fillRect(9,9,702,342);ctx.fillStyle='#152e28';
    for(const [x,y] of [[16,16],[360,12],[704,16],[16,344],[360,348],[704,344]]){ctx.beginPath();ctx.arc(x,y,16,0,Math.PI*2);ctx.fill()}
    const cue=balls[0];if(!anim&&!cue.out){const a=Number($('poolAngle').value)*Math.PI/180;ctx.save();ctx.setLineDash([5,6]);ctx.strokeStyle='#e4efcd';ctx.beginPath();ctx.moveTo(cue.x,cue.y);ctx.lineTo(cue.x+105*Math.cos(a),cue.y+105*Math.sin(a));ctx.stroke();ctx.restore()}
    for(const b of balls){if(b.out)continue;ctx.beginPath();ctx.fillStyle=palette[b.n];ctx.arc(b.x,b.y,10.5,0,Math.PI*2);ctx.fill();if(b.n){ctx.fillStyle='white';ctx.beginPath();ctx.arc(b.x,b.y,5.6,0,Math.PI*2);ctx.fill();ctx.fillStyle='#26392f';ctx.font='bold 9px sans-serif';ctx.textAlign='center';ctx.fillText(b.n,b.x,b.y+3)}}
  }
  function poolView(){if(!table)return;const {board:b,side,solo}=table;draw(b.balls);note('poolScore',solo?'已进 '+b.score[0]+' / 6 球':'房主 '+b.score[0]+' ∶ '+b.score[1]+' 好友');
    note('poolTurn',b.done?'本局结束':solo?'单人练习':b.turn===side?'轮到你击球':'等待对方击球');$('poolHit').disabled=busy||b.done||b.turn!==side;$('poolNew').disabled=busy||!solo&&!b.done}
  function stopPool(){gameEpoch++;clearTimeout(refreshTimer);cancelAnimationFrame(anim);anim=0;busy=false;table=null}
  async function syncGame(){const v=gameEpoch;try{const r=await call('poolOpen',{},gameRoom);if(v===gameEpoch&&!busy&&pool.open){table=r;poolView()}}catch(e){if(v===gameEpoch)note('poolNote',e.message)}if(v===gameEpoch&&pool.open)refreshTimer=setTimeout(syncGame,2500)}
  async function openPool(){if(!await requirePlan('deluxe'))return;stopPool();const v=gameEpoch,r=house();gameRoom=r?.kind==='human'&&r.joined?r.id:null;table=await call('poolOpen',{},gameRoom);if(v!==gameEpoch)return;show('clubPool');
    note('poolNote',table.solo?'点桌面瞄准，调好力度后击球。':'双方轮流击球，进球后继续。白球落袋换手。');poolView();if(!table.solo)refreshTimer=setTimeout(syncGame,2500)}
  pool.addEventListener('close',stopPool);
  $('clubGame').onclick=()=>login(()=>openPool().catch(e=>{note('cpBannerState',e.message)}));
  canvas.onclick=e=>{if(!table||busy)return;const r=canvas.getBoundingClientRect(),b=table.board.balls[0];$('poolAngle').value=Math.round(Math.atan2((e.clientY-r.top)*360/r.height-b.y,(e.clientX-r.left)*720/r.width-b.x)*180/Math.PI);$('poolAngle').oninput()};
  $('poolAngle').oninput=()=>{note('poolDegrees',$('poolAngle').value+'°');if(table&&!busy)draw(table.board.balls)};$('poolPower').oninput=()=>note('poolForce',$('poolPower').value+'%');
  async function play(reset){if(!table||busy)return;busy=true;poolView();const v=gameEpoch,prev=table,angle=Number($('poolAngle').value)*Math.PI/180,power=Number($('poolPower').value);
    try{const result=await call(reset?'poolReset':'poolShot',{rev:prev.rev,angle,power},gameRoom);if(v!==gameEpoch)return;table=result;
      if(!reset){const frames=[];strike(prev.board,angle,power,prev.solo,frames);const start=performance.now();
        const next=t=>{if(v!==gameEpoch)return;const i=Math.floor((t-start)/18);if(i<frames.length){draw(frames[i]);anim=requestAnimationFrame(next)}else{anim=0;busy=false;poolView()}};anim=requestAnimationFrame(next);return}
    }catch(e){if(v===gameEpoch){note('poolNote',e.message);try{table=await call('poolOpen',{},gameRoom)}catch{}}}
    if(v===gameEpoch){busy=false;poolView()}}
  $('poolHit').onclick=()=>play(false);$('poolNew').onclick=()=>play(true);
  return {requirePlan,plansOpen,reset(){if(pool.open)pool.close();if(plans.open)plans.close();sub=null}}
}
