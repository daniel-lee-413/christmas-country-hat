// Game rules, kept separate from storage so they can be tested.
// State: { closed: bool, players: { [id]: { name, code, drew } } }
import { randomInt } from "node:crypto";

export const empty = () => ({ closed: false, players: {} });

class GameError extends Error {}
export { GameError };

function drawnCodes(s) {
  return new Set(Object.values(s.players).map((p) => p.drew).filter(Boolean));
}

export function add(s, id, name, code) {
  if (s.closed) throw new GameError("The hat is closed. Ask the host to reopen it.");
  if (s.players[id]) throw new GameError("You already put one in.");
  name = String(name || "").trim().slice(0, 40);
  if (!name) throw new GameError("Tell the hat your name first.");
  if (!/^[A-Z]{2}$/.test(code)) throw new GameError("Pick a country from the list.");
  if (Object.values(s.players).some((p) => p.code === code))
    throw new GameError("That country is already in the hat. Pick another one.");
  s.players[id] = { name, code, drew: null };
}

export function remove(s, id) {
  if (s.closed) throw new GameError("The hat is closed, so you can't take it back out.");
  if (!s.players[id]) throw new GameError("You haven't put anything in yet.");
  delete s.players[id];
}

export function draw(s, id) {
  const me = s.players[id];
  if (!me) throw new GameError("Put your own country in first.");
  if (!s.closed) throw new GameError("Wait for the host to close the hat, then draw.");
  if (me.drew) return me.drew;
  const taken = drawnCodes(s);
  const pool = Object.values(s.players).map((p) => p.code).filter((c) => !taken.has(c) && c !== me.code);
  const waiting = Object.entries(s.players).filter(([pid, p]) => !p.drew && pid !== id);
  // Only dead end: the last drawer is left with their own country.
  // With 2 left to draw (me + one other), I must take theirs if it's still in.
  let pick;
  if (waiting.length === 1 && pool.includes(waiting[0][1].code)) pick = waiting[0][1].code;
  else pick = pool[randomInt(pool.length)];
  if (!pick) throw new GameError("Nothing left in the hat for you.");
  me.drew = pick;
  return pick;
}

export function setClosed(s, closed) {
  const n = Object.keys(s.players).length;
  if (closed && n < 2) throw new GameError("Need at least 2 people in the hat before closing it.");
  if (!closed && Object.values(s.players).some((p) => p.drew))
    throw new GameError("Someone has already drawn, so the hat can't be reopened. Reset instead.");
  s.closed = closed;
}

export function playerView(s, id) {
  const all = Object.values(s.players);
  const me = s.players[id] || null;
  return {
    closed: s.closed,
    count: all.length,
    drawn: all.filter((p) => p.drew).length,
    me: me && { name: me.name, code: me.code, drew: me.drew },
  };
}

export function hostView(s) {
  const all = Object.values(s.players);
  const taken = drawnCodes(s);
  return {
    closed: s.closed,
    people: all.map((p) => ({ name: p.name, hasDrawn: !!p.drew })),
    countries: all.map((p) => ({ code: p.code, drawn: taken.has(p.code) })),
  };
}
