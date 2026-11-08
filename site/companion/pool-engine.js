function freshRack(){const balls=[{x:190,y:180,n:0}];let n=1;
  for(let i=0;i<3;i++)for(let j=0;j<=i;j++)balls.push({x:477+i*19.2,y:180+(j-i/2)*22.1,n:n++});
  return {balls,score:[0,0],turn:0,done:false}}
function strike(board,angle,power,solo,frames){
  const balls=board.balls.map(b=>({...b,vx:0,vy:0})),speed=2+power*.145;
  balls[0].vx=Math.cos(angle)*speed;balls[0].vy=Math.sin(angle)*speed;
  let sunk=0,scratch=false;const holes=[[16,16],[360,12],[704,16],[16,344],[360,348],[704,344]];
  for(let step=0;step<1000;step++){
    for(const b of balls){if(b.out)continue;b.x+=b.vx;b.y+=b.vy;
      if(holes.some(h=>Math.hypot(b.x-h[0],b.y-h[1])<18)){b.out=true;b.vx=b.vy=0;if(b.n)sunk++;else scratch=true;continue}
      if(b.x<22||b.x>698){b.x=Math.max(22,Math.min(698,b.x));b.vx*=-.87}if(b.y<22||b.y>338){b.y=Math.max(22,Math.min(338,b.y));b.vy*=-.87}}
    for(let i=0;i<balls.length;i++)for(let j=i+1;j<balls.length;j++){const a=balls[i],b=balls[j];if(a.out||b.out)continue;const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);if(d>=21||d<.001)continue;
      const nx=dx/d,ny=dy/d,fix=(21-d)/2;a.x-=fix*nx;a.y-=fix*ny;b.x+=fix*nx;b.y+=fix*ny;const v=(a.vx-b.vx)*nx+(a.vy-b.vy)*ny;
      if(v>0){a.vx-=v*nx;a.vy-=v*ny;b.vx+=v*nx;b.vy+=v*ny}}
    let moving=false;for(const b of balls){b.vx*=.984;b.vy*=.984;if(Math.hypot(b.vx,b.vy)<.055)b.vx=b.vy=0;else moving=true}
    if(frames&&step%3===0)frames.push(balls.map(b=>({x:b.x,y:b.y,n:b.n,out:b.out})));if(!moving)break;
  }
  if(scratch){for(let y=45;y<330;y+=26){let found=false;for(let x=80;x<675;x+=26){if(balls.slice(1).every(b=>b.out||Math.hypot(b.x-x,b.y-y)>22)){Object.assign(balls[0],{x,y,out:false});found=true;break}}if(found)break}}
  const score=board.score.slice();score[board.turn]+=sunk;
  return {balls:balls.map(({x,y,n,out})=>({x,y,n,out:!!out})),score,turn:solo?0:sunk&&!scratch?board.turn:1-board.turn,done:balls.slice(1).every(b=>b.out),scratch}
}
