import type { IntakeAction } from "@/types";

const INTAKE_RE = /<THRIVE_INTAKE>([\s\S]*?)<\/THRIVE_INTAKE>/;
// Matches an opening tag with no matching close — e.g. the model's response
// got cut off mid-block (hit max_tokens) before it could close the tag.
const UNTERMINATED_INTAKE_RE = /<THRIVE_INTAKE>[\s\S]*$/;

const VALID_ACTION_TYPES: ReadonlySet<IntakeAction["type"]> = new Set([
  "monthly_income",
  "transaction",
  "goal",
  "recurring",
]);

export interface ParsedIntake {
  actions: IntakeAction[];
}

// The system prompts for /api/chat and /api/scan-receipt instruct the model
// to only ever emit one of the four known `type` strings, but that's a
// prompt convention, not enforcement — a hallucination, or text injected
// into a photographed receipt that influences the model's free-form JSON
// generation, can produce any other string (or omit `type` entirely). Every
// consumer of this array (IntakePreviewCard's TYPE_ICON/TYPE_LABEL lookups
// in particular) indexes straight off `type` with no fallback, so an
// unrecognized value used to crash the whole page the moment the message
// rendered — no user interaction required. Filtering here, once, keeps
// every downstream consumer safe without needing its own guard.
function isValidAction(a: unknown): a is IntakeAction {
  return (
    typeof a === "object" &&
    a !== null &&
    typeof (a as { type?: unknown }).type === "string" &&
    VALID_ACTION_TYPES.has((a as { type: IntakeAction["type"] }).type)
  );
}

export function parseIntake(text: string): { text: string; intake: ParsedIntake | null; hadIntake: boolean } {
  const match = text.match(INTAKE_RE);
  if (match) {
    const cleanedText = text.replace(INTAKE_RE, "").trim();
    try {
      const parsed = JSON.parse(match[1]);
      if (Array.isArray(parsed.actions)) {
        const actions = (parsed.actions as unknown[]).filter(isValidAction);
        if (actions.length > 0) {
          return { text: cleanedText, intake: { actions }, hadIntake: true };
        }
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
