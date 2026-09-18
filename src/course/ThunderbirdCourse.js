import * as THREE from 'three';
import { makeBasket } from './Basket.js';
import { createParkSign, placeAsset } from './ParkAssets.js';
import { createBench } from './EnvironmentAssets.js';

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
const mat=c=>new THREE.MeshStandardMaterial({color:c,roughness:1,flatShading:true});
const redRock=mat(0x873e2c), darkRock=mat(0x6f3328), juniper=mat(0x405540), trunk=mat(0x5c3928);
const rockGeo=new THREE.IcosahedronGeometry(1,1),juniperGeo=new THREE.IcosahedronGeometry(1,0);
function addRedRock(scene,colliders,x,z,size=[2.5,1.8,2.2],layered=false){const y=thunderbirdHeight(x,z);if(layered){for(let i=0;i<3;i++){const m=new THREE.Mesh(rockGeo,i%2?darkRock:redRock);m.scale.set(size[0]*(1-i*.12),size[1]*.38,size[2]*(1-i*.1));m.position.set(x,y+i*size[1]*.55,z);m.castShadow=m.receiveShadow=true;scene.add(m)}}else{const m=new THREE.Mesh(rockGeo,redRock);m.scale.set(...size);m.position.set(x,y+size[1]*.65,z);m.castShadow=m.receiveShadow=true;scene.add(m)}colliders.push({kind:'rock',center:new THREE.Vector3(x,y+size[1]*.65,z),radii:new THREE.Vector3(...size)})}
function addJuniper(scene,x,z,s=1){const y=thunderbirdHeight(x,z),t=new THREE.Mesh(new THREE.CylinderGeometry(.3,.5,2.5,6),trunk),c=new THREE.Mesh(juniperGeo,juniper);t.position.set(x,y+1.25,z);c.position.set(x,y+3,z);c.scale.set(2.2*s,1.7*s,2.2*s);t.castShadow=c.castShadow=true;scene.add(t,c)}
function terrainRibbon(scene,A,B,width,material){
 const dx=B[0]-A[0],dz=B[1]-A[1],length=Math.hypot(dx,dz),nx=-dz/length,nz=dx/length;
 const steps=Math.max(4,Math.ceil(length/4)),vertices=[],uvs=[],indices=[];
 for(let i=0;i<=steps;i++){const t=i/steps,cx=THREE.MathUtils.lerp(A[0],B[0],t),cz=THREE.MathUtils.lerp(A[1],B[1],t);for(const side of [-1,1]){const x=cx+nx*width*.5*side,z=cz+nz*width*.5*side;vertices.push(x,thunderbirdHeight(x,z)+.16,z);uvs.push(side<0?0:1,t)}}
 for(let i=0;i<steps;i++){const a=i*2,b=a+1,c=a+2,d=a+3;indices.push(a,b,c,b,d,c)}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeVertexNormals();
 const mesh=new THREE.Mesh(geometry,material);mesh.receiveShadow=true;scene.add(mesh);return mesh;
}
export function buildThunderbirdCourse(scene){
 const colliders=[],baskets=[],holes=THUNDERBIRD_HOLES.map(d=>({...d,tee:new THREE.Vector3(d.route[0][0],thunderbirdHeight(...d.route[0])+.08,d.route[0][1]),basket:new THREE.Vector3(d.route.at(-1)[0],thunderbirdHeight(...d.route.at(-1)),d.route.at(-1)[1]),aimPoint:new THREE.Vector3(d.route[1][0],thunderbirdHeight(...d.route[1]),d.route[1][1])}));
 const g=new THREE.PlaneGeometry(430,440,120,120);g.rotateX(-Math.PI/2);const a=g.attributes.position;for(let i=0;i<a.count;i++)a.setY(i,thunderbirdHeight(a.getX(i),a.getZ(i)));g.computeVertexNormals();const ground=new THREE.Mesh(g,mat(0xa65332));ground.receiveShadow=true;scene.add(ground);
 const dirt=mat(0xc16b3f),rock=redRock;
 // Low-poly mesas sit beyond the playable rim and establish the Cedar City skyline.
 for(const [x,z,s]of [[-185,185,1.2],[-80,205,.9],[55,202,1.1],[180,170,1.35]]){const mesa=new THREE.Mesh(new THREE.CylinderGeometry(24*s,34*s,18*s,7),darkRock);mesa.position.set(x,thunderbirdHeight(x,z)+7*s,z);mesa.receiveShadow=true;scene.add(mesa)}
 for(const h of holes){for(let i=1;i<h.route.length;i++)terrainRibbon(scene,h.route[i-1],h.route[i],h.width,dirt);
  const p=h.basket;const shelf=new THREE.Mesh(rockGeo,rock);shelf.scale.set(7,1.35,6);shelf.rotation.y=h.id*.73;shelf.position.set(p.x,p.y-.8,p.z);shelf.castShadow=shelf.receiveShadow=true;scene.add(shelf);baskets.push(makeBasket(scene,p));
  if([1,4].includes(h.id)){const bench=createBench();placeAsset(scene,bench,h.tee.x-7,h.tee.z-4,.4);bench.position.y=thunderbirdHeight(bench.position.x,bench.position.z)}
  const A=h.route[0],B=h.route[1],ang=Math.atan2(B[0]-A[0],B[1]-A[1]);const sign=createParkSign(`${h.id}  ${h.name}`,`PAR ${h.par} / ${h.lengthFeet} FT`);placeAsset(scene,sign,A[0]+Math.cos(ang)*5,A[1]-Math.sin(ang)*5,ang+Math.PI);sign.position.y=thunderbirdHeight(sign.position.x,sign.position.z);
  for(let k=0;k<(h.id>9?5:3);k++){const t=(k+1)/(h.id>9?6:4),x=THREE.MathUtils.lerp(A[0],B[0],t)+(k%2?1:-1)*(h.width+5),z=THREE.MathUtils.lerp(A[1],B[1],t)+(k%2?-1:1)*4;addRedRock(scene,colliders,x,z,[2.5+k%2,1.8,2.2],k%3===0);if(k===1)addJuniper(scene,x+(k%2?6:-6),z+5,.8);}
 }
 return{holes,colliders,baskets,water:[],bounds:THUNDERBIRD_BOUNDS,groundHeight:thunderbirdHeight,groundNormal:normalAt,palette:{sky:0xd69b72,fog:0xd69b72},name:'Thunderbird Gardens'};
}
