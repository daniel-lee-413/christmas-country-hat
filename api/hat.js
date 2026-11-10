// Single API endpoint: GET /api/hat?id=...  and  POST /api/hat { action, ... }
import { Redis } from "@upstash/redis";
import { randomUUID } from "node:crypto";
import * as game from "./_game.js";

// Find the database settings whatever prefix Vercel/Upstash gave them
// (KV_REST_API_URL, UPSTASH_REDIS_REST_URL, STORAGE_KV_REST_API_URL, ...).
function findEnv(suffixes) {
  const key = Object.keys(process.env).find((k) => suffixes.some((s) => k.endsWith(s)) && !k.includes("READ_ONLY"));
  return key ? process.env[key] : undefined;
}
const DB_URL = findEnv(["KV_REST_API_URL", "REDIS_REST_URL"]);
const DB_TOKEN = findEnv(["KV_REST_API_TOKEN", "REDIS_REST_TOKEN"]);
const redis = DB_URL && DB_TOKEN ? new Redis({ url: DB_URL, token: DB_TOKEN }) : null;
const KEY = "hat:state";
const LOCK = "hat:lock";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function load() {
  return game.upgrade(await redis.get(KEY));
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

// Tell the organiser the draw has run. Names only: no countries, no allocations.
async function emailOrganiser(names) {
  const key = process.env.RESEND_API_KEY, to = process.env.ORGANISER_EMAIL;
  if (!key || !to) return "Email not set up (RESEND_API_KEY / ORGANISER_EMAIL missing), so no email was sent.";
  const from = process.env.EMAIL_FROM || "Christmas Country Hat <hat@fantasyfundmanager.co.uk>";
  const list = names.map((n) => "• " + n).join("\n");
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: "Bearer " + key, "content-type": "application/json" },
      body: JSON.stringify({
        from, to: to.split(",").map((t) => t.trim()),
        subject: "🎩 The Christmas Country Hat draw is done",
        text: `The draw has run. Everyone below has been given a country (nobody got their own).\n\n${list}\n\n` +
              `Each person can open the link on their own phone to see their country. Allocations are private, so they're not in this email.`,
      }),
    });
    if (!r.ok) return "The draw worked, but the email failed (" + r.status + " " + (await r.text()).slice(0, 120) + ").";
    return "Email sent to the organiser.";
  } catch (e) {
    return "The draw worked, but the email couldn't be sent (" + e.message + ").";
  }
}

function isHost(req) {
  const pw = process.env.HOST_PASSWORD;
  return !!pw && req.headers["x-host-password"] === pw;
}

export default async function handler(req, res) {
  if (!redis) {
    const names = Object.keys(process.env).filter((k) => /REDIS|KV_|UPSTASH/.test(k));
    return res.status(500).json({ error: "Setup problem: the hat can't find its database settings. " +
      (names.length ? "Found: " + names.join(", ") + "." : "No database settings found. Connect the Upstash database to this project, then redeploy.") });
  }
  try {
    const hostActions = ["open", "close", "draw", "reset"];
    const action = req.method === "POST" ? (req.body || {}).action : null;
    if ((req.method === "GET" && req.query.host) || hostActions.includes(action)) {
      if (!process.env.HOST_PASSWORD) return res.status(500).json({ error: "Setup problem: HOST_PASSWORD isn't set in Vercel (or the site wasn't redeployed after adding it)." });
      if (!isHost(req)) return res.status(401).json({ error: "Wrong organiser password." });
    }

    if (req.method === "GET") {
      if (req.query.host) return res.json(game.hostView(await load()));
      return res.json(game.playerView(await load(), String(req.query.id || "")));
    }
    if (req.method !== "POST") return res.status(405).end();

    if (action === "reset") { await redis.set(KEY, game.empty()); return res.json(game.hostView(game.empty())); }
    if (action === "open" || action === "close")
      return res.json(await withLock((s) => { game.setOpen(s, action === "open"); return game.hostView(s); }));
    if (action === "draw") {
      let names;
      const view = await withLock((s) => { names = game.runDraw(s); return game.hostView(s); });
      view.email = await emailOrganiser(names);
      return res.json(view);
    }

    const { id, name, code } = req.body || {};
    if (!id || typeof id !== "string") return res.status(400).json({ error: "Missing player id." });
    const view = await withLock((s) => {
      if (action === "add") game.add(s, id, name, code);
      else if (action === "remove") game.remove(s, id);
      else throw new game.GameError("Unknown action.");
      return game.playerView(s, id);
    });
    return res.json(view);
  } catch (e) {
    if (e instanceof game.GameError) return res.status(400).json({ error: e.message });
    console.error(e);
    return res.status(500).json({ error: "Could not reach the hat (" + String(e && e.message || e).slice(0, 160) + ")" });
  }
}
