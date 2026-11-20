"use client";
import {useEffect,useRef,useState} from "react";
import {createPortal} from "react-dom";
import {useSpeaking} from "./useSpeaking";
import {Mic,MicOff,Users,UserRound,Volume2,VolumeX,Video,VideoOff,Maximize2,Minimize2} from "lucide-react";
type Member={id:string,name:string,host:number,mic:number,camera:number};
type Call={id:string,sender:string,receiver:string,offer:string,answer:string|null};
export type Identity={room:string,id:string,auth:string};
type Link={videoSender?:RTCRtpSender,pc:RTCPeerConnection,sender:RTCRtpSender,audio:HTMLAudioElement,call:string};
async function localSdp(pc:RTCPeerConnection){
 if(pc.iceGatheringState!=="complete")await new Promise<void>(resolve=>{
  const finish=()=>{clearTimeout(timer);pc.removeEventListener("icegatheringstatechange",change);resolve()};
  const change=()=>{if(pc.iceGatheringState==="complete")finish()};
  const timer=setTimeout(finish,4000);pc.addEventListener("icegatheringstatechange",change);change();
 });
 return pc.localDescription!.sdp;
}
function CameraTile({media,label,local=false,speaking}:{media:MediaStream,label:string,local?:boolean,speaking:boolean}){
 const preview=useRef<HTMLVideoElement>(null),large=useRef<HTMLVideoElement>(null),dialog=useRef<HTMLDialogElement>(null);
 const [expanded,setExpanded]=useState(false);
 useEffect(()=>{
  const el=preview.current!;
  el.srcObject=media;el.play().catch(()=>{});
  return()=>{el.srcObject=null};
 },[media]);
 useEffect(()=>{
  if(!expanded)return;
  const el=large.current!;
  el.srcObject=media;el.play().catch(()=>{});
  return()=>{el.srcObject=null};
 },[media,expanded]);
 const tileClass="camera-tile "+(local?"local":"remote")+(speaking?" camera-speaking":"");
 return <>
  <figure className={tileClass}><video ref={preview} muted autoPlay playsInline/><figcaption>{label}</figcaption>
   <button type="button" className="camera-zoom" aria-label={label+" kamerasını büyüt"} aria-haspopup="dialog" onClick={()=>{dialog.current?.showModal();setExpanded(true)}}><Maximize2 size={15}/></button>
  </figure>
  <dialog className="camera-dialog" ref={dialog} aria-label={label+" kamera görüntüsü"} onClose={()=>setExpanded(false)} onClick={()=>dialog.current?.close()}>
   {expanded&&<figure className={tileClass}><video ref={large} muted autoPlay playsInline/><figcaption>{label}</figcaption>
    <button type="button" className="camera-zoom" aria-label="Kamerayı küçült"><Minimize2 size={22}/></button></figure>}
  </dialog>
 </>
}
export default function Voice({identity,fullscreenPlayer,username}:{identity:Identity,fullscreenPlayer:HTMLElement|null,username:string}){
 const camera=useRef<MediaStream|null>(null);
 const [localCamera,setLocalCamera]=useState<MediaStream|null>(null),[cameraBusy,setCameraBusy]=useState(false);
 const [remoteCameras,setRemoteCameras]=useState<Record<string,MediaStream>>({});
 const [members,setMembers]=useState<Member[]>([]),[mic,setMic]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(""),[blocked,setBlocked]=useState(false);
 const stream=useRef<MediaStream|null>(null), links=useRef(new Map<string,Link>()),active=useRef(false);
 const [listenLevel,setListenLevel]=useState(100);
 const currentLevel=useRef(100),lastAudible=useRef(100);
 function changeListenLevel(next:number){
  const level=Math.max(0,Math.min(100,next));
  currentLevel.current=level;
  if(level>0)lastAudible.current=level;
  for(const {audio} of links.current.values()){
   audio.muted=level===0;
   audio.volume=level/100;
  }
  setListenLevel(level);
 }
 const speakers=useSpeaking(identity.id,mic,stream,links);
 useEffect(()=>{
  active.current=true;let disposed=false,timer:ReturnType<typeof setTimeout>;
  const request=async(action:string,params:Record<string,unknown>={})=>{
   const response=await fetch("/api/room",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...identity,action,...params})});
   if(!response.ok)throw Error("Sesli sohbet bağlantısı kesildi. Tekrar bağlanılıyor.");return response.json();
  };
  const remove=(id:string)=>{const link=links.current.get(id);if(link){link.pc.close();link.audio.srcObject=null;links.current.delete(id);if(!disposed)setRemoteCameras(old=>{if(!(id in old))return old;const next={...old};delete next[id];return next})}};
  const connect=async(id:string,incoming?:Call)=>{
   remove(id);
   const pc=new RTCPeerConnection({iceServers:[{urls:"stun:stun.l.google.com:19302"}]});
   const audio=new Audio();
   audio.muted=currentLevel.current===0;
   audio.volume=currentLevel.current/100;
   audio.autoplay=true;
   pc.ontrack=e=>{if(disposed||links.current.get(id)?.pc!==pc)return;
    if(e.track.kind==="video"){const media=new MediaStream([e.track]);setRemoteCameras(old=>({...old,[id]:media}));return}
    audio.srcObject=new MediaStream([e.track]);audio.play().catch(()=>{if(!disposed)setBlocked(true)})};
   const link:Link={pc,audio,call:incoming?.id||"",sender:null as unknown as RTCRtpSender};
   links.current.set(id,link);
   try{
    if(incoming)await pc.setRemoteDescription({type:"offer",sdp:incoming.offer});
    const trans=pc.getTransceivers().find(t=>t.receiver.track.kind==="audio")||pc.addTransceiver("audio",{direction:"sendrecv"});
    trans.direction="sendrecv";link.sender=trans.sender;await trans.sender.replaceTrack(stream.current?.getAudioTracks()[0]||null);
    const visual=pc.getTransceivers().find(t=>t.receiver.track.kind==="video")||(!incoming?pc.addTransceiver("video",{direction:"sendrecv"}):undefined);
    if(visual){visual.direction="sendrecv";link.videoSender=visual.sender;await visual.sender.replaceTrack(camera.current?.getVideoTracks()[0]||null)}
    await pc.setLocalDescription(incoming?await pc.createAnswer():await pc.createOffer());
    const sdp=await localSdp(pc);if(disposed)return;
    if(incoming)await request("reply",{target:id,call:incoming.id,sdp});
    else link.call=(await request("call",{target:id,sdp})).id;
   }catch(e){remove(id);throw e}
  };
  const poll=async()=>{
   try{
    const result=await request("voice",{mic:!!stream.current,camera:!!camera.current});if(disposed)return;
    const roster:Member[]=result.roster,calls:Call[]=result.calls;
    setMembers(roster);
    for(const id of links.current.keys())if(!roster.some(m=>m.id===id))remove(id);
    for(const m of roster){
     if(disposed||m.id===identity.id)continue;
     const link=links.current.get(m.id);
     if(identity.id<m.id){
      if((stream.current||m.mic||camera.current||m.camera)&&(!link||link.pc.connectionState==="failed"))await connect(m.id);
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
  return()=>{disposed=true;active.current=false;clearTimeout(timer);window.removeEventListener("pagehide",leave);leave();camera.current?.getTracks().forEach(t=>t.stop());camera.current=null;stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;for(const id of links.current.keys())remove(id)};
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
 function releaseCamera(){
  const old=camera.current;camera.current=null;
  old?.getTracks().forEach(track=>track.stop());setLocalCamera(null);
 }
 async function toggleCamera(){
  setCameraBusy(true);setError("");
  try{
   if(camera.current)releaseCamera();
   else{
    if(!navigator.mediaDevices?.getUserMedia)throw Error("Kamera için odayı HTTPS ile aç.");
    const media=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:"user",width:{ideal:480,max:640},height:{ideal:360,max:480},frameRate:{ideal:15,max:20}}});
    if(!active.current){media.getTracks().forEach(track=>track.stop());return}
    camera.current=media;setLocalCamera(media);
    media.getVideoTracks()[0].onended=()=>{if(camera.current===media)releaseCamera()};
   }
   const track=camera.current?.getVideoTracks()[0]||null;
   await Promise.all(Array.from(links.current.values(),link=>link.videoSender?.replaceTrack(track)));
  }catch(e){releaseCamera();setError((e as Error).name==="NotAllowedError"?"Kamera izni verilmedi. Tarayıcıdan izin verip tekrar deneyebilirsin.":"Kamera açılamadı. Cihazı ve tarayıcı izinlerini kontrol et.")}
  finally{setCameraBusy(false)}
 }
 const remoteMembers=members.filter(m=>m.id!==identity.id&&m.camera&&remoteCameras[m.id]);
 const tiles=(localCamera||remoteMembers.length>0)?<div className={"camera-strip"+(fullscreenPlayer?" cinema-cameras":"")}>
  <div>{localCamera&&<CameraTile local speaking={speakers.includes(identity.id)} media={localCamera} label={username+" (sen)"}/>}</div>
  <div>{remoteMembers.map(m=><CameraTile key={m.id} speaking={speakers.includes(m.id)} media={remoteCameras[m.id]} label={m.name}/>)}</div>
 </div>:null;
 const cameraButton=<button type="button" className="copy camera-toggle" aria-label={localCamera?"Kamerayı kapat":"Kamerayı aç"} title={localCamera?"Kamerayı kapat":"Kamerayı aç"} aria-pressed={!!localCamera} disabled={cameraBusy} onClick={toggleCamera}>{localCamera?<VideoOff size={17}/>:<Video size={17}/>} </button>;
 return <section className="card people"><div className="row"><h3>Sesli sohbet</h3><span><Users size={14}/>{members.length}</span></div>
 {members.map(m=><div className="person" key={m.id}><i className={speakers.includes(m.id)?"speaking":""} aria-label={speakers.includes(m.id)?"Konuşuyor":undefined}><UserRound size={18}/></i><div><strong>{m.name}{m.id===identity.id?" (sen)":""}</strong><small>{m.host?"Yayıncı":"İzleyici"}</small></div><span className="mic-state" aria-label={m.mic?"Mikrofon açık":"Mikrofon kapalı"}>{m.mic?<Mic size={16}/>:<MicOff size={16}/>}</span></div>)}
 <button className="copy voice-toggle" aria-label={mic?"Mikrofonu kapat":"Mikrofonu aç"} title={mic?"Mikrofonu kapat":"Mikrofonu aç"} disabled={busy} aria-pressed={mic} onClick={toggle}>{mic?<Mic size={17}/>:<MicOff size={17}/>} </button>
 {cameraButton}
 {fullscreenPlayer?createPortal(<>{tiles}<div className="cinema-camera-control">{cameraButton}</div></>,fullscreenPlayer):tiles}
 <fieldset className="voice-listening">
  <legend>Sohbet sesi</legend>
  <div className="listen-controls">
  <button type="button" className="listen-mute" aria-label={listenLevel===0?"Sohbet sesini aç":"Sohbeti sessize al"} title={listenLevel===0?"Sohbet sesini aç":"Sohbeti sessize al"} aria-pressed={listenLevel===0} onClick={()=>changeListenLevel(listenLevel===0?lastAudible.current:0)}>
   {listenLevel===0?<VolumeX size={16}/>:<Volume2 size={16}/>}

  </button>

   <input type="range" min="0" max="100" step="1" value={listenLevel} onChange={e=>changeListenLevel(Number(e.target.value))} aria-label="Sohbet ses seviyesi" aria-valuetext={"Yüzde "+listenLevel}/>
   <output>%{listenLevel}</output>
  </div>
 </fieldset>
 {blocked&&<button className="copy" onClick={async()=>{try{await Promise.all([...links.current.values()].filter(l=>l.audio.srcObject).map(l=>l.audio.play()));setBlocked(false)}catch{setError("Ses çalınamadı. Tekrar dene.")}}}>Sohbet sesini dinle</button>}
 {error&&<p role="status">{error}</p>}</section>
}
