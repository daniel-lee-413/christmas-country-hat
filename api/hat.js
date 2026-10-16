// Single API endpoint: GET /api/hat?id=...  and  POST /api/hat { action, ... }
import { Redis } from "@upstash/redis";
import { randomUUID } from "node:crypto";
import * as game from "./_game.js";

const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});
const KEY = "hat:state";
const LOCK = "hat:lock";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function load() {
  return (await redis.get(KEY)) || game.empty();
}

// Simple lock so two people clicking at once can't clash.
async function withLock(fn) {
  const token = randomUUID();
  for (let i = 0; i < 30; i++) {
    if (await redis.set(LOCK, token, { nx: true, px: 5000 })) {
      try {
        const s = await load();
        const out = fn(s);
        await redis.set(KEY, s);
        return out;
      } finally {
        if ((await redis.get(LOCK)) === token) await redis.del(LOCK);
      }
    }
    await sleep(150);
  }
  throw new game.GameError("The hat is busy. Try again in a moment.");
}

function isHost(req) {
  const pw = process.env.HOST_PASSWORD;
  return !!pw && req.headers["x-host-password"] === pw;
}

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      if (req.query.host) {
        if (!isHost(req)) return res.status(401).json({ error: "Wrong host password." });
        return res.json(game.hostView(await load()));
      }
      return res.json(game.playerView(await load(), String(req.query.id || "")));
    }
    if (req.method !== "POST") return res.status(405).end();

    const { action, id, name, code } = req.body || {};
    const hostActions = ["close", "open", "reset"];
    if (hostActions.includes(action)) {
      if (!isHost(req)) return res.status(401).json({ error: "Wrong host password." });
      if (action === "reset") { await redis.set(KEY, game.empty()); return res.json(game.hostView(game.empty())); }
      const view = await withLock((s) => { game.setClosed(s, action === "close"); return game.hostView(s); });
      return res.json(view);
    }
    if (!id || typeof id !== "string") return res.status(400).json({ error: "Missing player id." });
    const view = await withLock((s) => {
      if (action === "add") game.add(s, id, name, code);
      else if (action === "remove") game.remove(s, id);
      else if (action === "draw") game.draw(s, id);
      else throw new game.GameError("Unknown action.");
      return game.playerView(s, id);
    });
    return res.json(view);
  } catch (e) {
    if (e instanceof game.GameError) return res.status(400).json({ error: e.message });
    console.error(e);
    return res.status(500).json({ error: "Could not reach the hat. Try again in a moment." });
  }
}
