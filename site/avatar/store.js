const AvatarStore=(()=>{
  let database;
  function open(){
    if(!database)database=new Promise((resolve,reject)=>{
      const req=indexedDB.open('duit-personal-avatar',1);
      req.onupgradeneeded=()=>req.result.createObjectStore('profile');
      req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
    }).catch(error=>{database=null;throw error});
    return database;
  }
  async function access(mode,action){
    const db=await open();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction('profile',mode),req=action(tx.objectStore('profile'));
      tx.oncomplete=()=>resolve(req.result);tx.onerror=tx.onabort=()=>reject(tx.error||Error('本机存储不可用'));
    });
  }
  function notify(){try{localStorage.setItem('duit.avatar.revision',String(Date.now()))}catch{}}
  return {get:()=>access('readonly',s=>s.get('current')),
    async set(profile){await access('readwrite',s=>s.put(profile,'current'));notify()},
    async clear(){await access('readwrite',s=>s.delete('current'));notify()}};
})();
