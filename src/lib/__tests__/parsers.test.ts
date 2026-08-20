import { describe, it, expect } from "vitest";
import { parseIntake } from "@/lib/parseIntake";
import { parseBreakdown } from "@/lib/parseBreakdown";

// The whole point of these parsers is that a user must NEVER see raw tag
// text or partial JSON in a chat bubble — that shipped to production twice.
const NEVER_VISIBLE = [/<THRIVE_INTAKE>/, /<THRIVE_BREAKDOWN>/, /"actions"/, /"items"/];

function assertClean(text: string) {
  for (const re of NEVER_VISIBLE) expect(text).not.toMatch(re);
}

describe("parseIntake", () => {
  it("extracts actions and strips the block from the visible text", () => {
    const raw =
      'Here you go.\n\n<THRIVE_INTAKE>{"actions":[{"type":"transaction","name":"Coffee","amount":-25.5,"category":"Food"}]}</THRIVE_INTAKE>';
    const { text, intake, hadIntake } = parseIntake(raw);
    expect(text).toBe("Here you go.");
    expect(hadIntake).toBe(true);
    expect(intake?.actions).toHaveLength(1);
    expect(intake?.actions[0].name).toBe("Coffee");
    assertClean(text);
  });

  it("strips an unterminated block when the model hits max_tokens", () => {
    const raw = 'Prepared.\n\n<THRIVE_INTAKE>{"actions":[{"type":"transa';
    const { text, intake, hadIntake } = parseIntake(raw);
    expect(text).toBe("Prepared.");
    expect(intake).toBeNull();
    expect(hadIntake).toBe(true);
    assertClean(text);
  });

  it("strips a malformed block rather than leaking the JSON", () => {
    const raw = "Oops.\n\n<THRIVE_INTAKE>{not json at all}</THRIVE_INTAKE>";
    const { text, intake } = parseIntake(raw);
    expect(text).toBe("Oops.");
    expect(intake).toBeNull();
    assertClean(text);
  });

  it("treats an empty actions array as no intake", () => {
    const raw = 'Nothing to add.\n\n<THRIVE_INTAKE>{"actions":[]}</THRIVE_INTAKE>';
    const { intake } = parseIntake(raw);
    expect(intake).toBeNull();
  });

  it("reports hadIntake=false for ordinary replies", () => {
    const { text, intake, hadIntake } = parseIntake("Just a normal answer.");
    expect(text).toBe("Just a normal answer.");
    expect(intake).toBeNull();
    expect(hadIntake).toBe(false);
  });
});

describe("parseBreakdown", () => {
  it("extracts items and strips the block", () => {
    const raw =
      'Your rent dominates.\n\n<THRIVE_BREAKDOWN>{"items":[{"label":"Rent","amount":-700,"category":"Housing"}]}</THRIVE_BREAKDOWN>';
    const { text, breakdown } = parseBreakdown(raw);
    expect(text).toBe("Your rent dominates.");
    expect(breakdown?.items).toHaveLength(1);
    assertClean(text);
  });

  it("strips an unterminated breakdown block", () => {
    const raw = 'Here:\n\n<THRIVE_BREAKDOWN>{"items":[{"label":"Re';
    const { text, breakdown } = parseBreakdown(raw);
    expect(text).toBe("Here:");
    expect(breakdown).toBeNull();
    assertClean(text);
  });
});

describe("both blocks in one reply", () => {
  it("strips breakdown then intake, leaving only prose", () => {
    const raw =
      'Summary.\n\n<THRIVE_BREAKDOWN>{"items":[{"label":"Rent","amount":-700,"category":"Housing"}]}</THRIVE_BREAKDOWN>\n<THRIVE_INTAKE>{"actions":[{"type":"monthly_income","amount":2850}]}</THRIVE_INTAKE>';
    const afterBreakdown = parseBreakdown(raw);
    const afterIntake = parseIntake(afterBreakdown.text);
    expect(afterBreakdown.breakdown?.items).toHaveLength(1);
    expect(afterIntake.intake?.actions).toHaveLength(1);
    expect(afterIntake.text).toBe("Summary.");
    assertClean(afterIntake.text);
  });
});
