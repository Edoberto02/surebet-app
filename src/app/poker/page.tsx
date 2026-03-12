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

function euro(n: number) {
  const v = Number.isFinite(n) ? n : 0;
  return v.toLocaleString("it-IT", { style: "currency", currency: "EUR" });
}

function toNumberInput(value: string) {
  return Number(String(value).replace(",", "."));
}

function formatDateTimeIT(value: string) {
  return new Date(value).toLocaleString("it-IT");
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

  const activeTabCls = isDay
    ? "rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-white"
    : "rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-white";

  const inactiveTabCls = isDay
    ? "rounded-xl border border-[#D8D1C3] bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-[#F4F0E6]"
    : "rounded-xl bg-zinc-800 px-4 py-2 text-sm font-semibold text-zinc-100 hover:bg-zinc-700";

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [activeView, setActiveView] = useState<"sessione" | "riepilogo">("sessione");

  const [tournaments, setTournaments] = useState<TournamentRow[]>([]);
  const [sessions, setSessions] = useState<PokerSessionRow[]>([]);
  const [entries, setEntries] = useState<PokerSessionEntryRow[]>([]);

  const [selectedPlayer, setSelectedPlayer] = useState<"Edoardo" | "Andrea">("Edoardo");
  const [selectedTournamentId, setSelectedTournamentId] = useState("");
  const [sessionBuyIn, setSessionBuyIn] = useState("");

  const [newTournamentName, setNewTournamentName] = useState("");
  const [newTournamentBuyIn, setNewTournamentBuyIn] = useState("");

  async function loadAll(showLoading: boolean) {
    if (showLoading) setLoading(true);
    setErrorMsg("");

    const [
      { data: tournamentsData, error: tournamentsError },
      { data: sessionsData, error: sessionsError },
      { data: entriesData, error: entriesError },
    ] = await Promise.all([
      supabase
        .from("poker_tournaments")
        .select("id,name,buy_in")
        .order("name", { ascending: true }),

      supabase
        .from("poker_sessions")
        .select("id,player_name,status,created_at,closed_at")
        .order("created_at", { ascending: false }),

      supabase
        .from("poker_session_entries")
        .select("id,session_id,tournament_id,tournament_name_snapshot,buy_in,itm,bounty,created_at")
        .order("created_at", { ascending: true }),
    ]);

    const err = tournamentsError || sessionsError || entriesError;
    if (err) {
      setErrorMsg(err.message);
      setLoading(false);
      return;
    }

    setTournaments((tournamentsData ?? []) as TournamentRow[]);
    setSessions((sessionsData ?? []) as PokerSessionRow[]);
    setEntries((entriesData ?? []) as PokerSessionEntryRow[]);
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

  const tournamentOptions = useMemo(() => {
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
      if (!map.get(s.player_name)) {
        map.set(s.player_name, s);
      }
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
    return sessions.filter((s) => s.status === "closed");
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

  async function createTournament() {
    setErrorMsg("");

    const cleanName = newTournamentName.trim();
    const cleanBuyIn = toNumberInput(newTournamentBuyIn);

    if (!cleanName) {
      setErrorMsg("Inserisci il nome del torneo");
      return;
    }

    if (!Number.isFinite(cleanBuyIn) || cleanBuyIn <= 0) {
      setErrorMsg("Inserisci un buy-in valido");
      return;
    }

    const alreadyExists = tournaments.some(
      (t) => t.name.trim().toLowerCase() === cleanName.toLowerCase()
    );

    if (alreadyExists) {
      setErrorMsg("Questo torneo esiste già");
      return;
    }

    const { data, error } = await supabase
      .from("poker_tournaments")
      .insert([
        {
          name: cleanName,
          buy_in: cleanBuyIn,
        },
      ])
      .select("id,name,buy_in")
      .single();

    if (error) {
      setErrorMsg(error.message);
      return;
    }

    const created = data as TournamentRow;

    setTournaments((prev) =>
      [...prev, created].sort((a, b) => a.name.localeCompare(b.name))
    );

    setSelectedTournamentId(created.id);
    setSessionBuyIn(String(created.buy_in));
    setNewTournamentName("");
    setNewTournamentBuyIn("");
  }

  async function addTournamentToSession() {
    setErrorMsg("");

    if (!selectedPlayer) {
      setErrorMsg("Seleziona il giocatore");
      return;
    }

    if (!selectedTournamentId) {
      setErrorMsg("Seleziona un torneo");
      return;
    }

    const { error } = await supabase.rpc("add_poker_tournament_to_current_session", {
      p_player_name: selectedPlayer,
      p_tournament_id: selectedTournamentId,
    });

    if (error) {
      setErrorMsg(error.message);
      return;
    }

    setSelectedTournamentId("");
    setSessionBuyIn("");
    await loadAll(false);
  }

  async function updateEntryField(
    entryId: string,
    field: "itm" | "bounty",
    value: string
  ) {
    setErrorMsg("");

    const num = toNumberInput(value);

    if (!Number.isFinite(num) || num < 0) {
      setErrorMsg("ITM e Bounty devono essere numeri uguali o maggiori di 0");
      return;
    }

    const { error } = await supabase
      .from("poker_session_entries")
      .update({ [field]: num })
      .eq("id", entryId);

    if (error) {
      setErrorMsg(error.message);
      return;
    }

    setEntries((prev) =>
      prev.map((entry) =>
        entry.id === entryId ? { ...entry, [field]: num } : entry
      )
    );
  }

  async function closeSession(sessionId: string) {
    setErrorMsg("");

    const { error } = await supabase.rpc("close_poker_session", {
      p_session_id: sessionId,
    });

    if (error) {
      setErrorMsg(error.message);
      return;
    }

    await loadAll(false);
    setActiveView("riepilogo");
  }

  function SessionColumn({ playerName }: { playerName: "Edoardo" | "Andrea" }) {
    const session = openSessionsByPlayer.get(playerName);
    const sessionEntries = session ? entriesBySessionId.get(session.id) ?? [] : [];

    const canClose =
      !!session &&
      sessionEntries.length > 0 &&
      sessionEntries.every(
        (entry) => entry.itm !== null && entry.bounty !== null
      );

    const totalBuyIn = sessionEntries.reduce((sum, x) => sum + Number(x.buy_in ?? 0), 0);
    const totalItm = sessionEntries.reduce((sum, x) => sum + Number(x.itm ?? 0), 0);
    const totalBounty = sessionEntries.reduce((sum, x) => sum + Number(x.bounty ?? 0), 0);
    const totalProfit = totalItm + totalBounty - totalBuyIn;

    return (
      <div className={panelCls + " p-6"}>
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-xl font-semibold">{playerName}</h3>
          {session ? (
            <div className={isDay ? "text-xs text-slate-500" : "text-xs text-zinc-400"}>
              Aperta il {formatDateTimeIT(session.created_at)}
            </div>
          ) : (
            <div className={isDay ? "text-xs text-slate-500" : "text-xs text-zinc-400"}>
              Nessuna sessione aperta
            </div>
          )}
        </div>

        {!session ? (
          <div className={isDay ? "mt-4 text-sm text-slate-600" : "mt-4 text-sm text-zinc-400"}>
            Nessuna sessione corrente per {playerName}.
          </div>
        ) : sessionEntries.length === 0 ? (
          <div className={isDay ? "mt-4 text-sm text-slate-600" : "mt-4 text-sm text-zinc-400"}>
            Sessione aperta ma senza tornei.
          </div>
        ) : (
          <>
            <div className="mt-4 space-y-3">
              {sessionEntries.map((entry) => (
                <div key={entry.id} className={innerCls + " p-4"}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">{entry.tournament_name_snapshot}</div>
                      <div className={isDay ? "mt-1 text-xs text-slate-500" : "mt-1 text-xs text-zinc-400"}>
                        Buy-in: {euro(Number(entry.buy_in ?? 0))}
                      </div>
                    </div>

                    <div className={isDay ? "text-xs text-slate-500" : "text-xs text-zinc-400"}>
                      {formatDateTimeIT(entry.created_at)}
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                    <label className={isDay ? "text-sm text-slate-700" : "text-sm text-zinc-300"}>
                      ITM
                      <input
                        defaultValue={entry.itm ?? ""}
                        onBlur={(e) => updateEntryField(entry.id, "itm", e.target.value)}
                        className={inputCls}
                        placeholder="Inserisci ITM"
                      />
                    </label>

                    <label className={isDay ? "text-sm text-slate-700" : "text-sm text-zinc-300"}>
                      Bounty
                      <input
                        defaultValue={entry.bounty ?? ""}
                        onBlur={(e) => updateEntryField(entry.id, "bounty", e.target.value)}
                        className={inputCls}
                        placeholder="Inserisci Bounty"
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>

            <div className={innerCls + " mt-4 p-4"}>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="font-semibold">Tornei:</span> {sessionEntries.length}
                </div>
                <div>
                  <span className="font-semibold">Buy-in totale:</span> {euro(totalBuyIn)}
                </div>
                <div>
                  <span className="font-semibold">ITM totale:</span> {euro(totalItm)}
                </div>
                <div>
                  <span className="font-semibold">Bounty totale:</span> {euro(totalBounty)}
                </div>
                <div className="col-span-2">
                  <span className="font-semibold">Profitto sessione:</span> {euro(totalProfit)}
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
              <div className={panelCls + " p-6"}>
                <h2 className="text-xl font-semibold">Sessione Corrente</h2>
                <div className={isDay ? "mt-2 text-sm text-slate-600" : "mt-2 text-sm text-zinc-400"}>
                  Le sessioni aperte di Edoardo e Andrea vengono mostrate affiancate.
                </div>

                <div className="mt-6 grid grid-cols-1 gap-6 2xl:grid-cols-2">
                  <SessionColumn playerName="Edoardo" />
                  <SessionColumn playerName="Andrea" />
                </div>
              </div>
            </section>

            <section className={panelCls + " p-6"}>
              <h2 className="text-xl font-semibold">Nuova Sessione</h2>

              <div className="mt-6 grid gap-4">
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
                  <h3 className="text-sm font-semibold">Torneo selezionabile</h3>

                  <label className={isDay ? "mt-4 block text-sm text-slate-700" : "mt-4 block text-sm text-zinc-300"}>
                    Torneo
                    <select
                      value={selectedTournamentId}
                      onChange={(e) => setSelectedTournamentId(e.target.value)}
                      className={inputCls}
                      style={isDay ? undefined : { colorScheme: "dark" }}
                    >
                      <option value="">Seleziona un torneo…</option>
                      {tournamentOptions.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </label>

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
            </section>
          </div>
        ) : (
          <section className={panelCls + " p-6"}>
            <h2 className="text-xl font-semibold">Riepilogo</h2>
            <div className={isDay ? "mt-2 text-sm text-slate-600" : "mt-2 text-sm text-zinc-400"}>
              Qui trovi le sessioni chiuse con i totali principali.
            </div>

            {closedSessions.length === 0 ? (
              <div className={isDay ? "mt-6 text-sm text-slate-600" : "mt-6 text-sm text-zinc-400"}>
                Nessuna sessione chiusa.
              </div>
            ) : (
              <div className="mt-6 space-y-3">
                {closedSessions.map((session) => {
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
                          <div className="text-sm font-semibold">{session.player_name}</div>
                          <div className={isDay ? "mt-1 text-xs text-slate-500" : "mt-1 text-xs text-zinc-400"}>
                            Apertura: {formatDateTimeIT(session.created_at)}
                          </div>
                          <div className={isDay ? "mt-1 text-xs text-slate-500" : "mt-1 text-xs text-zinc-400"}>
                            Chiusura: {session.closed_at ? formatDateTimeIT(session.closed_at) : "—"}
                          </div>
                        </div>

                        <div className={isDay ? "text-xs text-slate-500" : "text-xs text-zinc-400"}>
                          Tornei: {summary.count}
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="font-semibold">Totale buy-in:</span> {euro(summary.totalBuyIn)}
                        </div>
                        <div>
                          <span className="font-semibold">Totale ITM:</span> {euro(summary.totalItm)}
                        </div>
                        <div>
                          <span className="font-semibold">Totale bounty:</span> {euro(summary.totalBounty)}
                        </div>
                        <div>
                          <span className="font-semibold">Profitto finale:</span> {euro(summary.totalProfit)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}