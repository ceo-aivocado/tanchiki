export const BUILD_ID='20261007-t034-3';
export const PROFILES=Object.freeze({legacy:{label:'Исходная 0.3',rulesetId:'R0',parentId:null},control:{label:'L0 — Общая основа',rulesetId:'T034-L0.1',parentId:'R0'},orders:{label:'B — Приказ миньонам',rulesetId:'T034-B.1',parentId:'T034-L0.1'}});
export const STUDY=Object.freeze({mapId:'study-lanes-v1',forkX:6.4,laneZ:3,shoulder:.28,threatX:0,warning:.7});
export function studyWalls(){return [-1,1].flatMap(sign=>[{id:`study-cover-${sign}`,x:sign*3,z:0,w:1.4,d:3.2,h:.65,hp:6},{id:`study-pocket-${sign}`,x:sign*1,z:sign*4.8,w:1.3,d:.6,h:.65,hp:3}]);}
export function parseSeed(value){if(value===null||value===undefined||value==='')return 20261006;if(!/^\d+$/.test(String(value))||Number(value)>4294967295)throw Error('Seed должен быть целым числом от 0 до 4294967295.');return Number(value);}
export function routePoints(team,lane){const dir=team===0?1:-1,z=lane==='up'?-STUDY.laneZ:STUDY.laneZ;return [{x:-dir*STUDY.forkX,z:0},{x:-dir*STUDY.forkX,z:z-dir*STUDY.shoulder},{x:dir*STUDY.forkX,z:z-dir*STUDY.shoulder},{x:dir*7.1,z:0}];}
export function warningFor(shot){return shot.ballistic&&shot.flight-shot.age<=STUDY.warning?{shotId:shot.id,x:shot.tx,z:shot.tz,r:shot.splash,team:shot.team}:null;}
