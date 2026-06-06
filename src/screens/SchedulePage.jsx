import AIScheduleModal from "../components/AIScheduleModal";
import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { scheduleAPI, subjectsAPI } from "../services/api";

const Icon = ({ name, filled = false, className = "" }) => (
  <span
    className={`material-symbols-outlined ${className}`}
    style={{ fontVariationSettings: filled ? "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" : "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
  >
    {name}
  </span>
);

const ACCENT_COLORS = ["#5150b1", "#006769", "#8d4f0e", "#ba1a1a", "#5150b1", "#268083"];

function getAccent(session) {
  if (session.colorIdx != null) return ACCENT_COLORS[session.colorIdx % ACCENT_COLORS.length];
  const name = session.subjectName || "";
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return ACCENT_COLORS[Math.abs(h) % ACCENT_COLORS.length];
}

const STATUS_CONFIG = {
  pending:   { label: "Pending",   bg: "bg-[#ffdcc2]",    text: "text-[#6d3900]" },
  completed: { label: "Completed", bg: "bg-[#006769]/10", text: "text-[#006769]" },
  skipped:   { label: "Skipped",   bg: "bg-[#ffdad6]",    text: "text-[#93000a]" },
};

function buildWeek() {
  const today  = new Date();
  const dow    = today.getDay();
  const offset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(today);
  monday.setDate(today.getDate() + offset);

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return {
      key:      d.toISOString().split("T")[0],
      label:    d.toLocaleDateString("en-US", { weekday: "short" }),
      date:     String(d.getDate()),
      month:    d.toLocaleDateString("en-US", { month: "short" }),
      fullName: d.toLocaleDateString("en-US", { weekday: "long" }),
      isToday:  d.toDateString() === today.toDateString(),
    };
  });
}

function normalizeSession(s) {
  const subjectObj = s.subjectId && typeof s.subjectId === "object"
    ? s.subjectId
    : (typeof s.subject === "object" ? s.subject : null);
  const topicObj = s.topicId && typeof s.topicId === "object"
    ? s.topicId
    : (typeof s.topic === "object" ? s.topic : null);
  const startTime = s.startTime ?? s.time ?? "";
  const endTime   = s.endTime   ?? s.end  ?? "";

  let durationLabel = s.durationStr ?? "";
  if (!durationLabel && startTime && endTime) {
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    const mins = (eh * 60 + em) - (sh * 60 + sm);
    durationLabel = mins > 0 ? `${mins} min` : "";
  }

  return {
    _id:         s._id ?? String(Math.random()),
    subjectName: subjectObj?.name ?? "Session",
    subjectId:   subjectObj?._id  ?? null,
    colorIdx:    subjectObj?.colorIdx ?? null,
    topicName:   topicObj?.name ?? "",
    startTime,
    endTime,
    duration:    durationLabel,
    status:      s.status ?? "pending",
  };
}

function Skeleton({ className = "" }) {
  return <div className={`animate-pulse bg-[#e2e3dc] rounded-[24px] ${className}`} />;
}

function SessionCard({ session, onToggleStatus, onStart }) {
  const accent      = getAccent(session);
  const sc          = STATUS_CONFIG[session.status] ?? STATUS_CONFIG.pending;
  const isCompleted = session.status === "completed";

  return (
    <div className="bg-white rounded-[24px] shadow-sm border border-[#c7c5d4]/20 overflow-hidden flex">
      <div className="w-1.5 flex-shrink-0 rounded-l-[24px]" style={{ background: accent }} />
      <div className="flex flex-col items-center justify-start px-3 py-4 flex-shrink-0 min-w-[52px]">
        <span className="text-[11px] font-bold text-[#464552]">{session.startTime}</span>
        <div className="w-px flex-1 bg-[#c7c5d4] my-1.5 min-h-[24px]" />
        <span className="text-[11px] font-bold text-[#464552]">{session.endTime}</span>
      </div>
      <div className="flex-1 py-4 pr-4 space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-1">
          <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: `${accent}20`, color: accent }}>
            {session.subjectName}
          </span>
          <div className="flex items-center gap-1.5">
            {session.duration && <span className="text-[10px] font-semibold text-[#464552]">{session.duration}</span>}
            <button
              onClick={() => onToggleStatus(session)}
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sc.bg} ${sc.text}`}
            >
              {sc.label}
            </button>
          </div>
        </div>
        {session.topicName && (
          <p className={`font-bold text-sm ${isCompleted ? "line-through text-[#464552]" : "text-[#1a1c18]"}`}>
            {session.topicName}
          </p>
        )}
        {isCompleted ? (
          <div className="flex items-center gap-1 text-[#006769]">
            <Icon name="check_circle" filled className="text-[16px]" />
            <span className="text-xs font-semibold">Completed</span>
          </div>
        ) : (
          <button
            onClick={() => onStart(session)}
            className="mt-1 px-4 py-1.5 bg-[#5150b1] text-white rounded-full text-xs font-bold active:scale-95 transition-transform"
          >
            Start Session
          </button>
        )}
      </div>
    </div>
  );
}

export default function SchedulePage() {
  const navigate = useNavigate();
  const DAYS     = buildWeek();
  const todayKey = new Date().toISOString().split("T")[0];

  const [activeDay,   setActiveDay]   = useState(todayKey);
  const [sessions,    setSessions]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [subjects,    setSubjects]    = useState([]);
  const [showAIModal, setShowAIModal] = useState(false);
  const [sheetOpen,   setSheetOpen]   = useState(false);
  const [saving,      setSaving]      = useState(false);

  const [newSubject,   setNewSubject]   = useState("");
  const [newTopic,     setNewTopic]     = useState("");
  const [newStartTime, setNewStartTime] = useState("09:00");
  const [newEndTime,   setNewEndTime]   = useState("10:00");

  // ── Fetch sessions ─────────────────────────────────────────────────────────
  const fetchSessions = useCallback(async (date) => {
    setLoading(true);
    try {
      const res  = await scheduleAPI.getAll({ date });
      const data = Array.isArray(res.data) ? res.data : res.data?.schedule ?? res.data?.sessions ?? [];
      setSessions(data.map(normalizeSession));
    } catch {
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSessions(activeDay); }, [activeDay, fetchSessions]);

  // ── Fetch subjects for add-session dropdown ────────────────────────────────
  useEffect(() => {
    subjectsAPI.getAll()
      .then((res) => {
        const data = Array.isArray(res.data) ? res.data : res.data?.subjects ?? [];
        setSubjects(data);
      })
      .catch((err) => console.error("Subjects fetch error:", err));
  }, []);

  // ── Status toggle ──────────────────────────────────────────────────────────
  const toggleStatus = async (session) => {
    const next     = session.status === "completed" ? "pending" : "completed";
    const original = session.status;
    setSessions((prev) => prev.map((s) => s._id === session._id ? { ...s, status: next } : s));
    try {
      await scheduleAPI.update(session._id, { status: next });
    } catch {
      setSessions((prev) => prev.map((s) => s._id === session._id ? { ...s, status: original } : s));
    }
  };

  // ── Start Session → Focus page ─────────────────────────────────────────────
  const startSession = (session) => {
    navigate("/focus", {
      state: {
        sessionId: session._id,
        subject:   session.subjectName,
        topic:     session.topicName,
      },
    });
  };

  // ── Sheet helpers ──────────────────────────────────────────────────────────
  const openSheet = () => {
    setNewSubject(""); setNewTopic(""); setNewStartTime("09:00"); setNewEndTime("10:00");
    setSheetOpen(true);
    document.body.style.overflow = "hidden";
  };
  const closeSheet = () => { setSheetOpen(false); document.body.style.overflow = ""; };

  // ── Save new session ───────────────────────────────────────────────────────
  const saveSession = async () => {
    if (!newSubject.trim()) return;
    setSaving(true);
    try {
      const subjectObj = subjects.find((s) => s._id === newSubject);
      const payload = {
        subjectId: newSubject,
        topicId:   undefined,
        date:      activeDay,
        startTime: newStartTime,
        endTime:   newEndTime,
        type:      "focus",
      };
      const res     = await scheduleAPI.create(payload);
      const created = res.data?.scheduleItem ?? res.data;
      const display = normalizeSession({
        ...created,
        subject: subjectObj ?? { name: newSubject },
      });
      setSessions((prev) =>
        [...prev, display].sort((a, b) => a.startTime.localeCompare(b.startTime))
      );
      closeSheet();
    } catch (err) {
      console.error("Schedule save error:", err.response?.data);
    } finally {
      setSaving(false);
    }
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const dayInfo    = DAYS.find((d) => d.key === activeDay) ?? DAYS[0];
  const isWeekend  = ["Sat", "Sun"].some((w) => dayInfo.label.startsWith(w.slice(0, 2)));
  const isRestDay  = !loading && sessions.length === 0 && isWeekend;
  const isEmptyDay = !loading && sessions.length === 0 && !isWeekend;

  const totalMins = sessions.reduce((acc, s) => {
    if (!s.startTime || !s.endTime) return acc;
    const [sh, sm] = s.startTime.split(":").map(Number);
    const [eh, em] = s.endTime.split(":").map(Number);
    return acc + (eh * 60 + em) - (sh * 60 + sm);
  }, 0);
  const summaryText = sessions.length > 0
    ? `${(totalMins / 60).toFixed(1).replace(".0", "")} hrs planned · ${sessions.length} session${sessions.length !== 1 ? "s" : ""}`
    : "";

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="bg-[#f9faf3] text-[#1a1c18] min-h-screen pb-28">

      {/* Top Bar */}
      <header className="sticky top-0 z-50 bg-[#f9faf3]/90 backdrop-blur-md border-b border-[#c7c5d4]/20">
        <div className="max-w-[480px] mx-auto flex justify-between items-center px-5 py-4">
          <button onClick={() => navigate("/dashboard")} className="w-10 h-10 flex items-center justify-center rounded-full bg-[#f3f4ed] active:scale-95 transition-transform">
            <Icon name="arrow_back" className="text-[#1a1c18]" />
          </button>
          <h1 className="font-bold text-lg text-[#1a1c18]">My Schedule</h1>
          <button onClick={openSheet} className="w-10 h-10 flex items-center justify-center rounded-full bg-[#5150b1] text-white shadow-lg active:scale-95 transition-transform">
            <Icon name="add" filled className="text-[22px]" />
          </button>
        </div>
      </header>

      <main className="max-w-[480px] mx-auto px-5 mt-4 space-y-5">

        {/* Week Selector */}
        <div className="flex gap-2 overflow-x-auto pb-1" style={{ msOverflowStyle: "none", scrollbarWidth: "none" }}>
          {DAYS.map((d) => (
            <button
              key={d.key}
              onClick={() => setActiveDay(d.key)}
              className={`flex-shrink-0 w-14 py-3 rounded-[20px] flex flex-col items-center gap-0.5 transition-all active:scale-95 relative ${
                d.key === activeDay ? "bg-[#5150b1] text-white shadow-lg" : "bg-[#f3f4ed] text-[#464552]"
              }`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider">{d.label}</span>
              <span className="font-bold text-lg leading-none">{d.date}</span>
              {d.isToday && d.key !== activeDay && (
                <div className="w-1.5 h-1.5 rounded-full bg-[#5150b1] absolute bottom-1.5" />
              )}
            </button>
          ))}
        </div>

        {/* Day Header */}
        <div>
          <h2 className="font-bold text-xl text-[#1a1c18]">
            {dayInfo.fullName}, {dayInfo.date} {dayInfo.month}
            {dayInfo.isToday && (
              <span className="ml-2 text-xs font-bold text-[#5150b1] bg-[#5150b1]/10 px-2 py-0.5 rounded-full">Today</span>
            )}
          </h2>
          <p className="text-sm text-[#464552] mt-0.5">
            {loading ? "Loading…" : isRestDay ? "Rest day — recharge your batteries!" : summaryText || "No sessions yet"}
          </p>
        </div>

        {/* AI Generate Banner */}
        <div
          className="bg-gradient-to-r from-[#5150b1] to-[#7b7ae0] rounded-[20px] p-4 flex items-center gap-3 cursor-pointer shadow-md active:scale-[0.98] transition-transform"
          onClick={() => setShowAIModal(true)}
        >
          <div className="w-10 h-10 bg-white/20 rounded-[14px] flex items-center justify-center flex-shrink-0">
            <Icon name="auto_awesome" filled className="text-white text-[22px]" />
          </div>
          <div className="flex-1">
            <p className="text-white font-bold text-sm leading-tight">Generate with AI ✨</p>
            <p className="text-white/70 text-xs mt-0.5">Auto-build your weekly study plan</p>
          </div>
          <Icon name="arrow_forward_ios" className="text-white/60 text-[14px]" />
        </div>

        {/* Sessions */}
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-[110px]" />
            <Skeleton className="h-[110px]" />
            <Skeleton className="h-[110px]" />
          </div>
        ) : isRestDay ? (
          <div className="bg-white rounded-[24px] p-8 border-2 border-dashed border-[#c7c5d4] text-center space-y-3 shadow-sm">
            <div className="text-5xl">😴</div>
            <h3 className="font-bold text-base text-[#1a1c18]">Rest Day</h3>
            <p className="text-sm text-[#464552]">No sessions scheduled. Enjoy your break!</p>
            <button onClick={openSheet} className="px-5 py-2 bg-[#5150b1] text-white rounded-full text-xs font-bold active:scale-95 transition-transform">
              Add anyway
            </button>
          </div>
        ) : isEmptyDay ? (
          <div className="bg-white rounded-[24px] p-8 border-2 border-dashed border-[#c7c5d4] text-center space-y-3 shadow-sm">
            <div className="text-5xl">📅</div>
            <h3 className="font-bold text-base text-[#1a1c18]">No sessions yet</h3>
            <p className="text-sm text-[#464552]">Add a study session for {dayInfo.fullName}</p>
            <button onClick={openSheet} className="px-5 py-2 bg-[#5150b1] text-white rounded-full text-xs font-bold active:scale-95 transition-transform">
              + Add Session
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((s) => (
              <SessionCard
                key={s._id}
                session={s}
                onToggleStatus={toggleStatus}
                onStart={startSession}
              />
            ))}
          </div>
        )}
      </main>
      {/* Bottom Nav */}
      <nav className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[92%] max-w-[440px] h-[68px] rounded-full z-50 bg-[#2f312d] shadow-xl flex justify-around items-center px-3">
        {[
          { icon: "home",           label: "Home",     route: "/dashboard" },
          { icon: "calendar_month", label: "Schedule", route: "/schedule"  },
          { icon: "timer",          label: "Focus",    route: "/focus"     },
          { icon: "quiz",           label: "Quiz",     route: "/quiz"      },
          { icon: "person",         label: "Profile",  route: "/profile"   },
        ].map((item) => {
          const isActive = item.route === "/schedule";
          return (
            <button
              key={item.route}
              onClick={() => navigate(item.route)}
              className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-full transition-all active:scale-90 ${isActive ? "bg-[#6a69cc]" : ""}`}
            >
              <Icon name={item.icon} filled={isActive} className={`text-[20px] ${isActive ? "text-white" : "text-[#e2e3dc]"}`} />
              <span className={`text-[10px] ${isActive ? "font-bold text-white" : "font-medium text-[#e2e3dc]"}`}>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Backdrop for add-session sheet */}
      {sheetOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]" onClick={closeSheet} />
      )}

      {/* Add Session Bottom Sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 bg-[#f9faf3] rounded-t-[36px] z-[70] p-6 max-w-[480px] mx-auto shadow-2xl"
        style={{
          transform:  sheetOpen ? "translateY(0)" : "translateY(100%)",
          transition: "transform 0.4s cubic-bezier(0.32,0.72,0,1)",
        }}
      >
        <div className="w-10 h-1.5 bg-[#c7c5d4] rounded-full mx-auto mb-5" />
        <h2 className="font-bold text-xl text-[#1a1c18] mb-1">Add Session</h2>
        <p className="text-xs text-[#464552] mb-5">{dayInfo.fullName}, {dayInfo.date} {dayInfo.month}</p>

        <div className="space-y-4">
          {/* Subject */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#464552] px-1">Subject</label>
            {subjects.length > 0 ? (
              <select
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                className="w-full h-12 bg-[#f3f4ed] rounded-2xl px-4 text-sm font-medium text-[#1a1c18] ring-1 ring-[#c7c5d4] focus:ring-2 focus:ring-[#5150b1] outline-none appearance-none cursor-pointer"
              >
                <option value="">Select subject…</option>
                {subjects.map((s) => (
                  <option key={s._id} value={s._id}>{s.name}</option>
                ))}
              </select>
            ) : (
              <input
                type="text" value={newSubject} onChange={(e) => setNewSubject(e.target.value)}
                placeholder="e.g. Mathematics"
                className="w-full h-12 bg-[#f3f4ed] rounded-2xl px-4 text-sm font-medium text-[#1a1c18] ring-1 ring-[#c7c5d4] focus:ring-2 focus:ring-[#5150b1] outline-none transition-all"
              />
            )}
          </div>

          {/* Topic */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#464552] px-1">
              Topic <span className="text-[#c7c5d4] font-normal">(optional)</span>
            </label>
            <input
              type="text" value={newTopic} onChange={(e) => setNewTopic(e.target.value)}
              placeholder="e.g. Calculus Derivatives"
              className="w-full h-12 bg-[#f3f4ed] rounded-2xl px-4 text-sm font-medium text-[#1a1c18] ring-1 ring-[#c7c5d4] focus:ring-2 focus:ring-[#5150b1] outline-none transition-all"
            />
          </div>

          {/* Time pickers */}
          <div className="flex gap-3">
            <div className="flex-1 space-y-1.5">
              <label className="text-xs font-semibold text-[#464552] px-1">Start Time</label>
              <input
                type="time" value={newStartTime} onChange={(e) => setNewStartTime(e.target.value)}
                className="w-full h-12 bg-[#f3f4ed] rounded-2xl px-4 text-sm font-medium text-[#1a1c18] ring-1 ring-[#c7c5d4] focus:ring-2 focus:ring-[#5150b1] outline-none transition-all"
              />
            </div>
            <div className="flex-1 space-y-1.5">
              <label className="text-xs font-semibold text-[#464552] px-1">End Time</label>
              <input
                type="time" value={newEndTime} onChange={(e) => setNewEndTime(e.target.value)}
                className="w-full h-12 bg-[#f3f4ed] rounded-2xl px-4 text-sm font-medium text-[#1a1c18] ring-1 ring-[#c7c5d4] focus:ring-2 focus:ring-[#5150b1] outline-none transition-all"
              />
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button onClick={closeSheet} className="flex-1 py-3.5 rounded-full border border-[#c7c5d4] text-[#464552] text-sm font-bold active:scale-95 transition-transform">
              Cancel
            </button>
            <button
              onClick={saveSession}
              disabled={saving || !newSubject.trim()}
              className="flex-1 py-3.5 rounded-full bg-[#5150b1] text-white text-sm font-bold shadow-lg active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {saving ? "Saving…" : "Add Session"}
            </button>
          </div>
        </div>
      </div>

      {/* ── AI Schedule Modal ── */}
      {showAIModal && (
        <AIScheduleModal
          onClose={() => setShowAIModal(false)}
          onScheduleCreated={() => {
            setShowAIModal(false);
            fetchSessions(activeDay);
          }}
        />
      )}

    </div>
  );
}