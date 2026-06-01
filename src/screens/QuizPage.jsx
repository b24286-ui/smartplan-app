import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { quizAPI, subjectsAPI } from "../services/api";

const Icon = ({ name, filled = false, className = "" }) => (
  <span
    className={`material-symbols-outlined ${className}`}
    style={{ fontVariationSettings: filled ? "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" : "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
  >
    {name}
  </span>
);

const LABELS       = ["A", "B", "C", "D"];
const DIFF_COLORS  = { Easy: "text-[#006769] bg-[#9ef1f2]", Medium: "text-[#6d3900] bg-[#ffdcc2]", Hard: "text-[#93000a] bg-[#ffdad6]" };

// ── Normalise question from API ───────────────────────────────────────────────
function normalizeQuestion(q, idx) {
  const opts = Array.isArray(q.options) ? q.options : [];
  return {
    _id:           q._id ?? String(idx),
    question:      q.question ?? q.text ?? "Question",
    options:       opts.map((text, i) => ({ label: LABELS[i] ?? String(i + 1), text: String(text), index: i })),
    correctIndex:  q.correctAnswer ?? q.correctIndex ?? null, // may be null if backend doesn't expose it
    explanation:   q.explanation ?? null,
    difficulty:    q.difficulty ?? "Medium",
  };
}

// ── Elapsed time formatter ────────────────────────────────────────────────────
function fmtElapsed(secs) {
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
}

// ── XP calculation (matches backend gamification rules) ──────────────────────
function calcXP(scorePercent) {
  return scorePercent >= 80 ? 30 : 10;
}

// ── Bottom nav shared component ───────────────────────────────────────────────
function BottomNav({ navigate }) {
  return (
    <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-[432px] h-[72px] z-50 flex justify-around items-center px-4 bg-[#2f312d] rounded-full shadow-xl">
      {[
        { icon: "home",           label: "Home",     route: "/dashboard" },
        { icon: "calendar_month", label: "Schedule", route: "/schedule"  },
        { icon: "timer",          label: "Focus",    route: "/focus"     },
        { icon: "quiz",           label: "Quiz",     route: "/quiz"      },
        { icon: "person",         label: "Profile",  route: "/profile"   },
      ].map((item) => {
        const isActive = item.route === "/quiz";
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
  );
}

export default function QuizPage() {
  const navigate = useNavigate();

  // ── Phase: "setup" | "loading" | "active" | "results" ────────────────────
  const [phase, setPhase] = useState("setup");

  // ── Setup state ───────────────────────────────────────────────────────────
  const [subjects,        setSubjects]        = useState([]);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [difficulty,      setDifficulty]      = useState("Medium");
  const [questionCount,   setQuestionCount]   = useState(10);
  const [setupError,      setSetupError]      = useState("");

  // ── Active quiz state ─────────────────────────────────────────────────────
  const [questions,     setQuestions]     = useState([]);
  const [currentIdx,    setCurrentIdx]    = useState(0);
  const [userAnswers,   setUserAnswers]   = useState([]);   // array of selected option index (or null for skipped)
  const [selectedOpt,   setSelectedOpt]  = useState(null); // current question's selection
  const [elapsed,       setElapsed]      = useState(0);
  const timerRef = useRef(null);

  // ── Results state ─────────────────────────────────────────────────────────
  const [score,    setScore]   = useState(0);
  const [xpEarned, setXpEarned] = useState(0);

  // ── Load subjects on mount ────────────────────────────────────────────────
  useEffect(() => {
    subjectsAPI.getAll()
      .then((res) => {
        const data = Array.isArray(res.data) ? res.data : res.data?.subjects ?? [];
        setSubjects(data);
      })
      .catch(() => {});
    return () => clearInterval(timerRef.current);
  }, []);

  // ── Start quiz ────────────────────────────────────────────────────────────
  const startQuiz = async () => {
    if (!selectedSubject) { setSetupError("Please select a subject first."); return; }
    setSetupError("");
    setPhase("loading");
    try {
      const res  = await quizAPI.getQuestions({
        subject:    selectedSubject._id,
        difficulty,
        count:      questionCount,
      });
      const raw  = Array.isArray(res.data) ? res.data : res.data?.questions ?? [];
      if (raw.length === 0) {
        setSetupError("No questions found for this selection. Try a different subject or difficulty.");
        setPhase("setup");
        return;
      }
      const normalized = raw.slice(0, questionCount).map(normalizeQuestion);
      setQuestions(normalized);
      setCurrentIdx(0);
      setUserAnswers([]);
      setSelectedOpt(null);
      setElapsed(0);
      setPhase("active");
      // Start timer
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } catch (err) {
      setSetupError(err.response?.data?.message || "Failed to load questions. Please try again.");
      setPhase("setup");
    }
  };

  // ── Finish quiz ────────────────────────────────────────────────────────────
  const finishQuiz = useCallback(async (finalAnswers) => {
    clearInterval(timerRef.current);
    const q       = questions;
    // Count correct (only if backend exposes correctIndex)
    const correct = finalAnswers.filter((ans, i) => {
      return ans !== null && q[i]?.correctIndex !== null && ans === q[i]?.correctIndex;
    }).length;
    const hasCorrectInfo = q.some((qi) => qi.correctIndex !== null);
    const scoreVal  = hasCorrectInfo ? correct : finalAnswers.filter((a) => a !== null).length;
    const total     = q.length;
    const pct       = Math.round((scoreVal / total) * 100);
    const xp        = calcXP(pct);

    setScore(scoreVal);
    setXpEarned(xp);
    setPhase("results");

    // Submit to backend (best-effort)
    try {
      await quizAPI.submit({
        subject:        selectedSubject?._id,
        difficulty,
        totalQuestions: total,
        correctAnswers: scoreVal,
        scorePercent:   pct,
        timeTaken:      elapsed,
        answers:        finalAnswers.map((ans, i) => ({ questionId: q[i]._id, selectedIndex: ans })),
      });
    } catch { /* silent */ }
  }, [questions, selectedSubject, difficulty, elapsed]);

  // ── Navigate to next question or finish ───────────────────────────────────
  const handleNext = () => {
    const updated = [...userAnswers, selectedOpt];
    if (currentIdx + 1 >= questions.length) {
      finishQuiz(updated);
    } else {
      setUserAnswers(updated);
      setCurrentIdx((i) => i + 1);
      setSelectedOpt(null);
    }
  };

  const handleSkip = () => {
    const updated = [...userAnswers, null];
    if (currentIdx + 1 >= questions.length) {
      finishQuiz(updated);
    } else {
      setUserAnswers(updated);
      setCurrentIdx((i) => i + 1);
      setSelectedOpt(null);
    }
  };

  // ── Reset to setup ─────────────────────────────────────────────────────────
  const resetQuiz = () => {
    clearInterval(timerRef.current);
    setPhase("setup");
    setQuestions([]);
    setCurrentIdx(0);
    setUserAnswers([]);
    setSelectedOpt(null);
    setElapsed(0);
  };

  // ── Current question derived values ──────────────────────────────────────
  const currentQ  = questions[currentIdx];
  const progress  = questions.length > 0 ? ((currentIdx) / questions.length) * 100 : 0;
  const isLast    = currentIdx === questions.length - 1;

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="bg-[#f9faf3] min-h-screen pb-32">

      {/* Top App Bar */}
      <header className="sticky top-0 w-full bg-[#f9faf3] z-50 flex items-center justify-between px-5 h-16 max-w-[480px] mx-auto">
        <button
          onClick={phase === "active" ? resetQuiz : () => navigate(-1)}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[#e2e3dc] active:scale-95 transition-all"
        >
          <Icon name="arrow_back" className="text-[#1a1c18]" />
        </button>
        <h1 className="text-[24px] font-extrabold text-[#5150b1]">Quiz</h1>
        {phase === "active" ? (
          <div className="flex items-center gap-1 text-[#464552] text-sm font-bold">
            <Icon name="schedule" className="text-[16px]" />
            {fmtElapsed(elapsed)}
          </div>
        ) : (
          <div className="w-10" />
        )}
      </header>

      {/* ── SETUP PHASE ────────────────────────────────────────────────────── */}
      {phase === "setup" && (
        <main className="max-w-[480px] mx-auto px-5 pt-2 space-y-6">

          <div>
            <h2 className="text-[28px] font-extrabold text-[#1a1c18]">Start a Quiz 🧠</h2>
            <p className="text-sm text-[#464552] mt-1">Pick a subject and we'll test your knowledge</p>
          </div>

          {/* Subject */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-[#464552]">Subject</label>
            {subjects.length === 0 ? (
              <p className="text-sm text-[#464552] bg-[#f3f4ed] rounded-2xl px-4 py-3">
                No subjects yet — add them in the Subjects page first.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {subjects.map((s) => (
                  <button
                    key={s._id}
                    onClick={() => { setSelectedSubject({ _id: s._id, name: s.name }); setSetupError(""); }}
                    className={`px-4 py-2.5 rounded-full text-sm font-semibold border-2 transition-all active:scale-95 ${
                      selectedSubject?._id === s._id
                        ? "bg-[#5150b1] text-white border-transparent shadow-lg"
                        : "bg-white text-[#464552] border-[#c7c5d4]/50"
                    }`}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Difficulty */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-[#464552]">Difficulty</label>
            <div className="flex gap-2">
              {["Easy", "Medium", "Hard"].map((d) => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={`flex-1 py-3 rounded-full text-sm font-bold border-2 transition-all active:scale-95 ${
                    difficulty === d ? "bg-[#5150b1] text-white border-transparent" : "bg-white text-[#464552] border-[#c7c5d4]/50"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Question Count */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-[#464552]">Questions</label>
            <div className="flex gap-2">
              {[5, 10, 15, 20].map((n) => (
                <button
                  key={n}
                  onClick={() => setQuestionCount(n)}
                  className={`flex-1 py-3 rounded-full text-sm font-bold border-2 transition-all active:scale-95 ${
                    questionCount === n ? "bg-[#5150b1] text-white border-transparent" : "bg-white text-[#464552] border-[#c7c5d4]/50"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Error */}
          {setupError && (
            <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex items-center gap-2">
              <Icon name="error" filled className="text-red-500 text-[18px] flex-shrink-0" />
              <p className="text-[13px] text-red-600 font-medium">{setupError}</p>
            </div>
          )}

          {/* Summary card */}
          {selectedSubject && (
            <div className="bg-[#e2dfff]/40 rounded-[24px] p-4 border border-[#5150b1]/10 flex items-center justify-between">
              <div>
                <p className="font-bold text-sm text-[#1a1c18]">{selectedSubject.name}</p>
                <p className="text-xs text-[#464552] mt-0.5">{questionCount} questions · {difficulty}</p>
              </div>
              <Icon name="quiz" filled className="text-[#5150b1] text-[28px]" />
            </div>
          )}

          {/* Start button */}
          <button
            onClick={startQuiz}
            disabled={!selectedSubject}
            className="w-full h-14 bg-[#5150b1] text-white text-[18px] font-bold rounded-full shadow-lg active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Start Quiz
          </button>
        </main>
      )}

      {/* ── LOADING PHASE ──────────────────────────────────────────────────── */}
      {phase === "loading" && (
        <main className="max-w-[480px] mx-auto px-5 flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <div className="w-16 h-16 border-4 border-[#5150b1] border-t-transparent rounded-full animate-spin" />
          <p className="font-bold text-[#1a1c18]">Generating your quiz…</p>
          <p className="text-sm text-[#464552]">{selectedSubject?.name} · {difficulty}</p>
        </main>
      )}

      {/* ── ACTIVE PHASE ───────────────────────────────────────────────────── */}
      {phase === "active" && currentQ && (
        <main className="max-w-[480px] mx-auto px-5 pt-2 space-y-4">

          {/* Quiz meta */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-[#e2dfff] text-[#0b006b] text-[14px] font-semibold">
                {selectedSubject?.name}
              </div>
              <span className={`px-3 py-1 rounded-full text-[12px] font-bold ${DIFF_COLORS[difficulty]}`}>{difficulty}</span>
            </div>
            <div className="flex items-center gap-3 text-[#464552] text-[13px] font-semibold">
              <span className="flex items-center gap-1"><Icon name="list_alt" className="text-[18px]" />{questions.length} Questions</span>
              <span className="flex items-center gap-1"><Icon name="schedule" className="text-[18px]" />{fmtElapsed(elapsed)}</span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="space-y-1.5">
            <div className="w-full h-2.5 bg-[#edeee8] rounded-full overflow-hidden">
              <div className="h-full bg-[#5150b1] rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-[14px] font-semibold text-[#464552]">Question {currentIdx + 1} of {questions.length}</p>
          </div>

          {/* Question card */}
          <div className="bg-white rounded-[24px] p-6 shadow-[0px_10px_30px_rgba(0,0,0,0.06)] border border-[#e2e3dc]/30">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-[#e2dfff] text-[#0b006b] text-[16px] font-bold mb-4">
              Q{currentIdx + 1}
            </div>
            <h2 className="text-[20px] font-bold text-[#1a1c18] leading-[28px]">{currentQ.question}</h2>
          </div>

          {/* Options */}
          <div className="space-y-3">
            {currentQ.options.map((opt) => {
              const isSelected = selectedOpt === opt.index;
              return (
                <button
                  key={opt.label}
                  onClick={() => { setSelectedOpt(opt.index); if (window.navigator.vibrate) window.navigator.vibrate(10); }}
                  className="w-full flex items-center p-4 rounded-[20px] border text-left transition-all duration-200"
                  style={{
                    backgroundColor: isSelected ? "#5150b1" : "#ffffff",
                    borderColor:     isSelected ? "transparent" : "#e2e3dc66",
                    transform:       isSelected ? "scale(1.02)" : "scale(1)",
                    boxShadow:       isSelected ? "0px 10px 20px rgba(81,80,177,0.25)" : "0px 4px 12px rgba(0,0,0,0.04)",
                  }}
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center font-bold mr-4 shrink-0 text-[15px]"
                    style={{ backgroundColor: isSelected ? "rgba(255,255,255,0.2)" : "#e8e9e2", color: isSelected ? "#ffffff" : "#464552" }}
                  >
                    {opt.label}
                  </div>
                  <span className="text-[16px] font-medium" style={{ color: isSelected ? "#ffffff" : "#1a1c18" }}>
                    {opt.text}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Actions */}
          <div className="pt-2 flex flex-col items-center gap-4 pb-4">
            <button
              onClick={handleNext}
              disabled={selectedOpt === null}
              className="w-full h-14 bg-[#5150b1] text-white text-[18px] font-bold rounded-full shadow-lg active:scale-[0.98] transition-all disabled:opacity-40"
            >
              {isLast ? "Finish Quiz" : "Next Question"}
            </button>
            <button onClick={handleSkip} className="text-[14px] font-semibold text-[#464552] hover:text-[#5150b1] transition-colors">
              Skip this question
            </button>
          </div>
        </main>
      )}

      {/* ── RESULTS PHASE ──────────────────────────────────────────────────── */}
      {phase === "results" && (
        <main className="max-w-[480px] mx-auto px-5 pt-4 space-y-5">

          {/* Score ring */}
          <div className="flex flex-col items-center py-6">
            <div className="relative w-48 h-48 flex items-center justify-center">
              <svg className="absolute w-full h-full -rotate-90" viewBox="0 0 192 192">
                <circle cx="96" cy="96" r="80" fill="transparent" stroke="#e2e3dc" strokeWidth="12" />
                <circle
                  cx="96" cy="96" r="80" fill="transparent"
                  stroke={score / questions.length >= 0.8 ? "#006769" : "#5150b1"}
                  strokeWidth="12"
                  strokeDasharray={502}
                  strokeDashoffset={502 * (1 - score / Math.max(questions.length, 1))}
                  strokeLinecap="round"
                  style={{ transition: "stroke-dashoffset 1s ease" }}
                />
              </svg>
              <div className="text-center z-10">
                <span className="text-[44px] font-extrabold text-[#1a1c18] leading-none">
                  {Math.round((score / Math.max(questions.length, 1)) * 100)}%
                </span>
                <p className="text-sm font-semibold text-[#464552] mt-1">{score}/{questions.length} correct</p>
              </div>
            </div>
            <h2 className="text-[24px] font-extrabold text-[#1a1c18] mt-2">
              {score / questions.length >= 0.8 ? "Excellent! 🎉" : score / questions.length >= 0.5 ? "Good effort! 💪" : "Keep practising! 📚"}
            </h2>
          </div>

          {/* Stats strip */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: "bolt", color: "text-[#5150b1]", bg: "bg-[#e2dfff]/50", label: "XP Earned", value: `+${xpEarned}` },
              { icon: "schedule", color: "text-[#8d4f0e]", bg: "bg-[#ffdcc2]/50", label: "Time Taken", value: fmtElapsed(elapsed) },
              { icon: "signal_cellular_alt", color: "text-[#006769]", bg: "bg-[#9ef1f2]/30", label: "Difficulty", value: difficulty },
            ].map(({ icon, color, bg, label, value }) => (
              <div key={label} className={`${bg} rounded-[20px] p-4 text-center`}>
                <Icon name={icon} filled className={`${color} text-[22px]`} />
                <p className="text-[10px] font-semibold text-[#464552] mt-1">{label}</p>
                <p className="font-extrabold text-sm text-[#1a1c18]">{value}</p>
              </div>
            ))}
          </div>

          {/* Subject badge */}
          <div className="bg-white rounded-[24px] p-4 border border-[#c7c5d4]/20 shadow-sm flex items-center justify-between">
            <div>
              <p className="font-bold text-[#1a1c18]">{selectedSubject?.name}</p>
              <p className="text-xs text-[#464552] mt-0.5">{questions.length} questions attempted</p>
            </div>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-extrabold ${score / questions.length >= 0.8 ? "bg-[#9ef1f2] text-[#006769]" : "bg-[#e2dfff] text-[#5150b1]"}`}>
              {Math.round((score / Math.max(questions.length, 1)) * 100)}%
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-3 pb-4">
            <button
              onClick={resetQuiz}
              className="w-full h-14 bg-[#5150b1] text-white text-[18px] font-bold rounded-full shadow-lg active:scale-[0.98] transition-all"
            >
              Try Again
            </button>
            <button
              onClick={() => navigate("/dashboard")}
              className="w-full h-14 bg-[#f3f4ed] text-[#1a1c18] text-[16px] font-bold rounded-full border border-[#c7c5d4]/30 active:scale-[0.98] transition-all"
            >
              Back to Dashboard
            </button>
          </div>
        </main>
      )}

      <BottomNav navigate={navigate} />
    </div>
  );
}