import * as THREE from './vendor/three.module.js';

const $ = id => document.getElementById(id);
const viewport = $('viewport');
const W = 21, H = 15;
const tileKey = (x,z) => `${Math.round(x)},${Math.round(z)}`;
const worldX = c => c - 10, worldZ = r => r - 7;
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
let seed = 261004;
function random(){ seed=(seed*1664525+1013904223)>>>0; return seed/4294967296; }
const range=(a,b)=>a+(b-a)*random();
const palette={grass:[0x87aa48,0x91b34d,0x98b952,0x83a744,0x8aaf4d],brick:[0xed9565,0xe68a55,0xf2a473],stone:[0xb8beb0,0xcbd0ba,0xb2bbad],leaves:[0x729934,0x8aaf36,0xa8bd47,0x567e35,0x688f36]};
const materials=new Map();
function mat(color,extra={}){const key=JSON.stringify([color,extra]);if(!materials.has(key))materials.set(key,new THREE.MeshStandardMaterial({color,roughness:.85,...extra}));return materials.get(key);}
const boxGeo=new THREE.BoxGeometry(1,1,1);
const leafGeo=new THREE.DodecahedronGeometry(1,0);
const rockGeo=new THREE.IcosahedronGeometry(1,0);
const cylinderGeo=new THREE.CylinderGeometry(1,1,1,12);
function mesh(geo,material,x=0,y=0,z=0,sx=1,sy=1,sz=1){const m=new THREE.Mesh(geo,material);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;m.receiveShadow=true;return m;}
function box(parent,x,y,z,sx,sy,sz,color,extra){const m=mesh(boxGeo,mat(color,extra),x,y,z,sx,sy,sz);parent.add(m);return m;}
const scene=new THREE.Scene();
scene.background=new THREE.Color(0xa5c274);
const camera=new THREE.OrthographicCamera(-14,14,10,-10,.1,100);
camera.position.set(0,30,13);camera.lookAt(0,0,0);
let renderer;
try{
 renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.65));
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.22;
 viewport.prepend(renderer.domElement);
}catch(error){$('loading').innerHTML='<div class="error">Браузер не смог включить 3D-графику. Попробуй открыть игру в Chrome или Safari.<br><br><button onclick="location.reload()">Попробовать ещё раз</button></div>';throw error;}
scene.add(new THREE.HemisphereLight(0xd8edff,0x60753c,2.1));
const sun=new THREE.DirectionalLight(0xffe4b0,3.5);sun.position.set(-9,19,8);sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-17;sun.shadow.camera.right=17;sun.shadow.camera.top=16;sun.shadow.camera.bottom=-16;sun.shadow.camera.near=1;sun.shadow.camera.far=60;sun.shadow.normalBias=.04;sun.shadow.bias=-.0001;sun.shadow.radius=3;scene.add(sun);
const fill=new THREE.DirectionalLight(0xcbeaff,.55);fill.position.set(8,10,-12);scene.add(fill);
const environment=new THREE.Group();scene.add(environment);
const dynamic=new THREE.Group();scene.add(dynamic);
const dummy=new THREE.Object3D();
const tiles=new Map(), obstacles=new Map(), water=[], pickups=[], particles=[], bullets=[];
const duelRequested=new URLSearchParams(window.location.search).get('mode')==='duel';
let enemies=[],player,player2,score=0,wave=1,mode=duelRequested?'duel':'battle',state='intro',spawnQueue=0,spawnTimer=0,transitionTimer=0,shield=0,toastTimer=0,time=0,shake=0,lastShot=0;
let muted=true,audioContext,soundChosen=false;
const keys=new Set();const keyOrder=[];const tapUntil=new Map();const releasedKeys=new Set();
// Track physical sources separately: one finger releasing must not release another.
const keyboardHeld=new Set(), touchPointers=new Map();
const touchToggle=$('touchToggle');
const screenMedia=window.matchMedia?.('(pointer: coarse), (max-width: 850px)');
const portraitMedia=window.matchMedia?.('(orientation: portrait) and (pointer: coarse), (orientation: portrait) and (max-width: 850px)');
const orientationBlocked=()=>!!portraitMedia?.matches;
function syncOrientation(){
 if(!orientationBlocked())return;
 clearInputs();if(state==='playing')pauseGame();
}
if(document.body&&!document.body.dataset.screenControls)document.body.dataset.screenControls='auto';
function screenControlsEnabled(){
 const choice=document.body?.dataset.screenControls||'auto';
 return !duelRequested&&(choice==='on'||(choice==='auto'&&!!screenMedia?.matches));
}
function removeInput(code){
 keys.delete(code);tapUntil.delete(code);releasedKeys.delete(code);
 const index=keyOrder.indexOf(code);if(index>=0)keyOrder.splice(index,1);
}
function releaseOwnedInput(code,immediate=false){
 if(keyboardHeld.has(code)||[...touchPointers.values()].some(p=>p.code===code))return;
 if(immediate)removeInput(code);else releaseInput(code);
}
function clearTouchInputs(){
 const pointers=[...touchPointers.entries()];touchPointers.clear();
 for(const [id,p] of pointers){
  releaseOwnedInput(p.code,true);
  try{if(p.button.hasPointerCapture?.(id))p.button.releasePointerCapture(id);}catch{}
 }
}
function syncScreenControls(){
 const enabled=screenControlsEnabled();
 touchToggle?.setAttribute('aria-pressed',String(enabled));
 if(!enabled)clearTouchInputs();
}
const dirMap={KeyW:[0,-1],ArrowUp:[0,-1],KeyS:[0,1],ArrowDown:[0,1],KeyA:[-1,0],ArrowLeft:[-1,0],KeyD:[1,0],ArrowRight:[1,0]};
const fxGeometry=new THREE.BoxGeometry(1,1,1);
const bulletGeo=new THREE.SphereGeometry(.075,7,5);
function sound(type){
 if(muted)return;
 try{
 audioContext ||= new (window.AudioContext||window.webkitAudioContext)();
 if(audioContext.state==='suspended')audioContext.resume();
 const osc=audioContext.createOscillator(),gain=audioContext.createGain(),t=audioContext.currentTime;
 osc.type=type==='shoot'?'triangle':type==='pickup'?'sine':'sawtooth';
 const f=type==='shoot'?440:type==='pickup'?660:100;
 osc.frequency.setValueAtTime(f,t);osc.frequency.exponentialRampToValueAtTime(type==='pickup'?1100:35,t+.15);
 gain.gain.setValueAtTime(type==='shoot'?.035:.065,t);gain.gain.exponentialRampToValueAtTime(.001,t+.2);
 osc.connect(gain).connect(audioContext.destination);osc.start();osc.stop(t+.21);
 }catch{}
}
function tile(c,r,type){tiles.set(tileKey(worldX(c),worldZ(r)),type);}
function makeLayout(){
 tiles.clear();
 for(let r=0;r<H;r++)for(let c=0;c<W;c++)tile(c,r,'grass');
 // Original compact arena: open spawn lanes and connected perimeter paths.
 for(const [c,r] of [[1,3],[2,3],[1,4],[2,4],[18,3],[19,3],[18,4],[19,4],[9,0],[10,0],[11,0],[9,1],[10,1],[11,1],[9,13],[10,13],[11,13],[9,14],[10,14],[11,14]])tile(c,r,'water');
 const bricks=[[3,2],[4,2],[7,2],[7,3],[13,2],[13,3],[16,2],[17,2],[4,4],[5,4],[8,5],[9,5],[11,5],[12,5],[15,4],[16,4],[2,6],[3,6],[5,7],[6,7],[9,7],[11,7],[14,7],[15,7],[17,6],[18,6],[4,9],[5,9],[7,10],[7,11],[13,10],[13,11],[15,9],[16,9],[2,11],[3,11],[17,11],[18,11]];
 for(const p of bricks)tile(...p,'brick');
 for(const p of [[3,3],[3,4],[6,4],[14,4],[17,3],[17,4],[2,7],[18,7],[9,6],[11,6],[9,8],[11,8],[3,9],[3,10],[6,10],[14,10],[17,9],[17,10],[5,12],[6,12],[14,12],[15,12]])tile(...p,'stone');
 for(const p of [[5,1],[6,1],[14,1],[15,1],[7,5],[13,5],[4,6],[16,6],[1,9],[2,9],[18,9],[19,9],[8,9],[12,9],[4,12],[16,12],[9,3],[10,3],[11,3]])tile(...p,'bush');
}
function tree(x,z,s=1){
 const trunk=mesh(cylinderGeo,mat(0x88603b),x,.38*s,z,.12*s,.7*s,.12*s);environment.add(trunk);
 for(let i=0;i<3;i++){
  const m=mesh(leafGeo,mat(palette.leaves[Math.floor(random()*palette.leaves.length)]),x+(i-1)*.24*s,(.92+(i===1?.35:0))*s,z+range(-.12,.12)*s,.47*s,.75*s,.49*s);
  m.rotation.set(range(0,.2),range(0,6),range(-.12,.12));environment.add(m);
 }
}
function brickGroup(x,z){
 const g=new THREE.Group();g.position.set(x,0,z);
 box(g,0,.24,0,.94,.48,.94,0xba7952);
 const blocks=new THREE.InstancedMesh(boxGeo,mat(0xef9866),12);blocks.castShadow=true;blocks.receiveShadow=true;
 let i=0;for(let row=0;row<3;row++)for(let col=0;col<2;col++)for(let depth=0;depth<2;depth++){
  dummy.position.set((col-.5)*.465,(row+.5)*.17,(depth-.5)*.465);dummy.scale.set(.447,.155,.447);dummy.rotation.set(0,0,0);dummy.updateMatrix();blocks.setMatrixAt(i,dummy.matrix);blocks.setColorAt(i,new THREE.Color(palette.brick[Math.floor(random()*3)]));i++;
 }
 g.add(blocks);environment.add(g);return g;
}
function makeEnvironment(){
 seed=261004;
 while(environment.children.length)environment.remove(environment.children[0]);obstacles.clear();water.length=0;
 const ground=box(environment,0,-.31,0,23,.5,17,0x687b43);ground.receiveShadow=true;
 const grass=new THREE.InstancedMesh(boxGeo,mat(0xffffff),W*H);grass.receiveShadow=true;
 let i=0;
 for(let r=0;r<H;r++)for(let c=0;c<W;c++){
  const x=worldX(c),z=worldZ(r),type=tiles.get(tileKey(x,z));
  dummy.position.set(x,-.085,z);dummy.scale.set(.998,.15,.998);dummy.rotation.set(0,0,0);dummy.updateMatrix();grass.setMatrixAt(i,dummy.matrix);
  const path=(r===8||r===12||c===0||c===20||c===10);
  grass.setColorAt(i++,new THREE.Color(type==='water'?0x738d7a:path?0xa5b86b:palette.grass[Math.floor(random()*palette.grass.length)]));
  if(type==='brick')obstacles.set(tileKey(x,z),{x,z,type,hp:2,group:brickGroup(x,z)});
  else if(type==='stone'){
   const g=new THREE.Group();g.position.set(x,0,z);
   const rock=mesh(rockGeo,mat(palette.stone[Math.floor(random()*3)]),0,.32,0,.64,.57,.64);rock.rotation.y=random()*1.5;g.add(rock);environment.add(g);obstacles.set(tileKey(x,z),{x,z,type,hp:Infinity,group:g});
  }else if(type==='water'){
   const m=box(environment,x,.003,z,.985,.035,.985,0x32aebf,{metalness:.25,roughness:.24});m.castShadow=false;water.push(m);
   if(random()>.55){const lily=mesh(new THREE.CylinderGeometry(.14,.14,.016,7),mat(0xa7c957),x+range(-.26,.26),.044,z+range(-.26,.26));environment.add(lily);}
  }else if(type==='bush'){
   for(let b=0;b<6;b++){const m=mesh(leafGeo,mat(palette.leaves[Math.floor(random()*5)]),x+range(-.36,.36),range(.13,.22),z+range(-.36,.36),.23,.23,.23);m.rotation.y=random()*4;environment.add(m);}
  }
 }
 environment.add(grass);
 for(let x=-11;x<=11;x++)for(const z of [-8,8]){
  const r=mesh(rockGeo,mat(0xb7c2a5),x,.32,z,.69,.66,.68);r.rotation.y=random()*3;environment.add(r);
  if(x%2===0)tree(x+range(-.2,.2),z,.8+random()*.25);
 }
 for(let z=-7;z<=7;z++)for(const x of [-11,11]){
  const r=mesh(rockGeo,mat(0xb4bda5),x,.32,z,.65,.64,.7);r.rotation.y=random()*4;environment.add(r);
  if(z%3===0)tree(x,z,.85);
 }
 // Grass flecks and tiny flowers; instancing keeps the arena light to render.
 const flecks=new THREE.InstancedMesh(leafGeo,mat(0xffffff),420);
 for(let n=0;n<420;n++){
  let x=range(-10.4,10.4),z=range(-7.4,7.4),type=tiles.get(tileKey(x,z));
  const hidden=type==='water'||type==='brick'||type==='stone';
  dummy.position.set(x,hidden?-2:.027,z);dummy.scale.set(.035,random()>.85?.07:.025,.045);dummy.rotation.set(0,random()*6,0);dummy.updateMatrix();flecks.setMatrixAt(n,dummy.matrix);flecks.setColorAt(n,new THREE.Color(n%13===0?0xffe3a0:n%17===0?0xf2ebd4:n%19===0?0xf09b75:0x6f963c));
 }
 environment.add(flecks);
}
function makeTank(color,enemy=false){
 const g=new THREE.Group();
 const body=new THREE.Group();g.add(body);
 const trackMaterial=mat(0x263d3b);const wheelMaterial=mat(0x617c6b);
 for(const side of [-1,1]){
  box(body,side*.285,.15,0,.19,.23,.75,0x263d3b);
  for(let w=-2;w<=2;w++){
   const wheel=mesh(cylinderGeo,wheelMaterial,side*.39,.14,w*.14,.075,.018,.075);wheel.rotation.z=Math.PI/2;body.add(wheel);
  }
  for(let w=-3;w<=3;w++)box(body,side*.285,.274,w*.102,.2,.025,.052,0x40594e);
 }
 box(body,0,.28,0,.51,.23,.7,color,{roughness:.45,metalness:.18});
 box(body,0,.41,-.14,.38,.04,.22,color);
 const turret=mesh(new THREE.CylinderGeometry(.25,.29,.22,8),mat(color,{roughness:.4,metalness:.18}),0,.47,.02);body.add(turret);
 const cap=mesh(cylinderGeo,mat(color),-.06,.606,-.04,.1,.038,.1);body.add(cap);
 const cannon=mesh(new THREE.CylinderGeometry(.061,.087,.49,10),mat(color,{roughness:.3,metalness:.25}),0,.49,.39);cannon.rotation.x=Math.PI/2;body.add(cannon);
 const hole=mesh(new THREE.CylinderGeometry(.047,.047,.013,10),mat(0x244743),0,.49,.641);hole.rotation.x=Math.PI/2;body.add(hole);
 box(body,0,.36,.347,.19,.06,.025,enemy?0xffceb3:0xffefb2,{emissive:enemy?0x702622:0x65703a,emissiveIntensity:.2});
 box(body,-.21,.38,-.29,.07,.02,.12,0x304d47);
 const antenna=mesh(cylinderGeo,mat(0x355347),.2,.54,-.23,.013,.3,.013);body.add(antenna);
 if(!enemy){const tip=mesh(bulletGeo,mat(0xffdf7b),.2,.71,-.23,.3,.3,.3);body.add(tip);}
 dynamic.add(g);
 return {group:g,body,x:0,z:0,dx:0,dz:-1,yaw:Math.PI,hp:enemy?2:5,enemy,cooldown:0,moveTimer:0,think:0,dead:false};
}
let shieldRing;
function makePlayer(){
 player=makeTank(0x24bbce);player.x=0;player.z=5;player.group.position.set(0,0,5);player.group.rotation.y=Math.PI;
 const geometry=new THREE.TorusGeometry(.54,.015,5,40);
 shieldRing=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:0xaafaff,transparent:true,opacity:.55}));shieldRing.rotation.x=Math.PI/2;shieldRing.position.y=.075;player.group.add(shieldRing);
}
function makePlayers(){
 makePlayer();player2=null;
 if(mode==='duel'){
  player2=makeTank(0xe45b78);
  for(const [t,x,dx] of [[player,-9,1],[player2,9,-1]]){
   t.x=x;t.z=0;t.dx=dx;t.dz=0;t.yaw=Math.atan2(dx,0);
   t.group.position.set(x,0,0);t.group.rotation.y=t.yaw;
  }
 }
}
const activeTanks=()=>[player,...(player2?[player2]:[]),...enemies];
function collision(x,z,r=.33,ignore){
 if(x < -10.48+r || x>10.48-r || z< -7.48+r || z>7.48-r)return true;
 for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){
  const cx=Math.round(x)+dx,cz=Math.round(z)+dz,key=tileKey(cx,cz),type=tiles.get(key);
  if(type==='water'||obstacles.has(key)){
   const nx=clamp(x,cx-.48,cx+.48),nz=clamp(z,cz-.48,cz+.48);
   if((x-nx)**2+(z-nz)**2<r*r)return true;
  }
 }
 for(const t of activeTanks())if(t && t!==ignore && !t.dead && Math.hypot(x-t.x,z-t.z)<r+.32)return true;
 return false;
}
function moveTank(t,dx,dz,dt,speed){
 t.dx=dx;t.dz=dz;t.yaw=Math.atan2(dx,dz);
 let nx=t.x+dx*dt*speed,nz=t.z+dz*dt*speed;
 let moved=false;
 if(!collision(nx,nz,.31,t)){t.x=nx;t.z=nz;moved=true;}
 else if(!t.enemy){
  // Gently center in a corridor instead of sticking to its corner.
  const ax=dx===0?clamp(Math.round(t.x)-t.x,-dt*2,dt*2):0;
  const az=dz===0?clamp(Math.round(t.z)-t.z,-dt*2,dt*2):0;
  if(!collision(nx+ax,nz+az,.31,t)){t.x=nx+ax;t.z=nz+az;moved=true;}
 }
 t.group.position.set(t.x,0,t.z);
 if(moved){t.moveTimer+=dt;t.body.position.y=Math.sin(t.moveTimer*32)*.01;}
 return moved;
}
function shoot(t){
 if(t.cooldown>0||t.dead)return;
 // Start inside the muzzle in duels so nearby walls/tanks cannot be skipped.
 const offset=mode==='duel'?.32:.69;
 const x=t.x+t.dx*offset,z=t.z+t.dz*offset;
 t.cooldown=t.enemy?range(1.15,2):.26;
 const g=new THREE.Group();
 const color=t.enemy?0xffba48:0x95f5ff;
 const core=mesh(bulletGeo,new THREE.MeshBasicMaterial({color}),0,0,0,1.1,1.1,1.9);core.castShadow=false;g.add(core);g.rotation.y=Math.atan2(t.dx,t.dz);
 g.position.set(x,.43,z);dynamic.add(g);bullets.push({group:g,x,z,dx:t.dx,dz:t.dz,enemy:t.enemy,owner:t,life:2.8,speed:t.enemy?6.3:11.5});
 burst(x,.44,z,color,3,.5);if(!t.enemy)sound('shoot');
}
function burst(x,y,z,color,count=12,force=2){
 for(let i=0;i<count;i++){
  if(particles.length>=150){const old=particles.shift();dynamic.remove(old.mesh);}
  const size=range(.045,.12),m=mesh(fxGeometry,mat(color),x,y,z,size,size,size);m.castShadow=false;dynamic.add(m);
  particles.push({mesh:m,vx:range(-force,force),vy:range(1,3)*force*.6,vz:range(-force,force),life:range(.25,.6),max:.6,size});
 }
}
function removeBullet(index){const [b]=bullets.splice(index,1);dynamic.remove(b.group);for(const o of b.group.children)o.material.dispose();}
function hitObstacle(ob,b){
 burst(b.x,.35,b.z,ob.type==='brick'?0xf1a572:0xd3d7bb,6,1.5);
 if(ob.type==='brick'){
  ob.hp--;
  if(ob.hp<=0){environment.remove(ob.group);obstacles.delete(tileKey(ob.x,ob.z));tiles.set(tileKey(ob.x,ob.z),'grass');burst(ob.x,.4,ob.z,0xe6a06c,16,2.2);if(!b.enemy&&mode!=='duel')score+=10;sound('hit');}
  else ob.group.scale.y=.64;
 }
}
function pickup(x,z){
 const g=new THREE.Group();g.position.set(x,.45,z);box(g,0,0,0,.37,.12,.37,0xe5ffae,{emissive:0x67823a,emissiveIntensity:.4});box(g,0,.085,0,.23,.035,.075,0x3c8464);box(g,0,.085,0,.075,.035,.23,0x3c8464);dynamic.add(g);pickups.push({group:g,x,z,life:20});
}
function hitTank(t){
 if(t.dead)return;
 if(mode!=='duel'&&!t.enemy&&shield>0)return;
 t.hp--;burst(t.x,.5,t.z,t.enemy?0xef7590:0x65dbde,12,2.5);sound('hit');
 if(!t.enemy&&mode!=='duel'){shield=1.6;shake=.12;toast('Броня повреждена — двигайся!');}
 if(t.hp<=0){
  t.dead=true;dynamic.remove(t.group);burst(t.x,.3,t.z,0xffbd55,24,3.5);
  if(t.enemy){score+=100;if(player.hp<5&&random()<.5)pickup(t.x,t.z);enemies=enemies.filter(e=>e!==t);}
  else if(mode!=='duel')endGame(false);
 }
 updateHUD();
}
const spawnPositions=[[-9,-6],[8,-6],[0,-3],[-9,0],[9,0],[-4,6],[4,6]];
function spawnEnemy(){
 const candidates=spawnPositions.filter(([x,z])=>Math.hypot(player.x-x,player.z-z)>4.5&&!collision(x,z,.45));
 if(!candidates.length)return false;
 const [x,z]=candidates[Math.floor(random()*candidates.length)];
 const t=makeTank(random()>.35?0xc93668:0xe45b78,true);t.x=x;t.z=z;t.group.position.set(x,0,z);t.cooldown=1.8;t.think=.5;t.dx=0;t.dz=1;enemies.push(t);burst(x,.1,z,0xf8d7ab,10,1);return true;
}
function enemyAI(t,dt){
 t.cooldown-=dt;t.think-=dt;
 const deltaX=player.x-t.x,deltaZ=player.z-t.z;
 if(t.think<=0){
  const choices=[[0,1],[0,-1],[1,0],[-1,0]].filter(([dx,dz])=>!collision(t.x+dx*.55,t.z+dz*.55,.31,t));
  choices.sort((a,b)=>Math.hypot(deltaX-a[0],deltaZ-a[1])-Math.hypot(deltaX-b[0],deltaZ-b[1]));
  const d=choices.length?choices[Math.floor(random()*Math.min(choices.length,random()>.4?1:3))]:[t.dx,t.dz];
  t.dx=d[0];t.dz=d[1];t.think=range(.45,1.5);
 }
 if(Math.abs(deltaX)<.5&&Math.abs(deltaZ)<8){t.dx=0;t.dz=Math.sign(deltaZ)||1;shoot(t);}
 else if(Math.abs(deltaZ)<.5&&Math.abs(deltaX)<8){t.dx=Math.sign(deltaX)||1;t.dz=0;shoot(t);}
 else if(t.cooldown<=0&&random()<dt*.7)shoot(t);
 if(!moveTank(t,t.dx,t.dz,dt,1.12+wave*.1))t.think=0;
}
function updateHUD(){
 if(mode==='duel'){
  $('health').textContent=`1: ${player?.hp??5} ♥ · 2: ${player2?.hp??5} ♥`;
  $('health').setAttribute('aria-label',`Броня игрока 1: ${player?.hp??5} из 5. Игрока 2: ${player2?.hp??5} из 5.`);
  $('roundLabel').textContent='ДУЭЛЬ';$('wave').textContent='1 × 1';
  $('score').textContent='—';$('modeTag').textContent='ДВА ИГРОКА';return;
 }
 $('health').textContent='♥ '.repeat(Math.max(0,player?.hp??5))+'♡ '.repeat(5-Math.max(0,player?.hp??5));
 $('health').setAttribute('aria-label',`Броня: ${player?.hp??5} из 5`);
 $('wave').textContent=mode==='explore'?'∞':`${String(wave).padStart(2,'0')} / 03`;
 $('roundLabel').textContent=mode==='explore'?'ПРОГУЛКА':'ВОЛНА';
 $('score').textContent=String(score).padStart(3,'0');$('modeTag').textContent=mode==='explore'?'ПРОГУЛКА':'АРКАДА';
}
function toast(message){$('toast').textContent=message;$('toast').classList.add('visible');toastTimer=2.8;}
function clearInputs(){keyboardHeld.clear();clearTouchInputs();keys.clear();keyOrder.length=0;tapUntil.clear();releasedKeys.clear();}
function pressInput(code){
 if(orientationBlocked()){clearInputs();return;}
 if(!keys.has(code))keyOrder.push(code);
 keys.add(code);releasedKeys.delete(code);tapUntil.set(code,time+.08);
}
function releaseInput(code){releasedKeys.add(code);}
function resetGame(newMode=mode){
 if(orientationBlocked()){syncOrientation();return;}
 clearInputs();
 for(const b of bullets)for(const o of b.group.children)o.material.dispose();
 dynamic.clear();bullets.length=0;particles.length=0;pickups.length=0;enemies=[];
 mode=newMode;wave=1;score=0;shield=mode==='duel'?0:2.8;transitionTimer=0;spawnTimer=.9;spawnQueue=mode==='battle'?4:0;shake=0;
 makeLayout();makeEnvironment();makePlayers();updateHUD();
 state='playing';$('overlay').classList.add('hidden');$('pause').textContent='Ⅱ';viewport.focus();
 toast(mode==='duel'?'Дуэль · Бирюзовый против розового':mode==='battle'?'Волна 1 · Очисти полигон':'Свободная прогулка · Кирпичи можно разбивать');
}
function showCard(title,description,button,eyebrow){
 $('overlayTitle').innerHTML=title;$('overlayText').textContent=description;$('play').innerHTML=button+' <span>↗</span>';$('eyebrow').textContent=eyebrow;
 $('quickControls').style.display='none';$('cardNote').textContent=mode==='duel'?'Игрок 1: WASD + Пробел · Игрок 2: стрелки + Enter · Esc — пауза':'WASD или стрелки · Пробел — стрелять';$('explore').textContent='Начать прогулку без противников';$('overlay').classList.remove('hidden');
}
function pauseGame(){
 if(state==='playing'){state='paused';clearInputs();showCard('Небольшая<br><em>передышка.</em>','Полигон подождёт. Продолжай, когда захочется.','Продолжить','ПАУЗА');$('pause').textContent='▶';}
 else if(state==='paused'&&!orientationBlocked()){state='playing';clearInputs();$('overlay').classList.add('hidden');$('pause').textContent='Ⅱ';viewport.focus();}
}
function endGame(won){
 state=won?'won':'lost';clearInputs();
 showCard(won?'Вот это<br><em>красивый заезд!</em>':'Ещё один<br><em>кружочек?</em>',won?`Полигон твой. Все три волны пройдены, ${score} очков заработано.`:`Танчику нужен небольшой ремонт. Ты заработал ${score} очков — попробуем ещё раз?`,'Ещё заезд',won?'ПОЛИГОН ОЧИЩЕН':'ЗАЕЗД ЗАВЕРШЁН');
}
function endDuel(){
 state='won';clearInputs();
 const both=player.dead&&player2.dead;
 const winner=player.dead?2:1;
 showCard(both?'Ничья!':`Победил<br><em>игрок ${winner}!</em>`,both?'Оба танка потеряли броню одновременно. Ещё дуэль?':`${winner===1?'Бирюзовый':'Розовый'} танк победил. Ещё дуэль на равных условиях?`,'Повторить дуэль','ДУЭЛЬ ЗАВЕРШЕНА');
}
function controlTank(t,dt,accepts,fire){
 t.cooldown-=dt;
 const code=[...keyOrder].reverse().find(k=>keys.has(k)&&dirMap[k]&&accepts(k));
 if(code){const [dx,dz]=dirMap[code];moveTank(t,dx,dz,dt,3.3);}
 else t.body.position.y=0;
 if(keys.has(fire))shoot(t);
}
function update(dt){
 // Also guard the frame if a media-change callback has not been delivered yet.
 syncOrientation();
 time+=dt;
 if(state==='playing'){
  shield=Math.max(0,shield-dt);
  controlTank(player,dt,k=>mode!=='duel'||k.startsWith('Key'),'Space');
  if(mode==='duel')controlTank(player2,dt,k=>k.startsWith('Arrow'),'Enter');
  for(const t of enemies)enemyAI(t,dt);
  for(const t of activeTanks()){
   const diff=Math.atan2(Math.sin(t.yaw-t.group.rotation.y),Math.cos(t.yaw-t.group.rotation.y));t.group.rotation.y+=diff*Math.min(1,dt*22);
  }
  for(let i=bullets.length-1;i>=0;i--){
   const b=bullets[i];b.life-=dt;
   let destroyed=false;const steps=Math.max(1,Math.ceil(b.speed*dt/.14));
   for(let s=0;s<steps&&!destroyed;s++){
    b.x+=b.dx*b.speed*dt/steps;b.z+=b.dz*b.speed*dt/steps;
    if(Math.abs(b.x)>10.5||Math.abs(b.z)>7.5||b.life<=0){destroyed=true;burst(b.x,.3,b.z,0xe2dcad,3,.8);break;}
    const ob=obstacles.get(tileKey(b.x,b.z));
    if(ob&&Math.abs(ob.x-b.x)<.52&&Math.abs(ob.z-b.z)<.52){hitObstacle(ob,b);destroyed=true;break;}
    for(const t of mode==='duel'?[player,player2].filter(t=>t!==b.owner):b.enemy?[player]:[...enemies]){
     if(!t.dead&&Math.hypot(b.x-t.x,b.z-t.z)<.37){hitTank(t);destroyed=true;break;}
    }
   }
   b.group.position.set(b.x,.43,b.z);
   if(destroyed)removeBullet(i);
  }
  if(mode==='duel'&&(player.dead||player2.dead))endDuel();
  for(let i=pickups.length-1;i>=0;i--){
   const p=pickups[i];p.life-=dt;p.group.position.y=.33+Math.sin(time*3)*.065;p.group.rotation.y=time*.7;
   if(Math.hypot(player.x-p.x,player.z-p.z)<.62){player.hp=Math.min(5,player.hp+1);p.life=0;sound('pickup');toast('Броня восстановлена +1');}
   if(p.life<=0){dynamic.remove(p.group);pickups.splice(i,1);}
  }
  if(mode==='battle'&&state==='playing'){
   spawnTimer-=dt;
   if(spawnQueue>0&&spawnTimer<=0&&enemies.length<4){if(spawnEnemy())spawnQueue--;spawnTimer=1.8;}
   if(spawnQueue===0&&enemies.length===0){
    transitionTimer+=dt;
    if(transitionTimer>1.5){
     transitionTimer=0;
     if(wave===3)endGame(true);
     else{wave++;spawnQueue=3+wave;spawnTimer=.5;player.hp=Math.min(5,player.hp+1);shield=2;toast(`Волна ${wave} · Броня пополнена`);}
    }
   }
  }
  updateHUD();
 }
 for(const code of releasedKeys)if(time>=(tapUntil.get(code)||0)){
  keys.delete(code);releasedKeys.delete(code);tapUntil.delete(code);
  const index=keyOrder.indexOf(code);if(index>=0)keyOrder.splice(index,1);
 }
 // Freeze particles as well as gameplay when paused.
 if(state!=='paused')for(let i=particles.length-1;i>=0;i--){
  const p=particles[i];p.life-=dt;p.vy-=dt*9;p.mesh.position.x+=p.vx*dt;p.mesh.position.y=Math.max(.025,p.mesh.position.y+p.vy*dt);p.mesh.position.z+=p.vz*dt;p.mesh.rotation.x+=dt*4;p.mesh.rotation.z+=dt*3;p.mesh.scale.setScalar(p.size*Math.min(1,p.life*5));
  if(p.life<=0){dynamic.remove(p.mesh);particles.splice(i,1);}
 }
 if(shieldRing){shieldRing.visible=shield>0&&state==='playing';shieldRing.material.opacity=.32+Math.sin(time*7)*.18;}
 for(const m of water)m.position.y=.003+Math.sin(time*1.7+m.position.x*.9+m.position.z)*.009;
 if(toastTimer>0){toastTimer-=dt;if(toastTimer<=0)$('toast').classList.remove('visible');}
 if(shake>0){shake-=dt;camera.position.x=Math.sin(time*70)*shake*.12;}else camera.position.x=0;
}
function resize(){
 const width=viewport.clientWidth,height=viewport.clientHeight;renderer.setSize(width,height);
 const aspect=width/height,vertical=Math.max(8.4,12.4/aspect);
 camera.left=-vertical*aspect;camera.right=vertical*aspect;camera.top=vertical;camera.bottom=-vertical;camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(viewport);
document.addEventListener('keydown',event=>{
 if(orientationBlocked()&&(dirMap[event.code]||['Space','Enter','Escape'].includes(event.code))){
  event.preventDefault();syncOrientation();return;
 }
 if(mode==='duel'&&event.code==='Enter'){
  if(state==='playing'){event.preventDefault();keyboardHeld.add('Enter');pressInput('Enter');}
  else if(!(event.target instanceof HTMLButtonElement)||event.repeat)event.preventDefault();
  return;
 }
 if(dirMap[event.code]||event.code==='Space'){
  if(event.target instanceof HTMLButtonElement){if(event.code==='Space'&&state!=='playing')return;}
  event.preventDefault();if(state!=='playing')return;
  keyboardHeld.add(event.code);pressInput(event.code);
 }
 if(event.code==='Escape'){event.preventDefault();if(!event.repeat)pauseGame();}
 if(event.code==='Enter'&&state==='intro')resetGame('battle');
});
document.addEventListener('keyup',event=>{keyboardHeld.delete(event.code);releaseOwnedInput(event.code);});
window.addEventListener('blur',()=>{clearInputs();if(state==='playing')pauseGame();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&state==='playing')pauseGame();});
function enableStartSound(){
 if(soundChosen)return;
 muted=false;soundChosen=true;
 $('sound').classList.add('active');$('sound').setAttribute('aria-label','Выключить звук');$('sound').title='Выключить звук';
 sound('pickup');
}
$('play').addEventListener('click',()=>{if(orientationBlocked()){syncOrientation();return;}enableStartSound();if(state==='paused')pauseGame();else resetGame(mode);});
$('explore').addEventListener('click',()=>{if(mode!=='duel'&&!orientationBlocked()){enableStartSound();resetGame('explore');}});
$('pause').addEventListener('click',()=>{pauseGame();viewport.focus();});
$('restart').addEventListener('click',()=>resetGame(mode));
$('sound').addEventListener('click',()=>{soundChosen=true;muted=!muted;$('sound').classList.toggle('active',!muted);$('sound').setAttribute('aria-label',muted?'Включить звук':'Выключить звук');$('sound').title=muted?'Включить звук':'Выключить звук';if(!muted)sound('pickup');viewport.focus();});
touchToggle?.addEventListener('click',()=>{
 if(duelRequested)return;
 document.body.dataset.screenControls=screenControlsEnabled()?'off':'on';
 syncScreenControls();
});
if(screenMedia?.addEventListener)screenMedia.addEventListener('change',syncScreenControls);
else screenMedia?.addListener?.(syncScreenControls);
syncScreenControls();
if(portraitMedia?.addEventListener)portraitMedia.addEventListener('change',syncOrientation);
else portraitMedia?.addListener?.(syncOrientation);
syncOrientation();
for(const button of document.querySelectorAll('[data-key]')){
 button.addEventListener('pointerdown',e=>{
  e.preventDefault();
  if(state!=='playing'||!screenControlsEnabled()||e.button!==0)return;
  const code=button.dataset.key;
  touchPointers.set(e.pointerId,{code,button});
  button.setPointerCapture(e.pointerId);pressInput(code);
 });
 const release=(e,immediate)=>{
  const p=touchPointers.get(e.pointerId);
  if(!p||p.button!==button)return;
  touchPointers.delete(e.pointerId);releaseOwnedInput(p.code,immediate);
 };
 button.addEventListener('pointerup',e=>release(e,false));
 button.addEventListener('pointercancel',e=>release(e,true));
 button.addEventListener('lostpointercapture',e=>release(e,true));
}
makeLayout();makeEnvironment();makePlayers();updateHUD();resize();$('loading').remove();
if(duelRequested){
 showCard('Два танка.<br><em>Одна клавиатура.</em>','Игрок 1 — бирюзовый: WASD и Пробел. Игрок 2 — розовый: стрелки и Enter. У каждого 5 единиц брони. Побеждает тот, кто первым лишит соперника брони.','Начать дуэль','ЛОКАЛЬНЫЙ ЭКСПЕРИМЕНТ 1 × 1');
 $('explore').style.display='none';$('touchControls').style.display='none';
 if(touchToggle)touchToggle.style.display='none';
 $('cardNote').textContent='Нужны два игрока и одна физическая клавиатура · Esc — пауза';
 const hint=document.querySelector('.control-hint');
 if(hint)hint.textContent='Игрок 1: WASD + Пробел · Игрок 2: стрелки + Enter · Esc — пауза';
}
// Read-only snapshot for smoke checks and diagnosing browser-specific problems.
Object.defineProperty(window,'tanchiki',{get:()=>({state,mode,wave,score,health:player.hp,player:{x:player.x,z:player.z},player2:player2?{x:player2.x,z:player2.z,health:player2.hp}:null,enemies:enemies.length,bullets:bullets.length,bricks:[...obstacles.values()].filter(o=>o.type==='brick').length,spawnQueue,drawCalls:renderer.info.render.calls})});
let last=performance.now();
function frame(now){const dt=Math.min((now-last)/1000,.04);last=now;update(dt);renderer.render(scene,camera);requestAnimationFrame(frame);}
requestAnimationFrame(frame);
