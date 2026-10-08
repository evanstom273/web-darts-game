import {RADII} from './engine.js';

// Ported from the supplied slower three-stage throwing prototype.
// Its sweep reaches the inner edge of the double ring. Match that reach on
// The Oche's regulation-sized rings; scatter remains relative to board radius.
export const PROTOTYPE = Object.freeze({defaultSpeed:.45,minSpeed:.15,maxSpeed:1.5,chargePerSecond:.34,idealRelease:.65,zoneStart:.58,zoneEnd:.73});
export function prototypePosition(seconds,speed=PROTOTYPE.defaultSpeed){
  return RADII.doubleInner*Math.sin(seconds*speed*Math.PI);
}
export function prototypePower(milliseconds){
  return Math.max(0,Math.min(1,milliseconds/1000*PROTOTYPE.chargePerSecond));
}
export function prototypeLanding(aim,power,random=Math.random){
  const miss=Math.abs(power*100-PROTOTYPE.idealRelease*100);
  const accurate=miss<=7;
  const spread=(accurate?2:Math.min(100,(miss-7)*1.7))/153;
  const angle=random()*Math.PI*2,distance=spread*Math.sqrt(random());
  return {point:{x:aim.x+Math.cos(angle)*distance,y:aim.y+Math.sin(angle)*distance},accurate};
}
