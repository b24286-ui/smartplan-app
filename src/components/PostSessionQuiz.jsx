import React, { useState } from "react";
import { scheduleAPI } from "../services/api";

const Icon = ({ name, filled = false, className = "" }) => (
  <span
    className={`material-symbols-outlined ${className}`}
    style={{ fontVariationSettings: filled ? "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" : "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
  >
    {name}
  </span>
);

const LABELS = ["A", "B", "C", "D"];

// ── Generate questions via BACKEND (key is safe on server) ───────────────────
async function generateQuestions(subject, topic, studiedText) {
  const baseURL = process.env.REACT_APP_API_URL || "http://localhost:5000/api";
  const token = localStorage.getItem("sp_token");

  const res = await fetch(`${baseURL}/ai/post-session-quiz`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ subject, topic, studiedText }),
  });

  const data = await res.json();
  if (!data.success) throw new Error(data.message || "Failed to generate quiz");
  if (!Array.isArray(data.questions) || data.questions.length === 0)
    throw new Error("No questions returned");

  return data.questions;
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function PostSessionQuiz({ subject, topic, sessionId, onComplete, onDismiss }) {
  const [phase,        setPhase]        = useState("input");
  const [studiedText,  setStudiedText]  = useState("");
  const [questions,    setQuestions]    = useState([]);
  const [currentIdx,   setCurrentIdx]   = useState(0);
  const [selectedOpt,  setSelectedOpt]  = useState(null);
  const [userAnswers,  setUserAnswers]  = useState([]);
  const [score,        setScore]        = useState(0);
  const [error,        setError]        = useState("");
  const [completing,   setCompleting]   = useState(false);

  const handleGenerate = async () => {
    if (!studiedText.trim()) return;
    setPhase("loading");
    setError("");
    try {
      const qs = await generateQuestions(subject, topic, studiedText);
      setQuestions(qs);
      setCurrentIdx(0);
      setSelectedOpt(null);
      setUserAnswers([]);
      setPhase("quiz");
    } catch (e) {
      setError("Failed to generate quiz. Please try again.");
      setPhase("input");
    }
  };

  const advance = (answers) => {
    const isLast = currentIdx + 1 >= questions.length;
    if (isLast) {
      const correct = answers.filter((ans, i) => ans === questions[i]?.correctIndex).length;
      setScore(correct);
      setUserAnswers(answers);
      setPhase("results");
    } else {
      setUserAnswers(answers);
      setCurrentIdx((i) => i + 1);
      setSelectedOpt(null);
    }
  };

  const handleNext = () => advance([...userAnswers, selectedOpt]);
  const handleSkip = () => advance([...userAnswers, null]);

  const markCompleted = async () => {
    setCompleting(true);
    try {
      if (sessionId) await scheduleAPI.update(sessionId, { status: "completed" });
    } catch { /* silent */ }
    setCompleting(false);
    onComplete(true);
  };

  const keepPending = () => onComplete(false);

  const pct      = questions.length > 0 ? Math.round((score / questions.length) * 100) : 0;
  const passed   = pct >= 60;
  const currentQ = questions[currentIdx];
  const progress = questions.length > 0 ? (currentIdx / questions.length) * 100 : 0;

  return (
    <div className="fixed inset-0 z-[200] bg-[#f9faf3] flex flex-col overflow-y-auto">
      <div className="w-full max-w-[480px] mx-auto flex flex-col min-h-screen">

        {/* Header */}
        <header className="flex items-center justify-between px-5 py-4 sticky top-0 bg-[#f9faf3] z-10 border-b border-[#c7c5d4]/20">
          <div className="flex items-center gap-2">
            <Icon name="quiz" filled className="text-[#5150b1] text-[22px]" />
            <span className="font-extrabold text-lg text-[#1a1c18]">Session Quiz</span>
          </div>
          {phase !== "loading" && (
            <button onClick={onDismiss} className="w-9 h-9 rounded-full bg-[#e8e9e2] flex items-center justify-center active:scale-95 transition-transform">
              <Icon name="close" className="text-[#464552] text-[18px]" />
            </button>
          )}
        </header>

        {/* ── INPUT ── */}
        {phase === "input" && (
          <div className="flex-1 px-5 py-6 flex flex-col gap-6">
            <div className="flex items-center gap-2">
              <div className="bg-[#e2dfff] px-4 py-1.5 rounded-full">
                <span className="text-[13px] font-bold text-[#5150b1]">{subject}</span>
              </div>
              {topic && (
                <div className="bg-[#f3f4ed] px-4 py-1.5 rounded-full">
                  <span className="text-[13px] font-semibold text-[#464552]">{topic}</span>
                </div>
              )}
            </div>

            <div className="bg-[#5150b1] rounded-[28px] p-6 relative overflow-hidden">
              <div className="absolute -right-6 -top-6 w-24 h-24 bg-white/10 rounded-full" />
              <div className="absolute right-10 bottom-0 w-16 h-16 bg-white/10 rounded-full" />
              <div className="relative z-10">
                <div className="text-4xl mb-3">🎉</div>
                <h2 className="text-[22px] font-extrabold text-white leading-tight">Great session!</h2>
                <p className="text-[14px] text-white/80 mt-1">Let's do a quick quiz to lock in what you learned.</p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[13px] font-bold text-[#464552] uppercase tracking-wider px-1">
                What topics did you cover this session?
              </label>
              <textarea
                rows={4}
                value={studiedText}
                onChange={(e) => setStudiedText(e.target.value)}
                placeholder="e.g. I studied derivatives, chain rule, and product rule..."
                className="w-full bg-white rounded-[20px] px-4 py-3 text-[15px] font-medium text-[#1a1c18] ring-1 ring-[#c7c5d4] focus:ring-2 focus:ring-[#5150b1] resize-none outline-none transition-all shadow-sm"
              />
              <p className="text-[11px] text-[#464552] px-1">The more detail you give, the better the questions will be.</p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex items-center gap-2">
                <Icon name="error" filled className="text-red-500 text-[18px]" />
                <p className="text-[13px] text-red-600 font-medium">{error}</p>
              </div>
            )}

            <div className="flex flex-col gap-3 mt-auto pb-8">
              <button onClick={handleGenerate} disabled={!studiedText.trim()}
                className="w-full h-14 bg-[#5150b1] text-white font-bold text-[16px] rounded-full shadow-lg active:scale-[0.98] transition-all disabled:opacity-40">
                Generate Quiz ✨
              </button>
              <button onClick={onDismiss}
                className="w-full h-12 text-[#464552] font-semibold text-[14px] rounded-full border border-[#c7c5d4] active:scale-[0.98] transition-all">
                Skip Quiz
              </button>
            </div>
          </div>
        )}

        {/* ── LOADING ── */}
        {phase === "loading" && (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 px-5">
            <div className="w-20 h-20 rounded-full bg-[#e2dfff] flex items-center justify-center">
              <div className="w-10 h-10 border-4 border-[#5150b1] border-t-transparent rounded-full animate-spin" />
            </div>
            <div className="text-center">
              <p className="font-bold text-[18px] text-[#1a1c18]">Generating your quiz…</p>
              <p className="text-[14px] text-[#464552] mt-1">AI is crafting questions just for you</p>
            </div>
            <div className="flex gap-2 mt-4">
              {[0,1,2].map((i) => (
                <div key={i} className="w-2 h-2 rounded-full bg-[#5150b1] animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </div>
        )}

        {/* ── QUIZ ── */}
        {phase === "quiz" && currentQ && (
          <div className="flex-1 px-5 py-4 flex flex-col gap-4">
            <div className="space-y-1.5">
              <div className="w-full h-2.5 bg-[#e8e9e2] rounded-full overflow-hidden">
                <div className="h-full bg-[#5150b1] rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-[13px] font-semibold text-[#464552]">Question {currentIdx + 1} of {questions.length}</p>
            </div>

            <div className="bg-white rounded-[24px] p-6 shadow-sm border border-[#c7c5d4]/20">
              <div className="w-9 h-9 rounded-xl bg-[#e2dfff] flex items-center justify-center font-bold text-[#5150b1] text-[14px] mb-4">
                Q{currentIdx + 1}
              </div>
              <h2 className="text-[18px] font-bold text-[#1a1c18] leading-snug">{currentQ.question}</h2>
            </div>

            <div className="space-y-3">
              {(currentQ.options ?? []).map((opt, i) => {
                const isSelected = selectedOpt === i;
                return (
                  <button key={i} onClick={() => setSelectedOpt(i)}
                    className="w-full flex items-center p-4 rounded-[20px] border text-left transition-all duration-200"
                    style={{
                      backgroundColor: isSelected ? "#5150b1" : "#ffffff",
                      borderColor:     isSelected ? "transparent" : "#e2e3dc66",
                      transform:       isSelected ? "scale(1.02)" : "scale(1)",
                      boxShadow:       isSelected ? "0px 8px 20px rgba(81,80,177,0.25)" : "0px 2px 8px rgba(0,0,0,0.04)",
                    }}>
                    <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold mr-3 shrink-0 text-[13px]"
                      style={{ backgroundColor: isSelected ? "rgba(255,255,255,0.2)" : "#e8e9e2", color: isSelected ? "#fff" : "#464552" }}>
                      {LABELS[i]}
                    </div>
                    <span className="text-[15px] font-medium" style={{ color: isSelected ? "#fff" : "#1a1c18" }}>
                      {opt.replace(/^[A-D]\.\s*/, "")}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col gap-3 mt-auto pb-6">
              <button onClick={handleNext} disabled={selectedOpt === null}
                className="w-full h-14 bg-[#5150b1] text-white font-bold text-[16px] rounded-full shadow-lg active:scale-[0.98] transition-all disabled:opacity-40">
                {currentIdx + 1 === questions.length ? "Finish Quiz" : "Next Question"}
              </button>
              <button onClick={handleSkip} className="text-[13px] font-semibold text-[#464552] text-center">
                Skip this question
              </button>
            </div>
          </div>
        )}

        {/* ── RESULTS ── */}
        {phase === "results" && (
          <div className="flex-1 px-5 py-6 flex flex-col gap-5">
            <div className="flex flex-col items-center py-4">
              <div className="relative w-44 h-44 flex items-center justify-center">
                <svg className="absolute w-full h-full -rotate-90" viewBox="0 0 176 176">
                  <circle cx="88" cy="88" r="76" fill="transparent" stroke="#e2e3dc" strokeWidth="10" />
                  <circle cx="88" cy="88" r="76" fill="transparent"
                    stroke={passed ? "#006769" : "#5150b1"} strokeWidth="10"
                    strokeDasharray={478}
                    strokeDashoffset={478 * (1 - score / Math.max(questions.length, 1))}
                    strokeLinecap="round" style={{ transition: "stroke-dashoffset 1s ease" }}
                  />
                </svg>
                <div className="text-center z-10">
                  <span className="text-[40px] font-extrabold text-[#1a1c18] leading-none">{pct}%</span>
                  <p className="text-[12px] font-semibold text-[#464552] mt-1">{score}/{questions.length} correct</p>
                </div>
              </div>
              <h2 className="text-[22px] font-extrabold text-[#1a1c18] mt-3 text-center">
                {pct === 100 ? "Perfect! 🏆" : pct >= 80 ? "Excellent! 🎉" : pct >= 60 ? "Good job! 💪" : "Keep studying! 📚"}
              </h2>
              <p className="text-[14px] text-[#464552] text-center mt-1">
                {passed ? "You've demonstrated good understanding of this session." : "Review the material and try again to solidify your knowledge."}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: "check_circle", color: "text-[#006769]", bg: "bg-[#9ef1f2]/30", label: "Correct",   value: String(score) },
                { icon: "cancel",       color: "text-[#ba1a1a]", bg: "bg-[#ffdad6]/30", label: "Wrong",     value: String(questions.length - score) },
                { icon: "bolt",         color: "text-[#5150b1]", bg: "bg-[#e2dfff]/50", label: "XP Earned", value: passed ? "+30" : "+10" },
              ].map(({ icon, color, bg, label, value }) => (
                <div key={label} className={`${bg} rounded-[20px] p-4 text-center`}>
                  <Icon name={icon} filled className={`${color} text-[22px]`} />
                  <p className="text-[10px] font-semibold text-[#464552] mt-1">{label}</p>
                  <p className="font-extrabold text-sm text-[#1a1c18]">{value}</p>
                </div>
              ))}
            </div>

            <div className={`rounded-[24px] p-4 border flex items-center gap-3 ${passed ? "bg-[#9ef1f2]/20 border-[#006769]/10" : "bg-[#ffdad6]/20 border-[#ba1a1a]/10"}`}>
              <Icon name={passed ? "check_circle" : "info"} filled
                className={`text-[28px] flex-shrink-0 ${passed ? "text-[#006769]" : "text-[#ba1a1a]"}`} />
              <p className={`text-[13px] font-semibold ${passed ? "text-[#006769]" : "text-[#ba1a1a]"}`}>
                {passed ? "Session will be marked as Completed ✓" : "Session will stay Pending — review and try again."}
              </p>
            </div>

            <div className="flex flex-col gap-3 mt-auto pb-8">
              {passed ? (
                <button onClick={markCompleted} disabled={completing}
                  className="w-full h-14 bg-[#006769] text-white font-bold text-[16px] rounded-full shadow-lg active:scale-[0.98] transition-all disabled:opacity-60 flex items-center justify-center gap-2">
                  {completing && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  {completing ? "Saving…" : "Mark Session Complete ✓"}
                </button>
              ) : (
                <>
                  <button onClick={() => { setPhase("input"); setStudiedText(""); setQuestions([]); setCurrentIdx(0); setSelectedOpt(null); setUserAnswers([]); }}
                    className="w-full h-14 bg-[#5150b1] text-white font-bold text-[16px] rounded-full shadow-lg active:scale-[0.98] transition-all">
                    Try Quiz Again
                  </button>
                  <button onClick={keepPending}
                    className="w-full h-12 text-[#464552] font-semibold text-[14px] rounded-full border border-[#c7c5d4] active:scale-[0.98] transition-all">
                    Keep as Pending
                  </button>
                </>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}