export const BUILD_ID='20261008-t040-1';
export const PROFILES=Object.freeze({combined:{label:'ABC — Все механики',rulesetId:'T040-ABC.1',parentId:'T034-L0.1'},legacy:{label:'Исходная 0.3',rulesetId:'R0',parentId:null},control:{label:'L0 — Общая основа',rulesetId:'T034-L0.1',parentId:'R0'},supply:{label:'C — Ресурсы на поле',rulesetId:'T036-C.1',parentId:'T034-L0.1'},armor:{label:'A — Фронтальная броня',rulesetId:'T035-A.1',parentId:'T034-L0.1'},orders:{label:'B — Приказ миньонам',rulesetId:'T034-B.1',parentId:'T034-L0.1'}});
export const STUDY=Object.freeze({mapId:'study-lanes-v1',forkX:6.4,laneZ:3,shoulder:.28,threatX:0,warning:.7});
export function studyWalls(){return [-1,1].flatMap(sign=>[{id:`study-cover-${sign}`,x:sign*3,z:0,w:1.4,d:3.2,h:.65,hp:6},{id:`study-pocket-${sign}`,x:sign*1,z:sign*4.8,w:1.3,d:.6,h:.65,hp:3}]);}
export function parseSeed(value){if(value===null||value===undefined||value==='')return 20261006;if(!/^\d+$/.test(String(value))||Number(value)>4294967295)throw Error('Seed должен быть целым числом от 0 до 4294967295.');return Number(value);}
export function routePoints(team,lane,map=STUDY.mapId){if(map==='abc-forts-v1'||map==='abc-crossroads-v1'){const dir=team===0?1:-1,side=lane==='up'?-1:1,coords=map==='abc-forts-v1'?[[-6.4,0],[-6.4,3.8],[-2.4,3.8],[-2.4,2.5],[2.4,2.5],[2.4,3.8],[6.4,3.8],[7.1,0]]:[[-6.4,0],[-6.4,1.2],[-2.6,1.2],[-2.6,3],[2.6,3],[2.6,1.2],[6.4,1.2],[7.1,0]];return coords.map(([x,z])=>({x:x*dir,z:z===0?0:side*z-dir*STUDY.shoulder}));}const dir=team===0?1:-1,z=lane==='up'?-STUDY.laneZ:STUDY.laneZ;return [{x:-dir*STUDY.forkX,z:0},{x:-dir*STUDY.forkX,z:z-dir*STUDY.shoulder},{x:dir*STUDY.forkX,z:z-dir*STUDY.shoulder},{x:dir*7.1,z:0}];}
export function warningFor(shot){return shot.ballistic&&shot.flight-shot.age<=STUDY.warning?{shotId:shot.id,x:shot.tx,z:shot.tz,r:shot.splash,team:shot.team}:null;}

export const ARMOR=Object.freeze({maxCharges:2,halfAngle:Math.PI/3,rechargeSeconds:3,rechargeDistance:2,turnSpeed:Math.PI});

export const SUPPLY=Object.freeze({first:20,interval:45,lifetime:20,warning:10,repair:2,rockets:3,ammoCap:6,points:Object.freeze([Object.freeze({id:'repair',type:'repair',x:0,z:-3}),Object.freeze({id:'rocket',type:'rocket',x:0,z:3})])});
export function supplyForecast(m){if(!['supply','combined'].includes(m.experiment))return [];return SUPPLY.points.map(p=>{const active=m.pickups.find(v=>v.pointId===p.id);return {...p,active:!!active,seconds:Math.max(0,(active?active.expiresAt:m.supply.nextSpawn)-m.time),warning:!active&&m.supply.nextSpawn-m.time<=SUPPLY.warning+1e-9};});}

export const MAPS=Object.freeze({'study-lanes-v1':Object.freeze({label:'Два пути',revision:1}),'abc-forts-v1':Object.freeze({label:'Крепости',revision:1}),'abc-crossroads-v1':Object.freeze({label:'Перекрёсток',revision:1})});
export function abcMapId(id){return MAPS[id]?id:STUDY.mapId;}
export function mapWalls(id){if(id===STUDY.mapId)return studyWalls();const walls=[],put=(x,z,w,d)=>walls.push({id:`${id}-${walls.length}`,x,z,w,d,h:.65,hp:6});if(id==='abc-forts-v1'){for(const sign of [-1,1]){put(sign*4,0,.8,3.8);for(const z of [-1.5,1.5])put(sign*5,z,1.6,.6);put(sign*1.2,0,1,2.2);for(const z of [-4.9,4.9])put(sign*5.5,z,.8,.6);}}else if(id==='abc-crossroads-v1'){for(const x of [-4.2,4.2])for(const z of [-3,3])put(x,z,1.8,1);for(const x of [-2.1,2.1])put(x,0,1,.8);}return walls;}
export function mapRoad(x,z,map){for(const lane of ['up','down'])for(const team of [0,1]){const points=routePoints(team,lane,map);for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz)));if(Math.hypot(x-a.x-t*dx,z-a.z-t*dz)<.75)return true;}}return map==='abc-crossroads-v1'&&Math.abs(x)<1;}

export const DEFENSE=Object.freeze({hp:12,range:3.6,damage:1,cooldown:.75,retaliation:2,radius:.45});
export function outpostPositions(map){const z=map==='abc-forts-v1'?3.8:map==='abc-crossroads-v1'?1.2:3;return [0,1].flatMap(team=>['up','down'].map(lane=>({id:`outpost-${team}-${lane}`,kind:'tower',team,lane,x:team===0?-5.6:5.6,z:lane==='up'?-z:z,r:DEFENSE.radius,h:.95})));}
export const combinedMapRevision=2;
