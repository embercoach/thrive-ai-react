import type { ReactNode } from "react";
import { ThumbsUp, ThumbsDown, Copy, RotateCcw, Check } from "lucide-react";
import { useState } from "react";
import { useT } from "@/hooks/useI18n";

/** `imageUrl`, when given, shows a thumbnail of a photo the user just sent
 *  (e.g. a receipt scan) above the text — session-local only, since the
 *  photo itself is never persisted to chat history (see useChat.ts's
 *  sendReceipt). */
export function UserBubble({ children, imageUrl }: { children: ReactNode; imageUrl?: string }) {
  return (
    <div className="flex justify-end">
      <div className="bg-brand text-ink-on-brand rounded-2xl rounded-br-md px-3.5 py-2.5 max-w-[78%] font-semibold text-sm">
        {imageUrl && <img src={imageUrl} alt="" className="rounded-xl mb-2 max-h-40 w-auto object-cover" />}
        {children}
      </div>
    </div>
  );
}

interface AssistantBubbleProps {
  text: string;
  onRetry?: () => void;
}

/** The AI's voice — Lora, not Inter, mirroring how Claude.ai itself
 * separates "the interface talking" from "the AI talking." */
export function AssistantBubble({ text, onRetry }: AssistantBubbleProps) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const [rating, setRating] = useState<"up" | "down" | null>(null);

  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  }

  return (
    <div className="flex gap-2 items-start">
      <div className="w-6.5 h-6.5 rounded-lg bg-brand flex-shrink-0 mt-0.5 flex items-center justify-center overflow-hidden">
        <div className="w-[42%] h-[42%] bg-canvas" style={{ clipPath: "polygon(0 0,72% 0,100% 28%,100% 100%,0 100%)" }} />
      </div>
      <div className="max-w-[82%]">
        <div className="bg-surface border border-border rounded-2xl rounded-tl-md px-3.5 py-2.5 shadow-card">
          <div className="text-[9px] font-bold uppercase tracking-wide text-ink-muted mb-1">{t("aiComponents.chatBubble.aiLabel")}</div>
          <div className="font-voice text-[15px] text-ink leading-relaxed whitespace-pre-line">{text}</div>
        </div>
        <div className="flex gap-3.5 mt-2 pl-0.5 text-ink-muted">
          <button
            onClick={() => setRating("up")}
            aria-label={t("aiComponents.chatBubble.goodResponse")}
            className={`cursor-pointer transition-colors ${rating === "up" ? "text-brand" : "hover:text-ink-secondary"}`}
          >
            <ThumbsUp size={14} />
          </button>
          <button
            onClick={() => setRating("down")}
            aria-label={t("aiComponents.chatBubble.badResponse")}
            className={`cursor-pointer transition-colors ${rating === "down" ? "text-brand" : "hover:text-ink-secondary"}`}
          >
            <ThumbsDown size={14} />
          </button>
          <button onClick={handleCopy} aria-label={t("aiComponents.chatBubble.copy")} className="cursor-pointer hover:text-ink-secondary transition-colors">
            {copied ? <Check size={14} className="text-brand" /> : <Copy size={14} />}
          </button>
          {onRetry && (
            <button onClick={onRetry} aria-label={t("aiComponents.chatBubble.retry")} className="cursor-pointer hover:text-ink-secondary transition-colors">
              <RotateCcw size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
