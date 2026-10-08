import {PROFILES,STUDY,DEFENSE,outpostPositions,ARMOR,SUPPLY,MAPS,abcMapId,mapWalls,studyWalls,routePoints} from './hybrid-experiments.mjs?v=20261008-t040-1';
// Pure, deterministic local simulation. No DOM/Three/network authority claimed.
export const CONFIG=Object.freeze({width:20,height:12,seed:20261006,baseHP:30,tankHP:5,minionHP:2,minions:2,tankRespawn:4,minionRespawn:6.5,speed:3.2,minionSpeed:1.25,shotDelay:.65,tankShotDelay:.95,tankArcDelay:3.6,tankDamage:2,tankArcDamage:3,minionShotDelay:1.2,damage:1,acceleration:10,drag:2.6,recoil:.7,hitImpulse:2.5,gravity:9,highFlight:2.4,lowFlight:1.2,arcShotDelay:2.8,maxArcShots:1,directRange:3.2,rocketRange:6,splashRadius:1,inheritVelocity:.15});
export const VERSIONS=['0.1','0.2','0.3'];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const angle=(x,z)=>Math.atan2(x,z);
export function createMatch({version='0.1',bot=false,map='maze',experiment='legacy',config={}}={}){
 if(!VERSIONS.includes(version))throw new Error('Unknown rules version');
 if(!PROFILES[experiment])throw Error('Unknown experiment');
 if(experiment!=='legacy'&&version!=='0.3')throw Error('Для эксперимента нужна версия 0.3.');
 if(experiment==='combined')map=abcMapId(map);
 const cfg={...CONFIG,...config};
 const bases=[0,1].map(team=>({team,x:team===0?-8.9:8.9,z:0,r:.85,h:1.2,hp:cfg.baseHP,maxHP:cfg.baseHP}));
 const units=[];
 for(let team=0;team<2;team++)for(let i=0;i<=cfg.minions;i++){
  const kind=i===0?'tank':'minion',dir=team===0?1:-1;
  const sx=dir*-7.3,sz=experiment!=='legacy'?0:i===0?0:(i%2===1?-1:1)*((i%2===1)===(team===0)?3.15:3.95);
  units.push({id:`${team}-${i}`,team,kind,lane:sz,sx,sz,x:sx,z:sz,vx:0,vz:0,yaw:angle(dir,0),turret:angle(dir,0),r:kind==='tank'?.36:.24,h:kind==='tank'?.65:.43,maxHP:kind==='tank'?cfg.tankHP:cfg.minionHP,hp:kind==='tank'?cfg.tankHP:cfg.minionHP,cooldown:0,respawn:0,range:4.8,high:true,shell:'arc',ammo:{rocket:0,rapid:0},shield:1,rng:(cfg.seed+team*1009+i*137)>>>0,patrol:null,visits:{},turns:0,stuck:0});
 }
 const walls=experiment==='combined'?mapWalls(map):experiment!=='legacy'?studyWalls():version==='0.3'&&map==='maze'?createMaze():[{id:'low-0',x:0,z:0,w:1.25,d:2.6,h:.65,hp:6,loot:'rocket'},{id:'low-1',x:-3,z:1.5,w:1.7,d:.65,h:.65,hp:4,loot:'rapid'},{id:'low-2',x:3,z:-1.5,w:1.7,d:.65,h:.65,hp:4,loot:'repair'},{id:'rock-0',x:-3,z:-1.3,w:1,d:.9,h:1.6,hp:Infinity},{id:'rock-1',x:3,z:1.3,w:1,d:.9,h:1.6,hp:Infinity}];
 if(experiment==='legacy')walls.push({id:'shed-0',x:-5,z:4.8,w:1.2,d:.9,h:1.1,hp:version==='0.3'?3:0,loot:'rocket'},{id:'shed-1',x:5,z:-4.8,w:1.2,d:.9,h:1.1,hp:version==='0.3'?3:0,loot:'rapid'});
 const result={version,experiment,map:experiment==='combined'?map:experiment!=='legacy'?STUDY.mapId:version==='0.3'?map:'lanes',bot,cfg,bases,units,walls,pickups:[],shots:[],events:[],status:'intro',winner:null,time:0,nextShot:0,navRevision:0,navCache:null};
 if(experiment!=='legacy'){result.teamOrders=['split','split'];result.splitNext=[0,0];result.units.filter(u=>u.kind==='minion').forEach(u=>{const i=Number(u.id.split('-')[1]);u.x=u.sx;u.z=u.sz=(i===1?-.8:.8);u.stage=0;u.assignedLane=null;});}
 if(['armor','combined'].includes(experiment))result.units.filter(u=>u.kind==='tank').forEach(u=>u.armor={charges:ARMOR.maxCharges,lastHit:0,moved:0});
 if(['supply','combined'].includes(experiment))result.supply={nextSpawn:SUPPLY.first,cycle:0};
 if(experiment==='combined'){result.outposts=outpostPositions(map).map(p=>({...p,hp:DEFENSE.hp,maxHP:DEFENSE.hp,cooldown:0,turret:angle(teamDirection(p.team),0),aggro:null,aggroUntil:0,target:null}));result.bases.forEach(b=>b.protected=true);}
 return result;
}
function teamDirection(team){return team===0?1:-1;}
function createMaze(){
 // Original layout: staggered gates, junctions and side pockets, rather than two straight lanes.
 const cells=new Map(),put=(x,z)=>cells.set(`${x},${z}`,{id:`maze-${x}-${z}`,x,z,w:.94,d:.94,h:.65,hp:3});
 for(const [x,rows] of [[-6,[-5,-4,-3,-2,1,2,3,4]],[-4,[-3,-2,-1,0,1]],[-2,[-5,-4,-3,2,3,4,5]],[0,[-3,-2,-1,0,1,2,3]]]){
  for(const z of rows){put(x,z);if(x!==0)put(-x,-z);}
 }
 for(const [x,z] of [[-6,-1],[-5,-1]]){put(x,z);put(-x,-z);}
 const walls=[...cells.values()];
 for(const [x,z,loot] of [[0,0,'rocket'],[-4,0,'rapid'],[4,0,'repair'],[-2,3,'repair'],[2,-3,'rocket']])cells.get(`${x},${z}`).loot=loot;
 walls.push({id:'rock-maze-0',x:-8,z:-5,w:.94,d:.94,h:1.6,hp:Infinity},{id:'rock-maze-1',x:8,z:5,w:.94,d:.94,h:1.6,hp:Infinity});
 return walls;
}
function random(u){u.rng=(Math.imul(u.rng,1664525)+1013904223)>>>0;return u.rng/4294967296;}
function clearSegment(m,u,a,b){
 if(m.outposts){const dx=b.x-a.x,dz=b.z-a.z,len=dx*dx+dz*dz;if(len>0)for(const t of m.outposts)if(t.hp>0){const f=clamp(((t.x-a.x)*dx+(t.z-a.z)*dz)/len,0,1);if(Math.hypot(a.x+f*dx-t.x,a.z+f*dz-t.z)<u.r+t.r+1e-5)return false;}}

 const n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.15));
 for(let i=1;i<=n;i++)if(blocked(m,u,a.x+(b.x-a.x)*i/n,a.z+(b.z-a.z)*i/n))return false;
 return true;
}
export function navigation(m){
 if(m.navCache&&m.navCache.revision===m.navRevision)return m.navCache;
 const nodes=[],lookup=new Map(),probe={r:.38},spacing=m.outposts?.5:1;
 for(let z=-5;z<=5;z+=spacing)for(let x=-9;x<=9;x+=spacing)if(!blocked(m,probe,x,z)){const n={id:nodes.length,x,z,edges:[]};nodes.push(n);lookup.set(`${x},${z}`,n);}
 for(const n of nodes)for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){const next=lookup.get(`${n.x+dx*spacing},${n.z+dz*spacing}`);if(next&&clearSegment(m,probe,n,next))n.edges.push(next.id);}
 m.navCache={revision:m.navRevision,nodes};return m.navCache;
}
function nearest(nodes,p,filter=()=>true){let best=null,score=Infinity;for(const n of nodes)if(filter(n)){const d=Math.hypot(n.x-p.x,n.z-p.z);if(d<score){score=d;best=n;}}return best;}
function distanceField(nodes,goal,filter=()=>true){
 const distances=new Map([[goal.id,0]]),q=[goal.id];
 for(let i=0;i<q.length;i++)for(const id of nodes[q[i]].edges)if(!distances.has(id)&&filter(nodes[id])){distances.set(id,distances.get(q[i])+1);q.push(id);}
 return distances;
}
function steering(u,p){const dx=p.x-u.x,dz=p.z-u.z;return {x:clamp(dx*2,-1,1),z:clamp(dz*2,-1,1)};}
function route(m,u,goal){
 const {nodes}=navigation(m);let from=nearest(nodes,u);if(m.outposts&&from&&!clearSegment(m,u,u,from))from=nearest(nodes,u,n=>clearSegment(m,u,u,n));if(!from)return {x:0,z:0};
 const dir=u.team===0?1:-1,filter=n=>u.intent!=='defend'||from.x*dir>-1.5||n.x*dir<=-1.5;
 const dest=nearest(nodes,goal,filter),distances=distanceField(nodes,dest,filter);
 if(!u.route||u.route.revision!==m.navRevision||u.route.dest!==dest.id||m.time>u.route.until||u.stuck>.8){
  const near=from.edges.filter(id=>distances.has(id));
  near.sort((a,b)=>distances.get(a)-distances.get(b));
  const next=near.find(id=>!m.units.some(o=>o!==u&&o.hp>0&&Math.hypot(o.x-nodes[id].x,o.z-nodes[id].z)<o.r+u.r+.1))??near[0];
  u.route={revision:m.navRevision,dest:dest.id,until:m.time+.8,point:nodes[next]||from};u.stuck=0;
 }
 if(Math.hypot(u.route.point.x-u.x,u.route.point.z-u.z)<.16)u.route.until=0;
 // First reach the corridor centre when entering from a spawn or recovering from a push.
 const point=!clearSegment(m,u,u,u.route.point)?from:u.route.point;
 if(from.id===dest.id)return steering(u,from);
 return steering(u,point);
}
function patrol(m,u){
 const {nodes}=navigation(m),from=nearest(nodes,u),dir=u.team===0?1:-1;
 if(!from)return {x:0,z:0};
 const goal=nearest(nodes,{x:dir*7,z:0}),distances=distanceField(nodes,goal);
 const expired=!u.patrol||u.patrol.revision!==m.navRevision||u.stuck>.65;
 const arrived=u.patrol&&Math.hypot(u.patrol.point.x-u.x,u.patrol.point.z-u.z)<.16;
 if(expired||arrived){
  const current=from;u.visits[current.id]=(u.visits[current.id]||0)+1;
  const currentDistance=distances.get(current.id);
  if(u.bestDistance===undefined||currentDistance<u.bestDistance){u.bestDistance=currentDistance;u.detours=0;}else u.detours=(u.detours||0)+1;
  let options=current.edges.filter(id=>distances.has(id));
  if(u.detours>=6){const onward=options.filter(id=>distances.get(id)<currentDistance);if(onward.length)options=onward;}

  const weighted=options.map(id=>({id,weight:(distances.get(id)<distances.get(current.id)?5:1)/(1+(u.visits[id]||0)*.7)*(id===u.previous?.18:1)}));
  let roll=random(u)*weighted.reduce((s,o)=>s+o.weight,0),selected=weighted.at(-1)?.id;
  for(const o of weighted){roll-=o.weight;if(roll<=0){selected=o.id;break;}}
  const next=nodes[selected]||current,dx=next.x-current.x,dz=next.z-current.z;
  // Keep right in narrow passages so opposing small tanks can pass one another.
  const point={x:next.x+dz*.24,z:next.z-dx*.24};
  if(u.heading!==undefined&&u.heading!==angle(dx,dz))u.turns++;
  u.heading=angle(dx,dz);u.previous=current.id;u.patrol={revision:m.navRevision,point:clearSegment(m,u,current,point)?point:next};u.stuck=0;
 }
 const point=clearSegment(m,u,u,u.patrol.point)?u.patrol.point:from;
 return steering(u,point);
}
function lineOfFire(m,u,target){
 const n=Math.max(1,Math.ceil(Math.hypot(target.x-u.x,target.z-u.z)/.12));
 for(let i=1;i<n;i++)if(m.walls.some(w=>w.hp>0&&Math.abs(u.x+(target.x-u.x)*i/n-w.x)<w.w/2+.04&&Math.abs(u.z+(target.z-u.z)*i/n-w.z)<w.d/2+.04))return false;
 return true;
}
function mazeAI(m,u){
 const base=m.bases[1-u.team],dir=u.team===0?1:-1;
 let target=base,goal={x:dir*7,z:0};
 if(u.kind==='tank'){
  const own=m.bases[u.team],incoming=m.units.filter(o=>o.team!==u.team&&o.kind==='minion'&&o.hp>0);
  incoming.sort((a,b)=>Math.hypot(a.x-own.x,a.z-own.z)-Math.hypot(b.x-own.x,b.z-own.z));
  if(incoming.length){target=incoming[0];u.intent='defend';goal={x:dir*clamp(target.x*dir,-6,-2),z:target.z};u.shell='direct';}
  else{u.intent='attack';u.shell='arc';}
 }else{
  u.intent='patrol';u.shell='direct';
  const close=m.units.filter(o=>o.team!==u.team&&o.hp>0).sort((a,b)=>Math.hypot(a.x-u.x,a.z-u.z)-Math.hypot(b.x-u.x,b.z-u.z))[0];
  if(Math.hypot(base.x-u.x,base.z-u.z)>3&&close&&Math.hypot(close.x-u.x,close.z-u.z)<2.7&&lineOfFire(m,u,close))target=close;
 }
 const d=Math.hypot(target.x-u.x,target.z-u.z),flight=u.shell==='arc'?m.cfg.highFlight:d/8;
 const tx=target.x+(target.vx||0)*flight,tz=target.z+(target.vz||0)*flight,clear=lineOfFire(m,u,target);
 let motion=u.kind==='minion'?patrol(m,u):route(m,u,goal);
 if(d<(target===base?3:2.3)&&clear){motion={x:0,z:0};if(u.kind==='minion')u.intent=target===base?'siege':'engage';}
 return {...motion,aim:angle(tx-u.x,tz-u.z),range:clamp(Math.hypot(tx-u.x,tz-u.z),2,8),fire:d<(u.shell==='arc'?6.5:m.cfg.directRange+u.r+target.r)&&clear};
}
export function setPaused(m,paused){if(m.status==='playing'&&paused)m.status='paused';else if(m.status==='paused'&&!paused)m.status='playing';}
export function start(m){if(m.status==='intro')m.status='playing';}
function circleBox(u,x,z,w){const nx=clamp(x,w.x-w.w/2,w.x+w.w/2),nz=clamp(z,w.z-w.d/2,w.z+w.d/2);return Math.hypot(x-nx,z-nz)<u.r;}
export function blocked(m,u,x,z){
 if(Math.abs(x)>m.cfg.width/2-u.r||Math.abs(z)>m.cfg.height/2-u.r)return true;
 if(m.walls.some(w=>w.hp>0&&circleBox(u,x,z,w)))return true;
 if(m.outposts?.some(t=>t.hp>0&&Math.hypot(x-t.x,z-t.z)<u.r+t.r))return true;
 return m.bases.some(b=>Math.hypot(x-b.x,z-b.z)<u.r+b.r);
}
function move(m,u,dx,dz){
 const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.1));
 for(let i=0;i<steps;i++){
  if(!blocked(m,u,u.x+dx/steps,u.z))u.x+=dx/steps;else u.vx=0;
  if(!blocked(m,u,u.x,u.z+dz/steps))u.z+=dz/steps;else u.vz=0;
 }
}
function collideUnits(m){
 const alive=m.units.filter(u=>u.hp>0);
 for(let pass=0;pass<2;pass++)for(let i=0;i<alive.length;i++)for(let j=i+1;j<alive.length;j++){
  const a=alive[i],b=alive[j],dx=b.x-a.x,dz=b.z-a.z,d=Math.hypot(dx,dz),overlap=a.r+b.r-d;
  if(overlap<=0)continue;const nx=d>1e-6?dx/d:1,nz=d>1e-6?dz/d:0;
  move(m,a,-nx*overlap/2,-nz*overlap/2);move(m,b,nx*overlap/2,nz*overlap/2);
  if(m.version!=='0.1'){
   const closing=(b.vx-a.vx)*nx+(b.vz-a.vz)*nz;
   if(closing<0){const ma=a.kind==='tank'?2:1,mb=b.kind==='tank'?2:1,j=-1.2*closing/(1/ma+1/mb);a.vx-=j*nx/ma;a.vz-=j*nz/ma;b.vx+=j*nx/mb;b.vz+=j*nz/mb;}
  }
 }
}
function damage(m,target,amount,s){
 if(target.hp<=0)return;
 const rawDamage=amount,attacker={id:s.owner,team:s.team,kind:s.ownerKind||m.units.find(u=>u.id===s.owner)?.kind||'tower'};
 if(target.protected){m.events.push({type:'baseBlocked',team:target.team,x:target.x,z:target.z,attacker,target:`base-${target.team}`,targetType:'base',weapon:s.weapon,rawDamage,appliedDamage:0});return;}
 if(target.kind==='tower'){
  const applied=Math.min(target.hp,amount);target.hp=Math.max(0,target.hp-amount);target.lastHit=m.time;target.lastAttacker=attacker.id;m.events.push({type:'outpostDamage',id:target.id,team:target.team,x:target.x,z:target.z,attacker,target:target.id,targetType:'tower',weapon:s.weapon,rawDamage,appliedDamage:applied});
  if(target.hp===0){target.target=target.aggro=null;m.navRevision++;m.events.push({type:'outpostDestroyed',id:target.id,team:target.team,lane:target.lane,x:target.x,z:target.z,attacker,targetType:'tower'});const b=m.bases[target.team];if(b.protected){b.protected=false;m.events.push({type:'baseShieldDisabled',team:b.team,target:`base-${b.team}`,targetType:'base',outpostId:target.id,x:b.x,z:b.z,attacker});}}return;
 }

 if(target.armor){
  target.armor.lastHit=m.time;target.armor.moved=0;
  const incoming=angle(-s.vx,-s.vz),difference=Math.atan2(Math.sin(incoming-target.yaw),Math.cos(incoming-target.yaw));
  if(target.shield<=0&&!s.ballistic&&['direct','rapid'].includes(s.weapon)&&target.armor.charges>0&&Math.abs(difference)<=ARMOR.halfAngle+1e-9){
   const absorbed=Math.min(1,amount);amount-=absorbed;target.armor.charges--;
   m.events.push({type:'shield_absorb',id:target.id,team:target.team,attacker:{id:s.owner,team:s.team,...(m.outposts?{kind:attacker.kind}: {})},...(m.outposts?{targetType:target.kind}: {}),weapon:s.weapon,rawDamage,absorbedDamage:absorbed,appliedDamage:Math.min(target.hp,amount),charges:target.armor.charges,x:target.x,z:target.z});
  }
 }
 if(target.shield>0)return;const applied=Math.min(target.hp,amount);target.hp=Math.max(0,target.hp-amount);if(m.outposts&&!target.kind&&applied>0){target.lastHit=m.time;target.lastAttacker=attacker.id;}
 m.events.push({type:'hit',x:target.x,z:target.z,team:target.team,...({attacker:{id:s.owner,team:s.team,kind:attacker.kind},target:target.id||`base-${target.team}`,...(m.outposts?{targetType:target.kind||'base'}: {}),weapon:s.weapon,rawDamage,appliedDamage:applied})});
 if(applied>0&&target.kind==='tank'&&attacker.kind==='tank'&&m.outposts){const a=m.units.find(u=>u.id===s.owner);for(const t of m.outposts)if(t.team===target.team&&t.hp>0&&Math.hypot(t.x-target.x,t.z-target.z)<=DEFENSE.range&&towerEligible(m,t,a)){t.aggro=a.id;t.aggroUntil=m.time+DEFENSE.retaliation;m.events.push({type:'outpostAggro',id:t.id,team:t.team,target:a.id,targetType:'tank',attacker,until:t.aggroUntil,x:t.x,z:t.z});}}
 if(!target.kind)m.events.push({type:'baseDamage',attacker:{id:s.owner,team:s.team,kind:attacker.kind},target:`base-${target.team}`,weapon:s.weapon,rawDamage,appliedDamage:applied});
 if(!target.kind&&target.hp===0)m.events.push({type:'baseDestroyed',team:target.team,x:target.x,z:target.z});
 if(target.kind&&target.hp===0){if(['supply','combined'].includes(m.experiment)){target.ammo={rocket:0,rapid:0};target.shell='arc';}target.respawn=target.kind==='tank'?m.cfg.tankRespawn:m.cfg.minionRespawn;target.vx=target.vz=0;m.events.push({type:'death',id:target.id,x:target.x,z:target.z,...(m.experiment!=='legacy'?{team:target.team,kind:target.kind,lane:target.assignedLane}: {})});}
}
function damageWall(m,w,amount){
 if(w.hp<=0||!Number.isFinite(w.hp))return;
 w.hp=Math.max(0,w.hp-amount);
 if(w.hp===0){
  m.navRevision++;
  m.events.push({type:'destroy',x:w.x,z:w.z,id:w.id});
  if(m.experiment==='legacy'&&m.version==='0.3'&&w.loot){m.pickups.push({id:w.id,x:w.x,z:w.z,type:w.loot});m.events.push({type:'drop',x:w.x,z:w.z,loot:w.loot});}
 }
}
export function availableWeapons(u){return ['arc','direct',...['rocket','rapid'].filter(w=>u.ammo[w]>0)];}
function collect(m,u){
 if(m.version!=='0.3'||u.kind!=='tank'||u.hp<=0)return;
 m.pickups=m.pickups.filter(p=>{
  if(Math.hypot(p.x-u.x,p.z-u.z)>u.r+.35)return true;
  if(p.type==='repair'&&u.hp===u.maxHP)return true;
  if(['supply','combined'].includes(m.experiment)&&p.type==='rocket'&&u.ammo.rocket>=SUPPLY.ammoCap)return true;
  const healthBefore=u.hp,ammoBefore=u.ammo.rocket;
  if(p.type==='repair')u.hp=Math.min(u.maxHP,u.hp+2);
  else{u.ammo[p.type]=Math.min(p.type==='rocket'?6:24,u.ammo[p.type]+(p.type==='rocket'?3:12));u.shell=p.type;}
  if(['supply','combined'].includes(m.experiment))m.events.push({type:'supply_collect',id:p.id,pointId:p.pointId,resourceType:p.type,unitId:u.id,team:u.team,time:m.time,x:p.x,z:p.z,healthEffect:u.hp-healthBefore,ammoEffect:u.ammo.rocket-ammoBefore,healthAfter:u.hp,ammoAfter:u.ammo.rocket});
  m.events.push({type:'collect',id:u.id,x:u.x,z:u.z,loot:p.type});return false;
 });
}
export function fire(m,u){
 if(m.status!=='playing'||u.hp<=0||u.cooldown>0)return null;
 if(!availableWeapons(u).includes(u.shell))u.shell='direct';
 const weapon=m.version==='0.3'?u.shell:'direct';
 if(weapon==='arc'&&m.shots.filter(s=>s.owner===u.id&&s.ballistic).length>=m.cfg.maxArcShots)return null;
 const speed=weapon==='rocket'?10.5:weapon==='rapid'?14:8;
 const dx=Math.sin(u.turret),dz=Math.cos(u.turret);
 const shot={id:m.nextShot++,team:u.team,owner:u.id,x:u.x+dx*(u.r+.08),z:u.z+dz*(u.r+.08),y:.35,vx:dx*speed,vz:dz*speed,life:2.5,ballistic:false,weapon,damage:weapon==='rocket'?2:m.version==='0.3'&&u.kind==='tank'?(weapon==='arc'?m.cfg.tankArcDamage:weapon==='rapid'?m.cfg.damage:m.cfg.tankDamage):m.cfg.damage,splash:weapon==='rocket'?1.4:m.cfg.splashRadius,remainingRange:m.version==='0.3'&&weapon!=='arc'?(weapon==='rocket'?m.cfg.rocketRange:m.cfg.directRange):Infinity};
 if(weapon==='arc'){
  const t=trajectory(m,u);Object.assign(shot,{x:t.ox,z:t.oz,y:t.launchY,launchY:t.launchY,gravity:t.gravity,ox:t.ox,oz:t.oz,vx:t.vx,vz:t.vz,vy:t.vy,age:0,flight:t.time,tx:t.x,tz:t.z,life:t.time+.1,ballistic:true});
 }
 m.shots.push(shot);u.cooldown=weapon==='arc'?(u.kind==='tank'?m.cfg.tankArcDelay:m.cfg.arcShotDelay):u.kind==='tank'?(weapon==='rapid'?.22:m.version==='0.3'?m.cfg.tankShotDelay:m.cfg.shotDelay):m.cfg.minionShotDelay;
 if(weapon==='rocket'||weapon==='rapid'){u.ammo[weapon]--;if(u.ammo[weapon]===0)u.shell='direct';}
 if(m.version!=='0.1'){u.vx-=dx*m.cfg.recoil;u.vz-=dz*m.cfg.recoil;}
 m.events.push({type:'fire',id:u.id,x:shot.x,z:shot.z,weapon,...({team:u.team,kind:u.kind,shotId:shot.id,aim:u.turret,target:{x:shot.tx??shot.x+dx*shot.remainingRange,z:shot.tz??shot.z+dz*shot.remainingRange},rawDamage:shot.damage})});return shot;
}
function ai(m,u){
 if(m.outposts)return defenseAI(m,u);
 if(m.experiment!=='legacy')return studyAI(m,u);
 if(m.version==='0.3'&&m.map==='maze')return mazeAI(m,u);
 const base=m.bases[1-u.team],dir=u.team===0?1:-1;
 const human=m.units.find(o=>o.team!==u.team&&o.kind==='tank'&&o.hp>0);
 const baseDistance=Math.hypot(base.x-u.x,base.z-u.z);
 let target=base;
 if(baseDistance>5&&human&&Math.hypot(human.x-u.x,human.z-u.z)<2.5)target=human;
 const dx=target.x-u.x,dz=target.z-u.z,d=Math.hypot(dx,dz);
 const aim=angle(dx,dz);
 if(u.kind==='tank'){
  const own=m.bases[u.team];
  const attackers=m.units.filter(o=>o.team!==u.team&&o.kind==='minion'&&o.hp>0);
  // The commander stays on its own side until every incoming minion is eliminated.
  attackers.sort((a,b)=>Math.hypot(a.x-own.x,a.z-own.z)-Math.hypot(b.x-own.x,b.z-own.z));
  const threat=attackers[0];let gx,gz,shootTarget;
  if(threat){
   u.intent='defend';u.shell='direct';shootTarget=threat;
   const forward=clamp(threat.x*dir,-6.1,-2);
   gx=dir*forward-u.x;gz=threat.z-u.z;
  }else{
   u.intent='attack';u.shell=m.version==='0.3'?'arc':'direct';shootTarget=base;
   gx=dir*6.4-u.x;gz=3.15-u.z;
  }
  // Join the clear lane before moving across cover; settle at firing distance.
  const aligned=Math.abs(gz)<.2,ownRear=u.x*dir<-6.2;
  let mx=ownRear&&!aligned?0:gx,mz=gz;
  const distance=Math.hypot(shootTarget.x-u.x,shootTarget.z-u.z);
  if(threat&&distance<2.7){mx=0;mz=0;}
  const md=Math.hypot(mx,mz),flight=u.shell==='arc'?m.cfg.highFlight:distance/8;
  const tx=shootTarget.x+(shootTarget.vx||0)*flight,tz=shootTarget.z+(shootTarget.vz||0)*flight;
  const ad=Math.hypot(tx-u.x,tz-u.z);
  return {x:md>.15?mx/md:0,z:md>.15?mz/md:0,aim:angle(tx-u.x,tz-u.z),fire:distance<(m.version==='0.3'&&u.shell==='direct'?m.cfg.directRange+u.r+shootTarget.r:6.5),range:clamp(ad,2,8)};
 }
 // Opposite teams use the two shoulders of each wide lane, avoiding a permanent pile-up.
 const goalX=dir*6.4,goalZ=u.lane;
 const gx=goalX-u.x,gz=goalZ-u.z,gd=Math.hypot(gx,gz);
 return {x:gd>.15?gx/gd:0,z:gd>.15?gz/gd:0,aim,fire:d<5,range:clamp(d,2,8)};
}
export function trajectory(m,u){
 const dx=Math.sin(u.turret),dz=Math.cos(u.turret),offset=u.r+.08;
 const ox=u.x+dx*offset,oz=u.z+dz*offset;
 const time=u.high?m.cfg.highFlight:m.cfg.lowFlight;
 const vx=dx*(u.range-offset)/time+u.vx*m.cfg.inheritVelocity,vz=dz*(u.range-offset)/time+u.vz*m.cfg.inheritVelocity;
 // Powered rockets keep a chosen altitude profile while horizontal thrust ramps up.
 const launchY=.55,gravity=m.cfg.gravity*((u.high?1.8:.55)/time)**2;
 const vy=(gravity*time*time/2-launchY)/time;
 return {ox,oz,vx,vz,vy,gravity,launchY,x:ox+vx*time,z:oz+vz*time,time,high:u.high,heightAt:t=>launchY+vy*t-gravity*t*t/2};
}
// One authoritative path for simulation, rocket orientation and trajectory preview.
export function projectilePose(s,age=s.age){
 const f=clamp(age/s.flight,0,1),travel=s.flight*(.6*f+.4*f*f),thrust=.6+.8*f;
 return {x:s.ox+s.vx*travel,z:s.oz+s.vz*travel,y:s.launchY+s.vy*age-s.gravity*age*age/2,vx:s.vx*thrust,vz:s.vz*thrust,vy:s.vy-s.gravity*age};
}
function explode(m,s){
 m.events.push({type:'impact',x:s.x,z:s.z,y:s.y,r:s.splash});
 for(const u of [...m.units.filter(u=>u.team!==s.team),...(m.outposts||[]).filter(t=>t.team!==s.team),m.bases[1-s.team]]){
  const dx=u.x-s.x,dz=u.z-s.z,d=Math.hypot(dx,dz);
  if(u.hp>0&&d<u.r+s.splash&&s.y<u.h+.25){
   if(u.kind&&u.kind!=='tower'){const strength=m.cfg.hitImpulse*Math.max(.25,1-d/(u.r+s.splash)),nx=d>.001?dx/d:Math.sin(s.turret||0),nz=d>.001?dz/d:1;u.vx+=nx*strength;u.vz+=nz*strength;}
   damage(m,u,s.damage,s);
  }
 }
 for(const w of m.walls)if(w.hp>0&&Math.hypot(Math.max(0,Math.abs(s.x-w.x)-w.w/2),Math.max(0,Math.abs(s.z-w.z)-w.d/2))<s.splash&&s.y<w.h+.25)damageWall(m,w,s.damage);
}
export function step(m,dt,inputs={}){
 if(m.status!=='playing')return;
 if(!Number.isFinite(dt)||dt<=0||dt>1/30+.000001)throw new Error('Use fixed steps <= 1/30');
 m.events=[];m.time+=dt;
 if(['supply','combined'].includes(m.experiment)){
  m.pickups=m.pickups.filter(p=>{if(m.time+1e-9<p.expiresAt)return true;m.events.push({type:'supply_expire',id:p.id,pointId:p.pointId,resourceType:p.type,time:p.expiresAt,x:p.x,z:p.z});return false;});
  if(m.time+1e-9>=m.supply.nextSpawn){const time=m.supply.nextSpawn;for(const point of SUPPLY.points){const p={...point,id:`supply-${point.id}-${m.supply.cycle}`,pointId:point.id,spawnedAt:time,expiresAt:time+SUPPLY.lifetime};m.pickups.push(p);m.events.push({type:'supply_spawn',id:p.id,pointId:p.pointId,resourceType:p.type,time,x:p.x,z:p.z,expiresAt:p.expiresAt});}m.supply.cycle++;m.supply.nextSpawn=SUPPLY.first+m.supply.cycle*SUPPLY.interval;}
 }
 const armorPositions=['armor','combined'].includes(m.experiment)?new Map(m.units.filter(u=>u.armor&&u.hp>0).map(u=>[u.id,{x:u.x,z:u.z}])):null;
 if(['orders','combined'].includes(m.experiment))for(const team of [0,1]){const order=inputs[team]?.order;if((!m.bot||team===0)&&['split','up','down'].includes(order)&&order!==m.teamOrders[team]){m.teamOrders[team]=order;m.events.push({type:'order',team,order});}}
 for(const u of m.units){
  if(u.hp<=0){
   u.respawn-=dt;
   if(u.respawn<=0&&!blocked(m,u,u.sx,u.sz)&&!m.units.some(o=>o!==u&&o.hp>0&&Math.hypot(o.x-u.sx,o.z-u.sz)<o.r+u.r)){
    u.x=u.sx;u.z=u.sz;u.hp=u.maxHP;u.ammo={rocket:0,rapid:0};u.shell='arc';u.cooldown=.3;u.shield=.8;u.vx=u.vz=0;u.patrol=null;u.route=null;u.stuck=0;u.bestDistance=undefined;u.detours=0;if(m.experiment!=='legacy'){u.stage=0;u.assignedLane=null;}if(u.armor)u.armor={charges:ARMOR.maxCharges,lastHit:m.time,moved:0};if(m.outposts){u.siegeId=null;u.siegeGun=false;}m.events.push({type:'respawn',id:u.id,x:u.x,z:u.z,...(m.experiment!=='legacy'?{team:u.team,kind:u.kind}: {})});
   }
   continue;
  }
  u.shield=Math.max(0,u.shield-dt);u.cooldown=Math.max(0,u.cooldown-dt);
  const c=u.kind==='minion'||(m.bot&&u.team===1)?ai(m,u):inputs[u.team]||{};
  let dx=clamp(c.x||0,-1,1),dz=clamp(c.z||0,-1,1),length=Math.hypot(dx,dz);if(length>1){dx/=length;dz/=length;}
  const speed=u.kind==='tank'?m.cfg.speed:m.cfg.minionSpeed;
  if(m.version==='0.1'){u.vx=dx*speed;u.vz=dz*speed;}
  else{
   const drag=Math.exp(-m.cfg.drag*dt);u.vx=u.vx*drag+dx*m.cfg.acceleration*dt;u.vz=u.vz*drag+dz*m.cfg.acceleration*dt;
   const v=Math.hypot(u.vx,u.vz),max=length>.01?speed:5;
   if(v>max){u.vx*=max/v;u.vz*=max/v;}
  }
  if(length>.01){const desired=angle(dx,dz);if(['armor','combined'].includes(m.experiment)&&u.kind==='tank'){const delta=Math.atan2(Math.sin(desired-u.yaw),Math.cos(desired-u.yaw));u.yaw+=clamp(delta,-ARMOR.turnSpeed*dt,ARMOR.turnSpeed*dt);}else u.yaw=desired;}
  if(m.version==='0.1')u.turret=Number.isFinite(c.aim)?c.aim:u.yaw;
  else if(Number.isFinite(c.aim))u.turret=c.aim;else u.turret+=(c.turn||0)*2.5*dt;
  if(c.range)u.range=clamp(c.range,2,8);else u.range=clamp(u.range+(c.rangeDelta||0)*3*dt,2,8);
  const beforeX=u.x,beforeZ=u.z;move(m,u,u.vx*dt,u.vz*dt);
  const navPoint=u.patrol?.point||u.route?.point;
  if((length>.1||(navPoint&&Math.hypot(u.x-navPoint.x,u.z-navPoint.z)>.2))&&Math.hypot(u.x-beforeX,u.z-beforeZ)<dt*.15)u.stuck+=dt;else u.stuck=Math.max(0,u.stuck-dt);
  collect(m,u);if(c.fire)fire(m,u);
 }
 collideUnits(m);
 if(m.outposts)for(const t of m.outposts)stepTower(m,t,dt);
 m.shots=m.shots.filter(s=>{
  s.life-=dt;
  const n=Math.max(1,Math.ceil(Math.hypot(s.vx,s.vz)*(s.ballistic?1.4:1)*dt/.08),Math.ceil(dt*120));
  for(let i=0;i<n;i++){
   if(s.ballistic){s.age=Math.min(s.flight,s.age+dt/n);const p=projectilePose(s);s.x=p.x;s.z=p.z;s.y=p.y;}
   else{const speed=Math.hypot(s.vx,s.vz),travel=Math.min(speed*dt/n,s.remainingRange);s.x+=s.vx/speed*travel;s.z+=s.vz/speed*travel;s.remainingRange-=travel;}
   if(s.life<=0||Math.abs(s.x)>m.cfg.width/2||Math.abs(s.z)>m.cfg.height/2)return false;
   const wall=m.walls.find(w=>w.hp>0&&s.y<=w.h+.07&&Math.abs(s.x-w.x)<=w.w/2+.07&&Math.abs(s.z-w.z)<=w.d/2+.07);
   if(wall){if(s.ballistic||s.weapon==='rocket')explode(m,s);else{damageWall(m,wall,s.damage);m.events.push({type:'impact',x:s.x,z:s.z});}return false;}
   const target=[...m.units.filter(u=>u.team!==s.team&&u.hp>0),...(s.ownerKind==='tower'?[]:(m.outposts||[]).filter(t=>t.team!==s.team)),...(s.ownerKind==='tower'?[]:[m.bases[1-s.team]])].find(u=>u.hp>0&&s.y<=u.h+.07&&Math.hypot(u.x-s.x,u.z-s.z)<u.r+.07);
   if(target){
    if(s.ballistic||s.weapon==='rocket'){explode(m,s);return false;}
    if(m.version!=='0.1'&&target.kind&&target.kind!=='tower'){const speed=Math.hypot(s.vx,s.vz);target.vx+=s.vx/speed*m.cfg.hitImpulse;target.vz+=s.vz/speed*m.cfg.hitImpulse;}
    damage(m,target,s.damage,s);return false;
   }
   if(!s.ballistic&&s.remainingRange<=1e-9)return false;
   if(s.ballistic&&s.age>=s.flight-1e-9){s.y=0;explode(m,s);return false;}
  }
  return true;
 });
 if(armorPositions)for(const u of m.units){const previous=armorPositions.get(u.id);if(!previous||u.hp<=0||u.armor.lastHit>=m.time)continue;u.armor.moved+=Math.hypot(u.x-previous.x,u.z-previous.z);
  if(u.armor.charges<ARMOR.maxCharges&&m.time-u.armor.lastHit>=ARMOR.rechargeSeconds-1e-9&&u.armor.moved>=ARMOR.rechargeDistance-1e-9){u.armor.charges=ARMOR.maxCharges;m.events.push({type:'shield_recharge',id:u.id,team:u.team,charges:ARMOR.maxCharges,x:u.x,z:u.z});}
 }
 if(m.bases.some(b=>b.hp===0)){m.status='finished';const alive=m.bases.filter(b=>b.hp>0);m.winner=alive.length===1?alive[0].team:null;m.events.push({type:'victory',team:m.winner});}
}

function studyAI(m,u){
 const dir=u.team===0?1:-1,base=m.bases[1-u.team];let target=base,motion;
 if(u.kind==='minion'){
  u.shell='direct';u.intent='route';
  let points=routePoints(u.team,u.assignedLane||'up',m.map);if(!u.assignedLane)points[0]={...points[0],z:u.sz};
  if(!u.assignedLane&&Math.hypot(u.x-points[0].x,u.z-points[0].z)<.3){
   const order=m.teamOrders[u.team];u.assignedLane=order==='split'?(m.splitNext[u.team]++%2===0?'up':'down'):order;u.lane=u.assignedLane;u.stage=1;m.events.push({type:'line',team:u.team,id:u.id,lane:u.assignedLane});points=routePoints(u.team,u.assignedLane,m.map);
  }
  const point=points[u.stage];if(u.stage<points.length-1&&Math.hypot(u.x-point.x,u.z-point.z)<.25)u.stage++;
  const goal=points[u.stage];motion=clearSegment(m,u,u,goal)?steering(u,goal):route(m,u,goal);
  const close=m.units.filter(o=>o.team!==u.team&&o.hp>0&&Math.abs(o.z-u.z)<1.5&&Math.hypot(o.x-u.x,o.z-u.z)<2.5&&lineOfFire(m,u,o)).sort((a,b)=>Math.hypot(a.x-u.x,a.z-u.z)-Math.hypot(b.x-u.x,b.z-u.z))[0];
  if(Math.hypot(base.x-u.x,base.z-u.z)>3&&close)target=close;
 }else{
  const threats=m.units.filter(o=>o.team!==u.team&&o.hp>0&&o.x*dir<STUDY.threatX).sort((a,b)=>Math.hypot(a.x-m.bases[u.team].x,a.z)-Math.hypot(b.x-m.bases[u.team].x,b.z));
  target=threats[0]||base;u.intent=threats.length?'defend':'attack';u.shell=threats.length?'direct':'arc';
  const lane=target===base?-3:target.z,goal=target===base?{x:dir*6.4,z:lane}:{x:target.x-dir*1.8,z:lane};motion=clearSegment(m,u,u,goal)?steering(u,goal):route(m,u,goal);
 }
 const d=Math.hypot(target.x-u.x,target.z-u.z),clear=lineOfFire(m,u,target);if(clear&&d<(target===base?(u.kind==='tank'?5:3):2.3))motion={x:0,z:0};
 return {...motion,aim:angle(target.x-u.x,target.z-u.z),range:clamp(d,2,8),fire:clear&&d<(u.shell==='arc'?6.5:m.cfg.directRange+u.r+target.r)};
}

function towerEligible(m,t,u){return !!u&&u.hp>0&&u.team!==t.team&&Math.hypot(u.x-t.x,u.z-t.z)<=DEFENSE.range+1e-9&&lineOfFire(m,t,u);}
function stepTower(m,t,dt){
 if(t.hp<=0)return;t.cooldown=Math.max(0,t.cooldown-dt);
 let target=m.units.find(u=>u.id===t.aggro);
 if(m.time>=t.aggroUntil||!towerEligible(m,t,target)){t.aggro=null;t.aggroUntil=0;target=null;}
 if(!target)target=m.units.filter(u=>towerEligible(m,t,u)).sort((a,b)=>Math.hypot(a.x-t.x,a.z-t.z)-Math.hypot(b.x-t.x,b.z-t.z)||a.id.localeCompare(b.id))[0];
 t.target=target?.id||null;if(!target)return;
 const dx=target.x-t.x,dz=target.z-t.z,d=Math.hypot(dx,dz);t.turret=angle(dx,dz);if(t.cooldown>0)return;
 const shot={id:m.nextShot++,owner:t.id,ownerKind:'tower',team:t.team,x:t.x+dx/d*(t.r+.08),z:t.z+dz/d*(t.r+.08),y:.35,vx:dx/d*8,vz:dz/d*8,life:2.5,ballistic:false,weapon:'direct',damage:DEFENSE.damage,remainingRange:DEFENSE.range};m.shots.push(shot);t.cooldown=DEFENSE.cooldown;m.events.push({type:'towerFire',id:t.id,team:t.team,kind:'tower',target:target.id,targetType:target.kind,shotId:shot.id,x:shot.x,z:shot.z,weapon:shot.weapon,rawDamage:shot.damage});
}
function defenseAI(m,u){
 const dir=teamDirection(u.team),base=m.bases[1-u.team],enemy=m.outposts.filter(t=>t.team!==u.team&&t.hp>0);let target=base,motion;
 if(u.kind==='minion'){
  // Preserve branch assignment, then stop on the route to siege its own lane's fort.
  const original=studyAI(m,u),tower=enemy.find(t=>t.lane===(u.assignedLane||'up'));if(!tower)return original;
  target=tower;u.intent='siege';motion={x:original.x,z:original.z};u.shell='direct';
  const close=m.units.filter(o=>o.team!==u.team&&o.hp>0&&Math.hypot(o.x-u.x,o.z-u.z)<2.5&&lineOfFire(m,u,o)).sort((a,b)=>Math.hypot(a.x-u.x,a.z-u.z)-Math.hypot(b.x-u.x,b.z-u.z)||a.id.localeCompare(b.id))[0];if(close&&Math.hypot(tower.x-u.x,tower.z-u.z)>3.9){target=close;u.intent='engage';}
 }else{
  const own=m.bases[u.team],forts=m.outposts.filter(t=>t.team===u.team&&t.hp>0),threat=m.units.filter(o=>o.team!==u.team&&o.hp>0&&lineOfFire(m,u,o)&&(Math.hypot(o.x-own.x,o.z-own.z)<4.8||(own.lastAttacker===o.id&&m.time-own.lastHit<4)||forts.some(t=>Math.hypot(o.x-t.x,o.z-t.z)<3.4||(t.lastAttacker===o.id&&m.time-t.lastHit<4)))).sort((a,b)=>Math.hypot(a.x-own.x,a.z-own.z)-Math.hypot(b.x-own.x,b.z-own.z))[0];
  if(threat){target=threat;u.intent='defend';u.shell='direct';}
  else{
   const wave=m.units.filter(o=>o.team===u.team&&o.kind==='minion'&&o.hp>0).sort((a,b)=>b.x*dir-a.x*dir)[0];
   target=(base.protected?enemy.find(t=>t.lane===wave?.assignedLane)||enemy[0]:null)||base;u.intent='attack';if(u.siegeId!==target.id){u.siegeId=target.id;u.siegeGun=false;}if(target.kind==='tower'&&wave&&Math.hypot(wave.x-target.x,wave.z-target.z)<DEFENSE.range&&Math.hypot(u.x-target.x,u.z-target.z)<3.9)u.siegeGun=true;u.shell=u.siegeGun?'direct':'arc';
  }
  const goal={x:target.x-dir*(target.kind==='tower'?2.8:target===base?3.2:1.8),z:target.z};motion=clearSegment(m,u,u,goal)?steering(u,goal):route(m,u,goal);
 }
 u.target=target.id||`base-${target.team}`;
 const d=Math.hypot(target.x-u.x,target.z-u.z),clear=lineOfFire(m,u,target);if(clear&&d<(u.kind==='minion'?2.8:target.kind==='tower'?2.8:u.shell==='arc'?4:2.3))motion={x:0,z:0};
 return {...motion,aim:angle(target.x-u.x,target.z-u.z),range:clamp(d,2,8),fire:!target.protected&&clear&&d<(u.shell==='arc'?6.5:m.cfg.directRange+u.r+target.r)};
}
