import { useState, useEffect, useCallback } from "react";
import api, { scheduleAPI } from "../services/api";

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

const QUALITY = {
  excellent: { label: "Best Match", bg: "bg-[#006769]",    text: "text-white"       },
  good:      { label: "Good Fit",   bg: "bg-[#5150b1]",    text: "text-white"       },
  fair:      { label: "Available",  bg: "bg-[#f3f4ed]",    text: "text-[#464552]"   },
};

function getQuality(score) {
  if (score >= 80) return "excellent";
  if (score >= 60) return "good";
  return "fair";
}

function formatDate(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  return {
    day:   d.toLocaleDateString("en-US", { weekday: "long"  }),
    short: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  };
}

export default function RescheduleModal({ session, onClose, onRescheduled }) {
  const [slots,   setSlots]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(null);  // index of slot being saved
  const [error,   setError]   = useState("");

  useEffect(() => { fetchSlots(); }, []);

  const fetchSlots = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.post("/ai/reschedule", { sessionId: session._id });
      const raw = res.data?.slots || [];
      // Compute quality from score if AI returned numeric score
      setSlots(raw.map(s => ({ ...s, quality: getQuality(s.score ?? 75) })));
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't find available slots.");
    } finally {
      setLoading(false);
    }
 }, [session._id]);

const chooseSlot = async (slot, idx) => {
  setSaving(idx);
  try {
    await scheduleAPI.update(session._id, {
      date:      slot.date,
      startTime: slot.startTime,
      endTime:   slot.endTime,
      status:    "pending",
    });
    const newDate = new Date(slot.date + "T12:00:00").toLocaleDateString("en-US", {
      weekday: "long", month: "short", day: "numeric",
    });
    alert(`✅ Session moved to ${newDate} at ${slot.startTime}`);
    onRescheduled?.();
    onClose();
  } catch (err) {
    setError("Failed to reschedule. Please try again.");
    setSaving(null);
  }
};

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-[480px] bg-[#f9faf3] rounded-t-[32px] max-h-[88vh] flex flex-col overflow-hidden animate-slide-up">

        {/* ── Header ── */}
        <div className="px-5 pt-5 pb-4 flex-shrink-0">
          <div className="w-10 h-1 bg-[#c7c5d4] rounded-full mx-auto mb-4" />
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-[14px] bg-[#ba1a1a]/10 flex items-center justify-center flex-shrink-0">
                <Icon name="event_busy" filled className="text-[#ba1a1a] text-[20px]" />
              </div>
              <div>
                <h2 className="font-bold text-lg text-[#1a1c18] leading-tight">Reschedule Session</h2>
                <p className="text-xs text-[#464552] mt-0.5">AI is finding the best slot for you</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-white flex items-center justify-center shadow-sm border border-[#e2e3dc] flex-shrink-0"
            >
              <Icon name="close" className="text-[#464552] text-[20px]" />
            </button>
          </div>

          {/* Missed session info */}
          <div className="mt-4 bg-[#ba1a1a]/8 border border-[#ba1a1a]/15 rounded-[18px] px-4 py-3 flex items-center gap-3">
            <div className="w-1 h-10 rounded-full bg-[#ba1a1a] flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-[#1a1c18] truncate">{session.subjectName}</p>
              <p className="text-xs text-[#464552] font-medium">
                {session.topicName || "General"} · {session.startTime}–{session.endTime}
              </p>
            </div>
            <span className="text-[10px] font-bold bg-[#ba1a1a] text-white px-2 py-1 rounded-full flex-shrink-0">
              Missed
            </span>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto px-5 pb-8 space-y-3">

          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-10 gap-5">
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-[#5150b1]/10 flex items-center justify-center">
                  <div className="w-9 h-9 rounded-full border-[3px] border-[#5150b1] border-t-transparent animate-spin" />
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Icon name="auto_awesome" filled className="text-[#5150b1] text-[16px]" />
                </div>
              </div>
              <div className="text-center">
                <p className="font-bold text-[#1a1c18]">Finding optimal slots…</p>
                <p className="text-xs text-[#464552] mt-1">Checking energy peaks, context grouping & deadlines</p>
              </div>
              <div className="w-full space-y-2">
                {[
                  { icon: "bolt",            text: "Matching your energy peak hours"           },
                  { icon: "psychology",      text: "Checking context & subject grouping"        },
                  { icon: "access_time",     text: "Prioritising within 24–48h for streak"      },
                  { icon: "hourglass_empty", text: "Avoiding overloaded days"                   },
                ].map(({ icon, text }, i) => (
                  <div key={i} className="flex items-center gap-3 bg-white rounded-[14px] px-4 py-2.5 shadow-sm border border-[#e2e3dc]/60">
                    <Icon name={icon} className="text-[#5150b1] text-[16px] flex-shrink-0" />
                    <p className="text-xs text-[#464552] font-medium">{text}</p>
                    <div className="ml-auto flex gap-0.5">
                      {[0,1,2].map(j => (
                        <div key={j} className="w-1 h-1 rounded-full bg-[#5150b1] animate-bounce"
                          style={{ animationDelay: `${i * 0.1 + j * 0.08}s` }} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <>
              <div className="flex items-start gap-2 bg-[#ffdad6] border border-[#ff897d]/30 rounded-2xl px-4 py-3">
                <Icon name="error" filled className="text-[#93000a] text-[18px] flex-shrink-0 mt-0.5" />
                <p className="text-sm text-[#93000a] font-medium">{error}</p>
              </div>
              <button
                onClick={fetchSlots}
                className="w-full py-3.5 bg-[#5150b1] text-white font-bold rounded-[20px] flex items-center justify-center gap-2"
              >
                <Icon name="refresh" className="text-[18px]" /> Try Again
              </button>
            </>
          )}

          {/* Slot suggestions */}
          {!loading && !error && slots.length > 0 && (
            <>
              <p className="text-xs font-bold text-[#464552] uppercase tracking-wider px-1">
                {slots.length} Recommended Slots
              </p>

              {slots.map((slot, idx) => {
                const q    = QUALITY[slot.quality] || QUALITY.fair;
                const date = formatDate(slot.date);
                const isBest = slot.quality === "excellent";

                return (
                  <div
                    key={idx}
                    className={`bg-white rounded-[20px] p-4 shadow-sm border ${
                      isBest ? "border-[#006769]/30" : "border-[#e2e3dc]/60"
                    } relative overflow-hidden`}
                  >
                    {isBest && (
                      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#006769] to-[#5150b1]" />
                    )}

                    {/* Date + quality badge */}
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-bold text-[#1a1c18] text-base">{date.day}</p>
                        <p className="text-xs text-[#464552] font-medium">{date.short} · {slot.startTime}–{slot.endTime}</p>
                      </div>
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${q.bg} ${q.text}`}>
                        {q.label}
                      </span>
                    </div>

                    {/* Tags */}
                    {slot.tags && slot.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {slot.tags.map((tag) => (
                          <span key={tag} className="text-[10px] font-semibold bg-[#f3f4ed] text-[#464552] px-2 py-1 rounded-full border border-[#e2e3dc]">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Reason */}
                    {slot.reason && (
                      <p className="text-xs text-[#464552] bg-[#f9faf3] rounded-xl px-3 py-2 mb-3 leading-relaxed">
                        {slot.reason}
                      </p>
                    )}

                    {/* CTA */}
                    <button
                      onClick={() => chooseSlot(slot, idx)}
                      disabled={saving !== null}
                      className={`w-full py-3 rounded-[14px] text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 ${
                        isBest
                          ? "bg-[#5150b1] text-white shadow-sm"
                          : "bg-[#f3f4ed] text-[#1a1c18]"
                      }`}
                    >
                      {saving === idx ? (
                        <>
                          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          Rescheduling…
                        </>
                      ) : (
                        <>
                          <Icon name="event_available" filled className="text-[18px]" />
                          Reschedule Here
                        </>
                      )}
                    </button>
                  </div>
                );
              })}

              {/* Retry option */}
              <button
                onClick={fetchSlots}
                className="w-full py-3 rounded-[20px] border border-[#c7c5d4] text-[#464552] text-sm font-bold flex items-center justify-center gap-2"
              >
                <Icon name="refresh" className="text-[16px]" />
                Find Different Slots
              </button>
            </>
          )}

          {/* No slots */}
          {!loading && !error && slots.length === 0 && (
            <div className="text-center py-10 space-y-3">
              <p className="text-4xl">😔</p>
              <p className="font-bold text-[#1a1c18]">No free slots found</p>
              <p className="text-sm text-[#464552]">Your next 7 days look packed. Try manually adding a session.</p>
              <button onClick={fetchSlots} className="text-sm text-[#5150b1] font-bold underline">Try again</button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}