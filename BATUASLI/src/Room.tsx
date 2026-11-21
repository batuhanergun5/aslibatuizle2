"use client";
import Voice, {type Identity} from "./Voice";
import LoveNote from "./LoveNote";
import {useEffect,useRef,useState} from "react";
import { MonitorPlay, ScreenShare, Users, Link2, Copy, Monitor, Maximize, Volume2, VolumeX, Play, Square, CircleHelp, X, Radio, Check, Clapperboard, UserRound } from "lucide-react";
const ice={iceServers:[{urls:"stun:stun.l.google.com:19302"}]};
async function description(pc:RTCPeerConnection){
 if(pc.iceGatheringState!=="complete") await new Promise<void>(done=>{
 const finish=()=>{clearTimeout(timer);pc.removeEventListener("icegatheringstatechange",change);done()};
 const change=()=>{if(pc.iceGatheringState==="complete")finish()};
 const timer=setTimeout(finish,5000);pc.addEventListener("icegatheringstatechange",change);change();
 });
 return pc.localDescription!.sdp;
}
type Peer={id:string,offer:string|null};
function isAsli(name:string){
 const letters=name.normalize("NFKD").toLocaleLowerCase("tr").replace(/ı/g,"i").replace(/\p{M}/gu,"").replace(/[\s\p{P}\p{S}\uFE0F]/gu,"");
 return /^a+s+l+i+$/.test(letters);
}
export default function Entrance(){
 const [draft,setDraft]=useState(""),[username,setUsername]=useState("");
 const [welcome,setWelcome]=useState(""),[greeting,setGreeting]=useState(false);
 const [activeRooms,setActiveRooms]=useState<{id:string,name:string|null,members:number}[]>([]);
 const [listStatus,setListStatus]=useState("Odalar yükleniyor…");
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
  function hearts(event:MouseEvent){
   const target=event.target;
   if(!(target instanceof Element))return;
   const control=target.closest("button,.heart-volume,input[type=range]");
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
  document.addEventListener("click",hearts,true);return()=>document.removeEventListener("click",hearts,true)
 },[]);
 if(username)return <Room username={username}/>;
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
 {(invited||(!activeRooms.length&&!listStatus))&&<button className="primary" disabled={!draft.trim()} type="submit"><Play size={16}/>{invited?"Davetteki odaya gir":"Odaya gir"}</button>}
 <section className="recent-rooms"><h2>Aktif odalar</h2>
 {listStatus?<p role="status">{listStatus}</p>:activeRooms.length===0?<p>Şu anda aktif oda yok.</p>:activeRooms.map(r=><div key={r.id}><button type="submit" value={r.id} disabled={!draft.trim()}><Play size={15}/>{r.name||"Oda"} · {r.id.slice(0,6)} · {r.members} kişi · Katıl</button></div>)}
 </section>
 </form></main>
}
function Room({username}:{username:string}){
 const [nativeFull,setNativeFull]=useState(false);

 const [title,setTitle]=useState("Bizim film odamız"),[talking,setTalking]=useState(false);
 const [theater,setTheater]=useState(false);
 const broadcastGain=useRef<GainNode|null>(null);
 const levelRef=useRef(1);
 const lastVolume=useRef(100);
 const [volume,setVolume]=useState(100);
 const [expanded,setExpanded]=useState(false);
 useEffect(()=>{if(!expanded)return;const exit=(e:KeyboardEvent)=>{if(e.key==="Escape")setExpanded(false)};window.addEventListener("keydown",exit);return()=>window.removeEventListener("keydown",exit)},[expanded]);
 const [identity,setIdentity]=useState<Identity|null>(null);
 const [room,setRoom]=useState(""),[host,setHost]=useState(true),[live,setLive]=useState(false),[members,setMembers]=useState(1),[error,setError]=useState(""),[help,setHelp]=useState(false),[copied,setCopied]=useState(false),[busy,setBusy]=useState(false),[muted,setMuted]=useState(false),[audio,setAudio]=useState(false),[joined,setJoined]=useState(false);
 const video=useRef<HTMLVideoElement>(null),screen=useRef<HTMLDivElement>(null),invite=useRef<HTMLInputElement>(null),actions=useRef<{share:()=>Promise<void>,stop:()=>Promise<void>}|null>(null);
 useEffect(()=>{
 let dead=false,room="",secret="",guest="",epoch="",stream:MediaStream|null=null,guestPc:RTCPeerConnection|null=null,timer:ReturnType<typeof setTimeout>;
 let recorder:MediaRecorder|null=null, recordTimer:ReturnType<typeof setTimeout>, part=0, lastPart=0, blobUrl="",fallback=false;
 let relayNeeded=false, waitingSince=0, uploading=false;
 let queued:{url:string,part:number}|null=null;
 const clearQueue=()=>{if(queued)URL.revokeObjectURL(queued.url);queued=null};
 const playQueued=()=>{
   if(!queued||!video.current||guestPc?.connectionState==="connected")return;
   const v=video.current, old=blobUrl;
   blobUrl=queued.url;lastPart=queued.part;queued=null;fallback=true;
   v.srcObject=null;v.src=blobUrl;v.play().catch(()=>{});
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
 const api=async(action:string,more:Record<string,unknown>={})=>{
 const res=await fetch("/api/room",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,room,secret,guest,...more})});
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
  captureAudio?.stop();captureAudio=undefined;
  if(context)context.close().catch(()=>{});
  context=null;broadcastGain.current=null;
 }
 const stop=async()=>{releaseAudio();stream?.getTracks().forEach(t=>t.stop());stream=null;epoch="";relayNeeded=false;waitingSince=0;resetRecording();clear();setLive(false);setAudio(false);await api("stop")};
 const share=async()=>{
 if(!navigator.mediaDevices?.getDisplayMedia)throw Error("Ekran paylaşmak için siteyi masaüstü Chrome veya Edge ile aç.");
 const s=await navigator.mediaDevices.getDisplayMedia({video:{width:{ideal:1280,max:1280},height:{ideal:720,max:720},frameRate:{ideal:30,max:30}},audio:true});
 const track=s.getVideoTracks()[0];if("contentHint" in track)track.contentHint="motion";
 try{const result=await api("start");if(dead){s.getTracks().forEach(t=>t.stop());return}captureAudio=s.getAudioTracks()[0];
 if(captureAudio){
  context=new AudioContext();
  const source=context.createMediaStreamSource(new MediaStream([captureAudio]));
  const gain=context.createGain(),destination=context.createMediaStreamDestination();
  gain.gain.value=levelRef.current;source.connect(gain);gain.connect(destination);
  broadcastGain.current=gain;await context.resume();
  if(dead){releaseAudio();s.getTracks().forEach(t=>t.stop());return}
  s.removeTrack(captureAudio);s.addTrack(destination.stream.getAudioTracks()[0]);
 }
 epoch=result.epoch;stream=s;part=0;waitingSince=0;video.current!.muted=true;video.current!.srcObject=s;setLive(true);setAudio(s.getAudioTracks().length>0);s.getVideoTracks()[0].onended=()=>{stop().catch(e=>setError(e.message))}}catch(e){releaseAudio();s.getTracks().forEach(t=>t.stop());throw e}
 };
 const leave=()=>{if(secret&&epoch)navigator.sendBeacon("/api/room",new Blob([JSON.stringify({room,secret,action:"stop"})],{type:"application/json"}))};
 window.addEventListener("pagehide",leave);
 const poll=async()=>{
 try{
 const r=await api("poll");if(dead)return;
 if(secret){
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
 for(const g of peers){if(!g.offer||!stream)continue;
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
 epoch=r.epoch;clearQueue();fallback=false;lastPart=0;clear();video.current!.removeAttribute("src");video.current!.load();if(blobUrl)URL.revokeObjectURL(blobUrl);blobUrl="";setLive(false);setAudio(false);
 if(epoch){const pc=new RTCPeerConnection(ice);guestPc=pc;
 pc.addTransceiver("video",{direction:"recvonly"});pc.addTransceiver("audio",{direction:"recvonly"});
 pc.ontrack=e=>{if(dead||guestPc!==pc)return;const media=e.streams[0];if(media&&!fallback){video.current!.srcObject=media;setAudio(media.getAudioTracks().length>0)}};
 pc.onconnectionstatechange=()=>{if(dead||guestPc!==pc)return;if(pc.connectionState==="connected"){clearQueue();fallback=false;lastPart=0;const tracks=pc.getReceivers().map(r=>r.track).filter(Boolean);video.current!.srcObject=new MediaStream(tracks);setLive(true)}else if(!fallback)setLive(false)};
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
 if(creating){const r=await api("create");if(dead)return;room=r.room;secret=r.secret;sessionStorage.setItem("host-"+room,secret);history.replaceState(null,"","?oda="+room)}
 if(!secret){guest=(await api("join")).guest}else{await api("stop")}
 const profile=await api("profile",{name:username});if(dead)return;const title=profile.roomName||"Oda "+room.slice(0,8);
 setTitle(title);setIdentity({room,id:profile.id,auth:profile.auth});setHost(!!secret);setMembers(secret?1:2);setRoom(room);setJoined(true);actions.current={share,stop};poll();
 })().catch(e=>{if(!dead)setError(e.message)});
 return()=>{window.removeEventListener("pagehide",leave);dead=true;player.removeEventListener("ended",playQueued);clearQueue();resetRecording();if(blobUrl)URL.revokeObjectURL(blobUrl);clearTimeout(timer);releaseAudio();stream?.getTracks().forEach(t=>t.stop());clear();actions.current=null}
 },[username]);
 useEffect(()=>{
  const changed=()=>setNativeFull(document.fullscreenElement===screen.current);
  document.addEventListener("fullscreenchange",changed);
  return()=>document.removeEventListener("fullscreenchange",changed);
 },[]);
 useEffect(()=>{
  const el=video.current;if(host||!el)return;
  const target=(volume/100)*(talking?0.4:1);
  const initial=el.volume,start=performance.now(),duration=talking?180:650;
  let frame=0;
  function ramp(now:number){const progress=Math.min(1,(now-start)/duration);el!.volume=Math.min(1,Math.max(0,initial+(target-initial)*progress));if(progress<1)frame=requestAnimationFrame(ramp)}
  frame=requestAnimationFrame(ramp);return()=>cancelAnimationFrame(frame);
 },[host,volume,talking]);
 function adjustVolume(value:number){
  const player=video.current;if(!player)return;
  if(value>0)lastVolume.current=value;
  levelRef.current=value/100;
  if(host){if(broadcastGain.current)broadcastGain.current.gain.value=value/100}
  else{player.muted=false;if(value>0)player.play().catch(()=>{})}
  setVolume(value);setMuted(false);
 }
 function toggleSilence(){
  if(muted){adjustVolume(volume||lastVolume.current);return}
  levelRef.current=0;
  if(broadcastGain.current)broadcastGain.current.gain.value=0;
  setMuted(true);
 }
 async function toggle(){setError("");setBusy(true);try{if(live)await actions.current?.stop();else await actions.current?.share()}catch(e){setError((e as Error).name==="NotAllowedError"?"Paylaşım başlamadı. Tekrar deneyip paylaşmak istediğin kaynağı seç.":(e as Error).message)}finally{setBusy(false)}}
 async function copy(){try{await navigator.clipboard.writeText(invite.current!.value);setCopied(true);setTimeout(()=>setCopied(false),1800)}catch{invite.current?.select();setError("Bağlantıyı kopyalamak için Ctrl+C tuşlarına bas.")}}
 return <><header><div className="wrap nav"><div className="brand"><i><MonitorPlay/></i>BATUASLI<LoveNote/></div><button className="help" onClick={()=>setHelp(true)}><CircleHelp size={17}/> Nasıl çalışır?</button></div></header><main className={theater?"wrap theater":"wrap"}><div className="intro"><h1>{title}</h1></div><div className="grid"><div className="watch-column"><section className={"player"+(expanded?" expanded-player":"")} ref={screen}><div className={'scene '+(live?'active':'')}>{live&&<span className="screenlabel"><b className="on"/>Canlı</span>}<video ref={video} autoPlay playsInline muted={host||muted} onClick={()=>{if(!host&&live)video.current?.play().catch(()=>{})}}/>{!live&&<div className="center"><div className="bigicon"><MonitorPlay size={36} strokeWidth={1.5}/></div>{!host&&<h2>Yayın bekleniyor</h2>}{host&&<button className="primary" onClick={toggle} disabled={!joined||busy}><ScreenShare size={18}/>{busy?"Kaynak seçiliyor…":"Yayını başlat"}</button>}</div>}</div><div className="bar"><div className="broadcast-volume"><button aria-label={muted?"Yayın sesini aç":"Yayını sessize al"} aria-pressed={muted} onClick={toggleSilence}>{muted||volume===0?<VolumeX size={18}/>:<Volume2 size={18}/>}</button>{!muted&&<label className="heart-volume" title={"Yayın sesi %"+(muted?0:volume)}><span className="volume-track" aria-hidden="true"><span style={{width:(muted?0:volume)+"%"}}/><b style={{left:(muted?0:volume)+"%"}}>♥</b></span><input type="range" min="0" max="100" step="1" aria-label="Yayın sesi" aria-valuetext={"Yüzde "+(muted?0:volume)} value={muted?0:volume} onChange={e=>adjustVolume(Number(e.target.value))}/><output aria-hidden="true">%{muted?0:volume}</output></label>}</div><div>{host&&live&&<button aria-label="Yayını durdur" title="Yayını durdur" onClick={toggle}><Square size={15}/></button>}{!nativeFull&&!expanded&&<button title="Sinema modu" aria-label="Sinema modu" aria-pressed={theater} onClick={()=>setTheater(!theater)}><Clapperboard size={18}/></button>}<button aria-label="Tam ekran" onClick={()=>{if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});else if(expanded)setExpanded(false);else if(screen.current?.requestFullscreen)screen.current.requestFullscreen().catch(()=>setExpanded(true));else setExpanded(true)}}><Maximize size={17}/></button></div></div></section><section className="invite-strip" aria-label="Oda daveti"><Link2 size={19}/><input ref={invite} readOnly aria-label="Oda bağlantısı" value={room?location.origin+'/?oda='+room:"Oda hazırlanıyor…"}/><button className="copy" disabled={!room} onClick={copy}>{copied?<Check size={16}/>:<Copy size={16}/>} {copied?"Kopyalandı":"Bağlantıyı kopyala"}</button></section></div><aside>{identity&&<Voice onSpeaking={setTalking} identity={identity} fullscreenPlayer={nativeFull||expanded?screen.current:null} username={username}/>}</aside></div>{error&&<div className="notice" role="status">{error}<button aria-label="Kapat" onClick={()=>setError("")}><X size={16}/></button></div>}</main>{help&&<dialog open><div className="row"><h3>Nasıl çalışır?</h3><button aria-label="Kapat" onClick={()=>setHelp(false)}><X/></button></div><ol><li>Oda bağlantısını kopyalayıp arkadaşına gönder.</li><li>Yayını başlat ve paylaşmak istediğin ekranı seç.</li><li>Ses için Chrome veya Edge’de bir sekme seçip sekme sesini paylaşmayı aç.</li></ol><p>Korumalı içeriklerde görüntü siyah olabilir.</p></dialog>}</>
}
