"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useUIMode } from "../components/UIModeProvider";


type Account = { id: string; person_name: string; bookmaker_name: string; balance: number };

type Bet = { id: string; match_date: string; match_time: string; note: string | null; created_at: string; needs_review: boolean };
type Partner = { id: string; name: string };
type BetPlayerRow = { bet_id: string; partner: { id: string; name: string } };
type EquityUnitRow = { partner_id: string; units_minted: number };



type BetLeg = {
  id: string;
  bet_id: string;
  account_id: string;
  stake: number;
  odds: number;
  status: "open" | "win" | "loss";
  created_at: string;
};

type LegDraft = { account_id: string; stake: string; odds: string; status: "open" | "win" | "loss" };

type Option = { id: string; label: string };

type BetSummary = {
  bet: Bet;
  legs: BetLeg[];
  isClosed: boolean;
  stakeTotal: number;
  payoutTotal: number;
  profit: number;
};
function formatDateIT(dateISO: string) {
  const [y, m, d] = dateISO.split("-");
  return `${d}-${m}-${y}`;
}

function euro(n: number) {
  const v = Number.isFinite(n) ? n : 0;
  return v.toLocaleString("it-IT", { style: "currency", currency: "EUR" });
}
function toNumber(s: string) {
  return Number(String(s).replace(",", "."));
}
function signClass(n: number, isDay: boolean) {
  if (Math.abs(n) < 1e-9) return isDay ? "text-slate-500" : "text-zinc-400";
  if (n > 0) return isDay ? "text-emerald-700" : "text-emerald-300";
  return isDay ? "text-red-700" : "text-red-300";
}
function monthLabel(monthStartISO: string) {
  const d = new Date(monthStartISO + "T00:00:00");
  const txt = new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric" }).format(d);
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}
function isTwoHoursPastStart(match_date: string, match_time: string) {
  const t = (match_time ?? "00:00").slice(0, 5);
  const start = new Date(`${match_date}T${t}:00`).getTime();
  const now = Date.now();
  return now >= start + 2 * 60 * 60 * 1000; // +2 ore
}

function slugifyBookmaker(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9]/g, "");
}

function SearchSelect({
  label,
  value,
  options,
  placeholder,
  onChange,
  isDay,
}: {
  label: string;
  value: string;
  options: Option[];
  placeholder?: string;
  onChange: (id: string) => void;
  isDay: boolean;
}) {

  
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

   const ssLabelCls = isDay ? "text-slate-700" : "text-zinc-300";
  const ssInputCls = isDay
    ? "mt-1 w-full rounded-xl border border-[#D8D1C3] bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-200"
    : "mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none";

  const ssDropCls = isDay
    ? "absolute z-20 mt-2 max-h-56 w-full overflow-auto rounded-xl border border-[#D8D1C3] bg-white shadow"
    : "absolute z-20 mt-2 max-h-56 w-full overflow-auto rounded-xl border border-zinc-700 bg-zinc-950 shadow";

  const ssItemCls = isDay
    ? "block w-full px-3 py-2 text-left text-sm text-slate-900 hover:bg-blue-50"
    : "block w-full px-3 py-2 text-left text-sm text-zinc-100 hover:bg-zinc-800";
  const selectedLabel = useMemo(() => options.find((o) => o.id === value)?.label ?? "", [options, value]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return options;
    return options.filter((o) => o.label.toLowerCase().includes(qq));
  }, [options, q]);

  return (
    <div className="relative">
      <div className={isDay ? "text-sm text-slate-700" : "text-sm text-zinc-300"}>{label}</div>
      <input
        value={open ? q : selectedLabel}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          setQ("");
          setOpen(true);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        placeholder={placeholder ?? "Scrivi per cercare..."}
        className={[
  "mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none",
  isDay
    ? "border-[#D8D1C3] bg-white text-slate-900 placeholder:text-slate-400"
    : "border-zinc-700 bg-zinc-950 text-zinc-100 placeholder:text-zinc-500",
].join(" ")}

      />

      {open && (
        <div
  className={[
    "absolute z-20 mt-2 max-h-56 w-full overflow-auto rounded-xl border shadow",
    isDay ? "border-[#D8D1C3] bg-white" : "border-zinc-700 bg-zinc-950",
  ].join(" ")}
>

          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-zinc-400">Nessun risultato</div>
          ) : (
            filtered.map((o) => (
              <button
                key={o.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(o.id);
                  setOpen(false);
                  setQ("");
                }}
                className={[
  "block w-full px-3 py-2 text-left text-sm",
  isDay ? "text-slate-900 hover:bg-blue-50" : "text-zinc-100 hover:bg-zinc-800",
].join(" ")}

              >
                {o.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function StatusPills({
  status,
  onSet,
  isDay,
}: {
  status: "open" | "win" | "loss";
  onSet: (s: "open" | "win" | "loss") => void;
  isDay: boolean;
}) {
  const base = "rounded-lg px-3 py-1 text-xs font-semibold border transition";

  // ✅ NON selezionati: azzurrino chiaro (sia Day che Dark)
  const idle = isDay
    ? "bg-blue-50 text-blue-900 border-blue-200 hover:bg-blue-100"
    : "bg-blue-900/20 text-blue-100 border-blue-700/50 hover:bg-blue-900/30";

  // ✅ selezionati: colore dedicato
  const openActive = isDay
    ? "bg-blue-200 text-blue-900 border-blue-300"
    : "bg-blue-700/70 text-blue-100 border-blue-600";

  const winActive = isDay
    ? "bg-emerald-200 text-emerald-900 border-emerald-300"
    : "bg-emerald-700/80 text-emerald-100 border-emerald-600";

  const lossActive = isDay
    ? "bg-red-200 text-red-900 border-red-300"
    : "bg-red-800/70 text-red-100 border-red-700";

  const openCls = status === "open" ? openActive : idle;
  const winCls = status === "win" ? winActive : idle;
  const lossCls = status === "loss" ? lossActive : idle;

  return (
    <div className="flex items-center gap-2">
      <button type="button" className={`${base} ${openCls}`} onClick={() => onSet("open")}>
        OPEN
      </button>
      <button type="button" className={`${base} ${winCls}`} onClick={() => onSet("win")}>
        WIN
      </button>
      <button type="button" className={`${base} ${lossCls}`} onClick={() => onSet("loss")}>
        LOSS
      </button>
    </div>
  );
}


export default function ScommessePage() {
  
  
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
    const { mode } = useUIMode();
  const isDay = mode === "day";
  const btnPrimary = isDay
    ? "rounded-xl bg-[#163D9C] px-4 py-2 text-sm font-semibold text-white hover:bg-[#12337F] transition"
    : "rounded-xl bg-blue-800 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition";

  const btnNeutral = isDay
    ? "rounded-xl border border-[#D8D1C3] bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-[#F4F0E6]"
    : "rounded-xl bg-zinc-800 px-3 py-2 text-sm hover:bg-zinc-700";

  const btnDark = isDay
    ? "rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
    : "rounded-xl bg-zinc-800 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-700";

  const btnDanger = isDay
    ? "rounded-xl bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-500"
    : "rounded-xl bg-red-800/70 px-3 py-2 text-xs font-semibold hover:bg-red-700";

    const btnCream = isDay
  ? "rounded-xl border border-blue-200 bg-[#F7F5EE] px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-[#F1EFE6]"
  : "rounded-xl bg-zinc-800 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-700";

  const pageCls = isDay
    ? "min-h-screen bg-[#F4F0E6] text-slate-900"
    : "min-h-screen bg-zinc-950 text-zinc-100";

  const panelCls = isDay
    ? "rounded-2xl border border-[#E5DFD3] bg-[#FBF8F1]"
    : "rounded-2xl border border-zinc-800 bg-zinc-900/40";

  const innerCls = isDay
    ? "rounded-xl border border-[#E5DFD3] bg-[#FFFDF8]"
    : "rounded-xl border border-zinc-800 bg-zinc-950/30";

  const inputCls = isDay
    ? "mt-1 w-full rounded-xl border border-[#D8D1C3] bg-white px-3 py-2 text-sm text-slate-900 outline-none"
    : "mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none";


  // soci
  const [partners, setPartners] = useState<Partner[]>([]);
  const [betPlayers, setBetPlayers] = useState<BetPlayerRow[]>([]);
  const [equityUnits, setEquityUnits] = useState<EquityUnitRow[]>([]);

  // selezione giocatori per nuova bet
  const [newPlayers, setNewPlayers] = useState<string[]>([]);

  // ===== MODIFICA BET (data/ora) =====
const [openEditBet, setOpenEditBet] = useState(false);
const [editBetId, setEditBetId] = useState<string>("");
const [editBetDate, setEditBetDate] = useState<string>("");
const [editBetTime, setEditBetTime] = useState<string>("");
const [editBetErr, setEditBetErr] = useState<string>("");


  const [accounts, setAccounts] = useState<Account[]>([]);
  const [bets, setBets] = useState<Bet[]>([]);
  const [legs, setLegs] = useState<BetLeg[]>([]);
    // ✅ MODAL modifica leg
  const [openEdit, setOpenEdit] = useState(false);
  const [editLegId, setEditLegId] = useState<string>("");
  const [editAccountId, setEditAccountId] = useState<string>("");
  const [editStake, setEditStake] = useState<string>("");
  const [editOdds, setEditOdds] = useState<string>("");
  const [editErr, setEditErr] = useState<string>("");
  
function openEditBetModal(bet: Bet) {
  setEditBetErr("");
  setEditBetId(bet.id);
  setEditBetDate(bet.match_date ?? "");
  setEditBetTime((bet.match_time ?? "").slice(0, 5));
  setOpenEditBet(true);
}



  const [betMode, setBetMode] = useState<"single" | "surebet">("surebet");
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [newLegs, setNewLegs] = useState<LegDraft[]>([
    { account_id: "", stake: "", odds: "", status: "open" },
    { account_id: "", stake: "", odds: "", status: "open" },
  ]);

  async function loadAll() {
    setLoading(true);
    setMsg("");

    // 1) bets + legs
    const [
  { data: b, error: be },
  { data: l, error: le },
  { data: p, error: pe },
  { data: bp, error: bpe },
  { data: eu, error: eue },
] = await Promise.all([
  supabase
    .from("bets")
    .select("id,match_date,match_time,note,created_at,needs_review")
    .order("match_date", { ascending: false })
    .order("match_time", { ascending: false })
    .order("id", { ascending: false })
    .limit(2000),

  supabase
    .from("bet_legs")
    .select("id,bet_id,account_id,stake,odds,status,created_at")
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(50000),

  supabase.from("partners").select("id,name").order("name"),

  supabase
    .from("bet_players")
    .select("bet_id, partner:partners(id,name)")
    .limit(50000),

  // ✅ units per calcolare le quote dei soci
  supabase
    .from("equity_events")
    .select("partner_id,units_minted")
    .limit(50000),
]);


    if (be || le || pe || bpe || eue) {
  setMsg((be || le || pe || bpe || eue)!.message);
  setLoading(false);
  return;
}


    const betsList = (b ?? []) as Bet[];
    const legsList = (l ?? []) as BetLeg[];
    setPartners((p ?? []) as Partner[]);
    setEquityUnits((eu ?? []) as EquityUnitRow[]);


const bpClean: BetPlayerRow[] = (bp ?? [])
  .filter((row: any) => !!row.partner)
  .map((row: any) => ({ bet_id: row.bet_id, partner: row.partner }));

setBetPlayers(bpClean);



    // 2) accounts con saldo > 0 (per la tendina)
    const { data: posAcc, error: posErr } = await supabase
      .from("accounts")
      .select("id,person_name,bookmaker_name,balance")
      .gt("balance", 0);

    if (posErr) {
      setMsg(posErr.message);
      setLoading(false);
      return;
    }

    // 3) accounts usati nelle bet (per mostrare nomi/loghi nello storico anche se saldo è 0)
    const idsFromLegs = Array.from(new Set(legsList.map((x) => x.account_id).filter(Boolean)));
    let usedAcc: Account[] = [];
    if (idsFromLegs.length > 0) {
      const { data: used, error: usedErr } = await supabase
        .from("accounts")
        .select("id,person_name,bookmaker_name,balance")
        .in("id", idsFromLegs);

      if (usedErr) {
        setMsg(usedErr.message);
        setLoading(false);
        return;
      }
      usedAcc = (used ?? []) as Account[];
    }

    // 4) unione + dedup
    const map = new Map<string, Account>();
    for (const a of (posAcc ?? []) as Account[]) map.set(a.id, a);
    for (const a of usedAcc) map.set(a.id, a);

    setBets(betsList);
    setLegs(legsList);
    setAccounts(Array.from(map.values()));
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
  }, []);
  useEffect(() => {
  const t = setInterval(() => {
    // re-render leggero per aggiornare la ✅ senza chiamare il DB
    setMsg((m) => m);
  }, 60000);
  return () => clearInterval(t);
}, []);


  useEffect(() => {
    if (betMode === "single") {
      setNewLegs([{ account_id: "", stake: "", odds: "", status: "open" }]);
    } else {
      setNewLegs([
        { account_id: "", stake: "", odds: "", status: "open" },
        { account_id: "", stake: "", odds: "", status: "open" },
      ]);
    }
  }, [betMode]);

  // ✅ mapping per nomi + loghi
  const accountMeta = useMemo(() => {
    const m = new Map<string, { label: string; slug: string }>();
    for (const a of accounts) {
      m.set(a.id, {
        label: `${a.bookmaker_name} — ${a.person_name}`,
        slug: slugifyBookmaker(a.bookmaker_name),
      });
    }
    return m;
  }, [accounts]);

  // ✅ Tendina: SOLO saldo > 0
  const accountOptions: Option[] = useMemo(() => {
    return accounts
      .filter((a) => Number(a.balance ?? 0) > 0)
      .map((a) => ({
        id: a.id,
        label: `${a.bookmaker_name} — ${a.person_name} (${euro(Number(a.balance ?? 0))})`,
      }))
      .sort((x, y) => x.label.localeCompare(y.label));
  }, [accounts]);
    // ✅ Tendina MODIFICA: tutti gli account (anche saldo 0)
  const allAccountOptions: Option[] = useMemo(() => {
    return accounts
      .map((a) => ({
        id: a.id,
        label: `${a.bookmaker_name} — ${a.person_name} (${euro(Number(a.balance ?? 0))})`,
      }))
      .sort((x, y) => x.label.localeCompare(y.label));
  }, [accounts]);


  const legsByBet = useMemo(() => {
    const m = new Map<string, BetLeg[]>();
    for (const leg of legs) {
      const arr = m.get(leg.bet_id) ?? [];
      arr.push(leg);
      m.set(leg.bet_id, arr);
    }
    for (const [betId, arr] of m.entries()) {
      arr.sort((x, y) => {
        if (x.created_at < y.created_at) return -1;
        if (x.created_at > y.created_at) return 1;
        return x.id.localeCompare(y.id);
      });
      m.set(betId, arr);
    }
    return m;
  }, [legs]);

  const summaries: BetSummary[] = useMemo(() => {
    const res: BetSummary[] = [];
    for (const b of bets) {
      const bl = legsByBet.get(b.id) ?? [];
      if (bl.length === 0) continue;

      const isClosed = bl.every((x) => x.status !== "open");
      const stakeTotal = bl.reduce((s, x) => s + Number(x.stake ?? 0), 0);
      const payoutTotal = bl.reduce(
        (s, x) => s + (x.status === "win" ? Number(x.stake ?? 0) * Number(x.odds ?? 0) : 0),
        0
      );
      const profit = payoutTotal - stakeTotal;

      res.push({ bet: b, legs: bl, isClosed, stakeTotal, payoutTotal, profit });
    }
    return res;
  }, [bets, legsByBet]);

  const playersByBetId = useMemo(() => {
  const m = new Map<string, string[]>();
  for (const row of betPlayers) {
    const arr = m.get(row.bet_id) ?? [];
    arr.push(row.partner.name);
    m.set(row.bet_id, arr);
  }
  return m;
}, [betPlayers]);

const playerIdsByBetId = useMemo(() => {
  const m = new Map<string, Set<string>>();
  for (const row of betPlayers) {
    const set = m.get(row.bet_id) ?? new Set<string>();
    set.add(row.partner.id);
    m.set(row.bet_id, set);
  }
  return m;
}, [betPlayers]);

const unitsByPartnerId = useMemo(() => {
  const m = new Map<string, number>();
  // inizializza a 0 per tutti i soci attuali
  for (const p of partners) m.set(p.id, 0);

  for (const r of equityUnits) {
    m.set(r.partner_id, (m.get(r.partner_id) ?? 0) + Number(r.units_minted ?? 0));
  }
  return m;
}, [equityUnits, partners]);

const totalUnits = useMemo(() => {
  let s = 0;
  for (const v of unitsByPartnerId.values()) s += v;
  return s;
}, [unitsByPartnerId]);




  const inProgress = useMemo(() => {
  const toTs = (b: Bet) => {
    // match_date = "YYYY-MM-DD", match_time = "HH:MM:SS" o "HH:MM"
    const t = (b.match_time ?? "00:00").slice(0, 5);
    return new Date(`${b.match_date}T${t}:00`).getTime();
  };

  return summaries
    .filter((x) => !x.isClosed)
    .sort((a, b) => toTs(a.bet) - toTs(b.bet)); // ✅ più vicina sopra
}, [summaries]);

  const closed = useMemo(() => summaries.filter((x) => x.isClosed), [summaries]);

  const closedGrouped = useMemo(() => {
    const monthMap = new Map<string, { monthProfit: number; days: Map<string, { dayProfit: number; bets: BetSummary[] }> }>();
    for (const bs of closed) {
      const day = bs.bet.match_date;
      const monthStart = day.slice(0, 7) + "-01";
      if (!monthMap.has(monthStart)) monthMap.set(monthStart, { monthProfit: 0, days: new Map() });
      const m = monthMap.get(monthStart)!;
      m.monthProfit += bs.profit;

      if (!m.days.has(day)) m.days.set(day, { dayProfit: 0, bets: [] });
      const d = m.days.get(day)!;
      d.dayProfit += bs.profit;
      d.bets.push(bs);
    }
    const months = Array.from(monthMap.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
    return months.map(([monthStart, payload]) => {
      const days = Array.from(payload.days.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
      return {
        monthStart,
        monthProfit: payload.monthProfit,
        days: days.map(([dayISO, dp]) => ({ dayISO, dayProfit: dp.dayProfit, bets: dp.bets })),
      };
    });
  }, [closed]);

  function addNewLeg() {
    setNewLegs((prev) => [...prev, { account_id: "", stake: "", odds: "", status: "open" }]);
  }
  function updateNewLeg(i: number, patch: Partial<LegDraft>) {
    setNewLegs((prev) => prev.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  }
  function removeNewLeg(i: number) {
    setNewLegs((prev) => {
      const next = prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== i);
      if (next.length === 1) setBetMode("single");
      return next;
    });
  }

  async function saveNewBet() {
    setMsg("");
    if (!newDate || !newTime) return setMsg("Inserisci data e ora partita");
    if (newLegs.length < 1) return setMsg("Devi avere almeno 1 bookmaker");
    if (betMode === "surebet" && newLegs.length < 2) return setMsg("Surebet: servono almeno 2 bookmaker");

    for (let i = 0; i < newLegs.length; i++) {
      const l = newLegs[i];
      const stake = toNumber(l.stake);
      const odds = toNumber(l.odds);
      if (!l.account_id) return setMsg(`Leg ${i + 1}: scegli il sito (account)`);
      if (!Number.isFinite(stake) || stake <= 0) return setMsg(`Leg ${i + 1}: importo non valido`);
      if (!Number.isFinite(odds) || odds <= 1) return setMsg(`Leg ${i + 1}: quota non valida`);
    }

    const { data: betData, error: betErr } = await supabase
      .from("bets")
      .insert([{ match_date: newDate, match_time: newTime }])
      .select("id")
      .single();
    if (betErr) return setMsg(betErr.message);

    const bet_id = betData.id as string;

    const payload = newLegs.map((l) => ({
      bet_id,
      account_id: l.account_id,
      stake: toNumber(l.stake),
      odds: toNumber(l.odds),
      status: l.status,
    }));

    const { error: legsErr } = await supabase.from("bet_legs").insert(payload);
    if (legsErr) return setMsg(legsErr.message);
    // ✅ Inserisco i giocatori della bet (solo per bet nuove, le vecchie restano senza)
const playersUnique = Array.from(new Set(newPlayers));
if (playersUnique.length > 0) {
  const payloadPlayers = playersUnique.map((partner_id) => ({ bet_id, partner_id }));
  const { error: pErr } = await supabase.from("bet_players").insert(payloadPlayers);
  if (pErr) return setMsg(pErr.message);
}


// ✅ Finalizzo: da qui in poi non è più modificabile
{
  const { error: lockErr } = await supabase
    .from("bets")
    .update({ bettors_finalized: true })
    .eq("id", bet_id);
  if (lockErr) return setMsg(lockErr.message);
}


    setMsg("✅ Bet salvata");
    setNewDate("");
    setNewTime("");
    setNewPlayers([]);
    setNewLegs(
      betMode === "single"
        ? [{ account_id: "", stake: "", odds: "", status: "open" }]
        : [
            { account_id: "", stake: "", odds: "", status: "open" },
            { account_id: "", stake: "", odds: "", status: "open" },
          ]
    );

    await loadAll();
  }

  async function setLegStatus(legId: string, status: "open" | "win" | "loss") {
  setMsg("");

  const current = legs.find((x) => x.id === legId);
  if (!current) return;

  const betId = current.bet_id;

  // 1) aggiorna status leg
  const { error } = await supabase.from("bet_legs").update({ status }).eq("id", legId);
  if (error) return setMsg(error.message);

  // 2) aggiorna UI subito
  setLegs((prev) => prev.map((x) => (x.id === legId ? { ...x, status } : x)));

  // 3) VERIFICA CHIUSURA SUL DB (fonte di verità)
  const { count, error: countErr } = await supabase
    .from("bet_legs")
    .select("id", { count: "exact", head: true })
    .eq("bet_id", betId)
    .eq("status", "open");

  if (countErr) return setMsg(countErr.message);

  const isNowClosed = (count ?? 0) === 0;

  if (isNowClosed) {
    const y = window.scrollY;

    // 4) calcolo bonus/malus + allocazioni (scrive su DB)
    const { error: allocErr } = await supabase.rpc("compute_bet_allocations", { p_bet_id: betId });
    if (allocErr) return setMsg(allocErr.message);

    const { error: feeErr } = await supabase.rpc("compute_bet_person_fees", { p_bet_id: betId });
    if (feeErr) return setMsg(feeErr.message);

    // 5) refresh dati
    await loadAll();
    requestAnimationFrame(() => window.scrollTo(0, y));
  }
}



  async function deleteBet(betId: string) {
  const ok = window.confirm("Eliminare questa bet? (ripristina i saldi)");
  if (!ok) return;

  setMsg("");
  const { error } = await supabase.rpc("delete_bet_and_revert_safe", { p_bet_id: betId });
  if (error) return setMsg(`❌ Errore eliminazione:\n${error.message}`);

  setMsg("✅ Bet eliminata");
  await loadAll();
}

  async function toggleBetReview(bet: Bet) {
  setMsg("");

  const next = !bet.needs_review;

  const { error } = await supabase
    .from("bets")
    .update({ needs_review: next })
    .eq("id", bet.id);

  if (error) return setMsg(error.message);

  // aggiorno lo stato localmente (senza loadAll, così non scrolla)
  setBets((prev) => prev.map((b) => (b.id === bet.id ? { ...b, needs_review: next } : b)));
}

  async function saveEditBet() {
  setEditBetErr("");

  if (!editBetId) return setEditBetErr("Bet non valida");
  if (!editBetDate) return setEditBetErr("Inserisci la data");
  if (!editBetTime) return setEditBetErr("Inserisci l'ora");

  const y = window.scrollY;

  const { error } = await supabase
    .from("bets")
    .update({ match_date: editBetDate, match_time: editBetTime })
    .eq("id", editBetId);

  if (error) return setEditBetErr(error.message);

  setOpenEditBet(false);
  await loadAll();
  requestAnimationFrame(() => window.scrollTo(0, y));
}

  
    function openEditLeg(leg: BetLeg) {
    setEditErr("");
    setEditLegId(leg.id);
    setEditAccountId(leg.account_id);
    setEditStake(String(leg.stake ?? ""));
    setEditOdds(String(leg.odds ?? ""));
    setOpenEdit(true);
  }

  async function saveEditLeg() {
    setEditErr("");

    const stake = toNumber(editStake);
    const odds = toNumber(editOdds);

    if (!editLegId) return setEditErr("Leg non valida");
    if (!editAccountId) return setEditErr("Seleziona il bookmaker");
    if (!Number.isFinite(stake) || stake <= 0) return setEditErr("Importo non valido");
    if (!Number.isFinite(odds) || odds <= 1) return setEditErr("Quota non valida");

    const y = window.scrollY;

    const { error } = await supabase.rpc("replace_bet_leg", {
      p_leg_id: editLegId,
      p_new_account_id: editAccountId,
      p_new_stake: stake,
      p_new_odds: odds,
    });

    if (error) return setEditErr(error.message);

    setOpenEdit(false);
    await loadAll();
    requestAnimationFrame(() => window.scrollTo(0, y));
  }
  function splitProfitWithBonus(profit: number, betId: string) {
  const out = new Map<string, number>();

  // se non abbiamo soci o units, ritorna vuoto
  if (partners.length === 0 || totalUnits <= 0) return out;

  // quota base pro-quota
  for (const p of partners) {
    const units = unitsByPartnerId.get(p.id) ?? 0;
    const q = units / totalUnits;
    out.set(p.name, profit * q);
  }

  // bonus solo se profitto positivo
  if (profit <= 0) return out;

  const players = playerIdsByBetId.get(betId) ?? new Set<string>();
  const k = players.size;
  const n = partners.length;

  // se nessun player o tutti i soci -> niente bonus
  if (k === 0 || k === n) return out;

  const bonusTotal = profit * 0.10;
  const bonusEach = bonusTotal / k;
  const malusEach = bonusTotal / (n - k);

  for (const p of partners) {
    const cur = out.get(p.name) ?? 0;
    if (players.has(p.id)) out.set(p.name, cur + bonusEach);
    else out.set(p.name, cur - malusEach);
  }

  return out;
}


  function Logo({ accountId }: { accountId: string }) {
    const meta = accountMeta.get(accountId);
    if (!meta) return null;
    return (
      <img
        src={`/bookmakers/${meta.slug}.png`}
        alt={meta.label}
        className="h-6 w-auto max-w-[110px] object-contain"
        onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
      />
    );
  }

  function LegCard({ leg, idx }: { leg: BetLeg; idx: number }) {
  const meta = accountMeta.get(leg.account_id);

  return (
  <div className={`${innerCls} relative px-3 py-2 pt-3 text-xs`}>
    {/* ✅ LOGO ancorato all’angolo in alto a destra */}
    <div className="absolute right-2 top-2">
      <Logo accountId={leg.account_id} />
    </div>

    <div className="flex items-center justify-between gap-2">
      <div className={isDay ? "text-slate-600 font-semibold" : "text-zinc-500 font-semibold"}>
        Leg {idx + 1}
      </div>
    </div>


      <div className={isDay ? "mt-1 text-slate-700" : "mt-1 text-zinc-300"}>
        {meta?.label ?? leg.account_id}
      </div>

      <div className={isDay ? "text-slate-900" : "text-zinc-100"}>
        importo: <span className="font-semibold">{euro(leg.stake)}</span>
      </div>

      <div className={isDay ? "text-slate-900" : "text-zinc-100"}>
        quota: <span className="font-semibold">{leg.odds}</span>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <StatusPills status={leg.status} onSet={(s) => setLegStatus(leg.id, s)} isDay={isDay} />
        <button
          type="button"
          onClick={() => openEditLeg(leg)}
          className={[
  "rounded-lg px-3 py-1 text-xs font-semibold transition",
  "bg-[#163D9C] text-white hover:bg-[#12337F]",
].join(" ")}

        >
          Modifica
        </button>
      </div>
    </div>
  );
}


  return (
    <main className={`${pageCls} p-6`}>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Scommesse</h1>
        <button onClick={loadAll} className={btnNeutral}>
  Aggiorna
</button>

      </div>

      {msg && (
        <div className={`mt-4 whitespace-pre-wrap rounded-xl p-3 text-sm ${innerCls}`}>
          {msg}
        </div>
      )}

      {loading ? (
        <div className={`mt-6 ${isDay ? "text-slate-600" : "text-zinc-400"}`}>Caricamento…</div>
      ) : (
        <>
          {/* Nuova bet */}
          <div className={`mt-6 ${panelCls} p-4`}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Nuova bet</h2>
              <label className={`text-sm ${isDay ? "text-slate-700" : "text-zinc-300"}`}>

                Tipo
                <select
                  value={betMode}
                  onChange={(e) => setBetMode(e.target.value as any)}
                  className={`ml-2 ${inputCls}`}
style={isDay ? undefined : { colorScheme: "dark" }}

                >
                  <option value="surebet">Surebet / Multipla (2+)</option>
                  <option value="single">Singola (1)</option>
                </select>
              </label>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className={`text-sm ${isDay ? "text-slate-700" : "text-zinc-300"}`}>

                Data partita
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className={inputCls}
                />
              </label>

              <label className={`text-sm ${isDay ? "text-slate-700" : "text-zinc-300"}`}>

                Ora partita
                <input
                  type="time"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  className={inputCls}
                />
              </label>
            </div>
            <div className={`mt-4 ${innerCls} p-3`}>
  <div className={`text-sm font-semibold ${isDay ? "text-slate-800" : "text-zinc-200"}`}>
  Chi ha giocato la bet (bonus 10%)
</div>

<div className={`mt-1 text-xs ${isDay ? "text-slate-600" : "text-zinc-400"}`}>
  Se selezioni tutti i soci, il bonus non si applica (ripartizione pro-quota normale).
</div>


  <div className="mt-3 flex flex-wrap gap-2">
    {partners.map((p) => {
      const active = newPlayers.includes(p.id);
      return (
        <button
          key={p.id}
          type="button"
          onClick={() => {
            setNewPlayers((prev) =>
              prev.includes(p.id) ? prev.filter((x) => x !== p.id) : [...prev, p.id]
            );
          }}
          className={[
  "rounded-xl px-3 py-2 text-xs font-semibold border transition",
  active
    ? (isDay
        ? "border-blue-300 bg-blue-200 text-blue-900"
        : "border-blue-600 bg-blue-900/40 text-blue-200")
    : (isDay
        ? "border-blue-200 bg-blue-50 text-blue-900 hover:bg-blue-100"
        : "border-zinc-700 bg-zinc-950 text-zinc-300 hover:bg-zinc-900"),
].join(" ")}

        >
          {p.name}
        </button>
      );
    })}
  </div>
</div>


            <div className="mt-6 flex items-center justify-between">
              <h3 className="text-base font-semibold">Legs</h3>
              <button onClick={addNewLeg} className={btnNeutral}>
  + Aggiungi sito
</button>
 
            </div>

            <div className="mt-4 space-y-3">
              {newLegs.map((l, i) => (
                <div key={i} className={`${innerCls} p-3`}>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
                    <div className="md:col-span-2">
                      <SearchSelect
  label="Sito"
  value={l.account_id}
  options={accountOptions}
  onChange={(id) => updateNewLeg(i, { account_id: id })}
  isDay={isDay}
/>

                    </div>

                    <label className={`text-sm ${isDay ? "text-slate-700" : "text-zinc-300"}`}>

                      Importo
                      <input value={l.stake} onChange={(e) => updateNewLeg(i, { stake: e.target.value })}
                        className={inputCls}
 />
                    </label>

                    <label className={`text-sm ${isDay ? "text-slate-700" : "text-zinc-300"}`}>

                      Quota
                     <input
  value={l.odds}
  onChange={(e) => updateNewLeg(i, { odds: e.target.value })}
  className={inputCls}
/>

                    </label>

                    <label className={`text-sm ${isDay ? "text-slate-700" : "text-zinc-300"}`}>

                      Esito
                      <select value={l.status} onChange={(e) => updateNewLeg(i, { status: e.target.value as any })}
                        className={inputCls}
style={isDay ? undefined : { colorScheme: "dark" }}

                      >
                        <option value="open">open</option>
                        <option value="win">win</option>
                        <option value="loss">loss</option>
                      </select>
                    </label>
                  </div>

                  <div className="mt-3">
                    <button onClick={() => removeNewLeg(i)} className={btnCream}>
  Rimuovi leg
</button>

                  </div>
                </div>
              ))}
            </div>

            <button onClick={saveNewBet} className="mt-6 rounded-xl bg-blue-800 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition">
              Salva bet
            </button>
          </div>

                    {/* In corso */}
          <div className={`mt-6 ${panelCls} p-4`}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">In corso</h2>
              <div className="text-sm text-zinc-400">{inProgress.length} bet</div>
            </div>

            {inProgress.length === 0 ? (
              <div className="mt-3 text-zinc-500">Nessuna bet in corso.</div>
            ) : (
              <div className="mt-4 space-y-3">
                {inProgress.map((bs) => (
                  <div key={bs.bet.id} className={`${innerCls} p-3`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-start gap-2">
  <button
    type="button"
    onClick={() => toggleBetReview(bs.bet)}
    className={`mt-1 h-3 w-3 rounded-full border ${
      bs.bet.needs_review
        ? "border-yellow-500 bg-yellow-400"
        : "border-zinc-500 bg-transparent hover:border-zinc-300"
    }`}
    title={bs.bet.needs_review ? "Segnata per revisione" : "Segna per revisione"}
  />

  <div className="flex flex-col">
    <div className={`text-sm flex items-center gap-2 ${isDay ? "text-slate-900" : "text-zinc-200"}`}>
  {formatDateIT(bs.bet.match_date)} — {(bs.bet.match_time ?? "").slice(0, 5)}
      {isTwoHoursPastStart(bs.bet.match_date, bs.bet.match_time) && (
        <span
          title="Partita presumibilmente terminata"
          className="rounded-md bg-emerald-700/80 px-2 py-0.5 text-xs font-semibold text-emerald-100 border border-emerald-600"
        >
          Finita
        </span>
      )}
    </div>

    {(playersByBetId.get(bs.bet.id) ?? []).length > 0 && (
      <div className={`mt-1 text-xs ${isDay ? "text-slate-600" : "text-zinc-400"}`}>
        Giocata da: {(playersByBetId.get(bs.bet.id) ?? []).join(", ")}
      </div>
    )}
  </div>
</div>



                      <div className="flex items-center gap-2">
                        <button
  onClick={() => openEditBetModal(bs.bet)}
  className={[
    "rounded-xl px-3 py-2 text-xs font-semibold transition",
    // day: blu testo + bordo blu, sfondo bianco
    isDay
      ? "bg-white text-[#163D9C] border border-[#163D9C] hover:bg-blue-50"
      : "bg-zinc-800 text-zinc-200 hover:bg-zinc-700",
  ].join(" ")}
>
  Modifica data/ora
</button>

<button
  onClick={() => deleteBet(bs.bet.id)}
  className={[
    "rounded-xl px-3 py-2 text-xs font-semibold transition text-white",
    // rosso più acceso
    isDay ? "bg-red-600 hover:bg-red-500" : "bg-red-600 hover:bg-red-500",
  ].join(" ")}
>
  Elimina
</button>

                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {bs.legs.map((l, idx) => (
                        <LegCard key={l.id} leg={l} idx={idx} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Storico (chiuse) */}
          <div className={`mt-6 ${panelCls} p-4`}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Storico (chiuse)</h2>
              <div className="text-sm text-zinc-400">{closed.length} bet</div>
            </div>

            {closedGrouped.length === 0 ? (
              <div className="mt-3 text-zinc-500">Nessuna bet chiusa.</div>
            ) : (
              <div className="mt-4 space-y-3">
                {closedGrouped.map((m) => (
                  <details key={m.monthStart} className={`${innerCls}`}>
                    <summary className="cursor-pointer select-none px-4 py-3 flex items-center justify-between">
                      <div className={`text-sm font-semibold ${isDay ? "text-slate-900" : "text-zinc-100"}`}>
  {monthLabel(m.monthStart)}
</div>
                      <div className={`text-sm font-semibold ${signClass(m.monthProfit, isDay)}`}>
                        {m.monthProfit >= 0 ? "+" : ""}
                        {euro(m.monthProfit)}
                      </div>
                    </summary>

                    <div className="px-4 pb-4 space-y-2">
                      {m.days.map((d) => (
                        <details key={d.dayISO} className={`${innerCls}`}>
                          <summary className="cursor-pointer select-none px-4 py-3 flex items-center justify-between">
                            <div className={`text-sm ${isDay ? "text-slate-900" : "text-zinc-100"}`}>
  {formatDateIT(d.dayISO)}
</div>
                            <div className={`text-sm font-semibold ${signClass(d.dayProfit, isDay)}`}>
                              {d.dayProfit >= 0 ? "+" : ""}
                              {euro(d.dayProfit)}
                            </div>
                          </summary>

                          <div className="px-4 pb-4 space-y-3">
                            {d.bets.map((bs) => (
                              <div key={bs.bet.id} className={`${innerCls} p-3`}>
                                <div className="flex items-center justify-between">
                                  <div className="text-sm text-zinc-200">
                                    {(bs.bet.match_time ?? "").slice(0, 5)} —{" "}
                                    <span className={`font-semibold ${signClass(bs.profit, isDay)}`}>
                                      {bs.profit >= 0 ? "+" : ""}
                                      {euro(bs.profit)}
                                    </span>
                                  </div>

                                  <button
  onClick={() => deleteBet(bs.bet.id)}
  className="rounded-xl bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-500 transition"
>
  Elimina
</button>

                                </div>
                              
{(playersByBetId.get(bs.bet.id) ?? []).length > 0 && (
  <div className="mt-2 text-xs text-zinc-400">
    Giocata da: {(playersByBetId.get(bs.bet.id) ?? []).join(", ")}
  </div>
)}

                                <div className="mt-3 flex flex-wrap gap-2">
                                  {bs.legs.map((l, idx) => (
                                    <LegCard key={l.id} leg={l} idx={idx} />
                                  ))}
                                </div>

                                <div className="mt-2 flex items-start justify-between gap-4">
  <div className="text-xs text-zinc-500">
    Stake: {euro(bs.stakeTotal)} — Payout: {euro(bs.payoutTotal)}
  </div>

  <div className="text-xs text-right space-y-1">
  {Array.from(splitProfitWithBonus(bs.profit, bs.bet.id).entries()).map(([name, val]) => (
    <div key={name} className="font-semibold">
      <span className="text-zinc-100">{name}:</span>{" "}
      <span className={signClass(val, isDay)}>
        {val >= 0 ? "+" : ""}
        {euro(val)}
      </span>
    </div>
  ))}
</div>

</div>

                              </div>
                            ))}
                          </div>
                        </details>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* MODAL: Modifica data/ora bet */}
      {openEditBet && (
        <div className="fixed inset-0 z-50 bg-black/60 p-4 flex items-center justify-center">
          <div
  className={[
    "w-full max-w-xl rounded-2xl border p-4",
    isDay ? "border-[#E5DFD3] bg-[#FFFDF8] text-slate-900" : "border-zinc-800 bg-zinc-950 text-zinc-100",
  ].join(" ")}
>

            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Modifica data/ora bet</h2>
              <button
                onClick={() => setOpenEditBet(false)}
                className={[
  "rounded-xl px-3 py-2 text-sm font-semibold transition",
  isDay ? "bg-white border border-[#D8D1C3] text-slate-800 hover:bg-[#F4F0E6]" : "bg-zinc-800 text-zinc-200 hover:bg-zinc-700",
].join(" ")}

              >
                Chiudi
              </button>
            </div>

            {editBetErr && (
              <div className="mt-4 rounded-xl border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-200">
                {editBetErr}
              </div>
            )}

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className={`text-sm ${isDay ? "text-slate-700" : "text-zinc-300"}`}>

                Data
                <input
                  type="date"
                  value={editBetDate}
                  onChange={(e) => setEditBetDate(e.target.value)}
                  className={inputCls}

                />
              </label>

              <label className={`text-sm ${isDay ? "text-slate-700" : "text-zinc-300"}`}>

                Ora
                <input
                  type="time"
                  value={editBetTime}
                  onChange={(e) => setEditBetTime(e.target.value)}
                  className={inputCls}

                />
              </label>
            </div>

            <button
              onClick={saveEditBet}
              className="mt-6 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold hover:bg-emerald-600"
            >
              Salva
            </button>
          </div>
        </div>
      )}

      {/* MODAL: Modifica leg */}
      {openEdit && (
        <div className="fixed inset-0 z-50 bg-black/60 p-4 flex items-center justify-center">
          <div
  className={[
    "w-full max-w-xl rounded-2xl border p-4",
    isDay ? "border-[#E5DFD3] bg-[#FFFDF8] text-slate-900" : "border-zinc-800 bg-zinc-950 text-zinc-100",
  ].join(" ")}
>

            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Modifica leg</h2>
              <button
                onClick={() => setOpenEdit(false)}
                className={[
  "rounded-xl px-3 py-2 text-sm font-semibold transition",
  isDay ? "bg-white border border-[#D8D1C3] text-slate-800 hover:bg-[#F4F0E6]" : "bg-zinc-800 text-zinc-200 hover:bg-zinc-700",
].join(" ")}

              >
                Chiudi
              </button>
            </div>

            {editErr && (
              <div className="mt-4 rounded-xl border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-200">
                {editErr}
              </div>
            )}

            <div className="mt-4 grid grid-cols-1 gap-3">
              <div>
                <SearchSelect
  label="Bookmaker / Persona"
  value={editAccountId}
  options={allAccountOptions}
  onChange={setEditAccountId}
  isDay={isDay}
/>

              </div>

              <label className={`text-sm ${isDay ? "text-slate-700" : "text-zinc-300"}`}>

                Importo
                <input
                  value={editStake}
                  onChange={(e) => setEditStake(e.target.value)}
                  className={inputCls}
                />
              </label>

              <label className={`text-sm ${isDay ? "text-slate-700" : "text-zinc-300"}`}>

                Quota
                <input
                  value={editOdds}
                  onChange={(e) => setEditOdds(e.target.value)}
                  className={inputCls}
                />
              </label>

              <button
                onClick={saveEditLeg}
                className="rounded-xl bg-blue-800 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition"
              >
                Salva modifiche
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
