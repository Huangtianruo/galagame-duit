(()=>{
  const $=id=>document.getElementById(id),T=THREE;
  const stage=$('stage'),use=$('use'),generate=$('generate');
  const inputIds=['name','height','width','hair','shirt','trousers','hairColor'];
  let shape,detector,photo=null,descriptor=null,record=null,preview,controls,camera,renderer,scene;
  let busy=false,readingPhoto=false,valid=false,closeup=false,uploadVersion=0,renderVersion=0;
  const message=(s,error=false)=>{$('status').textContent=s;$('status').dataset.error=String(error)};
  function settings(){
    const v=Object.fromEntries(inputIds.map(k=>[k,$(k).value]));
    v.name=v.name.trim()||'我的形象';v.height=Number(v.height);v.width=Number(v.width);
    if(v.height<60||v.height>230||!Number.isFinite(v.height))throw Error('身高请填写 60 至 230 厘米。');
    if(v.width<22||v.width>65||!Number.isFinite(v.width))throw Error('肩宽请填写 22 至 65 厘米。');
    return v;
  }
  function updateButtons(){generate.disabled=busy||readingPhoto;use.disabled=busy||readingPhoto||!valid;$('choose').disabled=busy;
    for(const id of inputIds)$(id).disabled=busy;$('download').hidden=!valid;$('download').disabled=busy;$('remove').hidden=!record;$('remove').disabled=busy}
  function aim(){
    if(!camera||!shape)return;const height=new T.Box3().setFromObject(shape.root).max.y;
    const y=height*(closeup?.919:.51),dist=height*(closeup?.37:2.50);
    controls.target.set(0,y,0);camera.position.set(dist*(closeup?.07:.34),y+dist*.09,dist);controls.minDistance=height*.18;controls.maxDistance=height*3;controls.update();
    $('full').setAttribute('aria-pressed',String(!closeup));$('face').setAttribute('aria-pressed',String(closeup));
  }
  function initStage(){
    renderer=new T.WebGLRenderer({antialias:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.outputEncoding=T.sRGBEncoding;renderer.shadowMap.enabled=true;
    renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
    const canvas=renderer.domElement;canvas.setAttribute('aria-label','可旋转的三维人物');stage.prepend(canvas);
    scene=new T.Scene();camera=new T.PerspectiveCamera(28,1,.02,25);
    controls=new T.OrbitControls(camera,canvas);controls.enablePan=false;controls.enableDamping=true;controls.autoRotateSpeed=1.3;
    controls.minPolarAngle=Math.PI*.12;controls.maxPolarAngle=Math.PI*.53;
    scene.add(new T.HemisphereLight(0xfff8e9,0xbfb8b1,.9));const key=new T.DirectionalLight(0xfff3dd,1.12);key.position.set(2,4,3);key.castShadow=true;
    key.shadow.mapSize.set(1024,1024);Object.assign(key.shadow.camera,{left:-2,right:2,top:2,bottom:-2});key.shadow.normalBias=.008;scene.add(key);
    const fill=new T.DirectionalLight(0xf0f7ff,.43);fill.position.set(-2,2,2);scene.add(fill);
    const plinth=new T.Mesh(new T.CylinderGeometry(.55,.58,.066,72),new T.MeshStandardMaterial({color:0xcbb9a7,roughness:.92}));plinth.position.y=-.035;plinth.receiveShadow=true;scene.add(plinth);
    const ground=new T.Mesh(new T.PlaneGeometry(20,20),new T.ShadowMaterial({opacity:.16}));ground.rotation.x=-Math.PI/2;ground.position.y=-.072;ground.receiveShadow=true;scene.add(ground);
    function size(){const w=stage.clientWidth,h=stage.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()}new ResizeObserver(size).observe(stage);size();
    function draw(){requestAnimationFrame(draw);controls.update();renderer.render(scene,camera)}draw();$('stageMsg').hidden=true;
  }
  async function show(face,config){
    const version=++renderVersion,next=await AvatarMesh.make(face,config);
    if(version!==renderVersion){AvatarMesh.dispose(next.root);return}
    if(shape){scene.remove(shape.root);AvatarMesh.dispose(shape.root)}shape=next;scene.add(next.root);aim();
    $('ruler').textContent=config.height+' cm';$('previewName').textContent=config.name;$('kind').textContent=face?'自拍形象':'体型预览';
  }
  async function getDetector(){
    if(!detector)detector=(async()=>{
      const base=new URL('./avatar/',location.href);
      const {FaceLandmarker,FilesetResolver}=await import(new URL('vision.mjs',base).href);
      const [wasm,data]=await Promise.all([FilesetResolver.forVisionTasks(new URL('wasm',base).href),fetch(new URL('face-model.txt',base))]);
      if(!data.ok)throw Error('面部识别资源没有载入，请重新生成。');
      const binary=atob(await data.text()),modelAssetBuffer=Uint8Array.from(binary,c=>c.charCodeAt(0));
      const engine=await FaceLandmarker.createFromOptions(wasm,{baseOptions:{modelAssetBuffer,delegate:'CPU'},runningMode:'IMAGE',numFaces:2,minFaceDetectionConfidence:.55,minFacePresenceConfidence:.5});
      return {engine,edges:FaceLandmarker.FACE_LANDMARKS_TESSELATION};
    })().catch(e=>{detector=null;throw e});return detector;
  }
  async function select(file){
    if(!file)return;const seq=++uploadVersion;readingPhoto=false;valid=false;photo=null;descriptor=null;updateButtons();
    $('thumb').hidden=true;$('photoIcon').hidden=false;$('fileLabel').textContent='选择一张自拍';
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>18*1024*1024){message('请选择小于 18 MB 的 JPG、PNG 或 WebP 图片。',true);return}
    if(!file.size){message('这张图片是空文件，请重新选择。',true);return}
    readingPhoto=true;updateButtons();message('正在读取照片…');
    const url=URL.createObjectURL(file);try{
      const img=new Image();img.src=url;await img.decode();if(seq!==uploadVersion)return;
      const scale=Math.min(1,1200/Math.max(img.naturalWidth,img.naturalHeight));const c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.naturalWidth*scale));c.height=Math.max(1,Math.round(img.naturalHeight*scale));
      c.getContext('2d',{willReadFrequently:true}).drawImage(img,0,0,c.width,c.height);photo=c;
      const thumb=document.createElement('canvas');thumb.width=96;thumb.height=96;const side=Math.min(c.width,c.height);thumb.getContext('2d').drawImage(c,(c.width-side)/2,(c.height-side)/2,side,side,0,0,96,96);
      $('thumb').src=thumb.toDataURL('image/jpeg',.8);$('thumb').hidden=false;$('photoIcon').hidden=true;$('fileLabel').textContent='更换自拍';
      $('kind').textContent='等待生成';message('自拍已在本机读取。请核对身高后生成。');
    }catch{if(seq===uploadVersion)message('无法读取这张图片，请另存为 JPG 后再试。',true)}finally{URL.revokeObjectURL(url);if(seq===uploadVersion){readingPhoto=false;updateButtons()}}
  }
  function roomURL(){const u=new URL('./index.html',location.href),q=new URL(location.href).searchParams;
    u.searchParams.set('v','member1');
    if(/^\d{1,20}$/.test(q.get('roomTask')||'')){u.searchParams.set('roomTask',q.get('roomTask'));u.searchParams.set('roomName',(q.get('roomName')||'我的房间').slice(0,100))}return u}
  const frameKey=new URLSearchParams(location.hash.slice(1)).get('editor');
  const embedded=frameKey&&window.parent!==window;
  const go=applied=>{if(embedded)window.parent.postMessage({type:applied?'duit-profile-applied':'duit-profile-back',nonce:frameKey},location.origin);else{const u=roomURL();if(applied)u.searchParams.set('enterAvatar','1');location.assign(u)}};
  $('back').onclick=()=>go(false);
  window.addEventListener('message',e=>{if(e.origin===location.origin&&e.source===window.parent&&e.data?.nonce===frameKey&&e.data.type==='duit-profile-error')message('形象已保存，但房间未能加载。可下载 GLB 并在房间内导入。',true)});
  $('choose').onclick=()=>$('file').click();$('file').onchange=()=>{select($('file').files[0]);$('file').value=''};
  $('full').onclick=()=>{closeup=false;aim()};$('face').onclick=()=>{closeup=true;aim()};
  $('turn').onclick=()=>{if(!controls)return;controls.autoRotate=!controls.autoRotate;$('turn').textContent=controls.autoRotate?'停止转动':'转动预览'};
  for(const id of inputIds)$(id).addEventListener('input',()=>{valid=false;updateButtons();message('信息已更改，点击「生成 3D 人物」更新模型。')});
  generate.onclick=async()=>{
    if(busy)return;if(!renderer){message('三维视口不可用，请开启浏览器硬件加速后刷新。',true);return}
    busy=true;valid=false;updateButtons();
    try{const config=settings();if(!descriptor&&!photo)throw Error('请先选择一张清晰的单人正面自拍。');
      if(!descriptor){message('正在本机载入面部识别模型，首次使用需要下载资源…');const {engine,edges}=await getDetector();
        message('正在识别面部轮廓…');await new Promise(ok=>requestAnimationFrame(()=>requestAnimationFrame(ok)));
        const faces=engine.detect(photo).faceLandmarks;if(!faces.length)throw Error('没有识别到正脸，请换一张光线清楚的单人自拍。');if(faces.length>1)throw Error('照片里有多张脸，请裁剪到只剩你自己。');
        descriptor=AvatarMesh.measure(photo,faces[0],edges);
      }
      await show(descriptor,config);valid=true;message('人物已生成，可切换到面部检查，或保存后进入房间。');
    }catch(e){message(e.message?.length<110?e.message:'面部建模失败，请检查网络后重试，或更换清晰的正面照片。',true)}finally{busy=false;updateButtons()}
  };
  function toGLB(){return new Promise((ok,no)=>{try{new T.GLTFExporter().parse(shape.root,b=>ok(new Blob([b],{type:'model/gltf-binary'})),{binary:true,animations:shape.clips,onlyVisible:true})}catch(e){no(e)}})}
  use.onclick=async()=>{if(!valid||busy)return;busy=true;updateButtons();message('正在保存人物模型…');
    try{const config=settings(),blob=await toGLB();const next={...config,version:1,revision:crypto.randomUUID(),face:descriptor,blob};await AvatarStore.set(next);record=next;try{sessionStorage.removeItem('duit.3d.v1.avatar.skip')}catch{}go(true)}
    catch{message('未能保存到本机。可下载人物 GLB，在房间内点击「导入」。',true)}finally{busy=false;updateButtons()}};
  $('download').onclick=async()=>{if(!valid||busy)return;busy=true;updateButtons();
    try{const blob=await toGLB(),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=settings().name.replace(/[\\/:*?"<>|]/g,'-')+'.glb';a.click();setTimeout(()=>URL.revokeObjectURL(url),20000);message('人物 GLB 已导出，包含面部纹理、身高和行走动画。')}
    catch{message('导出失败，请重新生成后再试。',true)}finally{busy=false;updateButtons()}};
  $('remove').onclick=async()=>{if(busy||!confirm('从本浏览器移除已保存的人物模型和面部纹理？'))return;
    try{await AvatarStore.clear();record=null;photo=null;descriptor=null;valid=false;uploadVersion++;$('thumb').removeAttribute('src');$('thumb').hidden=true;$('photoIcon').hidden=false;$('fileLabel').textContent='选择一张自拍';await show(null,{name:'我的形象',height:170,width:41});message('本机形象已移除。')}
    catch{message('无法移除本机形象，请重试。',true)}updateButtons()};
  async function start(){busy=true;updateButtons();try{initStage();
      try{record=await AvatarStore.get()}catch{message('当前浏览器的本机存储不可用，仍可生成并下载 GLB。')}
      if(record?.version===1){for(const id of inputIds)if(record[id]!=null)$(id).value=record[id];descriptor=record.face;
        $('thumb').src=descriptor.texture;$('thumb').hidden=false;$('photoIcon').hidden=true;$('fileLabel').textContent='更换自拍';await show(descriptor,settings());valid=true;message('已恢复保存在本机的个人形象。')}
      else await show(null,settings());
    }catch(e){$('stageMsg').hidden=false;$('stageMsg').textContent='未能启动三维预览，请开启浏览器硬件加速后刷新。';message(e.message,true)}
    finally{busy=false;updateButtons()}}
  start();
})();
