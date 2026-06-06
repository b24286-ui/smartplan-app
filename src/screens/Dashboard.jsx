import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { analyticsAPI, scheduleAPI } from "../services/api";
import PostSessionQuiz from "../components/PostSessionQuiz";
import RescheduleModal from "../components/RescheduleModal";

const Icon = ({ name, filled = false, className = "" }) => (
  <span
    className={`material-symbols-outlined ${className}`}
    style={{ fontVariationSettings: filled ? "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" : "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
  >
    {name}
  </span>
);

// ── Helpers ───────────────────────────────────────────────────────────────────
function getInitials(name = "") {
  return name.trim().split(/\s+/).map((w) => w[0]?.toUpperCase() || "").join("").slice(0, 2) || "?";
}
function getTodayLabel() {
  return new Date().toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" });
}
function formatTime(timeStr) {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour   = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}
function calcDurationMins(startTime, endTime) {
  if (!startTime || !endTime) return 25;
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  return Math.max((eh * 60 + em) - (sh * 60 + sm), 1);
}
function getTimeStatus(item) {
  if (item.status === "completed") return "completed";
  if (item.status === "skipped")   return "missed";
  if (!item.startTime || !item.endTime) return item.status ?? "pending";
  const now   = new Date();
  const cur   = now.getHours() * 60 + now.getMinutes();
  const [sh, sm] = item.startTime.split(":").map(Number);
  const [eh, em] = item.endTime.split(":").map(Number);
  const start = sh * 60 + sm;
  const end   = eh * 60 + em;
  if (cur > end)                  return "missed";
  if (cur >= start && cur <= end) return "active";
  return "pending";
}

function Skeleton({ className = "" }) {
  return <div className={`animate-pulse bg-[#e2e3dc] rounded-2xl ${className}`} />;
}

const quickActions = [
  { bg: "bg-[#81d4d6]/20", icon: "psychology",     color: "text-[#006769]", label: "Generate Quiz", route: "/quiz"      },
  { bg: "bg-[#e2dfff]/30", icon: "calendar_month", color: "text-[#5150b1]", label: "View Schedule", route: "/schedule"  },
  { bg: "bg-[#ffdcc2]/30", icon: "timer",           color: "text-[#8d4f0e]", label: "Focus Mode",    route: "/focus"     },
  { bg: "bg-[#e8e9e2]",    icon: "analytics",       color: "text-[#464552]", label: "Analytics",     route: "/analytics" },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  // ── State ─────────────────────────────────────────────────────────────────
  const [loading,         setLoading]         = useState(true);
  const [analytics,       setAnalytics]       = useState(null);
  const [todayPlan,       setTodayPlan]       = useState([]);
  const [weakSubjects,    setWeakSubjects]    = useState([]);
  const [rescheduleTarget, setRescheduleTarget] = useState(null); // ← AI reschedule

  // Quiz state
  const [pendingQuiz, setPendingQuiz] = useState(() => {
    const fromNav = location.state?.pendingQuizSession;
    if (fromNav) return fromNav;
    try { return JSON.parse(localStorage.getItem("sp_pending_quiz") ?? "null"); } catch { return null; }
  });
  const [showQuizModal, setShowQuizModal] = useState(!!location.state?.pendingQuizSession);

  useEffect(() => {
    if (location.state?.pendingQuizSession) window.history.replaceState({}, document.title);
  }, []); // eslint-disable-line

  useEffect(() => {
    if (pendingQuiz) localStorage.setItem("sp_pending_quiz", JSON.stringify(pendingQuiz));
    else             localStorage.removeItem("sp_pending_quiz");
  }, [pendingQuiz]);

  // ── Auto-mark missed ──────────────────────────────────────────────────────
  const autoMarkMissed = useCallback(async (sessions, quizPending) => {
    const now    = new Date();
    const curMin = now.getHours() * 60 + now.getMinutes();
    for (const s of sessions) {
      if (s.status !== "pending") continue;
      if (!s.endTime) continue;
      if (quizPending?.sessionId === s._id) continue;
      const [eh, em] = s.endTime.split(":").map(Number);
      if (curMin > eh * 60 + em) {
        try { await scheduleAPI.update(s._id, { status: "skipped" }); } catch {}
      }
    }
  }, []);

  // ── Fetch dashboard data ──────────────────────────────────────────────────
  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    const today = new Date().toISOString().split("T")[0];
    const [summaryRes, scheduleRes, subjectsRes] = await Promise.allSettled([
      analyticsAPI.getSummary(),
      scheduleAPI.getAll({ date: today }),
      analyticsAPI.getSubjects(),
    ]);
    if (summaryRes.status  === "fulfilled") setAnalytics(summaryRes.value.data);
    if (scheduleRes.status === "fulfilled") {
      const data     = scheduleRes.value.data;
      const planData = Array.isArray(data) ? data : data?.schedule ?? data?.sessions ?? [];
      setTodayPlan(planData);
      setPendingQuiz((currentQuiz) => { autoMarkMissed(planData, currentQuiz); return currentQuiz; });
    }
    if (subjectsRes.status === "fulfilled") {
      const data     = subjectsRes.value.data;
      const subjects = Array.isArray(data) ? data : data?.subjects ?? [];
      setWeakSubjects(subjects.filter((s) => (s.score ?? s.progress ?? 100) < 60).slice(0, 3));
    }
    setLoading(false);
  }, [autoMarkMissed]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  // ── Status toggle ─────────────────────────────────────────────────────────
  const toggleStatus = async (session) => {
    const newStatus = session.status === "completed" ? "pending" : "completed";
    setTodayPlan((prev) => prev.map((s) => s._id === session._id ? { ...s, status: newStatus } : s));
    try { await scheduleAPI.update(session._id, { status: newStatus }); }
    catch { setTodayPlan((prev) => prev.map((s) => s._id === session._id ? { ...s, status: session.status } : s)); }
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  const firstName     = user?.name?.split(" ")[0] || "there";
  const initials      = getInitials(user?.name);
  const streak        = analytics?.streak   ?? 0;
  const progress      = analytics?.progress ?? analytics?.weeklyProgress ?? 0;
  const level         = analytics?.level    ?? 1;
  const xp            = analytics?.xp       ?? analytics?.totalXP ?? 0;
  const upcomingExams = todayPlan.filter((s) => s.type === "exam").slice(0, 3);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="bg-[#f9faf3] min-h-screen flex flex-col items-center">
      <main className="w-full max-w-[480px] min-h-screen overflow-x-hidden pb-28">

        {/* Top Bar */}
        <header className="w-full sticky top-0 z-40 bg-[#f9faf3] flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-[#6a69cc] text-white font-bold text-sm flex-shrink-0">
              {initials}
            </div>
            <div>
              <h1 className="font-bold text-lg text-[#1a1c18] leading-tight">Hi, {firstName} 👋</h1>
              <p className="text-xs font-medium text-[#464552]">{getTodayLabel()}</p>
            </div>
          </div>
          <button className="w-10 h-10 rounded-full flex items-center justify-center bg-[#e8e9e2] active:scale-95 transition-transform">
            <Icon name="notifications" className="text-[#464552]" />
          </button>
        </header>

        <div className="px-5 flex flex-col gap-5 mt-1">

          {/* ── Streak + Progress Card ──────────────────────────────────────── */}
          {loading ? (
            <Skeleton className="h-[120px] rounded-[32px]" />
          ) : (
            <section className="w-full rounded-[32px] p-6 bg-[#5150b1] relative overflow-hidden shadow-lg">
              <div className="absolute -right-8 -top-8 w-36 h-36 bg-white/10 rounded-full blur-2xl pointer-events-none" />
              <div className="flex justify-between items-center relative z-10">
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-white/80">Current Streak 🔥</span>
                  <span className="text-4xl font-extrabold text-white mt-1 leading-none">
                    {streak} {streak === 1 ? "Day" : "Days"}
                  </span>
                  <span className="text-sm font-medium text-white/70 mt-1 italic">
                    {streak === 0 ? "Start your streak today!" : streak >= 7 ? "On fire! 🔥" : "Keep it up!"}
                  </span>
                  <span className="text-xs font-semibold text-white/60 mt-2">Level {level} · {xp} XP</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <div className="relative w-20 h-20 flex-shrink-0">
                    <div
                      className="w-20 h-20 rounded-full flex items-center justify-center"
                      style={{ background: `conic-gradient(rgba(255,255,255,0.9) 0% ${progress}%, rgba(255,255,255,0.2) ${progress}% 100%)` }}
                    >
                      <div className="w-[62px] h-[62px] rounded-full bg-[#5150b1] flex flex-col items-center justify-center">
                        <span className="text-base font-bold text-white leading-none">{progress}%</span>
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold text-white/70">Progress</span>
                </div>
              </div>
            </section>
          )}

          {/* ── Today's Plan ───────────────────────────────────────────────── */}
          <section>
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-bold text-lg text-[#1a1c18]">Today's Plan</h2>
              <button onClick={() => navigate("/subjects")} className="text-[#5150b1] text-sm font-semibold">See All</button>
            </div>

            {loading ? (
              <div className="flex flex-col gap-3">
                <Skeleton className="h-[90px]" />
                <Skeleton className="h-[90px]" />
              </div>
            ) : todayPlan.length === 0 ? (
              <div className="bg-white rounded-[24px] p-6 border border-[#c7c5d4]/10 text-center shadow-sm">
                <Icon name="event_note" className="text-[#c7c5d4] text-[40px] mb-2" />
                <p className="font-semibold text-[#464552] text-sm">No sessions scheduled for today</p>
                <button
                  onClick={() => navigate("/schedule")}
                  className="mt-3 px-5 py-2 bg-[#5150b1] text-white rounded-full text-xs font-bold active:scale-95 transition-transform"
                >
                  + Add Session
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {[...todayPlan]
                  .sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? ""))
                  .map((item) => {
                    const subjectName = item.subjectId?.name ?? item.subject?.name ?? item.subject ?? "Session";
                    const topicName   = item.topicId?.name   ?? item.topic?.name   ?? item.topic   ?? "";
                    const timeLabel   = item.startTime && item.endTime
                      ? `${formatTime(item.startTime)} - ${formatTime(item.endTime)}`
                      : item.time ?? "";

                    const hasPendingQuiz  = pendingQuiz?.sessionId === item._id;
                    const rawStatus       = getTimeStatus(item);
                    const effectiveStatus = hasPendingQuiz && rawStatus === "missed" ? "pending" : rawStatus;

                    const cardBg =
                      effectiveStatus === "completed" ? "bg-[#f3f4ed] opacity-75"
                      : effectiveStatus === "missed"  ? "bg-[#ffdad6]/20"
                      : effectiveStatus === "active"  ? "bg-[#e2dfff]/30 border-[#5150b1]/20"
                      : hasPendingQuiz                ? "bg-[#fff8f0] border-[#feac66]/30"
                      : "bg-white shadow-sm";

                    return (
                      <div
                        key={item._id}
                        className={`rounded-[24px] p-4 border border-[#c7c5d4]/10 flex flex-col gap-3 ${cardBg}`}
                      >
                        {/* Subject + status badge */}
                        <div className="flex justify-between items-start">
                          <div className="min-w-0 flex-1 pr-2">
                            <h3 className={`font-bold text-sm text-[#1a1c18] ${effectiveStatus === "completed" ? "line-through" : ""}`}>
                              {subjectName}
                            </h3>
                            {topicName && <p className="text-[#464552] text-xs mt-0.5 truncate">{topicName}</p>}
                          </div>

                          {hasPendingQuiz ? (
                            <span className="px-3 py-1 bg-[#feac66]/30 text-[#6d3900] rounded-full text-[11px] font-bold flex-shrink-0">Quiz Ready ✨</span>
                          ) : effectiveStatus === "completed" ? (
                            <span className="px-3 py-1 bg-[#006769]/10 text-[#006769] rounded-full text-[11px] font-bold flex-shrink-0">Done ✓</span>
                          ) : effectiveStatus === "missed" ? (
                            <span className="px-3 py-1 bg-[#ba1a1a]/10 text-[#ba1a1a] rounded-full text-[11px] font-bold flex-shrink-0">Missed</span>
                          ) : effectiveStatus === "active" ? (
                            <span className="px-3 py-1 bg-[#5150b1] text-white rounded-full text-[11px] font-bold flex-shrink-0 animate-pulse">Active Now</span>
                          ) : (
                            <span className="px-3 py-1 bg-[#ffdcc2] text-[#6d3900] rounded-full text-[11px] font-bold flex-shrink-0">Pending</span>
                          )}
                        </div>

                        {/* Time + action buttons */}
                        <div className="flex justify-between items-center">
                          {timeLabel ? (
                            <div className="flex items-center gap-1 text-[#464552] text-xs">
                              <Icon name="schedule" className="text-[16px]" />
                              {timeLabel}
                            </div>
                          ) : <div />}

                          {/* Take Quiz */}
                          {hasPendingQuiz && (
                            <button
                              onClick={() => setShowQuizModal(true)}
                              className="px-4 py-1.5 bg-[#feac66] text-[#2e1500] rounded-full text-xs font-bold active:scale-95 transition-transform animate-pulse"
                            >
                              Take Quiz ✨
                            </button>
                          )}

                          {/* Start / Join */}
                          {!hasPendingQuiz && (effectiveStatus === "pending" || effectiveStatus === "active") && (
                            <button
                              onClick={() => navigate("/focus", {
                                state: {
                                  subject:   subjectName,
                                  topic:     topicName,
                                  sessionId: item._id,
                                  duration:  calcDurationMins(item.startTime, item.endTime),
                                  mode:      "session",
                                },
                              })}
                              className="px-5 py-1.5 bg-[#5150b1] text-white rounded-full text-xs font-bold active:scale-95 transition-transform"
                            >
                              {effectiveStatus === "active" ? "Join Now" : "Start"}
                            </button>
                          )}

                          {/* ── Reschedule → opens AI modal ── */}
                          {!hasPendingQuiz && effectiveStatus === "missed" && (
                            <button
                              onClick={() => setRescheduleTarget({
                                _id:         item._id,
                                subjectName,
                                topicName,
                                startTime:   item.startTime,
                                endTime:     item.endTime,
                                date:        item.date,
                                duration:    calcDurationMins(item.startTime, item.endTime),
                              })}
                              className="px-5 py-1.5 bg-[#ba1a1a] text-white rounded-full text-xs font-bold active:scale-95 transition-transform"
                            >
                              Reschedule
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </section>

          {/* ── Quick Actions ───────────────────────────────────────────────── */}
          <section>
            <h2 className="font-bold text-lg text-[#1a1c18] mb-3">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-3">
              {quickActions.map((a) => (
                <div
                  key={a.label}
                  onClick={() => navigate(a.route)}
                  className={`${a.bg} p-4 rounded-[24px] flex flex-col gap-2 cursor-pointer active:scale-95 transition-transform`}
                >
                  <Icon name={a.icon} filled className={`${a.color} text-[26px]`} />
                  <span className="font-semibold text-sm text-[#1a1c18]">{a.label}</span>
                </div>
              ))}
            </div>
          </section>

          {/* ── Upcoming Exams ──────────────────────────────────────────────── */}
          {upcomingExams.length > 0 && (
            <section>
              <h2 className="font-bold text-lg text-[#1a1c18] mb-3">Upcoming Exams</h2>
              <div className="flex overflow-x-auto gap-3 pb-1" style={{ msOverflowStyle: "none", scrollbarWidth: "none" }}>
                {upcomingExams.map((exam, i) => {
                  const colors = [
                    { border: "border-[#ba1a1a]/20", badge: "text-[#ba1a1a] bg-[#ba1a1a]/10" },
                    { border: "border-[#8d4f0e]/20", badge: "text-[#8d4f0e] bg-[#8d4f0e]/10" },
                    { border: "border-[#006769]/20", badge: "text-[#006769] bg-[#006769]/10" },
                  ];
                  const c        = colors[i % colors.length];
                  const examDate = exam.examDate
                    ? new Date(exam.examDate).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })
                    : "";
                  const daysLeft = exam.examDate
                    ? Math.ceil((new Date(exam.examDate) - new Date()) / (1000 * 60 * 60 * 24))
                    : null;
                  return (
                    <div key={exam._id ?? i} className={`min-w-[220px] bg-white border-2 ${c.border} p-4 rounded-[24px] shadow-sm flex-shrink-0`}>
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-bold text-sm text-[#1a1c18]">{exam.subject?.name ?? exam.subject ?? "Exam"}</span>
                        {daysLeft !== null && (
                          <span className={`font-bold text-xs px-2 py-0.5 rounded-full ${c.badge}`}>{daysLeft}d left</span>
                        )}
                      </div>
                      {examDate && (
                        <div className="flex items-center gap-1.5 text-[#464552] text-xs">
                          <Icon name="calendar_today" className="text-[16px]" />
                          {examDate}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* ── Needs Attention ─────────────────────────────────────────────── */}
          <section>
            <h2 className="font-bold text-lg text-[#1a1c18] mb-3 flex items-center gap-2">
              Needs Attention
              <Icon name="warning" className="text-[#ba1a1a] text-[20px]" />
            </h2>
            {loading ? (
              <Skeleton className="h-[100px]" />
            ) : weakSubjects.length === 0 ? (
              <div className="bg-[#9ef1f2]/10 rounded-[28px] p-5 border border-[#006769]/10 flex items-center gap-3">
                <Icon name="check_circle" filled className="text-[#006769] text-[32px]" />
                <div>
                  <p className="font-bold text-sm text-[#1a1c18]">All subjects looking good!</p>
                  <p className="text-xs text-[#464552] mt-0.5">Keep studying to maintain your performance.</p>
                </div>
              </div>
            ) : (
              <div className="bg-[#ffdad6]/20 rounded-[28px] p-4 flex flex-col gap-3 border border-[#ffdad6]/40">
                {weakSubjects.map((item) => (
                  <div key={item._id ?? item.name} className="flex justify-between items-center bg-white p-3 rounded-[18px] shadow-sm">
                    <div className="min-w-0 flex-1 pr-2">
                      <p className="font-bold text-sm text-[#1a1c18] truncate">{item.name ?? item.subject}</p>
                      <p className="text-xs text-[#ba1a1a] font-semibold mt-0.5">
                        {item.reason ?? `Score: ${item.score ?? item.progress ?? 0}%`}
                      </p>
                    </div>
                    <button
                      onClick={() => navigate("/subjects")}
                      className="px-3 py-1.5 bg-[#ba1a1a] text-white rounded-full text-xs font-bold active:scale-95 transition-transform flex-shrink-0"
                    >
                      Revise
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

        </div>

        {/* ── Bottom Nav ──────────────────────────────────────────────────────── */}
        <nav className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[92%] max-w-[440px] h-[68px] rounded-full z-50 bg-[#2f312d] shadow-xl flex justify-around items-center px-3">
          {[
            { icon: "home",           label: "Home",     route: "/dashboard" },
            { icon: "calendar_month", label: "Schedule", route: "/schedule"  },
            { icon: "timer",          label: "Focus",    route: "/focus"     },
            { icon: "quiz",           label: "Quiz",     route: "/quiz"      },
            { icon: "person",         label: "Profile",  route: "/profile"   },
          ].map((item) => {
            const isActive = window.location.pathname === item.route;
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

        {/* ── PostSessionQuiz Modal ────────────────────────────────────────────── */}
        {showQuizModal && pendingQuiz && (
          <PostSessionQuiz
            subject={pendingQuiz.subject}
            topic={pendingQuiz.topic}
            sessionId={pendingQuiz.sessionId}
            onComplete={(passed) => {
              setShowQuizModal(false);
              if (passed) setPendingQuiz(null);
              fetchDashboard();
            }}
            onDismiss={() => setShowQuizModal(false)}
          />
        )}

        {/* ── AI Reschedule Modal ──────────────────────────────────────────────── */}
        {rescheduleTarget && (
          <RescheduleModal
            session={rescheduleTarget}
            onClose={() => setRescheduleTarget(null)}
            onRescheduled={() => {
              setRescheduleTarget(null);
              fetchDashboard();
            }}
          />
        )}

      </main>
    </div>
  );
}