import * as THREE from 'three';
import { makeBasket } from './Basket.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createBin, createParkSign } from './ParkAssets.js';
import { createBench } from './EnvironmentAssets.js';
import { createAgave, createCairn, createDesertPicnicTable, createFenceBay, createGrassTuft, createJuniper, createMesa, createOrientationBoard, createPricklyPear, createRabbitbrush, createSagebrush, createThunderbirdMarker, createTrailBench, createTrailMarker, createTrailheadShelter, createWaterRefill, createYucca } from './ThunderbirdAssets.js';
import { addThunderbirdScenery, bakeThunderbird, buildSkirt, makeGroundColor } from './ThunderbirdScenery.js';

export const THUNDERBIRD_BOUNDS={minX:-210,maxX:210,minZ:-215,maxZ:215};
const peaks=[[-175,-155,38,31],[-157,-126,24,18],[-145,-90,18,65],[25,-145,24,72],[145,-65,30,62],[120,95,38,70],[-10,145,34,68],[-145,95,25,58],[5,15,-13,58]];
export function thunderbirdHeight(x,z){let y=7+.018*z;for(const [px,pz,h,r]of peaks)y+=h*Math.exp(-((x-px)**2+(z-pz)**2)/(r*r));return y+2.2*Math.sin(x*.025)*Math.cos(z*.021);}
function normalAt(x,z){const e=.5,h=thunderbirdHeight(x,z);return new THREE.Vector3(thunderbirdHeight(x-e,z)-thunderbirdHeight(x+e,z),2*e,thunderbirdHeight(x,z-e)-thunderbirdHeight(x,z+e)).normalize();}
const raw=[
[1,'Trailhead Drop',3,[[-175,-155],[-145,-125],[-120,-105]],'Downhill ace run to an exposed shelf.'],
[2,'Juniper Rise',3,[[-108,-94],[-88,-60],[-72,-30]],'Technical uphill line through sparse juniper.'],
[3,'Red Ledge',3,[[-62,-20],[-25,-8],[4,-18]],'Shape into a rocky green with guarded misses.'],
[4,'Sidewinder',3,[[14,-26],[52,-5],[82,8]],'Control the cross-slope landing angle.'],
[5,'Split Rock',3,[[93,18],[126,35],[145,61]],'Thread the narrow sandstone gate.'],
[6,'Copper Wash',3,[[137,75],[95,88],[55,75]],'Moderate carry across the desert wash.'],
[7,'Shelf Life',3,[[43,67],[15,88],[-18,98]],'Basket near a drop-off rewards distance control.'],
[8,'Cedar Bend',3,[[-30,104],[-67,89],[-92,65]],'A controlled turnover follows the hillside.'],
[9,'Sunset Saddle',3,[[-104,53],[-135,25],[-152,-8]],'Cross the saddle for a scenic front-nine finish.'],
[10,'Raven Climb',3,[[-160,5],[-158,55],[-145,105]],'The rugged loop begins with a steep uphill approach.'],
[11,'Mesa Launch',3,[[-125,115],[-68,140],[-20,132]],'Commit to a ridge-to-ridge flight.'],
[12,'Hidden Shelf',3,[[-7,143],[30,153],[65,120]],'The pin hides behind a layered rock shoulder.'],
[13,'Thunder Gulch',4,[[80,112],[145,105],[180,30]],'Place safely before attacking across the deep gully.'],
[14,'Rollaway',3,[[185,15],[175,-35],[145,-75]],'A fast sloping green punishes excess power.'],
[15,'High Traverse',4,[[125,-88],[65,-113],[-12,-123]],'Two placement shots traverse exposed high desert.'],
[16,'Stone Stair',3,[[-25,-114],[-95,-150],[-150,-160]],'Climb through staggered sandstone walls.'],
[17,'Rim Choice',3,[[-165,-185],[-195,-155],[-195,-110]],'Safe contour or aggressive sweeping line along the rim.'],
[18,'Thunderbird Flight',4,[[-190,-125],[-195,-170],[-95,-195]],'Signature launch: a long downhill flight across the valley to the trailhead shelf.']];
function previewFor(route) {
 const points = route.slice(0, -1).map(([x,z], i) => [x, thunderbirdHeight(x,z) + 12 + (i === 1 ? 2 : 0), z]);
 const a = route.at(-2), b = route.at(-1), basketY = thunderbirdHeight(b[0], b[1]);
 for (const [t, clearance, pinClearance] of [[.55, 8, 6], [.78, 5.5, 4]]) {
   const x = THREE.MathUtils.lerp(a[0], b[0], t), z = THREE.MathUtils.lerp(a[1], b[1], t);
   points.push([x, Math.max(thunderbirdHeight(x,z) + clearance, basketY + pinClearance), z]);
 }
 return points;
}
export const THUNDERBIRD_HOLES=raw.map(([id,name,par,route,note])=>({id,name,par,route,width:id>9?10:12,lengthFeet:Math.round(route.slice(1).reduce((s,b,i)=>s+Math.hypot(b[0]-route[i][0],b[1]-route[i][1]),0)*3.05),note,previewPath:previewFor(route)}));
function segmentDistance(x,z,a,b){const dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1)));return Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz)}
export function thunderbirdSurfaceHeight(x,z){
 const terrain=thunderbirdHeight(x,z);
 const onFairway=THUNDERBIRD_HOLES.some(h=>h.route.slice(1).some((b,i)=>segmentDistance(x,z,h.route[i],b)<=h.width*.5));
 let surface=terrain+(onFairway ? .08 : 0);
 // Basket shelves are broad, shallow sandstone ellipsoids. Their upper surface
 // participates in ground contact so a disc can settle instead of passing through.
 for(const h of THUNDERBIRD_HOLES){const [bx,bz]=h.route.at(-1),dx=(x-bx)/7,dz=(z-bz)/6,q=1-dx*dx-dz*dz;if(q>0){const center=thunderbirdHeight(bx,bz)-1.25;surface=Math.max(surface,center+1.35*Math.sqrt(q))}}
 return surface;
}
const mat=c=>new THREE.MeshStandardMaterial({color:c,roughness:1,flatShading:true});
const redRock=mat(0x873e2c), darkRock=mat(0x6f3328);
const rockGeo=new THREE.IcosahedronGeometry(1,1);
const PLANE={hx:215,hz:220};
const rockMesh=(material,position,scale,rotationY=0)=>{const m=new THREE.Mesh(rockGeo,material);m.position.set(...position);m.scale.set(...scale);m.rotation.y=rotationY;return m};
// Rocks, junipers and plants are collected as prefab groups and baked into a
// handful of instanced batches afterwards (see bakeThunderbird).
function addRedRock(bag,colliders,x,z,size=[2.5,1.8,2.2],layered=false){const y=thunderbirdHeight(x,z),g=new THREE.Group();g.name='Red rock outcrop';if(layered){for(let i=0;i<3;i++)g.add(rockMesh(i%2?darkRock:redRock,[x,y+i*size[1]*.55,z],[size[0]*(1-i*.12),size[1]*.38,size[2]*(1-i*.1)]))}else g.add(rockMesh(redRock,[x,y+size[1]*.65,z],size));bag.push(g);colliders.push({kind:'rock',center:new THREE.Vector3(x,y+size[1]*.65,z),radii:new THREE.Vector3(...size)})}
function addDesertPlant(bag,type,x,z,s=1,seed=1){
 const make={sage:createSagebrush,rabbitbrush:createRabbitbrush,cactus:createPricklyPear,grass:seed=>createGrassTuft(seed,seed%3)}[type];
 const asset=make(seed);asset.position.set(x,thunderbirdHeight(x,z)-.04,z);asset.rotation.y=seed*1.7;asset.scale.setScalar(s*(type==='grass'?1.1:1));bag.push(asset);return asset;
}
function addJuniper(bag,x,z,s=1,seed=1){const asset=createJuniper(seed);asset.position.set(x,thunderbirdHeight(x,z)-.04,z);asset.rotation.y=seed*2.3;asset.scale.setScalar(s);bag.push(asset);return asset}
function clearOfPlay(x,z,radius=2){return THUNDERBIRD_HOLES.every(h=>Math.hypot(x-h.route[0][0],z-h.route[0][1])>radius+7&&Math.hypot(x-h.route.at(-1)[0],z-h.route.at(-1)[1])>radius+8&&h.route.slice(1).every((b,i)=>segmentDistance(x,z,h.route[i],b)>h.width*.5+radius+2))}
function withinThunderbirdBounds(x,z,radius){return x-radius>=THUNDERBIRD_BOUNDS.minX&&x+radius<=THUNDERBIRD_BOUNDS.maxX&&z-radius>=THUNDERBIRD_BOUNDS.minZ&&z+radius<=THUNDERBIRD_BOUNDS.maxZ}
function placeDesertProp(bag,asset,x,z,rotation=0,scale=1){asset.position.set(x,thunderbirdHeight(x,z),z);asset.rotation.y=rotation;asset.scale.setScalar(scale);bag.push(asset);return asset}
function addDesertProps(bag,existingPlacements){
 const placements=[],occupied=existingPlacements.map(p=>({x:p.x,z:p.z,radius:1.2}));
 const add=(zone,type,asset,x,z,rotation=0,scale=1,radius=1.2)=>{
  if(!withinThunderbirdBounds(x,z,radius)||!clearOfPlay(x,z,radius)||occupied.some(p=>Math.hypot(x-p.x,z-p.z)<radius+p.radius))return;
  placeDesertProp(bag,asset,x,z,rotation,scale);occupied.push({x,z,radius});placements.push({zone,type,name:asset.name,x,z,radius});
 };
 add('Trailhead Commons','shelter',createTrailheadShelter(),-198,-195,.08,1,5.2);
 add('Trailhead Commons','picnic-table',createDesertPicnicTable(),-188,-188,-.45,1,2.3);
 add('Trailhead Commons','bench',createTrailBench(),-203,-187,1.5,1,1.5);
 add('Trailhead Commons','water-refill',createWaterRefill(),-207,-205,0,1,1.1);
 add('Trailhead Commons','orientation-board',createOrientationBoard(),-191,-202,0,1,1.8);
 add('Trailhead Commons','thunderbird-marker',createThunderbirdMarker(),-204,-204,0,.9,.8);
 add('Trailhead Commons','yucca',createYucca(),-205,-192,0,.8,.8);
 add('Copper Wash','bench',createTrailBench(),131,94,-.4,1,1.5);
 add('Copper Wash','water-refill',createWaterRefill(),126,96,.15,1,1.1);
 add('Copper Wash','trail-marker',createTrailMarker(),126,88,0,.9,.9);
 add('Cedar Bend','bench',createTrailBench(),-55,111,-.55,1,1.5);
 add('Cedar Bend','orientation-board',createOrientationBoard(),-61,116,.2,1,1.8);
 add('Cedar Bend','agave',createAgave(),-45,115,0,.9,.9);
 add('Sunset Saddle','bench',createTrailBench(),-130,51,-.8,1,1.5);
 add('Sunset Saddle','bin',createBin(),-136,57,0,1,.8);
 add('Sunset Saddle','cairn',createCairn(),-138,44,0,1,1.1);
 add('Mesa Launch','bench',createTrailBench(),-103,141,-.35,1,1.5);
 add('Mesa Launch','trail-marker',createTrailMarker(),-88,147,0,.9,.9);
 add('Mesa Launch','cairn',createCairn(),-110,148,0,1,1.1);
 add('Thunder Gulch','bench',createTrailBench(),98,125,-.5,1,1.5);
 add('Thunder Gulch','orientation-board',createOrientationBoard(),104,132,.15,1,1.8);
 add('High Traverse','bench',createTrailBench(),116,-108,.55,1,1.5);
 add('High Traverse','yucca',createYucca(),121,-115,0,.8,.8);
 add('Rim Choice','bench',createTrailBench(),-183,-188,-.45,1,1.5);
 add('Rim Choice','cairn',createCairn(),-177,-194,0,1,1.1);
 add('Eastern Overlook','bench',createTrailBench(),190,95,-.5,1,1.5);
 add('Eastern Overlook','trail-marker',createTrailMarker(),183,88,0,.9,.9);
 add('Eastern Overlook','cairn',createCairn(),196,104,0,1,1.1);
 return placements;
}
function addDesertDressing(bag){
 const zones=[
  {name:'Trailhead sage',type:'sage',points:[[-188,-143],[-184,-132],[-158,-151],[-145,-143]]},
  {name:'Copper wash rabbitbrush',type:'rabbitbrush',points:[[113,69],[103,63],[87,70],[73,64]]},
  {name:'Sunset saddle grass',type:'grass',points:[[-122,38],[-131,45],[-141,34],[-126,20]]},
  {name:'Mesa pinyon ridge',type:'juniper',points:[[-84,128],[-55,151],[-33,119],[8,132]]},
  {name:'Eastern shelf cactus',type:'cactus',points:[[164,83],[172,65],[159,48],[151,18]]},
  {name:'Southern gully grass',type:'grass',points:[[82,-102],[55,-126],[20,-133],[-55,-137]]},
  {name:'Rim sage',type:'sage',points:[[-125,-174],[-150,-184],[-184,-176],[-182,-142]]},
 ];
 const placements=[];let seed=1;for(const zone of zones)for(const [x,z]of zone.points)if(clearOfPlay(x,z,zone.type==='juniper'?2.4:1.2)){
  const radius=zone.type==='juniper'?2.4:1.2;
  if(zone.type==='juniper')addJuniper(bag,x,z,.75,seed++);else addDesertPlant(bag,zone.type,x,z,.9,seed++);
  placements.push({zone:zone.name,type:zone.type,x,z,radius});
  // Low plants occur in small natural colonies; trees remain solitary silhouettes.
  if(zone.type!=='juniper'&&clearOfPlay(x+2.4,z-1.8,.8)){addDesertPlant(bag,zone.type,x+2.4,z-1.8,.62,seed++);placements.push({zone:zone.name,type:zone.type,x:x+2.4,z:z-1.8,radius:.8})}
}
 // Minimal trail furniture: early rest stops and a short trailhead rail only.
 for(const [x,z,a]of [[-164.4,-158.5,.8],[14.5,-37.2,1.1],[-107,63.8,.5]])if(clearOfPlay(x,z,2)){const bench=createBench();bench.position.set(x,thunderbirdHeight(x,z),z);bench.rotation.y=a;bag.push(bench);placements.push({zone:'Trail rest',type:'bench',x,z,radius:2})}
 for(let i=0;i<4;i++){const x=-202+i*5,z=-145;if(!clearOfPlay(x,z,1))continue;const bay=createFenceBay(i<3?5:.05,i<3?thunderbirdHeight(x+5,z)-thunderbirdHeight(x,z):0,0);bay.position.set(x,thunderbirdHeight(x,z),z);bag.push(bay);placements.push({zone:'Trailhead rail',type:'fence',x,z,radius:1})}
  placements.push(...addDesertProps(bag,placements));
  return placements;
}
// Fairway ribbons share one material, so their geometry is merged into one draw call.
function ribbonGeometry(A,B,width){
 const dx=B[0]-A[0],dz=B[1]-A[1],length=Math.hypot(dx,dz),nx=-dz/length,nz=dx/length;
 const steps=Math.max(4,Math.ceil(length/4)),vertices=[],uvs=[],indices=[];
 for(let i=0;i<=steps;i++){const t=i/steps,cx=THREE.MathUtils.lerp(A[0],B[0],t),cz=THREE.MathUtils.lerp(A[1],B[1],t);for(const side of [-1,1]){const x=cx+nx*width*.5*side,z=cz+nz*width*.5*side;vertices.push(x,thunderbirdHeight(x,z)+.12,z);uvs.push(side<0?0:1,t)}}
 for(let i=0;i<steps;i++){const a=i*2,b=a+1,c=a+2,d=a+3;indices.push(a,b,c,b,d,c)}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeVertexNormals();
 return geometry;
}
export function buildThunderbirdCourse(scene){
 const colliders=[],baskets=[],holes=THUNDERBIRD_HOLES.map(d=>({...d,tee:new THREE.Vector3(d.route[0][0],thunderbirdSurfaceHeight(...d.route[0])+.08,d.route[0][1]),basket:new THREE.Vector3(d.route.at(-1)[0],thunderbirdSurfaceHeight(...d.route.at(-1)),d.route.at(-1)[1]),aimPoint:new THREE.Vector3(d.route[1][0],thunderbirdHeight(...d.route[1]),d.route[1][1])}));
 const colorAt=makeGroundColor(thunderbirdHeight);
 const g=new THREE.PlaneGeometry(PLANE.hx*2,PLANE.hz*2,140,140);g.rotateX(-Math.PI/2);const a=g.attributes.position,col=new Float32Array(a.count*3),c=new THREE.Color();for(let i=0;i<a.count;i++){const x=a.getX(i),z=a.getZ(i);a.setY(i,thunderbirdHeight(x,z));colorAt(x,z,c);col.set([c.r,c.g,c.b],i*3)}g.setAttribute('color',new THREE.BufferAttribute(col,3));g.computeVertexNormals();
 const ground=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:1,flatShading:true}));ground.name='Thunderbird ground';ground.receiveShadow=true;scene.add(ground);scene.add(buildSkirt(thunderbirdHeight,colorAt,PLANE));
 const dirt=new THREE.MeshStandardMaterial({color:0xc16b3f,roughness:1,flatShading:true,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4}),bag=[],rockBag=[],nearMesas=[],ribbons=[];
 // Low-poly mesas just inside the rim frame the playable bowl (distant buttes are added with the scenery).
 for(const [x,z,s,seed]of [[-185,185,1.2,1],[-80,205,.9,2],[55,202,1.1,3],[180,170,1.35,4]]){const mesa=createMesa(40+seed,24*s,19*s);mesa.position.set(x,thunderbirdHeight(x,z)-2,z);nearMesas.push(mesa)}
 const dressing=addDesertDressing(bag);
 for(const h of holes){for(let i=1;i<h.route.length;i++)ribbons.push(ribbonGeometry(h.route[i-1],h.route[i],h.width));
  const p=h.basket;const shelf=rockMesh(redRock,[p.x,p.y-1.35,p.z],[7,1.35,6],h.id*.73);const shelfGroup=new THREE.Group();shelfGroup.add(shelf);rockBag.push(shelfGroup);colliders.push({kind:'rock',role:'basket-shelf',center:shelf.position.clone(),radii:shelf.scale.clone()});baskets.push(makeBasket(scene,p));
  const A=h.route[0],B=h.route[1],ang=Math.atan2(B[0]-A[0],B[1]-A[1]);const sign=createParkSign(`${h.id}  ${h.name}`,`PAR ${h.par} / ${h.lengthFeet} FT`);sign.position.set(A[0]+Math.cos(ang)*5,thunderbirdHeight(A[0]+Math.cos(ang)*5,A[1]-Math.sin(ang)*5),A[1]-Math.sin(ang)*5);sign.rotation.y=ang+Math.PI;bag.push(sign);
  for(let k=0;k<(h.id>9?5:3);k++){const t=(k+1)/(h.id>9?6:4),x=THREE.MathUtils.lerp(A[0],B[0],t)+(k%2?1:-1)*(h.width+5),z=THREE.MathUtils.lerp(A[1],B[1],t)+(k%2?-1:1)*4;addRedRock(rockBag,colliders,x,z,[2.5+k%2,1.8,2.2],k%3===0);if(k===1)addJuniper(bag,x+(k%2?6:-6),z+5,.8,h.id*5+k);}
 }
 const ribbon=new THREE.Mesh(mergeGeometries(ribbons),dirt);ribbon.name='Thunderbird fairway ribbons';ribbon.receiveShadow=true;scene.add(ribbon);
 const earlyBatches=[...bakeThunderbird(scene,[...bag,...rockBag],'Thunderbird dressing'),...bakeThunderbird(scene,nearMesas,'Thunderbird rim mesas',{cast:false})];
 const existing=[...dressing,...nearMesas.map(m=>({x:m.position.x,z:m.position.z,radius:32}))];
 const scenery=addThunderbirdScenery({scene,heightAt:thunderbirdHeight,bounds:THUNDERBIRD_BOUNDS,holes,colliders,existing,plane:PLANE,colorAt});
  return{id:'thunderbird',holes,colliders,baskets,water:[],bounds:THUNDERBIRD_BOUNDS,groundHeight:thunderbirdSurfaceHeight,groundNormal:normalAt,palette:{sky:0xd69b72,fog:0xd69b72,fogNear:140,fogFar:520},name:'Thunderbird Gardens',environment:{dressing,scenery:{...scenery,batches:[...earlyBatches,...scenery.batches]}}};
}
