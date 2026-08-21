import React, { useEffect, useState, useMemo } from "react";
import { loadLeagueData, saveLeagueData } from "./supabaseClient";

const DEFAULT_DIVISIONS = ["Division 1", "Division 2", "Division 3", "Division 4"];

const uid = () => "id_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
const todayISO = () => new Date().toISOString().slice(0, 10);
const fmtDate = (iso) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("default", { day: "numeric", month: "short", year: "numeric" });
};
const teamName = (t) => (t ? `${t.p1} & ${t.p2}` : "Unknown team");

const emptyMatchForm = { teamA: "", teamB: "", g1a: "", g1b: "", g2a: "", g2b: "", g3a: "", g3b: "" };

function isValidGame(a, b) {
  if (a === "" || b === "") return false;
  const na = Number(a), nb = Number(b);
  if (isNaN(na) || isNaN(nb) || na < 0 || nb < 0) return false;
  return (na >= 11 || nb >= 11) && Math.abs(na - nb) >= 2;
}

// Defined at module level (not inside App) so they keep a stable identity across
// re-renders — otherwise React remounts them on every keystroke and inputs lose focus.

function DivisionSegmented({ value, onChange, divisions }) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1">
      {divisions.map((d, i) => (
        <button key={d} onClick={() => onChange(i)} className="font-mono text-xs px-3 py-1.5 rounded-full shrink-0"
          style={{ background: value === i ? "var(--court)" : "white", color: value === i ? "var(--cream)" : "var(--court)", border: "1px solid var(--court)" }}>
          D{i + 1}
        </button>
      ))}
    </div>
  );
}

function GameInputs({ label, a, b, onA, onB }) {
  return (
    <div className="flex items-center gap-2">
      <span className="font-body text-xs w-14 shrink-0" style={{ color: "var(--woodDark)" }}>{label}</span>
      <input type="number" inputMode="numeric" placeholder="A" value={a} onChange={(e) => onA(e.target.value)}
        className="w-16 px-2 py-2 rounded-md text-sm font-mono text-center" style={{ border: "1px solid var(--woodDark)" }} />
      <span className="font-mono text-xs" style={{ color: "var(--woodDark)" }}>–</span>
      <input type="number" inputMode="numeric" placeholder="B" value={b} onChange={(e) => onB(e.target.value)}
        className="w-16 px-2 py-2 rounded-md text-sm font-mono text-center" style={{ border: "1px solid var(--woodDark)" }} />
    </div>
  );
}

function NewSeasonForm({ seasonsCount, seasonForm, setSeasonForm, formError, onSubmit }) {
  return (
    <div className="rounded-xl p-4 space-y-3" style={{ border: "1px solid var(--woodDark)", background: "white" }}>
      <p className="font-display text-lg">{seasonsCount === 0 ? "Start your first season" : "Start next season"}</p>
      <div>
        <label className="font-mono text-xs uppercase tracking-wide" style={{ color: "var(--woodDark)" }}>Season name</label>
        <input type="text" value={seasonForm.name} onChange={(e) => setSeasonForm({ ...seasonForm, name: e.target.value })}
          placeholder="e.g. September 2026" className="w-full mt-1 px-3 py-2 rounded-md text-sm" style={{ border: "1px solid var(--woodDark)" }} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="font-mono text-xs uppercase tracking-wide" style={{ color: "var(--woodDark)" }}>Start date</label>
          <input type="date" value={seasonForm.startDate} onChange={(e) => setSeasonForm({ ...seasonForm, startDate: e.target.value })}
            className="w-full mt-1 px-3 py-2 rounded-md text-sm" style={{ border: "1px solid var(--woodDark)" }} />
        </div>
        <div>
          <label className="font-mono text-xs uppercase tracking-wide" style={{ color: "var(--woodDark)" }}>End date</label>
          <input type="date" value={seasonForm.endDate} onChange={(e) => setSeasonForm({ ...seasonForm, endDate: e.target.value })}
            className="w-full mt-1 px-3 py-2 rounded-md text-sm" style={{ border: "1px solid var(--woodDark)" }} />
        </div>
      </div>
      {formError && <p className="font-body text-xs" style={{ color: "#B23A3A" }}>{formError}</p>}
      <button onClick={onSubmit} className="w-full py-2.5 rounded-md font-body font-semibold text-sm" style={{ background: "var(--court)", color: "var(--cream)" }}>
        Start season
      </button>
    </div>
  );
}

function PinModal({ mode, pinInput, setPinInput, pinConfirm, setPinConfirm, pinError, onSubmit, onCancel }) {
  // mode: "setup" (no pin exists yet), "unlock" (verify existing pin), "change" (verify old, then set new)
  const isSetup = mode === "setup";
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-6 sm:pb-0"
      style={{ background: "rgba(23,20,18,0.55)" }} onClick={onCancel}>
      <div className="w-full max-w-sm rounded-xl p-5 space-y-3" style={{ background: "var(--cream)", border: "1px solid var(--woodDark)" }}
        onClick={(e) => e.stopPropagation()}>
        <p className="font-display text-lg">{isSetup ? "Set an admin PIN" : mode === "change" ? "Change admin PIN" : "Enter admin PIN"}</p>
        <p className="font-body text-xs" style={{ color: "var(--woodDark)" }}>
          {isSetup
            ? "Anyone with this link can view standings and log scores. Set a PIN so only you (and anyone you share it with) can manage teams, divisions and seasons."
            : mode === "change"
            ? "Enter your current PIN, then choose a new one."
            : "Admin actions on this league are PIN-protected."}
        </p>
        <input
          type="password" inputMode="numeric" autoFocus value={pinInput} onChange={(e) => setPinInput(e.target.value)}
          placeholder={isSetup ? "New PIN (4+ digits)" : "PIN"}
          className="w-full px-3 py-2 rounded-md text-sm font-mono" style={{ border: "1px solid var(--woodDark)" }}
        />
        {(isSetup || mode === "change") && (
          <input
            type="password" inputMode="numeric" value={pinConfirm} onChange={(e) => setPinConfirm(e.target.value)}
            placeholder={mode === "change" ? "New PIN again" : "Confirm PIN"}
            className="w-full px-3 py-2 rounded-md text-sm font-mono" style={{ border: "1px solid var(--woodDark)" }}
          />
        )}
        {pinError && <p className="font-body text-xs" style={{ color: "#B23A3A" }}>{pinError}</p>}
        <div className="flex gap-2 pt-1">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-md font-body font-semibold text-sm"
            style={{ background: "white", color: "var(--court)", border: "1px solid var(--court)" }}>
            Cancel
          </button>
          <button onClick={onSubmit} className="flex-1 py-2.5 rounded-md font-body font-semibold text-sm"
            style={{ background: "var(--court)", color: "var(--cream)" }}>
            {isSetup ? "Set PIN" : mode === "change" ? "Save" : "Unlock"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [data, setData] = useState({ teams: [], seasons: [], activeSeasonId: null, matches: [], divisions: DEFAULT_DIVISIONS.slice(), adminPin: null });
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("standings");
  const [standingsDiv, setStandingsDiv] = useState(0);
  const [logDiv, setLogDiv] = useState(0);
  const [selectedSeasonId, setSelectedSeasonId] = useState(null);
  const [formError, setFormError] = useState("");
  const [matchForm, setMatchForm] = useState(emptyMatchForm);
  const [newTeam, setNewTeam] = useState({ p1: "", p2: "", division: 0 });
  const [newDivisionName, setNewDivisionName] = useState("");
  const [seasonForm, setSeasonForm] = useState({ name: "", startDate: todayISO(), endDate: "" });
  const [closeSummary, setCloseSummary] = useState(null);
  const [adminMode, setAdminMode] = useState(false);
  const [saveStatus, setSaveStatus] = useState("idle"); // idle | saving | saved | error
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [loadError, setLoadError] = useState(false);

  // Admin PIN gate — unlocked is session-only (React state), never persisted to storage,
  // so each visitor has to enter the PIN again after a full reload.
  const [unlocked, setUnlocked] = useState(false);
  const [pinModalMode, setPinModalMode] = useState(null); // null | "setup" | "unlock" | "change"
  const [pinInput, setPinInput] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [pinError, setPinError] = useState("");

  useEffect(() => {
    try { document.title = "Courtside"; } catch (e) { /* no document access */ }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const d = await loadLeagueData();
        if (d) {
          if (!d.divisions || !d.divisions.length) d.divisions = DEFAULT_DIVISIONS.slice();
          if (d.adminPin === undefined) d.adminPin = null;
          setData(d);
          setSelectedSeasonId(d.activeSeasonId || (d.seasons.length ? d.seasons[d.seasons.length - 1].id : null));
        }
        // d === null means the row doesn't exist yet (first-ever load) — that's expected,
        // not an error, so it falls through to the default empty-league state quietly.
      } catch (e) {
        console.error("Load error:", e);
        setLoadError(true);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const persist = async (next) => {
    setData(next);
    setSaveStatus("saving");
    try {
      await saveLeagueData(next);
      setSaveStatus("saved");
      setLastSavedAt(Date.now());
    } catch (e) {
      console.error("Save error:", e);
      setSaveStatus("error");
    }
  };

  const activeSeason = data.seasons.find((s) => s.id === data.activeSeasonId) || null;
  const viewingSeason = data.seasons.find((s) => s.id === selectedSeasonId) || activeSeason || null;

  // ---- Admin PIN ----
  const openPinModal = () => {
    setPinInput("");
    setPinConfirm("");
    setPinError("");
    setPinModalMode(data.adminPin ? "unlock" : "setup");
  };

  const closePinModal = () => {
    setPinModalMode(null);
    setPinInput("");
    setPinConfirm("");
    setPinError("");
  };

  const submitPin = () => {
    if (pinModalMode === "setup") {
      if (pinInput.trim().length < 4) { setPinError("Use at least 4 digits or characters."); return; }
      if (pinInput !== pinConfirm) { setPinError("PINs don't match."); return; }
      persist({ ...data, adminPin: pinInput.trim() });
      setUnlocked(true);
      setAdminMode(true);
      closePinModal();
    } else if (pinModalMode === "unlock") {
      if (pinInput !== data.adminPin) { setPinError("Incorrect PIN."); return; }
      setUnlocked(true);
      setAdminMode(true);
      closePinModal();
    } else if (pinModalMode === "change") {
      if (pinInput !== data.adminPin) { setPinError("Current PIN is incorrect."); return; }
      if (pinConfirm.trim().length < 4) { setPinError("New PIN needs at least 4 digits or characters."); return; }
      persist({ ...data, adminPin: pinConfirm.trim() });
      closePinModal();
    }
  };

  const toggleAdmin = () => {
    if (adminMode) {
      setAdminMode(false);
      setTab("standings");
      return;
    }
    if (unlocked) {
      setAdminMode(true);
      return;
    }
    openPinModal();
  };

  // ---- Teams ----
  const addTeam = () => {
    const p1 = newTeam.p1.trim();
    const p2 = newTeam.p2.trim();
    if (!p1 || !p2) {
      setFormError("Enter both players' names.");
      return;
    }
    if (p1.toLowerCase() === p2.toLowerCase()) {
      setFormError("A team needs two different people.");
      return;
    }
    setFormError("");
    const team = { id: uid(), p1, p2, division: newTeam.division };
    persist({ ...data, teams: [...data.teams, team] });
    setNewTeam({ p1: "", p2: "", division: newTeam.division });
  };

  const removeTeam = (id) => persist({ ...data, teams: data.teams.filter((t) => t.id !== id) });
  const setTeamDivision = (id, division) =>
    persist({ ...data, teams: data.teams.map((t) => (t.id === id ? { ...t, division } : t)) });

  const teamsInDiv = (div) => data.teams.filter((t) => t.division === div);

  // ---- Divisions ----
  const addDivision = () => {
    const name = newDivisionName.trim() || `Division ${data.divisions.length + 1}`;
    setFormError("");
    persist({ ...data, divisions: [...data.divisions, name] });
    setNewDivisionName("");
  };

  const removeLastDivision = () => {
    const lastIndex = data.divisions.length - 1;
    if (lastIndex <= 0) return; // always keep at least one division
    if (teamsInDiv(lastIndex).length > 0) {
      setFormError("Move or remove the teams in that division before deleting it.");
      return;
    }
    setFormError("");
    persist({ ...data, divisions: data.divisions.slice(0, lastIndex) });
  };

  // ---- Seasons ----
  const createSeason = () => {
    const name = seasonForm.name.trim();
    if (!name) {
      setFormError("Give the season a name.");
      return;
    }
    if (!seasonForm.startDate || !seasonForm.endDate) {
      setFormError("Set a start and end date for the season.");
      return;
    }
    if (seasonForm.endDate < seasonForm.startDate) {
      setFormError("End date needs to be after the start date.");
      return;
    }
    setFormError("");
    const season = { id: uid(), name, startDate: seasonForm.startDate, endDate: seasonForm.endDate, closed: false };
    const next = { ...data, seasons: [...data.seasons, season], activeSeasonId: season.id };
    persist(next);
    setSelectedSeasonId(season.id);
    setCloseSummary(null);
    setSeasonForm({ name: "", startDate: todayISO(), endDate: "" });
  };

  const computeStandingsFor = (seasonId, div, teamsSnapshot) => {
    const stats = {};
    for (const m of data.matches.filter((mm) => mm.seasonId === seasonId && mm.division === div)) {
      const games = m.games.filter((g) => g);
      let gA = 0, gB = 0, ptsA = 0, ptsB = 0;
      for (const g of games) {
        ptsA += g.a; ptsB += g.b;
        if (g.a > g.b) gA++; else if (g.b > g.a) gB++;
      }
      if (!stats[m.teamA]) stats[m.teamA] = { teamId: m.teamA, matchesWon: 0, matchesLost: 0, gamesWon: 0, gamesLost: 0, points: 0, matches: 0 };
      if (!stats[m.teamB]) stats[m.teamB] = { teamId: m.teamB, matchesWon: 0, matchesLost: 0, gamesWon: 0, gamesLost: 0, points: 0, matches: 0 };
      stats[m.teamA].gamesWon += gA; stats[m.teamA].gamesLost += gB; stats[m.teamA].points += ptsA; stats[m.teamA].matches += 1;
      stats[m.teamB].gamesWon += gB; stats[m.teamB].gamesLost += gA; stats[m.teamB].points += ptsB; stats[m.teamB].matches += 1;
      // Match winner is whoever won more games within that match (best of 3).
      if (gA > gB) { stats[m.teamA].matchesWon += 1; stats[m.teamB].matchesLost += 1; }
      else if (gB > gA) { stats[m.teamB].matchesWon += 1; stats[m.teamA].matchesLost += 1; }
    }
    const teams = teamsSnapshot || data.teams;
    return Object.values(stats)
      .map((s) => ({ ...s, team: teams.find((t) => t.id === s.teamId) }))
      .filter((s) => s.team)
      .sort((x, y) => y.matchesWon - x.matchesWon || y.gamesWon - x.gamesWon || y.points - x.points);
  };

  const closeSeason = (seasonId) => {
    const moves = [];
    const moveMap = {};
    for (let div = 0; div < data.divisions.length; div++) {
      const st = computeStandingsFor(seasonId, div);
      if (st.length > 0 && div > 0) {
        moveMap[st[0].teamId] = div - 1;
        moves.push(`↑ ${teamName(st[0].team)} promoted to ${data.divisions[div - 1]}`);
      }
      if (st.length > 1 && div < data.divisions.length - 1) {
        const bottom = st[st.length - 1];
        moveMap[bottom.teamId] = div + 1;
        moves.push(`↓ ${teamName(bottom.team)} moved down to ${data.divisions[div + 1]}`);
      }
    }
    const nextTeams = data.teams.map((t) => (moveMap[t.id] !== undefined ? { ...t, division: moveMap[t.id] } : t));
    const nextSeasons = data.seasons.map((s) => (s.id === seasonId ? { ...s, closed: true } : s));
    const next = { ...data, teams: nextTeams, seasons: nextSeasons, activeSeasonId: null };
    persist(next);
    setCloseSummary(moves.length ? moves : ["No promotions or relegations — not enough completed matches yet."]);
    setSeasonForm({ name: "", startDate: todayISO(), endDate: "" });
  };

  // ---- Matches ----
  const submitMatch = () => {
    if (!activeSeason) {
      setFormError("Start a season before logging matches.");
      return;
    }
    const { teamA, teamB, g1a, g1b, g2a, g2b, g3a, g3b } = matchForm;
    if (!teamA || !teamB) {
      setFormError("Pick both teams.");
      return;
    }
    if (teamA === teamB) {
      setFormError("A team can't play itself.");
      return;
    }
    if (!isValidGame(g1a, g1b) || !isValidGame(g2a, g2b)) {
      setFormError("Enter valid scores for Game 1 and Game 2 (first to 11, win by 2).");
      return;
    }
    let game3 = null;
    if (g3a !== "" || g3b !== "") {
      if (!isValidGame(g3a, g3b)) {
        setFormError("Game 3 score isn't valid (first to 11, win by 2) — or leave both blank if it wasn't played.");
        return;
      }
      game3 = { a: Number(g3a), b: Number(g3b) };
    }
    setFormError("");
    const match = {
      id: uid(),
      date: todayISO(),
      seasonId: activeSeason.id,
      division: logDiv,
      teamA, teamB,
      games: [{ a: Number(g1a), b: Number(g1b) }, { a: Number(g2a), b: Number(g2b) }, game3],
    };
    persist({ ...data, matches: [...data.matches, match] });
    setMatchForm(emptyMatchForm);
  };

  const removeMatch = (id) => persist({ ...data, matches: data.matches.filter((m) => m.id !== id) });

  const deleteSeason = (seasonId) => {
    const season = data.seasons.find((s) => s.id === seasonId);
    if (!season) return;
    if (!window.confirm(`Delete "${season.name}" and all its logged matches? This can't be undone.`)) return;
    const nextSeasons = data.seasons.filter((s) => s.id !== seasonId);
    const nextMatches = data.matches.filter((m) => m.seasonId !== seasonId);
    const nextActive = data.activeSeasonId === seasonId ? null : data.activeSeasonId;
    persist({ ...data, seasons: nextSeasons, matches: nextMatches, activeSeasonId: nextActive });
    if (selectedSeasonId === seasonId) setSelectedSeasonId(null);
    setCloseSummary(null);
  };

  const standings = useMemo(
    () => (viewingSeason ? computeStandingsFor(viewingSeason.id, standingsDiv) : []),
    [data, viewingSeason, standingsDiv]
  );

  const seasonMatches = useMemo(
    () => (activeSeason ? data.matches.filter((m) => m.seasonId === activeSeason.id && m.division === logDiv) : []),
    [data.matches, activeSeason, logDiv]
  );

  const promoteCandidate = standingsDiv > 0 && standings.length > 0 ? standings[0] : null;
  const relegateCandidate = standingsDiv < data.divisions.length - 1 && standings.length > 1 ? standings[standings.length - 1] : null;
  const seasonEnded = activeSeason && todayISO() > activeSeason.endDate;

  const vars = {
    "--court": "#FF5C01", "--cream": "#FAF7F2", "--ink": "#171412",
    "--ball": "#FF5C01", "--wood": "#4A433C", "--woodDark": "#4A433C",
  };

  if (!loaded) {
    return (
      <div style={{ ...vars, background: "var(--cream)", color: "var(--ink)" }} className="min-h-screen flex items-center justify-center font-body">
        Loading league…
      </div>
    );
  }

  return (
    <div style={{ ...vars, background: "var(--cream)", color: "var(--ink)" }} className="min-h-screen font-body">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@500;600&display=swap');
        .font-display { font-family: 'Fraunces', serif; }
        .font-body { font-family: 'IBM Plex Sans', sans-serif; }
        .font-mono { font-family: 'IBM Plex Mono', monospace; }
        .perf { background-image: repeating-linear-gradient(90deg, rgba(38,34,28,0.28) 0 6px, transparent 6px 14px); height: 1px; }
        select, input { font-family: 'IBM Plex Sans', sans-serif; }
        .tab-btn { transition: all 0.15s ease; }
      `}</style>

      {pinModalMode && (
        <PinModal
          mode={pinModalMode}
          pinInput={pinInput}
          setPinInput={setPinInput}
          pinConfirm={pinConfirm}
          setPinConfirm={setPinConfirm}
          pinError={pinError}
          onSubmit={submitPin}
          onCancel={closePinModal}
        />
      )}

      <div style={{ background: "var(--court)" }} className="px-5 pt-7 pb-6 sticky top-0 z-10 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl" style={{ color: "var(--cream)" }}>Courtside</h1>
            <p className="font-body text-base mt-1" style={{ color: "rgba(250,247,242,0.75)" }}>
              {adminMode ? "Fixed teams · best of 3 · promotion & relegation each season" : "This month's league table"}
            </p>
          </div>
          <button
            onClick={toggleAdmin}
            className="font-mono text-[11px] px-2.5 py-1 rounded-full shrink-0 mt-1"
            style={{ border: "1px solid rgba(250,247,242,0.5)", color: "rgba(250,247,242,0.85)", background: "transparent" }}
          >
            {adminMode ? "Done" : "League admin"}
          </button>
        </div>
        <div className="mt-2">
          {saveStatus === "saving" && (
            <p className="font-mono text-[10px]" style={{ color: "rgba(250,247,242,0.7)" }}>Saving…</p>
          )}
          {saveStatus === "saved" && lastSavedAt && (
            <p className="font-mono text-[10px]" style={{ color: "rgba(250,247,242,0.7)" }}>
              Saved {new Date(lastSavedAt).toLocaleTimeString("default", { hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
          {saveStatus === "error" && (
            <p className="font-mono text-[10px] font-semibold" style={{ color: "#FFD9C2" }}>
              ⚠ Couldn't save — your last change may be lost. Try again.
            </p>
          )}
          {loadError && (
            <p className="font-mono text-[10px] font-semibold" style={{ color: "#FFD9C2" }}>
              ⚠ Couldn't load saved data — reload the page before entering scores.
            </p>
          )}
        </div>
      </div>

      <div className="flex px-3 pt-3 gap-2">
        {[{ id: "standings", label: "Standings" }, { id: "log", label: "Log match" }, ...(adminMode ? [{ id: "teams", label: "Teams" }] : [])].map((t) => (
          <button key={t.id} onClick={() => { setTab(t.id); setFormError(""); }}
            className="tab-btn font-body text-sm font-medium px-4 py-2 rounded-full flex-1"
            style={{ background: tab === t.id ? "var(--ball)" : "transparent", color: tab === t.id ? "var(--ink)" : "var(--court)", border: `1px solid ${tab === t.id ? "var(--ball)" : "var(--woodDark)"}` }}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="px-4 pb-16 pt-4">
        {tab === "standings" && (
          <div>
            {data.seasons.length === 0 ? (
              <div className="rounded-xl p-6 text-center" style={{ border: "1px dashed var(--woodDark)", background: "rgba(74,67,60,0.06)" }}>
                <p className="font-display text-lg mb-1">Not set up yet</p>
                <p className="font-body text-sm" style={{ color: "var(--woodDark)" }}>
                  {adminMode ? "Start your first season from the Teams tab." : "The league admin needs to start the first season."}
                </p>
              </div>
            ) : (
              <>
                <div className="rounded-xl p-4 mb-4" style={{ border: "1px solid var(--woodDark)", background: "white" }}>
                  <div className="flex items-center justify-between">
                    <label className="font-mono text-xs uppercase tracking-wide" style={{ color: "var(--woodDark)" }}>Season</label>
                    <select value={selectedSeasonId || ""} onChange={(e) => { setSelectedSeasonId(e.target.value); setCloseSummary(null); }}
                      className="font-mono text-sm px-3 py-1.5 rounded-md" style={{ border: "1px solid var(--woodDark)", background: "white" }}>
                      {[...data.seasons].reverse().map((s) => (
                        <option key={s.id} value={s.id}>{s.name}{s.closed ? " (closed)" : s.id === data.activeSeasonId ? " (active)" : ""}</option>
                      ))}
                    </select>
                  </div>
                  {viewingSeason && (
                    <p className="font-body text-xs mt-2" style={{ color: "var(--woodDark)" }}>
                      {fmtDate(viewingSeason.startDate)} → {fmtDate(viewingSeason.endDate)}
                    </p>
                  )}
                </div>

                <p className="font-mono text-xs uppercase tracking-wide mb-1.5" style={{ color: "var(--woodDark)" }}>Division</p>
                <DivisionSegmented value={standingsDiv} onChange={setStandingsDiv} divisions={data.divisions} />
                <p className="font-display text-lg mt-3 mb-3">{data.divisions[standingsDiv]}</p>

                {standings.length === 0 ? (
                  <div className="rounded-xl p-6 text-center" style={{ border: "1px dashed var(--woodDark)", background: "rgba(74,67,60,0.06)" }}>
                    <p className="font-display text-lg mb-1">Empty court</p>
                    <p className="font-body text-sm" style={{ color: "var(--woodDark)" }}>No matches logged in {data.divisions[standingsDiv]} this season yet.</p>
                  </div>
                ) : (
                  <>
                    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--woodDark)", background: "white" }}>
                      {standings.map((s, i) => (
                        <div key={s.teamId}>
                          <div className="flex items-center gap-3 px-4 py-3">
                            <div className="font-mono text-sm w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                              style={{ background: i === 0 ? "var(--ball)" : "var(--cream)", border: "1px solid var(--woodDark)", color: "var(--ink)" }}>
                              {i + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-body font-semibold text-sm truncate">{teamName(s.team)}</p>
                              <p className="font-mono text-xs" style={{ color: "var(--woodDark)" }}>
                                {s.matches} matches · {s.gamesWon}-{s.gamesLost} games · {s.points} pts
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="font-mono text-lg font-semibold tabular-nums">{s.matchesWon}-{s.matchesLost}</p>
                              <p className="font-mono text-[10px] uppercase" style={{ color: "var(--woodDark)" }}>match wins</p>
                            </div>
                          </div>
                          {i < standings.length - 1 && <div className="perf mx-4" />}
                        </div>
                      ))}
                    </div>
                    {(promoteCandidate || relegateCandidate) && (
                      <div className="rounded-xl p-4 mt-4 space-y-2" style={{ border: "1px solid var(--woodDark)", background: "rgba(255,92,1,0.1)" }}>
                        <p className="font-mono text-xs uppercase tracking-wide" style={{ color: "var(--woodDark)" }}>If the season ended today</p>
                        {promoteCandidate && (
                          <p className="font-body text-sm">↑ {teamName(promoteCandidate.team)} would go up to {data.divisions[standingsDiv - 1]}</p>
                        )}
                        {relegateCandidate && (
                          <p className="font-body text-sm">↓ {teamName(relegateCandidate.team)} would go down to {data.divisions[standingsDiv + 1]}</p>
                        )}
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        )}

        {tab === "log" && (
          <div>
            {!activeSeason ? (
              <div className="rounded-xl p-6 text-center" style={{ border: "1px dashed var(--woodDark)", background: "rgba(74,67,60,0.06)" }}>
                <p className="font-display text-lg mb-1">No active season</p>
                <p className="font-body text-sm" style={{ color: "var(--woodDark)" }}>Start a season from the Standings tab before logging matches.</p>
              </div>
            ) : (
              <>
                <p className="font-mono text-xs uppercase tracking-wide mb-1.5" style={{ color: "var(--woodDark)" }}>Division</p>
                <DivisionSegmented value={logDiv} onChange={setLogDiv} divisions={data.divisions} />

                {teamsInDiv(logDiv).length < 2 ? (
                  <div className="rounded-xl p-6 text-center mt-3" style={{ border: "1px dashed var(--woodDark)", background: "rgba(74,67,60,0.06)" }}>
                    <p className="font-display text-lg mb-1">Need more teams</p>
                    <p className="font-body text-sm" style={{ color: "var(--woodDark)" }}>Add at least 2 teams to {data.divisions[logDiv]} on the Teams tab.</p>
                  </div>
                ) : (
                  <div className="rounded-xl p-4 mt-3 space-y-4" style={{ border: "1px solid var(--woodDark)", background: "white" }}>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="font-mono text-xs uppercase tracking-wide" style={{ color: "var(--woodDark)" }}>Team A</label>
                        <select value={matchForm.teamA} onChange={(e) => setMatchForm({ ...matchForm, teamA: e.target.value })}
                          className="w-full mt-1 px-2 py-2 rounded-md text-sm" style={{ border: "1px solid var(--woodDark)" }}>
                          <option value="">Select team</option>
                          {teamsInDiv(logDiv).map((t) => <option key={t.id} value={t.id}>{teamName(t)}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="font-mono text-xs uppercase tracking-wide" style={{ color: "var(--woodDark)" }}>Team B</label>
                        <select value={matchForm.teamB} onChange={(e) => setMatchForm({ ...matchForm, teamB: e.target.value })}
                          className="w-full mt-1 px-2 py-2 rounded-md text-sm" style={{ border: "1px solid var(--woodDark)" }}>
                          <option value="">Select team</option>
                          {teamsInDiv(logDiv).map((t) => <option key={t.id} value={t.id}>{teamName(t)}</option>)}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="font-body text-xs font-semibold" style={{ color: "var(--court)" }}>Game scores (first to 11, win by 2)</p>
                      <GameInputs label="Game 1" a={matchForm.g1a} b={matchForm.g1b}
                        onA={(v) => setMatchForm({ ...matchForm, g1a: v })} onB={(v) => setMatchForm({ ...matchForm, g1b: v })} />
                      <GameInputs label="Game 2" a={matchForm.g2a} b={matchForm.g2b}
                        onA={(v) => setMatchForm({ ...matchForm, g2a: v })} onB={(v) => setMatchForm({ ...matchForm, g2b: v })} />
                      <GameInputs label="Game 3*" a={matchForm.g3a} b={matchForm.g3b}
                        onA={(v) => setMatchForm({ ...matchForm, g3a: v })} onB={(v) => setMatchForm({ ...matchForm, g3b: v })} />
                      <p className="font-body text-[11px]" style={{ color: "var(--woodDark)" }}>*Leave Game 3 blank if the match finished 2–0.</p>
                    </div>

                    {formError && <p className="font-body text-xs" style={{ color: "#B23A3A" }}>{formError}</p>}

                    <button onClick={submitMatch} className="w-full py-2.5 rounded-md font-body font-semibold text-sm" style={{ background: "var(--court)", color: "var(--cream)" }}>
                      Save match
                    </button>
                  </div>
                )}

                {seasonMatches.length > 0 && (
                  <div className="mt-5">
                    <p className="font-mono text-xs uppercase tracking-wide mb-2" style={{ color: "var(--woodDark)" }}>
                      {data.divisions[logDiv]} · {activeSeason.name}
                    </p>
                    <div className="space-y-2">
                      {[...seasonMatches].reverse().map((m) => {
                        const tA = data.teams.find((t) => t.id === m.teamA);
                        const tB = data.teams.find((t) => t.id === m.teamB);
                        const gs = m.games.filter((g) => g).map((g) => `${g.a}-${g.b}`).join(", ");
                        return (
                          <div key={m.id} className="rounded-lg px-3 py-2 flex items-center justify-between text-sm" style={{ border: "1px solid var(--woodDark)", background: "white" }}>
                            <div className="font-body">
                              <span className="font-mono text-xs mr-2" style={{ color: "var(--woodDark)" }}>{m.date.slice(5)}</span>
                              {teamName(tA)} vs {teamName(tB)} <span className="font-mono text-xs">({gs})</span>
                            </div>
                            {adminMode && (
                              <button onClick={() => removeMatch(m.id)} className="font-mono text-xs shrink-0 ml-2" style={{ color: "#B23A3A" }}>remove</button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {tab === "teams" && adminMode && (
          <div>
            <div className="mb-4">
              {activeSeason ? (
                <div className="rounded-xl p-4" style={{ border: "1px solid var(--woodDark)", background: "white" }}>
                  <label className="font-mono text-xs uppercase tracking-wide" style={{ color: "var(--woodDark)" }}>Current season</label>
                  <p className="font-display text-lg mt-1">{activeSeason.name}</p>
                  <p className="font-body text-xs mt-0.5" style={{ color: "var(--woodDark)" }}>
                    {fmtDate(activeSeason.startDate)} → {fmtDate(activeSeason.endDate)}
                  </p>
                  {seasonEnded && (
                    <p className="font-body text-xs mt-2 font-semibold" style={{ color: "#8C5A34" }}>
                      This season ended {fmtDate(activeSeason.endDate)}.
                    </p>
                  )}
                  <button onClick={() => closeSeason(activeSeason.id)}
                    className="w-full mt-3 py-2 rounded-md font-body font-semibold text-sm"
                    style={{ background: seasonEnded ? "var(--court)" : "white", color: seasonEnded ? "var(--cream)" : "var(--court)", border: "1px solid var(--court)" }}>
                    Close season &amp; apply promotions
                  </button>
                </div>
              ) : (
                <NewSeasonForm seasonsCount={data.seasons.length} seasonForm={seasonForm} setSeasonForm={setSeasonForm} formError={formError} onSubmit={createSeason} />
              )}
              {closeSummary && (
                <div className="rounded-xl p-4 mt-3 space-y-1" style={{ border: "1px solid var(--woodDark)", background: "rgba(255,92,1,0.18)" }}>
                  <p className="font-mono text-xs uppercase tracking-wide mb-1" style={{ color: "var(--woodDark)" }}>Season closed</p>
                  {closeSummary.map((line, i) => <p key={i} className="font-body text-sm">{line}</p>)}
                </div>
              )}
            </div>

            <div className="rounded-xl p-4 mb-4" style={{ border: "1px solid var(--woodDark)", background: "white" }}>
              <label className="font-mono text-xs uppercase tracking-wide" style={{ color: "var(--woodDark)" }}>All seasons</label>
              {data.seasons.length === 0 ? (
                <p className="font-body text-sm mt-2" style={{ color: "var(--woodDark)" }}>No seasons yet.</p>
              ) : (
                <div className="mt-2 space-y-2">
                  {[...data.seasons].reverse().map((s) => (
                    <div key={s.id} className="flex items-center justify-between gap-2 rounded-lg px-3 py-2"
                      style={{ border: "1px solid var(--woodDark)" }}>
                      <div className="min-w-0">
                        <p className="font-body text-sm truncate">
                          {s.name}
                          {s.id === data.activeSeasonId ? " (active)" : s.closed ? " (closed)" : ""}
                        </p>
                        <p className="font-mono text-[10px]" style={{ color: "var(--woodDark)" }}>
                          {fmtDate(s.startDate)} → {fmtDate(s.endDate)}
                        </p>
                      </div>
                      <button onClick={() => deleteSeason(s.id)} className="font-mono text-xs shrink-0" style={{ color: "#B23A3A" }}>
                        delete
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl p-4 mb-4" style={{ border: "1px solid var(--woodDark)", background: "white" }}>
              <label className="font-mono text-xs uppercase tracking-wide" style={{ color: "var(--woodDark)" }}>Divisions</label>
              <div className="flex flex-wrap gap-1.5 mt-2 mb-3">
                {data.divisions.map((d, i) => (
                  <span key={d} className="font-mono text-xs px-2.5 py-1 rounded-full"
                    style={{ border: "1px solid var(--woodDark)", color: "var(--ink)" }}>
                    D{i + 1} · {d}
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input type="text" value={newDivisionName} onChange={(e) => setNewDivisionName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addDivision()}
                  placeholder={`Division ${data.divisions.length + 1}`}
                  className="flex-1 px-3 py-2 rounded-md text-sm" style={{ border: "1px solid var(--woodDark)" }} />
                <button onClick={addDivision} className="px-4 py-2 rounded-md font-body font-semibold text-sm"
                  style={{ background: "var(--court)", color: "var(--cream)" }}>
                  Add division
                </button>
              </div>
              {data.divisions.length > 1 && teamsInDiv(data.divisions.length - 1).length === 0 && (
                <button onClick={removeLastDivision} className="font-mono text-xs mt-2" style={{ color: "#B23A3A" }}>
                  Remove {data.divisions[data.divisions.length - 1]} (empty)
                </button>
              )}
              {formError && <p className="font-body text-xs mt-2" style={{ color: "#B23A3A" }}>{formError}</p>}
            </div>

            <div className="rounded-xl p-4 mb-4" style={{ border: "1px solid var(--woodDark)", background: "white" }}>
              <label className="font-mono text-xs uppercase tracking-wide" style={{ color: "var(--woodDark)" }}>Add a team</label>
              <div className="space-y-2 mt-1">
                <input type="text" value={newTeam.p1} onChange={(e) => setNewTeam({ ...newTeam, p1: e.target.value })}
                  placeholder="Player 1 name" className="w-full px-3 py-2 rounded-md text-sm" style={{ border: "1px solid var(--woodDark)" }} />
                <input type="text" value={newTeam.p2} onChange={(e) => setNewTeam({ ...newTeam, p2: e.target.value })}
                  placeholder="Player 2 name" className="w-full px-3 py-2 rounded-md text-sm" style={{ border: "1px solid var(--woodDark)" }} />
                <div className="flex gap-2">
                  <select value={newTeam.division} onChange={(e) => setNewTeam({ ...newTeam, division: Number(e.target.value) })}
                    className="flex-1 px-2 py-2 rounded-md text-sm font-mono" style={{ border: "1px solid var(--woodDark)" }}>
                    {data.divisions.map((d, i) => <option key={d} value={i}>{d}</option>)}
                  </select>
                  <button onClick={addTeam} className="px-4 py-2 rounded-md font-body font-semibold text-sm" style={{ background: "var(--ball)", color: "var(--ink)" }}>
                    Add
                  </button>
                </div>
              </div>
              {formError && <p className="font-body text-xs mt-2" style={{ color: "#B23A3A" }}>{formError}</p>}
            </div>

            {data.teams.length === 0 ? (
              <p className="font-body text-sm text-center" style={{ color: "var(--woodDark)" }}>No teams yet. Add your first pair above.</p>
            ) : (
              data.divisions.map((d, di) => {
                const group = teamsInDiv(di);
                if (group.length === 0) return null;
                return (
                  <div key={d} className="mb-4">
                    <p className="font-mono text-xs uppercase tracking-wide mb-2" style={{ color: "var(--woodDark)" }}>{d}</p>
                    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--woodDark)", background: "white" }}>
                      {group.map((t, i) => (
                        <div key={t.id}>
                          <div className="flex items-center justify-between gap-2 px-4 py-3">
                            <span className="font-body text-sm flex-1 truncate">{teamName(t)}</span>
                            <select value={t.division} onChange={(e) => setTeamDivision(t.id, Number(e.target.value))}
                              className="font-mono text-xs px-2 py-1 rounded-md" style={{ border: "1px solid var(--woodDark)" }}>
                              {data.divisions.map((dd, ii) => <option key={dd} value={ii}>D{ii + 1}</option>)}
                            </select>
                            <button onClick={() => removeTeam(t.id)} className="font-mono text-xs" style={{ color: "#B23A3A" }}>remove</button>
                          </div>
                          {i < group.length - 1 && <div className="perf mx-4" />}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}

            <button
              onClick={() => { setPinInput(""); setPinConfirm(""); setPinError(""); setPinModalMode("change"); }}
              className="w-full mt-2 py-2 rounded-md font-mono text-xs"
              style={{ background: "transparent", color: "var(--woodDark)", border: "1px dashed var(--woodDark)" }}
            >
              Change admin PIN
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
