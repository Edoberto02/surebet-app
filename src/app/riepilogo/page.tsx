"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useUIMode } from "../components/UIModeProvider";

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
type PaymentMethodRow = {
  id: string;
  owner_person_id: string;
  label: string;
  method_type: string | null;
  last4: string | null;
};

type PaymentMethodPanelRow = {
  person_name: string;
  method: string;
  balance: number;
  in_transito: number;
  totale: number;
};

type PeopleFeePanelRow = {
  person_id: string;
  person_name: string;
  fee_pct: number;
  fee_payment_method_id: string | null;
  payment_method_label: string | null;
  payment_method_balance: number | null;
  fee_generated: number;
  fee_withdrawn: number;
  fee_available: number;
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
type FeeWithdrawalRow = { id: string; created_at: string; amount: number; note: string | null };

type TxStatus = "pending" | "completed" | "cancelled";

function euro(n: number) {
  const v = Number.isFinite(n) ? n : 0;
  return v.toLocaleString("it-IT", { style: "currency", currency: "EUR" });
}
function isZero(n: number) {
  return Math.abs(n) < 0.005;
}
function balanceClass(n: number, isDay: boolean) {
  if (isZero(n)) {
    return isDay ? "text-slate-500 font-normal" : "text-zinc-400 font-normal";
  }
  if (n > 0) {
    return isDay ? "text-emerald-800 font-semibold" : "text-emerald-300 font-semibold";
  }
  return isDay ? "text-red-700 font-semibold" : "text-red-400 font-semibold";
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
  const { mode } = useUIMode();
  const isDay = mode === "day";

  const pageCls = isDay ? "min-h-screen bg-[#F4F0E6] text-slate-900" : "min-h-screen bg-zinc-950 text-zinc-100";
  const panelCls = isDay
    ? "rounded-2xl border border-[#E5DFD3] bg-[#FBF8F1]"
    : "rounded-2xl border border-zinc-800 bg-zinc-900/40";
  const innerCls = isDay ? "rounded-xl border border-[#E5DFD3] bg-[#FFFDF8]" : "rounded-xl border border-zinc-800 bg-zinc-950/30";
  const inputCls = isDay
    ? "mt-1 w-full rounded-xl border border-[#D8D1C3] bg-white px-3 py-2 text-sm text-slate-900 outline-none"
    : "mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none";

  const btnNeutral = isDay
    ? "rounded-xl border border-[#D8D1C3] bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-[#F4F0E6]"
    : "rounded-xl bg-zinc-800 px-3 py-2 text-sm hover:bg-zinc-700";

  const btnPrimary = isDay
    ? "rounded-xl bg-[#163D9C] px-4 py-2 text-sm font-semibold text-white hover:bg-[#12337F] transition"
    : "rounded-xl bg-blue-800 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition";

  const btnDanger = isDay
    ? "rounded-xl bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-500 transition"
    : "rounded-xl bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-500 transition";

  const btnSuccess = isDay
    ? "rounded-xl bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-600 transition"
    : "rounded-xl bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-600 transition";

  const headerCounterCls = isDay
    ? "rounded-xl border border-blue-200 bg-[#F7F5EE] px-3 py-2 text-sm font-semibold text-slate-900"
    : "rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm font-semibold text-zinc-100";

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
  const [peopleFeePanel, setPeopleFeePanel] = useState<PeopleFeePanelRow[]>([]);
  const [cashOps, setCashOps] = useState<PartnerCashOpRow[]>([]);
  const [betPlayers, setBetPlayers] = useState<BetPlayerRow[]>([]);
  const [betAllocs, setBetAllocs] = useState<BetAllocationRow[]>([]);

  // modal prelievo/deposito soci
  const [openCash, setOpenCash] = useState(false);
  const [cashPartnerId, setCashPartnerId] = useState<string>("");
  const [cashPmId, setCashPmId] = useState<string>("");
  const [cashKind, setCashKind] = useState<"withdraw" | "deposit">("withdraw");
  const [cashAmount, setCashAmount] = useState<string>("");
  const [cashNote, setCashNote] = useState<string>("");
  const [cashUiErr, setCashUiErr] = useState<string>("");

  // ===== Nuova persona (bookmaker prestati) =====
  const [newPersonOpen, setNewPersonOpen] = useState(false);
  const [newPersonName, setNewPersonName] = useState("");
  const [newPersonMethod, setNewPersonMethod] = useState("");
  const [newPersonFeePct, setNewPersonFeePct] = useState("0"); // es. 0.05 = 5%
  const [newPersonErr, setNewPersonErr] = useState("");

  // ===== Prelievo fee persona =====
  const [openFeeWithdraw, setOpenFeeWithdraw] = useState(false);
  const [feePersonId, setFeePersonId] = useState("");
  const [feeWithdrawAmount, setFeeWithdrawAmount] = useState("");
  const [feeWithdrawNote, setFeeWithdrawNote] = useState("");
  const [feeWithdrawErr, setFeeWithdrawErr] = useState("");

  // ===== Storico prelievi (gear) =====
  const [openFeeHistory, setOpenFeeHistory] = useState(false);
  const [feeHistoryPersonId, setFeeHistoryPersonId] = useState("");
  const [feeHistoryRows, setFeeHistoryRows] = useState<FeeWithdrawalRow[]>([]);
  const [feeHistoryErr, setFeeHistoryErr] = useState("");
  const [feeHistoryLoading, setFeeHistoryLoading] = useState(false);

  function openFeeWithdrawModal(personId: string) {
    setFeeWithdrawErr("");
    setFeePersonId(personId);
    setFeeWithdrawAmount("");
    setFeeWithdrawNote("");
    setOpenFeeWithdraw(true);
  }

  async function submitNewPerson() {
    setNewPersonErr("");
    setErrorMsg("");

    const name = newPersonName.trim();
    const label = newPersonMethod.trim();
    const pct = toNumberInput(newPersonFeePct);

    if (!name) return setNewPersonErr("Inserisci il nome");
    if (!label) return setNewPersonErr("Inserisci il metodo di pagamento");
    if (!Number.isFinite(pct) || pct < 0 || pct > 0.2) return setNewPersonErr("Fee non valida (usa es. 0.05 per 5% oppure 0)");

    const { error } = await supabase.rpc("create_fee_person", {
      p_person_name: name,
      p_payment_label: label,
      p_fee_pct: pct,
    });
    if (error) return setNewPersonErr(error.message);

    setNewPersonOpen(false);
    setNewPersonName("");
    setNewPersonMethod("");
    setNewPersonFeePct("0");

    await loadAll(false);
  }

  async function submitFeeWithdraw() {
    setFeeWithdrawErr("");
    setErrorMsg("");

    if (!feePersonId) return setFeeWithdrawErr("Persona non valida");
    const amt = toNumberInput(feeWithdrawAmount);
    if (!Number.isFinite(amt) || amt <= 0) return setFeeWithdrawErr("Importo non valido (>0)");

    const row = peopleFeePanel.find((x) => x.person_id === feePersonId);
    const available = Number(row?.fee_available ?? 0);
    if (amt > available + 1e-9) return setFeeWithdrawErr(`Importo troppo alto. Disponibile ${euro(available)}`);

    const { error } = await supabase.rpc("withdraw_person_fee", {
      p_person_id: feePersonId,
      p_amount: amt,
      p_note: feeWithdrawNote.trim() || null,
    });
    if (error) return setFeeWithdrawErr(error.message);

    setOpenFeeWithdraw(false);
    await loadAll(false);
  }

  async function openFeeHistoryModal(personId: string) {
    setFeeHistoryErr("");
    setFeeHistoryPersonId(personId);
    setFeeHistoryRows([]);
    setOpenFeeHistory(true);

    setFeeHistoryLoading(true);
    const { data, error } = await supabase
      .from("person_fee_withdrawals")
      .select("id,created_at,amount,note")
      .eq("person_id", personId)
      .order("created_at", { ascending: false })
      .limit(200);

    setFeeHistoryLoading(false);
    if (error) return setFeeHistoryErr(error.message);

    setFeeHistoryRows((data ?? []) as FeeWithdrawalRow[]);
  }

  async function cancelFeeWithdrawal(withdrawalId: string) {
    const ok = window.confirm("Annullare questo prelievo? (ripristina il saldo del metodo)");
    if (!ok) return;

    const { error } = await supabase.rpc("cancel_person_fee_withdrawal", {
      p_withdrawal_id: withdrawalId,
    });
    if (error) return alert(error.message);

    await loadAll(false);
    await openFeeHistoryModal(feeHistoryPersonId);
  }

  async function deleteLenderPerson(personId: string) {
    const row = peopleFeePanel.find((x) => x.person_id === personId);
    const available = Number(row?.fee_available ?? 0);

    if (Math.abs(available) > 0.009) {
      return alert("Puoi eliminare solo se Disponibile è 0€");
    }

    const ok = window.confirm("Eliminare questa persona? (rimuove anche accounts e metodi pagamento)");
    if (!ok) return;

    const { error } = await supabase.rpc("delete_lender_person_safe", { p_person_id: personId });
    if (error) return alert(error.message);

    await loadAll(false);
  }

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
      { data: pfp, error: pfpErr },
    ] = await Promise.all([
      supabase.from("partners").select("id,name").order("name"),
      supabase
        .from("equity_events")
        .select("id,created_at,partner_id,cash_in,units_minted,note")
        .order("created_at", { ascending: true }),
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

      supabase
        .from("balance_adjustments")
        .select("id,created_at,amount,note")
        .gte("created_at", sinceISO + "T00:00:00Z")
        .order("created_at", { ascending: false })
        .limit(5000),

      supabase.from("people").select("id,name").order("name"),
      supabase.from("payment_methods").select("id,owner_person_id,label,method_type,last4").order("label"),

      supabase.from("v_payment_methods_panel").select("person_name,method,balance,in_transito,totale"),

      supabase
        .from("partner_cash_ops")
        .select("id,created_at,partner_id,payment_method_id,kind,amount,note")
        .order("created_at", { ascending: false })
        .limit(5000),

      supabase.from("bet_players").select("bet_id, partner:partners(id,name)").limit(50000),
      supabase.from("bet_allocations").select("bet_id,partner_id,amount").limit(50000),
      supabase.from("v_people_fee_panel").select("*"),
    ]);

    const err = pe || ee || ce || be || ble || adje || pplErr || pmErr || panelErr || opsErr || bpe || bae || pfpErr;
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
    setPeopleFeePanel((pfp ?? []) as PeopleFeePanelRow[]);

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
    return (
      pmBalanceByPersonAndMethod.get(`${selectedPartnerName}||${selectedPmLabel}`) ?? { balance: 0, totale: 0, in_transito: 0 }
    );
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

  // ✅ Profit per bet (solo bet CHIUSE) calcolato per TUTTE le bet che hanno allocazioni
  const profitByBetId = useMemo(() => {
    const m = new Map<string, number>();

    const betIds = Array.from(new Set(betAllocs.map((x) => x.bet_id)));

    for (const betId of betIds) {
      const legs = legsByBet.get(betId) ?? [];
      if (legs.length === 0) continue;

      const isClosed = legs.every((x) => x.status !== "open");
      if (!isClosed) continue;

      const stakeTotal = legs.reduce((s, x) => s + Number(x.stake ?? 0), 0);
      const payoutTotal = legs.reduce(
        (s, x) => s + (x.status === "win" ? Number(x.stake ?? 0) * Number(x.odds ?? 0) : 0),
        0
      );

      m.set(betId, payoutTotal - stakeTotal);
    }

    return m;
  }, [betAllocs, legsByBet]);

  const quotaByPartnerId = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of table) m.set(r.id, Number(r.quota ?? 0));
    return m;
  }, [table]);

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
    <main className={`${pageCls} p-6`}>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Riepilogo</h1>

        <div className="flex items-center gap-2">
          <button onClick={openCashModal} className={btnPrimary}>
            Prelievo/Deposito soci
          </button>
          <button onClick={() => loadAll(true)} className={btnNeutral}>
            Aggiorna
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className={`mt-4 whitespace-pre-wrap rounded-xl p-3 text-sm ${innerCls}`}>
          <span className={isDay ? "text-red-700 font-semibold" : "text-red-200 font-semibold"}>Errore:</span>{" "}
          {errorMsg}
        </div>
      )}

      {loading ? (
        <div className={`mt-6 ${isDay ? "text-slate-600" : "text-zinc-400"}`}>Caricamento…</div>
      ) : (
        <>
          {/* KPI */}
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className={`${panelCls} p-4`}>
              <div className={isDay ? "text-sm text-slate-600" : "text-sm text-zinc-400"}>Capitale attuale (live)</div>
              <div className="mt-1 text-2xl font-semibold">{euro(capital)}</div>
            </div>

            <div className={`${panelCls} p-4`}>
              <div className={isDay ? "text-sm text-slate-600" : "text-sm text-zinc-400"}>Conferimenti netti totali</div>
              <div className="mt-1 text-2xl font-semibold">{euro(totalCashIn)}</div>
              <div className={isDay ? "mt-1 text-xs text-slate-500" : "mt-1 text-xs text-zinc-500"}>Include prelievi (negativi).</div>
            </div>

            <div className={`${panelCls} p-4`}>
              <div className={isDay ? "text-sm text-slate-600" : "text-sm text-zinc-400"}>Profitto complessivo</div>
              <div className={`mt-1 text-2xl font-semibold ${balanceClass(overallProfit, isDay)}`}>
                {overallProfit >= 0 ? "+" : ""}
                {euro(overallProfit)}
              </div>
            </div>
          </div>

          {/* Soci (HEADER BLU PREMIUM) */}
          <div className="mt-6 overflow-hidden rounded-2xl border border-blue-200">
            <div className="bg-gradient-to-r from-[#163D9C] to-blue-600 px-6 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold tracking-wide text-white">Soci</h2>
                  <div className="mt-1 text-sm text-blue-100">Quote, capitale pro-quota e bonus/malus</div>
                </div>
                <div className={headerCounterCls}>Soci: {partners.length}</div>
              </div>
            </div>

            <div className={`${panelCls} p-4`}>
              <div className={`overflow-auto rounded-xl ${isDay ? "border border-[#E5DFD3]" : "border border-zinc-800"}`}>
                <table className="min-w-[1200px] w-full border-collapse table-fixed">
                  <thead className={isDay ? "bg-[#FFFDF8]" : "bg-zinc-900"}>
                    <tr>
                      <th className={isDay ? "px-3 py-2 text-left text-sm font-semibold text-slate-800" : "px-3 py-2 text-left text-sm font-semibold text-zinc-200"}>Socio</th>
                      <th className={isDay ? "px-3 py-2 text-left text-sm font-semibold text-slate-800" : "px-3 py-2 text-left text-sm font-semibold text-zinc-200"}>Capitale iniziale (netto)</th>
                      <th className={isDay ? "px-3 py-2 text-left text-sm font-semibold text-slate-800" : "px-3 py-2 text-left text-sm font-semibold text-zinc-200"}>Prelievi/Depositi</th>
                      <th className={isDay ? "px-3 py-2 text-left text-sm font-semibold text-slate-800" : "px-3 py-2 text-left text-sm font-semibold text-zinc-200"}>Quota</th>
                      <th className={isDay ? "px-3 py-2 text-left text-sm font-semibold text-slate-800" : "px-3 py-2 text-left text-sm font-semibold text-zinc-200"}>Capitale pro-quota</th>
                      <th className={isDay ? "px-3 py-2 text-left text-sm font-semibold text-slate-800" : "px-3 py-2 text-left text-sm font-semibold text-zinc-200"}>Capitale reale</th>
                      <th className={isDay ? "px-3 py-2 text-left text-sm font-semibold text-slate-800" : "px-3 py-2 text-left text-sm font-semibold text-zinc-200"}>Guadagno pro-quota</th>
                      <th className={isDay ? "px-3 py-2 text-left text-sm font-semibold text-slate-800" : "px-3 py-2 text-left text-sm font-semibold text-zinc-200"}>Bonus/Malus</th>
                      <th className={isDay ? "px-3 py-2 text-left text-sm font-semibold text-slate-800" : "px-3 py-2 text-left text-sm font-semibold text-zinc-200"}>Guadagno reale</th>
                    </tr>
                  </thead>

                  {/* ✅ FIX: niente whitespace dentro colgroup */}
                  <colgroup><col className="w-[140px]" /><col className="w-[150px]" /><col className="w-[130px]" /><col className="w-[90px]" /><col className="w-[140px]" /><col className="w-[140px]" /><col className="w-[140px]" /><col className="w-[120px]" /><col className="w-[140px]" /></colgroup>

                  <tbody>
                    {table.map((r) => {
                      const net = Number(cashNetByPartnerId.get(r.id) ?? 0);
                      const bonusNet = Number(bonusNetByPartnerId.get(r.id) ?? 0);
                      const capitalReal = Number(r.capitalProQuota ?? 0) + bonusNet;
                      const gainReal = Number(r.gainProQuota ?? 0) + bonusNet;

                      return (
                        <tr key={r.id} className={isDay ? "border-t border-[#E5DFD3]" : "border-t border-zinc-800"}>
                          <td className={isDay ? "px-3 py-2 text-sm font-semibold text-slate-900" : "px-3 py-2 text-sm font-semibold text-zinc-100"}>{r.name}</td>
                          <td className={isDay ? "px-3 py-2 text-sm text-slate-900" : "px-3 py-2 text-sm text-zinc-100"}>{euro(r.cashIn)}</td>

                          <td className={`px-3 py-2 text-sm ${balanceClass(net, isDay)}`}>
                            {net >= 0 ? "+" : ""}
                            {euro(net)}
                          </td>

                          <td className={isDay ? "px-3 py-2 text-sm text-slate-900" : "px-3 py-2 text-sm text-zinc-100"}>{(r.quota * 100).toFixed(2)}%</td>
                          <td className={isDay ? "px-3 py-2 text-sm text-slate-900" : "px-3 py-2 text-sm text-zinc-100"}>{euro(r.capitalProQuota)}</td>
                          <td className={isDay ? "px-3 py-2 text-sm text-slate-900" : "px-3 py-2 text-sm text-zinc-100"}>{euro(capitalReal)}</td>

                          <td className={`px-3 py-2 text-sm ${balanceClass(r.gainProQuota, isDay)}`}>
                            {r.gainProQuota >= 0 ? "+" : ""}
                            {euro(r.gainProQuota)}
                          </td>

                          <td className={`px-3 py-2 text-sm ${balanceClass(bonusNet, isDay)}`}>
                            {bonusNet >= 0 ? "+" : ""}
                            {euro(bonusNet)}
                          </td>

                          <td className={`px-3 py-2 text-sm ${balanceClass(gainReal, isDay)}`}>
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
          </div>

          {/* Persone (HEADER BLU PREMIUM) */}
          <div className="mt-6 overflow-hidden rounded-2xl border border-blue-200">
            <div className="bg-gradient-to-r from-[#163D9C] to-blue-600 px-6 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold tracking-wide text-white">Persone</h2>
                  <div className="mt-1 text-sm text-blue-100">Bookmaker prestati, fee e prelievi</div>
                </div>
                <div className="flex items-center gap-2">
                  <div className={headerCounterCls}>Persone: {peopleFeePanel.length}</div>
                  <button
                    onClick={() => {
                      setNewPersonErr("");
                      setNewPersonOpen(true);
                    }}
                    className={btnPrimary}
                  >
                    + Nuova persona
                  </button>
                </div>
              </div>
            </div>

            <div className={`${panelCls} p-4`}>
              <div className={`overflow-auto rounded-xl ${isDay ? "border border-[#E5DFD3]" : "border border-zinc-800"}`}>
                <table className="min-w-[1100px] w-full border-collapse">
                  <thead className={isDay ? "bg-[#FFFDF8]" : "bg-zinc-900"}>
                    <tr>
                      <th className={isDay ? "px-3 py-2 text-left text-sm font-semibold text-slate-800" : "px-3 py-2 text-left text-sm font-semibold text-zinc-200"}>Persona</th>
                      <th className={isDay ? "px-3 py-2 text-left text-sm font-semibold text-slate-800" : "px-3 py-2 text-left text-sm font-semibold text-zinc-200"}>Fee</th>
                      <th className={isDay ? "px-3 py-2 text-left text-sm font-semibold text-slate-800" : "px-3 py-2 text-left text-sm font-semibold text-zinc-200"}>Metodo</th>
                      <th className={isDay ? "px-3 py-2 text-left text-sm font-semibold text-slate-800" : "px-3 py-2 text-left text-sm font-semibold text-zinc-200"}>Generato</th>
                      <th className={isDay ? "px-3 py-2 text-left text-sm font-semibold text-slate-800" : "px-3 py-2 text-left text-sm font-semibold text-zinc-200"}>Prelevato</th>
                      <th className={isDay ? "px-3 py-2 text-left text-sm font-semibold text-slate-800" : "px-3 py-2 text-left text-sm font-semibold text-zinc-200"}>Disponibile</th>
                      <th className={isDay ? "px-3 py-2 text-left text-sm font-semibold text-slate-800" : "px-3 py-2 text-left text-sm font-semibold text-zinc-200"}>Azioni</th>
                    </tr>
                  </thead>

                  <tbody>
                    {peopleFeePanel.map((r) => (
                      <tr key={r.person_id} className={isDay ? "border-t border-[#E5DFD3]" : "border-t border-zinc-800"}>
                        <td className={isDay ? "px-3 py-2 text-sm font-semibold text-slate-900" : "px-3 py-2 text-sm font-semibold text-zinc-100"}>{r.person_name}</td>
                        <td className={isDay ? "px-3 py-2 text-sm text-slate-900" : "px-3 py-2 text-sm text-zinc-100"}>{(Number(r.fee_pct ?? 0) * 100).toFixed(2)}%</td>
                        <td className={isDay ? "px-3 py-2 text-sm text-slate-900" : "px-3 py-2 text-sm text-zinc-100"}>{r.payment_method_label ?? "—"}</td>
                        <td className={isDay ? "px-3 py-2 text-sm text-slate-900" : "px-3 py-2 text-sm text-zinc-100"}>{euro(Number(r.fee_generated ?? 0))}</td>

                        <td className={isDay ? "px-3 py-2 text-sm text-slate-900" : "px-3 py-2 text-sm text-zinc-100"}>
                          <div className="flex items-center gap-2">
                            <span>{euro(Number(r.fee_withdrawn ?? 0))}</span>
                            <button
                              type="button"
                              onClick={() => openFeeHistoryModal(r.person_id)}
                              className={[
                                "h-7 w-7 rounded-lg border flex items-center justify-center",
                                isDay ? "border-[#D8D1C3] bg-white hover:bg-[#F4F0E6]" : "border-zinc-700 bg-zinc-950/40 hover:bg-zinc-800 hover:border-zinc-600",
                              ].join(" ")}
                              title="Storico prelievi"
                            >
                              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                                <circle cx="12" cy="5" r="1.6" />
                                <circle cx="12" cy="12" r="1.6" />
                                <circle cx="12" cy="19" r="1.6" />
                              </svg>
                            </button>
                          </div>
                        </td>

                        <td className={`px-3 py-2 text-sm ${balanceClass(Number(r.fee_available ?? 0), isDay)}`}>
                          {Number(r.fee_available ?? 0) >= 0 ? "+" : ""}
                          {euro(Number(r.fee_available ?? 0))}
                        </td>

                        <td className="px-3 py-2 text-sm">
                          <div className="flex items-center gap-2">
                            <button onClick={() => openFeeWithdrawModal(r.person_id)} className={btnSuccess}>
                              Preleva
                            </button>

                            <button
                              onClick={() => deleteLenderPerson(r.person_id)}
                              disabled={Math.abs(Number(r.fee_available ?? 0)) > 0.009}
                              className={[
                                "rounded-xl px-3 py-2 text-xs font-semibold",
                                Math.abs(Number(r.fee_available ?? 0)) > 0.009
                                  ? isDay
                                    ? "border border-[#D8D1C3] bg-white text-slate-400 cursor-not-allowed"
                                    : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                                  : isDay
                                    ? "bg-red-600 text-white hover:bg-red-500"
                                    : "bg-red-800/70 text-red-100 hover:bg-red-700",
                              ].join(" ")}
                              title={Math.abs(Number(r.fee_available ?? 0)) > 0.009 ? "Disponibile deve essere 0€" : "Elimina persona"}
                            >
                              Elimina
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* P/L + Registro */}
          <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Profit/Loss */}
            <div className={`${panelCls} p-4`}>
              <h2 className="text-lg font-semibold">Profit/Loss mensile</h2>
              <div className={isDay ? "mt-1 text-sm text-slate-600" : "mt-1 text-sm text-zinc-400"}>
                Totale mese = Profit bet chiuse + Rettifiche
              </div>

              {monthlyPL.length === 0 ? (
                <div className={isDay ? "mt-3 text-sm text-slate-500" : "mt-3 text-sm text-zinc-500"}>Nessun dato.</div>
              ) : (
                <div className="mt-4 space-y-3">
                  {monthlyPL.map((m) => (
                    <details key={m.monthStart} className={innerCls}>
                      <summary className="cursor-pointer select-none px-4 py-3 flex items-center justify-between">
                        <div className={isDay ? "text-sm font-semibold text-slate-900" : "text-sm font-semibold text-zinc-100"}>{monthLabel(m.monthStart)}</div>
                        <div className="flex items-center gap-4 text-sm">
                          <span className={`font-semibold ${balanceClass(m.monthTotal, isDay)}`}>
                            Totale {m.monthTotal >= 0 ? "+" : ""}
                            {euro(m.monthTotal)}
                          </span>
                          <span className={isDay ? "text-slate-500" : "text-zinc-400"}>
                            Bet {m.monthBet >= 0 ? "+" : ""}
                            {euro(m.monthBet)} · Rett {m.monthAdj >= 0 ? "+" : ""}
                            {euro(m.monthAdj)}
                          </span>
                        </div>
                      </summary>

                      <div className="px-4 pb-4 space-y-2">
                        {m.days.map((d) => (
                          <details key={d.dayISO} className={innerCls}>
                            <summary className="cursor-pointer select-none px-4 py-3 flex items-center justify-between">
                              <div className={isDay ? "text-sm text-slate-900" : "text-sm text-zinc-100"}>{d.dayISO}</div>
                              <div className="flex items-center gap-4 text-sm">
                                <span className={`font-semibold ${balanceClass(d.total, isDay)}`}>
                                  Totale {d.total >= 0 ? "+" : ""}
                                  {euro(d.total)}
                                </span>
                                <span className={isDay ? "text-slate-500" : "text-zinc-400"}>
                                  Bet {d.bet >= 0 ? "+" : ""}
                                  {euro(d.bet)} · Rett {d.adj >= 0 ? "+" : ""}
                                  {euro(d.adj)}
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

            {/* Registro */}
            <div className={`${panelCls} p-4`}>
              <h2 className="text-lg font-semibold">Registro Prelievi/Depositi</h2>

              {cashOps.length === 0 ? (
                <div className={isDay ? "mt-3 text-sm text-slate-500" : "mt-3 text-sm text-zinc-500"}>Nessuna operazione.</div>
              ) : (
                <div className="mt-4 space-y-2">
                  {cashOps.map((op) => {
                    const partnerName = partners.find((p) => p.id === op.partner_id)?.name ?? op.partner_id;
                    const pmLabel = paymentMethods.find((pm) => pm.id === op.payment_method_id)?.label ?? op.payment_method_id;
                    const signed = op.kind === "deposit" ? op.amount : -op.amount;

                    return (
                      <div key={op.id} className={`${innerCls} p-3`}>
                        <div className="flex items-center justify-between gap-2">
                          <div className={isDay ? "text-xs text-slate-500" : "text-xs text-zinc-400"}>
                            {new Date(op.created_at).toLocaleString("it-IT")}
                          </div>
                          <button onClick={() => deleteCashOp(op.id)} className={btnDanger}>
                            Elimina
                          </button>
                        </div>

                        <div className={isDay ? "mt-2 text-sm text-slate-800" : "mt-2 text-sm text-zinc-200"}>{partnerName}</div>
                        <div className={isDay ? "text-xs text-slate-500" : "text-xs text-zinc-400"}>{pmLabel}</div>

                        <div className={`mt-1 text-sm ${balanceClass(signed, isDay)}`}>
                          {signed >= 0 ? "+" : ""}
                          {euro(signed)}
                        </div>

                        {op.note && <div className={isDay ? "mt-1 text-xs text-slate-500" : "mt-1 text-xs text-zinc-400"}>{op.note}</div>}
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
          <div
            className={[
              "w-full max-w-xl rounded-2xl border p-4",
              isDay ? "border-[#E5DFD3] bg-[#FFFDF8] text-slate-900" : "border-zinc-800 bg-zinc-950 text-zinc-100",
            ].join(" ")}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Prelievo/Deposito soci</h2>
              <button onClick={() => setOpenCash(false)} className={btnNeutral}>
                Chiudi
              </button>
            </div>

            {cashUiErr && (
              <div className={`mt-4 whitespace-pre-wrap rounded-xl p-3 text-sm ${innerCls}`}>
                <span className={isDay ? "text-red-700 font-semibold" : "text-red-200 font-semibold"}>Errore:</span>{" "}
                {cashUiErr}
              </div>
            )}

            <div className="mt-4 grid grid-cols-1 gap-3">
              <label className={isDay ? "text-sm text-slate-700" : "text-sm text-zinc-300"}>
                Socio
                <select
                  value={cashPartnerId}
                  onChange={(e) => {
                    setCashPartnerId(e.target.value);
                    setCashPmId("");
                    setCashUiErr("");
                  }}
                  className={inputCls}
                  style={isDay ? undefined : { colorScheme: "dark" }}
                >
                  <option value="">Seleziona…</option>
                  {partners.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className={isDay ? "text-sm text-slate-700" : "text-sm text-zinc-300"}>
                Tipo
                <select
                  value={cashKind}
                  onChange={(e) => {
                    setCashKind(e.target.value as any);
                    setCashUiErr("");
                  }}
                  className={inputCls}
                  style={isDay ? undefined : { colorScheme: "dark" }}
                >
                  <option value="withdraw">Prelievo</option>
                  <option value="deposit">Deposito</option>
                </select>
              </label>

              <label className={isDay ? "text-sm text-slate-700" : "text-sm text-zinc-300"}>
                Metodo di pagamento
                <select
                  value={cashPmId}
                  onChange={(e) => {
                    setCashPmId(e.target.value);
                    setCashUiErr("");
                  }}
                  className={inputCls}
                  style={isDay ? undefined : { colorScheme: "dark" }}
                >
                  <option value="">Seleziona…</option>
                  {paymentMethodsForSelectedPartner
                    .filter((pm) => pm.label !== "__ESTERNO__")
                    .map((pm) => {
                      const bal = pmBalanceByPersonAndMethod.get(`${selectedPartnerName}||${pm.label}`)?.balance ?? 0;
                      return (
                        <option key={pm.id} value={pm.id}>
                          {pm.label} (saldo {euro(bal)})
                        </option>
                      );
                    })}
                </select>
              </label>

              <label className={isDay ? "text-sm text-slate-700" : "text-sm text-zinc-300"}>
                Importo
                <input value={cashAmount} onChange={(e) => setCashAmount(e.target.value)} placeholder="es. 500" className={inputCls} />
                <div className={isDay ? "mt-1 text-xs text-slate-500" : "mt-1 text-xs text-zinc-400"}>
                  Max {euro(Number(capitalProQuotaByPartnerId.get(cashPartnerId) ?? 0))}
                </div>
              </label>

              <label className={isDay ? "text-sm text-slate-700" : "text-sm text-zinc-300"}>
                Nota (opzionale)
                <input value={cashNote} onChange={(e) => setCashNote(e.target.value)} className={inputCls} />
              </label>

              <button onClick={submitCashOp} className={btnPrimary}>
                Conferma
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Nuova persona */}
      {newPersonOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 p-4 flex items-center justify-center">
          <div
            className={[
              "w-full max-w-xl rounded-2xl border p-4",
              isDay ? "border-[#E5DFD3] bg-[#FFFDF8] text-slate-900" : "border-zinc-800 bg-zinc-950 text-zinc-100",
            ].join(" ")}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Nuova persona</h2>
              <button onClick={() => setNewPersonOpen(false)} className={btnNeutral}>
                Chiudi
              </button>
            </div>

            {newPersonErr && (
              <div className={`mt-4 whitespace-pre-wrap rounded-xl p-3 text-sm ${innerCls}`}>
                <span className={isDay ? "text-red-700 font-semibold" : "text-red-200 font-semibold"}>Errore:</span>{" "}
                {newPersonErr}
              </div>
            )}

            <div className="mt-4 grid grid-cols-1 gap-3">
              <label className={isDay ? "text-sm text-slate-700" : "text-sm text-zinc-300"}>
                Nome persona
                <input value={newPersonName} onChange={(e) => setNewPersonName(e.target.value)} placeholder="es. Greta" className={inputCls} />
              </label>

              <label className={isDay ? "text-sm text-slate-700" : "text-sm text-zinc-300"}>
                Metodo di pagamento (nome)
                <input value={newPersonMethod} onChange={(e) => setNewPersonMethod(e.target.value)} placeholder="es. PayPal Greta" className={inputCls} />
              </label>

              <label className={isDay ? "text-sm text-slate-700" : "text-sm text-zinc-300"}>
                Fee % (es. 0.05 = 5%, 0 = nessuna fee)
                <input value={newPersonFeePct} onChange={(e) => setNewPersonFeePct(e.target.value)} placeholder="0 oppure 0.05" className={inputCls} />
              </label>

              <button onClick={submitNewPerson} className={btnPrimary}>
                Crea
              </button>

              <div className={isDay ? "text-xs text-slate-500" : "text-xs text-zinc-500"}>Nota: usa 0.05 per 5%. Se metti 0, la persona sarà senza fee.</div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Prelievo fee */}
      {openFeeWithdraw && (
        <div className="fixed inset-0 z-50 bg-black/60 p-4 flex items-center justify-center">
          <div
            className={[
              "w-full max-w-xl rounded-2xl border p-4",
              isDay ? "border-[#E5DFD3] bg-[#FFFDF8] text-slate-900" : "border-zinc-800 bg-zinc-950 text-zinc-100",
            ].join(" ")}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Prelievo profitto persona</h2>
              <button onClick={() => setOpenFeeWithdraw(false)} className={btnNeutral}>
                Chiudi
              </button>
            </div>

            {feeWithdrawErr && (
              <div className={`mt-4 whitespace-pre-wrap rounded-xl p-3 text-sm ${innerCls}`}>
                <span className={isDay ? "text-red-700 font-semibold" : "text-red-200 font-semibold"}>Errore:</span>{" "}
                {feeWithdrawErr}
              </div>
            )}

            <div className="mt-4 grid grid-cols-1 gap-3">
              <label className={isDay ? "text-sm text-slate-700" : "text-sm text-zinc-300"}>
                Importo
                <input value={feeWithdrawAmount} onChange={(e) => setFeeWithdrawAmount(e.target.value)} placeholder="es. 50" className={inputCls} />
                <div className={isDay ? "mt-1 text-xs text-slate-500" : "mt-1 text-xs text-zinc-400"}>
                  Disponibile: {euro(Number(peopleFeePanel.find((x) => x.person_id === feePersonId)?.fee_available ?? 0))}
                </div>
              </label>

              <label className={isDay ? "text-sm text-slate-700" : "text-sm text-zinc-300"}>
                Nota (opzionale)
                <input value={feeWithdrawNote} onChange={(e) => setFeeWithdrawNote(e.target.value)} className={inputCls} />
              </label>

              <button onClick={submitFeeWithdraw} className={btnPrimary}>
                Conferma prelievo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Storico prelievi */}
      {openFeeHistory && (
        <div className="fixed inset-0 z-50 bg-black/60 p-4 flex items-center justify-center">
          <div
            className={[
              "w-full max-w-2xl rounded-2xl border p-4",
              isDay ? "border-[#E5DFD3] bg-[#FFFDF8] text-slate-900" : "border-zinc-800 bg-zinc-950 text-zinc-100",
            ].join(" ")}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Storico prelievi</h2>
              <button onClick={() => setOpenFeeHistory(false)} className={btnNeutral}>
                Chiudi
              </button>
            </div>

            {feeHistoryErr && (
              <div className={`mt-4 whitespace-pre-wrap rounded-xl p-3 text-sm ${innerCls}`}>
                <span className={isDay ? "text-red-700 font-semibold" : "text-red-200 font-semibold"}>Errore:</span>{" "}
                {feeHistoryErr}
              </div>
            )}

            {feeHistoryLoading ? (
              <div className={`mt-4 text-sm ${isDay ? "text-slate-600" : "text-zinc-400"}`}>Caricamento…</div>
            ) : feeHistoryRows.length === 0 ? (
              <div className={`mt-4 text-sm ${isDay ? "text-slate-500" : "text-zinc-500"}`}>Nessun prelievo.</div>
            ) : (
              <div className="mt-4 space-y-2">
                {feeHistoryRows.map((w) => (
                  <div key={w.id} className={`${innerCls} p-3`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className={isDay ? "text-xs text-slate-500" : "text-xs text-zinc-400"}>
                        {new Date(w.created_at).toLocaleString("it-IT")}
                      </div>
                      <button onClick={() => cancelFeeWithdrawal(w.id)} className={btnDanger}>
                        Annulla
                      </button>
                    </div>

                    <div className={isDay ? "mt-2 text-sm font-semibold text-slate-900" : "mt-2 text-sm font-semibold text-zinc-100"}>
                      {euro(Number(w.amount ?? 0))}
                    </div>
                    {w.note && <div className={isDay ? "mt-1 text-xs text-slate-500" : "mt-1 text-xs text-zinc-400"}>{w.note}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
