const AvatarMesh=(()=>{
  const oval=[10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109];
  function measure(photo,points,edges){
    const w=photo.width,h=photo.height,px=points.slice(0,468).map(p=>({x:p.x*w,y:p.y*h,z:p.z*w}));
    const xs=oval.map(i=>px[i].x),ys=oval.map(i=>px[i].y);
    const left=Math.min(...xs),right=Math.max(...xs),top=Math.min(...ys),bottom=Math.max(...ys);
    if(right-left<40||bottom-top<62)throw Error('脸部在照片中太小，请选择更近的正面自拍。');
    if(left<0||top<0||right>=w||bottom>=h)throw Error('请让额头和下巴都完整出现在照片里。');
    const eyeA=px[33],eyeB=px[263],a=Math.atan2(eyeB.y-eyeA.y,eyeB.x-eyeA.x);
    if(Math.abs(a)>.50||Math.abs((px[1].x-left)/(right-left)-.5)>.25)throw Error('请使用正面自拍，脸部朝向镜头。');
    const x0=(px[234].x+px[454].x)/2,y0=(px[10].y+px[152].y)/2;
    const cs=Math.cos(a),sn=Math.sin(a),midZ=(px[234].z+px[454].z)/2;
    const scale=.191/Math.max(1,(px[152].y-px[10].y)*cs-(px[152].x-px[10].x)*sn);
    const coords=[],uv=[],triangles=[];
    for(const p of px){
      const dx=p.x-x0,dy=p.y-y0;
      coords.push((dx*cs+dy*sn)*scale,(-dy*cs+dx*sn)*scale,(midZ-p.z)*scale);
      uv.push((p.x-left)/(right-left),1-(p.y-top)/(bottom-top));
    }
    for(let i=0;i+2<edges.length;i+=3){const a=edges[i],b=edges[i+1],c=edges[i+2];
      if(a.end===b.start&&b.end===c.start&&c.end===a.start&&[a.start,b.start,c.start].every(id=>id<468))triangles.push(a.start,b.start,c.start);
    }
    if(triangles.length<1500)throw Error('面部网格未完成，请重新载入页面。');
    // Face Mesh leaves the eye openings and inner lips hollow. Close each contour
    // with the same UV projection so the portrait also supplies eyes and teeth.
    for(const loop of [
      [33,246,161,160,159,158,157,173,133,155,154,153,145,144,163,7],
      [263,466,388,387,386,385,384,398,362,382,381,380,374,373,390,249],
      [78,191,80,81,82,13,312,311,310,415,308,324,318,402,317,14,87,178,88,95]
    ]){
      const center=coords.length/3,avg=(arr,step,k)=>loop.reduce((v,id)=>v+arr[id*step+k],0)/loop.length;
      coords.push(avg(coords,3,0),avg(coords,3,1),avg(coords,3,2)+.001);uv.push(avg(uv,2,0),avg(uv,2,1));
      for(let i=0;i<loop.length;i++){const a=loop[i],b=loop[(i+1)%loop.length],cross=(coords[a*3]-coords[center*3])*(coords[b*3+1]-coords[center*3+1])-(coords[a*3+1]-coords[center*3+1])*(coords[b*3]-coords[center*3]);triangles.push(center,cross<0?b:a,cross<0?a:b)}
    }
    const src=photo.getContext('2d'),skinSamples=[50,280,101,330,117,346].map(i=>src.getImageData(Math.min(w-1,Math.max(0,Math.round(px[i].x))),Math.min(h-1,Math.max(0,Math.round(px[i].y))),1,1).data);
    const rgb=[0,1,2].map(k=>Math.round(skinSamples.map(s=>s[k]).sort((a,b)=>a-b).slice(1,-1).reduce((a,b)=>a+b,0)/4));
    const skin='#'+rgb.map(v=>v.toString(16).padStart(2,'0')).join('');
    const tex=document.createElement('canvas');tex.width=384;tex.height=480;const ctx=tex.getContext('2d');ctx.fillStyle=skin;ctx.fillRect(0,0,384,480);
    ctx.save();ctx.beginPath();for(const [n,id] of oval.entries()){const x=uv[id*2]*384,y=(1-uv[id*2+1])*480;n?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.closePath();ctx.clip();
    ctx.drawImage(photo,left,top,right-left,bottom-top,0,0,384,480);ctx.restore();
    return {coordinates:coords.map(v=>+v.toFixed(6)),uv:uv.map(v=>+v.toFixed(6)),triangles,skin,texture:tex.toDataURL('image/jpeg',.92)};
  }
  async function make(face,settings){
    const T=THREE,root=new T.Group();root.name='DuitPortrait';root.userData={duitAvatarVersion:1,heightCm:settings.height};
    const shape=new T.Group();root.add(shape);
    const shade=(c,v)=>'#'+new T.Color(c).lerp(new T.Color(v>0?'#fff1db':'#231e20'),Math.abs(v)).getHexString();
    const skin=face?.skin||'#c89473',shirt=settings.shirt||'#688475',trousers=settings.trousers||'#434b55',width=settings.width/39*(170/settings.height);
    const material=(c,opts={})=>new T.MeshStandardMaterial({color:new T.Color(c).convertSRGBToLinear(),roughness:.83,...opts});
    const cache=new Map();function m(c){if(!cache.has(c))cache.set(c,material(c));return cache.get(c)}
    function mesh(p,name,g,mat,x,y,z){const o=new T.Mesh(g,mat);o.name=name;o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;p.add(o);return o}
    function ell(p,name,x,y,z,rx,ry,rz,c){const o=mesh(p,name,new T.SphereGeometry(1,24,16),m(c),x,y,z);o.scale.set(rx,ry,rz);return o}
    function joint(p,name,x,y,z){const o=new T.Group();o.name=name;o.position.set(x,y,z);p.add(o);return o}
    function form(p,name,x,y,z,rows,c){const pos=[],idx=[],n=32;
      rows.forEach(([yy,rx,rz,zz=0],i)=>{for(let k=0;k<n;k++){const a=2*Math.PI*k/n;pos.push(Math.sin(a)*rx,yy,Math.cos(a)*rz+zz);if(!i)continue;
        const b=(i-1)*n+k,e=(i-1)*n+(k+1)%n;idx.push(b,e,b+n,e,e+n,b+n)}});const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();
      return mesh(p,name,g,m(c),x,y,z)}
    form(shape,'Jersey',0,.91,0,[[0,.16*width,.103],[.05,.175*width,.105],[.17,.153*width,.102],[.35,.179*width,.119],[.46,.201*width,.095],[.49,.094,.075],[.5,.068,.063]],shirt);
    form(shape,'RibbedHem',0,.905,0,[[0,.16*width,.103],[.032,.17*width,.107]],shade(shirt,-.12));
    form(shape,'Collar',0,1.384,0,[[0,.092,.076],[.019,.084,.072],[.03,.062,.061]],shade(shirt,-.18));
    ell(shape,'Neck',0,1.417,-.003,.057,.091,.055,skin);
    ell(shape,'Waist',0,.91,-.006,.164*width,.117,.106,trousers);
    const limbs=[];
    for(const sign of [-1,1]){const side=sign<0?'Left':'Right',leg=joint(shape,side+'Hip',sign*.087*width,.90,0);
      form(leg,side+'Trouser',0,0,0,[[-.43,.065,.066],[-.34,.076,.08],[-.13,.085,.096],[0,.086,.093]],trousers);
      const shin=joint(leg,side+'Knee',0,-.405,0);
      form(shin,side+'Shin',0,0,0,[[-.39,.051,.054],[-.33,.055,.058],[-.14,.067,.076],[0,.067,.07]],trousers);
      ell(shin,side+'Shoe',0,-.418,.040,.069,.056,.133,'#d9c9ab');
      ell(shin,side+'Sole',0,-.449,.040,.071,.020,.135,'#85725f');
      const arm=joint(shape,side+'Shoulder',sign*.188*width,1.346,0);arm.rotation.z=sign*.095;
      ell(arm,side+'Sleeve',sign*.016,-.060,0,.073,.117,.080,shirt);
      form(arm,side+'Forearm',sign*.028,0,0,[[-.46,.031,.034],[-.34,.045,.048],[-.25,.044,.045],[-.15,.050,.055],[-.075,.05,.055]],skin);
      ell(arm,side+'Hand',sign*.032,-.490,.012,.036,.079,.030,skin);limbs.push({leg,shin,arm,sign});}
    const head=joint(shape,'Head',0,1.554,.003);
    if(face){
      const tex=await new Promise((ok,no)=>new T.TextureLoader().load(face.texture,ok,undefined,no));tex.encoding=T.sRGBEncoding;tex.flipY=true;
      const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(face.coordinates,3));g.setAttribute('uv',new T.Float32BufferAttribute(face.uv,2));g.setIndex(face.triangles);g.computeVertexNormals();
      mesh(head,'PortraitFace',g,new T.MeshStandardMaterial({map:tex,side:T.DoubleSide,roughness:1}),0,0,0);
      const rings=[[1,1,0,0],[1.04,1.06,-.034,.004],[.95,1.11,-.074,.010],[.68,.89,-.111,.017],[.04,.07,-.135,.018]],pos=[],idx=[];
      rings.forEach(([sx,sy,zz,yy],r)=>oval.forEach((id,k)=>{const [x,y,z]=face.coordinates.slice(id*3,id*3+3);pos.push(x*sx,y*sy+yy,z/(1+r*2)+zz);if(r){const n=oval.length,b=(r-1)*n+k,e=(r-1)*n+(k+1)%n;idx.push(b,b+n,e,e,b+n,e+n)}}));
      const hull=new T.BufferGeometry();hull.setAttribute('position',new T.Float32BufferAttribute(pos,3));hull.setIndex(idx);hull.computeVertexNormals();mesh(head,'Cranium',hull,material(skin,{side:T.DoubleSide}),0,0,0);
    }else{ell(head,'MannequinFace',0,.003,-.004,.079,.105,.076,skin);
      for(const sign of [-1,1])ell(head,'Eye'+sign,sign*.031,.018,.063,.006,.005,.004,'#554035');ell(head,'Nose',0,-.001,.070,.012,.019,.014,skin)}
    const fw=face?Math.max(.066,Math.abs(face.coordinates[234*3]-face.coordinates[454*3])*.51):.082;
    for(const sign of [-1,1])ell(head,'Ear'+sign,sign*fw,.006,-.004,.012,.024,.014,skin);
    if(settings.hair!=='none'){
      const hair=settings.hairColor||'#372e2b';const cap=new T.SphereGeometry(1,44,24,0,Math.PI*2,0,Math.PI*.58);const v=cap.attributes.position;
      for(let i=0;i<v.count;i++){const nx=v.getX(i),ny=v.getY(i),nz=v.getZ(i);const front=Math.max(0,nz),back=Math.max(0,-nz);v.setXYZ(i,nx*fw*1.13,.045+ny*.087+front*.033-back*(settings.hair==='bob'?.098:.049),-.038+nz*.096)}
      cap.computeVertexNormals();mesh(head,'Hair',cap,material(hair,{side:T.DoubleSide}),0,0,0);
      for(let i=0;i<21;i++){
        const angle=i*2*Math.PI/21,points=[];
        for(let n=0;n<=10;n++){const t=n/10,p=.18+t*(1.38+(i%3)*.045),a=angle-.33*(1-t),x=Math.sin(p)*Math.sin(a),z=Math.sin(p)*Math.cos(a);
          points.push(new T.Vector3(x*fw*1.145,.047+Math.cos(p)*.088+Math.max(0,z)*.033-Math.max(0,-z)*(settings.hair==='bob'?.098:.049),-.038+z*.097))}
        mesh(head,'HairLock'+i,new T.TubeGeometry(new T.CatmullRomCurve3(points),12,.0017,5,false),m(shade(hair,i%4===0?.07:-.04)),0,0,0);
      }
    }
    shape.updateMatrixWorld(true);let bounds=new T.Box3().setFromObject(shape);const factor=settings.height/100/(bounds.max.y-bounds.min.y);
    shape.scale.setScalar(factor);shape.position.y=-bounds.min.y*factor;
    for(const armature of limbs)armature.arm.position.x=armature.sign*settings.width/200/factor;
    const times=[0,.25,.5,.75,1],tracks=[];for(const {leg,shin,arm,sign} of limbs){
      for(const [node,angles] of [[leg,[.46,0,-.46,0,.46].map(v=>v*sign)],[arm,[-.35,0,.35,0,-.35].map(v=>v*sign)],[shin,sign>0?[.05,.08,.55,.23,.05]:[.55,.23,.05,.08,.55]]]){
        const quats=[];for(const x of angles)quats.push(...new T.Quaternion().setFromEuler(new T.Euler(x,0,node.rotation.z)).toArray());tracks.push(new T.QuaternionKeyframeTrack(node.name+'.quaternion',times,quats))}
    }
    const idle=new T.AnimationClip('Idle',2,[new T.VectorKeyframeTrack('Head.position',[0,1,2],[0,1.554,.003,0,1.556,.003,0,1.554,.003])]);
    return {root,clips:[idle,new T.AnimationClip('Walk',1,tracks)]};
  }
  function dispose(root){const seen=new Set();root.traverse(o=>{if(!o.isMesh)return;o.geometry.dispose();for(const mat of [].concat(o.material))if(!seen.has(mat)){seen.add(mat);mat.map?.dispose();mat.dispose()}})}
  return {measure,make,dispose};
})();
