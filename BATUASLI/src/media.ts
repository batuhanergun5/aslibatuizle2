import {env} from "../storage.mjs";
async function segment(req:Request,write:boolean){
 const u=new URL(req.url),room=u.searchParams.get("room"),epoch=u.searchParams.get("epoch"),part=u.searchParams.get("part");
 if(!room||!epoch||!part||!/^\d{1,13}$/.test(part))return new Response(null,{status:400});
 const row=await env.DB!.prepare("SELECT secret,epoch FROM rooms WHERE id=?").bind(room).first<{secret:string,epoch:string}>();
 if(!row||row.epoch!==epoch)return new Response(null,{status:404});
 const key=room+"/"+epoch+"/"+part;
 if(write){
 if(req.headers.get("authorization")!==("Bearer "+row.secret))return new Response(null,{status:403});
 const data=await req.arrayBuffer();if(data.byteLength>8000000)return new Response(null,{status:413});
 await env.BUCKET!.put(key,data);
 await env.BUCKET!.delete(room+"/"+epoch+"/"+(Number(part)-3));
 return new Response(null,{status:204});
 }
 const media=await env.BUCKET!.get(key);
 return new Response(media?.body||null,{status:media?200:404,headers:{"content-type":"video/webm","cache-control":"no-store"}});
}
export const PUT=(req:Request)=>segment(req,true);
export const GET=(req:Request)=>segment(req,false);
