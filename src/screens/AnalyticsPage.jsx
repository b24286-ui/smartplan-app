import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { analyticsAPI } from "../services/api";

const Icon = ({ name, filled = false, className = "" }) => (
  <span
    className={`material-symbols-outlined ${className}`}
    style={{ fontVariationSettings: filled ? "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" : "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
  >
    {name}
  </span>
);

// ── Colour palette by colorIdx ────────────────────────────────────────────────
const SUBJECT_PALETTE = [
  { text: "#5150b1", bar: "#5150b1" },
  { text: "#5150b1", bar: "#6a69cc" },
  { text: "#8d4f0e", bar: "#feac66" },
  { text: "#006769", bar: "#268083" },
  { text: "#ba1a1a", bar: "#ba1a1a" },
  { text: "#268083", bar: "#81d4d6" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtMinutes(mins) {
  if (!mins || mins === 0) return "0m";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function buildWeekBars(weeklyData = []) {
  const today   = new Date();
  const dow     = today.getDay();
  const offset  = dow === 0 ? -6 : 1 - dow;
  const monday  = new Date(today);
  monday.setDate(today.getDate() + offset);

  const bars = Array.from({ length: 7 }, (_, i) => {
    const d       = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dateStr = d.toISOString().split("T")[0];
    const isToday = d.toDateString() === today.toDateString();
    const label   = ["M", "T", "W", "T", "F", "S", "S"][i];
    const match   = weeklyData.find((w) => w.date === dateStr || w.day === dateStr || w.dayLabel === label);
    const minutes = match?.studyMinutes ?? match?.minutes ?? match?.totalMinutes ?? 0;
    return { label, minutes, isToday };
  });

  const maxMins = Math.max(...bars.map((b) => b.minutes), 1);
  return bars.map((b) => ({
    ...b,
    height: b.minutes > 0 ? Math.max(Math.round((b.minutes / maxMins) * 136), 8) : 4,
  }));
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Skeleton({ className = "" }) {
  return <div className={`animate-pulse bg-[#e2e3dc] rounded-3xl ${className}`} />;
}

export default function AnalyticsPage() {
  const navigate = useNavigate();

  const [loading,      setLoading]      = useState(true);
  const [summary,      setSummary]      = useState(null);
  const [bars,         setBars]         = useState(buildWeekBars([]));
  const [subjects,     setSubjects]     = useState([]);
  const [weakTopics,   setWeakTopics]   = useState([]);

  // ── Fetch all analytics data ───────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [summaryRes, weeklyRes, subjectsRes] = await Promise.allSettled([
      analyticsAPI.getSummary(),
      analyticsAPI.getWeekly(),
      analyticsAPI.getSubjects(),
    ]);

    // Summary
    if (summaryRes.status === "fulfilled") {
      setSummary(summaryRes.value.data);
    }

    // Weekly bars
    if (weeklyRes.status === "fulfilled") {
      const data = weeklyRes.value.data;
      const arr  = Array.isArray(data) ? data : data?.days ?? data?.weekly ?? [];
      setBars(buildWeekBars(arr));
    }

    // Subjects + weak topics
    if (subjectsRes.status === "fulfilled") {
      const data = subjectsRes.value.data;
      const arr  = Array.isArray(data) ? data : data?.subjects ?? [];

      // Normalise subjects for display
      const display = arr.slice(0, 6).map((s, i) => ({
        name:     s.name ?? "Subject",
        pct:      Math.round(s.progress ?? s.score ?? s.completionRate ?? s.avgScore ?? 0),
        colorIdx: s.colorIdx ?? i,
      }));
      setSubjects(display);

      // Derive weak topics (score < 60) from subject-level topic data
      const weak = arr
        .flatMap((s) => {
          // Backend may send s.weakTopics as string array
          if (Array.isArray(s.weakTopics)) return s.weakTopics;
          // Or s.topics with score
          if (Array.isArray(s.topics)) return s.topics.filter((t) => (t.score ?? 100) < 60).map((t) => t.name ?? t);
          return [];
        })
        .filter(Boolean)
        .slice(0, 5);
      setWeakTopics(weak);
    }

    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Derived summary values ────────────────────────────────────────────────
  const totalStudyTime = fmtMinutes(summary?.totalStudyMinutes ?? summary?.weeklyMinutes ?? summary?.studyTime ?? 0);
  const sessionCount   = summary?.totalSessions   ?? summary?.weeklySessions ?? summary?.sessions ?? 0;
  const streak         = summary?.streak           ?? 0;
  const avgScore       = Math.round(summary?.avgScore ?? summary?.averageScore ?? 0);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="bg-[#f9faf3] text-[#1a1c18] min-h-screen pb-32">

      {/* Top App Bar */}
      <header className="flex justify-between items-center w-full max-w-[480px] mx-auto bg-[#f9faf3] px-5 py-5 sticky top-0 z-40">
        <h1 className="text-[32px] font-extrabold leading-[40px] tracking-tight text-[#1a1c18]">Analytics</h1>
        <button
          onClick={fetchAll}
          className="w-12 h-12 flex items-center justify-center rounded-full bg-[#e8e9e2] active:scale-95 transition-transform"
        >
          <Icon name="refresh" className="text-[#464552]" />
        </button>
      </header>

      <main className="max-w-[480px] mx-auto px-5 space-y-4 pt-2">

        {/* ── Weekly Overview Card ─────────────────────────────────────────── */}
        {loading ? (
          <Skeleton className="h-[220px]" />
        ) : (
          <section className="bg-[#5150b1] p-6 rounded-3xl relative overflow-hidden shadow-xl">
            <div className="absolute -right-12 -top-12 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute right-8 bottom-0 w-24 h-24 bg-white/10 rounded-full blur-xl pointer-events-none" />
            <div className="relative z-10 space-y-4">
              <div className="flex justify-between items-start">
                <span className="text-[20px] font-bold text-white">This Week</span>
                <Icon name="trending_up" className="text-white opacity-80" />
              </div>
              <div>
                <h2 className="text-[48px] font-extrabold leading-[48px] tracking-[-0.04em] text-white">
                  {totalStudyTime}
                </h2>
                <p className="text-[14px] font-semibold text-white/80 mt-1">Total Study Time</p>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-2">
                {[
                  { value: String(sessionCount), label: "Sessions"  },
                  { value: `${streak} 🔥`,        label: "Day Streak" },
                  { value: `${avgScore}%`,        label: "Avg Score" },
                ].map((stat, i) => (
                  <div key={i} className={`bg-white/15 p-3 rounded-2xl ${i === 1 ? "border border-white/10" : ""}`}>
                    <p className="text-[20px] font-bold text-white">{stat.value}</p>
                    <p className="text-[10px] uppercase font-bold text-white/70 tracking-wider">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ── Bar Chart Card ───────────────────────────────────────────────── */}
        {loading ? (
          <Skeleton className="h-[220px]" />
        ) : (
          <section className="bg-white p-6 rounded-3xl shadow-[0px_10px_30px_rgba(0,0,0,0.04)]">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-[20px] font-bold text-[#1a1c18]">Daily Study Hours</h3>
                <p className="text-[14px] font-semibold text-[#464552]">This week</p>
              </div>
              <Icon name="more_horiz" className="text-[#464552]" />
            </div>
            <div className="flex justify-between items-end gap-2" style={{ height: "160px" }}>
              {bars.map((bar, i) => (
                <div key={i} className="flex flex-col items-center justify-end gap-2 flex-1 h-full">
                  {bar.minutes > 0 && (
                    <span className="text-[9px] font-bold text-[#464552]">{fmtMinutes(bar.minutes)}</span>
                  )}
                  <div
                    className="w-full rounded-full"
                    style={{
                      height:          `${bar.height}px`,
                      minHeight:       "4px",
                      backgroundColor: bar.isToday ? "#5150b1" : "rgba(81,80,177,0.25)",
                      boxShadow:       bar.isToday ? "0 4px 12px rgba(81,80,177,0.3)" : "none",
                    }}
                  />
                  <span
                    className="text-[12px]"
                    style={{ fontWeight: bar.isToday ? 700 : 600, color: bar.isToday ? "#5150b1" : "#464552" }}
                  >
                    {bar.label}
                  </span>
                </div>
              ))}
            </div>
            {bars.every((b) => b.minutes === 0) && (
              <p className="text-center text-sm text-[#464552] mt-4">No study sessions recorded this week yet.</p>
            )}
          </section>
        )}

        {/* ── Subject Performance ──────────────────────────────────────────── */}
        {loading ? (
          <Skeleton className="h-[240px]" />
        ) : (
          <section className="bg-white p-6 rounded-3xl shadow-[0px_10px_30px_rgba(0,0,0,0.04)]">
            <h3 className="text-[20px] font-bold text-[#1a1c18] mb-6">Subject Performance</h3>
            {subjects.length === 0 ? (
              <p className="text-sm text-[#464552] text-center py-4">
                No subjects tracked yet. Add subjects and start studying!
              </p>
            ) : (
              <div className="space-y-5">
                {subjects.map((s) => {
                  const palette = SUBJECT_PALETTE[s.colorIdx % SUBJECT_PALETTE.length];
                  return (
                    <div key={s.name} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[16px] font-medium text-[#1a1c18]">{s.name}</span>
                        <span className="text-[14px] font-bold" style={{ color: palette.text }}>{s.pct}%</span>
                      </div>
                      <div className="h-2.5 w-full bg-[#e8e9e2] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${s.pct}%`, backgroundColor: palette.bar }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* ── Weak Topics ──────────────────────────────────────────────────── */}
        {loading ? (
          <Skeleton className="h-[180px]" />
        ) : (
          <section className="bg-white p-6 rounded-3xl shadow-[0px_10px_30px_rgba(0,0,0,0.04)]">
            <div className="mb-4">
              <h3 className="text-[20px] font-bold text-[#1a1c18]">Weak Topics 🧠</h3>
              <p className="text-[16px] font-medium text-[#464552] mt-1">Focus on these to improve</p>
            </div>

            {weakTopics.length === 0 ? (
              <div className="flex items-center gap-3 bg-[#9ef1f2]/20 rounded-2xl p-4 mb-4">
                <Icon name="check_circle" filled className="text-[#006769] text-[28px]" />
                <div>
                  <p className="font-bold text-sm text-[#1a1c18]">All topics looking strong!</p>
                  <p className="text-xs text-[#464552]">Keep studying to maintain your performance.</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-3 mb-4">
                {weakTopics.map((topic) => (
                  <div
                    key={topic}
                    className="px-4 py-2 bg-[#ffdad6] rounded-full border border-[#ba1a1a]/20 flex items-center gap-2 active:scale-95 transition-transform cursor-pointer"
                  >
                    <Icon name="warning" className="text-[18px] text-[#93000a]" />
                    <span className="text-[14px] font-semibold text-[#93000a]">{topic}</span>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => navigate("/schedule")}
              className="w-full mt-2 py-4 bg-[#2f312d] text-[#f0f1ea] rounded-full text-[14px] font-bold active:scale-[0.98] transition-transform"
            >
              View Schedule
            </button>
          </section>
        )}

      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-[432px] rounded-full h-[72px] z-50 bg-[#2f312d] shadow-xl flex justify-around items-center px-4">
        {[
          { icon: "home",           label: "Home",     route: "/dashboard" },
          { icon: "calendar_month", label: "Schedule", route: "/schedule"  },
          { icon: "timer",          label: "Focus",    route: "/focus"     },
          { icon: "quiz",           label: "Quiz",     route: "/quiz"      },
          { icon: "person",         label: "Profile",  route: "/profile"   },
        ].map((item) => (
          <button
            key={item.route}
            onClick={() => navigate(item.route)}
            className="flex flex-col items-center justify-center p-2 rounded-full transition-all active:scale-90 text-[#f0f1ea]"
          >
            <Icon name={item.icon} className="text-[#f0f1ea]" />
            <span className="text-[10px] font-semibold text-[#f0f1ea]">{item.label}</span>
          </button>
        ))}
      </nav>

    </div>
  );
}