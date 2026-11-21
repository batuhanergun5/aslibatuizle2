import { DatabaseSync } from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {join} from 'node:path';
const data=process.env.DATA_DIR || './data';
mkdirSync(data,{recursive:true});
const db=new DatabaseSync(join(data,'rooms.sqlite'));
db.exec(`PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS rooms(id TEXT PRIMARY KEY,secret TEXT NOT NULL,epoch TEXT NOT NULL,touched INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS guests(id TEXT PRIMARY KEY,room TEXT NOT NULL,touched INTEGER NOT NULL,epoch TEXT NOT NULL,offer TEXT,answer TEXT);
CREATE INDEX IF NOT EXISTS guests_room ON guests(room);
CREATE TABLE IF NOT EXISTS segments(key TEXT PRIMARY KEY,bytes BLOB NOT NULL,updated INTEGER NOT NULL);`);
db.exec('CREATE TABLE IF NOT EXISTS calls (\n\tid text PRIMARY KEY NOT NULL,\n\troom text NOT NULL,\n\tsender text NOT NULL,\n\treceiver text NOT NULL,\n\toffer text NOT NULL,\n\tanswer text,\n\tseen integer NOT NULL\n);\n\nCREATE TABLE IF NOT EXISTS participants (\n\tid text PRIMARY KEY NOT NULL,\n\troom text NOT NULL,\n\tauth text NOT NULL,\n\tname text NOT NULL,\n\thost integer NOT NULL,\n\tmic integer NOT NULL,\n\tseen integer NOT NULL\n);\n');
db.exec("CREATE TABLE IF NOT EXISTS messages(id TEXT PRIMARY KEY,room TEXT NOT NULL,sender TEXT NOT NULL,name TEXT NOT NULL,body TEXT NOT NULL,created INTEGER NOT NULL)");
if(!db.prepare("PRAGMA table_info(participants)").all().some(column=>column.name==="camera")){
 db.exec("ALTER TABLE participants ADD COLUMN camera INTEGER NOT NULL DEFAULT 0");
}
if(!db.prepare("PRAGMA table_info(rooms)").all().some(column=>column.name==="name")){
 db.exec("ALTER TABLE rooms ADD COLUMN name TEXT NOT NULL DEFAULT ''");
}
function prepare(sql){
 const statement=db.prepare(sql);
 return {bind:(...args)=>({
 first:()=>statement.get(...args), all:()=>({results:statement.all(...args)}),run:()=>statement.run(...args)
 })};
}
const drop=db.prepare("DELETE FROM segments WHERE key=?");
const bucket={
 put(key,data){db.prepare("INSERT OR REPLACE INTO segments VALUES(?,?,?)").run(key,new Uint8Array(data),Date.now())},
 get(key){const row=db.prepare("SELECT bytes FROM segments WHERE key=?").get(key);return row?{body:row.bytes}:null},
 list({prefix}){return {objects:db.prepare("SELECT key FROM segments WHERE key GLOB ?").all(prefix+"*")}},
 delete(keys){for(const key of [].concat(keys))drop.run(key)}
};
const cleanup=()=>db.prepare("DELETE FROM segments WHERE updated<?").run(Date.now()-600000);
cleanup();setInterval(cleanup,60000).unref();
export const env={DB:{prepare,batch(statements){
 db.exec("BEGIN");
 try{for(const s of statements)s.run();db.exec("COMMIT")}catch(e){db.exec("ROLLBACK");throw e}
}},BUCKET:bucket};
