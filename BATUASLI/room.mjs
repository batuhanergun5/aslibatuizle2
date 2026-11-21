import { env } from "./storage.mjs";
async function POST(req) {
  const db = env.DB;
  const json = (v, status = 200) => Response.json(v, { status, headers: { "cache-control": "no-store" } });
  if (req.headers.get("origin") && req.headers.get("origin") !== new URL(req.url).origin && new URL(req.headers.get("origin")).host !== req.headers.get("host")) return json({}, 403);
  const raw = await req.text();
  if (raw.length > 8e4) return json({}, 413);
  let b;
  try {
    b = JSON.parse(raw);
  } catch {
    return json({}, 400);
  }
  if (!b || typeof b !== "object") return json({}, 400);
  const now = Date.now(), uid = () => crypto.randomUUID(), q = (sql, ...args) => db.prepare(sql).bind(...args);
  if (b.action === "activeRooms") {
    const rows = await q(`SELECT r.id, COALESCE(NULLIF(r.name,''),MAX(CASE WHEN p.host=1 THEN p.name END)) AS name,
    COUNT(*) AS members FROM participants p JOIN rooms r ON r.id=p.room
    WHERE p.seen>? GROUP BY r.id ORDER BY MAX(p.seen) DESC LIMIT 100`, now - 3e4).all();
    return json({ rooms: rows.results });
  }
  if (b.action === "create") {
    const room2 = uid(), secret = uid();
    await db.batch([q("DELETE FROM guests WHERE touched < ?", now - 3e5), q("INSERT INTO rooms(id,secret,epoch,touched,name) VALUES(?,?,?,?,?)", room2, secret, "", now, typeof b.name === "string" ? b.name.trim().slice(0, 48) : "")]);
    return json({ room: room2, secret });
  }
  if (typeof b.room !== "string") return json({}, 400);
  const room = await q("SELECT * FROM rooms WHERE id=?", b.room).first();
  if (!room) return json({}, 404);
  const host = b.secret === room.secret;
  if (b.action === "profile") {
    const name = typeof b.name === "string" ? b.name.trim() : "";
    if (!name || name.length > 32) return json({}, 400);
    if (!host && (typeof b.guest !== "string" || !await q("SELECT id FROM guests WHERE room=? AND id=?", room.id, b.guest).first())) return json({}, 403);
    const id = uid(), auth = uid();
    await db.batch([q("DELETE FROM participants WHERE seen<?", now - 864e5), q("DELETE FROM calls WHERE seen<?", now - 864e5), q("INSERT INTO participants(id,room,auth,name,host,mic,seen) VALUES(?,?,?,?,?,0,?)", id, room.id, auth, name, host ? 1 : 0, now)]);
    return json({ id, auth, roomName: room.name });
  }
  if (["voice", "call", "reply", "depart", "chat", "send"].includes(b.action)) {
    if (typeof b.id !== "string" || typeof b.auth !== "string") return json({}, 403);
    const person = await q("SELECT name FROM participants WHERE id=? AND auth=? AND room=?", b.id, b.auth, room.id).first();
    if (!person) return json({}, 403);
    if (b.action === "send") {
      const body = typeof b.body === "string" ? b.body.trim() : "";
      if (!body || body.length > 1e3 || typeof b.key !== "string" || !/^[a-f0-9-]{36}$/.test(b.key)) return json({}, 400);
      await q("INSERT OR IGNORE INTO messages(id,room,sender,name,body,created) VALUES(?,?,?,?,?,?)", b.id + "." + b.key, room.id, b.id, person.name, body, now).run();
      return json({});
    }
    if (b.action === "chat") {
      const rows = await q("SELECT id,sender,name,body FROM messages WHERE room=? ORDER BY created DESC,rowid DESC LIMIT 80", room.id).all();
      return json({ messages: rows.results.reverse() });
    }
    if (b.action === "depart") {
      await q("DELETE FROM participants WHERE id=?", b.id).run();
      return json({});
    }
    if (b.action === "voice") {
      await q("UPDATE participants SET seen=?,mic=?,camera=? WHERE id=?", now, b.mic === true ? 1 : 0, b.camera === true ? 1 : 0, b.id).run();
      const roster = await q("SELECT id,name,host,mic,camera FROM participants WHERE room=? AND seen>? ORDER BY host DESC,name,id", room.id, now - 3e4).all();
      const calls = await q("SELECT id,sender,receiver,offer,answer FROM calls WHERE room=? AND (sender=? OR receiver=?) AND seen>?", room.id, b.id, b.id, now - 12e4).all();
      return json({ roster: roster.results, calls: calls.results });
    }
    if (typeof b.target !== "string" || typeof b.sdp !== "string" || b.sdp.length > 6e4) return json({}, 400);
    if (!await q("SELECT id FROM participants WHERE id=? AND room=? AND seen>?", b.target, room.id, now - 3e4).first()) return json({}, 404);
    if (b.action === "call" && b.id < b.target) {
      const id = uid();
      await db.batch([q("DELETE FROM calls WHERE room=? AND sender=? AND receiver=?", room.id, b.id, b.target), q("INSERT INTO calls(id,room,sender,receiver,offer,seen) VALUES(?,?,?,?,?,?)", id, room.id, b.id, b.target, b.sdp, now)]);
      return json({ id });
    }
    if (b.action === "reply" && typeof b.call === "string") {
      await q("UPDATE calls SET answer=? WHERE id=? AND room=? AND receiver=? AND sender=?", b.sdp, b.call, room.id, b.id, b.target).run();
      return json({});
    }
    return json({}, 400);
  }
  if (["start", "stop", "answer"].includes(b.action) && !host) return json({}, 403);
  if (b.action === "start" || b.action === "stop") {
    if (room.epoch && env.BUCKET) {
      const old = await env.BUCKET.list({ prefix: room.id + "/" + room.epoch + "/" });
      if (old.objects.length) await env.BUCKET.delete(old.objects.map((x) => x.key));
    }
    const epoch = b.action === "start" ? uid() : "";
    await q("UPDATE rooms SET epoch=?,touched=? WHERE id=?", epoch, now, room.id).run();
    return json({ epoch });
  }
  if (b.action === "join") {
    const guest = uid();
    await q("INSERT INTO guests (id,room,touched,epoch) VALUES(?,?,?,?)", guest, room.id, now, "").run();
    return json({ guest });
  }
  if (b.action === "poll" && host) {
    await q("UPDATE rooms SET touched=? WHERE id=?", now, room.id).run();
    const peers = await q("SELECT id, quality, CASE WHEN epoch=? AND answer IS NULL THEN offer END AS offer FROM guests WHERE room=? AND touched>? ORDER BY touched DESC", room.epoch, room.id, now - 3e4).all();
    return json({ peers: peers.results });
  }
  if (typeof b.guest !== "string") return json({}, 403);
  const g = await q("SELECT * FROM guests WHERE id=? AND room=?", b.guest, room.id).first();
  if (!g) return json({}, 404);
  if (b.action === "poll") {
    const quality = ["720p30", "720p60", "1080p30", "1080p60"].includes(b.quality) ? b.quality : "720p30";
    await q("UPDATE guests SET touched=?,quality=? WHERE id=?", now, quality, b.guest).run();
    const epoch = room.touched > now - 3e4 ? room.epoch : "";
    const segments = epoch && env.BUCKET ? await env.BUCKET.list({ prefix: room.id + "/" + epoch + "/" }) : null;
    const latest = segments?.objects.reduce((n, x) => Math.max(n, Number(x.key.split("/").pop())), 0) || 0;
    return json({ epoch, latest, answer: g.epoch === epoch ? g.answer : null });
  }
  if (!room.epoch || b.epoch !== room.epoch) return json({}, 409);
  if (b.action === "offer" && typeof b.sdp === "string") await q("UPDATE guests SET epoch=?,offer=?,answer=NULL,touched=? WHERE id=?", room.epoch, b.sdp, now, b.guest).run();
  else if (b.action === "answer" && typeof b.sdp === "string") await q("UPDATE guests SET answer=? WHERE id=? AND epoch=? AND offer=?", b.sdp, b.guest, room.epoch, b.offer).run();
  else return json({}, 400);
  return json({});
}
export {
  POST
};
