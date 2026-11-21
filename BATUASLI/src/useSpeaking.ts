"use client";
import {useEffect,useState,type RefObject} from "react";

// Only the microphone and incoming voice tracks feed this meter.
export function useSpeaking(self:string,mic:boolean,stream:RefObject<MediaStream|null>,links:RefObject<Map<string,{pc:RTCPeerConnection}>>){
 const [speakers,setSpeakers]=useState<string[]>([]);
 useEffect(()=>{
  let disposed=false,timer:ReturnType<typeof setTimeout>,context:AudioContext|undefined,analyser:AnalyserNode|undefined;
  const samples=new Float32Array(512),activeUntil=new Map<string,number>();
  if(mic&&stream.current){
   try{context=new AudioContext();analyser=context.createAnalyser();analyser.fftSize=samples.length;context.createMediaStreamSource(stream.current).connect(analyser);context.resume().catch(()=>{})}catch{}
  }
  const measure=async()=>{
   const now=performance.now(),detected:string[]=[];
   if(analyser){analyser.getFloatTimeDomainData(samples);let sum=0;for(const n of samples)sum+=n*n;if(sum/samples.length>0.00032)detected.push(self)}
   await Promise.all(Array.from(links.current,async([id,{pc}])=>{
    if(pc.connectionState!=="connected")return;
    try{const receiver=pc.getReceivers().find(r=>r.track.kind==="audio");if(!receiver)return;
     const report=await receiver.getStats();report.forEach(stat=>{if(stat.type==="inbound-rtp"&&stat.audioLevel>0.018)detected.push(id)});
    }catch{}
   }));
   if(disposed)return;
   for(const id of detected)activeUntil.set(id,now+350);
   for(const [id,until] of activeUntil)if(until<=now)activeUntil.delete(id);
   const next=Array.from(activeUntil.keys()).sort();setSpeakers(old=>old.join()===next.join()?old:next);
   timer=setTimeout(measure,120);
  };
  measure();return()=>{disposed=true;clearTimeout(timer);context?.close().catch(()=>{})};
 },[self,mic,stream,links]);
 return speakers;
}
