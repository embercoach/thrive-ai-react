import { useState, useRef, useEffect } from "react";
import { Send, TrendingDown, HelpCircle, BarChart3, UtensilsCrossed, Calendar, PiggyBank, Trash2 } from "lucide-react";
import { useChat } from "@/hooks/useChat";
import { UserBubble, AssistantBubble } from "@/components/ai/ChatBubble";
import { PromptCard } from "@/components/ai/PromptCard";
import { BreakdownCard } from "@/components/ai/BreakdownCard";
import { IntakePreviewCard } from "@/components/ai/IntakePreviewCard";
import { useAppData } from "@/hooks/useAppData";
import { useNavigate } from "react-router-dom";
import UpgradeModal from "@/components/profile/UpgradeModal";

const SUGGESTIONS = [
  { text: "Where did I spend the most this month?", icon: TrendingDown, color: "var(--color-cat-shopping)" },
  { text: "Why is my balance lower?", icon: HelpCircle, color: "var(--color-warning)" },
  { text: "Compare this month with last month", icon: BarChart3, color: "var(--color-info)" },
  { text: "Show my restaurant spending", icon: UtensilsCrossed, color: "var(--color-cat-food)" },
  { text: "What bills are coming up?", icon: Calendar, color: "var(--color-cat-transport)" },
  { text: "How much can I safely save this month?", icon: PiggyBank, color: "var(--color-positive)" },
];

function greeting(name?: string) {
  const h = new Date().getHours();
  const g = h < 12 ? "Good Morning" : h < 17 ? "Good Afternoon" : "Good Evening";
  return `${g}${name ? `, ${name}` : ""} 👋`;
}

export function AdvisorPage() {
  const navigate = useNavigate();
  const { currency } = useAppData();
  const {
    messages,
    loadingHistory,
    sending,
    error,
    send,
    clear,
    confirmIntake,
    dismissIntake,
    questionsUsedThisMonth,
    limitReached,
    freeLimit,
    isPro,
    profileName,
  } = useChat();
  const [input, setInput] = useState("");
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeTrigger, setUpgradeTrigger] = useState("AI questions");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  function handleSend(text: string) {
    if (!text.trim()) return;
    send(text);
    setInput("");
  }

  const isEmpty = !loadingHistory && messages.length === 0;

  return (
    <div className="flex flex-col h-screen">
      <div className="flex items-center justify-between px-5 pt-5 pb-2 flex-shrink-0">
        <h1 className="text-lg font-bold text-ink flex items-center gap-1.5">
          Thrive AI <span className="text-brand">✦</span>
        </h1>
        {messages.length > 0 && (
          <button onClick={clear} aria-label="Clear chat" className="text-ink-muted cursor-pointer">
            <Trash2 size={17} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-3">
        {loadingHistory ? (
          <div className="text-center text-ink-muted text-sm pt-8">Loading…</div>
        ) : isEmpty ? (
          <div className="pt-2">
            <h2 className="text-xl font-bold text-ink mb-1">{greeting(profileName)}</h2>
            <p className="text-ink-secondary text-sm mb-5">What would you like to know?</p>
            <div className="grid grid-cols-2 gap-2.5">
              {SUGGESTIONS.map((s) => (
                <PromptCard key={s.text} text={s.text} icon={s.icon} colorVar={s.color} onClick={() => handleSend(s.text)} />
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4 pt-2">
            {messages.map((m) =>
              m.role === "user" ? (
                <UserBubble key={m.id}>{m.text}</UserBubble>
              ) : (
                <div key={m.id} className="flex flex-col gap-2">
                  {m.text && <AssistantBubble text={m.text} />}
                  {m.breakdown && (
                    <BreakdownCard
                      breakdown={m.breakdown}
                      currency={currency}
                      onViewTransactions={() => navigate("/spending")}
                      onSeeFullAnalysis={() => navigate("/spending")}
                    />
                  )}
                  {m.intakeExpired && (
                    <p className="text-[11px] text-ink-muted pl-8 -mt-1">
                      Add-to-account suggestion from an earlier session — ask again to add it.
                    </p>
                  )}
                  {m.intake && m.intakeStatus !== "dismissed" && (
                    <IntakePreviewCard
                      actions={m.intake}
                      status={m.intakeStatus ?? "pending"}
                      note={m.intakeNote}
                      currency={currency}
                      onConfirm={() =>
                        confirmIntake(m.id, (reason) => {
                          setUpgradeTrigger(reason);
                          setShowUpgradeModal(true);
                        })
                      }
                      onDismiss={() => dismissIntake(m.id)}
                    />
                  )}
                </div>
              )
            )}
            {sending && (
              <div className="flex gap-2 items-center pl-8">
                <span className="text-ink-muted text-xs">Thinking…</span>
              </div>
            )}
            <div ref={scrollRef} />
          </div>
        )}
      </div>

      {error && (
        <div className="px-5 pb-2 flex-shrink-0">
          <p className="text-negative text-xs text-center">{error}</p>
        </div>
      )}

      {!isPro && !limitReached && (
        <div className="px-5 pb-1 flex-shrink-0">
          <p className="text-[10px] text-ink-muted text-center uppercase tracking-wide">
            {freeLimit - questionsUsedThisMonth} of {freeLimit} free questions left this month
          </p>
        </div>
      )}

      <div className="px-5 pb-5 pt-1 flex-shrink-0">
        {limitReached ? (
          <button
            onClick={() => {
              setUpgradeTrigger("AI questions");
              setShowUpgradeModal(true);
            }}
            className="w-full bg-[#9C7440] hover:bg-[#8a6537] text-white font-medium py-3 rounded-full transition-colors"
          >
            Upgrade to keep chatting
          </button>
        ) : (
          <div className="flex items-center gap-2 bg-surface border border-border-strong rounded-full pl-4 pr-1.5 py-1.5">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend(input)}
              placeholder="Ask me anything about your money…"
              disabled={sending}
              className="flex-1 bg-transparent text-ink text-sm outline-none placeholder:text-ink-muted min-w-0"
            />
            <button
              onClick={() => handleSend(input)}
              disabled={!input.trim() || sending}
              aria-label="Send"
              className="w-8 h-8 rounded-full bg-brand text-ink-on-brand flex items-center justify-center flex-shrink-0 disabled:opacity-40 cursor-pointer"
            >
              <Send size={14} />
            </button>
          </div>
        )}
      </div>

      <UpgradeModal
        open={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        triggeredBy={upgradeTrigger}
      />
    </div>
  );
}