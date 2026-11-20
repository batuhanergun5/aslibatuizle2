"use client";
import Chat from "./Chat";
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
export default function Entrance(){
 const [draft,setDraft]=useState(""),[username,setUsername]=useState("");
 useEffect(()=>{try{setDraft(localStorage.getItem("batuasli-name")||"")}catch{}},[]);
 if(username)return <Room username={username}/>;
 return <main className="entrance"><form className="card entry" onSubmit={e=>{e.preventDefault();const name=draft.trim();if(!name)return;try{localStorage.setItem("batuasli-name",name)}catch{}setUsername(name)}}>
 <div className="eyebrow">BATUASLI</div><h1>Bizim film odamız</h1><label htmlFor="username">Kullanıcı adın</label>
 <input id="username" autoComplete="nickname" required maxLength={32} placeholder="Odada nasıl görünmek istersin?" value={draft} onChange={e=>setDraft(e.target.value)}/>
 <button className="primary" disabled={!draft.trim()} type="submit">Odaya gir</button></form></main>
}
function Room({username}:{username:string}){
 const [nativeFull,setNativeFull]=useState(false);

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
 if(!res.ok)throw Error(res.status===404?"Oda kapanmış veya davet bağlantısı geçersiz.":"Odaya bağlanılamadı. Bağlantını kontrol et.");
 return res.json()};
 const clear=()=>{pcs.forEach(p=>p.close());pcs.clear();guestPc?.close();guestPc=null;if(video.current)video.current.srcObject=null};
 const stop=async()=>{stream?.getTracks().forEach(t=>t.stop());stream=null;epoch="";relayNeeded=false;waitingSince=0;resetRecording();clear();setLive(false);setAudio(false);await api("stop")};
 const share=async()=>{
 if(!navigator.mediaDevices?.getDisplayMedia)throw Error("Ekran paylaşmak için siteyi masaüstü Chrome veya Edge ile aç.");
 const s=await navigator.mediaDevices.getDisplayMedia({video:{width:{ideal:1280,max:1280},height:{ideal:720,max:720},frameRate:{ideal:30,max:30}},audio:true});
 const track=s.getVideoTracks()[0];if("contentHint" in track)track.contentHint="motion";
 try{const result=await api("start");if(dead){s.getTracks().forEach(t=>t.stop());return}epoch=result.epoch;stream=s;part=0;waitingSince=0;video.current!.muted=true;video.current!.srcObject=s;setLive(true);setAudio(s.getAudioTracks().length>0);s.getVideoTracks()[0].onended=()=>{stop().catch(e=>setError(e.message))}}catch(e){s.getTracks().forEach(t=>t.stop());throw e}
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
 if(!room){const r=await api("create");if(dead)return;room=r.room;secret=r.secret;sessionStorage.setItem("host-"+room,secret);history.replaceState(null,"","?oda="+room)}
 if(!secret){guest=(await api("join")).guest}else{await api("stop")}
 const profile=await api("profile",{name:username});if(dead)return;setIdentity({room,id:profile.id,auth:profile.auth});setHost(!!secret);setMembers(secret?1:2);setRoom(room);setJoined(true);actions.current={share,stop};poll();
 })().catch(e=>{if(!dead)setError(e.message)});
 return()=>{window.removeEventListener("pagehide",leave);dead=true;player.removeEventListener("ended",playQueued);clearQueue();resetRecording();if(blobUrl)URL.revokeObjectURL(blobUrl);clearTimeout(timer);stream?.getTracks().forEach(t=>t.stop());clear();actions.current=null}
 },[username]);
 useEffect(()=>{
  const changed=()=>setNativeFull(document.fullscreenElement===screen.current);
  document.addEventListener("fullscreenchange",changed);
  return()=>document.removeEventListener("fullscreenchange",changed);
 },[]);
 function adjustVolume(value:number){
  const player=video.current;if(!player)return;
  player.volume=value/100;setVolume(value);setMuted(value===0);if(value>0)player.play().catch(()=>{});
 }
 async function toggle(){setError("");setBusy(true);try{if(live)await actions.current?.stop();else await actions.current?.share()}catch(e){setError((e as Error).name==="NotAllowedError"?"Paylaşım başlamadı. Tekrar deneyip paylaşmak istediğin kaynağı seç.":(e as Error).message)}finally{setBusy(false)}}
 async function copy(){try{await navigator.clipboard.writeText(invite.current!.value);setCopied(true);setTimeout(()=>setCopied(false),1800)}catch{invite.current?.select();setError("Bağlantıyı kopyalamak için Ctrl+C tuşlarına bas.")}}
 return <><header><div className="wrap nav"><div className="brand"><i><MonitorPlay/></i>BATUASLI<LoveNote/></div><button className="help" onClick={()=>setHelp(true)}><CircleHelp size={17}/> Nasıl çalışır?</button></div></header><main className="wrap"><div className="intro"><h1>Bizim film odamız</h1></div><div className="grid"><div className="watch-column"><section className={"player"+(expanded?" expanded-player":"")} ref={screen}><div className={'scene '+(live?'active':'')}>{live&&<span className="screenlabel"><b className="on"/>Canlı</span>}<video ref={video} autoPlay playsInline muted={host||muted} controls={!host&&live} controlsList="nofullscreen" onVolumeChange={e=>{if(!host){setVolume(Math.round(e.currentTarget.volume*100));setMuted(e.currentTarget.muted)}}}/>{!live&&<div className="center"><div className="bigicon"><MonitorPlay size={36} strokeWidth={1.5}/></div>{!host&&<h2>Yayın bekleniyor</h2>}{host&&<button className="primary" onClick={toggle} disabled={!joined||busy}><ScreenShare size={18}/>{busy?"Kaynak seçiliyor…":"Yayını başlat"}</button>}</div>}</div><div className="bar"><div>{host&&live&&<button aria-label="Yayını durdur" title="Yayını durdur" onClick={toggle}><Square size={15}/></button>}{host?<button aria-label="Ses durumu" onClick={()=>{if(host||!live)setError(live?(audio?"Sekme sesi paylaşılıyor.":"Bu yayında ses paylaşılmıyor."):"Yayın başladığında ses durumu burada görünür.");else{setMuted(!muted);video.current?.play().catch(()=>{})}}}>{audio&&!muted?<Volume2 size={18}/>:<VolumeX size={18}/>}</button>:<label className="heart-volume" title={"Yayın sesi %"+(muted?0:volume)}><span className="volume-track" aria-hidden="true"><span style={{width:(muted?0:volume)+"%"}}/><b style={{left:(muted?0:volume)+"%"}}>♥</b></span><input type="range" min="0" max="100" step="1" aria-label="Yayın sesi" aria-valuetext={"Yüzde "+(muted?0:volume)} value={muted?0:volume} onChange={e=>adjustVolume(Number(e.target.value))}/><output aria-hidden="true">%{muted?0:volume}</output></label>}<button aria-label="Tam ekran" onClick={()=>{if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});else if(expanded)setExpanded(false);else if(screen.current?.requestFullscreen)screen.current.requestFullscreen().catch(()=>setExpanded(true));else setExpanded(true)}}><Maximize size={17}/></button></div></div></section><section className="invite-strip" aria-label="Oda daveti"><Link2 size={19}/><input ref={invite} readOnly aria-label="Oda bağlantısı" value={room?location.origin+'/?oda='+room:"Oda hazırlanıyor…"}/><button className="copy" disabled={!room} onClick={copy}>{copied?<Check size={16}/>:<Copy size={16}/>} {copied?"Kopyalandı":"Bağlantıyı kopyala"}</button></section></div><aside>{identity&&<Chat identity={identity} toolbar={nativeFull||expanded?screen.current:null}/>}{identity&&<Voice identity={identity} fullscreenPlayer={nativeFull||expanded?screen.current:null} username={username}/>}</aside></div>{error&&<div className="notice" role="status">{error}<button aria-label="Kapat" onClick={()=>setError("")}><X size={16}/></button></div>}</main>{help&&<dialog open><div className="row"><h3>Nasıl çalışır?</h3><button aria-label="Kapat" onClick={()=>setHelp(false)}><X/></button></div><ol><li>Oda bağlantısını kopyalayıp arkadaşına gönder.</li><li>Yayını başlat ve paylaşmak istediğin ekranı seç.</li><li>Ses için Chrome veya Edge’de bir sekme seçip sekme sesini paylaşmayı aç.</li></ol><p>Korumalı içeriklerde görüntü siyah olabilir.</p></dialog>}</>
}
