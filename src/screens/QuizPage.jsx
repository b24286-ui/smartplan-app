import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { subjectsAPI, topicsAPI, profileAPI } from "../services/api";
import { useAuth } from "../context/AuthContext";

const Icon = ({ name, filled = false, className = "" }) => (
  <span
    className={`material-symbols-outlined select-none ${className}`}
    style={{
      fontVariationSettings: filled
        ? "'FILL' 1,'wght' 500,'GRAD' 0,'opsz' 24"
        : "'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24",
    }}
  >
    {name}
  </span>
);

const XP_MAP    = { easy: 10, medium: 15, hard: 20 };
const COUNT_MAP = { easy: 5, medium: 7, hard: 10 };
const DIFF_LABELS = {
  easy:   { label: "Easy",   color: "bg-green-100 text-green-700",  ring: "#22c55e" },
  medium: { label: "Medium", color: "bg-yellow-100 text-yellow-700", ring: "#eab308" },
  hard:   { label: "Hard",   color: "bg-red-100 text-red-700",      ring: "#ef4444" },
};

const ScoreRing = ({ score, total, color }) => {
  const r    = 54;
  const circ = 2 * Math.PI * r;
  const dash = total > 0 ? (score / total) * circ : 0;
  return (
    <svg width="140" height="140" viewBox="0 0 140 140">
      <circle cx="70" cy="70" r={r} fill="none" stroke="#e5e7eb" strokeWidth="12" />
      <circle cx="70" cy="70" r={r} fill="none" stroke={color} strokeWidth="12"
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform="rotate(-90 70 70)"
        style={{ transition: "stroke-dasharray 0.8s ease" }}
      />
      <text x="70" y="65" textAnchor="middle" fontSize="26" fontWeight="700" fill="#1c1b1f">{score}/{total}</text>
      <text x="70" y="85" textAnchor="middle" fontSize="13" fill="#6b7280">correct</text>
    </svg>
  );
};

const BottomNav = ({ navigate }) => {
  const items = [
    { icon: "home",           label: "Home",     path: "/dashboard" },
    { icon: "calendar_month", label: "Schedule", path: "/schedule"  },
    { icon: "timer",          label: "Focus",    path: "/focus"     },
    { icon: "quiz",           label: "Quiz",     path: "/quiz", active: true },
    { icon: "person",         label: "Profile",  path: "/profile"   },
  ];
  return (
    <nav className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
      <div className="flex items-center gap-1 px-3 py-2 rounded-full bg-[#2f312d] shadow-xl">
        {items.map((item) => (
          <button key={item.path} onClick={() => navigate(item.path)}
            className={`flex flex-col items-center px-3 py-1.5 rounded-full transition-all ${item.active ? "bg-[#6a69cc]" : ""}`}>
            <Icon name={item.icon} filled={item.active}
              className={`text-[22px] ${item.active ? "text-white" : "text-[#c8c9be]"}`} />
            <span className={`text-[10px] mt-0.5 font-medium ${item.active ? "text-white" : "text-[#c8c9be]"}`}>
              {item.label}
            </span>
          </button>
        ))}
      </div>
    </nav>
  );
};

export default function QuizPage() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();

  const [view,            setView]            = useState("idle");
  const [subjects,        setSubjects]        = useState([]);
  const [topics,          setTopics]          = useState([]);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedTopic,   setSelectedTopic]   = useState(null);
  const [difficulty,      setDifficulty]      = useState("medium");
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [loadingTopics,   setLoadingTopics]   = useState(false);
  const [questions,       setQuestions]       = useState([]);
  const [currentQ,        setCurrentQ]        = useState(0);
  const [selected,        setSelected]        = useState(null);
  const [confirmed,       setConfirmed]       = useState(false);
  const [answers,         setAnswers]         = useState([]);
  const [genError,        setGenError]        = useState("");
  const [xpEarned,        setXpEarned]        = useState(0);
  const xpSaved = useRef(false);

  useEffect(() => {
    if (view !== "configure") return;
    setLoadingSubjects(true);
    subjectsAPI.getAll()
      .then((res) => setSubjects(res.data?.subjects || []))
      .catch(() => setSubjects([]))
      .finally(() => setLoadingSubjects(false));
  }, [view]);

  useEffect(() => {
    if (!selectedSubject) { setTopics([]); setSelectedTopic(null); return; }
    setLoadingTopics(true);
    setSelectedTopic(null);
    topicsAPI.getBySubject(selectedSubject._id)
      .then((res) => setTopics(res.data?.topics || []))
      .catch(() => setTopics([]))
      .finally(() => setLoadingTopics(false));
  }, [selectedSubject]);

  const handleGenerate = async () => {
    if (!selectedSubject || !selectedTopic) return;
    setGenError("");
    setView("generating");
    xpSaved.current = false;
    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/ai/quiz`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("sp_token")}`,
        },
        body: JSON.stringify({
          subjectName: selectedSubject.name,
          topicName:   selectedTopic.name,
          difficulty,
          count:       COUNT_MAP[difficulty],
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Generation failed");
      setQuestions(data.questions);
      setCurrentQ(0);
      setSelected(null);
      setConfirmed(false);
      setAnswers([]);
      setView("quiz");
    } catch (err) {
      setGenError(err.message || "Failed to generate quiz. Please try again.");
      setView("configure");
    }
  };

  const handleOptionTap = (idx) => {
    if (confirmed) return;
    if (selected === idx) {
      setConfirmed(true);
      const correctIdx = ["A", "B", "C", "D"].indexOf(questions[currentQ].answer);
      setAnswers((prev) => [...prev, { chosen: idx, correct: correctIdx }]);
    } else {
      setSelected(idx);
    }
  };

  const handleNext = () => {
    if (currentQ < questions.length - 1) {
      setCurrentQ((q) => q + 1);
      setSelected(null);
      setConfirmed(false);
    } else {
      const correct = [...answers].filter((a) => a.chosen === a.correct).length;
      const xp      = correct * XP_MAP[difficulty];
      setXpEarned(xp);
      setView("results");
      if (!xpSaved.current && xp > 0) {
        xpSaved.current = true;
        profileAPI.update({ xpIncrement: xp }).then(() => refreshUser()).catch(() => {});
      }
    }
  };

  const optionStyle = (idx) => {
    const correctIdx = questions[currentQ] ? ["A","B","C","D"].indexOf(questions[currentQ].answer) : -1;
    if (!confirmed) {
      return selected === idx
        ? "border-[#5150b1] bg-[#ededf8] text-[#5150b1] font-semibold"
        : "border-gray-200 bg-white text-gray-700 hover:border-[#5150b1] hover:bg-[#ededf8]";
    }
    if (idx === correctIdx)                        return "border-green-500 bg-green-50 text-green-700 font-semibold";
    if (idx === selected && idx !== correctIdx)    return "border-red-400 bg-red-50 text-red-600";
    return "border-gray-200 bg-white text-gray-400";
  };

  const optionDotStyle = (idx) => {
    const correctIdx = questions[currentQ] ? ["A","B","C","D"].indexOf(questions[currentQ].answer) : -1;
    if (!confirmed) return selected === idx ? "bg-[#5150b1] text-white" : "bg-gray-100 text-gray-500";
    if (idx === correctIdx)                     return "bg-green-500 text-white";
    if (idx === selected && idx !== correctIdx) return "bg-red-400 text-white";
    return "bg-gray-100 text-gray-400";
  };

  const correctCount = answers.filter((a) => a.chosen === a.correct).length;
  const pct          = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;
  const passed       = pct >= 60;

  return (
    <div className="min-h-screen bg-[#f9faf3]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div className="max-w-[480px] mx-auto min-h-screen flex flex-col">

        {/* ── IDLE ── */}
        {view === "idle" && (
          <div className="flex flex-col flex-1 px-4 pt-10 pb-28">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-[#1c1b1f]">Quiz</h1>
              <p className="text-sm text-gray-500 mt-1">Test your knowledge with AI-generated questions</p>
            </div>
            <div className="bg-white rounded-[28px] shadow-sm p-6 mb-5 flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-[#ededf8] flex items-center justify-center mb-4">
                <Icon name="psychology" filled className="text-[#5150b1] text-[32px]" />
              </div>
              <h2 className="text-lg font-bold text-[#1c1b1f] mb-2">AI Quiz Generator</h2>
              <p className="text-sm text-gray-500 leading-relaxed mb-6">
                Pick a subject and topic, choose your difficulty, and get a custom quiz built just for you in seconds.
              </p>
              <button onClick={() => setView("configure")}
                className="w-full py-3.5 rounded-[16px] bg-[#5150b1] text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-transform">
                <Icon name="auto_awesome" filled className="text-white text-[18px]" />
                Generate a Quiz
              </button>
            </div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-1">Difficulty levels</p>
            <div className="flex gap-3">
              {Object.entries(DIFF_LABELS).map(([key, val]) => (
                <div key={key} className="flex-1 bg-white rounded-[20px] shadow-sm p-4 flex flex-col items-center gap-1">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${val.color}`}>{val.label}</span>
                  <span className="text-xs text-gray-400">+{XP_MAP[key]} XP each</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── CONFIGURE ── */}
        {view === "configure" && (
          <div className="flex flex-col flex-1 px-4 pt-6 pb-28">
            <div className="flex items-center gap-3 mb-6">
              <button onClick={() => setView("idle")}
                className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center active:scale-95 transition-transform">
                <Icon name="arrow_back" className="text-[#1c1b1f] text-[20px]" />
              </button>
              <div>
                <h1 className="text-lg font-bold text-[#1c1b1f]">Configure Quiz</h1>
                <p className="text-xs text-gray-500">Choose subject, topic & difficulty</p>
              </div>
            </div>

            {genError && (
              <div className="mb-4 px-4 py-3 rounded-[14px] bg-red-50 border border-red-200 text-red-600 text-sm flex items-center gap-2">
                <Icon name="error" className="text-red-400 text-[18px]" />{genError}
              </div>
            )}

            {/* Subject */}
            <div className="bg-white rounded-[24px] shadow-sm p-5 mb-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Subject</p>
              {loadingSubjects ? (
                <div className="flex gap-2 flex-wrap">
                  {[1,2,3].map((i) => <div key={i} className="h-8 w-24 rounded-full bg-gray-100 animate-pulse" />)}
                </div>
              ) : subjects.length === 0 ? (
                <p className="text-sm text-gray-400">No subjects found. Add some first.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {subjects.map((s) => (
                    <button key={s._id} onClick={() => setSelectedSubject(s)}
                      className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all active:scale-95 ${
                        selectedSubject?._id === s._id
                          ? "bg-[#5150b1] text-white border-[#5150b1]"
                          : "bg-gray-50 text-gray-600 border-gray-200"
                      }`}>
                      {s.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Topic */}
            <div className="bg-white rounded-[24px] shadow-sm p-5 mb-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Topic</p>
              {!selectedSubject ? (
                <p className="text-sm text-gray-400">Select a subject first</p>
              ) : loadingTopics ? (
                <div className="flex gap-2 flex-wrap">
                  {[1,2,3].map((i) => <div key={i} className="h-8 w-28 rounded-full bg-gray-100 animate-pulse" />)}
                </div>
              ) : topics.length === 0 ? (
                <p className="text-sm text-gray-400">No topics in this subject.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {topics.map((t) => (
                    <button key={t._id} onClick={() => setSelectedTopic(t)}
                      className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all active:scale-95 ${
                        selectedTopic?._id === t._id
                          ? "bg-[#5150b1] text-white border-[#5150b1]"
                          : "bg-gray-50 text-gray-600 border-gray-200"
                      }`}>
                      {t.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Difficulty */}
            <div className="bg-white rounded-[24px] shadow-sm p-5 mb-6">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Difficulty</p>
              <div className="flex gap-3">
                {Object.entries(DIFF_LABELS).map(([key, val]) => (
                  <button key={key} onClick={() => setDifficulty(key)}
                    className={`flex-1 py-3 rounded-[16px] flex flex-col items-center gap-1 border-2 transition-all active:scale-95 ${
                      difficulty === key ? "border-[#5150b1] bg-[#ededf8]" : "border-gray-200 bg-gray-50"
                    }`}>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${val.color}`}>{val.label}</span>
                    <span className="text-[11px] text-gray-400">+{XP_MAP[key]} XP</span>
                  </button>
                ))}
              </div>
            </div>

            <button onClick={handleGenerate} disabled={!selectedSubject || !selectedTopic}
              className={`w-full py-4 rounded-[18px] font-semibold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm ${
                selectedSubject && selectedTopic ? "bg-[#5150b1] text-white" : "bg-gray-200 text-gray-400 cursor-not-allowed"
              }`}>
              <Icon name="auto_awesome" filled className="text-[18px]" />
              Generate Quiz
            </button>
          </div>
        )}

        {/* ── GENERATING ── */}
        {view === "generating" && (
          <div className="flex flex-col flex-1 items-center justify-center px-4 pb-28 gap-6">
            <div className="w-20 h-20 rounded-full bg-[#ededf8] flex items-center justify-center">
              <Icon name="psychology" filled className="text-[#5150b1] text-[40px] animate-pulse" />
            </div>
            <div className="text-center">
              <h2 className="text-lg font-bold text-[#1c1b1f] mb-2">Generating your quiz…</h2>
              <p className="text-sm text-gray-500">
                Building {COUNT_MAP[difficulty]} {DIFF_LABELS[difficulty].label} questions on{" "}
                <span className="font-semibold text-[#5150b1]">{selectedTopic?.name}</span>
              </p>
            </div>
            <div className="flex gap-2">
              {[0,1,2].map((i) => (
                <div key={i} className="w-2.5 h-2.5 rounded-full bg-[#5150b1]"
                  style={{ animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
              ))}
            </div>
            <style>{`@keyframes bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-10px)}}`}</style>
          </div>
        )}

        {/* ── QUIZ ── */}
        {view === "quiz" && questions.length > 0 && (
          <div className="flex flex-col flex-1 px-4 pt-6 pb-28">
            <div className="mb-5">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-semibold text-gray-400">Question {currentQ + 1} of {questions.length}</span>
                <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${DIFF_LABELS[difficulty].color}`}>
                  {DIFF_LABELS[difficulty].label}
                </span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-[#5150b1] rounded-full transition-all duration-500"
                  style={{ width: `${((currentQ + 1) / questions.length) * 100}%` }} />
              </div>
            </div>

            <div className="bg-white rounded-[24px] shadow-sm p-5 mb-4">
              <p className="text-base font-semibold text-[#1c1b1f] leading-relaxed">
                {questions[currentQ].question}
              </p>
            </div>

            <div className="flex flex-col gap-3 mb-4">
              {questions[currentQ].options.map((opt, idx) => {
                const letter     = ["A","B","C","D"][idx];
                const correctIdx = ["A","B","C","D"].indexOf(questions[currentQ].answer);
                return (
                  <button key={idx} onClick={() => handleOptionTap(idx)}
                    className={`w-full flex items-center gap-3 p-4 rounded-[18px] border-2 text-left transition-all active:scale-[0.98] ${optionStyle(idx)}`}>
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${optionDotStyle(idx)}`}>
                      {letter}
                    </span>
                    <span className="text-sm leading-snug">{opt.replace(/^[A-D]\.\s*/, "")}</span>
                    {confirmed && idx === correctIdx && (
                      <Icon name="check_circle" filled className="text-green-500 text-[20px] ml-auto flex-shrink-0" />
                    )}
                    {confirmed && idx === selected && idx !== correctIdx && (
                      <Icon name="cancel" filled className="text-red-400 text-[20px] ml-auto flex-shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>

            {selected !== null && !confirmed && (
              <p className="text-xs text-center text-[#5150b1] font-medium mb-3 animate-pulse">
                Tap again to confirm your answer
              </p>
            )}

            {confirmed && (
              <div className="flex flex-col gap-3">
                <div className="bg-[#f0f0fb] rounded-[16px] p-4">
                  <p className="text-xs font-semibold text-[#5150b1] mb-1 flex items-center gap-1">
                    <Icon name="lightbulb" filled className="text-[16px]" /> Explanation
                  </p>
                  <p className="text-sm text-gray-600 leading-relaxed">{questions[currentQ].explanation}</p>
                </div>
                <button onClick={handleNext}
                  className="w-full py-4 rounded-[18px] bg-[#5150b1] text-white font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform">
                  {currentQ < questions.length - 1
                    ? <><span>Next Question</span><Icon name="arrow_forward" className="text-white text-[18px]" /></>
                    : <><span>See Results</span><Icon name="emoji_events" filled className="text-white text-[18px]" /></>
                  }
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── RESULTS ── */}
        {view === "results" && (
          <div className="flex flex-col flex-1 px-4 pt-10 pb-28 items-center">
            <div className="w-16 h-16 rounded-full bg-[#ededf8] flex items-center justify-center mb-4">
              <Icon name={passed ? "emoji_events" : "sentiment_dissatisfied"} filled
                className={`text-[32px] ${passed ? "text-[#5150b1]" : "text-gray-400"}`} />
            </div>
            <h2 className="text-xl font-bold text-[#1c1b1f] mb-1">{passed ? "Great work! 🎉" : "Keep practising!"}</h2>
            <p className="text-sm text-gray-500 mb-6 text-center">{selectedTopic?.name} · {DIFF_LABELS[difficulty].label}</p>

            <ScoreRing score={correctCount} total={questions.length} color={passed ? "#5150b1" : "#ef4444"} />

            <div className="flex gap-4 mt-6 w-full">
              {[
                { label: "Score",    value: `${pct}%`,                    icon: "percent",       bg: "bg-[#ededf8]",  tc: "text-[#5150b1]"   },
                { label: "XP Earned", value: `+${xpEarned}`,             icon: "bolt",          bg: "bg-yellow-50",  tc: "text-yellow-600"  },
                { label: "Correct",  value: `${correctCount}/${questions.length}`, icon: "check_circle", bg: "bg-green-50", tc: "text-green-600" },
              ].map((s) => (
                <div key={s.label} className="flex-1 bg-white rounded-[20px] shadow-sm p-4 flex flex-col items-center gap-1">
                  <div className={`w-8 h-8 rounded-full ${s.bg} flex items-center justify-center mb-1`}>
                    <Icon name={s.icon} filled className={`${s.tc} text-[18px]`} />
                  </div>
                  <span className={`text-base font-bold ${s.tc}`}>{s.value}</span>
                  <span className="text-[11px] text-gray-400">{s.label}</span>
                </div>
              ))}
            </div>

            <div className="w-full mt-5 bg-white rounded-[24px] shadow-sm p-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Question breakdown</p>
              <div className="flex flex-wrap gap-2">
                {questions.map((q, i) => {
                  const a         = answers[i];
                  const isCorrect = a && a.chosen === a.correct;
                  return (
                    <div key={i} className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                      isCorrect ? "bg-green-100 text-green-600" : "bg-red-100 text-red-500"
                    }`}>
                      {i + 1}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-3 mt-5 w-full">
              <button onClick={() => { setView("configure"); setSelectedTopic(null); setSelectedSubject(null); setDifficulty("medium"); setQuestions([]); setAnswers([]); }}
                className="flex-1 py-3.5 rounded-[16px] border-2 border-[#5150b1] text-[#5150b1] font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform">
                <Icon name="refresh" className="text-[18px]" /> Try Again
              </button>
              <button onClick={() => setView("idle")}
                className="flex-1 py-3.5 rounded-[16px] bg-[#5150b1] text-white font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform">
                <Icon name="home" className="text-[18px]" /> Done
              </button>
            </div>
          </div>
        )}

      </div>
      <BottomNav navigate={navigate} />
    </div>
  );
}