"use client";
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
export default function Room(){
 const [room,setRoom]=useState(""),[host,setHost]=useState(true),[live,setLive]=useState(false),[members,setMembers]=useState(1),[error,setError]=useState(""),[help,setHelp]=useState(false),[copied,setCopied]=useState(false),[busy,setBusy]=useState(false),[muted,setMuted]=useState(false),[audio,setAudio]=useState(false),[joined,setJoined]=useState(false);
 const video=useRef<HTMLVideoElement>(null),screen=useRef<HTMLDivElement>(null),invite=useRef<HTMLInputElement>(null),actions=useRef<{share:()=>Promise<void>,stop:()=>Promise<void>}|null>(null);
 useEffect(()=>{
 let dead=false,room="",secret="",guest="",epoch="",stream:MediaStream|null=null,guestPc:RTCPeerConnection|null=null,timer:ReturnType<typeof setTimeout>;
 let recorder:MediaRecorder|null=null, recordTimer:ReturnType<typeof setTimeout>, part=0, lastPart=0, blobUrl="",fallback=false;
 const mediaUrl=(key:string,n:number)=>"/api/media?"+new URLSearchParams({room,epoch:key,part:String(n)});
 const record=(s:MediaStream,key:string)=>{
 if(typeof MediaRecorder==="undefined"||dead||stream!==s||epoch!==key)return;
 const mime=["video/webm;codecs=vp8,opus","video/webm"].find(t=>MediaRecorder.isTypeSupported(t));if(!mime)return;
 const rec=new MediaRecorder(s,{mimeType:mime,videoBitsPerSecond:1200000});recorder=rec;
 rec.ondataavailable=async ev=>{
 if(dead||stream!==s||epoch!==key||!ev.data.size)return;
 try{const res=await fetch(mediaUrl(key,++part),{method:"PUT",headers:{Authorization:"Bearer "+secret},body:ev.data});if(!res.ok)throw Error()}catch{if(!dead)setError("Yedek yayın sunucusuna ulaşılamadı.")}
 };
 rec.onstop=()=>{if(stream===s&&epoch===key&&!dead)record(s,key)};
 rec.start();recordTimer=setTimeout(()=>{if(rec.state==="recording")rec.stop()},3600);
 };
 const resetRecording=()=>{clearTimeout(recordTimer);if(recorder?.state==="recording")recorder.stop();recorder=null};
 const pcs=new Map<string,RTCPeerConnection>();
 const api=async(action:string,more:Record<string,unknown>={})=>{
 const res=await fetch("/api/room",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,room,secret,guest,...more})});
 if(!res.ok)throw Error(res.status===404?"Oda kapanmış veya davet bağlantısı geçersiz.":"Odaya bağlanılamadı. Bağlantını kontrol et.");
 return res.json()};
 const clear=()=>{pcs.forEach(p=>p.close());pcs.clear();guestPc?.close();guestPc=null;if(video.current)video.current.srcObject=null};
 const stop=async()=>{stream?.getTracks().forEach(t=>t.stop());stream=null;epoch="";resetRecording();clear();setLive(false);setAudio(false);await api("stop")};
 const share=async()=>{
 if(!navigator.mediaDevices?.getDisplayMedia)throw Error("Ekran paylaşmak için siteyi masaüstü Chrome veya Edge ile aç.");
 const s=await navigator.mediaDevices.getDisplayMedia({video:true,audio:true});
 try{const result=await api("start");if(dead){s.getTracks().forEach(t=>t.stop());return}epoch=result.epoch;stream=s;part=0;record(s,epoch);video.current!.muted=true;video.current!.srcObject=s;setLive(true);setAudio(s.getAudioTracks().length>0);s.getVideoTracks()[0].onended=()=>{stop().catch(e=>setError(e.message))}}catch(e){s.getTracks().forEach(t=>t.stop());throw e}
 };
 const leave=()=>{if(secret&&epoch)navigator.sendBeacon("/api/room",new Blob([JSON.stringify({room,secret,action:"stop"})],{type:"application/json"}))};
 window.addEventListener("pagehide",leave);
 const poll=async()=>{
 try{
 const r=await api("poll");if(dead)return;
 if(secret){
 const peers:Peer[]=r.peers;setMembers(peers.length+1);
 for(const [id,p] of pcs)if(!peers.some(g=>g.id===id)){p.close();pcs.delete(id)}
 for(const g of peers){if(!g.offer||!stream)continue;
 const current=epoch;pcs.get(g.id)?.close();const pc=new RTCPeerConnection(ice);pcs.set(g.id,pc);
 await pc.setRemoteDescription({type:"offer",sdp:g.offer});for(const t of stream.getTracks())pc.addTrack(t,stream);
 await pc.setLocalDescription(await pc.createAnswer());const sdp=await description(pc);
 if(current===epoch&&!dead)await api("answer",{guest:g.id,epoch,sdp,offer:g.offer});
 }
 }else{
 if(epoch===r.epoch&&r.latest>lastPart&&guestPc?.connectionState!=="connected"&&(!fallback||video.current!.ended||video.current!.paused)){
 const response=await fetch(mediaUrl(epoch,r.latest));if(response.ok&&!dead){const data=await response.blob();if(dead)return;const v=video.current!;v.srcObject=null;const old=blobUrl;blobUrl=URL.createObjectURL(data);v.src=blobUrl;v.play().catch(()=>{});if(old)URL.revokeObjectURL(old);fallback=true;lastPart=r.latest;setLive(true);setAudio(true)}
 }
 if(r.epoch!==epoch){
 epoch=r.epoch;fallback=false;lastPart=0;clear();video.current!.removeAttribute("src");video.current!.load();if(blobUrl)URL.revokeObjectURL(blobUrl);blobUrl="";setLive(false);setAudio(false);
 if(epoch){const pc=new RTCPeerConnection(ice);guestPc=pc;
 pc.addTransceiver("video",{direction:"recvonly"});pc.addTransceiver("audio",{direction:"recvonly"});
 pc.ontrack=e=>{if(dead||guestPc!==pc)return;const media=e.streams[0];if(media&&!fallback){video.current!.srcObject=media;setAudio(media.getAudioTracks().length>0)}};
 pc.onconnectionstatechange=()=>{if(dead||guestPc!==pc)return;if(pc.connectionState==="connected"){fallback=false;const tracks=pc.getReceivers().map(r=>r.track).filter(Boolean);video.current!.srcObject=new MediaStream(tracks);setLive(true)}else if(!fallback)setLive(false)};
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
 if(dead)return;setHost(!!secret);setMembers(secret?1:2);setRoom(room);setJoined(true);actions.current={share,stop};poll();
 })().catch(e=>{if(!dead)setError(e.message)});
 return()=>{window.removeEventListener("pagehide",leave);dead=true;resetRecording();if(blobUrl)URL.revokeObjectURL(blobUrl);clearTimeout(timer);stream?.getTracks().forEach(t=>t.stop());clear();actions.current=null}
 },[]);
 async function toggle(){setError("");setBusy(true);try{if(live)await actions.current?.stop();else await actions.current?.share()}catch(e){setError((e as Error).name==="NotAllowedError"?"Paylaşım başlamadı. Tekrar deneyip paylaşmak istediğin kaynağı seç.":(e as Error).message)}finally{setBusy(false)}}
 async function copy(){try{await navigator.clipboard.writeText(invite.current!.value);setCopied(true);setTimeout(()=>setCopied(false),1800)}catch{invite.current?.select();setError("Bağlantıyı kopyalamak için Ctrl+C tuşlarına bas.")}}
 return <><header><div className="wrap nav"><div className="brand"><i><MonitorPlay/></i>BATUASLI<LoveNote/></div><button className="help" onClick={()=>setHelp(true)}><CircleHelp size={17}/> Nasıl çalışır?</button></div></header><main className="wrap"><div className="intro"><div className="eyebrow"><b/> BATU & ASLI</div><h1>Bizim film odamız</h1><p>{host?"Birimize filmi seçmek, diğerimize “hazırım” demek düşüyor.":"Arkadaşının paylaştığı yayını buradan izleyebilirsin."}</p></div><div className="grid"><section className="player" ref={screen}><div className={'scene '+(live?'active':'')}><span className="screenlabel"><b className={live?'on':''}/>{live?"Canlı yayın":"Yayın bekleniyor"}</span><video ref={video} autoPlay playsInline muted={host||muted} controls={!host&&live}/>{!live&&<div className="center"><div className="bigicon"><MonitorPlay size={36} strokeWidth={1.5}/></div><h2>{host?"Bu akşam ikimiz.":"Yayın bekleniyor"}</h2><p>{host?"Bir sekme, pencere veya ekran seçerek başla.":"Yayın başladığında görüntü burada açılacak."}</p>{host&&<button className="primary" onClick={toggle} disabled={!joined||busy}><ScreenShare size={18}/>{busy?"Kaynak seçiliyor…":"Yayını başlat"}</button>}</div>}</div><div className="bar"><span className="barleft"><Monitor size={18}/> Ekran yayını</span><div>{host&&live&&<button onClick={toggle}><Square size={15}/> Durdur</button>}<button aria-label="Ses durumu" onClick={()=>{if(host||!live)setError(live?(audio?"Sekme sesi paylaşılıyor.":"Bu yayında ses paylaşılmıyor."):"Yayın başladığında ses durumu burada görünür.");else{setMuted(!muted);video.current?.play().catch(()=>{})}}}>{audio&&!muted?<Volume2 size={18}/>:<VolumeX size={18}/>}</button><button aria-label="Tam ekran" onClick={()=>{if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});else screen.current?.requestFullscreen().catch(()=>setError("Bu tarayıcıda tam ekran açılamadı."))}}><Maximize size={17}/></button></div></div></section><aside><section className="card"><div className="cardicon"><Link2/></div><h3>Birlikte izleyelim</h3><p>Oda bağlantısını paylaş, aynı ekranda buluşun.</p><input ref={invite} readOnly aria-label="Oda bağlantısı" value={room?location.origin+'/?oda='+room:"Oda hazırlanıyor…"}/><button className="copy" disabled={!room} onClick={copy}>{copied?<Check size={16}/>:<Copy size={16}/>} {copied?"Kopyalandı":"Bağlantıyı kopyala"}</button></section><section className="card people"><div className="row"><h3>Odadakiler</h3><span><Users size={14}/> {members}</span></div><div className="person"><i><UserRound size={19}/></i><div><strong>{host?"Sen":"Oda sahibi"}</strong><small>Yayıncı</small></div><b/></div>{members>1&&<div className="person"><i><Users size={18}/></i><div><strong>{host?(members===2?"Misafir":(members-1)+" misafir"):"Sen"}</strong><small>İzleyici</small></div></div>}</section></aside></div>{error&&<div className="notice" role="status">{error}<button aria-label="Kapat" onClick={()=>setError("")}><X size={16}/></button></div>}</main>{help&&<dialog open><div className="row"><h3>Nasıl çalışır?</h3><button aria-label="Kapat" onClick={()=>setHelp(false)}><X/></button></div><ol><li>Oda bağlantısını kopyalayıp arkadaşına gönder.</li><li>Yayını başlat ve paylaşmak istediğin ekranı seç.</li><li>Ses için Chrome veya Edge’de bir sekme seçip sekme sesini paylaşmayı aç.</li></ol><p>Korumalı içeriklerde görüntü siyah olabilir.</p></dialog>}</>
}
