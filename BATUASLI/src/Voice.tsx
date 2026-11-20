"use client";
import {useEffect,useRef,useState} from "react";
import {Mic,MicOff,Users,UserRound} from "lucide-react";
type Member={id:string,name:string,host:number,mic:number};
type Call={id:string,sender:string,receiver:string,offer:string,answer:string|null};
export type Identity={room:string,id:string,auth:string};
type Link={pc:RTCPeerConnection,sender:RTCRtpSender,audio:HTMLAudioElement,call:string};
async function localSdp(pc:RTCPeerConnection){
 if(pc.iceGatheringState!=="complete")await new Promise<void>(resolve=>{
  const finish=()=>{clearTimeout(timer);pc.removeEventListener("icegatheringstatechange",change);resolve()};
  const change=()=>{if(pc.iceGatheringState==="complete")finish()};
  const timer=setTimeout(finish,4000);pc.addEventListener("icegatheringstatechange",change);change();
 });
 return pc.localDescription!.sdp;
}
export default function Voice({identity}:{identity:Identity}){
 const [members,setMembers]=useState<Member[]>([]),[mic,setMic]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(""),[blocked,setBlocked]=useState(false);
 const stream=useRef<MediaStream|null>(null), links=useRef(new Map<string,Link>()),active=useRef(false);
 useEffect(()=>{
  active.current=true;let disposed=false,timer:ReturnType<typeof setTimeout>;
  const request=async(action:string,params:Record<string,unknown>={})=>{
   const response=await fetch("/api/room",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...identity,action,...params})});
   if(!response.ok)throw Error("Sesli sohbet bağlantısı kesildi. Tekrar bağlanılıyor.");return response.json();
  };
  const remove=(id:string)=>{const link=links.current.get(id);if(link){link.pc.close();link.audio.srcObject=null;links.current.delete(id)}};
  const connect=async(id:string,incoming?:Call)=>{
   remove(id);
   const pc=new RTCPeerConnection({iceServers:[{urls:"stun:stun.l.google.com:19302"}]});
   const audio=new Audio();audio.autoplay=true;
   pc.ontrack=e=>{audio.srcObject=new MediaStream([e.track]);audio.play().catch(()=>{if(!disposed)setBlocked(true)})};
   const link:Link={pc,audio,call:incoming?.id||"",sender:null as unknown as RTCRtpSender};
   links.current.set(id,link);
   try{
    if(incoming)await pc.setRemoteDescription({type:"offer",sdp:incoming.offer});
    const trans=pc.getTransceivers()[0]||pc.addTransceiver("audio",{direction:"sendrecv"});
    trans.direction="sendrecv";link.sender=trans.sender;await trans.sender.replaceTrack(stream.current?.getAudioTracks()[0]||null);
    await pc.setLocalDescription(incoming?await pc.createAnswer():await pc.createOffer());
    const sdp=await localSdp(pc);if(disposed)return;
    if(incoming)await request("reply",{target:id,call:incoming.id,sdp});
    else link.call=(await request("call",{target:id,sdp})).id;
   }catch(e){remove(id);throw e}
  };
  const poll=async()=>{
   try{
    const result=await request("voice",{mic:!!stream.current});if(disposed)return;
    const roster:Member[]=result.roster,calls:Call[]=result.calls;
    setMembers(roster);
    for(const id of links.current.keys())if(!roster.some(m=>m.id===id))remove(id);
    for(const m of roster){
     if(disposed||m.id===identity.id)continue;
     const link=links.current.get(m.id);
     if(identity.id<m.id){
      if((stream.current||m.mic)&&(!link||link.pc.connectionState==="failed"))await connect(m.id);
      else if(link?.pc.signalingState==="have-local-offer"){
       const reply=calls.find(c=>c.id===link.call)?.answer;
       if(reply)await link.pc.setRemoteDescription({type:"answer",sdp:reply});
      }
     }else{
      const offer=calls.find(c=>c.sender===m.id&&c.receiver===identity.id);
      if(offer&&offer.id!==link?.call)await connect(m.id,offer);
     }
    }
   }catch(e){if(!disposed)setError((e as Error).message)}
   if(!disposed)timer=setTimeout(poll,1400);
  };
  const leave=()=>{navigator.sendBeacon("/api/room",JSON.stringify({...identity,action:"depart"}))};
  window.addEventListener("pagehide",leave);poll();
  return()=>{disposed=true;active.current=false;clearTimeout(timer);window.removeEventListener("pagehide",leave);leave();stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;for(const id of links.current.keys())remove(id)};
 },[identity]);
 async function toggle(){
  setError("");setBusy(true);
  try{
   if(stream.current){stream.current.getTracks().forEach(t=>t.stop());stream.current=null;setMic(false)}
   else{
    if(!navigator.mediaDevices?.getUserMedia)throw Error("Bu tarayıcıda mikrofon kullanılamıyor. Odayı HTTPS ile aç.");
    const s=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});
    if(!active.current){s.getTracks().forEach(t=>t.stop());return}
    stream.current=s;setMic(true);
    s.getAudioTracks()[0].onended=()=>{if(stream.current===s){stream.current=null;setMic(false)}};
   }
   await Promise.all([...links.current.values()].map(link=>link.sender?.replaceTrack(stream.current?.getAudioTracks()[0]||null)));
  }catch(e){setError((e as Error).name==="NotAllowedError"?"Mikrofon izni verilmedi. Tarayıcıdan izin verip tekrar deneyebilirsin.":(e as Error).message)}finally{setBusy(false)}
 }
 return <section className="card people"><div className="row"><h3>Sesli sohbet</h3><span><Users size={14}/>{members.length}</span></div>
 {members.map(m=><div className="person" key={m.id}><i><UserRound size={18}/></i><div><strong>{m.name}{m.id===identity.id?" (sen)":""}</strong><small>{m.host?"Yayıncı":"İzleyici"}</small></div><span className="mic-state" aria-label={m.mic?"Mikrofon açık":"Mikrofon kapalı"}>{m.mic?<Mic size={16}/>:<MicOff size={16}/>}</span></div>)}
 <button className="copy voice-toggle" disabled={busy} aria-pressed={mic} onClick={toggle}>{mic?<Mic size={17}/>:<MicOff size={17}/>} {mic?"Mikrofonu kapat":"Mikrofonu aç"}</button>
 {blocked&&<button className="copy" onClick={async()=>{try{await Promise.all([...links.current.values()].filter(l=>l.audio.srcObject).map(l=>l.audio.play()));setBlocked(false)}catch{setError("Ses çalınamadı. Tekrar dene.")}}}>Sohbet sesini dinle</button>}
 {error&&<p role="status">{error}</p>}</section>
}
