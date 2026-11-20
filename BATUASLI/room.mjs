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
  if (b.action === "create") {
    const room2 = uid(), secret = uid();
    if (env.BUCKET) {
      const expired = await q("SELECT id FROM rooms WHERE touched<? LIMIT 12", now - 864e5).all();
      for (const old of expired.results) {
        const objects = await env.BUCKET.list({ prefix: old.id + "/" });
        if (objects.objects.length) await env.BUCKET.delete(objects.objects.map((x) => x.key));
        await q("DELETE FROM rooms WHERE id=?", old.id).run();
      }
    }
    await db.batch([q("DELETE FROM guests WHERE touched < ?", now - 3e5), q("INSERT INTO rooms VALUES(?,?,?,?)", room2, secret, "", now)]);
    return json({ room: room2, secret });
  }
  if (typeof b.room !== "string") return json({}, 400);
  const room = await q("SELECT * FROM rooms WHERE id=? AND touched>?", b.room, now - 864e5).first();
  if (!room) return json({}, 404);
  const host = b.secret === room.secret;
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
    const peers = await q("SELECT id, CASE WHEN epoch=? AND answer IS NULL THEN offer END AS offer FROM guests WHERE room=? AND touched>? ORDER BY touched DESC", room.epoch, room.id, now - 3e4).all();
    return json({ peers: peers.results });
  }
  if (typeof b.guest !== "string") return json({}, 403);
  const g = await q("SELECT * FROM guests WHERE id=? AND room=?", b.guest, room.id).first();
  if (!g) return json({}, 404);
  if (b.action === "poll") {
    await q("UPDATE guests SET touched=? WHERE id=?", now, b.guest).run();
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
