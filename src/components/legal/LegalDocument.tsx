import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";

/**
 * Shared layout for the Privacy Policy and Terms of Service pages — kept
 * separate from AboutPage's one-off markup since these two documents are
 * long enough (many titled sections, bulleted lists) to want their own
 * small set of building blocks rather than repeating the same className
 * strings a dozen times per page.
 */

interface LegalDocumentProps {
  /** Shown once, near the top, in an amber "this isn't final yet" banner. Pass "" to hide it once the document is genuinely finalized. */
  draftNotice: string;
  /** Rendered as "[Effective Date]" until replaced with a real date. */
  effectiveDate: string;
  children: ReactNode;
}

export function LegalDocument({ draftNotice, effectiveDate, children }: LegalDocumentProps) {
  return (
    <>
      {draftNotice && (
        <div className="bg-[#F5A623]/10 border border-[#F5A623]/30 rounded-2xl p-4">
          <p className="text-xs text-ink-secondary leading-relaxed">{draftNotice}</p>
        </div>
      )}

      <Card padding="lg">
        <p className="text-xs text-ink-muted mb-4">{effectiveDate}</p>
        <div className="flex flex-col gap-5">{children}</div>
      </Card>
    </>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h2 className="text-sm font-bold text-ink mb-1.5">{title}</h2>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

export function LegalParagraph({ children }: { children: ReactNode }) {
  return <p className="text-sm text-ink-secondary leading-relaxed">{children}</p>;
}

export function LegalList({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-col gap-1.5 pl-4">
      {items.map((item, i) => (
        <li key={i} className="text-sm text-ink-secondary leading-relaxed list-disc">
          {item}
        </li>
      ))}
    </ul>
  );
}
