"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useUIMode } from "../components/UIModeProvider";

type TournamentRow = {
  id: string;
  name: string;
  buy_in: number;
};

type PokerSessionRow = {
  id: string;
  player_name: "Edoardo" | "Andrea";
  status: "open" | "closed";
  created_at: string;
  closed_at: string | null;
};

type PokerSessionEntryRow = {
  id: string;
  session_id: string;
  tournament_id: string;
  tournament_name_snapshot: string;
  buy_in: number;
  itm: number | null;
  bounty: number | null;
  created_at: string;
};

type AccountRow = {
  id: string;
  person_name: string;
  bookmaker_name: string;
  balance: number;
};

type Option = {
  id: string;
  label: string;
};

type ProfitEvent = {
  player: "Edoardo" | "Andrea";
  at: string;
  delta: number;
  label: string;
  kind: "buyin" | "return";
};

type CumulativePoint = {
  x: number;
  y: number;
  at: string;
  label: string;
  delta: number;
  kind: "buyin" | "return";
};

type TournamentRankingRow = {
  tournament: string;
  totalProfit: number;
  playedCount: number;
};

type StatsSummary = {
  tournamentsPlayed: number;
  totalBuyIn: number;
  totalReturn: number;
  netProfit: number;
  abi: number;
  roi: number;
  avgProfitPerTournament: number;
  itmCount: number;
  itmPct: number;
  avgReturnWhenItm: number;
  bestTournamentName: string | null;
  bestTournamentProfit: number | null;
};

function euro(n: number) {
  const v = Number.isFinite(n) ? n : 0;
  return v.toLocaleString("it-IT", { style: "currency", currency: "EUR" });
}

function pct(n: number) {
  const v = Number.isFinite(n) ? n : 0;
  return `${v.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

function toNumberInput(value: string) {
  return Number(String(value).replace(",", "."));
}

function formatDateTimeIT(value: string) {
  return new Date(value).toLocaleString("it-IT");
}

function normalizeName(value: string) {
  return value.trim().toLowerCase();
}

function monthLabel(monthStartISO: string) {
  const d = new Date(monthStartISO + "T00:00:00");
  const txt = new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric" }).format(d);
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}

function amountClass(value: number, isDay: boolean) {
  if (Math.abs(value) < 0.005) return isDay ? "text-slate-700" : "text-zinc-100";
  if (value > 0) return isDay ? "text-emerald-700" : "text-emerald-300";
  return isDay ? "text-red-700" : "text-red-300";
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

  const selectedLabel = useMemo(
    () => options.find((o) => o.id === value)?.label ?? "",
    [options, value]
  );

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
            <div className={isDay ? "px-3 py-2 text-sm text-slate-500" : "px-3 py-2 text-sm text-zinc-400"}>
              Nessun risultato
            </div>
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
                  isDay ? "text-slate-900 hover:bg-red-50" : "text-zinc-100 hover:bg-zinc-800",
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

function SharkScopeStyleChart({
  edoardoPoints,
  andreaPoints,
  isDay,
}: {
  edoardoPoints: CumulativePoint[];
  andreaPoints: CumulativePoint[];
  isDay: boolean;
}) {
  const width = 1120;
  const height = 420;
  const padLeft = 64;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 48;

  const allPoints = [...edoardoPoints, ...andreaPoints];
  if (allPoints.length === 0) {
    return (
      <div className={isDay ? "text-sm text-slate-600" : "text-sm text-zinc-400"}>
        Nessun dato disponibile per il grafico Profit/Loss.
      </div>
    );
  }

  const maxX = Math.max(...allPoints.map((p) => p.x), 1);
  const allY = [0, ...allPoints.map((p) => p.y)];
  const minYRaw = Math.min(...allY);
  const maxYRaw = Math.max(...allY);
  const span = Math.max(20, maxYRaw - minYRaw);
  const minY = minYRaw - span * 0.08;
  const maxY = maxYRaw + span * 0.08;

  const xScale = (x: number) => {
    const usable = width - padLeft - padRight;
    return padLeft + (x / (maxX || 1)) * usable;
  };

  const yScale = (y: number) => {
    const usable = height - padTop - padBottom;
    return padTop + ((maxY - y) / (maxY - minY || 1)) * usable;
  };

  function buildPath(points: CumulativePoint[]) {
    if (points.length === 0) return "";
    return points
      .map((p, i) => `${i === 0 ? "M" : "L"} ${xScale(p.x)} ${yScale(p.y)}`)
      .join(" ");
  }

  const zeroY = yScale(0);
  const ticks = 6;
  const yTickValues = Array.from(
    { length: ticks },
    (_, i) => minY + ((maxY - minY) / (ticks - 1)) * i
  );

  return (
    <div className="overflow-x-auto">
      <svg width={width} height={height} className="min-w-[1120px]">
        <rect
          x={padLeft}
          y={padTop}
          width={width - padLeft - padRight}
          height={height - padTop - padBottom}
          fill={isDay ? "#ffffff" : "#09090b"}
          stroke={isDay ? "#e2e8f0" : "#27272a"}
        />

        <line
          x1={padLeft}
          y1={zeroY}
          x2={width - padRight}
          y2={zeroY}
          stroke={isDay ? "#94a3b8" : "#52525b"}
          strokeDasharray="4 4"
        />

        {yTickValues.map((tick, i) => (
          <g key={i}>
            <line
              x1={padLeft}
              y1={yScale(tick)}
              x2={width - padRight}
              y2={yScale(tick)}
              stroke={isDay ? "#e2e8f0" : "#18181b"}
            />
            <text
              x={padLeft - 8}
              y={yScale(tick) + 4}
              textAnchor="end"
              fontSize="11"
              fill={isDay ? "#64748b" : "#a1a1aa"}
            >
              {euro(tick)}
            </text>
          </g>
        ))}

        {edoardoPoints.length > 0 && (
          <path d={buildPath(edoardoPoints)} fill="none" stroke="#2563eb" strokeWidth="2.5" />
        )}

        {andreaPoints.length > 0 && (
          <path d={buildPath(andreaPoints)} fill="none" stroke="#dc2626" strokeWidth="2.5" />
        )}

        {edoardoPoints.map((p, i) => (
          <circle
            key={`e-${i}`}
            cx={xScale(p.x)}
            cy={yScale(p.y)}
            r={p.kind === "return" ? 4 : 2.8}
            fill="#2563eb"
          >
            <title>{`Edoardo · ${p.label} · ${formatDateTimeIT(p.at)} · ${p.kind === "buyin" ? "Buy-in" : "Incasso"} ${euro(p.delta)} · Totale ${euro(p.y)}`}</title>
          </circle>
        ))}

        {andreaPoints.map((p, i) => (
          <circle
            key={`a-${i}`}
            cx={xScale(p.x)}
            cy={yScale(p.y)}
            r={p.kind === "return" ? 4 : 2.8}
            fill="#dc2626"
          >
            <title>{`Andrea · ${p.label} · ${formatDateTimeIT(p.at)} · ${p.kind === "buyin" ? "Buy-in" : "Incasso"} ${euro(p.delta)} · Totale ${euro(p.y)}`}</title>
          </circle>
        ))}

        <text
          x={padLeft - 42}
          y={height / 2}
          textAnchor="middle"
          fontSize="12"
          fill={isDay ? "#64748b" : "#a1a1aa"}
          transform={`rotate(-90 ${padLeft - 42} ${height / 2})`}
        >
          Guadagno cumulato (€)
        </text>

        <text
          x={width / 2}
          y={height - 12}
          textAnchor="middle"
          fontSize="12"
          fill={isDay ? "#64748b" : "#a1a1aa"}
        >
          Sequenza cronologica eventi
        </text>
      </svg>
    </div>
  );
}

function TournamentRankingChart({
  data,
  isDay,
}: {
  data: TournamentRankingRow[];
  isDay: boolean;
}) {
  if (data.length === 0) {
    return (
      <div className={isDay ? "text-sm text-slate-600" : "text-sm text-zinc-400"}>
        Nessun dato disponibile per il ranking tornei.
      </div>
    );
  }

  const width = 1100;
  const rowH = 38;
  const height = Math.max(360, data.length * rowH + 70);
  const padLeft = 260;
  const padRight = 40;
  const padTop = 20;
  const padBottom = 20;

  const allValues = [0, ...data.map((d) => d.totalProfit)];
  const minV = Math.min(...allValues);
  const maxV = Math.max(...allValues);
  const span = Math.max(20, maxV - minV);
  const minX = Math.min(0, minV - span * 0.08);
  const maxX = Math.max(0, maxV + span * 0.08);

  const xScale = (v: number) => {
    const usable = width - padLeft - padRight;
    return padLeft + ((v - minX) / (maxX - minX || 1)) * usable;
  };

  const zeroX = xScale(0);

  return (
    <div className="overflow-x-auto">
      <svg width={width} height={height} className="min-w-[1100px]">
        <line
          x1={zeroX}
          y1={padTop}
          x2={zeroX}
          y2={height - padBottom}
          stroke={isDay ? "#94a3b8" : "#52525b"}
          strokeDasharray="4 4"
        />

        {data.map((row, idx) => {
          const y = padTop + idx * rowH + 6;
          const barStart = Math.min(zeroX, xScale(row.totalProfit));
          const barEnd = Math.max(zeroX, xScale(row.totalProfit));
          const barWidth = Math.max(2, barEnd - barStart);
          const color = row.totalProfit >= 0 ? "#16a34a" : "#dc2626";

          return (
            <g key={row.tournament}>
              <text
                x={padLeft - 10}
                y={y + 12}
                textAnchor="end"
                fontSize="12"
                fill={isDay ? "#0f172a" : "#e4e4e7"}
              >
                {row.tournament}
              </text>

              <rect x={barStart} y={y - 10} width={barWidth} height={18} rx="4" fill={color}>
                <title>{`${row.tournament} · ${euro(row.totalProfit)} · Giocato ${row.playedCount} volte`}</title>
              </rect>

              <text
                x={barEnd + (row.totalProfit >= 0 ? 8 : -8)}
                y={y + 4}
                textAnchor={row.totalProfit >= 0 ? "start" : "end"}
                fontSize="12"
                fill={isDay ? "#334155" : "#d4d4d8"}
              >
                {euro(row.totalProfit)} · {row.playedCount}x
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function PokerPage() {
  const { mode } = useUIMode();
  const isDay = mode === "day";

  const pageCls = isDay
    ? "min-h-[calc(100vh-64px)] bg-[#F4F0E6] text-slate-900"
    : "min-h-[calc(100vh-64px)] bg-zinc-950 text-zinc-100";

  const panelCls = isDay
    ? "rounded-2xl border border-[#E5DFD3] bg-[#FBF8F1]"
    : "rounded-2xl border border-zinc-800 bg-zinc-900/40";

  const innerCls = isDay
    ? "rounded-xl border border-[#E5DFD3] bg-[#FFFDF8]"
    : "rounded-xl border border-zinc-800 bg-zinc-950/30";

  const inputCls = isDay
    ? "mt-1 w-full rounded-xl border border-[#D8D1C3] bg-white px-3 py-2 text-sm text-slate-900 outline-none"
    : "mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none";

  const btnPrimary = isDay
    ? "rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 transition"
    : "rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 transition";

  const btnNeutral = isDay
    ? "rounded-xl border border-[#D8D1C3] bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-[#F4F0E6]"
    : "rounded-xl bg-zinc-800 px-3 py-2 text-sm hover:bg-zinc-700";

  const btnSuccess = isDay
    ? "rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 transition"
    : "rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 transition";

  const btnDanger = isDay
    ? "rounded-xl bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-500 transition"
    : "rounded-xl bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-500 transition";

  const btnSaved = isDay
    ? "rounded-xl bg-slate-300 px-3 py-2 text-xs font-semibold text-slate-700"
    : "rounded-xl bg-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-200";

  const btnUnsaved = isDay
    ? "rounded-xl bg-amber-500 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-400 transition"
    : "rounded-xl bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-500 transition";

  const activeTabCls = isDay
    ? "rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-white"
    : "rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-white";

  const inactiveTabCls = isDay
    ? "rounded-xl border border-[#D8D1C3] bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-[#F4F0E6]"
    : "rounded-xl bg-zinc-800 px-4 py-2 text-sm font-semibold text-zinc-100 hover:bg-zinc-700";

  const headerCounterCls = isDay
    ? "rounded-xl border border-red-200 bg-[#F7F5EE] px-3 py-2 text-sm font-semibold text-slate-900"
    : "rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm font-semibold text-zinc-100";

  const sectionHeaderCls = "bg-gradient-to-r from-red-800 to-red-600 px-6 py-4";

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [activeView, setActiveView] = useState<"sessione" | "riepilogo">("sessione");
  const [chartView, setChartView] = useState<"profitloss" | "tornei">("profitloss");

  const [tournaments, setTournaments] = useState<TournamentRow[]>([]);
  const [sessions, setSessions] = useState<PokerSessionRow[]>([]);
  const [entries, setEntries] = useState<PokerSessionEntryRow[]>([]);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);

  const [selectedPlayer, setSelectedPlayer] = useState<"Edoardo" | "Andrea">("Edoardo");
  const [selectedTournamentId, setSelectedTournamentId] = useState("");
  const [sessionBuyIn, setSessionBuyIn] = useState("");

  const [newTournamentName, setNewTournamentName] = useState("");
  const [newTournamentBuyIn, setNewTournamentBuyIn] = useState("");

  const [draftValues, setDraftValues] = useState<Record<string, { itm: string; bounty: string }>>({});

  async function loadAll(showLoading: boolean) {
    if (showLoading) setLoading(true);
    setErrorMsg("");

    const [
      { data: tournamentsData, error: tournamentsError },
      { data: sessionsData, error: sessionsError },
      { data: entriesData, error: entriesError },
      { data: accountsData, error: accountsError },
    ] = await Promise.all([
      supabase.from("poker_tournaments").select("id,name,buy_in").order("name", { ascending: true }),
      supabase.from("poker_sessions").select("id,player_name,status,created_at,closed_at").order("created_at", { ascending: false }),
      supabase.from("poker_session_entries").select("id,session_id,tournament_id,tournament_name_snapshot,buy_in,itm,bounty,created_at").order("created_at", { ascending: true }),
      supabase.from("accounts").select("id,person_name,bookmaker_name,balance"),
    ]);

    const err = tournamentsError || sessionsError || entriesError || accountsError;
    if (err) {
      setErrorMsg(err.message);
      setLoading(false);
      return;
    }

    const nextEntries = (entriesData ?? []) as PokerSessionEntryRow[];

    setTournaments((tournamentsData ?? []) as TournamentRow[]);
    setSessions((sessionsData ?? []) as PokerSessionRow[]);
    setEntries(nextEntries);
    setAccounts((accountsData ?? []) as AccountRow[]);

    setDraftValues((prev) => {
      const next: Record<string, { itm: string; bounty: string }> = {};
      for (const entry of nextEntries) {
        next[entry.id] = prev[entry.id] ?? {
          itm: entry.itm !== null ? String(entry.itm) : "",
          bounty: entry.bounty !== null ? String(entry.bounty) : "",
        };
      }
      return next;
    });

    setLoading(false);
  }

  useEffect(() => {
    loadAll(true);
  }, []);

  useEffect(() => {
    if (!selectedTournamentId) {
      setSessionBuyIn("");
      return;
    }
    const found = tournaments.find((t) => t.id === selectedTournamentId);
    setSessionBuyIn(found ? String(found.buy_in) : "");
  }, [selectedTournamentId, tournaments]);

  const tournamentOptions: Option[] = useMemo(() => {
    return tournaments.map((t) => ({
      id: t.id,
      label: `${t.name} — ${euro(Number(t.buy_in ?? 0))}`,
    }));
  }, [tournaments]);

  const openSessionsByPlayer = useMemo(() => {
    const map = new Map<"Edoardo" | "Andrea", PokerSessionRow | null>();
    map.set("Edoardo", null);
    map.set("Andrea", null);

    for (const s of sessions) {
      if (s.status !== "open") continue;
      if (!map.get(s.player_name)) map.set(s.player_name, s);
    }

    return map;
  }, [sessions]);

  const entriesBySessionId = useMemo(() => {
    const map = new Map<string, PokerSessionEntryRow[]>();
    for (const entry of entries) {
      const arr = map.get(entry.session_id) ?? [];
      arr.push(entry);
      map.set(entry.session_id, arr);
    }
    return map;
  }, [entries]);

  const closedSessions = useMemo(() => {
    return sessions
      .filter((s) => s.status === "closed")
      .sort((a, b) => {
        const aTime = a.closed_at ? new Date(a.closed_at).getTime() : 0;
        const bTime = b.closed_at ? new Date(b.closed_at).getTime() : 0;
        return bTime - aTime;
      });
  }, [sessions]);

  const summaryByClosedSessionId = useMemo(() => {
    const map = new Map<
      string,
      {
        count: number;
        totalBuyIn: number;
        totalItm: number;
        totalBounty: number;
        totalProfit: number;
      }
    >();

    for (const session of closedSessions) {
      const sessionEntries = entriesBySessionId.get(session.id) ?? [];
      const totalBuyIn = sessionEntries.reduce((sum, x) => sum + Number(x.buy_in ?? 0), 0);
      const totalItm = sessionEntries.reduce((sum, x) => sum + Number(x.itm ?? 0), 0);
      const totalBounty = sessionEntries.reduce((sum, x) => sum + Number(x.bounty ?? 0), 0);
      const totalProfit = totalItm + totalBounty - totalBuyIn;

      map.set(session.id, {
        count: sessionEntries.length,
        totalBuyIn,
        totalItm,
        totalBounty,
        totalProfit,
      });
    }

    return map;
  }, [closedSessions, entriesBySessionId]);

  const groupedClosedByPlayer = useMemo(() => {
    function buildForPlayer(playerName: "Edoardo" | "Andrea") {
      const playerSessions = closedSessions.filter((s) => s.player_name === playerName);

      const monthMap = new Map<
        string,
        {
          monthTotal: number;
          days: Map<
            string,
            {
              dayTotal: number;
              sessions: PokerSessionRow[];
            }
          >;
        }
      >();

      for (const session of playerSessions) {
        const closedAt = session.closed_at ?? session.created_at;
        const dayISO = new Date(closedAt).toLocaleDateString("sv-SE");
        const monthStart = dayISO.slice(0, 7) + "-01";
        const total = summaryByClosedSessionId.get(session.id)?.totalProfit ?? 0;

        if (!monthMap.has(monthStart)) monthMap.set(monthStart, { monthTotal: 0, days: new Map() });
        const month = monthMap.get(monthStart)!;
        month.monthTotal += total;

        if (!month.days.has(dayISO)) month.days.set(dayISO, { dayTotal: 0, sessions: [] });
        const day = month.days.get(dayISO)!;
        day.dayTotal += total;
        day.sessions.push(session);
      }

      return Array.from(monthMap.entries())
        .sort((a, b) => (a[0] < b[0] ? 1 : -1))
        .map(([monthStart, month]) => ({
          monthStart,
          monthTotal: month.monthTotal,
          days: Array.from(month.days.entries())
            .sort((a, b) => (a[0] < b[0] ? 1 : -1))
            .map(([dayISO, day]) => ({
              dayISO,
              dayTotal: day.dayTotal,
              sessions: day.sessions.sort((a, b) => {
                const aTime = a.closed_at ? new Date(a.closed_at).getTime() : 0;
                const bTime = b.closed_at ? new Date(b.closed_at).getTime() : 0;
                return bTime - aTime;
              }),
            })),
        }));
    }

    return {
      Edoardo: buildForPlayer("Edoardo"),
      Andrea: buildForPlayer("Andrea"),
    };
  }, [closedSessions, summaryByClosedSessionId]);

  const overallProfits = useMemo(() => {
    let edoardo = 0;
    let andrea = 0;

    for (const session of closedSessions) {
      const profit = summaryByClosedSessionId.get(session.id)?.totalProfit ?? 0;
      if (session.player_name === "Edoardo") edoardo += profit;
      if (session.player_name === "Andrea") andrea += profit;
    }

    return {
      edoardo,
      andrea,
      total: edoardo + andrea,
    };
  }, [closedSessions, summaryByClosedSessionId]);

  const pokerstarsBalances = useMemo(() => {
    let edoardo = 0;
    let andrea = 0;

    for (const account of accounts) {
      const bookmaker = normalizeName(account.bookmaker_name);
      const person = normalizeName(account.person_name);

      if (bookmaker !== "pokerstars") continue;
      if (person === "edoardo") edoardo += Number(account.balance ?? 0);
      if (person === "andrea") andrea += Number(account.balance ?? 0);
    }

    return { edoardo, andrea };
  }, [accounts]);

  const sharkChartData = useMemo(() => {
    const events: ProfitEvent[] = [];

    for (const session of closedSessions) {
      const sessionEntries = entriesBySessionId.get(session.id) ?? [];

      for (const entry of sessionEntries) {
        events.push({
          player: session.player_name,
          at: entry.created_at,
          delta: -Number(entry.buy_in ?? 0),
          label: `${entry.tournament_name_snapshot} · Buy-in`,
          kind: "buyin",
        });

        const totalReturn = Number(entry.itm ?? 0) + Number(entry.bounty ?? 0);

        events.push({
          player: session.player_name,
          at: session.closed_at ?? entry.created_at,
          delta: totalReturn,
          label: `${entry.tournament_name_snapshot} · Return`,
          kind: "return",
        });
      }
    }

    events.sort((a, b) => {
      const ta = new Date(a.at).getTime();
      const tb = new Date(b.at).getTime();
      if (ta !== tb) return ta - tb;

      if (a.kind === b.kind) return 0;
      return a.kind === "buyin" ? -1 : 1;
    });

    let globalIndex = 0;
    let edoardoRunning = 0;
    let andreaRunning = 0;

    const edoardoPoints: CumulativePoint[] = [
      { x: 0, y: 0, at: "", label: "Start", delta: 0, kind: "buyin" },
    ];

    const andreaPoints: CumulativePoint[] = [
      { x: 0, y: 0, at: "", label: "Start", delta: 0, kind: "buyin" },
    ];

    for (const ev of events) {
      globalIndex += 1;

      if (ev.player === "Edoardo") {
        edoardoRunning += ev.delta;

        edoardoPoints.push({
          x: globalIndex,
          y: edoardoRunning,
          at: ev.at,
          label: ev.label,
          delta: ev.delta,
          kind: ev.kind,
        });
      } else {
        andreaRunning += ev.delta;

        andreaPoints.push({
          x: globalIndex,
          y: andreaRunning,
          at: ev.at,
          label: ev.label,
          delta: ev.delta,
          kind: ev.kind,
        });
      }
    }

    return { edoardoPoints, andreaPoints };
  }, [closedSessions, entriesBySessionId]);

  const tournamentRanking = useMemo(() => {
    const map = new Map<string, TournamentRankingRow>();

    for (const session of closedSessions) {
      const sessionEntries = entriesBySessionId.get(session.id) ?? [];
      for (const entry of sessionEntries) {
        const profit = Number(entry.itm ?? 0) + Number(entry.bounty ?? 0) - Number(entry.buy_in ?? 0);
        const cur = map.get(entry.tournament_name_snapshot) ?? {
          tournament: entry.tournament_name_snapshot,
          totalProfit: 0,
          playedCount: 0,
        };

        cur.totalProfit += profit;
        cur.playedCount += 1;
        map.set(entry.tournament_name_snapshot, cur);
      }
    }

    return Array.from(map.values()).sort((a, b) => b.totalProfit - a.totalProfit);
  }, [closedSessions, entriesBySessionId]);

  const statsByPlayer = useMemo(() => {
    function computeStats(player?: "Edoardo" | "Andrea"): StatsSummary {
      const relevantSessions = player
        ? closedSessions.filter((s) => s.player_name === player)
        : closedSessions;

      const flatEntries = relevantSessions.flatMap((session) =>
        (entriesBySessionId.get(session.id) ?? []).map((entry) => ({
          ...entry,
          singleProfit:
            Number(entry.itm ?? 0) + Number(entry.bounty ?? 0) - Number(entry.buy_in ?? 0),
          singleReturn: Number(entry.itm ?? 0) + Number(entry.bounty ?? 0),
        }))
      );

      const tournamentsPlayed = flatEntries.length;
      const totalBuyIn = flatEntries.reduce((sum, x) => sum + Number(x.buy_in ?? 0), 0);
      const totalReturn = flatEntries.reduce((sum, x) => sum + x.singleReturn, 0);
      const netProfit = totalReturn - totalBuyIn;
      const abi = tournamentsPlayed > 0 ? totalBuyIn / tournamentsPlayed : 0;
      const roi = totalBuyIn > 0 ? (netProfit / totalBuyIn) * 100 : 0;
      const avgProfitPerTournament = tournamentsPlayed > 0 ? netProfit / tournamentsPlayed : 0;

      const itmEntries = flatEntries.filter((x) => x.singleReturn > 0);
      const itmCount = itmEntries.length;
      const itmPct = tournamentsPlayed > 0 ? (itmCount / tournamentsPlayed) * 100 : 0;
      const avgReturnWhenItm =
        itmCount > 0 ? itmEntries.reduce((sum, x) => sum + x.singleReturn, 0) / itmCount : 0;

      const bestEntry =
        flatEntries.length > 0
          ? flatEntries.reduce((best, cur) =>
              cur.singleProfit > best.singleProfit ? cur : best
            )
          : null;

      return {
        tournamentsPlayed,
        totalBuyIn,
        totalReturn,
        netProfit,
        abi,
        roi,
        avgProfitPerTournament,
        itmCount,
        itmPct,
        avgReturnWhenItm,
        bestTournamentName: bestEntry?.tournament_name_snapshot ?? null,
        bestTournamentProfit: bestEntry?.singleProfit ?? null,
      };
    }

    return {
      total: computeStats(),
      Edoardo: computeStats("Edoardo"),
      Andrea: computeStats("Andrea"),
    };
  }, [closedSessions, entriesBySessionId]);

  async function createTournament() {
    setErrorMsg("");
    const cleanName = newTournamentName.trim();
    const cleanBuyIn = toNumberInput(newTournamentBuyIn);

    if (!cleanName) return setErrorMsg("Inserisci il nome del torneo");
    if (!Number.isFinite(cleanBuyIn) || cleanBuyIn <= 0) return setErrorMsg("Inserisci un buy-in valido");

    const alreadyExists = tournaments.some((t) => t.name.trim().toLowerCase() === cleanName.toLowerCase());
    if (alreadyExists) return setErrorMsg("Questo torneo esiste già");

    const { data, error } = await supabase
      .from("poker_tournaments")
      .insert([{ name: cleanName, buy_in: cleanBuyIn }])
      .select("id,name,buy_in")
      .single();

    if (error) return setErrorMsg(error.message);

    const created = data as TournamentRow;
    setTournaments((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
    setSelectedTournamentId(created.id);
    setSessionBuyIn(String(created.buy_in));
    setNewTournamentName("");
    setNewTournamentBuyIn("");
  }

  async function addTournamentToSession() {
    setErrorMsg("");
    if (!selectedTournamentId) return setErrorMsg("Seleziona un torneo");

    const { error } = await supabase.rpc("add_poker_tournament_to_current_session", {
      p_player_name: selectedPlayer,
      p_tournament_id: selectedTournamentId,
    });

    if (error) return setErrorMsg(error.message);

    setSelectedTournamentId("");
    setSessionBuyIn("");
    await loadAll(false);
  }

  async function saveEntryFields(entryId: string) {
    setErrorMsg("");
    const draft = draftValues[entryId] ?? { itm: "", bounty: "" };
    const itm = toNumberInput(draft.itm);
    const bounty = toNumberInput(draft.bounty);

    if (!Number.isFinite(itm) || itm < 0 || !Number.isFinite(bounty) || bounty < 0) {
      return setErrorMsg("ITM e Bounty devono essere numeri uguali o maggiori di 0");
    }

    const { error } = await supabase
      .from("poker_session_entries")
      .update({ itm, bounty })
      .eq("id", entryId);

    if (error) return setErrorMsg(error.message);

    setEntries((prev) =>
      prev.map((entry) => (entry.id === entryId ? { ...entry, itm, bounty } : entry))
    );

    setDraftValues((prev) => ({
      ...prev,
      [entryId]: {
        itm: String(itm),
        bounty: String(bounty),
      },
    }));
  }

  async function deleteEntry(entryId: string) {
    const ok = window.confirm("Vuoi eliminare questo torneo dalla sessione?");
    if (!ok) return;

    setErrorMsg("");
    const { error } = await supabase.rpc("delete_poker_session_entry", { p_entry_id: entryId });
    if (error) return setErrorMsg(error.message);

    await loadAll(false);
  }

  async function closeSession(sessionId: string) {
    setErrorMsg("");
    const { error } = await supabase.rpc("close_poker_session", { p_session_id: sessionId });
    if (error) return setErrorMsg(error.message);

    await loadAll(false);
    setActiveView("riepilogo");
  }

  async function deleteClosedSession(sessionId: string) {
    const ok = window.confirm("Vuoi eliminare questa sessione chiusa? Il saldo PokerStars verrà ripristinato.");
    if (!ok) return;

    setErrorMsg("");
    const { error } = await supabase.rpc("delete_closed_poker_session", { p_session_id: sessionId });
    if (error) return setErrorMsg(error.message);

    await loadAll(false);
  }

  function renderSessionColumn(playerName: "Edoardo" | "Andrea") {
    const session = openSessionsByPlayer.get(playerName);
    const sessionEntries = session ? entriesBySessionId.get(session.id) ?? [] : [];

    const canClose =
      !!session &&
      sessionEntries.length > 0 &&
      sessionEntries.every((entry) => entry.itm !== null && entry.bounty !== null);

    const totalBuyIn = sessionEntries.reduce((sum, x) => sum + Number(x.buy_in ?? 0), 0);
    const totalItm = sessionEntries.reduce((sum, x) => sum + Number(x.itm ?? 0), 0);
    const totalBounty = sessionEntries.reduce((sum, x) => sum + Number(x.bounty ?? 0), 0);
    const totalProfit = totalItm + totalBounty - totalBuyIn;

    return (
      <div className="overflow-hidden rounded-2xl border border-red-200">
        <div className={sectionHeaderCls}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold tracking-wide text-white">{playerName}</h3>
              <div className="mt-1 text-sm text-red-100">
                {session ? `Sessione aperta il ${formatDateTimeIT(session.created_at)}` : "Nessuna sessione aperta"}
              </div>
            </div>
            <div className={headerCounterCls}>{sessionEntries.length} tornei</div>
          </div>
        </div>

        <div className={panelCls + " p-6"}>
          {!session ? (
            <div className={isDay ? "text-sm text-slate-600" : "text-sm text-zinc-400"}>
              Nessuna sessione corrente per {playerName}.
            </div>
          ) : sessionEntries.length === 0 ? (
            <div className={isDay ? "text-sm text-slate-600" : "text-sm text-zinc-400"}>
              Sessione aperta ma senza tornei.
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {sessionEntries.map((entry) => {
                  const currentDraft = draftValues[entry.id] ?? {
                    itm: entry.itm !== null ? String(entry.itm) : "",
                    bounty: entry.bounty !== null ? String(entry.bounty) : "",
                  };

                  const isSaved =
                    currentDraft.itm === (entry.itm !== null ? String(entry.itm) : "") &&
                    currentDraft.bounty === (entry.bounty !== null ? String(entry.bounty) : "");

                  return (
                    <div key={entry.id} className={innerCls + " p-4"}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold">{entry.tournament_name_snapshot}</div>
                          <div className={isDay ? "mt-1 text-xs text-slate-500" : "mt-1 text-xs text-zinc-400"}>
                            Buy-in: {euro(Number(entry.buy_in ?? 0))}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className={isDay ? "text-xs text-slate-500" : "text-xs text-zinc-400"}>
                            {formatDateTimeIT(entry.created_at)}
                          </div>
                          <button onClick={() => deleteEntry(entry.id)} className={btnDanger}>
                            Elimina
                          </button>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                        <label className={isDay ? "text-sm text-slate-700" : "text-sm text-zinc-300"}>
                          ITM
                          <input
                            value={currentDraft.itm}
                            onChange={(e) =>
                              setDraftValues((prev) => ({
                                ...prev,
                                [entry.id]: {
                                  itm: e.target.value,
                                  bounty: prev[entry.id]?.bounty ?? currentDraft.bounty,
                                },
                              }))
                            }
                            className={inputCls}
                            placeholder="Inserisci ITM"
                          />
                        </label>

                        <label className={isDay ? "text-sm text-slate-700" : "text-sm text-zinc-300"}>
                          Bounty
                          <input
                            value={currentDraft.bounty}
                            onChange={(e) =>
                              setDraftValues((prev) => ({
                                ...prev,
                                [entry.id]: {
                                  itm: prev[entry.id]?.itm ?? currentDraft.itm,
                                  bounty: e.target.value,
                                },
                              }))
                            }
                            className={inputCls}
                            placeholder="Inserisci Bounty"
                          />
                        </label>
                      </div>

                      <div className="mt-4 flex items-center gap-3">
                        <button onClick={() => saveEntryFields(entry.id)} className={isSaved ? btnSaved : btnUnsaved}>
                          {isSaved ? "Salvato" : "Salva ITM / Bounty"}
                        </button>
                        <div className={isDay ? "text-xs text-slate-500" : "text-xs text-zinc-400"}>
                          {isSaved ? "Valori già salvati" : "Ci sono modifiche da salvare"}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className={innerCls + " mt-4 p-4"}>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="font-semibold">Tornei:</span> {sessionEntries.length}</div>
                  <div><span className="font-semibold">Buy-in totale:</span> {euro(totalBuyIn)}</div>
                  <div><span className="font-semibold">ITM totale:</span> {euro(totalItm)}</div>
                  <div><span className="font-semibold">Bounty totale:</span> {euro(totalBounty)}</div>
                  <div className="col-span-2">
                    <span className="font-semibold">Profitto sessione:</span>{" "}
                    <span className={amountClass(totalProfit, isDay)}>{euro(totalProfit)}</span>
                  </div>
                </div>
              </div>

              {canClose && (
                <div className="mt-4">
                  <button onClick={() => closeSession(session.id)} className={btnSuccess}>
                    Termina sessione
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  function renderClosedPlayerSection(playerName: "Edoardo" | "Andrea") {
    const months = groupedClosedByPlayer[playerName];
    const playerProfit = playerName === "Edoardo" ? overallProfits.edoardo : overallProfits.andrea;

    return (
      <div className="overflow-hidden rounded-2xl border border-red-200">
        <div className={sectionHeaderCls}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold tracking-wide text-white">{playerName}</h3>
              <div className="mt-1 text-sm text-red-100">Sessioni chiuse raggruppate per mese e giorno.</div>
            </div>
            <div className={headerCounterCls}>
              <span className={amountClass(playerProfit, isDay)}>{euro(playerProfit)}</span>
            </div>
          </div>
        </div>

        <div className={panelCls + " p-6"}>
          {months.length === 0 ? (
            <div className={isDay ? "text-sm text-slate-600" : "text-sm text-zinc-400"}>
              Nessuna sessione chiusa per {playerName}.
            </div>
          ) : (
            <div className="space-y-3">
              {months.map((month) => (
                <details key={month.monthStart} className={innerCls}>
                  <summary className="cursor-pointer select-none px-4 py-3 flex items-center justify-between">
                    <div className={isDay ? "text-sm font-semibold text-slate-900" : "text-sm font-semibold text-zinc-100"}>
                      {monthLabel(month.monthStart)}
                    </div>
                    <div className={`text-sm font-semibold ${amountClass(month.monthTotal, isDay)}`}>
                      Totale mese: {euro(month.monthTotal)}
                    </div>
                  </summary>

                  <div className="px-4 pb-4 space-y-2">
                    {month.days.map((day) => (
                      <details key={day.dayISO} className={innerCls}>
                        <summary className="cursor-pointer select-none px-4 py-3 flex items-center justify-between">
                          <div className={isDay ? "text-sm text-slate-900" : "text-sm text-zinc-100"}>{day.dayISO}</div>
                          <div className={`text-sm font-semibold ${amountClass(day.dayTotal, isDay)}`}>
                            Totale giorno: {euro(day.dayTotal)}
                          </div>
                        </summary>

                        <div className="px-4 pb-4 space-y-3">
                          {day.sessions.map((session) => {
                            const summary = summaryByClosedSessionId.get(session.id) ?? {
                              count: 0,
                              totalBuyIn: 0,
                              totalItm: 0,
                              totalBounty: 0,
                              totalProfit: 0,
                            };

                            return (
                              <div key={session.id} className={innerCls + " p-4"}>
                                <div className="flex items-start justify-between gap-4">
                                  <div>
                                    <div className="text-sm font-semibold">
                                      Chiusura: {session.closed_at ? formatDateTimeIT(session.closed_at) : "—"}
                                    </div>
                                    <div className={isDay ? "mt-1 text-xs text-slate-500" : "mt-1 text-xs text-zinc-400"}>
                                      Apertura: {formatDateTimeIT(session.created_at)}
                                    </div>
                                  </div>

                                  <button onClick={() => deleteClosedSession(session.id)} className={btnDanger}>
                                    Elimina sessione
                                  </button>
                                </div>

                                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                                  <div><span className="font-semibold">Tornei:</span> {summary.count}</div>
                                  <div><span className="font-semibold">Totale buy-in:</span> {euro(summary.totalBuyIn)}</div>
                                  <div><span className="font-semibold">Totale ITM:</span> {euro(summary.totalItm)}</div>
                                  <div><span className="font-semibold">Totale bounty:</span> {euro(summary.totalBounty)}</div>
                                  <div className="col-span-2">
                                    <span className="font-semibold">Profitto finale:</span>{" "}
                                    <span className={amountClass(summary.totalProfit, isDay)}>{euro(summary.totalProfit)}</span>
                                  </div>
                                </div>
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
      </div>
    );
  }

  function renderStatsBlock(title: string, stats: StatsSummary) {
    return (
      <div className={innerCls + " p-4"}>
        <div className="mb-3 text-sm font-semibold">{title}</div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="font-semibold">Tornei:</span> {stats.tournamentsPlayed}
          </div>
          <div>
            <span className="font-semibold">Buy-in totale:</span> {euro(stats.totalBuyIn)}
          </div>
          <div>
            <span className="font-semibold">ABI:</span> {euro(stats.abi)}
          </div>
          <div>
            <span className="font-semibold">ROI:</span>{" "}
            <span className={amountClass(stats.roi, isDay)}>{pct(stats.roi)}</span>
          </div>
          <div>
            <span className="font-semibold">Profitto netto:</span>{" "}
            <span className={amountClass(stats.netProfit, isDay)}>{euro(stats.netProfit)}</span>
          </div>
          <div>
            <span className="font-semibold">Profitto medio:</span>{" "}
            <span className={amountClass(stats.avgProfitPerTournament, isDay)}>
              {euro(stats.avgProfitPerTournament)}
            </span>
          </div>
          <div>
            <span className="font-semibold">ITM %:</span> {pct(stats.itmPct)}
          </div>
          <div>
            <span className="font-semibold">Incasso medio ITM:</span> {euro(stats.avgReturnWhenItm)}
          </div>
          <div className="col-span-2">
            <span className="font-semibold">Best torneo:</span>{" "}
            {stats.bestTournamentName ? (
              <>
                {stats.bestTournamentName} —{" "}
                <span className={amountClass(stats.bestTournamentProfit ?? 0, isDay)}>
                  {euro(stats.bestTournamentProfit ?? 0)}
                </span>
              </>
            ) : (
              "—"
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className={pageCls}>
      <div className="p-6">
        {errorMsg && (
          <div className={`${innerCls} mb-4 p-3 text-sm`}>
            <span className={isDay ? "font-semibold text-red-700" : "font-semibold text-red-300"}>
              Errore:
            </span>{" "}
            {errorMsg}
          </div>
        )}

        <div className="mb-6 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveView("sessione")}
            className={activeView === "sessione" ? activeTabCls : inactiveTabCls}
          >
            Sessione
          </button>
          <button
            type="button"
            onClick={() => setActiveView("riepilogo")}
            className={activeView === "riepilogo" ? activeTabCls : inactiveTabCls}
          >
            Riepilogo
          </button>
        </div>

        {loading ? (
          <div className={isDay ? "text-slate-600" : "text-zinc-400"}>Caricamento…</div>
        ) : activeView === "sessione" ? (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.5fr_1fr]">
            <section className="space-y-6">
              <div className="overflow-hidden rounded-2xl border border-red-200">
                <div className={sectionHeaderCls}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-semibold tracking-wide text-white">Sessione Corrente</h2>
                      <div className="mt-1 text-sm text-red-100">
                        Le sessioni aperte di Edoardo e Andrea vengono mostrate affiancate.
                      </div>
                    </div>
                    <div className={headerCounterCls}>
                      Aperte: {(openSessionsByPlayer.get("Edoardo") ? 1 : 0) + (openSessionsByPlayer.get("Andrea") ? 1 : 0)}
                    </div>
                  </div>
                </div>

                <div className={panelCls + " p-6"}>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className={innerCls + " p-4"}>
                      <div className="text-sm font-semibold">Saldo PokerStars Edoardo</div>
                      <div className="mt-2 text-lg font-semibold">{euro(pokerstarsBalances.edoardo)}</div>
                    </div>
                    <div className={innerCls + " p-4"}>
                      <div className="text-sm font-semibold">Saldo PokerStars Andrea</div>
                      <div className="mt-2 text-lg font-semibold">{euro(pokerstarsBalances.andrea)}</div>
                    </div>
                  </div>

                  <div className="mt-6 grid grid-cols-1 gap-6 2xl:grid-cols-2">
                    {renderSessionColumn("Edoardo")}
                    {renderSessionColumn("Andrea")}
                  </div>
                </div>
              </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-red-200">
              <div className={sectionHeaderCls}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold tracking-wide text-white">Nuova Sessione</h2>
                    <div className="mt-1 text-sm text-red-100">
                      Aggiungi nuovi tornei alla sessione aperta del giocatore.
                    </div>
                  </div>
                  <div className={headerCounterCls}>{tournaments.length} tornei</div>
                </div>
              </div>

              <div className={panelCls + " p-6"}>
                <div className="grid gap-4">
                  <label className={isDay ? "text-sm text-slate-700" : "text-sm text-zinc-300"}>
                    Giocatore
                    <select
                      value={selectedPlayer}
                      onChange={(e) => setSelectedPlayer(e.target.value as "Edoardo" | "Andrea")}
                      className={inputCls}
                      style={isDay ? undefined : { colorScheme: "dark" }}
                    >
                      <option value="Edoardo">Edoardo</option>
                      <option value="Andrea">Andrea</option>
                    </select>
                  </label>

                  <div className={innerCls + " p-4"}>
                    <SearchSelect
                      label="Torneo"
                      value={selectedTournamentId}
                      options={tournamentOptions}
                      placeholder="Scrivi per cercare un torneo..."
                      onChange={setSelectedTournamentId}
                      isDay={isDay}
                    />

                    <label className={isDay ? "mt-4 block text-sm text-slate-700" : "mt-4 block text-sm text-zinc-300"}>
                      Buy-in
                      <input
                        value={sessionBuyIn}
                        readOnly
                        className={inputCls}
                        placeholder="Si compila automaticamente"
                      />
                    </label>

                    <div className="mt-4">
                      <button onClick={addTournamentToSession} className={btnPrimary}>
                        Aggiungi torneo alla sessione
                      </button>
                    </div>
                  </div>

                  <div className={innerCls + " p-4"}>
                    <h3 className="text-sm font-semibold">Aggiungi nuovo torneo</h3>

                    <label className={isDay ? "mt-4 block text-sm text-slate-700" : "mt-4 block text-sm text-zinc-300"}>
                      Nome torneo
                      <input
                        value={newTournamentName}
                        onChange={(e) => setNewTournamentName(e.target.value)}
                        className={inputCls}
                        placeholder="Es. Sunday Special"
                      />
                    </label>

                    <label className={isDay ? "mt-4 block text-sm text-slate-700" : "mt-4 block text-sm text-zinc-300"}>
                      Buy-in torneo
                      <input
                        value={newTournamentBuyIn}
                        onChange={(e) => setNewTournamentBuyIn(e.target.value)}
                        className={inputCls}
                        placeholder="Es. 100"
                      />
                    </label>

                    <div className="mt-4">
                      <button onClick={createTournament} className={btnPrimary}>
                        Salva torneo
                      </button>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button onClick={() => loadAll(false)} className={btnNeutral}>
                      Aggiorna
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <section className="overflow-hidden rounded-2xl border border-red-200">
                <div className={sectionHeaderCls}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-semibold tracking-wide text-white">Profitti complessivi</h2>
                      <div className="mt-1 text-sm text-red-100">
                        Totale Edoardo, totale Andrea e totale combinato.
                      </div>
                    </div>
                    <div className={headerCounterCls}>{closedSessions.length} sessioni</div>
                  </div>
                </div>

                <div className={panelCls + " p-6"}>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className={innerCls + " p-4"}>
                      <div className="text-sm font-semibold">Profitto Edoardo</div>
                      <div className={`mt-2 text-lg font-semibold ${amountClass(overallProfits.edoardo, isDay)}`}>
                        {euro(overallProfits.edoardo)}
                      </div>
                    </div>
                    <div className={innerCls + " p-4"}>
                      <div className="text-sm font-semibold">Profitto Andrea</div>
                      <div className={`mt-2 text-lg font-semibold ${amountClass(overallProfits.andrea, isDay)}`}>
                        {euro(overallProfits.andrea)}
                      </div>
                    </div>
                    <div className={innerCls + " p-4"}>
                      <div className="text-sm font-semibold">Profitto Totale</div>
                      <div className={`mt-2 text-lg font-semibold ${amountClass(overallProfits.total, isDay)}`}>
                        {euro(overallProfits.total)}
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section className="overflow-hidden rounded-2xl border border-red-200">
                <div className={sectionHeaderCls}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-semibold tracking-wide text-white">Statistiche</h2>
                      <div className="mt-1 text-sm text-red-100">
                        ABI, ROI e indicatori principali su totale, Edoardo e Andrea.
                      </div>
                    </div>
                    <div className={headerCounterCls}>Live</div>
                  </div>
                </div>

                <div className={panelCls + " p-6 space-y-4"}>
                  {renderStatsBlock("Totale", statsByPlayer.total)}
                  {renderStatsBlock("Edoardo", statsByPlayer.Edoardo)}
                  {renderStatsBlock("Andrea", statsByPlayer.Andrea)}
                </div>
              </section>
            </div>

                        <section className="space-y-6">
              {renderClosedPlayerSection("Edoardo")}
              {renderClosedPlayerSection("Andrea")}
            </section>

            <section className="overflow-hidden rounded-2xl border border-red-200">
              <div className={sectionHeaderCls}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold tracking-wide text-white">Grafici</h2>
                    <div className="mt-1 text-sm text-red-100">
                      Andamento cumulato stile SharkScope e ranking dei tornei più profittevoli.
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setChartView("profitloss")}
                      className={chartView === "profitloss" ? activeTabCls : inactiveTabCls}
                    >
                      Profit/Loss
                    </button>
                    <button
                      type="button"
                      onClick={() => setChartView("tornei")}
                      className={chartView === "tornei" ? activeTabCls : inactiveTabCls}
                    >
                      Tornei
                    </button>
                  </div>
                </div>
              </div>

              <div className={panelCls + " p-6"}>
                <div className="mb-4 flex items-center gap-6 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-3 w-3 rounded-full bg-blue-600" />
                    <span>Edoardo</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-3 w-3 rounded-full bg-red-600" />
                    <span>Andrea</span>
                  </div>
                </div>

                {chartView === "profitloss" ? (
                  <SharkScopeStyleChart
                    edoardoPoints={sharkChartData.edoardoPoints}
                    andreaPoints={sharkChartData.andreaPoints}
                    isDay={isDay}
                  />
                ) : (
                  <TournamentRankingChart data={tournamentRanking} isDay={isDay} />
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}