import * as THREE from './vendor/three.module.js';
import {createMatch,start,setPaused,step,trajectory,projectilePose,VERSIONS,availableWeapons} from './hybrid-state.mjs';
const $=id=>document.getElementById(id),viewport=$('viewport');
const params=new URLSearchParams(location.search);
let match=createMatch({version:VERSIONS.includes(params.get('v'))?params.get('v'):VERSIONS.at(-1),bot:params.get('bot')!=='0',map:params.get('map')==='lanes'?'lanes':'maze'});
let keys=new Set(),pointers=new Map(),tapUntil=new Map(),released=new Set(),pendingFire=false,aimPoint=null,accumulator=0,last=performance.now(),muted=true,soundChosen=false,audio,notice='',noticeUntil=0,endReveal=0;
const portrait=matchMedia('(orientation:portrait) and (max-width:900px), (orientation:portrait) and (pointer:coarse)');
const scene=new THREE.Scene();scene.background=new THREE.Color(0x668645);
const camera=new THREE.OrthographicCamera(-12,12,8,-8,.1,100);camera.position.set(0,24,14);camera.lookAt(0,0,0);
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;viewport.prepend(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xf2f4d9,0x3b5734,1.5));
const sun=new THREE.DirectionalLight(0xffe7b8,3);sun.position.set(-10,19,9);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-13;sun.shadow.camera.right=13;sun.shadow.camera.top=11;sun.shadow.camera.bottom=-11;sun.shadow.normalBias=.025;scene.add(sun);
const colors=[0x24bbce,0xe45b78],materials=new Map();
function mat(color){if(!materials.has(color))materials.set(color,new THREE.MeshStandardMaterial({color,roughness:.75,flatShading:true}));return materials.get(color);}
const boxGeo=new THREE.BoxGeometry(1,1,1),wheelGeo=new THREE.CylinderGeometry(1,1,1,10),leafGeo=new THREE.DodecahedronGeometry(1,0),rockGeo=new THREE.IcosahedronGeometry(1,0),ballGeo=new THREE.SphereGeometry(.08,8,6),ringGeo=new THREE.TorusGeometry(1,.025,4,40),noseGeo=new THREE.CylinderGeometry(0,1,1,6);
// Reuse the original prototype's shared bevelled hull construction and polygon palette.
const hullShape=new THREE.Shape();hullShape.moveTo(-.5,-.5);hullShape.lineTo(.5,-.5);hullShape.lineTo(.5,.5);hullShape.lineTo(-.5,.5);hullShape.closePath();
const hullGeo=new THREE.ExtrudeGeometry(hullShape,{depth:.8,bevelEnabled:true,bevelThickness:.1,bevelSize:.08,bevelSegments:1,steps:1});hullGeo.rotateX(Math.PI/2);hullGeo.center();hullGeo.computeBoundingBox();const hullSize=hullGeo.boundingBox.getSize(new THREE.Vector3());hullGeo.scale(1/hullSize.x,1/hullSize.y,1/hullSize.z);
function mesh(parent,geo,color,x,y,z,sx=1,sy=1,sz=1){const o=new THREE.Mesh(geo,mat(color));o.position.set(x,y,z);o.scale.set(sx,sy,sz);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
function box(p,c,x,y,z,sx,sy,sz){return mesh(p,boxGeo,c,x,y,z,sx,sy,sz);}
const scenery=new THREE.Group();scene.add(scenery);
box(scenery,0x436a37,0,-.26,0,22,.5,14);
const tiles=new THREE.InstancedMesh(boxGeo,mat(0xffffff),19*11),dummy=new THREE.Object3D();tiles.receiveShadow=true;
for(let row=0,n=0;row<11;row++)for(let col=0;col<19;col++,n++){
 const x=col-9,z=row-5;dummy.position.set(x,-.025,z);dummy.scale.set(.998,.03,.998);dummy.updateMatrix();tiles.setMatrixAt(n,dummy.matrix);
 const lane=Math.abs(Math.abs(z)-3.5)<1;tiles.setColorAt(n,new THREE.Color(lane?[0xb1b47c,0xb8b882][n%2]:[0x739844,0x7b9e47,0x81a64b][n%3]));
}scenery.add(tiles);let floorKey='';
for(let i=0;i<30;i++){
 const x=-10.3+(i%15)*1.48,z=i<15?-6.6:6.6;
 for(let j=0;j<3;j++)mesh(scenery,leafGeo,[0x44772e,0x699828,0x8faf37][j],x+(j-1)*.22,.25+j*.1,z,.35,.35,.38);
 if(i%2===0)mesh(scenery,rockGeo,0xa0a88c,x+.45,.13,z,.22,.2,.28);
}
const wallViews=new Map(),baseViews=[],unitViews=new Map(),shotViews=new Map(),marks=new Map(),pickupViews=new Map(),flashes=[];
function createTank(u){
 const root=new THREE.Group(),body=new THREE.Group(),turret=new THREE.Group();root.add(body,turret);scene.add(root);const c=colors[u.team],scale=u.kind==='tank'?1:.66;
 for(const side of [-1,1]){
  box(body,0x24453e,side*.28,.14,0,.18,.25,.76);
  for(let j=-2;j<=2;j++){const wheel=mesh(body,wheelGeo,0x738675,side*.385,.14,j*.14,.075,.03,.075);wheel.rotation.z=Math.PI/2;}
  mesh(body,hullGeo,c,side*.28,.28,0,.19,.06,.74);
 }
 mesh(body,hullGeo,c,0,.28,0,.6,.25,.69);box(body,0x275950,0,.414,-.22,.28,.025,.12);
 mesh(turret,hullGeo,c,0,.48,0,.48,.23,.45);
 mesh(turret,wheelGeo,0x345f4b,-.06,.62,-.05,.105,.03,.105);
 const cannon=mesh(turret,wheelGeo,c,0,.49,.37,.067,.45,.067);cannon.rotation.x=Math.PI/2;
 const muzzle=mesh(turret,wheelGeo,0x183f3b,0,.49,.604,.049,.012,.049);muzzle.rotation.x=Math.PI/2;
 const launcher=new THREE.Group();launcher.position.set(0,.49,0);turret.add(launcher);
 for(const side of [-1,1]){
  mesh(launcher,hullGeo,0x36584d,side*.13,0,.06,.2,.18,.66);
  box(launcher,0x112f2e,side*.13,0,.4,.14,.12,.025);
  box(launcher,c,side*.13,.095,.04,.035,.025,.68);
  const loaded=mesh(launcher,wheelGeo,0xf4e9c4,side*.13,0,.15,.045,.4,.045);loaded.rotation.x=Math.PI/2;
 }
 box(body,0xf6df8d,-.22,.33,.34,.07,.055,.035);box(body,0xf6df8d,.22,.33,.34,.07,.055,.035);
 body.scale.setScalar(scale);turret.scale.setScalar(scale);
 const hpBack=box(root,0x244432,0,.95*scale,0,.7,.04,.075),hp=box(root,c,0,.95*scale+.025,0,.7,.035,.075);
 const halo=new THREE.Mesh(ringGeo,new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:.8}));halo.rotation.x=-Math.PI/2;halo.position.y=.04;halo.scale.setScalar(u.r+.12);root.add(halo);
 return {root,body,turret,cannon,muzzle,launcher,hp,hpBack,halo};
}
for(const u of match.units)unitViews.set(u.id,createTank(u));
for(const b of match.bases){
 const g=new THREE.Group();g.position.set(b.x,0,b.z);scene.add(g);
 mesh(g,hullGeo,0xe6cf99,0,.23,0,1.7,.45,1.7);mesh(g,hullGeo,colors[b.team],0,.68,0,1.22,.6,1.22);
 for(let j=0;j<4;j++)box(g,0xf0dbb0,(j%2-.5)*1.02,1.1,(Math.floor(j/2)-.5)*1.02,.28,.36,.28);
 box(g,0x285446,0,1.1,0,.6,.25,.6);const flag=box(g,colors[b.team],.1,1.7,0,.55,.3,.03);box(g,0x284c3b,-.18,1.5,0,.035,.85,.035);baseViews.push({g,flag});
}
for(const w of [...createMatch({version:'0.3'}).walls,...createMatch({version:'0.3',map:'lanes'}).walls]){
 if(wallViews.has(w.id))continue;
 const g=new THREE.Group();g.position.set(w.x,0,w.z);scene.add(g);
 if(w.id.startsWith('rock'))mesh(g,rockGeo,0x999e8c,0,w.h/2,0,w.w*.62,w.h*.66,w.d*.65);
 else if(w.id.startsWith('maze')){
  const bricks=new THREE.InstancedMesh(hullGeo,mat(0xffffff),9);bricks.castShadow=true;bricks.receiveShadow=true;
  for(let layer=0,n=0;layer<3;layer++)for(let col=0;col<3;col++,n++){dummy.position.set((col-1)*w.w/3,w.h*(layer+.5)/3,0);dummy.scale.set(w.w/3-.02,w.h/3-.015,w.d);dummy.updateMatrix();bricks.setMatrixAt(n,dummy.matrix);bricks.setColorAt(n,new THREE.Color([0xd9824e,0xe7975c,0xf0ac70][layer]));}g.add(bricks);
 }
 else if(w.id.startsWith('shed')){
  box(g,0xd1a477,0,w.h*.4,0,w.w,w.h*.8,w.d);mesh(g,hullGeo,0x6a7865,0,w.h-.125,0,w.w*1.15,.25,w.d*1.15);box(g,0x514e39,0,.3,w.d/2+.015,.32,.6,.03);box(g,0xf1db96,-.4,.55,w.d/2+.015,.2,.22,.03);
 }
 else for(let layer=0;layer<3;layer++)for(let col=0;col<3;col++)mesh(g,hullGeo,[0xd9824e,0xe7975c,0xf0ac70][layer],(col-1)*w.w/3,w.h*(layer+.5)/3,0,w.w/3-.02,w.h/3-.015,w.d);
 wallViews.set(w.id,g);
}
const aimRing=new THREE.Mesh(ringGeo,new THREE.MeshBasicMaterial({color:colors[0],transparent:true,opacity:.9}));aimRing.rotation.x=-Math.PI/2;aimRing.position.y=.035;scene.add(aimRing);
const aimRing2=new THREE.Mesh(ringGeo,new THREE.MeshBasicMaterial({color:colors[1],transparent:true,opacity:.8}));aimRing2.rotation.x=-Math.PI/2;aimRing2.position.y=.04;scene.add(aimRing2);
const dots=new THREE.InstancedMesh(ballGeo,new THREE.MeshBasicMaterial({color:0xe8f3b3}),18);dots.castShadow=false;scene.add(dots);
const fxMat=new THREE.MeshBasicMaterial({color:0xffd382,transparent:true,opacity:.8});
const flameMat=new THREE.MeshBasicMaterial({color:0xffbd51,transparent:true,opacity:.9,depthWrite:false});
const smokeTrail=new THREE.InstancedMesh(rockGeo,new THREE.MeshBasicMaterial({color:0xc6c5b1,transparent:true,opacity:.55,depthWrite:false}),128);
smokeTrail.count=0;scene.add(smokeTrail);
const trailPuffs=Array.from({length:128},()=>({life:0,x:0,y:0,z:0}));let trailCursor=0;
const rocketAxis=new THREE.Vector3(0,0,1),rocketDirection=new THREE.Vector3();
function createRocket(team){
 const g=new THREE.Group();
 const body=mesh(g,wheelGeo,0xf2e8c7,0,0,0,.075,.43,.075);body.rotation.x=Math.PI/2;
 const nose=mesh(g,noseGeo,colors[team],0,0,.3,.085,.17,.085);nose.rotation.x=Math.PI/2;
 const band=mesh(g,wheelGeo,colors[team],0,0,.08,.081,.07,.081);band.rotation.x=Math.PI/2;
 box(g,colors[team],0,0,-.17,.28,.025,.16);box(g,colors[team],0,0,-.17,.025,.28,.16);
 const flame=new THREE.Mesh(ballGeo,flameMat);flame.position.z=-.29;flame.scale.set(.8,.8,2.8);g.add(flame);
 g.userData.flame=flame;g.userData.trailClock=0;return g;
}
function animateRocketTrail(dt){
 if((match.status!=='playing'&&match.status!=='finished')||portrait.matches||document.hidden)return;
 let count=0;for(const p of trailPuffs){if(p.life<=0)continue;p.life=Math.max(0,p.life-dt);if(!p.life)continue;
  dummy.position.set(p.x,p.y+(.7-p.life)*.16,p.z);dummy.rotation.set(0,0,0);dummy.scale.setScalar((.065+(.7-p.life)*.15)*Math.min(1,p.life/.15));dummy.updateMatrix();smokeTrail.setMatrixAt(count++,dummy.matrix);
 }smokeTrail.count=count;smokeTrail.instanceMatrix.needsUpdate=true;
}
function beep(type){if(muted)return;try{audio||=new(window.AudioContext||window.webkitAudioContext)();audio.resume();const o=audio.createOscillator(),g=audio.createGain(),t=audio.currentTime;o.type=['baseDestroyed','launch'].includes(type)?'sawtooth':'triangle';o.frequency.setValueAtTime(type==='fire'?300:type==='baseDestroyed'?70:type==='launch'?150:95,t);o.frequency.exponentialRampToValueAtTime(35,t+.16);g.gain.setValueAtTime(type==='baseDestroyed'?.06:.025,t);g.gain.exponentialRampToValueAtTime(.001,t+.18);o.connect(g).connect(audio.destination);o.start();o.stop(t+.19);}catch{}}
const baseScreen=new THREE.Vector3();
function createBaseFX(b){
 const root=new THREE.Group();root.position.set(b.x,0,b.z);root.visible=false;scene.add(root);
 const debris=new THREE.InstancedMesh(hullGeo,mat(0xe1c38b),24);debris.castShadow=true;debris.receiveShadow=true;root.add(debris);
 const smokeMat=new THREE.MeshBasicMaterial({color:0x535b48,transparent:true,opacity:.5,depthWrite:false});
 const smoke=new THREE.InstancedMesh(rockGeo,smokeMat,8);root.add(smoke);
 const fireMat=new THREE.MeshBasicMaterial({color:0xffd477,transparent:true,opacity:1,depthWrite:false});
 const fireball=new THREE.Mesh(ballGeo,fireMat);fireball.position.y=.7;root.add(fireball);
 const shockMat=new THREE.MeshBasicMaterial({color:0xffdf99,transparent:true,opacity:.8,depthWrite:false});
 const shock=new THREE.Mesh(ringGeo,shockMat);shock.rotation.x=-Math.PI/2;shock.position.y=.045;root.add(shock);
 const light=new THREE.PointLight(0xffaa44,0,5,2);light.position.y=1;root.add(light);
 const ruins=new THREE.Group();ruins.position.set(b.x,0,b.z);scene.add(ruins);ruins.visible=false;
 mesh(ruins,wheelGeo,0x374333,0,.01,0,1.1,.02,1.1);
 for(let i=0;i<10;i++){const a=i*2.39996,r=.25+(i%3)*.23;const chunk=mesh(ruins,hullGeo,i%2?0xc8af7f:0x887b61,Math.cos(a)*r,.09,Math.sin(a)*r,.2+(i%3)*.07,.13,.24);chunk.rotation.y=a;}
 return {root,debris,smoke,smokeMat,fireball,fireMat,shock,shockMat,light,ruins,age:-1};
}
for(let i=0;i<2;i++)baseViews[i].fx=createBaseFX(match.bases[i]);
function animateBaseFX(dt){
 const animate=(match.status==='playing'||match.status==='finished')&&!portrait.matches&&!document.hidden;
 for(const v of baseViews){const f=v.fx;if(f.age<0)continue;if(animate)f.age=Math.min(2.8,f.age+dt);const t=f.age;if(t>=2.8){f.root.visible=false;f.light.intensity=0;continue;}
  f.root.visible=t<2.8;f.ruins.visible=true;
  f.fireball.visible=t<.65;f.fireball.scale.setScalar((.1+Math.sin(Math.min(1,t/.65)*Math.PI)*1.1)/.08);f.fireMat.opacity=Math.max(0,1-t/.65);
  f.shock.visible=t<1;f.shock.scale.setScalar(.4+t*3.2);f.shockMat.opacity=Math.max(0,.85*(1-t));f.light.intensity=Math.max(0,18*(1-t/.7));
  for(let i=0;i<24;i++){const a=i*2.39996,speed=.55+(i%5)*.25,land=Math.min(t,1.1),r=.2+speed*land;dummy.position.set(Math.cos(a)*r,Math.max(.08,.4+(2.5+i%3*.4)*t-4.5*t*t),Math.sin(a)*r);dummy.rotation.set(t*(i%3+1),a+t,t*.5);dummy.scale.set(.15+(i%3)*.045,.12,.18);dummy.updateMatrix();f.debris.setMatrixAt(i,dummy.matrix);}f.debris.instanceMatrix.needsUpdate=true;
  f.smokeMat.opacity=Math.max(0,.45*(1-t/2.8));
  for(let i=0;i<8;i++){const a=i*2.39996,r=.15+(i%3)*.15+t*.15;dummy.position.set(Math.cos(a)*r,.5+t*.85+i*.06,Math.sin(a)*r);dummy.rotation.set(0,a,0);dummy.scale.setScalar(.2+t*.38+i*.025);dummy.updateMatrix();f.smoke.setMatrixAt(i,dummy.matrix);}f.smoke.instanceMatrix.needsUpdate=true;
 }
 if(endReveal>0&&animate){endReveal=Math.max(0,endReveal-dt);if(endReveal===0)updateCard();}
}
function clearInput(){keys.clear();pointers.clear();tapUntil.clear();released.clear();pendingFire=false;aimPoint=null;}
function pause(){if(match.status==='playing'){setPaused(match,true);clearInput();updateCard();}else if(match.status==='paused'&&!portrait.matches){setPaused(match,false);clearInput();updateCard();}}
function reset(){clearInput();for(const f of flashes)scene.remove(f.mesh);flashes.length=0;notice='';noticeUntil=0;endReveal=0;for(const p of trailPuffs)p.life=0;smokeTrail.count=0;trailCursor=0;for(const v of baseViews){v.fx.age=-1;v.fx.root.visible=false;v.fx.ruins.visible=false;v.fx.light.intensity=0;}match=createMatch({version:$('version').value,bot:$('bot').checked,map:$('map').value});accumulator=0;updateCard();}
function updateCard(help=false){
 const overlay=(match.status!=='playing'&&!(match.status==='finished'&&endReveal>0))||help;$('overlay').hidden=!overlay;document.body.dataset.overlay=String(overlay);document.body.dataset.version=match.version;$('map').disabled=match.version!=='0.3';
 $('instructions').hidden=match.status==='finished';
 $('title').textContent=match.status==='finished'?(match.winner===null?'Обе базы разрушены.':`${match.winner===0?'Бирюзовая':'Розовая'} команда победила.`):match.status==='paused'?'Бой на паузе.':'Прикрой свою базу.';
 $('message').textContent=match.status==='finished'?'Победа определяется только разрушением базы. Запусти новый бой или сравни другую версию.':match.status==='paused'?'Базы, танки, миньоны и снаряды ждут. Продолжи явно, когда будешь готов.':match.map==='maze'?'Пробирайся к базе через лабиринт. Малые танки патрулируют, выбирают повороты и постепенно наступают. Кирпичи можно разбить, открыв короткий путь.':'Два маршрута, два автоматических помощника и один танк у каждого игрока. Миньонов нельзя игнорировать: они сносят базу.';
 $('play').textContent=match.status==='finished'?'Новый бой':match.status==='paused'?'Продолжить':'Начать бой';$('pause').textContent=match.status==='paused'?'▶':'Ⅱ';
}
$('version').innerHTML=VERSIONS.map(v=>`<option value="${v}">${v}</option>`).join('');$('version').value=match.version;$('map').value=match.map;$('bot').checked=match.bot;
$('version').addEventListener('change',reset);$('map').addEventListener('change',reset);$('bot').addEventListener('change',()=>{match.bot=$('bot').checked;for(const code of Object.values(maps[1])){keys.delete(code);released.delete(code);tapUntil.delete(code);}updateCard();});$('reset').addEventListener('click',reset);$('pause').addEventListener('click',pause);
$('help').addEventListener('click',()=>{if(match.status==='playing')pause();else updateCard(true);});
$('play').addEventListener('click',()=>{if(portrait.matches)return;if(match.status==='finished')reset();if(match.status==='intro')start(match);else if(match.status==='paused')setPaused(match,false);clearInput();if(!soundChosen){soundChosen=true;muted=false;$('sound').setAttribute('aria-pressed','true');$('sound').setAttribute('aria-label','Выключить звук');}beep('fire');updateCard();viewport.focus();});
$('sound').addEventListener('click',()=>{soundChosen=true;muted=!muted;$('sound').setAttribute('aria-pressed',String(!muted));$('sound').setAttribute('aria-label',muted?'Включить звук':'Выключить звук');beep('fire');});
const maps=[{up:'KeyW',down:'KeyS',left:'KeyA',right:'KeyD',fire:'Space',aimLeft:'KeyQ',aimRight:'KeyE',far:'KeyR',near:'KeyF'},{up:'ArrowUp',down:'ArrowDown',left:'ArrowLeft',right:'ArrowRight',fire:'Enter',aimLeft:'Comma',aimRight:'Period',far:'ShiftRight',near:'Slash'}];
const managed=new Set([...maps.flatMap(m=>Object.values(m)),'KeyT','Backslash','KeyG','Minus','Escape']);
function toggle(team,what){const u=match.units.find(u=>u.team===team&&u.kind==='tank');if(what==='arc')u.high=!u.high;else{const options=availableWeapons(u);u.shell=options[(options.indexOf(u.shell)+1)%options.length];}}
document.addEventListener('keydown',e=>{
 if(!managed.has(e.code)||e.target instanceof HTMLSelectElement||e.target instanceof HTMLInputElement)return;
 if(e.target instanceof HTMLButtonElement&&match.status!=='playing'&&['Space','Enter'].includes(e.code))return;
 e.preventDefault();if(e.code==='Escape'){if(!e.repeat)pause();return;}if(match.status!=='playing'||portrait.matches)return;
 if(!e.repeat){if(e.code==='KeyT')toggle(0,'arc');if(e.code==='Backslash')toggle(1,'arc');if(e.code==='KeyG')toggle(0,'shell');if(e.code==='Minus')toggle(1,'shell');}
 if(e.code==='KeyQ'||e.code==='KeyE')aimPoint=null;
 keys.add(e.code);released.delete(e.code);tapUntil.set(e.code,performance.now()+80);
});
document.addEventListener('keyup',e=>released.add(e.code));
for(const b of document.querySelectorAll('[data-action]')){
 b.addEventListener('pointerdown',e=>{e.preventDefault();if(match.status!=='playing'||portrait.matches||e.button!==0)return;pointers.set(e.pointerId,b.dataset.action);if(b.dataset.action==='fire')pendingFire=true;b.setPointerCapture(e.pointerId);});
 for(const event of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(event,e=>{if(event!=='pointerup'&&pointers.get(e.pointerId)==='fire')pendingFire=false;pointers.delete(e.pointerId);});
}
$('arc').addEventListener('click',()=>{if(match.status==='playing')toggle(0,'arc');});
$('shell').addEventListener('click',()=>{if(match.status==='playing')toggle(0,'shell');});
for(const team of [0,1])$('ammo'+team).addEventListener('click',()=>{if(match.status==='playing')toggle(team,'shell');});
window.addEventListener('blur',()=>{clearInput();if(match.status==='playing')pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInput();if(match.status==='playing')pause();}});
portrait.addEventListener('change',()=>{if(portrait.matches){clearInput();if(match.status==='playing')pause();}});
const ray=new THREE.Raycaster(),plane=new THREE.Plane(new THREE.Vector3(0,1,0),0),hit=new THREE.Vector3();
function aimAt(e){const r=renderer.domElement.getBoundingClientRect();ray.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),camera);if(ray.ray.intersectPlane(plane,hit))aimPoint={x:hit.x,z:hit.z};}
renderer.domElement.addEventListener('pointerdown',e=>{if(match.status==='playing'&&match.version!=='0.1'){e.preventDefault();renderer.domElement.setPointerCapture(e.pointerId);aimAt(e);}});
renderer.domElement.addEventListener('pointermove',e=>{if(match.status==='playing'&&(e.buttons||e.pointerType==='mouse')&&match.version!=='0.1')aimAt(e);});
function inputs(){for(const code of released)if(performance.now()>=(tapUntil.get(code)||0)){keys.delete(code);released.delete(code);tapUntil.delete(code);}const result=Object.fromEntries(maps.map((map,team)=>{
 const active=a=>keys.has(map[a])||(team===0&&[...pointers.values()].includes(a));
 const u=match.units.find(u=>u.team===team&&u.kind==='tank');
 const c={x:Number(active('right'))-Number(active('left')),z:Number(active('down'))-Number(active('up')),fire:active('fire')||(team===0&&pendingFire),turn:Number(active('aimRight'))-Number(active('aimLeft')),rangeDelta:Number(active('far'))-Number(active('near'))};
 if(team===0&&aimPoint&&!c.turn){c.aim=Math.atan2(aimPoint.x-u.x,aimPoint.z-u.z);c.range=Math.hypot(aimPoint.x-u.x,aimPoint.z-u.z);}return [team,c];
}));pendingFire=false;return result;}
function resize(){const w=viewport.clientWidth,h=viewport.clientHeight;renderer.setSize(w,h);const aspect=w/h,v=Math.max(7.5,11.5/aspect);camera.left=-v*aspect;camera.right=v*aspect;camera.top=v;camera.bottom=-v;camera.updateProjectionMatrix();}new ResizeObserver(resize).observe(viewport);
function visual(dt,events=[]){
 const floorStamp=match.map+':'+match.navRevision;
 if(floorKey!==floorStamp){
  floorKey=floorStamp;
  for(let row=0,n=0;row<11;row++)for(let col=0;col<19;col++,n++){
   const x=col-9,z=row-5,covered=match.walls.some(w=>w.hp>0&&Math.abs(x-w.x)<w.w/2&&Math.abs(z-w.z)<w.d/2);
   const road=match.map==='maze'?!covered&&Math.abs(x)<8:Math.abs(Math.abs(z)-3.5)<1;
   tiles.setColorAt(n,new THREE.Color(road?[0xb1b47c,0xb8b882][n%2]:[0x739844,0x7b9e47,0x81a64b][n%3]));
  }tiles.instanceColor.needsUpdate=true;
 }

 for(const v of wallViews.values())v.visible=false;
 for(const w of match.walls)wallViews.get(w.id).visible=w.hp>0;
 const lootColors={rocket:0xffb442,rapid:0xbd8aff,repair:0x89f599},lootIds=new Set(match.pickups.map(p=>p.id));
 for(const [id,v] of pickupViews)if(!lootIds.has(id)){scene.remove(v);pickupViews.delete(id);}
 for(const p of match.pickups){let v=pickupViews.get(p.id);if(!v){v=new THREE.Group();mesh(v,hullGeo,lootColors[p.type],0,.25,0,.48,.42,.48);if(p.type==='repair'){box(v,0xffffff,0,.47,0,.32,.025,.09);box(v,0xffffff,0,.48,0,.09,.025,.32);}else{const o=mesh(v,wheelGeo,0xffffff,0,.48,0,.055,.33,.055);o.rotation.z=Math.PI/2;}scene.add(v);pickupViews.set(p.id,v);}v.position.set(p.x,.05+Math.sin(match.time*3)*.06,p.z);v.rotation.y=match.time*.8;}
 for(const u of match.units){const v=unitViews.get(u.id);v.root.visible=u.hp>0;v.root.position.set(u.x,0,u.z);v.body.rotation.y=u.yaw;v.turret.rotation.y=u.turret;v.hp.scale.x=.7*u.hp/u.maxHP;v.hp.position.x=-(.7-v.hp.scale.x)/2;v.halo.visible=u.kind==='tank'&&u.shield>0;
  const missileMode=match.version==='0.3'&&u.shell==='arc';v.launcher.visible=missileMode;v.cannon.visible=v.muzzle.visible=!missileMode;
  if(missileMode){const t=trajectory(match,u);v.launcher.rotation.x=-Math.atan2(t.vy,Math.hypot(t.vx,t.vz)*.6);}
 }
 match.bases.forEach((b,i)=>{
  baseViews[i].g.visible=b.hp>0;const health=$('baseHealth'+i),ratio=b.hp/b.maxHP;
  baseScreen.set(b.x,2.05,b.z).project(camera);
  health.style.left=Math.max(58,Math.min(viewport.clientWidth-58,(baseScreen.x*.5+.5)*viewport.clientWidth))+'px';
  health.style.top=Math.max(55,Math.min(viewport.clientHeight-20,(-baseScreen.y*.5+.5)*viewport.clientHeight))+'px';
  health.className='base-health '+(i===0?'blue':'pink')+(ratio<=1/3?' critical':'')+(b.hp===0?' destroyed':'');
  health.setAttribute('aria-valuenow',String(b.hp));health.setAttribute('aria-valuemax',String(b.maxHP));
  $('baseLabel'+i).textContent=`БАЗА ${b.hp}/${b.maxHP}`;$('baseFill'+i).style.width=(ratio*100)+'%';$('baseFill'+i).style.backgroundColor=ratio<=1/3?'#ff685e':i===0?'#49e3de':'#ff84a3';
 });
 const living=new Set(match.shots.map(s=>s.id));
 for(const [id,v] of shotViews)if(!living.has(id)){scene.remove(v);shotViews.delete(id);const mark=marks.get(id);if(mark){scene.remove(mark);marks.delete(id);}}
 for(const s of match.shots){
  let v=shotViews.get(s.id);if(!v){v=s.ballistic||s.weapon==='rocket'?createRocket(s.team):new THREE.Mesh(ballGeo,mat(s.weapon==='rapid'?0xbd8aff:s.team===0?0xa6f4ef:0xffb5c4));scene.add(v);shotViews.set(s.id,v);}v.position.set(s.x,s.y,s.z);
  if(v.userData.flame){const pose=s.ballistic?projectilePose(s):{vx:s.vx,vy:0,vz:s.vz};rocketDirection.set(pose.vx,pose.vy,pose.vz).normalize();v.quaternion.setFromUnitVectors(rocketAxis,rocketDirection);v.userData.flame.scale.z=2.4+Math.sin(match.time*43)*.6;
   if(match.status==='playing'&&!portrait.matches&&!document.hidden&&dt>0){v.userData.trailClock+=dt;while(v.userData.trailClock>=.045){v.userData.trailClock-=.045;const age=s.ballistic?Math.max(0,s.age-v.userData.trailClock):0,p=s.ballistic?projectilePose(s,age):{x:s.x-s.vx*v.userData.trailClock,y:s.y,z:s.z-s.vz*v.userData.trailClock};const puff=trailPuffs[trailCursor++%trailPuffs.length];Object.assign(puff,{life:.7,x:p.x-rocketDirection.x*.3,y:p.y-rocketDirection.y*.3,z:p.z-rocketDirection.z*.3});}}
  }
  if(s.ballistic){let mark=marks.get(s.id);if(!mark){mark=new THREE.Mesh(ringGeo,mat(colors[s.team]));mark.rotation.x=-Math.PI/2;mark.scale.setScalar(.8);scene.add(mark);marks.set(s.id,mark);}mark.position.set(s.tx,.04,s.tz);}
 }
 for(const e of events){if(e.type==='baseDestroyed'){const f=baseViews[e.team].fx;if(f.age<0){f.age=0;f.root.visible=true;f.ruins.visible=true;endReveal=2.6;beep('baseDestroyed');updateCard();}}if(e.type==='collect'&&e.id==='0-0'){notice={rocket:'Найдено: 3 ракеты',rapid:'Найдено: 12 скорострельных',repair:'Ремонт +2♥'}[e.loot];noticeUntil=match.time+4;}if(['fire','hit','impact','death','destroy','collect'].includes(e.type)){const fx=new THREE.Mesh(rockGeo,fxMat);fx.position.set(e.x,.2,e.z);fx.scale.setScalar(e.type==='fire'?.18:.32);scene.add(fx);flashes.push({mesh:fx,life:.2});beep(e.type==='fire'&&e.weapon==='arc'?'launch':e.type);if(e.type==='impact'&&e.r){fx.scale.setScalar(.4);flashes.at(-1).life=.35;const wave=new THREE.Mesh(ringGeo,fxMat);wave.rotation.x=-Math.PI/2;wave.position.set(e.x,.04,e.z);wave.scale.setScalar(.25);scene.add(wave);flashes.push({mesh:wave,life:.35});}}}
 if(match.status==='playing'||match.status==='finished')for(let i=flashes.length-1;i>=0;i--){const f=flashes[i];f.life-=dt;f.mesh.scale.multiplyScalar(1+dt*4);if(f.life<=0){scene.remove(f.mesh);flashes.splice(i,1);}}
 animateRocketTrail(dt);animateBaseFX(dt);
 const tanks=[0,1].map(team=>match.units.find(u=>u.team===team&&u.kind==='tank'));
 [aimRing,aimRing2].forEach((ring,i)=>{const u=tanks[i],t=trajectory(match,u);ring.visible=match.version==='0.3'&&u.hp>0&&match.status==='playing'&&u.shell==='arc';ring.position.set(t.x,.04,t.z);ring.scale.setScalar(.75);});
 dots.visible=false;
 if(match.version==='0.3'&&match.status==='playing'&&tanks[0].hp>0&&tanks[0].shell==='arc'){
  const u=tanks[0],t=trajectory(match,u);dots.visible=true;
  for(let i=0;i<18;i++){const f=(i+1)/18;dummy.position.set(t.ox+(t.x-t.ox)*(.6*f+.4*f*f),t.heightAt(f*t.time),t.oz+(t.z-t.oz)*(.6*f+.4*f*f));dummy.scale.setScalar(.4);dummy.updateMatrix();dots.setMatrixAt(i,dummy.matrix);}dots.instanceMatrix.needsUpdate=true;
 }
 const describe=(team)=>{const u=tanks[team],mins=match.units.filter(v=>v.team===team&&v.kind==='minion'&&v.hp>0).length;return `БАЗА ${match.bases[team].hp}/${match.cfg.baseHP} · ТАНК ${u.hp>0?u.hp+'♥':Math.max(0,u.respawn).toFixed(1)+'с'} · МИНЬОНЫ ${mins}/${match.cfg.minions}`;};
 $('blueScore').textContent=describe(0);$('pinkScore').textContent=describe(1);
 $('status').textContent=match.status==='playing'?`v${match.version} · ${Math.floor(match.time)}с`:match.status==='finished'?'БАЗА РАЗРУШЕНА':'ЛОКАЛЬНЫЙ БОЙ';
 $('rules').textContent=`v${match.version} · ${match.map==='maze'?'Лабиринт':'Полосы'} · ${match.bot?'Бирюзовый vs AI':'Два человека / одна клавиатура'}`;
 $('arc').textContent=tanks[0].high?'ВЫСОКАЯ':'НИЗКАЯ';
 const weaponName=u=>({arc:'РАКЕТНАЯ ДУГА',direct:'ПРЯМОЙ',rocket:`ПРЯМАЯ РАКЕТА ×${u.ammo.rocket}`,rapid:`СКОРОСТР. ×${u.ammo.rapid}`}[u.shell]);
 $('shell').textContent=weaponName(tanks[0]);$('arc').disabled=tanks[0].shell!=='arc';
 for(const team of [0,1])$('ammo'+team).textContent=`${team+1}: ${weaponName(tanks[team])}`;
 $('status').textContent+=match.version==='0.3'&&match.status==='playing'?` · ${tanks[0].shell==='arc'?(tanks[0].high?'ВЫСОКАЯ':'НИЗКАЯ')+' '+tanks[0].range.toFixed(1)+'м':weaponName(tanks[0])}`:'';
 if(match.bot&&match.status==='playing')$('status').textContent+=` · AI: ${tanks[1].intent==='defend'?'ЗАЩИТА':'АТАКА'}`;
 if(notice&&match.time<noticeUntil)$('status').textContent+=` · ${notice}`;
 $('hint').textContent=match.version==='0.1'?'WASD / Пробел · Стрелки / Enter · Esc — пауза':`Q/E · ,/. башни | v${match.version}${match.version==='0.3'?' · R/F и / Shift дальность · T/\\ дуга · G/− снаряд':''} · касание поля: прицел`;
 $('stats').textContent=`${renderer.info.render.calls} calls · ${renderer.info.render.triangles} triangles`;
 viewport.dataset.snapshot=JSON.stringify({version:match.version,map:match.map,status:match.status,time:match.time,winner:match.winner,bases:match.bases.map(b=>b.hp),units:match.units.map(u=>({id:u.id,x:u.x,z:u.z,hp:u.hp,respawn:u.respawn,vx:u.vx,vz:u.vz,turret:u.turret,range:u.range,high:u.high,shell:u.shell,ammo:u.ammo,intent:u.intent,turns:u.turns})),pickups:match.pickups,walls:match.walls.filter(w=>Number.isFinite(w.hp)).map(w=>({id:w.id,hp:w.hp})),shots:match.shots.map(s=>({x:s.x,z:s.z,y:s.y,ballistic:s.ballistic,owner:s.owner,weapon:s.weapon,remainingRange:s.remainingRange})),trailPuffs:smokeTrail.count,baseFX:baseViews.map(v=>v.fx.age),geometries:renderer.info.memory.geometries});
}
updateCard();resize();visual(0);
Object.defineProperty(window,'hybrid',{get:()=>({version:match.version,map:match.map,status:match.status,time:match.time,winner:match.winner,bot:match.bot,bases:match.bases.map(b=>({team:b.team,hp:b.hp})),units:match.units.map(u=>({id:u.id,x:u.x,z:u.z,hp:u.hp,respawn:u.respawn,vx:u.vx,vz:u.vz,yaw:u.yaw,turret:u.turret,range:u.range,high:u.high,shell:u.shell,ammo:u.ammo,intent:u.intent,turns:u.turns})),pickups:match.pickups,walls:match.walls.filter(w=>Number.isFinite(w.hp)).map(w=>({id:w.id,hp:w.hp})),shots:match.shots.map(s=>({x:s.x,z:s.z,y:s.y,ballistic:s.ballistic,owner:s.owner,weapon:s.weapon,remainingRange:s.remainingRange})),trailPuffs:smokeTrail.count,baseFX:baseViews.map(v=>v.fx.age),geometries:renderer.info.memory.geometries,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles})});
function frame(now){
 const dt=Math.min((now-last)/1000,.1);last=now;let events=[];
 if(portrait.matches&&match.status==='playing')pause();
 if(match.status==='playing'){
  accumulator+=dt;
  while(accumulator>=1/60&&match.status==='playing'){step(match,1/60,inputs());events.push(...match.events);accumulator-=1/60;}
  if(match.status==='finished'){clearInput();updateCard();}
 }else accumulator=0;
 visual(dt,events);renderer.render(scene,camera);requestAnimationFrame(frame);
}requestAnimationFrame(frame);
