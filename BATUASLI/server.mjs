import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {POST} from './room.mjs';
import {GET,PUT} from './media.mjs';
const assets=new Map([['/',['index.html','text/html; charset=utf-8']],['/style.css',['style.css','text/css']],['/app.js',['app.js','text/javascript']],['/alacakaranlik.webp',['alacakaranlik.webp','image/webp']]]);
const server=http.createServer(async(req,res)=>{
 try{
 const url=new URL(req.url,'http://localhost');
 if(assets.has(url.pathname)&&['GET','HEAD'].includes(req.method)){
 const [file,mime]=assets.get(url.pathname);
 const bytes=await readFile(new URL('./public/'+file,import.meta.url));
 res.writeHead(200,{'Content-Type':mime});return res.end(req.method==='HEAD'?undefined:bytes);
 }
 const method=req.method;
 const handler=url.pathname==='/api/room'&&method==='POST'?POST:url.pathname==='/api/media'?{PUT,GET}[method]:null;
 if(!handler){res.writeHead(404);return res.end()}
 const limit=url.pathname==='/api/media'?8000000:80000;
 const chunks=[];let size=0;
 for await(const chunk of req){size+=chunk.length;if(size>limit){res.writeHead(413);return res.end()}chunks.push(chunk)}
 const response=await handler(new Request(url,{headers:req.headers,method,body:method==='GET'?undefined:Buffer.concat(chunks)}));
 res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 }catch(error){console.error(error.message);if(!res.headersSent)res.writeHead(500);res.end()}
});
server.listen(Number(process.env.PORT||3000),process.env.BIND_HOST||'127.0.0.1');
