"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./lib/supabase";

type Person = { name: string };
type Bookmaker = { name: string };

type AccountRow = {
  id: string;
  person_name: string;
  bookmaker_name: string;
  balance: number;
};

type PaymentMethodRow = {
  id: string;
  owner_name: string;
  label: string;
  balance: number;
  pending_incoming: number;
};

type TxKind = "deposit" | "withdraw" | "transfer" | "adjust";
type TxStatus = "pending" | "completed" | "cancelled";

type TxRow = {
  id: string;
  created_at: string;
  tx_kind: TxKind;
  status: TxStatus;
  amount: number;
  note: string | null;
  from_payment_method_id: string | null;
  from_account_id: string | null;
  to_payment_method_id: string | null;
  to_account_id: string | null;
};

type AdjustmentRow = {
  id: string;
  created_at: string;
  target_type: "account" | "payment_method";
  target_id: string;
  amount: number;
  note: string | null;
};

type Option = { id: string; label: string };

function euro(n: number) {
  const v = Number.isFinite(n) ? n : 0;
  return v.toLocaleString("it-IT", { style: "currency", currency: "EUR" });
}
function isZero(n: number) {
  return Math.abs(n) < 1e-9;
}
function balanceClass(n: number) {
  if (isZero(n)) return "text-zinc-500";
  if (n > 0) return "text-emerald-300";
  return "text-red-300";
}
function pendingClass(n: number) {
  if (isZero(n)) return "text-zinc-500";
  return "text-amber-300";
}
function slugifyBookmaker(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9]/g, "");
}
function isBaselineAdjustment(note: string | null) {
  const n = (note ?? "").trim().toLowerCase();
  return n === "set saldo a valore";
}
function dateKeyLocal(iso: string) {
  return new Date(iso).toLocaleDateString("sv-SE");
}
function monthKeyFromDay(dayISO: string) {
  return dayISO.slice(0, 7) + "-01";
}
function monthLabel(monthStartISO: string) {
  const d = new Date(monthStartISO + "T00:00:00");
  const txt = new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric" }).format(d);
  return txt.charAt(0).toUpperCase() + txt.slice(1);
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

function groupMonthDay<T>(items: T[], getISODateTime: (x: T) => string, getSignedAmount: (x: T) => number) {
  const monthMap = new Map<string, { monthTotal: number; days: Map<string, { dayTotal: number; items: T[] }> }>();

  for (const it of items) {
    const dayISO = dateKeyLocal(getISODateTime(it));
    const monthStart = monthKeyFromDay(dayISO);
    const amt = Number(getSignedAmount(it) ?? 0);

    if (!monthMap.has(monthStart)) monthMap.set(monthStart, { monthTotal: 0, days: new Map() });
    const m = monthMap.get(monthStart)!;
    m.monthTotal += amt;

    if (!m.days.has(dayISO)) m.days.set(dayISO, { dayTotal: 0, items: [] });
    const d = m.days.get(dayISO)!;
    d.dayTotal += amt;
    d.items.push(it);
  }

  const months = Array.from(monthMap.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));

  return months.map(([monthStart, payload]) => {
    const days = Array.from(payload.days.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
    const daysOut = days.map(([dayISO, d]) => {
      d.items.sort((x: any, y: any) => {
        const ax = new Date(getISODateTime(x)).getTime();
        const ay = new Date(getISODateTime(y)).getTime();
        return ay - ax;
      });
      return { dayISO, dayTotal: d.dayTotal, items: d.items };
    });
    return { monthStart, monthTotal: payload.monthTotal, days: daysOut };
  });
}

export default function Page() {
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const [people, setPeople] = useState<Person[]>([]);
  const [bookmakers, setBookmakers] = useState<Bookmaker[]>([]);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodRow[]>([]);
  const [txs, setTxs] = useState<TxRow[]>([]);
  const [adjustments, setAdjustments] = useState<AdjustmentRow[]>([]);
  const [baselineAdjustments, setBaselineAdjustments] = useState<AdjustmentRow[]>([]);

  // modal add bookmaker
  const [openAddBookmaker, setOpenAddBookmaker] = useState(false);
  const [newBookmakerName, setNewBookmakerName] = useState("");
  // ✅ modal add person (non socia)
const [openAddPerson, setOpenAddPerson] = useState(false);
const [newPersonName, setNewPersonName] = useState("");


  const [person, _setPerson] = useState("");
  const personRef = useRef<string>("");
  function setPersonSafe(v: string) {
    personRef.current = v;
    _setPerson(v);
  }

  const [txKind, setTxKind] = useState<TxKind>("deposit");
  const [txStatus, setTxStatus] = useState<TxStatus>("completed");
  const [txAmount, setTxAmount] = useState("");
  const [txNote, setTxNote] = useState("");

  const [fromMethodId, setFromMethodId] = useState("");
  const [toMethodId, setToMethodId] = useState("");
  const [fromAccountId, setFromAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");

  const [adjTargetType, setAdjTargetType] = useState<"account" | "payment_method">("account");
  const [adjTargetId, setAdjTargetId] = useState("");
  const [adjAmount, setAdjAmount] = useState("");
  const [adjNote, setAdjNote] = useState("");

  async function loadAll(showLoading: boolean) {
    if (showLoading) setLoading(true);
    setErrorMsg("");

    const [
      { data: p, error: pe },
      { data: b, error: be },
      { data: a, error: ae },
      { data: pm, error: pme },
      { data: t, error: te },
      { data: adj, error: adje },
    ] = await Promise.all([
      supabase.from("people").select("name").order("name"),
      supabase.from("bookmakers").select("name").order("name"),
      supabase.from("accounts").select("*"),
      supabase.from("payment_methods").select("*"),
      supabase
        .from("transactions")
        .select("id,created_at,tx_kind,status,amount,note,from_payment_method_id,from_account_id,to_payment_method_id,to_account_id")
        .order("created_at", { ascending: false })
        .limit(300),
      supabase
        .from("balance_adjustments")
        .select("id,created_at,target_type,target_id,amount,note")
        .order("created_at", { ascending: false })
        .limit(1000),
    ]);

    const err = pe || be || ae || pme || te || adje;
    if (err) {
      setErrorMsg(err.message);
      setLoading(false);
      return;
    }

    const pList = (p ?? []) as Person[];
    setPeople(pList);
    setBookmakers((b ?? []) as Bookmaker[]);
    setAccounts((a ?? []) as AccountRow[]);
    setPaymentMethods((pm ?? []) as PaymentMethodRow[]);
    setTxs((t ?? []) as TxRow[]);

    const adjList = (adj ?? []) as AdjustmentRow[];
    setAdjustments(adjList.filter((x) => !isBaselineAdjustment(x.note)));
    setBaselineAdjustments(adjList.filter((x) => isBaselineAdjustment(x.note)));

    const cur = personRef.current;
    const exists = cur && pList.some((x) => x.name === cur);
    if (!exists) {
      const fallback = pList[0]?.name ?? "";
      personRef.current = fallback;
      _setPerson(fallback);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadAll(true);
    const interval = setInterval(() => loadAll(false), 2000);
    return () => clearInterval(interval);
  }, []);

  const accountMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const row of accounts) m.set(`${row.person_name}||${row.bookmaker_name}`, Number(row.balance ?? 0));
    return m;
  }, [accounts]);

  const methodsTotalsByPerson = useMemo(() => {
    const m = new Map<string, { saldo: number; transito: number }>();
    for (const p of people) m.set(p.name, { saldo: 0, transito: 0 });
    for (const pm of paymentMethods) {
      const cur = m.get(pm.owner_name) ?? { saldo: 0, transito: 0 };
      cur.saldo += Number(pm.balance ?? 0);
      cur.transito += Number(pm.pending_incoming ?? 0);
      m.set(pm.owner_name, cur);
    }
    return m;
  }, [paymentMethods, people]);

  const methodsByPerson = useMemo(() => {
    const m = new Map<string, PaymentMethodRow[]>();
    for (const pm of paymentMethods) {
      const arr = m.get(pm.owner_name) ?? [];
      arr.push(pm);
      m.set(pm.owner_name, arr);
    }
    for (const [k, arr] of m.entries()) arr.sort((a, b) => a.label.localeCompare(b.label));
    return m;
  }, [paymentMethods]);

  const accountOptionsForPerson: Option[] = useMemo(() => {
    if (!person) return [];
    return accounts
      .filter((a) => a.person_name === person && !!a.id)
      .map((a) => ({ id: a.id, label: `${a.bookmaker_name} — ${a.person_name}` }))
      .sort((x, y) => x.label.localeCompare(y.label));
  }, [accounts, person]);

  const methodOptionsForPerson: Option[] = useMemo(() => {
  if (!person) return [];
  return paymentMethods
    .filter((pm) => pm.owner_name === person && !!pm.id)
    .filter((pm) => pm.label !== "__ESTERNO__")
    .map((pm) => ({ id: pm.id, label: `${pm.label} (${pm.owner_name})` }))
    .sort((x, y) => x.label.localeCompare(y.label));
}, [paymentMethods, person]);


  const allAccountOptions: Option[] = useMemo(() => {
    return accounts
      .map((a) => ({ id: a.id, label: `${a.bookmaker_name} — ${a.person_name}` }))
      .sort((x, y) => x.label.localeCompare(y.label));
  }, [accounts]);

  const allMethodOptions: Option[] = useMemo(() => {
  return paymentMethods
    .filter((pm) => pm.label !== "__ESTERNO__")
    .map((pm) => ({ id: pm.id, label: `${pm.label} (${pm.owner_name})` }))
    .sort((x, y) => x.label.localeCompare(y.label));
}, [paymentMethods]);


  const accountLabelById = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of accounts) m.set(a.id, `${a.bookmaker_name} — ${a.person_name}`);
    return m;
  }, [accounts]);

  const methodLabelById = useMemo(() => {
    const m = new Map<string, string>();
    for (const pm of paymentMethods) m.set(pm.id, `${pm.label} (${pm.owner_name})`);
    return m;
  }, [paymentMethods]);

  useEffect(() => {
    setFromMethodId("");
    setToMethodId("");
    setFromAccountId("");
    setToAccountId("");
  }, [person, txKind]);

  useEffect(() => {
    setAdjTargetId("");
  }, [adjTargetType]);

  async function insertTransaction() {
    setErrorMsg("");
    const amt = Number(txAmount.replace(",", "."));
    if (!Number.isFinite(amt) || amt <= 0) return setErrorMsg("Importo non valido");

    const payload: any = {
      tx_kind: txKind,
      status: txStatus,
      amount: amt,
      note: txNote.trim() || null,
      from_payment_method_id: null,
      from_account_id: null,
      to_payment_method_id: null,
      to_account_id: null,
    };

    if (txKind === "deposit") {
      if (!fromMethodId || !toAccountId) return setErrorMsg("Deposito: scegli DA (metodo) e A (account)");
      payload.from_payment_method_id = fromMethodId;
      payload.to_account_id = toAccountId;
      payload.status = "completed";
    }
    if (txKind === "withdraw") {
      if (!fromAccountId || !toMethodId) return setErrorMsg("Prelievo: scegli DA (account) e A (metodo)");
      payload.from_account_id = fromAccountId;
      payload.to_payment_method_id = toMethodId;
      if (!payload.status) payload.status = "pending";
    }
    if (txKind === "transfer") {
      if (!fromMethodId || !toMethodId) return setErrorMsg("Trasferimento: scegli DA (metodo) e A (metodo)");
      payload.from_payment_method_id = fromMethodId;
      payload.to_payment_method_id = toMethodId;
      payload.status = "completed";
    }

    const { error } = await supabase.from("transactions").insert([payload]);
    if (error) return setErrorMsg(error.message);

    setTxAmount("");
    setTxNote("");
    setFromMethodId("");
    setToMethodId("");
    setFromAccountId("");
    setToAccountId("");
    await loadAll(false);
  }

  async function markWithdrawalArrived(txId: string) {
    const { error } = await supabase.from("transactions").update({ status: "completed" }).eq("id", txId);
    if (error) return setErrorMsg(error.message);
    await loadAll(false);
  }

  async function deleteTransaction(txId: string) {
    const ok = window.confirm("Vuoi eliminare questa transazione? (ripristinerà i saldi)");
    if (!ok) return;

    const { error } = await supabase.rpc("delete_transaction_and_revert", { tx_id: txId });
    if (error) return setErrorMsg(error.message);

    await loadAll(false);
  }

  async function insertAdjustment() {
    setErrorMsg("");
    if (!adjTargetId) return setErrorMsg("Seleziona il target della rettifica");

    const amt = Number(adjAmount.replace(",", "."));
    if (!Number.isFinite(amt) || amt === 0) return setErrorMsg("Importo rettifica non valido (usa +/-)");

    const payload = {
      target_type: adjTargetType,
      target_id: adjTargetId,
      amount: amt,
      note: adjNote.trim() || null,
    };

    const { error } = await supabase.from("balance_adjustments").insert([payload]);
    if (error) return setErrorMsg(error.message);

    setAdjAmount("");
    setAdjNote("");
    setAdjTargetId("");
    await loadAll(false);
  }

  async function deleteAdjustment(adjId: string) {
    const ok = window.confirm("Eliminare questa rettifica? (ripristina il saldo)");
    if (!ok) return;

    const { error } = await supabase.from("balance_adjustments").delete().eq("id", adjId);
    if (error) return setErrorMsg(error.message);

    await loadAll(false);
  }

  async function addBookmaker() {
    setErrorMsg("");
    const name = newBookmakerName.trim();
    if (!name) return setErrorMsg("Inserisci il nome del bookmaker");

    const { error } = await supabase.rpc("add_bookmaker_and_accounts", { p_bookmaker_name: name });
    if (error) return setErrorMsg(error.message);

    setOpenAddBookmaker(false);
    setNewBookmakerName("");
    await loadAll(false);
  }
  async function addPerson() {
  setErrorMsg("");
  const name = newPersonName.trim();
  if (!name) return setErrorMsg("Inserisci il nome della persona");

  const { error } = await supabase.rpc("add_person_accounts_with_default_paypal", {
    p_person_name: name,
  });
  if (error) return setErrorMsg(error.message);

  setOpenAddPerson(false);
  setNewPersonName("");
  await loadAll(false);
}


  const adjGrouped = useMemo(() => groupMonthDay(adjustments, (x) => x.created_at, (x) => Number(x.amount ?? 0)), [adjustments]);
  const baselineGrouped = useMemo(() => groupMonthDay(baselineAdjustments, (x) => x.created_at, (x) => Number(x.amount ?? 0)), [baselineAdjustments]);
  const txGrouped = useMemo(() => groupMonthDay(txs, (x) => x.created_at, (x) => Number(x.amount ?? 0)), [txs]);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Saldi</h1>
        <div className="flex items-center gap-2">
  <button
    onClick={() => setOpenAddPerson(true)}
    className="rounded-xl bg-zinc-800 px-3 py-2 text-sm font-semibold hover:bg-zinc-700"
    title="Aggiungi persona (solo account)"
  >
    + Persona
  </button>

  <button
    onClick={() => loadAll(false)}
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
          {/* BOOKMAKER MATRIX */}
          <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Bookmaker</h2>
              <div className="text-sm text-zinc-400">Persone: {people.length} — Bookmaker: {bookmakers.length}</div>
            </div>

            <div className="mt-4 overflow-auto rounded-xl border border-zinc-800">
              <table className="min-w-[900px] w-full border-collapse">
                <thead className="sticky top-0 bg-zinc-900">
                  <tr>
                    <th className="sticky left-0 z-10 bg-zinc-900 px-3 py-2 text-left text-sm font-semibold text-zinc-200">Persona</th>
                    {bookmakers.map((b) => (
                      <th key={b.name} className="px-3 py-2 text-center text-sm font-semibold text-zinc-200">
                        <img
                          src={`/bookmakers/${slugifyBookmaker(b.name)}.png`}
                          alt={b.name}
                          className="h-[30px] w-auto max-w-[120px] mx-auto"
                          onError={(e) => {
                            const img = e.currentTarget as HTMLImageElement;
                            img.style.display = "none";
                            if (img.parentElement) img.parentElement.innerText = b.name;
                          }}
                        />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {people.map((p) => (
                    <tr key={p.name} className="border-t border-zinc-800">
                      <td className="sticky left-0 z-10 bg-zinc-950/60 px-3 py-2 text-sm font-medium text-zinc-100">{p.name}</td>
                      {bookmakers.map((b) => {
                        const v = accountMap.get(`${p.name}||${b.name}`) ?? 0;
                        return <td key={b.name} className={`px-3 py-2 text-sm ${balanceClass(v)}`}>{euro(v)}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* METODI */}
          <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
            <h2 className="text-lg font-semibold mb-3">Metodi di pagamento</h2>

            <div className="overflow-auto rounded-xl border border-zinc-800">
              <table className="min-w-[1000px] w-full border-collapse">
                <thead className="bg-zinc-900">
                  <tr>
                    <th className="px-3 py-2 text-left text-sm font-semibold text-zinc-200">Persona</th>
                    <th className="px-3 py-2 text-left text-sm font-semibold text-zinc-200">Saldo</th>
                    <th className="px-3 py-2 text-left text-sm font-semibold text-zinc-200">In transito</th>
                    <th className="px-3 py-2 text-left text-sm font-semibold text-zinc-200">Totale</th>
                    <th className="px-3 py-2 text-left text-sm font-semibold text-zinc-200">Dettaglio metodi</th>
                  </tr>
                </thead>
                <tbody>
                  {people.map((p) => {
                    const t = methodsTotalsByPerson.get(p.name) ?? { saldo: 0, transito: 0 };
                    const list = methodsByPerson.get(p.name) ?? [];
                    return (
                      <tr key={p.name} className="border-t border-zinc-800 align-top">
                        <td className="px-3 py-2 text-sm font-medium text-zinc-100">{p.name}</td>
                        <td className={`px-3 py-2 text-sm ${balanceClass(t.saldo)}`}>{euro(t.saldo)}</td>
                        <td className={`px-3 py-2 text-sm ${pendingClass(t.transito)}`}>{euro(t.transito)}</td>
                        <td className={`px-3 py-2 text-sm ${balanceClass(t.saldo + t.transito)}`}>{euro(t.saldo + t.transito)}</td>
                        <td className="px-3 py-2 text-sm text-zinc-200">
                          {list.length === 0 ? (
                            <span className="text-zinc-600">—</span>
                          ) : (
                            <div className="flex flex-wrap gap-2">
  {list
    .filter((pm) => pm.label !== "__ESTERNO__")
    .map((pm) => (
      <div key={pm.id} className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-2 py-1 text-xs">
        <div className="text-zinc-300">{pm.label}</div>
        <div className={`${balanceClass(Number(pm.balance ?? 0))}`}>{euro(Number(pm.balance ?? 0))}</div>
        {!isZero(Number(pm.pending_incoming ?? 0)) && (
          <div className={`${pendingClass(Number(pm.pending_incoming ?? 0))}`}>
            in transito {euro(Number(pm.pending_incoming ?? 0))}
          </div>
        )}
      </div>
    ))}
</div>

                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* COLONNE: RETTIFICHE + TRANSAZIONI */}
          <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* RETTIFICHE */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
              <h2 className="text-lg font-semibold">Rettifiche</h2>

              <div className="mt-4 grid gap-3">
                <label className="text-sm text-zinc-300">
                  Target
                  <select
                    value={adjTargetType}
                    onChange={(e) => setAdjTargetType(e.target.value as any)}
                    className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                    style={{ colorScheme: "dark" }}
                  >
                    <option value="account">Bookmaker (Account)</option>
                    <option value="payment_method">Metodo di pagamento</option>
                  </select>
                </label>

                <SearchSelect
                  label={adjTargetType === "account" ? "Account bookmaker" : "Metodo di pagamento"}
                  value={adjTargetId}
                  options={adjTargetType === "account" ? allAccountOptions : allMethodOptions}
                  onChange={setAdjTargetId}
                />

                <label className="text-sm text-zinc-300">
                  Importo (+/-)
                  <input value={adjAmount} onChange={(e) => setAdjAmount(e.target.value)} className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100" />
                </label>

                <label className="text-sm text-zinc-300">
                  Nota (opzionale)
                  <input value={adjNote} onChange={(e) => setAdjNote(e.target.value)} className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100" />
                </label>

                <button onClick={insertAdjustment} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold hover:bg-emerald-600">
                  Salva rettifica
                </button>
              </div>

              <div className="mt-6 space-y-3">
                <h3 className="text-sm font-semibold text-zinc-200">Storico rettifiche</h3>

                {adjGrouped.length === 0 ? (
                  <div className="text-sm text-zinc-500">Nessuna rettifica.</div>
                ) : (
                  <div className="space-y-2">
                    {adjGrouped.map((m) => (
                      <details key={m.monthStart} className="rounded-xl border border-zinc-800 bg-zinc-950/30">
                        <summary className="cursor-pointer select-none px-4 py-3 flex items-center justify-between">
                          <div className="text-sm font-semibold text-zinc-100">{monthLabel(m.monthStart)}</div>
                          <div className={`text-sm font-semibold ${balanceClass(m.monthTotal)}`}>
                            {m.monthTotal >= 0 ? "+" : ""}{euro(m.monthTotal)}
                          </div>
                        </summary>

                        <div className="px-4 pb-4 space-y-2">
                          {m.days.map((d) => (
                            <details key={d.dayISO} className="rounded-xl border border-zinc-800 bg-zinc-950/40">
                              <summary className="cursor-pointer select-none px-4 py-3 flex items-center justify-between">
                                <div className="text-sm text-zinc-100">{d.dayISO}</div>
                                <div className={`text-sm font-semibold ${balanceClass(d.dayTotal)}`}>
                                  {d.dayTotal >= 0 ? "+" : ""}{euro(d.dayTotal)}
                                </div>
                              </summary>

                              <div className="px-4 pb-4 space-y-2">
                                {d.items.map((a) => {
                                  const label =
                                    a.target_type === "account"
                                      ? accountLabelById.get(a.target_id) ?? a.target_id
                                      : methodLabelById.get(a.target_id) ?? a.target_id;

                                  return (
                                    <div key={a.id} className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-3">
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="text-xs text-zinc-400">{new Date(a.created_at).toLocaleString("it-IT")}</div>
                                        <button onClick={() => deleteAdjustment(a.id)} className="rounded-xl bg-red-800/70 px-3 py-2 text-xs font-semibold hover:bg-red-700">
                                          Elimina
                                        </button>
                                      </div>

                                      <div className="mt-2 text-sm text-zinc-200">
                                        <span className="text-zinc-400">{a.target_type === "account" ? "Account" : "Metodo"}:</span> {label}
                                      </div>

                                      <div className={`mt-1 text-sm font-semibold ${balanceClass(a.amount)}`}>
                                        {a.amount >= 0 ? "+" : ""}{euro(a.amount)}
                                      </div>

                                      {a.note && <div className="mt-1 text-xs text-zinc-400">{a.note}</div>}
                                    </div>
                                  );
                                })}
                              </div>
                            </details>
                          ))}
                        </div>
                      </details>
                    ))}
                  </div>
                )}
              </div>

              {/* Rettifiche iniziali */}
              <div className="mt-6">
                <details className="rounded-xl border border-zinc-800 bg-zinc-950/30">
                  <summary className="cursor-pointer select-none px-4 py-3 flex items-center justify-between">
                    <div className="text-sm font-semibold text-zinc-100">
                      Rettifiche iniziali <span className="ml-2 text-xs text-zinc-400">(Set saldo a valore)</span>
                    </div>
                    <div className="text-sm text-zinc-400">{baselineAdjustments.length} righe</div>
                  </summary>

                  <div className="px-4 pb-4">
                    {baselineGrouped.length === 0 ? (
                      <div className="text-sm text-zinc-500 mt-2">Nessuna rettifica iniziale.</div>
                    ) : (
                      <div className="mt-3 space-y-2">
                        {baselineGrouped.map((m) => (
                          <details key={m.monthStart} className="rounded-xl border border-zinc-800 bg-zinc-950/40">
                            <summary className="cursor-pointer select-none px-4 py-3 flex items-center justify-between">
                              <div className="text-sm text-zinc-100">{monthLabel(m.monthStart)}</div>
                              <div className={`text-sm font-semibold ${balanceClass(m.monthTotal)}`}>
                                {m.monthTotal >= 0 ? "+" : ""}{euro(m.monthTotal)}
                              </div>
                            </summary>

                            <div className="px-4 pb-4 space-y-2">
                              {m.days.map((d) => (
                                <details key={d.dayISO} className="rounded-xl border border-zinc-800 bg-zinc-950/50">
                                  <summary className="cursor-pointer select-none px-4 py-3 flex items-center justify-between">
                                    <div className="text-sm text-zinc-100">{d.dayISO}</div>
                                    <div className={`text-sm font-semibold ${balanceClass(d.dayTotal)}`}>
                                      {d.dayTotal >= 0 ? "+" : ""}{euro(d.dayTotal)}
                                    </div>
                                  </summary>

                                  <div className="px-4 pb-4 space-y-2">
                                    {d.items.map((a) => {
                                      const label =
                                        a.target_type === "account"
                                          ? accountLabelById.get(a.target_id) ?? a.target_id
                                          : methodLabelById.get(a.target_id) ?? a.target_id;

                                      return (
                                        <div key={a.id} className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
                                          <div className="text-xs text-zinc-400">{new Date(a.created_at).toLocaleString("it-IT")}</div>
                                          <div className="mt-2 text-sm text-zinc-200">
                                            <span className="text-zinc-400">{a.target_type === "account" ? "Account" : "Metodo"}:</span> {label}
                                          </div>
                                          <div className={`mt-1 text-sm font-semibold ${balanceClass(a.amount)}`}>
                                            {a.amount >= 0 ? "+" : ""}{euro(a.amount)}
                                          </div>
                                          {a.note && <div className="mt-1 text-xs text-zinc-400">{a.note}</div>}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </details>
                              ))}
                            </div>
                          </details>
                        ))}
                      </div>
                    )}
                  </div>
                </details>
              </div>
            </div>

            {/* TRANSAZIONI */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
              <h2 className="text-lg font-semibold">Transazioni</h2>

              <div className="mt-4 grid gap-3">
                <label className="text-sm text-zinc-300">
                  Tipo
                  <select
                    value={txKind}
                    onChange={(e) => {
                      const v = e.target.value as TxKind;
                      setTxKind(v);
                      setTxStatus(v === "withdraw" ? "pending" : "completed");
                      setFromMethodId("");
                      setToMethodId("");
                      setFromAccountId("");
                      setToAccountId("");
                    }}
                    className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                    style={{ colorScheme: "dark" }}
                  >
                    <option value="deposit">Deposito (metodo → sito)</option>
                    <option value="withdraw">Prelievo (sito → metodo)</option>
                    <option value="transfer">Trasferimento (metodo → metodo)</option>
                  </select>
                </label>

                <label className="text-sm text-zinc-300">
                  Importo
                  <input value={txAmount} onChange={(e) => setTxAmount(e.target.value)} className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100" />
                </label>

                <label className="text-sm text-zinc-300">
                  Persona
                  <select value={person} onChange={(e) => setPersonSafe(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100" style={{ colorScheme: "dark" }}>
                    {people.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
                  </select>
                </label>

                {txKind === "withdraw" ? (
                  <label className="text-sm text-zinc-300">
                    Stato prelievo
                    <select value={txStatus} onChange={(e) => setTxStatus(e.target.value as TxStatus)}
                      className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100" style={{ colorScheme: "dark" }}>
                      <option value="pending">In transito</option>
                      <option value="completed">Arrivato</option>
                    </select>
                  </label>
                ) : <div />}

                <div className="rounded-xl border border-zinc-800 bg-zinc-950/30 p-3">
                  <div className="text-sm font-semibold text-zinc-200">DA</div>
                  {txKind === "withdraw" ? (
                    <div className="mt-2">
                      <SearchSelect label="Account bookmaker" value={fromAccountId} options={accountOptionsForPerson} onChange={setFromAccountId} />
                    </div>
                  ) : (
                    <div className="mt-2">
                      <SearchSelect label="Metodo di pagamento" value={fromMethodId} options={methodOptionsForPerson} onChange={setFromMethodId} />
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-zinc-800 bg-zinc-950/30 p-3">
                  <div className="text-sm font-semibold text-zinc-200">A</div>
                  {txKind === "deposit" ? (
  <div className="mt-2">
    <SearchSelect label="Account bookmaker" value={toAccountId} options={accountOptionsForPerson} onChange={setToAccountId} />
  </div>
) : txKind === "transfer" ? (
  <div className="mt-2">
    <SearchSelect label="Metodo di pagamento" value={toMethodId} options={allMethodOptions} onChange={setToMethodId} />
  </div>
) : (
  <div className="mt-2">
    <SearchSelect label="Metodo di pagamento" value={toMethodId} options={methodOptionsForPerson} onChange={setToMethodId} />
  </div>
)}

                </div>

                <label className="text-sm text-zinc-300">
                  Nota (opzionale)
                  <input value={txNote} onChange={(e) => setTxNote(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100" />
                </label>

                <button onClick={insertTransaction} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold hover:bg-emerald-600">
                  Salva transazione
                </button>
              </div>

              <div className="mt-6 space-y-3">
                <h3 className="text-sm font-semibold text-zinc-200">Storico transazioni</h3>

                {txGrouped.length === 0 ? (
                  <div className="text-sm text-zinc-500">Nessuna transazione.</div>
                ) : (
                  <div className="space-y-2">
                    {txGrouped.map((m) => (
                      <details key={m.monthStart} className="rounded-xl border border-zinc-800 bg-zinc-950/30">
                        <summary className="cursor-pointer select-none px-4 py-3 flex items-center justify-between">
                          <div className="text-sm font-semibold text-zinc-100">{monthLabel(m.monthStart)}</div>
                          <div className="text-sm font-semibold text-zinc-300">Totale movimenti: {euro(m.monthTotal)}</div>
                        </summary>

                        <div className="px-4 pb-4 space-y-2">
                          {m.days.map((d) => (
                            <details key={d.dayISO} className="rounded-xl border border-zinc-800 bg-zinc-950/40">
                              <summary className="cursor-pointer select-none px-4 py-3 flex items-center justify-between">
                                <div className="text-sm text-zinc-100">{d.dayISO}</div>
                                <div className="text-sm font-semibold text-zinc-300">Totale: {euro(d.dayTotal)}</div>
                              </summary>

                              <div className="px-4 pb-4 space-y-2">
                                {d.items.map((t) => (
                                  <div key={t.id} className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-3">
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="text-xs text-zinc-400">{new Date(t.created_at).toLocaleString("it-IT")}</div>
                                      <div className="flex items-center gap-2">
                                        {t.tx_kind === "withdraw" && t.status === "pending" ? (
                                          <button onClick={() => markWithdrawalArrived(t.id)} className="rounded-xl bg-emerald-700 px-3 py-2 text-xs font-semibold hover:bg-emerald-600">
                                            Arrivato ✅
                                          </button>
                                        ) : (
                                          <span className="text-zinc-600 text-xs">—</span>
                                        )}
                                        <button onClick={() => deleteTransaction(t.id)} className="rounded-xl bg-red-800/70 px-3 py-2 text-xs font-semibold hover:bg-red-700">
                                          Elimina
                                        </button>
                                      </div>
                                    </div>
                                    <div className="mt-2 text-sm text-zinc-200">
  <span className="text-zinc-400">Tipo:</span> {t.tx_kind}{" "}
  <span className="text-zinc-400">— Stato:</span> {t.status}
</div>

{/* Dettaglio DA → A */}
{t.tx_kind === "deposit" && (
  <div className="mt-1 text-sm text-zinc-200">
    <span className="text-zinc-400">Da:</span>{" "}
    {methodLabelById.get(t.from_payment_method_id ?? "") ?? "—"}{" "}
    <span className="text-zinc-400">→ A:</span>{" "}
    {accountLabelById.get(t.to_account_id ?? "") ?? "—"}
  </div>
)}

{t.tx_kind === "withdraw" && (
  <div className="mt-1 text-sm text-zinc-200">
    <span className="text-zinc-400">Da:</span>{" "}
    {accountLabelById.get(t.from_account_id ?? "") ?? "—"}{" "}
    <span className="text-zinc-400">→ A:</span>{" "}
    {methodLabelById.get(t.to_payment_method_id ?? "") ?? "—"}
  </div>
)}

{t.tx_kind === "transfer" && (
  <div className="mt-1 text-sm text-zinc-200">
    <span className="text-zinc-400">Da:</span>{" "}
    {methodLabelById.get(t.from_payment_method_id ?? "") ?? "—"}{" "}
    <span className="text-zinc-400">→ A:</span>{" "}
    {methodLabelById.get(t.to_payment_method_id ?? "") ?? "—"}
  </div>
)}

<div className="mt-1 text-sm font-semibold text-zinc-100">Importo: {euro(t.amount)}</div>
{t.note && <div className="mt-1 text-xs text-zinc-400">{t.note}</div>}

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
            </div>
          </div>
        </>
      )}

      {/* MODAL add bookmaker */}
      {openAddBookmaker && (
        <div className="fixed inset-0 z-50 bg-black/60 p-4 flex items-center justify-center">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Aggiungi bookmaker</h2>
              <button onClick={() => setOpenAddBookmaker(false)} className="rounded-xl bg-zinc-800 px-3 py-2 text-sm hover:bg-zinc-700">
                Chiudi
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              <label className="text-sm text-zinc-300">
                Nome bookmaker
                <input
                  value={newBookmakerName}
                  onChange={(e) => setNewBookmakerName(e.target.value)}
                  placeholder="es. Planetwin365"
                  className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                />
              </label>

              <button onClick={addBookmaker} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold hover:bg-emerald-600">
                Aggiungi
              </button>
            </div>
          </div>
        </div>
      )}
      {/* MODAL add person */}
{openAddPerson && (
  <div className="fixed inset-0 z-50 bg-black/60 p-4 flex items-center justify-center">
    <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Aggiungi persona (account)</h2>
        <button
          onClick={() => setOpenAddPerson(false)}
          className="rounded-xl bg-zinc-800 px-3 py-2 text-sm hover:bg-zinc-700"
        >
          Chiudi
        </button>
      </div>

      <div className="mt-4 grid gap-3">
        <label className="text-sm text-zinc-300">
          Nome persona
          <input
            value={newPersonName}
            onChange={(e) => setNewPersonName(e.target.value)}
            placeholder="es. Giorgia"
            className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          />
        </label>

        <button
          onClick={addPerson}
          className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold hover:bg-emerald-600"
        >
          Crea persona
        </button>

        <div className="text-xs text-zinc-500">
          Crea la persona, tutti gli account bookmaker e il metodo PayPal predefinito.
        </div>
      </div>
    </div>
  </div>
)}

    </main>
  );
}
