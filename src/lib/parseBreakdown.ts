import type { Breakdown } from "@/types";

const BREAKDOWN_RE = /<THRIVE_BREAKDOWN>([\s\S]*?)<\/THRIVE_BREAKDOWN>/;
const UNTERMINATED_BREAKDOWN_RE = /<THRIVE_BREAKDOWN>[\s\S]*$/;

export function parseBreakdown(text: string): { text: string; breakdown: Breakdown | null } {
  const match = text.match(BREAKDOWN_RE);
  if (!match) {
    // The response may have been truncated (e.g. hit max_tokens) before the
    // model could emit the closing tag. Strip the dangling opening tag and
    // whatever partial JSON followed it rather than leaking it into the chat.
    if (UNTERMINATED_BREAKDOWN_RE.test(text)) {
      return { text: text.replace(UNTERMINATED_BREAKDOWN_RE, "").trim(), breakdown: null };
    }
    return { text: text.trim(), breakdown: null };
  }

  const cleanedText = text.replace(BREAKDOWN_RE, "").trim();
  try {
    const parsed = JSON.parse(match[1]);
    if (Array.isArray(parsed.items)) {
      return { text: cleanedText, breakdown: parsed as Breakdown };
    }
  } catch {
    // Malformed block from the model — fall through and just show the text.
  }
  return { text: cleanedText, breakdown: null };
}
