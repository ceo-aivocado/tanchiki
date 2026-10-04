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
const palette={grass:[0x659d30,0x689f32,0x6aa234,0x63992e,0x699f31],brick:[0xd77942,0xe48a4a,0xf09c57],stone:[0x989e92,0xaeb3a0,0x889487],leaves:[0x467e24,0x6b9d22,0x92b92e,0x285f2c,0x548c27]};
const materials=new Map();
function mat(color,extra={}){const key=JSON.stringify([color,extra]);if(!materials.has(key))materials.set(key,new THREE.MeshStandardMaterial({color,roughness:.85,...extra}));return materials.get(key);}
const boxGeo=new THREE.BoxGeometry(1,1,1);
const leafGeo=new THREE.DodecahedronGeometry(1,0);
const rockGeo=new THREE.IcosahedronGeometry(1,0);
const cylinderGeo=new THREE.CylinderGeometry(1,1,1,12);
function mesh(geo,material,x=0,y=0,z=0,sx=1,sy=1,sz=1){const m=new THREE.Mesh(geo,material);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;m.receiveShadow=true;return m;}
function box(parent,x,y,z,sx,sy,sz,color,extra){const m=mesh(boxGeo,mat(color,extra),x,y,z,sx,sy,sz);parent.add(m);return m;}
const scene=new THREE.Scene();
scene.background=new THREE.Color(0x628c36);
const camera=new THREE.OrthographicCamera(-14,14,10,-10,.1,100);
camera.position.set(0,27,15);camera.lookAt(0,.3,0);
let renderer;
try{
 renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.65));
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.98;
 viewport.prepend(renderer.domElement);
}catch(error){$('loading').innerHTML='<div class="error">Браузер не смог включить 3D-графику. Попробуй открыть игру в Chrome или Safari.<br><br><button onclick="location.reload()">Попробовать ещё раз</button></div>';throw error;}
scene.add(new THREE.HemisphereLight(0xe2efff,0x385322,.9));
const sun=new THREE.DirectionalLight(0xffe2af,2.8);sun.position.set(-9,19,8);sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-14;sun.shadow.camera.right=14;sun.shadow.camera.top=13;sun.shadow.camera.bottom=-13;sun.shadow.camera.near=1;sun.shadow.camera.far=60;sun.shadow.normalBias=.025;sun.shadow.bias=-.0001;sun.shadow.radius=3;scene.add(sun);
const fill=new THREE.DirectionalLight(0xcbeaff,.25);fill.position.set(8,10,-12);scene.add(fill);
const environment=new THREE.Group();scene.add(environment);
const dynamic=new THREE.Group();scene.add(dynamic);
const dummy=new THREE.Object3D();

const lilyGeo=new THREE.CylinderGeometry(1,1,1,9);
const crownGeo=new THREE.IcosahedronGeometry(1,0);
const tuftGeo=new THREE.BufferGeometry();tuftGeo.setAttribute('position',new THREE.Float32BufferAttribute([0,0,.5,-.5,0,-.5,.5,0,-.5],3));tuftGeo.computeVertexNormals();
const turretGeo=new THREE.CylinderGeometry(.25,.29,.22,8);
const cannonGeo=new THREE.CylinderGeometry(.061,.087,.49,10);
const muzzleGeo=new THREE.CylinderGeometry(.047,.047,.013,10);
const contactGeo=new THREE.CircleGeometry(1,16);contactGeo.rotateX(-Math.PI/2);
const contactPixels=new Uint8Array(32*32*4),grassPixels=new Uint8Array(64*64*4);
for(let y=0;y<32;y++)for(let x=0;x<32;x++){
 const i=(y*32+x)*4,d=Math.hypot((x-15.5)/15.5,(y-15.5)/15.5);
 contactPixels.set([255,255,255,Math.round(Math.max(0,1-d)**2*255)],i);
}
for(let i=0;i<64*64;i++){
 const f=Math.sin(i*12.9898+78.233)*43758.5453,n=f-Math.floor(f),v=Math.round(235+n*20);
 grassPixels.set([v,v,v,255],i*4);
}
const contactTexture=new THREE.DataTexture(contactPixels,32,32);contactTexture.needsUpdate=true;
const grassTexture=new THREE.DataTexture(grassPixels,64,64);grassTexture.colorSpace=THREE.SRGBColorSpace;grassTexture.magFilter=THREE.LinearFilter;grassTexture.minFilter=THREE.LinearMipmapLinearFilter;grassTexture.generateMipmaps=true;grassTexture.needsUpdate=true;
const contactMat=new THREE.MeshBasicMaterial({color:0x1b3821,map:contactTexture,transparent:true,opacity:.42,depthWrite:false});
const waterGeo=new THREE.PlaneGeometry(1,1,3,3).toNonIndexed();waterGeo.rotateX(-Math.PI/2);
const waterColors=[];
for(let n=0;n<waterGeo.attributes.position.count;n++){
 const f=Math.sin(Math.floor(n/3)*12.9898+78.233)*43758.5453;
 const c=new THREE.Color([0x099fbf,0x12aac4,0x0c9db8,0x27b6cc,0x1499b4][Math.floor((f-Math.floor(f))*5)]);
 waterColors.push(c.r,c.g,c.b);
}
waterGeo.setAttribute('color',new THREE.Float32BufferAttribute(waterColors,3));
const hullShape=new THREE.Shape();hullShape.moveTo(-.5,-.5);hullShape.lineTo(.5,-.5);hullShape.lineTo(.5,.5);hullShape.lineTo(-.5,.5);hullShape.closePath();
const hullGeo=new THREE.ExtrudeGeometry(hullShape,{depth:.8,bevelEnabled:true,bevelThickness:.1,bevelSize:.08,bevelSegments:1,steps:1});
hullGeo.rotateX(Math.PI/2);hullGeo.center();hullGeo.computeBoundingBox();
const hullSize=hullGeo.boundingBox.getSize(new THREE.Vector3());hullGeo.scale(1/hullSize.x,1/hullSize.y,1/hullSize.z);
// Batch only static direct children. Keep water and obstacle groups addressable.
function batchStaticParts(parent,skip=new Set()){
 const batches=new Map();
 for(const part of [...parent.children]){
  if(!part.isMesh||part.isInstancedMesh||skip.has(part)||Array.isArray(part.material))continue;
  const key=`${part.geometry.id}:${part.material.id}:${part.castShadow}:${part.receiveShadow}`;
  if(!batches.has(key))batches.set(key,[]);batches.get(key).push(part);
 }
 for(const parts of batches.values()){
  if(parts.length<2)continue;
  const first=parts[0],instances=new THREE.InstancedMesh(first.geometry,first.material,parts.length);
  instances.castShadow=first.castShadow;instances.receiveShadow=first.receiveShadow;
  parts.forEach((part,i)=>{part.updateMatrix();instances.setMatrixAt(i,part.matrix);parent.remove(part);});
  instances.instanceMatrix.needsUpdate=true;parent.add(instances);
 }
}
const visualNoise=n=>{const f=Math.sin(n*127.1+311.7)*43758.5453;return f-Math.floor(f);};
function addGardenDetails(){
 const tufts=new THREE.InstancedMesh(tuftGeo,mat(0xffffff),1400);
 for(let n=0;n<tufts.count;n++){
  const x=-10.4+visualNoise(n*5)*20.8,z=-7.4+visualNoise(n*5+1)*14.8,type=tiles.get(tileKey(x,z));
  dummy.position.set(x,['water','brick','stone'].includes(type)?-2:.012,z);
  dummy.rotation.set(0,visualNoise(n*5+2)*6,0);dummy.scale.set(.025+visualNoise(n*5+3)*.065,.016,.018+visualNoise(n*5+4)*.04);dummy.updateMatrix();tufts.setMatrixAt(n,dummy.matrix);
  const path=Math.round(z)===1||Math.round(z)===5||Math.round(x)===0||Math.abs(Math.round(x))===10;
  tufts.setColorAt(n,new THREE.Color(path&&n%3===0?0x999573:n%4?0x507a28:0xa1b948));
 }
 environment.add(tufts);
 const contacts=[];
 for(const [key,type] of tiles){
  if(!['brick','stone','bush'].includes(type))continue;
  const [x,z]=key.split(',').map(Number);contacts.push([x,z,type==='bush'?.6:.56]);
 }
 const shade=new THREE.InstancedMesh(contactGeo,contactMat,contacts.length);
 contacts.forEach(([x,z,r],i)=>{dummy.position.set(x,.005,z);dummy.rotation.set(0,0,0);dummy.scale.set(r,1,r);dummy.updateMatrix();shade.setMatrixAt(i,dummy.matrix);});
 environment.add(shade);
 const petals=[],centers=[];
 let j=0;
 for(const [key,type] of tiles){
  if(type!=='bush')continue;
  const [x,z]=key.split(',').map(Number);
  for(let f=0;f<3;f++){
   const cx=x+(f-1)*.22,cz=z+.36+visualNoise(j++)*.08,y=.07+visualNoise(j++)*.035;
   centers.push([cx,y+.01,cz]);
   for(let k=0;k<5;k++){const a=k*Math.PI*2/5;petals.push([cx+Math.cos(a)*.066,y,cz+Math.sin(a)*.066,f===2?0xffb684:0xfff9dd]);}
  }
 }
 const flower=new THREE.InstancedMesh(leafGeo,mat(0xffffff),petals.length);
 petals.forEach(([x,y,z,color],i)=>{dummy.position.set(x,y,z);dummy.rotation.set(0,i,0);dummy.scale.set(.052,.028,.052);dummy.updateMatrix();flower.setMatrixAt(i,dummy.matrix);flower.setColorAt(i,new THREE.Color(color));});environment.add(flower);
 const pollen=new THREE.InstancedMesh(leafGeo,mat(0xffc43b),centers.length);
 centers.forEach(([x,y,z],i)=>{dummy.position.set(x,y,z);dummy.rotation.set(0,0,0);dummy.scale.set(.029,.026,.029);dummy.updateMatrix();pollen.setMatrixAt(i,dummy.matrix);});environment.add(pollen);
}

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
const trailGeo=new THREE.ConeGeometry(.047,.65,6);trailGeo.rotateX(-Math.PI/2);
const flashMat=new THREE.MeshBasicMaterial({color:0xffc65b,transparent:true,opacity:.85,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false});
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
  const m=mesh(crownGeo,mat(palette.leaves[Math.floor(random()*palette.leaves.length)]),x+(i-1)*.25*s,(1.12+(i===1?.36:0))*s,z+range(-.12,.12)*s,.52*s,.86*s,.54*s);
  m.rotation.set(range(0,.2),range(0,6),range(-.12,.12));environment.add(m);
 }
}
function brickGroup(x,z){
 const g=new THREE.Group();g.position.set(x,0,z);
 // Recess mortar behind the exposed bricks; the old full-size core hid their faces.
 box(g,0,.24,0,.84,.44,.84,0x825038);
 const blocks=new THREE.InstancedMesh(hullGeo,mat(0xffffff),18);blocks.castShadow=true;blocks.receiveShadow=true;
 const colors=Array.from({length:12},()=>new THREE.Color(palette.brick[Math.floor(random()*3)]));
 let i=0;
 for(let row=0;row<3;row++)for(let col=0;col<3;col++)for(let depth=0;depth<2;depth++){
  const stagger=row%2===1,cx=stagger?(col-1)*.343:(col-1)*.31,width=stagger?(col===1?.445:.23):.295;
  dummy.position.set(cx,(row+.5)*.17,(depth-.5)*.465);dummy.scale.set(width,.155,.447);dummy.rotation.set(0,0,0);dummy.updateMatrix();
  blocks.setMatrixAt(i,dummy.matrix);blocks.setColorAt(i,colors[i%colors.length]);i++;
 }
 g.add(blocks);environment.add(g);return g;
}
function makeEnvironment(){
 seed=261004;
 environment.traverse(o=>{if(o.isInstancedMesh)o.dispose();});
 while(environment.children.length)environment.remove(environment.children[0]);obstacles.clear();water.length=0;
 const ground=box(environment,0,-.31,0,23,.5,17,0x446329);ground.receiveShadow=true;
 const grass=new THREE.InstancedMesh(boxGeo,mat(0xffffff,{map:grassTexture}),W*H);grass.receiveShadow=true;
 let i=0;
 for(let r=0;r<H;r++)for(let c=0;c<W;c++){
  const x=worldX(c),z=worldZ(r),type=tiles.get(tileKey(x,z));
  dummy.position.set(x,-.085,z);dummy.scale.set(.998,.15,.998);dummy.rotation.set(0,0,0);dummy.updateMatrix();grass.setMatrixAt(i,dummy.matrix);
  const path=(r===8||r===12||c===0||c===20||c===10);
  grass.setColorAt(i++,new THREE.Color(type==='water'?0x31666d:path?0x899747:palette.grass[Math.floor(random()*palette.grass.length)]));
  if(type==='brick')obstacles.set(tileKey(x,z),{x,z,type,hp:2,group:brickGroup(x,z)});
  else if(type==='stone'){
   const g=new THREE.Group();g.position.set(x,0,z);
   const rock=mesh(rockGeo,mat(palette.stone[Math.floor(random()*3)],{flatShading:true}),0,.32,0,.64,.57,.64);rock.rotation.y=random()*1.5;g.add(rock);
   for(const side of [-1,1]){const chip=mesh(rockGeo,rock.material,side*.3,.11,.22,.18,.17,.16);chip.rotation.y=side*.8;g.add(chip);}
   batchStaticParts(g);environment.add(g);obstacles.set(tileKey(x,z),{x,z,type,hp:Infinity,group:g});
  }else if(type==='water'){
   const m=mesh(waterGeo,mat(0xffffff,{vertexColors:true,metalness:.08,roughness:.28}),x,.003,z,.985,1,.985);m.castShadow=false;m.rotation.y=((Math.abs(x*3+z))%4)*Math.PI/2;environment.add(m);water.push(m);
   for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]])if(tiles.get(tileKey(x+dx,z+dz))!=='water')box(environment,x+dx*.47,.04,z+dz*.47,dx?.07:.96,.07,dz?.07:.96,0x859d78);
   if(random()>.55){const lily=mesh(lilyGeo,mat(0x97bd35),x+range(-.26,.26),.044,z+range(-.26,.26),.14,.016,.14);environment.add(lily);}
  }else if(type==='bush'){
   for(let b=0;b<6;b++){const m=mesh(leafGeo,mat(palette.leaves[Math.floor(random()*5)]),x+range(-.36,.36)*.55,range(.26,.36),z+range(-.36,.36)*.55,.28,.34,.28);m.rotation.y=random()*4;environment.add(m);}
   for(let b=0;b<28;b++){
    const level=Math.floor(b/7),angle=(b%7)*Math.PI*2/7+level*.4,r=.18+(level%2)*.035;
    const m=mesh(leafGeo,mat(palette.leaves[(b+Math.abs(x+z))%5]),x+Math.cos(angle)*r,.32+level*.105,z+Math.sin(angle)*r,.135,.085,.20);
    m.rotation.set(.3,angle,.18);environment.add(m);
   }
  }
 }
 environment.add(grass);
 for(let x=-11;x<=11;x++)for(const z of [-8,8]){
  const r=mesh(rockGeo,mat(0x9fa995),x,.32,z,.69,.66,.68);r.rotation.y=random()*3;environment.add(r);
  if(x%2===0)tree(x+range(-.2,.2),z,.8+random()*.25);
 }
 for(let z=-7;z<=7;z++)for(const x of [-11,11]){
  const r=mesh(rockGeo,mat(0x929e8e),x,.32,z,.65,.64,.7);r.rotation.y=random()*4;environment.add(r);
  if(z%3===0)tree(x,z,.85);
 }
 // Grass flecks and tiny flowers; instancing keeps the arena light to render.
 const flecks=new THREE.InstancedMesh(tuftGeo,mat(0xffffff),420);
 for(let n=0;n<420;n++){
  let x=range(-10.4,10.4),z=range(-7.4,7.4),type=tiles.get(tileKey(x,z));
  const hidden=type==='water'||type==='brick'||type==='stone';
  dummy.position.set(x,hidden?-2:.027,z);dummy.scale.set(.035,random()>.85?.07:.025,.045);dummy.rotation.set(0,random()*6,0);dummy.updateMatrix();flecks.setMatrixAt(n,dummy.matrix);flecks.setColorAt(n,new THREE.Color(n%13===0?0xffe3a0:n%17===0?0xf2ebd4:n%19===0?0xf09b75:0x6f963c));
 }
 environment.add(flecks);
 addGardenDetails();batchStaticParts(environment,new Set(water));
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
 body.add(mesh(hullGeo,mat(color,{roughness:.36,metalness:.12}),0,.28,0,.61,.28,.7));
 for(const side of [-1,1]){
  box(body,side*.19,.414,-.19,.11,.025,.17,enemy?0x8c234d:0x086777);
  box(body,side*.23,.37,.24,.065,.035,.10,0xffdf8c,{emissive:0xffb833,emissiveIntensity:.65});
  box(body,side*.2,.25,-.35,.07,.07,.024,0xf35449);
 }
 for(let i=0;i<4;i++)box(body,(i-1.5)*.063,.418,-.225,.027,.016,.105,0x234b48);
 box(body,0,.41,-.14,.38,.04,.22,color);
 const turret=mesh(turretGeo,mat(color,{roughness:.33,metalness:.12}),0,.47,.02);body.add(turret);
 const hatchRim=mesh(cylinderGeo,mat(enemy?0x8c234d:0x086777),-.06,.603,-.04,.118,.025,.118);body.add(hatchRim);
 const cap=mesh(cylinderGeo,mat(color),-.06,.606,-.04,.1,.038,.1);body.add(cap);
 const cannon=mesh(cannonGeo,mat(color,{roughness:.3,metalness:.12}),0,.49,.39);cannon.rotation.x=Math.PI/2;body.add(cannon);
 const hole=mesh(muzzleGeo,mat(0x244743),0,.49,.641);hole.rotation.x=Math.PI/2;body.add(hole);
 box(body,0,.36,.347,.19,.06,.025,enemy?0xffceb3:0xffefb2,{emissive:enemy?0x702622:0x65703a,emissiveIntensity:.2});
 box(body,-.21,.38,-.29,.07,.02,.12,0x304d47);
 const antenna=mesh(cylinderGeo,mat(0x355347),.2,.54,-.23,.013,.3,.013);body.add(antenna);
 if(!enemy){const tip=mesh(bulletGeo,mat(0xffdf7b),.2,.71,-.23,.3,.3,.3);body.add(tip);}
 const flash=mesh(bulletGeo,flashMat,0,.49,.68,3.8,3.8,5);
 flash.castShadow=false;flash.receiveShadow=false;flash.visible=false;body.add(flash);
 batchStaticParts(body,new Set([flash]));dynamic.add(g);
 return {group:g,body,flash,flashLife:0,x:0,z:0,dx:0,dz:-1,yaw:Math.PI,hp:enemy?2:5,enemy,cooldown:0,moveTimer:0,think:0,dead:false};
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
 const core=mesh(bulletGeo,new THREE.MeshBasicMaterial({color,toneMapped:false}),0,0,0,1.1,1.1,1.9);core.castShadow=false;g.add(core);
 const glow=mesh(bulletGeo,new THREE.MeshBasicMaterial({color,transparent:true,opacity:.2,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}),0,0,-.08,2.4,2.4,4);glow.castShadow=false;glow.receiveShadow=false;g.add(glow);
 const trail=mesh(trailGeo,new THREE.MeshBasicMaterial({color,transparent:true,opacity:.7,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}),0,0,-.31);trail.castShadow=false;trail.receiveShadow=false;g.add(trail);g.rotation.y=Math.atan2(t.dx,t.dz);
 g.position.set(x,.43,z);dynamic.add(g);bullets.push({group:g,x,z,dx:t.dx,dz:t.dz,enemy:t.enemy,owner:t,life:2.8,speed:t.enemy?6.3:11.5});
 t.flashLife=.11;t.flash.visible=true;
 burst(x,.44,z,color,3,.5);if(!t.enemy)sound('shoot');
}
function burst(x,y,z,color,count=12,force=2){
 for(let i=0;i<count;i++){
  if(particles.length>=150){const old=particles.shift();dynamic.remove(old.mesh);}
  const size=range(.045,.12),m=mesh(fxGeometry,mat(color,{emissive:color,emissiveIntensity:.8}),x,y,z,size,size,size);m.castShadow=false;dynamic.add(m);
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
 dynamic.traverse(o=>{if(o.isInstancedMesh)o.dispose();});
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
 if(state!=='paused')for(const t of activeTanks()){
  t.flashLife=Math.max(0,t.flashLife-dt);t.flash.visible=t.flashLife>0;
 }
 if(shieldRing){shieldRing.visible=shield>0&&state==='playing';shieldRing.material.opacity=.32+Math.sin(time*7)*.18;}
 for(const m of water)m.position.y=.003+Math.sin(time*1.7+m.position.x*.9+m.position.z)*.009;
 if(toastTimer>0){toastTimer-=dt;if(toastTimer<=0)$('toast').classList.remove('visible');}
 if(shake>0){shake-=dt;camera.position.x=Math.sin(time*70)*shake*.12;}else camera.position.x=0;
}
function resize(){
 const width=viewport.clientWidth,height=viewport.clientHeight;renderer.setSize(width,height);
 const aspect=width/height,vertical=Math.max(7.35,11.65/aspect);
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
