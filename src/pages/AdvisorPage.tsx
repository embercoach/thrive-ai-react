import { useState, useRef, useEffect } from "react";
import { Send, TrendingDown, HelpCircle, BarChart3, UtensilsCrossed, Calendar, PiggyBank, Trash2, Camera } from "lucide-react";
import { useChat } from "@/hooks/useChat";
import { UserBubble, AssistantBubble } from "@/components/ai/ChatBubble";
import { PromptCard } from "@/components/ai/PromptCard";
import { BreakdownCard } from "@/components/ai/BreakdownCard";
import { IntakePreviewCard } from "@/components/ai/IntakePreviewCard";
import { useAppData } from "@/hooks/useAppData";
import { useT } from "@/hooks/useI18n";
import { useNavigate, useLocation } from "react-router-dom";
import UpgradeModal from "@/components/profile/UpgradeModal";

function greeting(t: (key: string, vars?: Record<string, string | number>) => string, name?: string) {
  const h = new Date().getHours();
  const g = h < 12 ? t("common.greetingMorning") : h < 17 ? t("common.greetingAfternoon") : t("common.greetingEvening");
  return `${g}${name ? `, ${name}` : ""} 👋`;
}

export function AdvisorPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const t = useT();
  const { currency } = useAppData();
  const {
    messages,
    loadingHistory,
    sending,
    error,
    send,
    sendReceipt,
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
  const [upgradeTrigger, setUpgradeTrigger] = useState("aiQuestions");
  const scrollRef = useRef<HTMLDivElement>(null);
  const receiptInputRef = useRef<HTMLInputElement>(null);

  function handleReceiptSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset immediately so choosing the exact same file again still fires
    // onChange next time — the browser otherwise treats an unchanged value
    // as a no-op and never re-triggers this handler.
    e.target.value = "";
    if (file) sendReceipt(file);
  }

  const SUGGESTIONS = [
    { text: t("advisor.suggestion1"), icon: TrendingDown, color: "var(--color-cat-shopping)" },
    { text: t("advisor.suggestion2"), icon: HelpCircle, color: "var(--color-warning)" },
    { text: t("advisor.suggestion3"), icon: BarChart3, color: "var(--color-info)" },
    { text: t("advisor.suggestion4"), icon: UtensilsCrossed, color: "var(--color-cat-food)" },
    { text: t("advisor.suggestion5"), icon: Calendar, color: "var(--color-cat-transport)" },
    { text: t("advisor.suggestion6"), icon: PiggyBank, color: "var(--color-positive)" },
  ];

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  function handleSend(text: string) {
    if (!text.trim()) return;
    send(text);
    setInput("");
  }

  // Screens like CategoryDetailPage's "Ask Thrive about this" link here via
  // navigate("/ai", { state: { prompt } }) so the question is asked
  // immediately instead of just prefilling the input. This used to be
  // silently dropped — nothing ever read `location.state` — so the button
  // looked broken: it landed on an empty (or unrelated) chat with no sign
  // the tap did anything. Waits for chat history to finish loading first
  // so this doesn't race the existing-messages fetch, and clears the nav
  // state via `replace` so navigating back to /ai later (or a re-render)
  // never re-sends the same question a second time.
  const consumedNavPrompt = useRef(false);
  useEffect(() => {
    const prompt = (location.state as { prompt?: string } | null)?.prompt;
    if (!prompt || loadingHistory || consumedNavPrompt.current) return;
    consumedNavPrompt.current = true;
    handleSend(prompt);
    navigate(location.pathname, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, loadingHistory]);

  const isEmpty = !loadingHistory && messages.length === 0;

  return (
    <div className="flex flex-col h-screen">
      <div className="flex items-center justify-between px-5 pt-5 pb-2 flex-shrink-0">
        <h1 className="text-lg font-bold text-ink flex items-center gap-1.5">
          {t("advisor.title")} <span className="text-brand">✦</span>
        </h1>
        {messages.length > 0 && (
          <button onClick={clear} aria-label={t("advisor.clearAria")} className="text-ink-muted cursor-pointer">
            <Trash2 size={17} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-3">
        {loadingHistory ? (
          <div className="text-center text-ink-muted text-sm pt-8">{t("advisor.loading")}</div>
        ) : isEmpty ? (
          <div className="pt-2">
            <h2 className="text-xl font-bold text-ink mb-1">{greeting(t, profileName)}</h2>
            <p className="text-ink-secondary text-sm mb-5">{t("advisor.whatWouldYouLike")}</p>
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
                <UserBubble key={m.id} imageUrl={m.imagePreviewUrl}>
                  {m.text}
                </UserBubble>
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
                      {t("advisor.intakeExpired")}
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
                <span className="text-ink-muted text-xs">{t("advisor.thinking")}</span>
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
            {t("advisor.freeQuestionsLeft", { left: freeLimit - questionsUsedThisMonth, total: freeLimit })}
          </p>
        </div>
      )}

      <div className="px-5 pb-5 pt-1 flex-shrink-0">
        {limitReached ? (
          <button
            onClick={() => {
              setUpgradeTrigger("aiQuestions");
              setShowUpgradeModal(true);
            }}
            className="w-full bg-[#9C7440] hover:bg-[#8a6537] text-white font-medium py-3 rounded-full transition-colors"
          >
            {t("advisor.upgradeToKeepChatting")}
          </button>
        ) : (
          <div className="flex items-center gap-2 bg-surface border border-border-strong rounded-full pl-2 pr-1.5 py-1.5">
            <input
              ref={receiptInputRef}
              type="file"
              accept="image/*"
              // No `capture` restriction — lets the OS picker offer both
              // "take a photo" and "choose from library", since a receipt
              // photographed a moment ago is just as common as one taken
              // fresh right now.
              onChange={handleReceiptSelected}
              className="hidden"
            />
            <button
              onClick={() => receiptInputRef.current?.click()}
              disabled={sending}
              aria-label={t("advisor.scanReceiptAria")}
              className="w-8 h-8 rounded-full text-ink-secondary flex items-center justify-center flex-shrink-0 disabled:opacity-40 cursor-pointer hover:text-ink transition-colors"
            >
              <Camera size={17} />
            </button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend(input)}
              placeholder={t("advisor.inputPlaceholder")}
              disabled={sending}
              className="flex-1 bg-transparent text-ink text-sm outline-none placeholder:text-ink-muted min-w-0"
            />
            <button
              onClick={() => handleSend(input)}
              disabled={!input.trim() || sending}
              aria-label={t("advisor.sendAria")}
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
