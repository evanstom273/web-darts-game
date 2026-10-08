export const NUMBERS = [20,1,18,4,13,6,10,15,2,17,3,19,7,16,8,11,14,9,12,5];
export const RADII = {bull:6.35/170,outerBull:15.9/170,trebleInner:99/170,trebleOuter:107/170,doubleInner:162/170,doubleOuter:1};
export function scoreAt(x,y){
  const r=Math.hypot(x,y);
  if(r>1) return {value:0,number:0,multiplier:0,label:'Miss',short:'MISS',double:false};
  if(r<=RADII.bull) return {value:50,number:25,multiplier:2,label:'Bullseye',short:'BULL',double:true};
  if(r<=RADII.outerBull) return {value:25,number:25,multiplier:1,label:'Outer bull',short:'25',double:false};
  const angle=(Math.atan2(x,-y)+Math.PI*2)%(Math.PI*2);
  const number=NUMBERS[Math.floor((angle+Math.PI/20)/(Math.PI/10))%20];
  const multiplier=r>=RADII.doubleInner?2:(r>=RADII.trebleInner&&r<=RADII.trebleOuter?3:1);
  return {value:number*multiplier,number,multiplier,label:(multiplier===3?'Treble ':multiplier===2?'Double ':'Single ')+number,short:(multiplier===3?'T':multiplier===2?'D':'S')+number,double:multiplier===2};
}
export function pointFor(number,multiplier=1){
  if(number===25) return {x:0,y:multiplier===2?0:-.064};
  const a=NUMBERS.indexOf(number)*Math.PI/10;
  const r=multiplier===3?(RADII.trebleInner+RADII.trebleOuter)/2:multiplier===2?(RADII.doubleInner+1)/2:.78;
  return {x:Math.sin(a)*r,y:-Math.cos(a)*r};
}
export function resolveDart(remaining,visitStart,hit){
  const next=remaining-hit.value;
  if(next<0||next===1||(next===0&&!hit.double)) return {remaining:visitStart,bust:true,won:false};
  return {remaining:next,bust:false,won:next===0&&hit.double};
}
const doubles=[...Array.from({length:20},(_,i)=>({number:20-i,multiplier:2,value:(20-i)*2,short:'D'+(20-i)})),{number:25,multiplier:2,value:50,short:'BULL'}];
const scores=[...Array.from({length:20},(_,i)=>({number:20-i,multiplier:3,value:(20-i)*3,short:'T'+(20-i)})),...Array.from({length:20},(_,i)=>({number:20-i,multiplier:1,value:20-i,short:'S'+(20-i)})),{number:25,multiplier:1,value:25,short:'25'},...doubles];
export function checkout(remaining,darts=3){
  if(darts<1||remaining<2||remaining>170) return null;
  const direct=doubles.find(h=>h.value===remaining);
  if(direct) return [direct];
  if(darts<2) return null;
  for(const first of scores){const last=doubles.find(h=>h.value===remaining-first.value);if(last)return [first,last];}
  if(darts<3) return null;
  for(const first of scores){for(const second of scores){const last=doubles.find(h=>h.value===remaining-first.value-second.value);if(last)return [first,second,last];}}
  return null;
}
export function chooseTarget(remaining,darts=3){
  const route=checkout(remaining,darts);
  if(route) return route[0];
  if(remaining>62) return {number:20,multiplier:3};
  if(remaining%2===1) return {number:remaining>40?19:1,multiplier:1};
  return {number:Math.max(1,remaining-40),multiplier:1};
}
export function gaussian(random=Math.random){return Math.sqrt(-2*Math.log(Math.max(.00001,random())))*Math.cos(2*Math.PI*random());}
