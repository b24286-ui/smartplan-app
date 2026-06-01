import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { subjectsAPI } from "../services/api";

const Icon = ({ name, filled = false, className = "" }) => (
  <span
    className={`material-symbols-outlined ${className}`}
    style={{ fontVariationSettings: filled ? "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" : "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
  >
    {name}
  </span>
);

const ICON_POOL  = ["functions", "bolt", "biotech", "translate", "history_edu", "eco", "computer", "language", "psychology", "calculate"];
const COLOR_POOL = [
  { bg: "bg-[#5150b1]/10", text: "text-[#5150b1]", progress: "#5150b1" },
  { bg: "bg-[#006769]/10", text: "text-[#006769]", progress: "#006769" },
  { bg: "bg-[#8d4f0e]/10", text: "text-[#8d4f0e]", progress: "#8d4f0e" },
  { bg: "bg-[#ffdad6]/40", text: "text-[#ba1a1a]", progress: "#ba1a1a" },
  { bg: "bg-[#e2dfff]",    text: "text-[#5150b1]", progress: "#5150b1" },
  { bg: "bg-[#81d4d6]/30", text: "text-[#268083]", progress: "#268083" },
];
const DIFF_BADGE = {
  Easy:   "bg-[#9ef1f2] text-[#004f51]",
  Medium: "bg-[#ffdcc2] text-[#6d3900]",
  Hard:   "bg-[#ffdad6] text-[#93000a]",
};
const PRI_BADGE = {
  Low:    "bg-[#edeee8] text-[#464552]",
  Medium: "bg-[#ffdcc2] text-[#6d3900]",
  High:   "bg-[#6a69cc] text-white",
};

// ── Normalize API response to a consistent shape ──────────────────────────────
function normalizeSubject(s, idx = 0) {
  return {
    _id:        s._id ?? s.id ?? String(idx),
    name:       s.name ?? "Untitled",
    topics:     Array.isArray(s.topics) ? s.topics.length : (s.topicCount ?? s.topics ?? 0),
    icon:       s.icon       ?? ICON_POOL[idx % ICON_POOL.length],
    colorIdx:   s.colorIdx   ?? idx % COLOR_POOL.length,
    difficulty: s.difficulty ?? "Medium",
    priority:   s.priority   ?? "Medium",
    progress:   s.progress   ?? 0,
    examDate:   s.examDate   ?? null,
  };
}

// ── Skeleton block ─────────────────────────────────────────────────────────────
function Skeleton({ className = "" }) {
  return <div className={`animate-pulse bg-[#e2e3dc] rounded-[28px] ${className}`} />;
}

// ── Subject Card ──────────────────────────────────────────────────────────────
function SubjectCard({ subject, onClick, onDelete }) {
  const color = COLOR_POOL[subject.colorIdx % COLOR_POOL.length];
  return (
    <div
      onClick={() => onClick(subject)}
      className="bg-white rounded-[28px] p-5 shadow-sm border border-[#c7c5d4]/20 active:scale-[0.97] transition-transform cursor-pointer"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className={`w-12 h-12 ${color.bg} rounded-2xl flex items-center justify-center flex-shrink-0`}>
            <Icon name={subject.icon} filled className={`${color.text} text-[24px]`} />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-base text-[#1a1c18] truncate">{subject.name}</h3>
            <p className="text-xs text-[#464552] mt-0.5">{subject.topics} {subject.topics === 1 ? "Topic" : "Topics"}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0 ml-2">
          <span className={`${DIFF_BADGE[subject.difficulty] ?? DIFF_BADGE.Medium} px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase`}>
            {subject.difficulty}
          </span>
          <span className={`${PRI_BADGE[subject.priority] ?? PRI_BADGE.Medium} px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase`}>
            {subject.priority}
          </span>
        </div>
      </div>
      <div className="space-y-1.5">
        <div className="flex justify-between items-center">
          <span className="text-xs text-[#464552] font-medium">Progress</span>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold" style={{ color: color.progress }}>{subject.progress}%</span>
            {/* Delete button */}
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(subject); }}
              className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-red-50 transition-colors"
            >
              <Icon name="delete_outline" className="text-[#c7c5d4] hover:text-[#ba1a1a] text-[16px]" />
            </button>
          </div>
        </div>
        <div className="h-[10px] bg-[#e8e9e2] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${subject.progress}%`, backgroundColor: color.progress }}
          />
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function SubjectsPage() {
  const navigate = useNavigate();

  const [subjects,   setSubjects]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState("");
  const [sheetOpen,  setSheetOpen]  = useState(false);

  // Add form state
  const [newName, setNewName] = useState("");
  const [newDiff, setNewDiff] = useState("Medium");
  const [newPri,  setNewPri]  = useState("Medium");
  const [newDate, setNewDate] = useState("");

  // ── Fetch subjects ─────────────────────────────────────────────────────────
  const fetchSubjects = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await subjectsAPI.getAll();
      const data = Array.isArray(res.data) ? res.data : res.data?.subjects ?? [];
      setSubjects(data.map(normalizeSubject));
    } catch (err) {
      setError("Failed to load subjects.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSubjects(); }, [fetchSubjects]);

  // ── Sheet helpers ──────────────────────────────────────────────────────────
  const openSheet = () => {
    setNewName(""); setNewDiff("Medium"); setNewPri("Medium"); setNewDate("");
    setSheetOpen(true);
    document.body.style.overflow = "hidden";
  };
  const closeSheet = () => {
    setSheetOpen(false);
    document.body.style.overflow = "";
  };

  // ── Save subject (API) ─────────────────────────────────────────────────────
  const saveSubject = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    const iconIdx  = Math.floor(Math.random() * ICON_POOL.length);
    const colorIdx = Math.floor(Math.random() * COLOR_POOL.length);
    const payload  = {
      name:       newName.trim(),
      icon:       ICON_POOL[iconIdx],
      colorIdx,
      difficulty: newDiff,
      priority:   newPri,
      examDate:   newDate || null,
    };
    try {
      const res     = await subjectsAPI.create(payload);
      const created = res.data?.subject ?? res.data;
      setSubjects((prev) => [...prev, normalizeSubject({ ...payload, ...created }, prev.length)]);
      closeSheet();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save subject.");
    } finally {
      setSaving(false);
    }
  };

  // ── Delete subject (optimistic) ────────────────────────────────────────────
  const deleteSubject = async (subject) => {
    if (!window.confirm(`Remove "${subject.name}"?`)) return;
    setSubjects((prev) => prev.filter((s) => s._id !== subject._id));
    try {
      await subjectsAPI.remove(subject._id);
    } catch {
      // Revert on error
      setSubjects((prev) => [...prev, subject].sort((a, b) => a.name.localeCompare(b.name)));
    }
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const completed  = subjects.filter((s) => s.progress === 100).length;
  const inProgress = subjects.filter((s) => s.progress > 0 && s.progress < 100).length;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="bg-[#f9faf3] text-[#1a1c18] min-h-screen pb-28">

      {/* Top App Bar */}
      <header className="w-full sticky top-0 z-40 bg-[#f9faf3]/90 backdrop-blur-md border-b border-[#c7c5d4]/20">
        <div className="flex items-center justify-between px-5 py-4 w-full max-w-[480px] mx-auto">
          <button onClick={() => navigate("/dashboard")} className="w-10 h-10 flex items-center justify-center rounded-full bg-[#e8e9e2] active:scale-90 transition-transform">
            <Icon name="arrow_back" className="text-[#1a1c18]" />
          </button>
          <h1 className="font-bold text-lg text-[#1a1c18]">My Subjects</h1>
          <button onClick={openSheet} className="w-10 h-10 flex items-center justify-center rounded-full bg-[#5150b1] text-white active:scale-95 transition-transform shadow-lg">
            <Icon name="add" filled className="text-[22px]" />
          </button>
        </div>
      </header>

      <main className="max-w-[480px] mx-auto px-5 pt-4 space-y-5">

        {/* Error Banner */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex items-center gap-2">
            <Icon name="error" filled className="text-red-500 text-[18px]" />
            <p className="text-[13px] text-red-600 font-medium flex-1">{error}</p>
            <button onClick={() => setError("")}><Icon name="close" className="text-red-400 text-[16px]" /></button>
          </div>
        )}

        {/* Summary Strip */}
        <div className="flex gap-2 overflow-x-auto pb-1" style={{ msOverflowStyle: "none", scrollbarWidth: "none" }}>
          <div className="flex-shrink-0 bg-[#5150b1]/10 px-4 py-2.5 rounded-full flex items-center gap-2">
            <span>📚</span>
            <span className="font-semibold text-sm text-[#5150b1]">{subjects.length} Subjects</span>
          </div>
          <div className="flex-shrink-0 bg-[#006769]/10 px-4 py-2.5 rounded-full flex items-center gap-2">
            <span>✅</span>
            <span className="font-semibold text-sm text-[#006769]">{completed} Completed</span>
          </div>
          <div className="flex-shrink-0 bg-[#8d4f0e]/10 px-4 py-2.5 rounded-full flex items-center gap-2">
            <span>⏳</span>
            <span className="font-semibold text-sm text-[#8d4f0e]">{inProgress} In Progress</span>
          </div>
        </div>

        {/* Subject Cards */}
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-[140px]" />
            <Skeleton className="h-[140px]" />
            <Skeleton className="h-[140px]" />
          </div>
        ) : subjects.length === 0 ? (
          <div className="text-center py-20 space-y-4">
            <div className="text-6xl">📚</div>
            <h3 className="font-bold text-lg text-[#1a1c18]">No subjects yet</h3>
            <p className="text-sm text-[#464552]">Tap + to add your first subject</p>
            <button onClick={openSheet} className="mt-2 px-6 py-3 bg-[#5150b1] text-white rounded-full font-bold text-sm active:scale-95 transition-transform">
              Add Subject
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {subjects.map((s) => (
              <SubjectCard
                key={s._id}
                subject={s}
                onClick={() => navigate(`/topics/${s._id}`)}
                onDelete={deleteSubject}
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
        ].map((item) => (
          <button
            key={item.route}
            onClick={() => navigate(item.route)}
            className="flex flex-col items-center gap-0.5 text-[#e2e3dc] active:scale-90 px-3 py-1.5"
          >
            <Icon name={item.icon} className="text-[20px]" />
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Backdrop */}
      {sheetOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]" onClick={closeSheet} />
      )}

      {/* Add Subject Bottom Sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 bg-[#f9faf3] rounded-t-[36px] z-[70] p-6 max-w-[480px] mx-auto shadow-2xl"
        style={{ transform: sheetOpen ? "translateY(0)" : "translateY(100%)", transition: "transform 0.4s cubic-bezier(0.32, 0.72, 0, 1)" }}
      >
        <div className="w-10 h-1.5 bg-[#c7c5d4] rounded-full mx-auto mb-6" />
        <h2 className="font-bold text-xl text-[#1a1c18] mb-5">Add Subject</h2>
        <div className="space-y-5">

          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#464552] px-1">Subject Name</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveSubject()}
              placeholder="e.g. Computer Science"
              className="w-full h-12 bg-[#f3f4ed] rounded-2xl px-4 text-sm font-medium text-[#1a1c18] ring-1 ring-[#c7c5d4] focus:ring-2 focus:ring-[#5150b1] outline-none transition-all"
            />
          </div>

          {/* Difficulty */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[#464552] px-1">Difficulty</label>
            <div className="flex gap-2">
              {["Easy", "Medium", "Hard"].map((d) => (
                <button key={d} onClick={() => setNewDiff(d)} className={`flex-1 py-2.5 rounded-full text-sm font-bold transition-all ${newDiff === d ? "bg-[#5150b1] text-white" : "bg-[#e8e9e2] text-[#464552]"}`}>{d}</button>
              ))}
            </div>
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[#464552] px-1">Priority</label>
            <div className="flex gap-2">
              {["Low", "Medium", "High"].map((p) => (
                <button key={p} onClick={() => setNewPri(p)} className={`flex-1 py-2.5 rounded-full text-sm font-bold transition-all ${newPri === p ? "bg-[#5150b1] text-white" : "bg-[#e8e9e2] text-[#464552]"}`}>{p}</button>
              ))}
            </div>
          </div>

          {/* Exam Date */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#464552] px-1">Exam Date <span className="text-[#c7c5d4] font-normal">(optional)</span></label>
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="w-full h-12 bg-[#f3f4ed] rounded-2xl px-4 text-sm font-medium text-[#1a1c18] ring-1 ring-[#c7c5d4] focus:ring-2 focus:ring-[#5150b1] outline-none transition-all"
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button onClick={closeSheet} className="flex-1 py-3.5 rounded-full border border-[#c7c5d4] text-[#464552] text-sm font-bold active:scale-95 transition-transform">
              Cancel
            </button>
            <button
              onClick={saveSubject}
              disabled={saving || !newName.trim()}
              className="flex-1 py-3.5 rounded-full bg-[#5150b1] text-white text-sm font-bold shadow-lg active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
              {saving ? "Saving…" : "Save Subject"}
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}