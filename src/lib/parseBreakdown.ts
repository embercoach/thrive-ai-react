import type { Breakdown } from "@/types";

const BREAKDOWN_RE = /<THRIVE_BREAKDOWN>([\s\S]*?)<\/THRIVE_BREAKDOWN>/;

export function parseBreakdown(text: string): { text: string; breakdown: Breakdown | null } {
  const match = text.match(BREAKDOWN_RE);
  if (!match) return { text: text.trim(), breakdown: null };

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
