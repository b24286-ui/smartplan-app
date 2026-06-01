import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { subjectsAPI, topicsAPI } from "../services/api";

const Icon = ({ name, filled = false, className = "" }) => (
  <span
    className={`material-symbols-outlined ${className}`}
    style={{ fontVariationSettings: filled ? "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" : "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
  >
    {name}
  </span>
);

// ── Config ────────────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  "completed":      { label: "Completed",      icon: "check_circle",           filled: true,  iconColor: "text-[#006769]", iconBg: "bg-[#9ef1f2]", chipBg: "bg-[#006769]/10", chipText: "text-[#006769]" },
  "in-progress":    { label: "In Progress",    icon: "play_circle",            filled: true,  iconColor: "text-[#5150b1]", iconBg: "bg-[#e2dfff]", chipBg: "bg-[#5150b1]/10", chipText: "text-[#5150b1]" },
  "not-started":    { label: "Not Started",    icon: "radio_button_unchecked", filled: false, iconColor: "text-[#464552]", iconBg: "bg-[#e8e9e2]", chipBg: "bg-[#e2e3dc]",    chipText: "text-[#464552]" },
  "weak":           { label: "Weak",           icon: "warning",                filled: true,  iconColor: "text-[#ba1a1a]", iconBg: "bg-[#ffdad6]", chipBg: "bg-[#ba1a1a]/10", chipText: "text-[#ba1a1a]" },
  "needs-revision": { label: "Needs Revision", icon: "history",                filled: true,  iconColor: "text-[#8d4f0e]", iconBg: "bg-[#ffdcc2]", chipBg: "bg-[#8d4f0e]/10", chipText: "text-[#8d4f0e]" },
};

const FILTERS = ["all", "not-started", "in-progress", "completed", "weak", "needs-revision"];
const FILTER_LABELS = { "all": "All", "not-started": "Not Started", "in-progress": "In Progress", "completed": "Completed", "weak": "Weak", "needs-revision": "Needs Revision" };

// colorIdx → static Tailwind class sets (must be full strings for JIT)
const SUBJECT_COLORS = [
  { card: "bg-[#5150b1]/10 border-[#5150b1]/10", text: "text-[#5150b1]", bar: "bg-[#5150b1]", blob: "bg-[#5150b1]/10" },
  { card: "bg-[#006769]/10 border-[#006769]/10", text: "text-[#006769]", bar: "bg-[#006769]", blob: "bg-[#006769]/10" },
  { card: "bg-[#8d4f0e]/10 border-[#8d4f0e]/10", text: "text-[#8d4f0e]", bar: "bg-[#8d4f0e]", blob: "bg-[#8d4f0e]/10" },
  { card: "bg-[#ba1a1a]/10 border-[#ba1a1a]/10", text: "text-[#ba1a1a]", bar: "bg-[#ba1a1a]", blob: "bg-[#ba1a1a]/10" },
  { card: "bg-[#e2dfff]    border-[#5150b1]/10", text: "text-[#5150b1]", bar: "bg-[#5150b1]", blob: "bg-[#5150b1]/10" },
  { card: "bg-[#81d4d6]/30 border-[#268083]/10", text: "text-[#268083]", bar: "bg-[#268083]", blob: "bg-[#268083]/10" },
];

const DIFF_BADGE = {
  Easy:   "bg-[#9ef1f2] text-[#004f51]",
  Medium: "bg-[#ffdcc2] text-[#6d3900]",
  Hard:   "bg-[#ffdad6] text-[#93000a]",
};

// ── Data normalizer ───────────────────────────────────────────────────────────
function normalizeTopic(t, idx = 0) {
  const estTime = t.estimatedTime ?? parseInt(t.time) ?? 1;
  return {
    _id:           t._id ?? t.id ?? String(idx),
    name:          t.name      ?? "Untitled",
    time:          `${estTime} hrs`,
    estimatedTime: estTime,
    status:        t.status    ?? "not-started",
    notes:         t.notes     ?? "",
    difficulty:    t.difficulty ?? "Medium",
  };
}

// ── Skeleton block ────────────────────────────────────────────────────────────
function Skeleton({ className = "" }) {
  return <div className={`animate-pulse bg-[#e2e3dc] rounded-[24px] ${className}`} />;
}

// ── Topic Card ────────────────────────────────────────────────────────────────
function TopicCard({ topic, isExpanded, onToggle, onStatusChange, onNotesChange, onDelete }) {
  const s = STATUS_CONFIG[topic.status] ?? STATUS_CONFIG["not-started"];
  return (
    <div className="bg-white rounded-[24px] border border-[#c7c5d4]/20 shadow-sm overflow-hidden">
      <div className="p-4 flex items-center gap-3 cursor-pointer" onClick={onToggle}>
        <div className={`w-11 h-11 rounded-full ${s.iconBg} flex items-center justify-center flex-shrink-0`}>
          <Icon name={s.icon} filled={s.filled} className={`${s.iconColor} text-[20px]`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm text-[#1a1c18] truncate">{topic.name}</p>
          <p className="text-xs text-[#464552] mt-0.5">{topic.time}</p>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold flex-shrink-0 ${s.chipBg} ${s.chipText}`}>{s.label}</span>
        <Icon name="expand_more" className={`text-[#464552] text-[20px] transition-transform ${isExpanded ? "rotate-180" : ""}`} />
      </div>

      {isExpanded && (
        <div className="px-4 pb-4 border-t border-[#c7c5d4]/20 pt-3 space-y-3">
          {/* Notes */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#464552] mb-1">Notes</p>
            <textarea
              rows={2}
              value={topic.notes}
              onChange={(e) => onNotesChange(e.target.value)}
              placeholder="Add notes…"
              className="w-full bg-[#f3f4ed] rounded-xl px-3 py-2 text-xs text-[#1a1c18] ring-1 ring-[#c7c5d4] focus:ring-2 focus:ring-[#5150b1] resize-none outline-none transition-all"
            />
          </div>
          {/* Status buttons */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#464552] mb-2">Mark As</p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(STATUS_CONFIG).map(([key, val]) => (
                <button
                  key={key}
                  onClick={(e) => { e.stopPropagation(); onStatusChange(key); }}
                  className={`px-3 py-1 rounded-full text-[10px] font-bold border transition-all ${
                    topic.status === key
                      ? "bg-[#5150b1] text-white border-transparent"
                      : "bg-[#edeee8] text-[#464552] border-[#c7c5d4]/30"
                  }`}
                >
                  {val.label}
                </button>
              ))}
            </div>
          </div>
          {/* Delete */}
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="flex items-center gap-1 text-[#ba1a1a] text-xs font-semibold pt-1 hover:opacity-80 transition-opacity"
          >
            <Icon name="delete_outline" className="text-[16px]" />
            Remove topic
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function TopicsPage() {
  const navigate            = useNavigate();
  const { subjectId }       = useParams();               // ← from /topics/:subjectId
  const notesTimers         = useRef({});                // ← for debounced notes save

  const [subject,    setSubject]    = useState(null);
  const [topics,     setTopics]     = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState("");
  const [filter,     setFilter]     = useState("all");
  const [expandedId, setExpandedId] = useState(null);
  const [sheetOpen,  setSheetOpen]  = useState(false);

  // Sheet form state
  const [newName,   setNewName]   = useState("");
  const [newTime,   setNewTime]   = useState("");
  const [newDiff,   setNewDiff]   = useState("Medium");
  const [newStatus, setNewStatus] = useState("not-started");
  const [newNotes,  setNewNotes]  = useState("");

  // ── Fetch subject + topics ─────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    if (!subjectId) return;
    setLoading(true);
    const [subjectRes, topicsRes] = await Promise.allSettled([
      subjectsAPI.getOne(subjectId),
      topicsAPI.getBySubject(subjectId),
    ]);
    if (subjectRes.status === "fulfilled") {
      setSubject(subjectRes.value.data?.subject ?? subjectRes.value.data);
    }
    if (topicsRes.status === "fulfilled") {
      const data = topicsRes.value.data;
      const arr  = Array.isArray(data) ? data : data?.topics ?? [];
      setTopics(arr.map(normalizeTopic));
    } else {
      setError("Failed to load topics.");
    }
    setLoading(false);
  }, [subjectId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Sheet helpers ──────────────────────────────────────────────────────────
  const openSheet = () => {
    setNewName(""); setNewTime(""); setNewDiff("Medium"); setNewStatus("not-started"); setNewNotes("");
    setSheetOpen(true);
    document.body.style.overflow = "hidden";
  };
  const closeSheet = () => { setSheetOpen(false); document.body.style.overflow = ""; };

  // ── Create topic ───────────────────────────────────────────────────────────
  const saveTopic = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    const payload = {
      name:          newName.trim(),
      subject:       subjectId,
      estimatedTime: newTime ? Number(newTime) : 1,
      difficulty:    newDiff,
      status:        newStatus,
      notes:         newNotes,
    };
    try {
      const res     = await topicsAPI.create(payload);
      const created = res.data?.topic ?? res.data;
      setTopics((prev) => [...prev, normalizeTopic({ ...payload, ...created }, prev.length)]);
      setFilter("all");
      closeSheet();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save topic.");
    } finally {
      setSaving(false);
    }
  };

  // ── Optimistic status change + API ────────────────────────────────────────
  const changeStatus = async (id, newSt) => {
    const original = topics.find((t) => t._id === id)?.status;
    setTopics((prev) => prev.map((t) => t._id === id ? { ...t, status: newSt } : t));
    try {
      await topicsAPI.update(id, { status: newSt });
    } catch {
      setTopics((prev) => prev.map((t) => t._id === id ? { ...t, status: original } : t));
    }
  };

  // ── Debounced notes save (800 ms) ──────────────────────────────────────────
  const changeNotes = (id, notes) => {
    setTopics((prev) => prev.map((t) => t._id === id ? { ...t, notes } : t));
    clearTimeout(notesTimers.current[id]);
    notesTimers.current[id] = setTimeout(async () => {
      try { await topicsAPI.update(id, { notes }); }
      catch { /* silent — user's text is still in local state */ }
    }, 800);
  };

  // ── Optimistic delete ──────────────────────────────────────────────────────
  const deleteTopic = async (topic) => {
    if (!window.confirm(`Remove "${topic.name}"?`)) return;
    setTopics((prev) => prev.filter((t) => t._id !== topic._id));
    setExpandedId(null);
    try { await topicsAPI.remove(topic._id); }
    catch { setTopics((prev) => [...prev, topic]); }
  };

  const toggleExpand = (id) => setExpandedId((prev) => (prev === id ? null : id));

  // ── Derived ────────────────────────────────────────────────────────────────
  const filtered  = filter === "all" ? topics : topics.filter((t) => t.status === filter);
  const completed = topics.filter((t) => t.status === "completed").length;
  const progress  = topics.length > 0 ? Math.round((completed / topics.length) * 100) : 0;

  const subjectName   = subject?.name       ?? "Subject";
  const subjectDiff   = subject?.difficulty ?? "Medium";
  const colorIdx      = subject?.colorIdx   ?? 0;
  const color         = SUBJECT_COLORS[colorIdx % SUBJECT_COLORS.length];
  const examDate      = subject?.examDate
    ? new Date(subject.examDate).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })
    : null;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="bg-[#f9faf3] text-[#1a1c18] min-h-screen pb-28">

      {/* Top Bar */}
      <header className="sticky top-0 z-40 bg-[#f9faf3]/90 backdrop-blur-md border-b border-[#c7c5d4]/20">
        <div className="max-w-[480px] mx-auto flex items-center justify-between px-5 py-4">
          <button onClick={() => navigate("/subjects")} className="w-10 h-10 flex items-center justify-center rounded-full bg-[#e8e9e2] active:scale-90 transition-transform">
            <Icon name="arrow_back" className="text-[#1a1c18]" />
          </button>
          <h1 className="font-bold text-lg text-[#1a1c18] truncate max-w-[180px]">{subjectName}</h1>
          <button onClick={openSheet} className="w-10 h-10 flex items-center justify-center rounded-full bg-[#5150b1] text-white active:scale-95 transition-transform shadow-lg">
            <Icon name="add" filled className="text-[22px]" />
          </button>
        </div>
      </header>

      <main className="max-w-[480px] mx-auto px-5 pt-4 space-y-4">

        {/* Error banner */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex items-center gap-2">
            <Icon name="error" filled className="text-red-500 text-[18px]" />
            <p className="text-[13px] text-red-600 font-medium flex-1">{error}</p>
            <button onClick={() => setError("")}><Icon name="close" className="text-red-400 text-[16px]" /></button>
          </div>
        )}

        {/* Subject Summary Card */}
        {loading ? (
          <Skeleton className="h-[160px]" />
        ) : (
          <div className={`rounded-[28px] p-5 border relative overflow-hidden ${color.card}`}>
            <div className={`absolute -top-8 -right-8 w-28 h-28 ${color.blob} rounded-full blur-2xl pointer-events-none`} />
            <div className="flex justify-between items-start mb-4">
              <div>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${color.text} bg-white/40 px-3 py-1 rounded-full`}>Subject</span>
                <h2 className={`font-extrabold text-xl ${color.text} mt-1`}>{subjectName}</h2>
              </div>
              <span className={`${DIFF_BADGE[subjectDiff] ?? DIFF_BADGE.Medium} text-[11px] font-bold px-3 py-1 rounded-full`}>{subjectDiff}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <p className="text-xs text-[#464552] opacity-70">Total Topics</p>
                <p className="font-bold text-xl text-[#1a1c18]">{topics.length}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-[#464552] opacity-70">Next Exam</p>
                <p className="font-bold text-sm text-[#1a1c18]">{examDate ?? "Not set"}</p>
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-bold">
                <span className={color.text}>Overall Progress</span>
                <span className={color.text}>{progress}%</span>
              </div>
              <div className="h-2.5 bg-white/50 rounded-full overflow-hidden">
                <div className={`h-full ${color.bar} rounded-full transition-all duration-700`} style={{ width: `${progress}%` }} />
              </div>
              <div className="flex justify-between text-xs text-[#464552] mt-1">
                <span>Completed: <strong className="text-[#1a1c18]">{completed}</strong></span>
                <span>Remaining: <strong className="text-[#1a1c18]">{topics.length - completed}</strong></span>
              </div>
            </div>
          </div>
        )}

        {/* Filter Chips */}
        <div className="flex gap-2 overflow-x-auto pb-1" style={{ msOverflowStyle: "none", scrollbarWidth: "none" }}>
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => { setFilter(f); setExpandedId(null); }}
              className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-bold border transition-all ${
                filter === f ? "bg-[#5150b1] text-white border-transparent" : "bg-[#e8e9e2] text-[#464552] border-transparent"
              }`}
            >
              {FILTER_LABELS[f]}
            </button>
          ))}
        </div>

        {/* Topics List */}
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-[68px]" />
            <Skeleton className="h-[68px]" />
            <Skeleton className="h-[68px]" />
            <Skeleton className="h-[68px]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <div className="text-5xl">{topics.length === 0 ? "📚" : "📭"}</div>
            <p className="font-bold text-base text-[#1a1c18]">{topics.length === 0 ? "No topics yet" : "No topics here"}</p>
            <p className="text-sm text-[#464552]">{topics.length === 0 ? "Tap + to add your first topic" : "Try a different filter"}</p>
            {topics.length === 0 && (
              <button onClick={openSheet} className="mt-2 px-6 py-3 bg-[#5150b1] text-white rounded-full font-bold text-sm active:scale-95 transition-transform">
                Add Topic
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((t) => (
              <TopicCard
                key={t._id}
                topic={t}
                isExpanded={expandedId === t._id}
                onToggle={() => toggleExpand(t._id)}
                onStatusChange={(s) => changeStatus(t._id, s)}
                onNotesChange={(n) => changeNotes(t._id, n)}
                onDelete={() => deleteTopic(t)}
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
          <button key={item.route} onClick={() => navigate(item.route)} className="flex flex-col items-center gap-0.5 text-[#e2e3dc] active:scale-90 px-3 py-1.5">
            <Icon name={item.icon} className="text-[20px]" />
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Backdrop */}
      {sheetOpen && <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]" onClick={closeSheet} />}

      {/* Add Topic Sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 bg-[#f9faf3] rounded-t-[36px] z-[70] p-6 max-w-[480px] mx-auto shadow-2xl"
        style={{ transform: sheetOpen ? "translateY(0)" : "translateY(100%)", transition: "transform 0.4s cubic-bezier(0.32,0.72,0,1)" }}
      >
        <div className="w-10 h-1.5 bg-[#c7c5d4] rounded-full mx-auto mb-5" />
        <h2 className="font-bold text-xl text-[#1a1c18] mb-5">Add Topic</h2>
        <div className="space-y-4">

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#464552] px-1">Topic Name</label>
            <input
              type="text" value={newName} onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveTopic()}
              placeholder="e.g. Differential Equations"
              className="w-full h-12 bg-[#f3f4ed] rounded-2xl px-4 text-sm font-medium text-[#1a1c18] ring-1 ring-[#c7c5d4] focus:ring-2 focus:ring-[#5150b1] outline-none transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#464552] px-1">Estimated Time</label>
            <div className="relative">
              <input
                type="number" value={newTime} onChange={(e) => setNewTime(e.target.value)}
                placeholder="e.g. 3" min="1" max="20"
                className="w-full h-12 bg-[#f3f4ed] rounded-2xl px-4 pr-16 text-sm font-medium text-[#1a1c18] ring-1 ring-[#c7c5d4] focus:ring-2 focus:ring-[#5150b1] outline-none transition-all"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-[#464552]">HRS</span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-[#464552] px-1">Difficulty</label>
            <div className="flex gap-2">
              {["Easy", "Medium", "Hard"].map((d) => (
                <button key={d} onClick={() => setNewDiff(d)}
                  className={`flex-1 py-2.5 rounded-full text-xs font-bold transition-all ${newDiff === d ? "bg-[#5150b1] text-white" : "bg-[#e8e9e2] text-[#464552]"}`}>
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-[#464552] px-1">Initial Status</label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(STATUS_CONFIG).map(([key, val]) => (
                <button key={key} onClick={() => setNewStatus(key)}
                  className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${newStatus === key ? "bg-[#5150b1] text-white" : "bg-[#e8e9e2] text-[#464552]"}`}>
                  {val.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#464552] px-1">Notes <span className="text-[#c7c5d4] font-normal">(optional)</span></label>
            <textarea rows={2} value={newNotes} onChange={(e) => setNewNotes(e.target.value)}
              placeholder="Key concepts to focus on…"
              className="w-full bg-[#f3f4ed] rounded-2xl px-4 py-3 text-sm font-medium text-[#1a1c18] ring-1 ring-[#c7c5d4] focus:ring-2 focus:ring-[#5150b1] resize-none outline-none transition-all"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button onClick={closeSheet} className="flex-1 py-3.5 rounded-full border border-[#c7c5d4] text-[#464552] text-sm font-bold active:scale-95 transition-transform">Cancel</button>
            <button onClick={saveTopic} disabled={saving || !newName.trim()}
              className="flex-1 py-3.5 rounded-full bg-[#5150b1] text-white text-sm font-bold shadow-lg active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-2">
              {saving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {saving ? "Saving…" : "Save Topic"}
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}