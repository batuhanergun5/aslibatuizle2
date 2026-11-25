"use client";
import Voice, {type Identity} from "./Voice";
import LoveNote from "./LoveNote";
import {useEffect,useRef,useState} from "react";
import { Settings, MonitorPlay, ScreenShare, Users, Link2, Copy, Monitor, Maximize, Volume2, VolumeX, Play, Square, CircleHelp, X, Radio, Check, Clapperboard, UserRound } from "lucide-react";
const ice={iceServers:[{urls:"stun:stun.l.google.com:19302"}]};
async function description(pc:RTCPeerConnection){
 if(pc.iceGatheringState!=="complete") await new Promise<void>(done=>{
 const finish=()=>{clearTimeout(timer);pc.removeEventListener("icegatheringstatechange",change);done()};
 const change=()=>{if(pc.iceGatheringState==="complete")finish()};
 const timer=setTimeout(finish,5000);pc.addEventListener("icegatheringstatechange",change);change();
 });
 return pc.localDescription!.sdp;
}
const qualities=["720p30","720p60","1080p30","1080p60"] as const;
type Quality=typeof qualities[number];
type Peer={id:string,offer:string|null,quality:Quality};
async function setVideoQuality(pc:RTCPeerConnection,quality:Quality){
 const sender=pc.getSenders().find(s=>s.track?.kind==="video");
 if(!sender?.track)return;
 const p=sender.getParameters();
 if(!p.encodings?.length)return;
 const [height,fps]=quality.split("p").map(Number);
 const sourceHeight=sender.track.getSettings().height||1080;
 const scale=Math.max(1,sourceHeight/height);
 const bitrate=(height===1080?5000000:2500000)*(fps===60?1.6:1);
 const e=p.encodings[0];
 if(e.scaleResolutionDownBy===scale && e.maxFramerate===fps && e.maxBitrate===bitrate)return;
 Object.assign(e,{scaleResolutionDownBy:scale,maxFramerate:fps,maxBitrate:bitrate});
 await sender.setParameters(p);
}
function isAsli(name:string){
 const letters=name.normalize("NFKD").toLocaleLowerCase("tr").replace(/ı/g,"i").replace(/\p{M}/gu,"").replace(/[\s\p{P}\p{S}\uFE0F]/gu,"");
 return /^a+s+l+i+$/.test(letters);
}
export default function Entrance(){
 const [draft,setDraft]=useState(""),[username,setUsername]=useState("");
 const [welcome,setWelcome]=useState(""),[greeting,setGreeting]=useState(false);
 const [activeRooms,setActiveRooms]=useState<{id:string,name:string|null,members:number}[]>([]);
 const [listStatus,setListStatus]=useState("Odalar yükleniyor…");
 const [roomName,setRoomName]=useState("");
 const [invited,setInvited]=useState(false);
 useEffect(()=>{
  setInvited(!!new URLSearchParams(location.search).get("oda"));
  if(username||welcome)return;
  const controller=new AbortController();
  let timer:ReturnType<typeof setTimeout>;
  async function refresh(){
   try{
    const response=await fetch("/api/room",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"activeRooms"}),signal:controller.signal});
    if(!response.ok)throw Error();
    const data=await response.json();if(controller.signal.aborted)return;
    setActiveRooms(data.rooms);setListStatus("");
   }catch{if(!controller.signal.aborted)setListStatus("Aktif odalar alınamadı. Yeniden deneniyor…")}
   if(!controller.signal.aborted)timer=setTimeout(refresh,3000);
  }
  refresh();return()=>{controller.abort();clearTimeout(timer)};
 },[username,welcome]);
 useEffect(()=>{try{setDraft(localStorage.getItem("batuasli-name")||"")}catch{}},[]);
 useEffect(()=>{
  if(!welcome)return;
  const reduced=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const reveal=window.setTimeout(()=>setGreeting(true),reduced?350:2000);
  const enter=window.setTimeout(()=>setUsername(welcome),reduced?2450:4500);
  return()=>{clearTimeout(reveal);clearTimeout(enter)};
 },[welcome]);
 useEffect(()=>{
  let heartInput:Element|null=null;
  function detectHeart(e:PointerEvent){
   heartInput=null;
   const target=e.target;
   if(!(target instanceof Element) || !target.matches(".heart-volume input"))return;
   const rect=target.closest(".heart-volume")?.querySelector(".volume-track b")?.getBoundingClientRect();
   if(rect && e.clientX>=rect.left && e.clientX<=rect.right && e.clientY>=rect.top && e.clientY<=rect.bottom)heartInput=target;
  }
  function hearts(event:MouseEvent){
   const target=event.target;
   if(!(target instanceof Element))return;
   let control=target.closest(".secret-heart,.love-letter .lucide-heart");
   if(!control && target===heartInput)control=target;
   heartInput=null;
   if(!control)return;
   const bounds=control.getBoundingClientRect();
   const x=event.detail?event.clientX:bounds.left+bounds.width/2;
   const y=event.detail?event.clientY:bounds.top+bounds.height/2;
   const layer=document.createElement("span");layer.className="tap-hearts";layer.setAttribute("aria-hidden","true");
   layer.style.left=x+"px";layer.style.top=y+"px";
   for(const offset of [-22,0,22]){
    const heart=document.createElement("i");heart.textContent="♥";heart.style.setProperty("--drift",offset+"px");layer.append(heart)
   }
   (control.closest("dialog[open]")||document.fullscreenElement||document.body).append(layer);
   window.setTimeout(()=>layer.remove(),650)
  }
  document.addEventListener("pointerdown",detectHeart,true);
  document.addEventListener("click",hearts,true);
  return()=>{document.removeEventListener("click",hearts,true);document.removeEventListener("pointerdown",detectHeart,true)}
 },[]);
 if(username)return <Room username={username} roomName={roomName.trim()}/>;
 if(welcome)return <main className="flower-welcome">
  <div className="flower-field" aria-hidden="true">{Array.from({length:40},(_,i)=><span key={i} style={{left:((i%8)*12.5+2+(i*7%9))+"%",top:(Math.floor(i/8)*20+2+(i*3%13))+"%",animationDelay:(i*137%1050)+"ms",fontSize:"clamp(28px,"+(4+i%4)+"vmin,78px)"}}>{["🌸","🌹","🌺"][i%3]}</span>)}</div>
  <div className="welcome-message" role="status">{greeting&&<h1>Hoş geldin aşkım</h1>}</div>
  <button className="welcome-skip" onClick={()=>setUsername(welcome)}>Odaya geç</button>
 </main>;
 return <main className="entrance"><form className="card entry" onSubmit={e=>{
  e.preventDefault();const name=draft.trim();if(!name)return;
  try{localStorage.setItem("batuasli-name",name)}catch{}
  const chosen=((e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement|null)?.value;
  if(chosen)history.replaceState(null,"",location.pathname+"?oda="+encodeURIComponent(chosen));
  if(isAsli(name))setWelcome(name);else setUsername(name)
 }}>
 <div className="entry-brand"><MonitorPlay size={23}/> BATUASLI</div><h1>Bizim film odamız</h1><label htmlFor="username">Kullanıcı adın</label>
 <input id="username" autoComplete="nickname" required maxLength={32} placeholder="Odada nasıl görünmek istersin?" value={draft} onChange={e=>setDraft(e.target.value)}/>
 {!invited&&!listStatus&&!activeRooms.length&&<><label htmlFor="room-name">Oda adı</label><input id="room-name" value={roomName} maxLength={48} onChange={e=>setRoomName(e.target.value)} placeholder="Örneğin Film gecesi"/></>}
 {(invited||(!activeRooms.length&&!listStatus))&&<button className="primary" disabled={!draft.trim()} type="submit"><Play size={16}/>{invited?"Davetteki odaya gir":"Odaya gir"}</button>}
 <section className="recent-rooms"><h2>Aktif odalar</h2>
 {listStatus?<p role="status">{listStatus}</p>:activeRooms.length===0?<p>Şu anda aktif oda yok.</p>:activeRooms.map(r=><div key={r.id}><button type="submit" value={r.id} disabled={!draft.trim()}><Play size={15}/>{r.name||"Oda"} · {r.id.slice(0,6)} · {r.members} kişi · Katıl</button></div>)}
 </section>
 </form></main>
}
function Room({username,roomName}:{username:string,roomName:string}){
 const [candidates,setCandidates]=useState<{id:string,name:string}[]>([]);
 const [transferOpen,setTransferOpen]=useState(false);
 const [quality,setQuality]=useState<Quality>("720p30"),[qualityOpen,setQualityOpen]=useState(false);
 const desiredQuality=useRef<Quality>("720p30");
 const [nativeFull,setNativeFull]=useState(false);

 const [title,setTitle]=useState("Bizim film odamız"),[talking,setTalking]=useState(false);
 const [theater,setTheater]=useState(false);
 const [playBlocked,setPlayBlocked]=useState(false);
 const rawBroadcastAudio=useRef<MediaStreamTrack|null>(null);
 const broadcastGain=useRef<GainNode|null>(null);
 const levelRef=useRef(1);
 const lastVolume=useRef(100);
 const [volume,setVolume]=useState(100);
 const [expanded,setExpanded]=useState(false);
 useEffect(()=>{if(!expanded)return;const exit=(e:KeyboardEvent)=>{if(e.key==="Escape")setExpanded(false)};window.addEventListener("keydown",exit);return()=>window.removeEventListener("keydown",exit)},[expanded]);
 const [identity,setIdentity]=useState<Identity|null>(null);
 const [room,setRoom]=useState(""),[host,setHost]=useState(true),[live,setLive]=useState(false),[members,setMembers]=useState(1),[error,setError]=useState(""),[help,setHelp]=useState(false),[copied,setCopied]=useState(false),[busy,setBusy]=useState(false),[muted,setMuted]=useState(false),[audio,setAudio]=useState(false),[joined,setJoined]=useState(false);
 const video=useRef<HTMLVideoElement>(null),screen=useRef<HTMLDivElement>(null),invite=useRef<HTMLInputElement>(null),actions=useRef<{share:()=>Promise<void>,stop:()=>Promise<void>,transfer:(id:string)=>Promise<void>}|null>(null);
 const [hudHidden,setHudHidden]=useState(false);
 const full=nativeFull||expanded;
 useEffect(()=>{
  const root=screen.current;
  setHudHidden(false);
  if(!root)return;
  let timer:number|undefined;
  let adjusting=false;
  let touchMode=matchMedia("(pointer:coarse)").matches;
  function show(){
   clearTimeout(timer);
   setHudHidden(false);
   if(full && !touchMode && !adjusting)timer=window.setTimeout(()=>{
    if(root!.querySelector("dialog[open],.transfer-menu"))return;
    setQualityOpen(false);setHudHidden(true);
   },3000);
  }
  function move(e:PointerEvent){
   if(e.pointerType==="mouse"){touchMode=false;show()}
  }
  function down(e:PointerEvent){
   touchMode=e.pointerType!=="mouse";
   if(touchMode)clearTimeout(timer);
   if(e.target instanceof Element && e.target.closest('input[type="range"]')){
    adjusting=true;clearTimeout(timer);
   }
  }
  function release(e:PointerEvent){
   if(!adjusting)return;
   adjusting=false;
   if(e.pointerType==="mouse"){touchMode=false;show()}
  }
  function tap(e:MouseEvent){
   const target=e.target;
   if(!(target instanceof Element) || !target.closest(".scene") || target.closest("button,input,label,dialog"))return;
   if(!touchMode){show();return}
   clearTimeout(timer);
   setQualityOpen(false);
   setHudHidden(hidden=>!hidden);
  }
  // A real mouse movement also arms the timer on hybrid devices.
  show();
  root.addEventListener("click",tap);
  root.addEventListener("pointermove",move);
  root.addEventListener("pointerdown",down);
  window.addEventListener("pointerup",release);
  window.addEventListener("pointercancel",release);
  root.addEventListener("keydown",show);
  root.addEventListener("close",show,true);
  return ()=>{
   clearTimeout(timer);
   root.removeEventListener("click",tap);
   root.removeEventListener("pointermove",move);root.removeEventListener("pointerdown",down);
   window.removeEventListener("pointerup",release);window.removeEventListener("pointercancel",release);
   root.removeEventListener("keydown",show);root.removeEventListener("close",show,true);
  };
 },[full]);
 const receiver=useRef<{ctx:AudioContext,gain:GainNode,source:MediaStreamAudioSourceNode|null,stream:MediaStream|null,element:MediaElementAudioSourceNode|null}|null>(null);
 const localMix=useRef(1);
 function syncReceiver(){
  const el=video.current;if(!el)return;
  const graph=receiver.current;
  if(!graph){el.volume=localMix.current;return}
  const stream=el.srcObject instanceof MediaStream?el.srcObject:null;
  if(stream && graph.element)graph.element.disconnect();
  if(graph.stream!==stream || (stream && !graph.source && stream.getAudioTracks().length)){
   graph.source?.disconnect();graph.source=null;graph.stream=stream;
   if(stream?.getAudioTracks().length){
    graph.source=graph.ctx.createMediaStreamSource(stream);graph.source.connect(graph.gain);
   }
  }
  if(!stream && el.hasAttribute("src")){
   graph.element??=graph.ctx.createMediaElementSource(el);graph.element.connect(graph.gain);
  }
  el.muted=!!stream || localMix.current===0;
  el.volume=1;
  graph.gain.gain.setTargetAtTime(localMix.current,graph.ctx.currentTime,.015);
 }
 function enableReceiver(){
  const el=video.current!;
  if(!receiver.current && typeof AudioContext!=="undefined"){
   try{
    const ctx=new AudioContext(),gain=ctx.createGain();gain.connect(ctx.destination);
    receiver.current={ctx,gain,source:null,stream:null,element:null};
   }catch{el.volume=localMix.current}
  }
  receiver.current?.ctx.resume().catch(()=>{});
  syncReceiver();
 }
 useEffect(()=>()=>{receiver.current?.ctx.close().catch(()=>{});receiver.current=null},[]);
 useEffect(()=>{
 let dead=false,room="",secret="",guest="",epoch="",stream:MediaStream|null=null,guestPc:RTCPeerConnection|null=null,timer:ReturnType<typeof setTimeout>;
 let recorder:MediaRecorder|null=null, recordTimer:ReturnType<typeof setTimeout>, part=0, lastPart=0, blobUrl="",fallback=false;
 let relayNeeded=false, waitingSince=0, uploading=false;
 let queued:{url:string,part:number}|null=null;
 const clearQueue=()=>{if(queued)URL.revokeObjectURL(queued.url);queued=null};
 const playViewer=(el:HTMLVideoElement)=>{el.play().then(()=>{if(!dead)setPlayBlocked(false)}).catch(e=>{if(!dead && e.name==="NotAllowedError")setPlayBlocked(true)})};
 const playQueued=()=>{
   if(!queued||!video.current||guestPc?.connectionState==="connected")return;
   const v=video.current, old=blobUrl;
   blobUrl=queued.url;lastPart=queued.part;queued=null;fallback=true;
   v.srcObject=null;v.src=blobUrl;syncReceiver();playViewer(v);
   if(old)URL.revokeObjectURL(old);
   setLive(true);setAudio(true);
 };
 const player=video.current!;
 player.addEventListener("ended",playQueued);
 const mediaUrl=(key:string,n:number)=>"/api/media?"+new URLSearchParams({room,epoch:key,part:String(n)});
 const record=(s:MediaStream,key:string)=>{
 if(typeof MediaRecorder==="undefined"||dead||!relayNeeded||stream!==s||epoch!==key)return;
 const mime=["video/webm;codecs=vp8,opus","video/webm"].find(t=>MediaRecorder.isTypeSupported(t));if(!mime)return;
 const rec=new MediaRecorder(s,{mimeType:mime,videoBitsPerSecond:1200000});recorder=rec;
 rec.ondataavailable=async ev=>{
 if(dead||!relayNeeded||uploading||stream!==s||epoch!==key||!ev.data.size)return;
 uploading=true;
 try{const res=await fetch(mediaUrl(key,++part),{method:"PUT",headers:{Authorization:"Bearer "+secret},body:ev.data});if(!res.ok)throw Error()}catch{if(!dead)setError("Yedek yayın sunucusuna ulaşılamadı.")}finally{uploading=false}
 };
 rec.onstop=()=>{if(recorder===rec&&relayNeeded&&stream===s&&epoch===key&&!dead)record(s,key)};
 rec.start();recordTimer=setTimeout(()=>{if(rec.state==="recording")rec.stop()},3600);
 };
 const resetRecording=()=>{clearTimeout(recordTimer);if(recorder?.state==="recording")recorder.stop();recorder=null};
 const pcs=new Map<string,RTCPeerConnection>();
 let credentials:{id:string,auth:string}|undefined;
 const api=async(action:string,more:Record<string,unknown>={})=>{
 const res=await fetch("/api/room",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,room,secret,guest,...credentials,...more})});
 if(res.status===404 && ["poll","join","stop"].includes(action) && !dead){
   sessionStorage.removeItem("host-"+room);
   if(action==="poll")location.replace(location.pathname);
  }
 if(!res.ok)throw Error(res.status===404?"Oda kapanmış veya davet bağlantısı geçersiz.":"Odaya bağlanılamadı. Bağlantını kontrol et.");
 return res.json()};
 const clear=()=>{pcs.forEach(p=>p.close());pcs.clear();guestPc?.close();guestPc=null;if(video.current)video.current.srcObject=null};
 let captureAudio:MediaStreamTrack|undefined;
 let context:AudioContext|null=null;
 function releaseAudio(){
  captureAudio?.stop();captureAudio=undefined;rawBroadcastAudio.current=null;
  if(context)context.close().catch(()=>{});
  context=null;broadcastGain.current=null;
 }
 const resetBroadcast=()=>{releaseAudio();stream?.getTracks().forEach(t=>t.stop());stream=null;epoch="";relayNeeded=false;waitingSince=0;resetRecording();clear();setLive(false);setAudio(false);clearQueue();fallback=false;lastPart=0;
 player.removeAttribute("src");player.load();if(blobUrl)URL.revokeObjectURL(blobUrl);blobUrl=""};
 const stop=async()=>{resetBroadcast();await api("stop")};
 const transfer=async(target:string)=>{await api("transfer",{target});setTransferOpen(false)};

 const share=async()=>{
 if(!navigator.mediaDevices?.getDisplayMedia)throw Error("Ekran paylaşmak için siteyi masaüstü Chrome veya Edge ile aç.");
 const options={video:{width:{ideal:1920,max:1920},height:{ideal:1080,max:1080},frameRate:{ideal:60,max:60}},audio:true,systemAudio:"include",windowAudio:"window"} as DisplayMediaStreamOptions;
 let s:MediaStream;
 try{s=await navigator.mediaDevices.getDisplayMedia(options)}catch(e){
  if(/could not start audio source/i.test((e as Error).message))
   throw Error("Seçilen ekranın sesi başlatılamadı. Yayını başlat'a tekrar bas. Video tarayıcıdaysa Chrome sekmesini seçip sekme sesini paylaşmayı aç. Tüm ekran için sistem sesini paylaşmayı seç.");
  throw e;
 }
 if(dead){s.getTracks().forEach(t=>t.stop());return}
 const track=s.getVideoTracks()[0];if("contentHint" in track)track.contentHint="motion";
 try{
 captureAudio=s.getAudioTracks().find(t=>t.readyState==="live");
 if(captureAudio){
  try{context=new AudioContext()}catch{context=null}
 }
 if(captureAudio && context?.state==="running"){
  const source=context.createMediaStreamSource(new MediaStream([captureAudio]));
  const gain=context.createGain(),destination=context.createMediaStreamDestination();
  gain.gain.value=levelRef.current;source.connect(gain);gain.connect(destination);
  broadcastGain.current=gain;
  s.removeTrack(captureAudio);s.addTrack(destination.stream.getAudioTracks()[0]);
 }else{
  void context?.close().catch(()=>{});context=null;
  if(captureAudio){rawBroadcastAudio.current=captureAudio;captureAudio.enabled=levelRef.current>0}
  else setError("Tarayıcı ses kanalı göndermedi. Sesli yayın için paylaşımı durdurup Tüm Ekran → Sistem sesini paylaş seçeneğiyle tekrar başlat. Bir sekme paylaşıyorsan sekme sesini aç.");
 }
 const result=await api("start");if(dead){releaseAudio();s.getTracks().forEach(t=>t.stop());return}
 epoch=result.epoch;stream=s;part=0;waitingSince=0;video.current!.muted=true;video.current!.srcObject=s;setLive(true);setAudio(s.getAudioTracks().length>0);s.getVideoTracks()[0].onended=()=>{stop().catch(e=>setError(e.message))}}catch(e){releaseAudio();s.getTracks().forEach(t=>t.stop());throw e}
 };
 const leave=()=>{if(secret&&epoch)navigator.sendBeacon("/api/room",new Blob([JSON.stringify({room,secret,action:"stop"})],{type:"application/json"}))};
 window.addEventListener("pagehide",leave);
 const poll=async()=>{
 try{
 const r=await api("poll",secret?{}:{quality:desiredQuality.current});if(dead)return;
 if(r.role==="viewer" || r.role==="host"){
  const nextGuest=r.role==="viewer"?(await api("join")).guest:"";
  if(dead)return;
  resetBroadcast();secret=r.role==="host"?r.secret:"";guest=nextGuest;
  if(secret)sessionStorage.setItem("host-"+room,secret);else sessionStorage.removeItem("host-"+room);
  setHost(!!secret);setMuted(false);levelRef.current=1;setVolume(100);setCandidates([]);setTransferOpen(false);
 }else if(secret){
 setCandidates(r.candidates||[]);
 const peers:Peer[]=r.peers;setMembers(peers.length+1);
 for(const [id,p] of pcs)if(!peers.some(g=>g.id===id)){p.close();pcs.delete(id)}
 const needsConnection=!!stream&&peers.some(g=>pcs.get(g.id)?.connectionState!=="connected");
 if(!needsConnection)waitingSince=0;
 else if(!waitingSince)waitingSince=Date.now();
 const needsRelay=needsConnection&&Date.now()-waitingSince>=10000;
 if(needsRelay!==relayNeeded){
   relayNeeded=needsRelay;
   if(needsRelay&&stream)record(stream,epoch);else resetRecording();
 }
 for(const g of peers){if(!stream)continue;
 if(!g.offer){const existing=pcs.get(g.id);if(existing?.connectionState==="connected")await setVideoQuality(existing,g.quality||"720p30");continue}
 const current=epoch;pcs.get(g.id)?.close();const pc=new RTCPeerConnection(ice);pcs.set(g.id,pc);
 await pc.setRemoteDescription({type:"offer",sdp:g.offer});for(const t of stream.getTracks())pc.addTrack(t,stream);
 await pc.setLocalDescription(await pc.createAnswer());const sdp=await description(pc);
 if(current===epoch&&!dead)await api("answer",{guest:g.id,epoch,sdp,offer:g.offer});
 }
 }else{
 if(epoch===r.epoch&&r.latest>lastPart&&!queued&&guestPc?.connectionState!=="connected"){
   const nextPart=fallback?Math.max(lastPart+1,r.latest-1):r.latest;
   const response=await fetch(mediaUrl(epoch,nextPart));
   if(response.ok){const data=await response.blob();
     if(!dead&&(guestPc?.connectionState as string)!=="connected"){
       queued={part:nextPart,url:URL.createObjectURL(data)};
       if(!fallback||player.ended)playQueued();
     }
   }
 }
 if(r.epoch!==epoch){
 epoch=r.epoch;clearQueue();fallback=false;lastPart=0;clear();video.current!.removeAttribute("src");syncReceiver();video.current!.load();if(blobUrl)URL.revokeObjectURL(blobUrl);blobUrl="";setLive(false);setAudio(false);
 if(epoch){const pc=new RTCPeerConnection(ice);guestPc=pc;
 pc.addTransceiver("video",{direction:"recvonly"});pc.addTransceiver("audio",{direction:"recvonly"});
 pc.ontrack=e=>{if(dead||guestPc!==pc)return;const media=e.streams[0];if(media&&!fallback){video.current!.srcObject=media;syncReceiver();setAudio(media.getAudioTracks().length>0)}};
 pc.onconnectionstatechange=()=>{if(dead||guestPc!==pc)return;if(pc.connectionState==="connected"){clearQueue();fallback=false;lastPart=0;const tracks=pc.getReceivers().map(r=>r.track).filter(Boolean);video.current!.srcObject=new MediaStream(tracks);syncReceiver();playViewer(video.current!);setLive(true)}else if(!fallback)setLive(false)};
 await pc.setLocalDescription(await pc.createOffer());await api("offer",{epoch,sdp:await description(pc)});
 }}
 else if(r.answer&&guestPc?.signalingState==="have-local-offer")await guestPc.setRemoteDescription({type:"answer",sdp:r.answer});
 }
 }catch(e){if(!dead)setError((e as Error).message)}
 if(!dead)timer=setTimeout(poll,1600);
 };
 (async()=>{
 room=new URLSearchParams(location.search).get("oda")||"";
 if(room)secret=sessionStorage.getItem("host-"+room)||"";
 const creating=!room;
 if(creating){const r=await api("create",{name:roomName});if(dead)return;room=r.room;secret=r.secret;sessionStorage.setItem("host-"+room,secret);history.replaceState(null,"","?oda="+room)}
 if(secret && (await api("poll")).role==="viewer"){secret="";sessionStorage.removeItem("host-"+room)}
 if(!secret){guest=(await api("join")).guest}else{await api("stop")}
 const profile=await api("profile",{name:username});if(dead)return;const title=profile.roomName||"Oda "+room.slice(0,8);
 credentials={id:profile.id,auth:profile.auth};
 setTitle(title);setIdentity({room,id:profile.id,auth:profile.auth});setHost(!!secret);setMembers(secret?1:2);setRoom(room);setJoined(true);actions.current={share,stop,transfer};poll();
 })().catch(e=>{if(!dead)setError(e.message)});
 return()=>{window.removeEventListener("pagehide",leave);dead=true;player.removeEventListener("ended",playQueued);clearQueue();resetRecording();if(blobUrl)URL.revokeObjectURL(blobUrl);clearTimeout(timer);releaseAudio();stream?.getTracks().forEach(t=>t.stop());clear();actions.current=null}
 },[username,roomName]);
 useEffect(()=>{
  const changed=()=>setNativeFull(document.fullscreenElement===screen.current);
  document.addEventListener("fullscreenchange",changed);
  return()=>document.removeEventListener("fullscreenchange",changed);
 },[]);
 useEffect(()=>{
  const el=video.current;if(host||!el)return;
  localMix.current=muted?0:(volume/100)*(talking ? 0.4 : 1);
  syncReceiver();
 },[host,volume,talking,muted]);
 function adjustVolume(value:number){
  const player=video.current;if(!player)return;
  if(value>0)lastVolume.current=value;
  levelRef.current=value/100;
  if(host){if(rawBroadcastAudio.current)rawBroadcastAudio.current.enabled=value>0;if(broadcastGain.current)broadcastGain.current.gain.value=value/100}
  else{localMix.current=value/100*(talking ? 0.4 : 1);player.muted=false;enableReceiver();if(value>0)player.play().catch(()=>{})}
  setVolume(value);setMuted(false);
 }
 function toggleSilence(){
  if(muted){adjustVolume(volume||lastVolume.current);return}
  levelRef.current=0;
  if(rawBroadcastAudio.current)rawBroadcastAudio.current.enabled=false;
  if(broadcastGain.current)broadcastGain.current.gain.value=0;
  setMuted(true);
 }
 async function toggle(){setError("");setBusy(true);try{if(live)await actions.current?.stop();else await actions.current?.share()}catch(e){setError((e as Error).name==="NotAllowedError"?"Paylaşım başlamadı. Tekrar deneyip paylaşmak istediğin kaynağı seç.":(e as Error).message)}finally{setBusy(false)}}
 async function copy(){try{await navigator.clipboard.writeText(invite.current!.value);setCopied(true);setTimeout(()=>setCopied(false),1800)}catch{invite.current?.select();setError("Bağlantıyı kopyalamak için Ctrl+C tuşlarına bas.")}}
 return <><header><div className="wrap nav"><div className="brand"><i><MonitorPlay/></i>BATUASLI<LoveNote/></div><button className="help" onClick={()=>setHelp(true)}><CircleHelp size={17}/> Nasıl çalışır?</button></div></header><main className={theater?"wrap theater":"wrap"}><div className="intro"><h1>{title}</h1></div><div className="grid"><div className="watch-column"><section className={"player"+(expanded?" expanded-player":"")+(hudHidden?" hud-hidden":"")} ref={screen}><div className={'scene '+(live?'active':'')}>{live&&<span className="screenlabel"><b className="on"/>Canlı</span>}<video ref={video} autoPlay playsInline muted={host||muted} onClick={()=>{if(!host&&live){enableReceiver();video.current?.play().catch(()=>{})}}}/>{live&&!host&&playBlocked&&<button className="primary" style={{position:"relative",zIndex:2}} onClick={()=>{enableReceiver();video.current?.play().then(()=>setPlayBlocked(false)).catch(()=>setError("Yayın oynatılamadı. Tekrar dokun."))}}><Play size={16}/>Yayını oynat</button>}{!live&&<div className="center"><div className="bigicon"><MonitorPlay size={36} strokeWidth={1.5}/></div>{!host&&<h2>Yayın bekleniyor</h2>}{host&&<button className="primary" onClick={toggle} disabled={!joined||busy}><ScreenShare size={18}/>{busy?"Kaynak seçiliyor…":"Yayını başlat"}</button>}</div>}</div><div className="bar"><div className="broadcast-volume"><button aria-label={muted?"Yayın sesini aç":"Yayını sessize al"} aria-pressed={muted} onClick={toggleSilence}>{muted||volume===0?<VolumeX size={18}/>:<Volume2 size={18}/>}</button>{!muted&&<label className="heart-volume" title={"Yayın sesi %"+(muted?0:volume)}><span className="volume-track" aria-hidden="true"><span style={{width:(muted?0:volume)+"%"}}/><b style={{left:(muted?0:volume)+"%"}}>♥</b></span><input type="range" min="0" max="100" step="1" aria-label="Yayın sesi" aria-valuetext={"Yüzde "+(muted?0:volume)} value={muted?0:volume} onInput={e=>adjustVolume(Number(e.currentTarget.value))}/><output aria-hidden="true">%{muted?0:volume}</output></label>}</div><div>{host&&joined&&<span className="quality-control"><button type="button" title="Yayını devret" aria-label="Yayını devret" aria-expanded={transferOpen} onClick={()=>setTransferOpen(!transferOpen)}><ScreenShare size={18}/></button>{transferOpen&&<fieldset className="transfer-menu"><legend>Yayını devret</legend>{candidates.length?candidates.map(person=><button key={person.id} disabled={busy} onClick={async()=>{setBusy(true);try{await actions.current?.transfer(person.id)}catch{setError("Yayın devredilemedi. Katılımcı listeden ayrılmış olabilir.")}finally{setBusy(false)}}}>{person.name}</button>):<span>Odada başka kimse yok.</span>}</fieldset>}</span>}{host&&live&&<button aria-label="Yayını durdur" title="Yayını durdur" onClick={toggle}><Square size={15}/></button>}{!nativeFull&&!expanded&&<button title="Sinema modu" aria-label="Sinema modu" aria-pressed={theater} onClick={()=>setTheater(!theater)}><Clapperboard size={18}/></button>}{!host&&<span className="quality-control"><button type="button" aria-label="Yayın kalitesi" aria-expanded={qualityOpen} title="Yayın kalitesi" onClick={()=>setQualityOpen(!qualityOpen)}><Settings size={18}/></button>{qualityOpen&&<fieldset onKeyDown={e=>{if(e.key==="Escape")setQualityOpen(false)}}><legend>Yayın kalitesi</legend>{qualities.map(q=><label key={q}><input type="radio" name="quality" checked={quality===q} onChange={()=>{desiredQuality.current=q;setQuality(q);setQualityOpen(false)}}/>{q.replace("p","p · ")} FPS</label>)}</fieldset>}</span>}<button aria-label="Tam ekran" onClick={()=>{if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});else if(expanded)setExpanded(false);else if(screen.current?.requestFullscreen)screen.current.requestFullscreen().catch(()=>setExpanded(true));else setExpanded(true)}}><Maximize size={17}/></button></div></div></section><section className="invite-strip" aria-label="Oda daveti"><Link2 size={19}/><input ref={invite} readOnly aria-label="Oda bağlantısı" value={room?location.origin+'/?oda='+room:"Oda hazırlanıyor…"}/><button className="copy" disabled={!room} onClick={copy}>{copied?<Check size={16}/>:<Copy size={16}/>} {copied?"Kopyalandı":"Bağlantıyı kopyala"}</button></section></div><aside>{identity&&<Voice onSpeaking={setTalking} identity={identity} fullscreenPlayer={nativeFull||expanded?screen.current:null} username={username}/>}</aside></div>{error&&<div className="notice" role="status">{error}<button aria-label="Kapat" onClick={()=>setError("")}><X size={16}/></button></div>}</main>{help&&<dialog open><div className="row"><h3>Nasıl çalışır?</h3><button aria-label="Kapat" onClick={()=>setHelp(false)}><X/></button></div><ol><li>Oda bağlantısını kopyalayıp arkadaşına gönder.</li><li>Yayını başlat ve paylaşmak istediğin ekranı seç.</li><li>Ses için Chrome veya Edge’de bir sekme seçip sekme sesini paylaşmayı aç.</li></ol><p>Korumalı içeriklerde görüntü siyah olabilir.</p></dialog>}</>
}
