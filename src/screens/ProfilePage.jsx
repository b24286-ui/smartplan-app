import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { profileAPI, analyticsAPI, subjectsAPI } from "../services/api";

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
  return name.trim().split(/\s+/).map((w) => w[0]?.toUpperCase() ?? "").join("").slice(0, 2) || "?";
}

function formatExamDate(dateStr) {
  if (!dateStr) return "Not set";
  return new Date(dateStr).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}

// ── Goal icon map (matches onboarding labels) ─────────────────────────────────
const GOAL_ICONS = {
  "Score above 80%":        "ads_click",
  "Complete full syllabus": "auto_stories",
  "Build study habit":      "alarm_on",
  "Crack competitive exam": "emoji_events",
  "Improve weak subjects":  "construction",
  "Consistent revision":    "replay",
};

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Skeleton({ className = "" }) {
  return <div className={`animate-pulse bg-[#e2e3dc] rounded-[24px] ${className}`} />;
}

export default function ProfilePage() {
  const navigate              = useNavigate();
  const { user, logout, refreshUser, setUser } = useAuth();

  // ── Data state ────────────────────────────────────────────────────────────
  const [profile,    setProfile]    = useState(null);   // { college, course, year, goals, studyHours, preferredTimes, examDate }
  const [stats,      setStats]      = useState({ streak: 0, avgScore: 0, subjectCount: 0 });
  const [loading,    setLoading]    = useState(true);

  // ── Edit sheet state ──────────────────────────────────────────────────────
  const [editOpen,   setEditOpen]   = useState(false);
  const [editName,   setEditName]   = useState("");
  const [editCollege, setEditCollege] = useState("");
  const [editCourse, setEditCourse] = useState("");
  const [editYear,   setEditYear]   = useState("");
  const [saving,     setSaving]     = useState(false);
  const [saveError,  setSaveError]  = useState("");

  // ── Fetch profile + stats ─────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [profileRes, analyticsRes, subjectsRes] = await Promise.allSettled([
      profileAPI.get(),
      analyticsAPI.getSummary(),
      subjectsAPI.getAll(),
    ]);

    if (profileRes.status === "fulfilled") {
      const data = profileRes.value.data?.user ?? profileRes.value.data;
      setProfile(data);
    }

    const streak       = analyticsRes.status === "fulfilled" ? (analyticsRes.value.data?.streak ?? 0) : 0;
    const avgScore     = analyticsRes.status === "fulfilled" ? Math.round(analyticsRes.value.data?.avgScore ?? analyticsRes.value.data?.averageScore ?? 0) : 0;
    const subjectsData = subjectsRes.status === "fulfilled"
      ? (Array.isArray(subjectsRes.value.data) ? subjectsRes.value.data : subjectsRes.value.data?.subjects ?? [])
      : [];

    setStats({ streak, avgScore, subjectCount: subjectsData.length });
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Edit sheet ────────────────────────────────────────────────────────────
  const openEdit = () => {
    setEditName(user?.name ?? "");
    setEditCollege(profile?.college ?? "");
    setEditCourse(profile?.course ?? "");
    setEditYear(profile?.year ?? "");
    setSaveError("");
    setEditOpen(true);
    document.body.style.overflow = "hidden";
  };
  const closeEdit = () => { setEditOpen(false); document.body.style.overflow = ""; };

 const saveProfile = async () => {
  if (!editName.trim()) { setSaveError("Name is required."); return; }
  setSaving(true);
  setSaveError("");
  try {
    const res = await profileAPI.update({
      name:    editName.trim(),
      college: editCollege,
      course:  editCourse,
      year:    editYear,
    });
    // ← Read from res.data.user (not res.data.profile)
    const updatedUser = res.data?.user ?? res.data;
    setUser((prev) => prev ? { ...prev, name: editName.trim() } : prev);
    setProfile(updatedUser);  // ← store the full updated user object
    closeEdit();
  } catch (err) {
    setSaveError(err.response?.data?.message || "Failed to save.");
  } finally {
    setSaving(false);
  }
};
  // ── Logout ────────────────────────────────────────────────────────────────
  const handleLogout = () => {
    if (!window.confirm("Log out of SmartPlan?")) return;
    logout();
    navigate("/", { replace: true });
  };

  // ── Derived values ────────────────────────────────────────────────────────
  const displayName    = user?.name    ?? "Student";
  const initials       = getInitials(displayName);
  const college        = profile?.college ?? "";
  const course         = profile?.course  ?? "";
  const year           = profile?.year    ?? "";
  const goals          = Array.isArray(profile?.goals) ? profile.goals : [];
  const studyHours     = profile?.studyHours    ?? "3h";
  const preferredTimes = Array.isArray(profile?.preferredTimes) && profile.preferredTimes.length > 0
    ? profile.preferredTimes.join(", ")
    : "Not set";
  const examDate       = formatExamDate(profile?.examDate);
  const level          = user?.level ?? 1;
  const xp             = user?.xp    ?? 0;

  const SETTINGS = [
    { icon: "notifications", label: "Notifications", error: false, action: null },
    { icon: "palette",       label: "Appearance",    error: false, action: null },
    { icon: "lock",          label: "Privacy",       error: false, action: null },
    { icon: "help",          label: "Help & Support",error: false, action: null },
    { icon: "logout",        label: "Log Out",       error: true,  action: handleLogout },
  ];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="bg-[#f9faf3] text-[#1a1c18] flex justify-center min-h-screen">
      <main className="w-full max-w-[480px] min-h-screen relative pb-32">

        {/* Top App Bar */}
        <header className="flex justify-between items-center px-5 py-5 w-full bg-[#f9faf3] sticky top-0 z-40">
          <h1 className="text-[32px] font-extrabold leading-[40px] tracking-tight text-[#1a1c18]">Profile</h1>
          <button
            onClick={openEdit}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-[#e8e9e2] text-[#464552] active:scale-95 transition-transform"
          >
            <Icon name="edit" className="text-[20px]" />
          </button>
        </header>

        <div className="px-5 space-y-4 pt-2">

          {/* ── Profile Card ──────────────────────────────────────────────── */}
          {loading ? <Skeleton className="h-[220px]" /> : (
            <section className="bg-white rounded-[24px] p-6 flex flex-col items-center text-center shadow-[0px_10px_30px_rgba(0,0,0,0.06)]">
              <div className="relative mb-4">
                <div className="w-24 h-24 rounded-full bg-[#e2dfff] flex items-center justify-center border-4 border-white shadow-md">
                  <span className="text-[28px] font-extrabold text-[#5150b1]">{initials}</span>
                </div>
                <div className="absolute bottom-0 right-0 w-7 h-7 bg-[#5150b1] rounded-full border-2 border-white flex items-center justify-center">
                  <Icon name="verified" filled className="text-[14px] text-white" />
                </div>
              </div>

              <h2 className="text-[24px] font-bold text-[#1a1c18] mb-0.5">{displayName}</h2>
              {college && <p className="text-[14px] font-semibold text-[#464552]">{college}</p>}
              {(course || year) && (
                <p className="text-[14px] font-semibold text-[#464552] mb-1">
                  {[course, year].filter(Boolean).join(" • ")}
                </p>
              )}

              {/* Level badge */}
              <div className="flex items-center gap-1.5 bg-[#e2dfff] text-[#5150b1] rounded-full px-3 py-1 mb-4 mt-1">
                <Icon name="military_tech" filled className="text-[16px]" />
                <span className="text-[13px] font-bold">Level {level} · {xp} XP</span>
              </div>

              <div className="flex flex-wrap justify-center gap-2">
                <div className="flex items-center gap-1.5 bg-[#e2dfff] text-[#5150b1] rounded-full px-3 py-1.5">
                  <Icon name="menu_book" className="text-[18px]" />
                  <span className="text-[14px] font-semibold">{stats.subjectCount} Subject{stats.subjectCount !== 1 ? "s" : ""}</span>
                </div>
                <div className="flex items-center gap-1.5 bg-[#feac66] text-[#763f00] rounded-full px-3 py-1.5">
                  <Icon name="local_fire_department" className="text-[18px]" />
                  <span className="text-[14px] font-semibold">{stats.streak} Day Streak</span>
                </div>
                {stats.avgScore > 0 && (
                  <div className="flex items-center gap-1.5 bg-[#edeee8] text-[#1a1c18] rounded-full px-3 py-1.5">
                    <Icon name="grade" className="text-[18px] text-[#006769]" />
                    <span className="text-[14px] font-semibold">{stats.avgScore}% Avg Score</span>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ── My Goals ──────────────────────────────────────────────────── */}
          {loading ? <Skeleton className="h-[100px]" /> : (
            <section className="bg-white rounded-[24px] p-6 shadow-[0px_10px_30px_rgba(0,0,0,0.06)]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[20px] font-bold text-[#1a1c18]">My Goals</h3>
                <Icon name="more_horiz" className="text-[#777683]" />
              </div>
              {goals.length === 0 ? (
                <p className="text-sm text-[#464552]">No goals set yet. Edit your profile to add goals.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {goals.map((g) => (
                    <div key={g} className="flex items-center gap-2 bg-[#5150b1] text-white rounded-full px-4 py-2">
                      <Icon name={GOAL_ICONS[g] ?? "flag"} className="text-[18px]" />
                      <span className="text-[14px] font-semibold">{g}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* ── Study Preferences ─────────────────────────────────────────── */}
          {loading ? <Skeleton className="h-[160px]" /> : (
            <section className="bg-white rounded-[24px] p-6 shadow-[0px_10px_30px_rgba(0,0,0,0.06)]">
              <h3 className="text-[20px] font-bold text-[#1a1c18] mb-2">Study Preferences</h3>
              <div className="divide-y divide-[#c7c5d4]/40">
                {[
                  { icon: "schedule",        label: "Daily Study Hours", value: studyHours   },
                  { icon: "wb_sunny",        label: "Preferred Time",    value: preferredTimes },
                  { icon: "event_available", label: "Exam Date",         value: examDate     },
                ].map((p) => (
                  <div key={p.label} className="flex justify-between items-center py-4">
                    <div className="flex items-center gap-3">
                      <Icon name={p.icon} className="text-[#5150b1]" />
                      <span className="text-[16px] font-medium text-[#1a1c18]">{p.label}</span>
                    </div>
                    <span className="text-[14px] font-semibold text-[#464552] bg-[#e2e3dc] px-3 py-1 rounded-full max-w-[140px] truncate text-right">
                      {p.value}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Settings ──────────────────────────────────────────────────── */}
          <section className="bg-white rounded-[24px] p-6 shadow-[0px_10px_30px_rgba(0,0,0,0.06)] mb-8">
            <h3 className="text-[20px] font-bold text-[#1a1c18] mb-2">Settings</h3>
            <div className="divide-y divide-[#c7c5d4]/40">
              {SETTINGS.map((s) => (
                <button
                  key={s.label}
                  onClick={s.action ?? undefined}
                  className="flex justify-between items-center py-4 w-full text-left active:opacity-60 transition-opacity"
                >
                  <div className="flex items-center gap-3">
                    <Icon name={s.icon} className={s.error ? "text-[#ba1a1a]" : "text-[#777683]"} />
                    <span className={`text-[16px] ${s.error ? "font-bold text-[#ba1a1a]" : "font-medium text-[#1a1c18]"}`}>
                      {s.label}
                    </span>
                  </div>
                  <Icon name="chevron_right" className={s.error ? "text-[#ba1a1a]" : "text-[#777683]"} />
                </button>
              ))}
            </div>
          </section>

        </div>

        {/* Bottom Nav */}
        <nav className="fixed bottom-6 left-0 right-0 mx-auto flex justify-around items-center px-4 z-50 w-[90%] max-w-[432px] h-[72px] bg-[#2f312d] rounded-full shadow-xl">
          {[
            { icon: "home",           label: "Home",     route: "/dashboard" },
            { icon: "calendar_month", label: "Schedule", route: "/schedule"  },
            { icon: "timer",          label: "Focus",    route: "/focus"     },
            { icon: "quiz",           label: "Quiz",     route: "/quiz"      },
            { icon: "person",         label: "Profile",  route: "/profile"   },
          ].map((item) => {
            const isActive = item.route === "/profile";
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

      </main>

      {/* ── Edit Profile Sheet ─────────────────────────────────────────────── */}
      {editOpen && <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]" onClick={closeEdit} />}
      <div
        className="fixed bottom-0 left-0 right-0 bg-[#f9faf3] rounded-t-[36px] z-[70] max-w-[480px] mx-auto shadow-2xl"
        style={{ transform: editOpen ? "translateY(0)" : "translateY(100%)", transition: "transform 0.4s cubic-bezier(0.32,0.72,0,1)" }}
      >
        <div className="p-6 pb-10">
          <div className="w-10 h-1.5 bg-[#c7c5d4] rounded-full mx-auto mb-5" />
          <h2 className="font-bold text-xl text-[#1a1c18] mb-5">Edit Profile</h2>
          <div className="space-y-4">

            {[
              { label: "Full Name",           value: editName,    setter: setEditName,    placeholder: "Your name",              type: "text" },
              { label: "College / University", value: editCollege, setter: setEditCollege, placeholder: "e.g. Delhi University",   type: "text" },
              { label: "Course / Degree",      value: editCourse,  setter: setEditCourse,  placeholder: "e.g. B.Sc Physics",       type: "text" },
            ].map(({ label, value, setter, placeholder, type }) => (
              <div key={label} className="space-y-1.5">
                <label className="text-xs font-semibold text-[#464552] px-1">{label}</label>
                <input
                  type={type} value={value} onChange={(e) => setter(e.target.value)} placeholder={placeholder}
                  className="w-full h-12 bg-[#f3f4ed] rounded-2xl px-4 text-sm font-medium text-[#1a1c18] ring-1 ring-[#c7c5d4] focus:ring-2 focus:ring-[#5150b1] outline-none transition-all"
                />
              </div>
            ))}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#464552] px-1">Current Year</label>
              <select
                value={editYear} onChange={(e) => setEditYear(e.target.value)}
                className="w-full h-12 bg-[#f3f4ed] rounded-2xl px-4 text-sm font-medium text-[#1a1c18] ring-1 ring-[#c7c5d4] focus:ring-2 focus:ring-[#5150b1] outline-none appearance-none cursor-pointer"
              >
                <option value="">Select year</option>
                {["1st Year", "2nd Year", "3rd Year", "4th Year"].map((y) => <option key={y}>{y}</option>)}
              </select>
            </div>

            {saveError && (
              <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex items-center gap-2">
                <Icon name="error" filled className="text-red-500 text-[18px]" />
                <p className="text-[13px] text-red-600 font-medium">{saveError}</p>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button onClick={closeEdit} className="flex-1 py-3.5 rounded-full border border-[#c7c5d4] text-[#464552] text-sm font-bold active:scale-95 transition-transform">
                Cancel
              </button>
              <button
                onClick={saveProfile}
                disabled={saving}
                className="flex-1 py-3.5 rounded-full bg-[#5150b1] text-white text-sm font-bold shadow-lg active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}