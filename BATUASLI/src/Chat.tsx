"use client";
import {useEffect,useRef,useState} from "react";
import {createPortal} from "react-dom";
import {MessageCircle,Send,Smile,X} from "lucide-react";
import type {Identity} from "./Voice";
type Message={id:string,sender:string,name:string,body:string};
const emojis=["❤️","😂","😍","🍿","🎬","🥹","😘","👏","🔥","😮","🙈","💖"];
export default function Chat({identity,toolbar}:{identity:Identity,toolbar:HTMLElement|null}){
 const [open,setOpen]=useState(false),[palette,setPalette]=useState(false),[draft,setDraft]=useState(""),[messages,setMessages]=useState<Message[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const input=useRef<HTMLInputElement>(null),list=useRef<HTMLDivElement>(null),retry=useRef({body:"",key:""});
 const follow=useRef(true),refresh=useRef<()=>void>(()=>{});
 async function request(action:string,params:Record<string,string>={}){
  const response=await fetch("/api/room",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...identity,action,...params})});
  if(!response.ok)throw Error();return response.json();
 }
 useEffect(()=>{
  if(toolbar&&!open)return;
  let done=false,timer:ReturnType<typeof setTimeout>,loading=false;
  const poll=async()=>{if(done||loading)return;loading=true;clearTimeout(timer);
   try{const data=await request("chat");if(!done)setMessages(data.messages)}
   catch{if(!done)setError("Mesajlar alınamadı. Bağlantı yeniden deneniyor.")}
   finally{loading=false;if(!done)timer=setTimeout(poll,1000)}
  };
  follow.current=true;refresh.current=poll;poll();return()=>{done=true;clearTimeout(timer);refresh.current=()=>{}};
 },[open,toolbar,identity]);
 const last=messages.at(-1)?.id;
 useEffect(()=>{if((!toolbar||open)&&follow.current&&list.current)list.current.scrollTop=list.current.scrollHeight},[last,open,toolbar]);
 async function send(e:React.FormEvent){
  e.preventDefault();const body=draft.trim();if(!body||busy)return;
  if(retry.current.body!==body)retry.current={body,key:crypto.randomUUID()};
  setBusy(true);setError("");
  try{await request("send",retry.current);retry.current={body:"",key:""};setDraft("");setPalette(false);follow.current=true;refresh.current()}
  catch{setError("Mesaj gönderilemedi. Tekrar deneyebilirsin.")}finally{setBusy(false)}
 }
 const content=<>{toolbar&&<button type="button" className="chat-trigger" aria-label="Oda sohbeti" aria-expanded={open} onClick={()=>setOpen(!open)}><MessageCircle size={18}/><span>Sohbet</span></button>}
 {(!toolbar||open)&&<section className={toolbar?"chat-panel":"chat-panel docked-chat"} aria-label="Oda sohbeti"><header><strong>Oda sohbeti</strong>{toolbar&&<button aria-label="Sohbeti kapat" onClick={()=>setOpen(false)}><X size={17}/></button>}</header>
 <div className="chat-log" ref={list} role="log" onScroll={e=>{const el=e.currentTarget;follow.current=el.scrollHeight-el.scrollTop-el.clientHeight<40}}>
 {messages.length===0?<small>İlk mesajı sen yaz.</small>:messages.map(m=><div key={m.id} className={m.sender===identity.id?"mine":""}><strong>{m.name}</strong><p>{m.body}</p></div>)}</div>
 {error&&<small role="status">{error}</small>}
 {palette&&<div className="emoji-picker">{emojis.map(emoji=><button key={emoji} disabled={busy} onClick={()=>{const el=input.current,a=el?.selectionStart??draft.length,b=el?.selectionEnd??a;const value=draft.slice(0,a)+emoji+draft.slice(b);if(value.length<=1000){setDraft(value);requestAnimationFrame(()=>{el?.focus();el?.setSelectionRange(a+emoji.length,a+emoji.length)})}}}>{emoji}</button>)}</div>}
 <form onSubmit={send}><button type="button" aria-label="Emojiler" aria-expanded={palette} onClick={()=>setPalette(!palette)}><Smile size={19}/></button><input ref={input} aria-label="Mesaj" placeholder="Mesaj yaz…" maxLength={1000} disabled={busy} value={draft} onChange={e=>setDraft(e.target.value)}/><button aria-label="Gönder" disabled={busy||!draft.trim()}><Send size={18}/></button></form></section>}</>;
 return toolbar?createPortal(content,toolbar):content;
}
