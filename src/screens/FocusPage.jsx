import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { sessionsAPI, subjectsAPI, analyticsAPI } from "../services/api";
import PostSessionQuiz from "../components/PostSessionQuiz";

const Icon = ({ name, filled = false, className = "" }) => (
  <span
    className={`material-symbols-outlined ${className}`}
    style={{ fontVariationSettings: filled ? "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" : "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
  >
    {name}
  </span>
);

const SESSION_TIMES = { Focus: 25 * 60, "Short Break": 5 * 60, "Long Break": 15 * 60 };
const SESSION_CYCLE = ["Focus", "Short Break", "Long Break", "Focus"];
const CIRCUMFERENCE = 804;

function fmtTime(secs) {
  return [Math.floor(secs / 60), secs % 60].map((v) => String(v).padStart(2, "0")).join(":");
}

function fmtMinutes(mins) {
  if (!mins) return "0m";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m > 0 ? `${m}m` : ""}`.trim() : `${m}m`;
}

export default function FocusPage() {
  const navigate   = useNavigate();
  const location   = useLocation();
  const routeState = location.state ?? {};

  const sessionMode = !!(routeState.duration); // true if came from "Join Now"

  // ── Initialize timer from session duration directly (fixes double-state bug) ──
  const initialSecs = sessionMode && routeState.duration
    ? routeState.duration * 60
    : 25 * 60;

  // ── Timer state ───────────────────────────────────────────────────────────
  const [sessionType,   setSessionType]   = useState("Focus");
  const [totalSeconds,  setTotalSeconds]  = useState(initialSecs);
  const [remaining,     setRemaining]     = useState(initialSecs);
  const [isPlaying,     setIsPlaying]     = useState(false);
  const [pomodoroCount, setPomodoroCount] = useState(0);

  // ── Subject / topic ───────────────────────────────────────────────────────
  const [subjects,        setSubjects]        = useState([]);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedTopic,   setSelectedTopic]   = useState(routeState.topic ?? "");
  const [selectorOpen,    setSelectorOpen]    = useState(false);
  const [sheetSubject,    setSheetSubject]    = useState(null);
  const [sheetTopic,      setSheetTopic]      = useState("");

  // ── Session tracking ──────────────────────────────────────────────────────
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [todayStats,      setTodayStats]      = useState({ count: 0, totalMins: 0 });
  const [statsLoading,    setStatsLoading]    = useState(true);

  // ── Refs ──────────────────────────────────────────────────────────────────
  const intervalRef        = useRef(null);
  const justCompletedRef   = useRef(false);
  const activeSessionIdRef = useRef(null);
  const autoStartedRef     = useRef(false); // prevents StrictMode double-fire

  useEffect(() => { activeSessionIdRef.current = activeSessionId; }, [activeSessionId]);

  // ── Fetch today stats ─────────────────────────────────────────────────────
  const fetchTodayStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const res   = await sessionsAPI.getAll({ date: today });
      const all   = Array.isArray(res.data) ? res.data : res.data?.sessions ?? [];
      const done  = all.filter((s) => s.status === "completed");
      setTodayStats({
        count:     done.length,
        totalMins: done.reduce((acc, s) => acc + (s.duration ?? 0), 0),
      });
    } catch {
      try {
        const res = await analyticsAPI.getSummary();
        setTodayStats({
          count:     res.data?.todaySessions  ?? 0,
          totalMins: res.data?.todayStudyTime ?? 0,
        });
      } catch { /* silent */ }
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // ── useEffect 1: Load subjects + stats + unmount cleanup ──────────────────
  useEffect(() => {
    subjectsAPI.getAll()
      .then((res) => {
        const data = Array.isArray(res.data) ? res.data : res.data?.subjects ?? [];
        setSubjects(data);
        if (routeState.subject) {
          const match = data.find((s) => s.name === routeState.subject || s._id === routeState.subject);
          if (match) setSelectedSubject({ _id: match._id, name: match.name });
          else setSelectedSubject({ _id: null, name: routeState.subject });
        }
      })
      .catch(() => {});

    fetchTodayStats();

    return () => {
      clearInterval(intervalRef.current);
      if (activeSessionIdRef.current) {
        sessionsAPI.end(activeSessionIdRef.current, { status: "incomplete" }).catch(() => {});
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── useEffect 2: Auto-start timer in session mode (SEPARATE from above) ───
// ── useEffect 2: Auto-start timer in session mode ─────────────────
useEffect(() => {
  if (!sessionMode) return;

  let cancelled = false;

  const timeoutId = setTimeout(() => {
    if (cancelled) return;                    // StrictMode cancelled first run
    clearInterval(intervalRef.current);
    setIsPlaying(true);
    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current);
          setIsPlaying(false);
          justCompletedRef.current = true;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, 500);

  return () => {
    cancelled = true;                         // mark cancelled before cleanup
    clearTimeout(timeoutId);
    clearInterval(intervalRef.current);
  };
}, []); // eslint-disable-line react-hooks/exhaustive-deps
  // ── Handle timer completion ───────────────────────────────────────────────
  const handleComplete = useCallback(async () => {
    if (sessionType !== "Focus") return;
    setPomodoroCount((p) => p + 1);

    if (sessionMode) {
      if (activeSessionIdRef.current) {
        try {
          await sessionsAPI.end(activeSessionIdRef.current, {
            status:   "completed",
            duration: Math.round(totalSeconds / 60),
          });
        } catch {}
        setActiveSessionId(null);
        activeSessionIdRef.current = null;
      }
      // Navigate back to Dashboard with quiz pending
      navigate("/dashboard", {
        replace: true,
        state: {
          pendingQuizSession: {
            sessionId: routeState.sessionId,
            subject:   selectedSubject?.name ?? routeState.subject ?? "",
            topic:     selectedTopic || routeState.topic || "",
          },
        },
      });
      return;
    }

    // Normal pomodoro completion
    if (activeSessionIdRef.current) {
      try {
        await sessionsAPI.end(activeSessionIdRef.current, {
          status:   "completed",
          duration: Math.round(totalSeconds / 60),
        });
      } catch {}
      setActiveSessionId(null);
      activeSessionIdRef.current = null;
    }
    fetchTodayStats();
  }, [sessionType, totalSeconds, fetchTodayStats, sessionMode, selectedSubject, selectedTopic, routeState, navigate]);

  // ── Watch for timer reaching 0 ────────────────────────────────────────────
  useEffect(() => {
    if (remaining === 0 && justCompletedRef.current) {
      justCompletedRef.current = false;
      handleComplete();
    }
  }, [remaining, handleComplete]);

  // ── Start backend session ─────────────────────────────────────────────────
  const startBackendSession = useCallback(async () => {
    if (sessionType !== "Focus") return;
    try {
      const res = await sessionsAPI.start({
        subject:   selectedSubject?._id ?? null,
        topic:     selectedTopic        || null,
        type:      "focus",
        startTime: new Date().toISOString(),
      });
      const id = res.data?.session?._id ?? res.data?._id ?? null;
      setActiveSessionId(id);
      activeSessionIdRef.current = id;
    } catch { /* timer works without backend */ }
  }, [sessionType, selectedSubject, selectedTopic]);

  // ── Play / Pause ──────────────────────────────────────────────────────────
  const handlePlayPause = async () => {
    if (isPlaying) {
      clearInterval(intervalRef.current);
      setIsPlaying(false);
    } else {
      if (sessionType === "Focus" && !activeSessionId && remaining === totalSeconds) {
        await startBackendSession();
      }
      setIsPlaying(true);
      intervalRef.current = setInterval(() => {
        setRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(intervalRef.current);
            setIsPlaying(false);
            justCompletedRef.current = true;
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
  };

  // ── Reset ─────────────────────────────────────────────────────────────────
  const handleReset = async () => {
    clearInterval(intervalRef.current);
    setIsPlaying(false);
    setRemaining(totalSeconds);
    if (activeSessionIdRef.current) {
      try { await sessionsAPI.end(activeSessionIdRef.current, { status: "incomplete" }); } catch {}
      setActiveSessionId(null);
      activeSessionIdRef.current = null;
    }
  };

  // ── Skip to next session type ─────────────────────────────────────────────
  const handleSkip = async () => {
    await handleReset();
    const next = SESSION_CYCLE[(SESSION_CYCLE.indexOf(sessionType) + 1) % SESSION_CYCLE.length];
    setSessionType(next);
    setTotalSeconds(SESSION_TIMES[next]);
    setRemaining(SESSION_TIMES[next]);
  };

  // ── Change session type ───────────────────────────────────────────────────
  const handleSessionType = async (type) => {
    await handleReset();
    setSessionType(type);
    setTotalSeconds(SESSION_TIMES[type]);
    setRemaining(SESSION_TIMES[type]);
  };

  // ── Subject selector ──────────────────────────────────────────────────────
  const openSelector   = () => { setSheetSubject(selectedSubject); setSheetTopic(selectedTopic); setSelectorOpen(true); document.body.style.overflow = "hidden"; };
  const closeSelector  = () => { setSelectorOpen(false); document.body.style.overflow = ""; };
  const confirmSelector = () => { setSelectedSubject(sheetSubject); setSelectedTopic(sheetTopic); closeSelector(); };

  // ── Derived ───────────────────────────────────────────────────────────────
  const progress         = remaining / totalSeconds;
  const strokeDashoffset = CIRCUMFERENCE * (1 - progress);
  const subjectLabel     = selectedSubject
    ? `${selectedSubject.name}${selectedTopic ? ` – ${selectedTopic}` : ""}`
    : "Select Subject";
  const RING_COLOR = { Focus: "#5150b1", "Short Break": "#006769", "Long Break": "#8d4f0e" };
  const ringColor  = RING_COLOR[sessionType];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="bg-[#f9faf3] text-[#1a1c18] min-h-screen flex flex-col items-center pb-32 overflow-x-hidden">

      {/* Top App Bar */}
      <header className="flex items-center justify-between px-5 py-6 w-full max-w-[480px]">
        <div className="flex items-center gap-3">
          {sessionMode && (
            <button
              onClick={() => navigate("/dashboard")}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-[#e8e9e2] active:scale-95 transition-transform"
            >
              <Icon name="arrow_back" className="text-[#464552]" />
            </button>
          )}
          <h1 className="text-[32px] font-extrabold text-[#1a1c18] tracking-tight">
            {sessionMode ? (routeState.subject || "Session") : "Focus"}
          </h1>
        </div>
        <button className="w-12 h-12 flex items-center justify-center rounded-full bg-[#e8e9e2] active:scale-95 transition-transform">
          <Icon name="settings" className="text-[#464552]" />
        </button>
      </header>

      <main className="w-full max-w-[480px] px-5 space-y-4">

        {/* Subject Selector Pill */}
        <div className="flex justify-center">
          <button
            onClick={openSelector}
            className="flex items-center gap-2 px-6 py-3 rounded-full bg-[#e2dfff] text-[#0b006b] active:scale-95 transition-transform shadow-sm max-w-[90%]"
          >
            <span className="text-[14px] font-semibold truncate">{subjectLabel}</span>
            <Icon name="expand_more" className="text-[20px] flex-shrink-0" />
          </button>
        </div>

        {/* Timer Ring */}
        <div className="flex flex-col items-center justify-center py-6">
          <div className="relative w-72 h-72 flex items-center justify-center">
            <svg className="absolute w-full h-full -rotate-90" viewBox="0 0 288 288">
              <circle cx="144" cy="144" r="128" fill="transparent" stroke="#e2e3dc" strokeWidth="12" />
              <circle
                cx="144" cy="144" r="128" fill="transparent"
                stroke={ringColor} strokeWidth="12"
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                style={{ transition: "stroke-dashoffset 0.5s ease" }}
              />
            </svg>
            <div className="text-center z-10">
              <span className="text-[48px] font-extrabold tracking-[-0.04em] block" style={{ color: ringColor }}>
                {fmtTime(remaining)}
              </span>
              <span className="text-[20px] font-bold text-[#1a1c18] block mt-1">
                {sessionMode ? "Study Session" : (sessionType === "Focus" ? "Focus Session" : sessionType)}
              </span>
              {!sessionMode && (
                <span className="text-[14px] font-semibold text-[#464552] mt-2 block opacity-70">
                  Pomodoro {pomodoroCount + (sessionType === "Focus" ? 1 : 0)} of 4
                </span>
              )}
              {sessionMode && (
                <span className="text-[14px] font-semibold text-[#464552] mt-2 block opacity-70">
                  {routeState.topic || "Focus"}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-8 py-2">
          <button onClick={handleReset} className="w-14 h-14 rounded-full border-2 border-[#c7c5d4] flex items-center justify-center text-[#464552] active:scale-90 transition-transform">
            <Icon name="restart_alt" className="text-[28px]" />
          </button>
          <button
            onClick={handlePlayPause}
            className="w-20 h-20 rounded-full flex items-center justify-center text-white shadow-xl active:scale-90 transition-transform"
            style={{ backgroundColor: ringColor }}
          >
            <Icon name={isPlaying ? "pause" : "play_arrow"} filled className="text-[40px]" />
          </button>
          {!sessionMode && (
            <button onClick={handleSkip} className="w-14 h-14 rounded-full border-2 border-[#c7c5d4] flex items-center justify-center text-[#464552] active:scale-90 transition-transform">
              <Icon name="skip_next" className="text-[28px]" />
            </button>
          )}
          {sessionMode && (
            <button
              onClick={() => navigate("/dashboard")}
              className="w-14 h-14 rounded-full border-2 border-[#c7c5d4] flex items-center justify-center text-[#464552] active:scale-90 transition-transform"
            >
              <Icon name="home" className="text-[28px]" />
            </button>
          )}
        </div>

        {/* Session Type Toggle — only show in normal mode */}
        {!sessionMode && (
          <div className="bg-[#e8e9e2] rounded-full p-1.5 flex gap-1 w-full max-w-[360px] mx-auto">
            {["Focus", "Short Break", "Long Break"].map((type) => (
              <button
                key={type}
                onClick={() => handleSessionType(type)}
                className="flex-1 py-2.5 rounded-full text-[14px] font-semibold transition-all"
                style={sessionType === type ? { backgroundColor: ringColor, color: "white" } : { color: "#464552" }}
              >
                {type}
              </button>
            ))}
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div className="bg-[#f3f4ed] p-6 rounded-[2rem] shadow-[0px_10px_30px_rgba(0,0,0,0.04)] border border-[#e2e3dc]/50">
            <div className="w-10 h-10 rounded-full bg-[#5150b1]/10 flex items-center justify-center mb-4">
              <Icon name="task_alt" filled className="text-[#5150b1]" />
            </div>
            <p className="text-[14px] font-semibold text-[#464552]">Sessions Today</p>
            <p className="text-[24px] font-bold text-[#1a1c18] mt-1">
              {statsLoading ? "—" : todayStats.count + pomodoroCount}
            </p>
          </div>
          <div className="bg-[#f3f4ed] p-6 rounded-[2rem] shadow-[0px_10px_30px_rgba(0,0,0,0.04)] border border-[#e2e3dc]/50">
            <div className="w-10 h-10 rounded-full bg-[#8d4f0e]/10 flex items-center justify-center mb-4">
              <Icon name="schedule" filled className="text-[#8d4f0e]" />
            </div>
            <p className="text-[14px] font-semibold text-[#464552]">Total Focus</p>
            <p className="text-[24px] font-bold text-[#1a1c18] mt-1">
              {statsLoading ? "—" : fmtMinutes(todayStats.totalMins + pomodoroCount * 25)}
            </p>
          </div>
        </div>

        {/* Motivational Banner */}
        <div className="relative w-full rounded-[2rem] overflow-hidden mt-2 bg-[#5150b1] px-8 py-7 flex flex-col justify-center">
          <div className="absolute right-4 top-1/2 -translate-y-1/2 w-28 h-28 rounded-full bg-white/10" />
          <div className="absolute right-14 top-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-white/10" />
          <p className="text-[20px] font-bold text-white relative z-10">Stay Sharp. 🎯</p>
          <p className="text-[14px] font-semibold text-white/80 mt-1 relative z-10">Every minute counts toward your goal.</p>
        </div>

      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-[432px] h-[72px] z-50 flex justify-around items-center px-4 bg-[#2f312d] rounded-full shadow-xl">
        {[
          { icon: "home",           label: "Home",     route: "/dashboard" },
          { icon: "calendar_month", label: "Schedule", route: "/schedule"  },
          { icon: "timer",          label: "Focus",    route: "/focus"     },
          { icon: "quiz",           label: "Quiz",     route: "/quiz"      },
          { icon: "person",         label: "Profile",  route: "/profile"   },
        ].map((item) => {
          const isActive = item.route === "/focus";
          return (
            <button
              key={item.route}
              onClick={() => navigate(item.route)}
              className={`flex flex-col items-center justify-center rounded-full p-2 transition-all active:scale-90 ${isActive ? "bg-[#6a69cc] px-4 py-3" : ""}`}
            >
              <Icon name={item.icon} filled={isActive} className={isActive ? "text-white" : "text-[#f0f1ea]"} />
              <span className={`text-[10px] font-semibold ${isActive ? "text-white" : "text-[#f0f1ea]"}`}>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Subject Selector Sheet */}
      {selectorOpen && <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]" onClick={closeSelector} />}
      <div
        className="fixed bottom-0 left-0 right-0 bg-[#f9faf3] rounded-t-[36px] z-[70] max-w-[480px] mx-auto shadow-2xl"
        style={{ transform: selectorOpen ? "translateY(0)" : "translateY(100%)", transition: "transform 0.4s cubic-bezier(0.32,0.72,0,1)" }}
      >
        <div className="p-6">
          <div className="w-10 h-1.5 bg-[#c7c5d4] rounded-full mx-auto mb-5" />
          <h2 className="font-bold text-xl text-[#1a1c18] mb-5">Select Subject</h2>
          <div className="space-y-2 max-h-[200px] overflow-y-auto mb-4">
            {subjects.length === 0 ? (
              <p className="text-sm text-[#464552] text-center py-4">No subjects yet</p>
            ) : subjects.map((s) => (
              <button
                key={s._id}
                onClick={() => setSheetSubject({ _id: s._id, name: s.name })}
                className={`w-full text-left px-4 py-3 rounded-2xl text-sm font-semibold transition-all ${
                  sheetSubject?._id === s._id ? "bg-[#5150b1] text-white" : "bg-[#f3f4ed] text-[#1a1c18]"
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
          <div className="space-y-1.5 mb-5">
            <label className="text-xs font-semibold text-[#464552] px-1">Topic <span className="text-[#c7c5d4] font-normal">(optional)</span></label>
            <input
              type="text" value={sheetTopic} onChange={(e) => setSheetTopic(e.target.value)}
              placeholder="e.g. Calculus Derivatives"
              className="w-full h-12 bg-[#f3f4ed] rounded-2xl px-4 text-sm font-medium text-[#1a1c18] ring-1 ring-[#c7c5d4] focus:ring-2 focus:ring-[#5150b1] outline-none transition-all"
            />
          </div>
          <div className="flex gap-3">
            <button onClick={closeSelector} className="flex-1 py-3.5 rounded-full border border-[#c7c5d4] text-[#464552] text-sm font-bold active:scale-95 transition-transform">Cancel</button>
            <button onClick={confirmSelector} className="flex-1 py-3.5 rounded-full bg-[#5150b1] text-white text-sm font-bold shadow-lg active:scale-95 transition-transform">Confirm</button>
          </div>
        </div>
      </div>

    </div>
  );
}