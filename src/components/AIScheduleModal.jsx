import { useState } from "react";
import api, { scheduleAPI } from "../services/api";

const DAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const Icon = ({ name, filled = false, className = "" }) => (
  <span
    className={`material-symbols-outlined ${className}`}
    style={{
      fontVariationSettings: filled
        ? "'FILL' 1, 'wght' 500, 'GRAD' 0, 'opsz' 24"
        : "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24",
    }}
  >
    {name}
  </span>
);

const SectionCard = ({ title, icon, children }) => (
  <div className="bg-white rounded-[20px] p-4 shadow-sm border border-[#e2e3dc]/60">
    <div className="flex items-center gap-2 mb-3">
      <div className="w-6 h-6 rounded-full bg-[#5150b1]/10 flex items-center justify-center">
        <Icon name={icon} className="text-[#5150b1] text-[13px]" />
      </div>
      <p className="text-xs font-bold text-[#464552] uppercase tracking-wider">{title}</p>
    </div>
    {children}
  </div>
);

const PillGroup = ({ options, value, onChange }) => (
  <div className="flex gap-2 flex-wrap">
    {options.map((opt) => (
      <button
        key={opt.value}
        onClick={() => onChange(opt.value)}
        className={`px-3 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 ${
          value === opt.value
            ? "bg-[#5150b1] text-white shadow-sm"
            : "bg-[#f3f4ed] text-[#464552]"
        }`}
      >
        {opt.label}
      </button>
    ))}
  </div>
);

export default function AIScheduleModal({ onClose, onScheduleCreated }) {
  const [step, setStep]           = useState(1);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [config, setConfig]       = useState({
    // ── Basic ──────────────────────────────────────────────
    startDate:    new Date().toISOString().split("T")[0],
    weeks:        1,
    selectedDays: [0, 1, 2, 3, 4],
    // ── Advanced ───────────────────────────────────────────
    studyStart:      "08:00",   // when study day begins
    studyEnd:        "21:00",   // when study day ends
    lunchTime:       "13:00",   // lunch break start
    lunchDuration:   60,        // minutes
    leisureTime:     "18:00",   // leisure/personal time start
    leisureDuration: 120,       // minutes
    sessionLength:   60,        // minutes per study session (60 / 90 / 120)
    energyPeak:      "morning", // morning | afternoon | evening
    bufferPercent:   20,        // % of slots left empty as buffer
  });
  const [generatedSessions, setGeneratedSessions] = useState([]);
  const [removedIndexes, setRemovedIndexes]       = useState(new Set());
  const [error, setError]                         = useState("");

  const set = (key, val) => setConfig((c) => ({ ...c, [key]: val }));

  const toggleDay = (idx) =>
    setConfig((c) => ({
      ...c,
      selectedDays: c.selectedDays.includes(idx)
        ? c.selectedDays.filter((d) => d !== idx)
        : [...c.selectedDays, idx].sort((a, b) => a - b),
    }));

  /* ── derived ── */
  const activeSessions = generatedSessions.filter((_, i) => !removedIndexes.has(i));
  const groupedByDate  = {};
  generatedSessions.forEach((s, origIdx) => {
    if (removedIndexes.has(origIdx)) return;
    if (!groupedByDate[s.date]) groupedByDate[s.date] = [];
    groupedByDate[s.date].push({ ...s, _origIdx: origIdx });
  });

  /* ── generate via backend ── */
  const generateSchedule = async () => {
    if (config.selectedDays.length === 0) return;
    setStep(2);
    setError("");
    try {
      const res = await api.post("/ai/schedule", config);
      const sessions = res.data?.sessions;
      if (!Array.isArray(sessions) || sessions.length === 0)
        throw new Error("AI returned an empty schedule. Try adjusting your preferences.");
      setGeneratedSessions(sessions);
      setRemovedIndexes(new Set());
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Couldn't generate schedule. Please try again.");
      setStep(1);
    }
  };

  /* ── save ── */
  const saveSchedule = async () => {
    setStep(4);
    try {
      const toSave = generatedSessions
        .filter((_, i) => !removedIndexes.has(i))
        .map((s) => ({
          subjectId: s.subjectId,
          ...(s.topicId ? { topicId: s.topicId } : {}),
          date:      s.date,
          startTime: s.startTime,
          endTime:   s.endTime,
        }));
      await scheduleAPI.bulkCreate(toSave);
      onScheduleCreated?.();
      onClose();
    } catch {
      setError("Failed to save sessions. Please try again.");
      setStep(3);
    }
  };

  /* ── step labels ── */
  const stepLabel = {
    1: "Configure your schedule",
    2: "AI is building your plan…",
    3: `${activeSessions.length} sessions ready`,
    4: "Saving sessions…",
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-[480px] bg-[#f9faf3] rounded-t-[32px] max-h-[92vh] flex flex-col overflow-hidden animate-slide-up">

        {/* ── Header ── */}
        <div className="px-5 pt-5 pb-4 flex-shrink-0">
          <div className="w-10 h-1 bg-[#c7c5d4] rounded-full mx-auto mb-4" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-[14px] bg-[#5150b1] flex items-center justify-center shadow-sm">
                <Icon name="auto_awesome" filled className="text-white text-[20px]" />
              </div>
              <div>
                <h2 className="font-bold text-lg text-[#1a1c18] leading-tight">AI Schedule</h2>
                <p className="text-xs text-[#464552]">{stepLabel[step]}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-white flex items-center justify-center shadow-sm border border-[#e2e3dc]"
            >
              <Icon name="close" className="text-[#464552] text-[20px]" />
            </button>
          </div>
          <div className="flex gap-1.5 mt-4">
            {[1,2,3,4].map((s) => (
              <div key={s} className={`h-1 flex-1 rounded-full transition-all duration-500 ${s <= step ? "bg-[#5150b1]" : "bg-[#e2e3dc]"}`} />
            ))}
          </div>
        </div>

        {/* ── Scrollable Body ── */}
        <div className="flex-1 overflow-y-auto px-5 pb-8 space-y-3">

          {/* ════ STEP 1 — Configure ════ */}
          {step === 1 && (
            <>
              {error && (
                <div className="flex items-start gap-2 bg-[#ffdad6] border border-[#ff897d]/30 rounded-2xl px-4 py-3">
                  <Icon name="error" filled className="text-[#93000a] text-[18px] flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-[#93000a] font-medium">{error}</p>
                </div>
              )}

              {/* Start date */}
              <SectionCard title="Start Date" icon="calendar_today">
                <input
                  type="date"
                  value={config.startDate}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={(e) => set("startDate", e.target.value)}
                  className="w-full h-11 bg-[#f3f4ed] rounded-xl px-3 text-sm font-semibold text-[#1a1c18] focus:outline-none focus:ring-2 focus:ring-[#5150b1]"
                />
              </SectionCard>

              {/* Weeks */}
              <SectionCard title="Duration" icon="date_range">
                <div className="flex gap-2">
                  {[1,2,3,4].map((w) => (
                    <button
                      key={w}
                      onClick={() => set("weeks", w)}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95 ${
                        config.weeks === w ? "bg-[#5150b1] text-white shadow-sm" : "bg-[#f3f4ed] text-[#464552]"
                      }`}
                    >
                      {w}W
                    </button>
                  ))}
                </div>
              </SectionCard>

              {/* Study days */}
              <SectionCard title="Study Days" icon="event_available">
                <div className="flex gap-1.5">
                  {DAYS_SHORT.map((day, i) => (
                    <button
                      key={day}
                      onClick={() => toggleDay(i)}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                        config.selectedDays.includes(i) ? "bg-[#5150b1] text-white" : "bg-[#f3f4ed] text-[#464552]"
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
                {config.selectedDays.length === 0 && (
                  <p className="text-xs text-[#ba1a1a] mt-2 font-medium">Select at least one day</p>
                )}
              </SectionCard>

              {/* ── Advanced toggle ── */}
              <button
                onClick={() => setShowAdvanced((v) => !v)}
                className="w-full flex items-center justify-between bg-white rounded-[20px] p-4 shadow-sm border border-[#e2e3dc]/60 active:scale-[0.99] transition-transform"
              >
                <div className="flex items-center gap-2">
                  <Icon name="tune" className="text-[#5150b1] text-[18px]" />
                  <span className="text-sm font-bold text-[#1a1c18]">Personalise Schedule</span>
                  <span className="text-[10px] bg-[#5150b1] text-white px-2 py-0.5 rounded-full font-bold">NEW</span>
                </div>
                <Icon
                  name="expand_more"
                  className={`text-[#464552] text-[20px] transition-transform duration-300 ${showAdvanced ? "rotate-180" : ""}`}
                />
              </button>

              {/* ── Advanced options ── */}
              {showAdvanced && (
                <div className="space-y-3">

                  {/* Study window */}
                  <SectionCard title="Study Window" icon="schedule">
                    <p className="text-xs text-[#464552] mb-2 font-medium">When does your study day start and end?</p>
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <p className="text-[10px] font-bold text-[#464552] mb-1.5 uppercase tracking-wide">Start</p>
                        <input
                          type="time"
                          value={config.studyStart}
                          onChange={(e) => set("studyStart", e.target.value)}
                          className="w-full h-11 bg-[#f3f4ed] rounded-xl px-3 text-sm font-semibold text-[#1a1c18] focus:outline-none focus:ring-2 focus:ring-[#5150b1]"
                        />
                      </div>
                      <div className="flex-1">
                        <p className="text-[10px] font-bold text-[#464552] mb-1.5 uppercase tracking-wide">End</p>
                        <input
                          type="time"
                          value={config.studyEnd}
                          onChange={(e) => set("studyEnd", e.target.value)}
                          className="w-full h-11 bg-[#f3f4ed] rounded-xl px-3 text-sm font-semibold text-[#1a1c18] focus:outline-none focus:ring-2 focus:ring-[#5150b1]"
                        />
                      </div>
                    </div>
                  </SectionCard>

                  {/* Lunch break */}
                  <SectionCard title="Lunch Break" icon="restaurant">
                    <p className="text-xs text-[#464552] mb-2 font-medium">No sessions will be scheduled during this window.</p>
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <p className="text-[10px] font-bold text-[#464552] mb-1.5 uppercase tracking-wide">Time</p>
                        <input
                          type="time"
                          value={config.lunchTime}
                          onChange={(e) => set("lunchTime", e.target.value)}
                          className="w-full h-11 bg-[#f3f4ed] rounded-xl px-3 text-sm font-semibold text-[#1a1c18] focus:outline-none focus:ring-2 focus:ring-[#5150b1]"
                        />
                      </div>
                      <div className="flex-1">
                        <p className="text-[10px] font-bold text-[#464552] mb-1.5 uppercase tracking-wide">Duration</p>
                        <PillGroup
                          options={[{label:"30m",value:30},{label:"60m",value:60},{label:"90m",value:90}]}
                          value={config.lunchDuration}
                          onChange={(v) => set("lunchDuration", v)}
                        />
                      </div>
                    </div>
                  </SectionCard>

                  {/* Leisure time */}
                  <SectionCard title="Leisure & Personal Time" icon="self_improvement">
                    <p className="text-xs text-[#464552] mb-2 font-medium">Protected downtime — critical to avoid burnout.</p>
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <p className="text-[10px] font-bold text-[#464552] mb-1.5 uppercase tracking-wide">Time</p>
                        <input
                          type="time"
                          value={config.leisureTime}
                          onChange={(e) => set("leisureTime", e.target.value)}
                          className="w-full h-11 bg-[#f3f4ed] rounded-xl px-3 text-sm font-semibold text-[#1a1c18] focus:outline-none focus:ring-2 focus:ring-[#5150b1]"
                        />
                      </div>
                      <div className="flex-1">
                        <p className="text-[10px] font-bold text-[#464552] mb-1.5 uppercase tracking-wide">Duration</p>
                        <PillGroup
                          options={[{label:"1h",value:60},{label:"2h",value:120},{label:"3h",value:180}]}
                          value={config.leisureDuration}
                          onChange={(v) => set("leisureDuration", v)}
                        />
                      </div>
                    </div>
                  </SectionCard>

                  {/* Session length */}
                  <SectionCard title="Session Length" icon="timer">
                    <p className="text-xs text-[#464552] mb-2 font-medium">Deep work needs longer blocks. Revision can be shorter.</p>
                    <PillGroup
                      options={[
                        { label: "60 min — Revision",   value: 60  },
                        { label: "90 min — Deep Work",  value: 90  },
                        { label: "120 min — Intensive", value: 120 },
                      ]}
                      value={config.sessionLength}
                      onChange={(v) => set("sessionLength", v)}
                    />
                  </SectionCard>

                  {/* Energy peak */}
                  <SectionCard title="Your Energy Peak" icon="bolt">
                    <p className="text-xs text-[#464552] mb-2 font-medium">Hard subjects get scheduled during your peak hours.</p>
                    <PillGroup
                      options={[
                        { label: "🌅 Morning (6–12)",    value: "morning"   },
                        { label: "☀️ Afternoon (12–17)", value: "afternoon" },
                        { label: "🌙 Evening (17–22)",   value: "evening"   },
                      ]}
                      value={config.energyPeak}
                      onChange={(v) => set("energyPeak", v)}
                    />
                  </SectionCard>

                  {/* Buffer */}
                  <SectionCard title="Buffer Time" icon="hourglass_empty">
                    <p className="text-xs text-[#464552] mb-2 font-medium">Leave empty slots for overflow and unexpected tasks.</p>
                    <PillGroup
                      options={[
                        { label: "10% — Tight",    value: 10 },
                        { label: "20% — Balanced", value: 20 },
                        { label: "30% — Relaxed",  value: 30 },
                      ]}
                      value={config.bufferPercent}
                      onChange={(v) => set("bufferPercent", v)}
                    />
                  </SectionCard>

                </div>
              )}

              {/* Summary */}
              <div className="bg-[#5150b1]/8 rounded-[20px] p-4 border border-[#5150b1]/15">
                <p className="text-xs font-bold text-[#5150b1] uppercase tracking-wider mb-3">Plan Summary</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "Weeks",       value: `${config.weeks}`                                       },
                    { label: "Days/week",   value: `${config.selectedDays.length}`                         },
                    { label: "Session",     value: `${config.sessionLength}m`                              },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-white rounded-[14px] p-3 text-center shadow-sm">
                      <p className="text-base font-bold text-[#5150b1]">{value}</p>
                      <p className="text-[10px] text-[#464552] font-medium mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
                {showAdvanced && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {[
                      `🍽 Lunch ${config.lunchTime}`,
                      `🎮 Leisure ${config.leisureTime}`,
                      `⚡ Peak: ${config.energyPeak}`,
                      `🛡 ${config.bufferPercent}% buffer`,
                    ].map((tag) => (
                      <span key={tag} className="text-[10px] bg-white text-[#464552] font-semibold px-2 py-1 rounded-full shadow-sm border border-[#e2e3dc]">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={generateSchedule}
                disabled={config.selectedDays.length === 0}
                className="w-full py-4 bg-[#5150b1] text-white font-bold rounded-[20px] flex items-center justify-center gap-2 shadow-lg disabled:opacity-40 active:scale-[0.98] transition-transform"
              >
                <Icon name="auto_awesome" filled className="text-[20px]" />
                Generate My Schedule
              </button>
            </>
          )}

          {/* ════ STEP 2 — Generating ════ */}
          {step === 2 && (
            <div className="flex flex-col items-center justify-center py-10 gap-6">
              <div className="relative">
                <div className="w-20 h-20 rounded-full bg-[#5150b1]/10 flex items-center justify-center">
                  <div className="w-11 h-11 rounded-full border-[3px] border-[#5150b1] border-t-transparent animate-spin" />
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Icon name="auto_awesome" filled className="text-[#5150b1] text-[20px]" />
                </div>
              </div>
              <div className="text-center">
                <p className="font-bold text-[#1a1c18] text-lg">Building your plan…</p>
                <p className="text-sm text-[#464552] mt-1">Respecting your breaks, peak hours & buffer time</p>
              </div>
              <div className="w-full space-y-2">
                {[
                  { icon: "bolt",            text: "Scheduling hard subjects at peak hours"       },
                  { icon: "restaurant",      text: "Blocking lunch & leisure windows"              },
                  { icon: "shuffle",         text: "Grouping related subjects together"            },
                  { icon: "hourglass_empty", text: `Leaving ${config.bufferPercent}% buffer slots` },
                ].map(({ icon, text }, i) => (
                  <div key={i} className="flex items-center gap-3 bg-white rounded-[16px] px-4 py-3 shadow-sm border border-[#e2e3dc]/60">
                    <div className="w-8 h-8 rounded-full bg-[#5150b1]/10 flex items-center justify-center flex-shrink-0">
                      <Icon name={icon} className="text-[#5150b1] text-[16px]" />
                    </div>
                    <p className="text-sm text-[#1a1c18] font-medium flex-1">{text}</p>
                    <div className="flex gap-1">
                      {[0,1,2].map((j) => (
                        <div key={j} className="w-1.5 h-1.5 rounded-full bg-[#5150b1] animate-bounce"
                          style={{ animationDelay: `${i * 0.15 + j * 0.1}s` }} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ════ STEP 3 — Preview ════ */}
          {step === 3 && (
            <>
              {error && (
                <div className="flex items-start gap-2 bg-[#ffdad6] border border-[#ff897d]/30 rounded-2xl px-4 py-3">
                  <Icon name="error" filled className="text-[#93000a] text-[18px] flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-[#93000a] font-medium">{error}</p>
                </div>
              )}
              <div className="flex items-center justify-between py-1">
                <p className="text-xs text-[#464552] font-medium">Tap × to remove any session</p>
                <button onClick={() => setStep(1)} className="text-xs text-[#5150b1] font-bold flex items-center gap-1">
                  <Icon name="tune" className="text-[14px]" /> Reconfigure
                </button>
              </div>

              {Object.entries(groupedByDate)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([date, sessions]) => (
                  <div key={date} className="bg-white rounded-[20px] p-4 shadow-sm border border-[#e2e3dc]/60">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-6 h-6 rounded-full bg-[#5150b1]/10 flex items-center justify-center">
                        <Icon name="calendar_today" className="text-[#5150b1] text-[12px]" />
                      </div>
                      <p className="text-xs font-bold text-[#5150b1] uppercase tracking-wider">
                        {new Date(date + "T12:00:00").toLocaleDateString("en-US", {
                          weekday: "long", month: "short", day: "numeric",
                        })}
                      </p>
                      <span className="ml-auto text-[10px] text-[#464552] font-medium">{sessions.length} sessions</span>
                    </div>
                    <div className="space-y-2">
                      {sessions.map((s) => (
                        <div key={s._origIdx} className="flex items-center gap-3 bg-[#f3f4ed] rounded-[14px] px-3 py-2.5">
                          <div className="w-1 h-10 rounded-full bg-[#5150b1] flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-[#1a1c18] truncate">{s.subjectName}</p>
                            <p className="text-xs text-[#464552] truncate font-medium">
                              {s.topicName || "General"} · {s.startTime}–{s.endTime}
                            </p>
                          </div>
                          <button
                            onClick={() => setRemovedIndexes((r) => new Set([...r, s._origIdx]))}
                            className="w-7 h-7 rounded-full bg-white flex items-center justify-center shadow-sm border border-[#e2e3dc] flex-shrink-0"
                          >
                            <Icon name="close" className="text-[#464552] text-[14px]" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

              {activeSessions.length === 0 && (
                <div className="text-center py-10 space-y-2">
                  <p className="text-4xl">📭</p>
                  <p className="text-sm font-bold text-[#1a1c18]">All sessions removed</p>
                  <button onClick={() => setStep(1)} className="text-sm text-[#5150b1] font-bold underline">Reconfigure</button>
                </div>
              )}

              <button
                onClick={saveSchedule}
                disabled={activeSessions.length === 0}
                className="w-full py-4 bg-[#5150b1] text-white font-bold rounded-[20px] flex items-center justify-center gap-2 shadow-lg disabled:opacity-40 active:scale-[0.98] transition-transform"
              >
                <Icon name="save" filled className="text-[20px]" />
                Save {activeSessions.length} Session{activeSessions.length !== 1 ? "s" : ""}
              </button>
            </>
          )}

          {/* ════ STEP 4 — Saving ════ */}
          {step === 4 && (
            <div className="flex flex-col items-center justify-center py-16 gap-5">
              <div className="w-20 h-20 rounded-full bg-[#5150b1]/10 flex items-center justify-center">
                <div className="w-11 h-11 rounded-full border-[3px] border-[#5150b1] border-t-transparent animate-spin" />
              </div>
              <div className="text-center">
                <p className="font-bold text-[#1a1c18] text-lg">Saving your schedule…</p>
                <p className="text-sm text-[#464552] mt-1">
                  Adding {activeSessions.length} session{activeSessions.length !== 1 ? "s" : ""} to your plan
                </p>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}