import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import avatarStudent from "../assets/avatar-student.png";
import illustrationStudyPlan from "../assets/illustration-study-plan.png";

const Icon = ({ name, filled = false, className = "" }) => (
  <span
    className={`material-symbols-outlined ${className}`}
    style={{ fontVariationSettings: filled ? "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" : "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
  >
    {name}
  </span>
);

const features = [
  { bg: "bg-[#e2dfff]/40 border-[#5150b1]/10", iconBg: "bg-[#6a69cc]", iconColor: "text-white", icon: "calendar_today", title: "AI Schedule", desc: "Dynamic plans that adapt to your pace." },
  { bg: "bg-[#9ef1f2]/20 border-[#006769]/10", iconBg: "bg-[#268083]", iconColor: "text-white", icon: "psychology", title: "Smart Quiz", desc: "Instant quizzes generated from notes." },
  { bg: "bg-[#ffdcc2]/40 border-[#8d4f0e]/10", iconBg: "bg-[#feac66]", iconColor: "text-[#2e1500]", icon: "troubleshoot", title: "Weak Topics", desc: "Know exactly where to focus effort." },
  { bg: "bg-[#e2e3dc] border-[#c7c5d4]/20", iconBg: "bg-[#2f312d]", iconColor: "text-white", icon: "timer", title: "Pomodoro", desc: "Built-in focus timer for deep work." },
];

const steps = [
  { num: "1", bg: "bg-[#6a69cc]", color: "text-white", title: "Set Up Your Profile", desc: "Tell us your subjects, exam dates, and current knowledge levels." },
  { num: "2", bg: "bg-[#feac66]", color: "text-[#2e1500]", title: "Get Your AI Plan", desc: "Our AI builds a custom roadmap optimized for retention and speed." },
  { num: "3", bg: "bg-[#268083]", color: "text-white", title: "Track and Improve", desc: "Take daily challenges, see your score rise, and ace those finals!" },
];

export default function LandingPage() {
  const navigate  = useNavigate();
  const { login, isAuthenticated, loading } = useAuth();

  const [scrolled,   setScrolled]   = useState(false);
  const [showLogin,  setShowLogin]  = useState(false);
  const [email,      setEmail]      = useState("");
  const [password,   setPassword]   = useState("");
  const [showPass,   setShowPass]   = useState(false);
  const [error,      setError]      = useState("");
  const [submitting, setSubmitting] = useState(false);

  // ── If already authenticated, go straight to dashboard ──────────────────
  useEffect(() => {
    if (!loading && isAuthenticated) navigate("/dashboard", { replace: true });
  }, [isAuthenticated, loading, navigate]);

  // ── Scroll shadow on header ──────────────────────────────────────────────
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // ── Lock body scroll when modal is open ─────────────────────────────────
  useEffect(() => {
    document.body.style.overflow = showLogin ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [showLogin]);

  const openLogin  = () => { setError(""); setEmail(""); setPassword(""); setShowLogin(true); };
  const closeLogin = () => setShowLogin(false);

  // ── Login submit ─────────────────────────────────────────────────────────
 const handleLogin = async () => {
  if (!email.trim() || !password) { setError("Please fill in all fields."); return; }
  setSubmitting(true);
  setError("");
  try {
    await login({ email: email.trim(), password });
    // ← DELETE the navigate("/dashboard") line here
  } catch (err) {
    setError(err.response?.data?.message || "Invalid email or password.");
  } finally {
    setSubmitting(false);
  }
};

  const handleKeyDown = (e) => { if (e.key === "Enter") handleLogin(); };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="bg-[#f9faf3] text-[#1a1c18] min-h-screen overflow-x-hidden">

      {/* Top App Bar */}
      <header className={`bg-[#f9faf3]/90 backdrop-blur-md sticky top-0 z-50 transition-all duration-300 ${scrolled ? "shadow-md" : "shadow-sm"}`}>
        <div className="flex justify-between items-center w-full px-5 py-4 max-w-[480px] mx-auto">
          <div className="flex items-center gap-2">
            <Icon name="school" filled className="text-[#5150b1] text-[22px]" />
            <span className="text-[20px] font-extrabold text-[#1a1c18]">SmartPlan</span>
          </div>
          <div className="flex items-center gap-4">
            {/* ← now opens login modal instead of navigating */}
            <button
              onClick={openLogin}
              className="text-[14px] font-semibold text-[#464552] hover:text-[#5150b1] transition-colors"
            >
              Login
            </button>
            <button
              onClick={() => navigate("/onboarding")}
              className="bg-[#2f312d] text-white px-5 py-2.5 rounded-full text-[14px] font-bold active:scale-95 transition-transform"
            >
              Get Started
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[480px] mx-auto pb-16">

        {/* Hero */}
        <section className="px-5 pt-10 pb-12 text-center">
          <h1 className="text-[32px] font-extrabold leading-tight text-[#1a1c18] mb-4">
            Study Smarter.<br />
            <span className="text-[#5150b1]">Score Higher.</span>
          </h1>
          <p className="text-[16px] font-medium text-[#464552] mb-8 px-2">
            AI-powered study plans, smart quizzes, and progress tracking — built for students like you.
          </p>
          <div className="flex flex-col gap-3 mb-10">
            <button
              onClick={() => navigate("/onboarding")}
              className="bg-[#2f312d] text-white py-4 rounded-full text-[14px] font-bold shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-transform"
            >
              Get Started Free
              <Icon name="arrow_forward" className="text-white text-[18px]" />
            </button>
            <a href="#how" className="border border-[#c7c5d4] text-[#1a1c18] py-4 rounded-full text-[14px] font-bold hover:bg-[#e8e9e2] flex items-center justify-center gap-2 transition-colors">
              See How It Works
            </a>
          </div>

          {/* Preview Card */}
          <div className="bg-[#f3f4ed] rounded-3xl p-6 shadow-[0px_10px_30px_rgba(0,0,0,0.04)] text-left border border-white/50 overflow-hidden relative">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-[#ffdcc2] flex items-center justify-center overflow-hidden flex-shrink-0">
                <img alt="Student Avatar" className="w-10 h-10 rounded-full object-cover" src={avatarStudent} />
              </div>
              <div>
                <p className="text-[14px] font-semibold text-[#464552]">Hello, Jacob</p>
                <div className="flex items-center gap-1">
                  <Icon name="bolt" className="text-[#006769] text-[16px]" />
                  <span className="text-[14px] font-bold text-[#1a1c18]">Progress: 78%</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-white p-4 rounded-2xl border border-[#c7c5d4]/20">
                <p className="text-[14px] font-semibold text-[#464552] mb-1">Total Subjects</p>
                <p className="text-[48px] font-extrabold text-[#5150b1] leading-none">12</p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-[#c7c5d4]/20">
                <p className="text-[14px] font-semibold text-[#464552] mb-1">Completed</p>
                <p className="text-[48px] font-extrabold text-[#8d4f0e] leading-none">44</p>
              </div>
            </div>
            <div className="bg-[#2f312d] rounded-2xl p-4 flex justify-between items-center">
              <div>
                <p className="text-[#e2e3dc] text-[14px] font-semibold">Upcoming Tasks</p>
                <p className="text-white text-[20px] font-bold">34 Lessons</p>
              </div>
              <div className="bg-[#6a69cc] p-2 rounded-full flex items-center justify-center w-10 h-10">
                <Icon name="event_available" className="text-white text-[20px]" />
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="px-5 py-10">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[24px] font-bold text-[#1a1c18]">Supercharge Study</h2>
            <Icon name="auto_awesome" className="text-[#5150b1]" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            {features.map((f) => (
              <div key={f.title} className={`${f.bg} p-5 rounded-3xl border flex flex-col gap-3`}>
                <div className={`w-10 h-10 rounded-xl ${f.iconBg} flex items-center justify-center flex-shrink-0 overflow-hidden`}>
                  <Icon name={f.icon} filled className={`${f.iconColor} text-[20px]`} />
                </div>
                <div>
                  <h3 className="text-[14px] font-bold mb-1">{f.title}</h3>
                  <p className="text-[#464552] text-[12px] leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
            <div className="bg-[#e2dfff]/20 border border-[#5150b1]/10 p-5 rounded-3xl col-span-2">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-[#5150b1] flex items-center justify-center flex-shrink-0">
                  <Icon name="query_stats" filled className="text-white text-[20px]" />
                </div>
                <div>
                  <h3 className="text-[14px] font-bold mb-1">Progress Analytics</h3>
                  <p className="text-[#464552] text-[12px] leading-relaxed">Visualize your mastery across every single subject.</p>
                </div>
              </div>
            </div>
            <div className="bg-[#9ef1f2]/20 border border-[#006769]/10 p-5 rounded-3xl col-span-2">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-[#006769] flex items-center justify-center flex-shrink-0">
                  <Icon name="notifications_active" filled className="text-white text-[20px]" />
                </div>
                <div>
                  <h3 className="text-[14px] font-bold mb-1">Smart Reminders</h3>
                  <p className="text-[#464552] text-[12px] leading-relaxed">Nudges that respect your bio-rhythm and energy.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section id="how" className="px-5 py-10 bg-white rounded-[2rem] mx-5 my-4">
          <h2 className="text-[24px] font-bold text-center mb-10">How it works</h2>
          <div className="space-y-10 relative">
            <div className="absolute left-6 top-6 bottom-6 w-px bg-[#c7c5d4]"></div>
            {steps.map((s) => (
              <div key={s.num} className="flex gap-6 relative">
                <div className={`w-12 h-12 rounded-full ${s.bg} ${s.color} flex items-center justify-center font-bold z-10 flex-shrink-0 shadow-md text-[16px]`}>
                  {s.num}
                </div>
                <div>
                  <h4 className="text-[18px] font-bold mb-1">{s.title}</h4>
                  <p className="text-[15px] font-medium text-[#464552]">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-10 text-center">
            <img alt="Study Plan Illustration" className="w-44 h-44 mx-auto mb-6 rounded-3xl object-cover" src={illustrationStudyPlan} />
            <button onClick={() => navigate("/onboarding")} className="bg-[#2f312d] text-white px-8 py-4 rounded-full font-bold shadow-lg active:scale-95 transition-transform">
              Start Now
            </button>
          </div>
        </section>

        {/* Footer */}
        <footer className="pt-10 pb-8 bg-[#f3f4ed] border-t border-[#c7c5d4] flex flex-col items-center text-center px-5 space-y-5 mt-6">
          <div className="flex items-center gap-2">
            <Icon name="school" filled className="text-[#5150b1]" />
            <span className="text-[20px] font-extrabold text-[#5150b1]">SmartPlan</span>
          </div>
          <p className="text-[15px] font-medium text-[#464552]">Master your study flow and unlock your full academic potential.</p>
          <div className="flex gap-6">
            {["Features", "Privacy", "Support"].map((link) => (
              <a key={link} href="#" className="text-[#464552] hover:text-[#5150b1] transition-colors text-[14px] font-semibold">{link}</a>
            ))}
          </div>
          <p className="text-[14px] text-[#464552] opacity-60">© 2026 SmartPlan. Master your study flow.</p>
        </footer>
      </main>

      {/* ── Login Bottom Sheet Modal ─────────────────────────────────────────── */}
      {showLogin && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 z-50 backdrop-blur-sm"
            onClick={closeLogin}
          />

          {/* Sheet */}
          <div className="fixed bottom-0 left-0 right-0 z-50 max-w-[480px] mx-auto bg-[#f9faf3] rounded-t-[32px] px-6 pt-5 pb-10 shadow-[0_-8px_40px_rgba(0,0,0,0.15)] animate-slide-up">

            {/* Drag handle */}
            <div className="w-10 h-1 bg-[#c7c5d4] rounded-full mx-auto mb-6" />

            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-[22px] font-extrabold text-[#1a1c18]">Welcome back</h2>
                <p className="text-[13px] text-[#464552] font-medium mt-0.5">Log in to your SmartPlan account</p>
              </div>
              <button onClick={closeLogin} className="w-9 h-9 rounded-full bg-[#e8e9e2] flex items-center justify-center">
                <Icon name="close" className="text-[#464552] text-[18px]" />
              </button>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 mb-4 flex items-center gap-2">
                <Icon name="error" filled className="text-red-500 text-[18px]" />
                <p className="text-[13px] text-red-600 font-medium">{error}</p>
              </div>
            )}

            {/* Email field */}
            <div className="mb-3">
              <label className="text-[13px] font-semibold text-[#464552] mb-1.5 block">Email</label>
              <div className="flex items-center bg-white border border-[#c7c5d4] rounded-2xl px-4 h-[52px] gap-3 focus-within:border-[#5150b1] transition-colors">
                <Icon name="mail" className="text-[#464552] text-[20px]" />
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="flex-1 bg-transparent text-[15px] font-medium text-[#1a1c18] placeholder:text-[#c7c5d4] outline-none"
                />
              </div>
            </div>

            {/* Password field */}
            <div className="mb-6">
              <label className="text-[13px] font-semibold text-[#464552] mb-1.5 block">Password</label>
              <div className="flex items-center bg-white border border-[#c7c5d4] rounded-2xl px-4 h-[52px] gap-3 focus-within:border-[#5150b1] transition-colors">
                <Icon name="lock" className="text-[#464552] text-[20px]" />
                <input
                  type={showPass ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="flex-1 bg-transparent text-[15px] font-medium text-[#1a1c18] placeholder:text-[#c7c5d4] outline-none"
                />
                <button onClick={() => setShowPass(!showPass)} className="text-[#464552]">
                  <Icon name={showPass ? "visibility_off" : "visibility"} className="text-[20px]" />
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              onClick={handleLogin}
              disabled={submitting}
              className="w-full bg-[#5150b1] text-white py-4 rounded-full text-[15px] font-bold shadow-md active:scale-95 transition-transform disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Logging in…
                </>
              ) : (
                <>
                  <Icon name="login" className="text-white text-[18px]" />
                  Log In
                </>
              )}
            </button>

            {/* Switch to register */}
            <p className="text-center text-[13px] text-[#464552] font-medium mt-5">
              Don't have an account?{" "}
              <button
                onClick={() => { closeLogin(); navigate("/onboarding"); }}
                className="text-[#5150b1] font-bold"
              >
                Sign up free
              </button>
            </p>
          </div>
        </>
      )}
    </div>
  );
}
