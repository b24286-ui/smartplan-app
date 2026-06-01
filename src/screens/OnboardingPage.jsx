import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { profileAPI, subjectsAPI } from "../services/api";

const Icon = ({ name, filled = false, className = "" }) => (
  <span
    className={`material-symbols-outlined ${className}`}
    style={{ fontVariationSettings: filled ? "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" : "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
  >
    {name}
  </span>
);

const SUBJECT_ICONS = ["book", "science", "calculate", "history_edu", "language", "psychology", "biotech", "computer"];
const SUBJECT_COLORS = [
  { text: "text-[#5150b1]", bg: "bg-[#5150b1]/10" },
  { text: "text-[#006769]", bg: "bg-[#006769]/10" },
  { text: "text-[#8d4f0e]", bg: "bg-[#8d4f0e]/10" },
  { text: "text-[#ba1a1a]", bg: "bg-[#ba1a1a]/10" },
];

const GOALS = [
  { icon: "trending_up",    label: "Score above 80%",       color: "text-[#5150b1]" },
  { icon: "menu_book",      label: "Complete full syllabus", color: "text-[#8d4f0e]" },
  { icon: "schedule",       label: "Build study habit",      color: "text-[#006769]" },
  { icon: "emoji_events",   label: "Crack competitive exam", color: "text-[#ba1a1a]" },
  { icon: "construction",   label: "Improve weak subjects",  color: "text-[#5150b1]" },
  { icon: "replay",         label: "Consistent revision",    color: "text-[#8d4f0e]" },
];

const TIME_SLOTS = [
  { icon: "light_mode",   label: "Morning"   },
  { icon: "sunny",        label: "Afternoon" },
  { icon: "wb_twilight",  label: "Evening"   },
  { icon: "dark_mode",    label: "Night"     },
];

const DEFAULT_SUBJECTS = [
  { id: 1, name: "Mathematics", icon: "calculate",  colorIdx: 0, difficulty: "Hard",   priority: "High"   },
  { id: 2, name: "Physics",     icon: "science",    colorIdx: 1, difficulty: "Medium", priority: "Medium" },
  { id: 3, name: "Chemistry",   icon: "experiment", colorIdx: 2, difficulty: "Easy",   priority: "Low"    },
];

function SubjectCard({ subject, onRemove, onUpdate }) {
  return (
    <div className="bg-[#f3f4ed] rounded-3xl p-4 border border-[#c7c5d4]/20">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-10 h-10 rounded-2xl ${SUBJECT_COLORS[subject.colorIdx].bg} flex items-center justify-center shrink-0`}>
            <Icon name={subject.icon} className={`${SUBJECT_COLORS[subject.colorIdx].text} text-[20px]`} />
          </div>
          <span className="font-bold text-sm text-[#1a1c18] truncate">{subject.name}</span>
        </div>
        <button onClick={() => onRemove(subject.id)} className="text-[#464552] hover:text-[#ba1a1a] transition-colors p-1 shrink-0">
          <Icon name="close" className="text-[20px]" />
        </button>
      </div>
      <div className="flex gap-3 flex-wrap">
        {[
          { label: "Difficulty", key: "difficulty", options: ["Easy", "Medium", "Hard"] },
          { label: "Priority",   key: "priority",   options: ["Low",  "Medium", "High"] },
        ].map(({ label, key, options }) => (
          <div key={key}>
            <p className="text-[10px] text-[#464552] mb-1 font-semibold uppercase tracking-wide">{label}</p>
            <div className="flex gap-1">
              {options.map((opt) => (
                <button
                  key={opt}
                  onClick={() => onUpdate(subject.id, key, opt)}
                  className={`text-[11px] px-2.5 py-1 rounded-full border font-bold transition-all ${
                    subject[key] === opt
                      ? "bg-[#5150b1] text-white border-transparent"
                      : "border-[#c7c5d4] text-[#1a1c18]"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { register, isAuthenticated, loading } = useAuth();

  const [step, setStep] = useState(1);
  const totalSteps = 5;

  // ── Step 1 ────────────────────────────────────────────────────────────────
  const [name,     setName]     = useState("");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [college,  setCollege]  = useState("");
  const [course,   setCourse]   = useState("");
  const [year,     setYear]     = useState("");

  // ── Step 2 ────────────────────────────────────────────────────────────────
  const [selectedGoals, setSelectedGoals] = useState([]);

  // ── Step 3 ────────────────────────────────────────────────────────────────
  const [hours,    setHours]    = useState("3h");
  const [times,    setTimes]    = useState([]);
  const [examDate, setExamDate] = useState("");

  // ── Step 4 ────────────────────────────────────────────────────────────────
  const [subjects,      setSubjects]      = useState(DEFAULT_SUBJECTS);
  const [subjectInput,  setSubjectInput]  = useState("");

  // ── Step 5 submit ─────────────────────────────────────────────────────────
  const [submitting,   setSubmitting]   = useState(false);
  const [submitError,  setSubmitError]  = useState("");

  // ── If already authenticated, skip onboarding ────────────────────────────
  useEffect(() => {
    if (!loading && isAuthenticated) navigate("/dashboard", { replace: true });
  }, [isAuthenticated, loading, navigate]);

  useEffect(() => { window.scrollTo({ top: 0, behavior: "smooth" }); }, [step]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const toggleGoal = (label) =>
    setSelectedGoals((prev) => prev.includes(label) ? prev.filter((g) => g !== label) : [...prev, label]);

  const toggleTime = (label) =>
    setTimes((prev) => prev.includes(label) ? prev.filter((t) => t !== label) : [...prev, label]);

  const addSubject = () => {
    const trimmed = subjectInput.trim();
    if (!trimmed) return;
    const idx      = Math.floor(Math.random() * SUBJECT_ICONS.length);
    const colorIdx = Math.floor(Math.random() * SUBJECT_COLORS.length);
    setSubjects((prev) => [...prev, { id: Date.now(), name: trimmed, icon: SUBJECT_ICONS[idx], colorIdx, difficulty: "Medium", priority: "Medium" }]);
    setSubjectInput("");
  };

  const removeSubject = (id) => setSubjects((prev) => prev.filter((s) => s.id !== id));
  const updateSubject = (id, key, value) =>
    setSubjects((prev) => prev.map((s) => (s.id === id ? { ...s, [key]: value } : s)));

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
  };

  // ── Step 1 validation ─────────────────────────────────────────────────────
  const canProceedStep1 = name.trim() && email.trim() && password.length >= 6;

  // ── Final submit: register → profile → subjects ───────────────────────────
  const handleFinish = async () => {
    setSubmitting(true);
    setSubmitError("");
    try {
      // 1. Create account
      await register({ name: name.trim(), email: email.trim(), password });

      // 2. Save onboarding profile data (best-effort)
      try {
        await profileAPI.update({
          college,
          course,
          year,
          goals: selectedGoals,
          studyHours: hours,
          preferredTimes: times,
          examDate: examDate || null,
        });
      } catch (e) {
        console.warn("Profile save skipped:", e.message);
      }

      // 3. Create each subject (best-effort)
      for (const s of subjects) {
        try {
          await subjectsAPI.create({
            name:       s.name,
            icon:       s.icon,
            colorIdx:   s.colorIdx,
            difficulty: s.difficulty,
            priority:   s.priority,
          });
        } catch (e) {
          console.warn(`Subject "${s.name}" skipped:`, e.message);
        }
      }

      navigate("/dashboard", { replace: true });
    } catch (err) {
      setSubmitError(err.response?.data?.message || "Registration failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="bg-[#f9faf3] text-[#1a1c18] min-h-screen overflow-x-hidden pb-28">

      {/* Header */}
      <header className="bg-[#f9faf3]/90 backdrop-blur-md sticky top-0 z-50 shadow-sm border-b border-[#edeee8]">
        <div className="max-w-[480px] mx-auto px-5 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Icon name="school" filled className="text-[#5150b1] text-[22px]" />
            <span className="font-extrabold text-lg text-[#1a1c18]">SmartPlan</span>
          </div>
          <button
            onClick={() => { if (window.confirm("Exit onboarding? Your progress will not be saved.")) navigate("/"); }}
            className="text-[#464552] p-2 rounded-full hover:bg-[#e8e9e2] transition-colors"
          >
            <Icon name="close" className="text-[22px]" />
          </button>
        </div>
      </header>

      <main className="max-w-[480px] mx-auto px-5 pt-6 space-y-6">

        {/* Progress Bar */}
        <div className="flex gap-1.5">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className="h-1.5 flex-1 rounded-full transition-all duration-500"
              style={{ backgroundColor: i < step ? "#6a69cc" : "#c7c5d4" }}
            />
          ))}
        </div>

        {/* ── STEP 1: Personal Info + Account ─────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-[32px] font-extrabold text-[#1a1c18] leading-tight">Let's set up your profile 👋</h2>
              <p className="text-[#464552] text-[18px] font-medium mt-1">Create your account to get started</p>
            </div>
            <div className="bg-[#f3f4ed] p-6 rounded-3xl shadow-sm space-y-4">

              {/* Text fields: name, college, course */}
              {[
                { label: "Full Name",           value: name,    setter: setName,    placeholder: "e.g. Alex Johnson",           type: "text"  },
                { label: "College / University", value: college, setter: setCollege, placeholder: "e.g. St. Mary's University",   type: "text"  },
                { label: "Course / Degree",      value: course,  setter: setCourse,  placeholder: "e.g. B.Tech Computer Science", type: "text"  },
                { label: "Email",                value: email,   setter: setEmail,   placeholder: "you@example.com",              type: "email" },
              ].map(({ label, value, setter, placeholder, type }) => (
                <div key={label} className="flex flex-col gap-1.5">
                  <label className="text-[14px] font-semibold text-[#464552] px-1">{label}</label>
                  <input
                    type={type}
                    value={value}
                    onChange={(e) => setter(e.target.value)}
                    placeholder={placeholder}
                    className="w-full h-[52px] bg-white rounded-2xl ring-1 ring-[#c7c5d4] focus:ring-2 focus:ring-[#5150b1] px-4 text-[16px] font-medium text-[#1a1c18] outline-none transition-all"
                  />
                </div>
              ))}

              {/* Password field with visibility toggle */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[14px] font-semibold text-[#464552] px-1">Password</label>
                <div className="flex items-center bg-white rounded-2xl ring-1 ring-[#c7c5d4] focus-within:ring-2 focus-within:ring-[#5150b1] px-4 h-[52px] gap-3 transition-all">
                  <input
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min. 6 characters"
                    className="flex-1 bg-transparent text-[16px] font-medium text-[#1a1c18] placeholder:text-[#c7c5d4] outline-none"
                  />
                  <button onClick={() => setShowPass(!showPass)} className="text-[#464552]" type="button">
                    <Icon name={showPass ? "visibility_off" : "visibility"} className="text-[20px]" />
                  </button>
                </div>
                {password.length > 0 && password.length < 6 && (
                  <p className="text-[12px] text-[#ba1a1a] font-medium px-1">Password must be at least 6 characters</p>
                )}
              </div>

              {/* Year select */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[14px] font-semibold text-[#464552] px-1">Current Year</label>
                <select
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  className="w-full h-[52px] bg-white rounded-2xl ring-1 ring-[#c7c5d4] focus:ring-2 focus:ring-[#5150b1] px-4 text-[16px] font-medium text-[#1a1c18] outline-none appearance-none cursor-pointer"
                >
                  <option value="">Select your year</option>
                  {["1st Year", "2nd Year", "3rd Year", "4th Year"].map((y) => (
                    <option key={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 2: Goals ────────────────────────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-[32px] font-extrabold text-[#1a1c18] leading-tight">What are your goals? 🎯</h2>
              <p className="text-[#464552] text-[18px] font-medium mt-1">Select all that apply</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {GOALS.map(({ icon, label, color }) => (
                <div
                  key={label}
                  onClick={() => toggleGoal(label)}
                  className={`rounded-3xl p-4 text-center flex flex-col items-center justify-center gap-2 cursor-pointer transition-all border-2 ${
                    selectedGoals.includes(label)
                      ? "bg-[#6a69cc] border-[#5150b1]"
                      : "bg-[#f3f4ed] border-transparent hover:bg-[#e8e9e2]"
                  }`}
                >
                  <Icon name={icon} className={`text-[30px] ${selectedGoals.includes(label) ? "text-white" : color}`} />
                  <p className={`text-[13px] font-semibold leading-tight ${selectedGoals.includes(label) ? "text-white" : "text-[#1a1c18]"}`}>{label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── STEP 3: Study Preferences ─────────────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-[32px] font-extrabold text-[#1a1c18] leading-tight">How do you study? ⏰</h2>
              <p className="text-[#464552] text-[18px] font-medium mt-1">Set your daily study style</p>
            </div>
            <div className="bg-[#f3f4ed] p-6 rounded-3xl shadow-sm space-y-6">
              <div className="space-y-3">
                <p className="text-[14px] font-semibold text-[#1a1c18]">Daily study hours</p>
                <div className="flex flex-wrap gap-2">
                  {["1h", "2h", "3h", "4h", "5h+"].map((h) => (
                    <button
                      key={h}
                      onClick={() => setHours(h)}
                      className={`px-5 py-2 rounded-full border text-sm font-semibold transition-all ${
                        hours === h ? "bg-[#5150b1] text-white border-transparent" : "border-[#c7c5d4] text-[#1a1c18]"
                      }`}
                    >
                      {h}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-[14px] font-semibold text-[#1a1c18]">Preferred study time</p>
                <div className="flex flex-wrap gap-2">
                  {TIME_SLOTS.map(({ icon, label }) => (
                    <button
                      key={label}
                      onClick={() => toggleTime(label)}
                      className={`px-4 py-2 rounded-full border text-sm font-semibold flex items-center gap-1.5 transition-all ${
                        times.includes(label) ? "bg-[#5150b1] text-white border-transparent" : "border-[#c7c5d4] text-[#1a1c18]"
                      }`}
                    >
                      <Icon name={icon} className="text-[16px]" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-[14px] font-semibold text-[#1a1c18]">Next major exam date</p>
                <input
                  type="date"
                  value={examDate}
                  onChange={(e) => setExamDate(e.target.value)}
                  className="w-full h-[52px] bg-white rounded-2xl ring-1 ring-[#c7c5d4] focus:ring-2 focus:ring-[#5150b1] px-4 text-[16px] font-medium text-[#1a1c18] outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 4: Subjects ──────────────────────────────────────────────── */}
        {step === 4 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-[32px] font-extrabold text-[#1a1c18] leading-tight">Add your subjects 📚</h2>
              <p className="text-[#464552] text-[18px] font-medium mt-1">You can always add more later</p>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={subjectInput}
                onChange={(e) => setSubjectInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addSubject()}
                placeholder="e.g. Biology"
                className="flex-1 h-[52px] bg-white rounded-2xl ring-1 ring-[#c7c5d4] focus:ring-2 focus:ring-[#5150b1] px-4 text-[16px] font-medium text-[#1a1c18] outline-none min-w-0"
              />
              <button
                onClick={addSubject}
                className="w-[52px] h-[52px] bg-[#5150b1] text-white rounded-2xl flex items-center justify-center active:scale-95 transition-transform shrink-0"
              >
                <Icon name="add" className="text-[22px]" />
              </button>
            </div>
            <div className="space-y-3">
              {subjects.map((s) => (
                <SubjectCard key={s.id} subject={s} onRemove={removeSubject} onUpdate={updateSubject} />
              ))}
            </div>
          </div>
        )}

        {/* ── STEP 5: All Set ───────────────────────────────────────────────── */}
        {step === 5 && (
          <div className="space-y-6">
            <div className="text-center pt-2">
              <div className="w-32 h-32 mx-auto mb-4 rounded-3xl bg-[#e2dfff] flex items-center justify-center text-5xl shadow-sm">🎉</div>
              <h2 className="text-[32px] font-extrabold text-[#1a1c18] leading-tight">
                You're all set, {name || "there"}!
              </h2>
              <p className="text-[#464552] text-[18px] font-medium mt-1">Your personalized study plan is ready</p>
            </div>

            {/* Plan summary */}
            <div className="bg-[#e2dfff]/40 rounded-3xl p-5 border border-[#5150b1]/10 space-y-3">
              <p className="font-bold text-sm text-[#3b399a] mb-1">Plan Overview</p>
              {[
                { label: "Name",       value: name    || "—"         },
                { label: "Email",      value: email   || "—"         },
                { label: "College",    value: college || "—"         },
                { label: "Daily Goal", value: `${hours} Daily`       },
                { label: "Subjects",   value: `${subjects.length} Subject${subjects.length !== 1 ? "s" : ""}` },
                { label: "Exam Date",  value: formatDate(examDate)   },
              ].map(({ label, value }, i, arr) => (
                <div key={label} className={`flex justify-between items-center py-2 ${i < arr.length - 1 ? "border-b border-[#5150b1]/10" : ""}`}>
                  <span className="text-xs text-[#3b399a] opacity-70">{label}</span>
                  <span className="text-sm font-bold text-[#3b399a] truncate max-w-[60%] text-right">{value}</span>
                </div>
              ))}
            </div>

            {/* Error message */}
            {submitError && (
              <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex items-center gap-2">
                <Icon name="error" filled className="text-red-500 text-[18px] shrink-0" />
                <p className="text-[13px] text-red-600 font-medium">{submitError}</p>
              </div>
            )}

            {/* Submit button */}
            <button
              onClick={handleFinish}
              disabled={submitting}
              className="w-full h-14 bg-[#5150b1] text-white rounded-full font-bold text-sm shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creating your plan…
                </>
              ) : (
                <>
                  Go to My Dashboard
                  <Icon name="arrow_forward" className="text-[20px]" />
                </>
              )}
            </button>
          </div>
        )}

      </main>

      {/* Bottom Nav */}
      {step < 5 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-gradient-to-t from-[#f9faf3] via-[#f9faf3]/80 to-transparent">
          <div className="max-w-[480px] mx-auto">
            <div className="bg-[#2f312d] rounded-full shadow-2xl flex items-center justify-between px-6 h-[60px]">
              <button
                onClick={() => setStep((s) => Math.max(1, s - 1))}
                disabled={step === 1}
                className="w-10 h-10 flex items-center justify-center rounded-full text-[#e2e3dc] hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Icon name="arrow_back" className="text-[22px]" />
              </button>
              <span className="text-[#e2e3dc] text-sm font-semibold">Step {step} of 4</span>
              <button
                onClick={() => {
                  // Validate step 1 before proceeding
                  if (step === 1 && !canProceedStep1) return;
                  setStep((s) => Math.min(totalSteps, s + 1));
                }}
                disabled={step === 1 && !canProceedStep1}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-[#6a69cc] text-white shadow-md active:scale-90 transition-transform disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Icon name="arrow_forward" className="text-[22px]" />
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}