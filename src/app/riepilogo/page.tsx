"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type Partner = { id: string; name: string };
type EquityEvent = {
  id: string;
  created_at: string;
  partner_id: string;
  cash_in: number;
  units_minted: number;
  note: string | null;
};

type Bet = { id: string; match_date: string; match_time: string };
type BetLeg = { id: string; bet_id: string; stake: number; odds: number; status: "open" | "win" | "loss"; created_at: string };

type AdjustmentRow = { id: string; created_at: string; amount: number; note: string | null };

function euro(n: number) {
  const v = Number.isFinite(n) ? n : 0;
  return v.toLocaleString("it-IT", { style: "currency", currency: "EUR" });
}
function isZero(n: number) {
  return Math.abs(n) < 1e-9;
}
function signClass(n: number) {
  if (isZero(n)) return "text-zinc-400";
  return n > 0 ? "text-emerald-300" : "text-red-300";
}
function monthLabel(monthStartISO: string) {
  const d = new Date(monthStartISO + "T00:00:00");
  const txt = new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric" }).format(d);
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}
function toLocalDayISO(isoDateTime: string) {
  return new Date(isoDateTime).toLocaleDateString("sv-SE");
}
function monthStartFromDay(dayISO: string) {
  return dayISO.slice(0, 7) + "-01";
}

function isBaselineAdjustment(note: string | null) {
  const n = (note ?? "").trim().toLowerCase();
  return n === "set saldo a valore";
}

export default function RiepilogoPage() {
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const [capital, setCapital] = useState<number>(0);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [events, setEvents] = useState<EquityEvent[]>([]);

  const [bets, setBets] = useState<Bet[]>([]);
  const [betLegs, setBetLegs] = useState<BetLeg[]>([]);
  const [adjustments, setAdjustments] = useState<AdjustmentRow[]>([]);

  const [openNew, setOpenNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCashIn, setNewCashIn] = useState("");
  const [newPayLabel, setNewPayLabel] = useState("");
  const [newNote, setNewNote] = useState("");

  const [openOp, setOpenOp] = useState(false);
  const [opPartnerId, setOpPartnerId] = useState<string>("");
  const [opAmount, setOpAmount] = useState("");
  const [opPayLabel, setOpPayLabel] = useState("");
  const [opNote, setOpNote] = useState("");

  const sinceISO = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 400);
    return d.toISOString().slice(0, 10);
  }, []);

  async function loadAll(showLoading: boolean) {
    if (showLoading) setLoading(true);
    setErrorMsg("");

    const [
      { data: p, error: pe },
      { data: e, error: ee },
      { data: cap, error: ce },
      { data: b, error: be },
      { data: bl, error: ble },
      { data: adj, error: adje },
    ] = await Promise.all([
      supabase.from("partners").select("id,name").order("name"),
      supabase.from("equity_events").select("id,created_at,partner_id,cash_in,units_minted,note").order("created_at", { ascending: true }),
      supabase.rpc("current_capital_including_transit"),

      supabase
        .from("bets")
        .select("id,match_date,match_time")
        .gte("match_date", sinceISO)
        .order("match_date", { ascending: false })
        .order("match_time", { ascending: false })
        .limit(5000),

      supabase
        .from("bet_legs")
        .select("id,bet_id,stake,odds,status,created_at")
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .limit(50000),

      // ✅ prendiamo anche note per poter filtrare "Set saldo a valore"
      supabase
        .from("balance_adjustments")
        .select("id,created_at,amount,note")
        .gte("created_at", sinceISO + "T00:00:00Z")
        .order("created_at", { ascending: false })
        .limit(5000),
    ]);

    const err = pe || ee || ce || be || ble || adje;
    if (err) {
      setErrorMsg(err.message);
      setLoading(false);
      return;
    }

    setPartners((p ?? []) as Partner[]);
    setEvents((e ?? []) as EquityEvent[]);
    setCapital(Number(cap ?? 0));

    setBets((b ?? []) as Bet[]);
    setBetLegs((bl ?? []) as BetLeg[]);
    setAdjustments((adj ?? []) as AdjustmentRow[]);

    setLoading(false);
  }

  useEffect(() => {
    loadAll(true);
    const interval = setInterval(() => loadAll(false), 2000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===== QUOTE =====
  const byPartner = useMemo(() => {
    const map = new Map<string, { cashIn: number; units: number }>();
    for (const p of partners) map.set(p.id, { cashIn: 0, units: 0 });
    for (const ev of events) {
      const cur = map.get(ev.partner_id) ?? { cashIn: 0, units: 0 };
      cur.cashIn += Number(ev.cash_in ?? 0);
      cur.units += Number(ev.units_minted ?? 0);
      map.set(ev.partner_id, cur);
    }
    return map;
  }, [partners, events]);

  const totalUnits = useMemo(() => {
    let s = 0;
    for (const v of byPartner.values()) s += v.units;
    return s;
  }, [byPartner]);

  const totalCashIn = useMemo(() => {
    let s = 0;
    for (const v of byPartner.values()) s += v.cashIn;
    return s;
  }, [byPartner]);

  const overallProfit = useMemo(() => capital - totalCashIn, [capital, totalCashIn]);

  const table = useMemo(() => {
    return partners
      .map((p) => {
        const v = byPartner.get(p.id) ?? { cashIn: 0, units: 0 };
        const quota = totalUnits > 0 ? v.units / totalUnits : 0;
        const capitalProQuota = capital * quota;
        const gainProQuota = capitalProQuota - v.cashIn;
        return { id: p.id, name: p.name, cashIn: v.cashIn, quota, capitalProQuota, gainProQuota };
      })
      .sort((a, b) => b.quota - a.quota);
  }, [partners, byPartner, totalUnits, capital]);

  // ===== MONTHLY P/L =====
  const legsByBet = useMemo(() => {
    const m = new Map<string, BetLeg[]>();
    for (const l of betLegs) {
      const arr = m.get(l.bet_id) ?? [];
      arr.push(l);
      m.set(l.bet_id, arr);
    }
    for (const [k, arr] of m.entries()) {
      arr.sort((x, y) => {
        if (x.created_at < y.created_at) return -1;
        if (x.created_at > y.created_at) return 1;
        return x.id.localeCompare(y.id);
      });
      m.set(k, arr);
    }
    return m;
  }, [betLegs]);

  const betProfitByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of bets) {
      const legs = legsByBet.get(b.id) ?? [];
      if (legs.length === 0) continue;
      const isClosed = legs.every((x) => x.status !== "open");
      if (!isClosed) continue;

      const stakeTotal = legs.reduce((s, x) => s + Number(x.stake ?? 0), 0);
      const payoutTotal = legs.reduce((s, x) => s + (x.status === "win" ? Number(x.stake ?? 0) * Number(x.odds ?? 0) : 0), 0);
      const profit = payoutTotal - stakeTotal;

      const day = b.match_date;
      map.set(day, (map.get(day) ?? 0) + profit);
    }
    return map;
  }, [bets, legsByBet]);

  // ✅ Rettifiche per giorno, ESCLUDENDO baseline "Set saldo a valore"
  const adjByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of adjustments) {
      if (isBaselineAdjustment(a.note)) continue;
      const day = toLocalDayISO(a.created_at);
      map.set(day, (map.get(day) ?? 0) + Number(a.amount ?? 0));
    }
    return map;
  }, [adjustments]);

  const monthlyPL = useMemo(() => {
    const daySet = new Set<string>();
    for (const d of betProfitByDay.keys()) daySet.add(d);
    for (const d of adjByDay.keys()) daySet.add(d);

    const dayList = Array.from(daySet).sort((a, b) => (a < b ? 1 : -1));

    const monthMap = new Map<
      string,
      {
        monthTotal: number;
        monthBet: number;
        monthAdj: number;
        days: Array<{ dayISO: string; total: number; bet: number; adj: number }>;
      }
    >();

    for (const day of dayList) {
      const bet = betProfitByDay.get(day) ?? 0;
      const adj = adjByDay.get(day) ?? 0;
      const total = bet + adj;

      const monthStart = monthStartFromDay(day);
      if (!monthMap.has(monthStart)) monthMap.set(monthStart, { monthTotal: 0, monthBet: 0, monthAdj: 0, days: [] });

      const m = monthMap.get(monthStart)!;
      m.monthTotal += total;
      m.monthBet += bet;
      m.monthAdj += adj;
      m.days.push({ dayISO: day, total, bet, adj });
    }

    const months = Array.from(monthMap.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
    return months.map(([monthStart, m]) => ({
      monthStart,
      ...m,
      days: m.days.sort((a, b) => (a.dayISO < b.dayISO ? 1 : -1)),
    }));
  }, [betProfitByDay, adjByDay]);

  // ===== ACTIONS =====
  async function submitNewPartner() {
    setErrorMsg("");
    const name = newName.trim();
    const cash = Number(newCashIn.replace(",", "."));

    if (!name) return setErrorMsg("Inserisci il nome del socio");
    if (!Number.isFinite(cash) || cash <= 0) return setErrorMsg("Conferimento non valido (>0)");
    if (!newPayLabel.trim()) return setErrorMsg("Inserisci il metodo di pagamento del nuovo socio");

    const { error } = await supabase.rpc("add_partner_capital_event", {
      p_partner_name: name,
      p_cash_in: cash,
      p_payment_label: newPayLabel.trim(),
      p_note: newNote.trim() || null,
    });
    if (error) return setErrorMsg(error.message);

    setOpenNew(false);
    setNewName("");
    setNewCashIn("");
    setNewPayLabel("");
    setNewNote("");
    await loadAll(false);
  }

  async function submitPartnerOp() {
    setErrorMsg("");
    const partner = partners.find((x) => x.id === opPartnerId);
    if (!partner) return setErrorMsg("Seleziona il socio");

    const amt = Number(opAmount.replace(",", "."));
    if (!Number.isFinite(amt) || amt === 0) return setErrorMsg("Importo non valido (negativo = prelievo)");
    if (!opPayLabel.trim()) return setErrorMsg("Inserisci il metodo di pagamento coinvolto");

    const { error } = await supabase.rpc("add_partner_capital_event", {
      p_partner_name: partner.name,
      p_cash_in: amt,
      p_payment_label: opPayLabel.trim(),
      p_note: opNote.trim() || null,
    });
    if (error) return setErrorMsg(error.message);

    setOpenOp(false);
    setOpPartnerId("");
    setOpAmount("");
    setOpPayLabel("");
    setOpNote("");
    await loadAll(false);
  }

  // UI
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Riepilogo</h1>

        <div className="flex items-center gap-2">
          <button onClick={() => setOpenNew(true)} className="rounded-xl bg-zinc-800 px-3 py-2 text-xs font-semibold hover:bg-zinc-700">
            + Nuovo socio
          </button>
          <button onClick={() => setOpenOp(true)} className="rounded-xl bg-zinc-800 px-3 py-2 text-xs font-semibold hover:bg-zinc-700">
            ± Operazione socio
          </button>
          <button onClick={() => loadAll(false)} className="rounded-xl bg-zinc-800 px-3 py-2 text-sm hover:bg-zinc-700">
            Aggiorna
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="mt-4 rounded-xl border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-200">
          Errore: {errorMsg}
        </div>
      )}

      {loading ? (
        <div className="mt-6 text-zinc-400">Caricamento…</div>
      ) : (
        <>
          {/* KPI */}
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
              <div className="text-sm text-zinc-400">Capitale attuale (live)</div>
              <div className="mt-1 text-2xl font-semibold">{euro(capital)}</div>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
              <div className="text-sm text-zinc-400">Conferimenti netti totali</div>
              <div className="mt-1 text-2xl font-semibold">{euro(totalCashIn)}</div>
              <div className="mt-1 text-xs text-zinc-500">Include prelievi (negativi).</div>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
              <div className="text-sm text-zinc-400">Profitto complessivo</div>
              <div className={`mt-1 text-2xl font-semibold ${signClass(overallProfit)}`}>
                {overallProfit >= 0 ? "+" : ""}
                {euro(overallProfit)}
              </div>
            </div>
          </div>

          {/* Soci */}
          <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
            <h2 className="text-lg font-semibold">Soci</h2>
            <div className="mt-4 overflow-auto rounded-xl border border-zinc-800">
              <table className="min-w-[900px] w-full border-collapse">
                <thead className="bg-zinc-900">
                  <tr>
                    <th className="px-3 py-2 text-left text-sm font-semibold text-zinc-200">Socio</th>
                    <th className="px-3 py-2 text-left text-sm font-semibold text-zinc-200">Capitale iniziale (netto)</th>
                    <th className="px-3 py-2 text-left text-sm font-semibold text-zinc-200">Quota</th>
                    <th className="px-3 py-2 text-left text-sm font-semibold text-zinc-200">Capitale pro-quota</th>
                    <th className="px-3 py-2 text-left text-sm font-semibold text-zinc-200">Guadagno pro-quota</th>
                  </tr>
                </thead>
                <tbody>
                  {table.map((r) => (
                    <tr key={r.id} className="border-t border-zinc-800">
                      <td className="px-3 py-2 text-sm font-medium text-zinc-100">{r.name}</td>
                      <td className="px-3 py-2 text-sm text-zinc-100">{euro(r.cashIn)}</td>
                      <td className="px-3 py-2 text-sm text-zinc-100">{(r.quota * 100).toFixed(2)}%</td>
                      <td className="px-3 py-2 text-sm text-zinc-100">{euro(r.capitalProQuota)}</td>
                      <td className={`px-3 py-2 text-sm font-semibold ${signClass(r.gainProQuota)}`}>
                        {r.gainProQuota >= 0 ? "+" : ""}
                        {euro(r.gainProQuota)}
                      </td>
                    </tr>
                  ))}
                  {table.length === 0 && (
                    <tr className="border-t border-zinc-800">
                      <td colSpan={5} className="px-3 py-3 text-sm text-zinc-500">Nessun socio.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Profit/Loss mensile */}
          <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
            <h2 className="text-lg font-semibold">Profit/Loss mensile</h2>
            <div className="mt-1 text-sm text-zinc-400">
              Totale mese = Profit bet chiuse + Rettifiche
            </div>

            {monthlyPL.length === 0 ? (
              <div className="mt-3 text-sm text-zinc-500">Nessun dato.</div>
            ) : (
              <div className="mt-4 space-y-3">
                {monthlyPL.map((m) => (
                  <details key={m.monthStart} className="rounded-xl border border-zinc-800 bg-zinc-950/30">
                    <summary className="cursor-pointer select-none px-4 py-3 flex items-center justify-between">
                      <div className="text-sm font-semibold text-zinc-100">{monthLabel(m.monthStart)}</div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className={`font-semibold ${signClass(m.monthTotal)}`}>
                          Totale {m.monthTotal >= 0 ? "+" : ""}{euro(m.monthTotal)}
                        </span>
                        <span className="text-zinc-400">
                          Bet {m.monthBet >= 0 ? "+" : ""}{euro(m.monthBet)} · Rett {m.monthAdj >= 0 ? "+" : ""}{euro(m.monthAdj)}
                        </span>
                      </div>
                    </summary>

                    <div className="px-4 pb-4 space-y-2">
                      {m.days.map((d) => (
                        <details key={d.dayISO} className="rounded-xl border border-zinc-800 bg-zinc-950/40">
                          <summary className="cursor-pointer select-none px-4 py-3 flex items-center justify-between">
                            <div className="text-sm text-zinc-100">{d.dayISO}</div>
                            <div className="flex items-center gap-4 text-sm">
                              <span className={`font-semibold ${signClass(d.total)}`}>
                                Totale {d.total >= 0 ? "+" : ""}{euro(d.total)}
                              </span>
                              <span className="text-zinc-400">
                                Bet {d.bet >= 0 ? "+" : ""}{euro(d.bet)} · Rett {d.adj >= 0 ? "+" : ""}{euro(d.adj)}
                              </span>
                            </div>
                          </summary>

                          <div className="px-4 pb-4 text-sm text-zinc-400">
                            Profitto bet del giorno + Totale rettifiche del giorno (baseline escluso)
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

      {/* MODAL: Nuovo socio */}
      {openNew && (
        <div className="fixed inset-0 z-50 bg-black/60 p-4 flex items-center justify-center">
          <div className="w-full max-w-xl rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Nuovo socio</h2>
              <button onClick={() => setOpenNew(false)} className="rounded-xl bg-zinc-800 px-3 py-2 text-sm hover:bg-zinc-700">
                Chiudi
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3">
              <label className="text-sm text-zinc-300">
                Nome socio
                <input value={newName} onChange={(e) => setNewName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100" />
              </label>

              <label className="text-sm text-zinc-300">
                Conferimento €
                <input value={newCashIn} onChange={(e) => setNewCashIn(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100" />
              </label>

              <label className="text-sm text-zinc-300">
                Metodo di pagamento iniziale
                <input value={newPayLabel} onChange={(e) => setNewPayLabel(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100" />
              </label>

              <label className="text-sm text-zinc-300">
                Nota (opzionale)
                <input value={newNote} onChange={(e) => setNewNote(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100" />
              </label>

              <button onClick={submitNewPartner} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold hover:bg-emerald-600">
                Crea socio
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Operazione socio */}
      {openOp && (
        <div className="fixed inset-0 z-50 bg-black/60 p-4 flex items-center justify-center">
          <div className="w-full max-w-xl rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Operazione socio (±)</h2>
              <button onClick={() => setOpenOp(false)} className="rounded-xl bg-zinc-800 px-3 py-2 text-sm hover:bg-zinc-700">
                Chiudi
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3">
              <label className="text-sm text-zinc-300">
                Socio
                <select value={opPartnerId} onChange={(e) => setOpPartnerId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                  style={{ colorScheme: "dark" }}
                >
                  <option value="">Seleziona…</option>
                  {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>

              <label className="text-sm text-zinc-300">
                Importo (+ conferimento / - prelievo)
                <input value={opAmount} onChange={(e) => setOpAmount(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100" />
              </label>

              <label className="text-sm text-zinc-300">
                Metodo di pagamento (dove entra/esce)
                <input value={opPayLabel} onChange={(e) => setOpPayLabel(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100" />
              </label>

              <label className="text-sm text-zinc-300">
                Nota (opzionale)
                <input value={opNote} onChange={(e) => setOpNote(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100" />
              </label>

              <button onClick={submitPartnerOp} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold hover:bg-emerald-600">
                Registra operazione
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
