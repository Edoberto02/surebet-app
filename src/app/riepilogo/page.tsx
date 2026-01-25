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

type BetLeg = {
  id: string;
  bet_id: string;
  stake: number;
  odds: number;
  status: "open" | "win" | "loss";
  created_at: string;
};

type AdjustmentRow = { id: string; created_at: string; amount: number; note: string | null };

type PersonRow = { id: string; name: string };
type PaymentMethodRow = { id: string; owner_person_id: string; label: string; method_type: string | null; last4: string | null };

type PaymentMethodPanelRow = {
  person_name: string;
  method: string;
  balance: number;
  in_transito: number;
  totale: number;
};

type PartnerCashOpRow = {
  id: string;
  created_at: string;
  partner_id: string;
  payment_method_id: string;
  kind: "deposit" | "withdraw";
  amount: number;
  note: string | null;
};

type BetPlayerRow = { bet_id: string; partner: { id: string; name: string } };
type BetAllocationRow = { bet_id: string; partner_id: string; amount: number };


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
function toNumberInput(s: string) {
  return Number(String(s).replace(",", "."));
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

  const [people, setPeople] = useState<PersonRow[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodRow[]>([]);
  const [pmPanel, setPmPanel] = useState<PaymentMethodPanelRow[]>([]);
  const [cashOps, setCashOps] = useState<PartnerCashOpRow[]>([]);
  const [betPlayers, setBetPlayers] = useState<BetPlayerRow[]>([]);
  const [betAllocs, setBetAllocs] = useState<BetAllocationRow[]>([]);


  // modal prelievo/deposito
  const [openCash, setOpenCash] = useState(false);
  const [cashPartnerId, setCashPartnerId] = useState<string>("");
  const [cashPmId, setCashPmId] = useState<string>("");
  const [cashKind, setCashKind] = useState<"withdraw" | "deposit">("withdraw");
  const [cashAmount, setCashAmount] = useState<string>("");
  const [cashNote, setCashNote] = useState<string>("");
  const [cashUiErr, setCashUiErr] = useState<string>("");

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

      { data: ppl, error: pplErr },
      { data: pm, error: pmErr },
      { data: panel, error: panelErr },

      { data: ops, error: opsErr },
      { data: bp, error: bpe },
      { data: ba, error: bae },

    ] = await Promise.all([
      supabase.from("partners").select("id,name").order("name"),
      supabase.from("equity_events").select("id,created_at,partner_id,cash_in,units_minted,note").order("created_at", { ascending: true }),
      supabase.rpc("current_capital_including_transit"),

      supabase.from("bets").select("id,match_date,match_time").gte("match_date", sinceISO).order("match_date", { ascending: false }).order("match_time", { ascending: false }).limit(5000),

      supabase.from("bet_legs").select("id,bet_id,stake,odds,status,created_at").order("created_at", { ascending: true }).order("id", { ascending: true }).limit(50000),

      supabase.from("balance_adjustments").select("id,created_at,amount,note").gte("created_at", sinceISO + "T00:00:00Z").order("created_at", { ascending: false }).limit(5000),

      supabase.from("people").select("id,name").order("name"),
      supabase.from("payment_methods").select("id,owner_person_id,label,method_type,last4").order("label"),

      supabase.from("v_payment_methods_panel").select("person_name,method,balance,in_transito,totale"),

      supabase.from("partner_cash_ops").select("id,created_at,partner_id,payment_method_id,kind,amount,note").order("created_at", { ascending: false }).limit(5000),

      supabase.from("bet_players").select("bet_id, partner:partners(id,name)").limit(50000),
      supabase.from("bet_allocations").select("bet_id,partner_id,amount").limit(50000),

    ]);

    const err = pe || ee || ce || be || ble || adje || pplErr || pmErr || panelErr || opsErr || bpe || bae;


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

    setPeople((ppl ?? []) as PersonRow[]);
    setPaymentMethods((pm ?? []) as PaymentMethodRow[]);
    setPmPanel((panel ?? []) as PaymentMethodPanelRow[]);

    setCashOps((ops ?? []) as PartnerCashOpRow[]);

    const bpClean: BetPlayerRow[] = (bp ?? [])
      .filter((row: any) => !!row.partner)
      .map((row: any) => ({ bet_id: row.bet_id, partner: row.partner }));

    setBetPlayers(bpClean);
    setBetAllocs((ba ?? []) as BetAllocationRow[]);


    setLoading(false);
  }

  useEffect(() => {
    loadAll(true);
    const interval = setInterval(() => loadAll(false), 10000);
    return () => clearInterval(interval);
  }, [sinceISO]);

  // ===== QUOTE (equity_events) =====
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

  const capitalProQuotaByPartnerId = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of table) m.set(r.id, Number(r.capitalProQuota ?? 0));
    return m;
  }, [table]);

  const personNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of people) m.set(p.id, p.name);
    return m;
  }, [people]);

  const paymentMethodsForSelectedPartner = useMemo(() => {
    const partner = partners.find((x) => x.id === cashPartnerId);
    if (!partner) return [];
    return paymentMethods
      .filter((pm) => personNameById.get(pm.owner_person_id) === partner.name)
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [cashPartnerId, partners, paymentMethods, personNameById]);

  const selectedPartnerName = useMemo(() => {
    return partners.find((p) => p.id === cashPartnerId)?.name ?? "";
  }, [partners, cashPartnerId]);

  const selectedPmLabel = useMemo(() => {
    return paymentMethods.find((pm) => pm.id === cashPmId)?.label ?? "";
  }, [paymentMethods, cashPmId]);

  const pmBalanceByPersonAndMethod = useMemo(() => {
    const m = new Map<string, { balance: number; totale: number; in_transito: number }>();
    for (const r of pmPanel) {
      m.set(`${r.person_name}||${r.method}`, {
        balance: Number(r.balance ?? 0),
        totale: Number(r.totale ?? 0),
        in_transito: Number(r.in_transito ?? 0),
      });
    }
    return m;
  }, [pmPanel]);

  const selectedPmBalances = useMemo(() => {
    if (!selectedPartnerName || !selectedPmLabel) return { balance: 0, totale: 0, in_transito: 0 };
    return pmBalanceByPersonAndMethod.get(`${selectedPartnerName}||${selectedPmLabel}`) ?? { balance: 0, totale: 0, in_transito: 0 };
  }, [pmBalanceByPersonAndMethod, selectedPartnerName, selectedPmLabel]);

  const cashNetByPartnerId = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of partners) m.set(p.id, 0);
    for (const op of cashOps) {
      const signed = op.kind === "deposit" ? Number(op.amount ?? 0) : -Number(op.amount ?? 0);
      m.set(op.partner_id, (m.get(op.partner_id) ?? 0) + signed);
    }
    return m;
  }, [cashOps, partners]);

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
  // Profit per bet (solo bet CHIUSE) → Map<bet_id, profit>
const profitByBetId = useMemo(() => {
  const m = new Map<string, number>();
  for (const b of bets) {
    const legs = legsByBet.get(b.id) ?? [];
    if (legs.length === 0) continue;

    const isClosed = legs.every((x) => x.status !== "open");
    if (!isClosed) continue;

    const stakeTotal = legs.reduce((s, x) => s + Number(x.stake ?? 0), 0);
    const payoutTotal = legs.reduce((s, x) => s + (x.status === "win" ? Number(x.stake ?? 0) * Number(x.odds ?? 0) : 0), 0);
    m.set(b.id, payoutTotal - stakeTotal);
  }
  return m;
}, [bets, legsByBet]);

// Quota per socio → Map<partner_id, quota>
const quotaByPartnerId = useMemo(() => {
  const m = new Map<string, number>();
  for (const r of table) m.set(r.id, Number(r.quota ?? 0));
  return m;
}, [table]);

// Bonus/Malus cumulato per socio (rispetto al pro-quota puro)
const bonusNetByPartnerId = useMemo(() => {
  const m = new Map<string, number>();
  for (const p of partners) m.set(p.id, 0);

  for (const a of betAllocs) {
    const profit = profitByBetId.get(a.bet_id);
    if (profit === undefined) continue;

    const q = quotaByPartnerId.get(a.partner_id) ?? 0;
    const base = profit * q;

    const net = Number(a.amount ?? 0) - base;
    m.set(a.partner_id, (m.get(a.partner_id) ?? 0) + net);
  }

  return m;
}, [betAllocs, profitByBetId, quotaByPartnerId, partners]);


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
      { monthTotal: number; monthBet: number; monthAdj: number; days: Array<{ dayISO: string; total: number; bet: number; adj: number }> }
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
    return months.map(([monthStart, m]) => ({ monthStart, ...m, days: m.days.sort((a, b) => (a.dayISO < b.dayISO ? 1 : -1)) }));
  }, [betProfitByDay, adjByDay]);

  function openCashModal() {
    setCashUiErr("");
    setCashPartnerId("");
    setCashPmId("");
    setCashKind("withdraw");
    setCashAmount("");
    setCashNote("");
    setOpenCash(true);
  }

  async function submitCashOp() {
    setCashUiErr("");
    setErrorMsg("");

    if (!cashPartnerId) return setCashUiErr("Seleziona il socio");
    if (!cashPmId) return setCashUiErr("Seleziona il metodo di pagamento");

    const amt = toNumberInput(cashAmount);
    if (!Number.isFinite(amt) || amt <= 0) return setCashUiErr("Importo non valido (>0)");

    const max = Number(capitalProQuotaByPartnerId.get(cashPartnerId) ?? 0);
    if (amt > max + 1e-9) return setCashUiErr(`Importo troppo alto. Max ${euro(max)}`);

    if (cashKind === "withdraw") {
      if (Number(selectedPmBalances.balance ?? 0) + 1e-9 < amt) {
        return setCashUiErr("Fondi insufficienti sul metodo di pagamento selezionato");
      }
    }

    const { error } = await supabase.rpc("apply_partner_cash_op", {
      p_partner_id: cashPartnerId,
      p_payment_method_id: cashPmId,
      p_kind: cashKind,
      p_amount: amt,
      p_note: cashNote.trim() || null,
    });

    if (error) {
      const msg = (error.message || "").toLowerCase();
      if (msg.includes("fondi insufficienti")) setCashUiErr("Fondi insufficienti sul metodo di pagamento selezionato");
      else setCashUiErr(error.message);
      return;
    }

    setOpenCash(false);
    await loadAll(false);
  }

  async function deleteCashOp(opId: string) {
    const ok = window.confirm("Eliminare questa operazione? (ripristina metodo e quota)");
    if (!ok) return;

    setErrorMsg("");
    const { error } = await supabase.rpc("delete_partner_cash_op", { p_op_id: opId });
    if (error) return setErrorMsg(error.message);

    await loadAll(false);
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Riepilogo</h1>

        <div className="flex items-center gap-2">
          <button
            onClick={openCashModal}
            className="rounded-xl bg-zinc-800 px-3 py-2 text-sm font-semibold hover:bg-zinc-700"
          >
            Prelievo/Deposito soci
          </button>
          <button
            onClick={() => loadAll(true)}
            className="rounded-xl bg-zinc-800 px-3 py-2 text-sm hover:bg-zinc-700"
          >
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
              <table className="min-w-[1200px] w-full border-collapse">
                <thead className="bg-zinc-900">
                  <tr>
                    <th className="px-3 py-2 text-left text-sm font-semibold text-zinc-200">Socio</th>
                    <th className="px-3 py-2 text-left text-sm font-semibold text-zinc-200">Capitale iniziale (netto)</th>
                    <th className="px-3 py-2 text-left text-sm font-semibold text-zinc-200">Prelievi/Depositi</th>
                    <th className="px-3 py-2 text-left text-sm font-semibold text-zinc-200">Quota</th>
                    <th className="px-3 py-2 text-left text-sm font-semibold text-zinc-200">Capitale pro-quota</th>
                    <th className="px-3 py-2 text-left text-sm font-semibold text-zinc-200">Guadagno pro-quota</th>
                    <th className="px-3 py-2 text-left text-sm font-semibold text-zinc-200">Bonus/Malus</th>
<th className="px-3 py-2 text-left text-sm font-semibold text-zinc-200">Guadagno reale</th>

                  </tr>
                </thead>
                <tbody>
                  {table.map((r) => {
                    const net = Number(cashNetByPartnerId.get(r.id) ?? 0);
                    const bonusNet = Number(bonusNetByPartnerId.get(r.id) ?? 0);
const gainReal = Number(r.gainProQuota ?? 0) + bonusNet;

                    return (
                      <tr key={r.id} className="border-t border-zinc-800">
                        <td className="px-3 py-2 text-sm font-medium text-zinc-100">{r.name}</td>
                        <td className="px-3 py-2 text-sm text-zinc-100">{euro(r.cashIn)}</td>
                        <td className={`px-3 py-2 text-sm font-semibold ${signClass(net)}`}>
                          {net >= 0 ? "+" : ""}
                          {euro(net)}
                        </td>
                        <td className="px-3 py-2 text-sm text-zinc-100">{(r.quota * 100).toFixed(2)}%</td>
                        <td className="px-3 py-2 text-sm text-zinc-100">{euro(r.capitalProQuota)}</td>
                        <td className={`px-3 py-2 text-sm font-semibold ${signClass(r.gainProQuota)}`}>
                          {r.gainProQuota >= 0 ? "+" : ""}
                          {euro(r.gainProQuota)}
                        </td>
                        <td className={`px-3 py-2 text-sm font-semibold ${signClass(bonusNet)}`}>
  {bonusNet >= 0 ? "+" : ""}
  {euro(bonusNet)}
</td>

<td className={`px-3 py-2 text-sm font-semibold ${signClass(gainReal)}`}>
  {gainReal >= 0 ? "+" : ""}
  {euro(gainReal)}
</td>

                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* P/L + Registro */}
          <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
              <h2 className="text-lg font-semibold">Profit/Loss mensile</h2>
              <div className="mt-1 text-sm text-zinc-400">Totale mese = Profit bet chiuse + Rettifiche</div>

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
                          </details>
                        ))}
                      </div>
                    </details>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
              <h2 className="text-lg font-semibold">Registro Prelievi/Depositi</h2>

              {cashOps.length === 0 ? (
                <div className="mt-3 text-sm text-zinc-500">Nessuna operazione.</div>
              ) : (
                <div className="mt-4 space-y-2">
                  {cashOps.map((op) => {
                    const partnerName = partners.find((p) => p.id === op.partner_id)?.name ?? op.partner_id;
                    const pmLabel = paymentMethods.find((pm) => pm.id === op.payment_method_id)?.label ?? op.payment_method_id;
                    const signed = op.kind === "deposit" ? op.amount : -op.amount;

                    return (
                      <div key={op.id} className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-xs text-zinc-400">{new Date(op.created_at).toLocaleString("it-IT")}</div>
                          <button
                            onClick={() => deleteCashOp(op.id)}
                            className="rounded-xl bg-red-800/70 px-3 py-2 text-xs font-semibold hover:bg-red-700"
                          >
                            Elimina
                          </button>
                        </div>

                        <div className="mt-2 text-sm text-zinc-200">{partnerName}</div>
                        <div className="text-xs text-zinc-400">{pmLabel}</div>
                        <div className={`mt-1 text-sm font-semibold ${signClass(signed)}`}>
                          {signed >= 0 ? "+" : ""}
                          {euro(signed)}
                        </div>
                        {op.note && <div className="mt-1 text-xs text-zinc-400">{op.note}</div>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* MODAL: Prelievo/Deposito soci */}
      {openCash && (
        <div className="fixed inset-0 z-50 bg-black/60 p-4 flex items-center justify-center">
          <div className="w-full max-w-xl rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Prelievo/Deposito soci</h2>
              <button
                onClick={() => setOpenCash(false)}
                className="rounded-xl bg-zinc-800 px-3 py-2 text-sm hover:bg-zinc-700"
              >
                Chiudi
              </button>
            </div>

            {cashUiErr && (
              <div className="mt-4 rounded-xl border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-200">
                {cashUiErr}
              </div>
            )}

            <div className="mt-4 grid grid-cols-1 gap-3">
              <label className="text-sm text-zinc-300">
                Socio
                <select
                  value={cashPartnerId}
                  onChange={(e) => {
                    setCashPartnerId(e.target.value);
                    setCashPmId("");
                    setCashUiErr("");
                  }}
                  className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                  style={{ colorScheme: "dark" }}
                >
                  <option value="">Seleziona…</option>
                  {partners.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm text-zinc-300">
                Tipo
                <select
                  value={cashKind}
                  onChange={(e) => {
                    setCashKind(e.target.value as any);
                    setCashUiErr("");
                  }}
                  className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                  style={{ colorScheme: "dark" }}
                >
                  <option value="withdraw">Prelievo</option>
                  <option value="deposit">Deposito</option>
                </select>
              </label>

              <label className="text-sm text-zinc-300">
                Metodo di pagamento
                <select
                  value={cashPmId}
                  onChange={(e) => {
                    setCashPmId(e.target.value);
                    setCashUiErr("");
                  }}
                  className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                  style={{ colorScheme: "dark" }}
                >
                  <option value="">Seleziona…</option>
                  {paymentMethodsForSelectedPartner
                    .filter((pm) => pm.label !== "__ESTERNO__")
                    .map((pm) => {
                      const bal =
                        pmBalanceByPersonAndMethod.get(`${selectedPartnerName}||${pm.label}`)?.balance ?? 0;

                      return (
                        <option key={pm.id} value={pm.id}>
                          {pm.label} (saldo {euro(bal)})
                        </option>
                      );
                    })}
                </select>
              </label>

              <label className="text-sm text-zinc-300">
                Importo
                <input
                  value={cashAmount}
                  onChange={(e) => setCashAmount(e.target.value)}
                  placeholder="es. 500"
                  className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                />
                <div className="mt-1 text-xs text-zinc-400">
                  Max {euro(Number(capitalProQuotaByPartnerId.get(cashPartnerId) ?? 0))}
                </div>
              </label>

              <label className="text-sm text-zinc-300">
                Nota (opzionale)
                <input
                  value={cashNote}
                  onChange={(e) => setCashNote(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                />
              </label>

              <button
                onClick={submitCashOp}
                className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold hover:bg-emerald-600"
              >
                Conferma
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
