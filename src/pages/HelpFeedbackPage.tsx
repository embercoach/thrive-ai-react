import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, CircleCheck } from "lucide-react";
import { supabase } from "../services/supabase";
import { useAuth } from "../hooks/useAuth";

export function HelpFeedbackPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    const trimmed = message.trim();
    if (!trimmed) {
      setError("Please enter a message before sending.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const { error: insertError } = await supabase.from("feedback").insert({
      user_id: user?.id ?? null,
      email: user?.email ?? null,
      message: trimmed,
    });

    setSubmitting(false);

    if (insertError) {
      setError("Something went wrong sending your feedback. Please try again.");
      return;
    }

    setSubmitted(true);
    setMessage("");
  };

  return (
    <div className="px-4 pt-6 pb-4 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate("/profile")}
          aria-label="Back"
          className="text-ink-secondary cursor-pointer -ml-1 p-1"
        >
          <ChevronLeft size={22} />
        </button>
        <h1 className="text-xl font-bold text-ink">Help & Feedback</h1>
      </div>

      {submitted ? (
        <div className="flex flex-col items-center text-center pt-10 pb-6 gap-3">
          <CircleCheck size={44} className="text-brand" />
          <h2 className="text-lg font-bold text-ink">Thanks for the feedback</h2>
          <p className="text-sm text-ink-secondary max-w-xs leading-relaxed">
            We read every message. If you asked a question and included your
            email, we'll get back to you.
          </p>
          <button
            onClick={() => setSubmitted(false)}
            className="mt-1 text-sm font-semibold text-brand cursor-pointer"
          >
            Send another message
          </button>
        </div>
      ) : (
        <>
          <div className="bg-surface border border-border rounded-2xl p-4">
            <p className="text-sm text-ink-secondary leading-relaxed">
              Found a bug, have an idea, or need help with something? Let us
              know below and we'll get back to you.
            </p>
          </div>

          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Tell us what's on your mind..."
            rows={6}
            className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-ink placeholder-ink-muted focus:outline-none focus:ring-2 focus:ring-brand/30 resize-none"
          />

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full rounded-2xl bg-brand text-ink-on-brand font-semibold py-3.5 disabled:opacity-50 cursor-pointer"
          >
            {submitting ? "Sending..." : "Send Feedback"}
          </button>
        </>
      )}
    </div>
  );
}