"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type Account = { id: string; person_name: string; bookmaker_name: string; balance: number };

type Bet = { id: string; match_date: string; match_time: string; note: string | null; created_at: string };

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

function euro(n: number) {
  const v = Number.isFinite(n) ? n : 0;
  return v.toLocaleString("it-IT", { style: "currency", currency: "EUR" });
}
function toNumber(s: string) {
  return Number(String(s).replace(",", "."));
}
function signClass(n: number) {
  if (Math.abs(n) < 1e-9) return "text-zinc-400";
  return n > 0 ? "text-emerald-300" : "text-red-300";
}
function monthLabel(monthStartISO: string) {
  const d = new Date(monthStartISO + "T00:00:00");
  const txt = new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric" }).format(d);
  return txt.charAt(0).toUpperCase() + txt.slice(1);
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
}: {
  label: string;
  value: string;
  options: Option[];
  placeholder?: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const selectedLabel = useMemo(() => options.find((o) => o.id === value)?.label ?? "", [options, value]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return options;
    return options.filter((o) => o.label.toLowerCase().includes(qq));
  }, [options, q]);

  return (
    <div className="relative">
      <div className="text-sm text-zinc-300">{label}</div>

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
        className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none"
      />

      {open && (
        <div className="absolute z-20 mt-2 max-h-56 w-full overflow-auto rounded-xl border border-zinc-700 bg-zinc-950 shadow">
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
                className="block w-full px-3 py-2 text-left text-sm text-zinc-100 hover:bg-zinc-800"
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
}: {
  status: "open" | "win" | "loss";
  onSet: (s: "open" | "win" | "loss") => void;
}) {
  const base = "rounded-lg px-3 py-1 text-xs font-semibold border border-zinc-700";
  const openCls =
    status === "open" ? "bg-zinc-800 text-zinc-100" : "bg-zinc-950 text-zinc-300 hover:bg-zinc-900";
  const winCls =
    status === "win"
      ? "bg-emerald-700/80 text-emerald-100 border-emerald-600"
      : "bg-zinc-950 text-zinc-300 hover:bg-zinc-900";
  const lossCls =
    status === "loss"
      ? "bg-red-800/70 text-red-100 border-red-700"
      : "bg-zinc-950 text-zinc-300 hover:bg-zinc-900";

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
    const [{ data: b, error: be }, { data: l, error: le }] = await Promise.all([
      supabase
        .from("bets")
        .select("id,match_date,match_time,note,created_at")
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
    ]);

    if (be || le) {
      setMsg((be || le)!.message);
      setLoading(false);
      return;
    }

    const betsList = (b ?? []) as Bet[];
    const legsList = (l ?? []) as BetLeg[];

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

    setMsg("✅ Bet salvata");
    setNewDate("");
    setNewTime("");
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

  // Trovo la leg corrente (per capire a quale bet appartiene)
  const current = legs.find((x) => x.id === legId);
  if (!current) return;

  const betId = current.bet_id;

  // Aggiorno su Supabase
  const { error } = await supabase.from("bet_legs").update({ status }).eq("id", legId);
  if (error) return setMsg(error.message);

  // Aggiorno subito lo stato in UI (senza refresh totale)
  setLegs((prev) => prev.map((x) => (x.id === legId ? { ...x, status } : x)));

  // Capisco se ORA la bet è chiusa (cioè nessuna leg è più open)
  const nextLegsForBet = legs
    .filter((x) => x.bet_id === betId)
    .map((x) => (x.id === legId ? { ...x, status } : x));

  const isNowClosed = nextLegsForBet.every((x) => x.status !== "open");

  // Se è chiusa, allora faccio il refresh completo UNA VOLTA SOLA
  // e mantengo la posizione scroll (così non torna su)
  if (isNowClosed) {
    const y = window.scrollY;
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
      <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs">
        <div className="flex items-center justify-between gap-2">
          <div className="text-zinc-500 font-semibold">Leg {idx + 1}</div>
          <Logo accountId={leg.account_id} />
        </div>
        <div className="mt-1 text-zinc-300">{meta?.label ?? leg.account_id}</div>
        <div className="text-zinc-100">
          importo: <span className="font-semibold">{euro(leg.stake)}</span>
        </div>
        <div className="text-zinc-100">
          quota: <span className="font-semibold">{leg.odds}</span>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
  <StatusPills status={leg.status} onSet={(s) => setLegStatus(leg.id, s)} />
  <button
  type="button"
  onClick={() => openEditLeg(leg)}
  className="rounded-lg border border-yellow-600 bg-yellow-900/40 px-3 py-1 text-xs font-semibold text-yellow-200 hover:bg-yellow-800/60"
>
  Modifica
</button>

</div>

      </div>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Scommesse</h1>
        <button onClick={loadAll} className="rounded-xl bg-zinc-800 px-3 py-2 text-sm hover:bg-zinc-700">
          Aggiorna
        </button>
      </div>

      {msg && (
        <div className="mt-4 whitespace-pre-wrap rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 text-sm">
          {msg}
        </div>
      )}

      {loading ? (
        <div className="mt-6 text-zinc-400">Caricamento…</div>
      ) : (
        <>
          {/* Nuova bet */}
          <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Nuova bet</h2>
              <label className="text-sm text-zinc-300">
                Tipo
                <select
                  value={betMode}
                  onChange={(e) => setBetMode(e.target.value as any)}
                  className="ml-2 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                  style={{ colorScheme: "dark" }}
                >
                  <option value="surebet">Surebet / Multipla (2+)</option>
                  <option value="single">Singola (1)</option>
                </select>
              </label>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="text-sm text-zinc-300">
                Data partita
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                />
              </label>

              <label className="text-sm text-zinc-300">
                Ora partita
                <input
                  type="time"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                />
              </label>
            </div>

            <div className="mt-6 flex items-center justify-between">
              <h3 className="text-base font-semibold">Legs</h3>
              <button onClick={addNewLeg} className="rounded-xl bg-zinc-800 px-3 py-2 text-sm hover:bg-zinc-700">
                + Aggiungi sito
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {newLegs.map((l, i) => (
                <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-950/30 p-3">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
                    <div className="md:col-span-2">
                      <SearchSelect label="Sito" value={l.account_id} options={accountOptions} onChange={(id) => updateNewLeg(i, { account_id: id })} />
                    </div>

                    <label className="text-sm text-zinc-300">
                      Importo
                      <input value={l.stake} onChange={(e) => updateNewLeg(i, { stake: e.target.value })}
                        className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100" />
                    </label>

                    <label className="text-sm text-zinc-300">
                      Quota
                      <input value={l.odds} onChange={(e) => updateNewLeg(i, { odds: e.target.value })}
                        className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100" />
                    </label>

                    <label className="text-sm text-zinc-300">
                      Esito
                      <select value={l.status} onChange={(e) => updateNewLeg(i, { status: e.target.value as any })}
                        className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                        style={{ colorScheme: "dark" }}
                      >
                        <option value="open">open</option>
                        <option value="win">win</option>
                        <option value="loss">loss</option>
                      </select>
                    </label>
                  </div>

                  <div className="mt-3">
                    <button onClick={() => removeNewLeg(i)} className="rounded-xl bg-zinc-800 px-3 py-2 text-xs font-semibold hover:bg-zinc-700">
                      Rimuovi leg
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button onClick={saveNewBet} className="mt-6 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold hover:bg-emerald-600">
              Salva bet
            </button>
          </div>

                    {/* In corso */}
          <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">In corso</h2>
              <div className="text-sm text-zinc-400">{inProgress.length} bet</div>
            </div>

            {inProgress.length === 0 ? (
              <div className="mt-3 text-zinc-500">Nessuna bet in corso.</div>
            ) : (
              <div className="mt-4 space-y-3">
                {inProgress.map((bs) => (
                  <div key={bs.bet.id} className="rounded-xl border border-zinc-800 bg-zinc-950/30 p-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-zinc-200">
                        {bs.bet.match_date} — {(bs.bet.match_time ?? "").slice(0, 5)}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEditBetModal(bs.bet)}
                          className="rounded-xl bg-zinc-800 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-700"
                        >
                          Modifica data/ora
                        </button>

                        <button
                          onClick={() => deleteBet(bs.bet.id)}
                          className="rounded-xl bg-red-800/70 px-3 py-2 text-xs font-semibold hover:bg-red-700"
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
          <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Storico (chiuse)</h2>
              <div className="text-sm text-zinc-400">{closed.length} bet</div>
            </div>

            {closedGrouped.length === 0 ? (
              <div className="mt-3 text-zinc-500">Nessuna bet chiusa.</div>
            ) : (
              <div className="mt-4 space-y-3">
                {closedGrouped.map((m) => (
                  <details key={m.monthStart} className="rounded-xl border border-zinc-800 bg-zinc-950/30">
                    <summary className="cursor-pointer select-none px-4 py-3 flex items-center justify-between">
                      <div className="text-sm font-semibold text-zinc-100">{monthLabel(m.monthStart)}</div>
                      <div className={`text-sm font-semibold ${signClass(m.monthProfit)}`}>
                        {m.monthProfit >= 0 ? "+" : ""}
                        {euro(m.monthProfit)}
                      </div>
                    </summary>

                    <div className="px-4 pb-4 space-y-2">
                      {m.days.map((d) => (
                        <details key={d.dayISO} className="rounded-xl border border-zinc-800 bg-zinc-950/40">
                          <summary className="cursor-pointer select-none px-4 py-3 flex items-center justify-between">
                            <div className="text-sm text-zinc-100">{d.dayISO}</div>
                            <div className={`text-sm font-semibold ${signClass(d.dayProfit)}`}>
                              {d.dayProfit >= 0 ? "+" : ""}
                              {euro(d.dayProfit)}
                            </div>
                          </summary>

                          <div className="px-4 pb-4 space-y-3">
                            {d.bets.map((bs) => (
                              <div key={bs.bet.id} className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-3">
                                <div className="flex items-center justify-between">
                                  <div className="text-sm text-zinc-200">
                                    {(bs.bet.match_time ?? "").slice(0, 5)} —{" "}
                                    <span className={`font-semibold ${signClass(bs.profit)}`}>
                                      {bs.profit >= 0 ? "+" : ""}
                                      {euro(bs.profit)}
                                    </span>
                                  </div>

                                  <button
                                    onClick={() => deleteBet(bs.bet.id)}
                                    className="rounded-xl bg-red-800/70 px-3 py-2 text-xs font-semibold hover:bg-red-700"
                                  >
                                    Elimina
                                  </button>
                                </div>

                                <div className="mt-3 flex flex-wrap gap-2">
                                  {bs.legs.map((l, idx) => (
                                    <LegCard key={l.id} leg={l} idx={idx} />
                                  ))}
                                </div>

                                <div className="mt-2 text-xs text-zinc-500">
                                  Stake: {euro(bs.stakeTotal)} — Payout: {euro(bs.payoutTotal)}
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
          <div className="w-full max-w-xl rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Modifica data/ora bet</h2>
              <button
                onClick={() => setOpenEditBet(false)}
                className="rounded-xl bg-zinc-800 px-3 py-2 text-sm hover:bg-zinc-700"
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
              <label className="text-sm text-zinc-300">
                Data
                <input
                  type="date"
                  value={editBetDate}
                  onChange={(e) => setEditBetDate(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                />
              </label>

              <label className="text-sm text-zinc-300">
                Ora
                <input
                  type="time"
                  value={editBetTime}
                  onChange={(e) => setEditBetTime(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
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
          <div className="w-full max-w-xl rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Modifica leg</h2>
              <button
                onClick={() => setOpenEdit(false)}
                className="rounded-xl bg-zinc-800 px-3 py-2 text-sm hover:bg-zinc-700"
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
                />
              </div>

              <label className="text-sm text-zinc-300">
                Importo
                <input
                  value={editStake}
                  onChange={(e) => setEditStake(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                />
              </label>

              <label className="text-sm text-zinc-300">
                Quota
                <input
                  value={editOdds}
                  onChange={(e) => setEditOdds(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                />
              </label>

              <button
                onClick={saveEditLeg}
                className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold hover:bg-emerald-600"
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
