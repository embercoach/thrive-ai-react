import type { IntakeAction } from "@/types";

const INTAKE_RE = /<THRIVE_INTAKE>([\s\S]*?)<\/THRIVE_INTAKE>/;
// Matches an opening tag with no matching close — e.g. the model's response
// got cut off mid-block (hit max_tokens) before it could close the tag.
const UNTERMINATED_INTAKE_RE = /<THRIVE_INTAKE>[\s\S]*$/;

export interface ParsedIntake {
  actions: IntakeAction[];
}

export function parseIntake(text: string): { text: string; intake: ParsedIntake | null; hadIntake: boolean } {
  const match = text.match(INTAKE_RE);
  if (match) {
    const cleanedText = text.replace(INTAKE_RE, "").trim();
    try {
      const parsed = JSON.parse(match[1]);
      if (Array.isArray(parsed.actions) && parsed.actions.length > 0) {
        return { text: cleanedText, intake: { actions: parsed.actions as IntakeAction[] }, hadIntake: true };
      }
    } catch {
      // Malformed block from the model — fall through and just show the text.
    }
    return { text: cleanedText, intake: null, hadIntake: true };
  }

  // No closing tag at all — most likely a truncated response. Never show the
  // raw/partial tag or JSON to the user; strip it and fall back to plain text.
  if (/<THRIVE_INTAKE>/.test(text)) {
    return { text: text.replace(UNTERMINATED_INTAKE_RE, "").trim(), intake: null, hadIntake: true };
  }

  return { text: text.trim(), intake: null, hadIntake: false };
}
