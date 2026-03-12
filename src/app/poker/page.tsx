"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useUIMode } from "../components/UIModeProvider";

type TournamentRow = {
  id: string;
  name: string;
  buy_in: number;
};

function euro(n: number) {
  const v = Number.isFinite(n) ? n : 0;
  return v.toLocaleString("it-IT", { style: "currency", currency: "EUR" });
}

function toNumberInput(value: string) {
  return Number(String(value).replace(",", "."));
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

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const [tournaments, setTournaments] = useState<TournamentRow[]>([]);

  const [selectedPlayer, setSelectedPlayer] = useState("Edoardo");
  const [selectedTournamentId, setSelectedTournamentId] = useState("");
  const [sessionBuyIn, setSessionBuyIn] = useState("");

  const [newTournamentName, setNewTournamentName] = useState("");
  const [newTournamentBuyIn, setNewTournamentBuyIn] = useState("");

  async function loadTournaments(showLoading: boolean) {
    if (showLoading) setLoading(true);
    setErrorMsg("");

    const { data, error } = await supabase
      .from("poker_tournaments")
      .select("id,name,buy_in")
      .order("name", { ascending: true });

    if (error) {
      setErrorMsg(error.message);
      setLoading(false);
      return;
    }

    setTournaments((data ?? []) as TournamentRow[]);
    setLoading(false);
  }

  useEffect(() => {
    loadTournaments(true);
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

        {loading ? (
          <div className={isDay ? "text-slate-600" : "text-zinc-400"}>Caricamento…</div>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* COLONNA SINISTRA - vuota per ora */}
            <section className={`${panelCls} min-h-[500px] p-6`}>
              <h2 className="text-xl font-semibold">Poker</h2>
              <div className={isDay ? "mt-2 text-sm text-slate-600" : "mt-2 text-sm text-zinc-400"}>
                Questa parte per ora resta vuota. La programmeremo dopo.
              </div>
            </section>

            {/* COLONNA DESTRA - Nuova Sessione */}
            <section className={`${panelCls} p-6`}>
              <h2 className="text-xl font-semibold">Nuova Sessione</h2>

              <div className="mt-6 grid gap-4">
                <label className={isDay ? "text-sm text-slate-700" : "text-sm text-zinc-300"}>
                  Giocatore
                  <select
                    value={selectedPlayer}
                    onChange={(e) => setSelectedPlayer(e.target.value)}
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

                <div className={innerCls + " p-4"}>
                  <div className={isDay ? "text-sm text-slate-700" : "text-sm text-zinc-300"}>
                    <span className="font-semibold">Giocatore selezionato:</span> {selectedPlayer}
                  </div>

                  <div className={isDay ? "mt-2 text-sm text-slate-700" : "mt-2 text-sm text-zinc-300"}>
                    <span className="font-semibold">Torneo selezionato:</span>{" "}
                    {selectedTournamentId
                      ? tournaments.find((t) => t.id === selectedTournamentId)?.name ?? "—"
                      : "—"}
                  </div>

                  <div className={isDay ? "mt-2 text-sm text-slate-700" : "mt-2 text-sm text-zinc-300"}>
                    <span className="font-semibold">Buy-in:</span>{" "}
                    {sessionBuyIn ? euro(toNumberInput(sessionBuyIn)) : "—"}
                  </div>
                </div>

                <div className="pt-2">
                  <button onClick={() => loadTournaments(false)} className={btnNeutral}>
                    Aggiorna tornei
                  </button>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}