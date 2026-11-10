// Game rules, kept separate from storage so they can be tested.
// State: { phase: "open" | "closed" | "drawn", players: { [id]: { name, code, got } } }
import { randomInt } from "node:crypto";

const CODES = new Set(("AF AL DZ AD AO AG AR AM AU AT AZ BS BH BD BB BY BE BZ BJ BT BO BA BW BR BN BG BF BI CV KH CM CA CF TD " +
  "CL CN CO KM CG CD CR CI HR CU CY CZ DK DJ DM DO EC EG SV GQ ER EE SZ ET FJ FI FR GA GM GE DE GH GR GD GT GN GW GY HT HN HU " +
  "IS IN ID IR IQ IE IL IT JM JP JO KZ KE KI KW KG LA LV LB LS LR LY LI LT LU MG MW MY MV ML MT MH MR MU MX FM MD MC MN ME MA " +
  "MZ MM NA NR NP NL NZ NI NE NG KP MK NO OM PK PW PS PA PG PY PE PH PL PT QA RO RU RW KN LC VC WS SM ST SA SN RS SC SL SG SK SI " +
  "SB SO ZA KR SS ES LK SD SR SE CH SY TW TJ TZ TH TL TG TO TT TN TR TM TV UG UA AE GB US UY UZ VU VA VE VN YE ZM ZW").split(" "));

export class GameError extends Error {}
export const empty = () => ({ phase: "open", players: {} });

// Accept states saved by the earlier version of the app.
export function upgrade(s) {
  if (!s) return empty();
  if (!s.phase) s.phase = s.closed ? "closed" : "open";
  delete s.closed;
  for (const p of Object.values(s.players || {})) { if (p.drew) delete p.drew; if (!("got" in p)) p.got = null; }
  if (s.phase === "drawn" && Object.values(s.players).some((p) => !p.got)) s.phase = "closed";
  return s;
}

const cleanName = (n) => String(n || "").replace(/\s+/g, " ").trim().slice(0, 40);
const nameKey = (n) => cleanName(n).toLowerCase();

export function add(s, id, name, code) {
  if (s.phase !== "open") throw new GameError("Entries are closed. Ask the organiser to reopen them.");
  if (s.players[id]) throw new GameError("You're already in the hat.");
  name = cleanName(name);
  if (!name) throw new GameError("Tell the hat your name first.");
  code = String(code || "").toUpperCase();
  if (!CODES.has(code)) throw new GameError("Pick a country from the list.");
  if (Object.values(s.players).some((p) => nameKey(p.name) === nameKey(name)))
    throw new GameError("Someone's already using that name. Try adding an initial.");
  // Neutral on purpose: doesn't say who, or confirm anything beyond "choose again".
  if (Object.values(s.players).some((p) => p.code === code))
    throw new GameError("That one can't go in. Please choose another country.");
  s.players[id] = { name, code, got: null };
}

export function remove(s, id) {
  if (s.phase !== "open") throw new GameError("Entries are closed, so you can't change yours now.");
  if (!s.players[id]) throw new GameError("You haven't put anything in yet.");
  delete s.players[id];
}

export function setOpen(s, open) {
  if (s.phase === "drawn") throw new GameError("The draw has already run. Start a new round instead.");
  s.phase = open ? "open" : "closed";
}

// Uniformly random assignment where nobody gets their own country:
// shuffle, and reshuffle if anyone landed on their own (about 3 tries on average).
export function runDraw(s) {
  if (s.phase === "drawn") throw new GameError("The draw has already run.");
  if (s.phase !== "closed") throw new GameError("Close entries before running the draw.");
  const ids = Object.keys(s.players);
  if (ids.length < 2)
    throw new GameError(`The draw needs at least 2 people so nobody gets their own country. There ${ids.length === 1 ? "is 1" : "are 0"} in the hat. Reopen entries to let more people join.`);
  const codes = ids.map((id) => s.players[id].code);
  let order;
  do {
    order = codes.slice();
    for (let i = order.length - 1; i > 0; i--) { const j = randomInt(i + 1); [order[i], order[j]] = [order[j], order[i]]; }
  } while (order.some((c, i) => c === codes[i]));
  ids.forEach((id, i) => { s.players[id].got = order[i]; });
  s.phase = "drawn";
  return ids.map((id) => s.players[id].name);
}

export function playerView(s, id) {
  const me = s.players[id] || null;
  return {
    phase: s.phase,
    count: Object.keys(s.players).length,
    me: me && { name: me.name, code: me.code, got: s.phase === "drawn" ? me.got : null },
  };
}

// The organiser sees names and status only: never countries or allocations.
export function hostView(s) {
  return { phase: s.phase, people: Object.values(s.players).map((p) => p.name) };
}
