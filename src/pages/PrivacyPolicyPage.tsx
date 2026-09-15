import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { useT } from "@/hooks/useI18n";
import { LegalDocument, LegalSection, LegalParagraph, LegalList } from "@/components/legal/LegalDocument";

/**
 * DRAFT TEMPLATE — not legal advice, not ready to publish as-is.
 *
 * Every bracketed [placeholder] below (legal entity name, registered
 * address, governing jurisdiction, contact email) must be filled in with
 * real details, and the whole document reviewed by a lawyer familiar with
 * your jurisdiction and with fintech/PCI-adjacent data-handling rules,
 * before this is relied on as an actual privacy policy. The in-app banner
 * (LegalDocument's `draft` prop) makes that status visible to anyone who
 * opens this page in the meantime — remove it only once the document is
 * final and dated.
 *
 * The sections below reflect what the app, as built, actually does: which
 * third parties see what data (Plaid, Paddle, Anthropic, Supabase, Vercel,
 * and — once wired up — Resend), and the self-service account deletion
 * already shipped in SecurityPage. If those integrations change, this page
 * needs to change with them.
 */
export function PrivacyPolicyPage() {
  const navigate = useNavigate();
  const t = useT();

  return (
    <div className="px-4 pt-6 pb-4 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate(-1)}
          aria-label={t("misc.legal.backAria")}
          className="text-ink-secondary cursor-pointer -ml-1 p-1"
        >
          <ChevronLeft size={22} />
        </button>
        <h1 className="text-xl font-bold text-ink">{t("misc.legal.privacyTitle")}</h1>
      </div>

      <LegalDocument draftNotice={t("misc.legal.draftNotice")} effectiveDate="[Effective Date]">
        <LegalSection title="1. Who this policy covers">
          <LegalParagraph>
            This Privacy Policy explains how [Legal Entity Name] ("Thrive AI", "we", "us") collects, uses, and
            shares information when you use the Thrive AI application (the "Service"). It applies to anyone who
            creates a Thrive AI account.
          </LegalParagraph>
        </LegalSection>

        <LegalSection title="2. Information we collect">
          <LegalParagraph>We collect information in three ways:</LegalParagraph>
          <LegalList
            items={[
              "Information you give us directly: your email address and password (handled by our authentication provider, Supabase — we never see your plain-text password), your name, monthly income, currency and language preferences, and anything you enter yourself — transactions, goals, budgets, recurring bills, manual assets, notes, and photos you upload for receipt scanning.",
              "Information from connected bank accounts: if you choose to link a bank account through Plaid, we receive account balances, transaction history, merchant names, and basic institution details from Plaid. We never receive or store your online banking username or password — those are entered directly into Plaid's own secure interface, not ours.",
              "Information collected automatically: basic usage and device information (such as browser type and general error/crash logs) needed to keep the Service running reliably.",
            ]}
          />
        </LegalSection>

        <LegalSection title="3. How we use your information">
          <LegalParagraph>We use the information above to:</LegalParagraph>
          <LegalList
            items={[
              "Provide the Service — show your transactions, calculate spending and budgets, track goals, and process bank syncs and bill reminders.",
              "Power the AI Advisor and receipt scanner — see Section 4 below for what that specifically involves.",
              "Process subscription payments for the Pro plan, through Paddle.",
              "Send account-related emails — sign-up confirmation, password resets, and (if you opt in) bill reminders and spending digests.",
              "Maintain the security and integrity of the Service, including detecting and preventing abuse.",
              "Comply with legal obligations.",
            ]}
          />
        </LegalSection>

        <LegalSection title="4. How the AI Advisor and receipt scanner work">
          <LegalParagraph>
            When you ask the AI Advisor a question, or scan a receipt, a summary of the relevant data — for the
            Advisor, a compact snapshot of your spending, goals, and upcoming bills (never your raw account
            numbers, and never another user's data); for receipt scanning, the photo itself — is sent to our AI
            provider, Anthropic, solely to generate a response for you. It is processed to answer that one request
            and is not used by us to build a profile of you beyond what's already described in this policy. The
            AI Advisor is an educational tool: nothing it says is financial, investment, tax, or legal advice.
          </LegalParagraph>
        </LegalSection>

        <LegalSection title="5. Who we share information with">
          <LegalParagraph>
            We do not sell your information. We share it only with the service providers who help us run Thrive
            AI, each strictly for the purpose described:
          </LegalParagraph>
          <LegalList
            items={[
              "Plaid — to securely connect and sync your bank accounts, if you choose to link one.",
              "Paddle — to process Pro subscription payments. Paddle acts as merchant of record; we do not receive or store your full card details.",
              "Anthropic — to generate AI Advisor responses and read receipt photos you choose to scan.",
              "Supabase — our database and authentication provider; this is where your account and app data is stored.",
              "Vercel — our application hosting provider.",
              "[Email provider name, e.g. Resend] — to deliver account emails (sign-up confirmation, password resets, bill reminders, and spending digests).",
            ]}
          />
          <LegalParagraph>
            We may also disclose information if required by law, or to protect the rights, safety, or property of
            Thrive AI or our users.
          </LegalParagraph>
        </LegalSection>

        <LegalSection title="6. How long we keep your information, and deleting your account">
          <LegalParagraph>
            We keep your information for as long as your account is active. You can permanently delete your
            account at any time from Profile → Security → Delete Account. Doing so removes your transactions,
            goals, budgets, connected banks, chat history, and profile information from our systems. This action
            cannot be undone.
          </LegalParagraph>
        </LegalSection>

        <LegalSection title="7. Your rights">
          <LegalParagraph>
            Depending on where you live, you may have the right to access, correct, export, or delete your
            personal information, and to object to or restrict certain processing. You can exercise most of these
            rights directly in the app (Profile page), or by contacting us at [Contact Email].
          </LegalParagraph>
        </LegalSection>

        <LegalSection title="8. Security">
          <LegalParagraph>
            We use industry-standard safeguards to protect your information, including encryption in transit and
            database-level access controls (row-level security) that restrict every user's data to that user
            alone. No method of transmission or storage is 100% secure, and we cannot guarantee absolute security.
          </LegalParagraph>
        </LegalSection>

        <LegalSection title="9. Children's privacy">
          <LegalParagraph>
            Thrive AI is not directed at children, and we do not knowingly collect personal information from
            anyone under 18. If you believe a child has provided us with personal information, please contact us
            so we can remove it.
          </LegalParagraph>
        </LegalSection>

        <LegalSection title="10. International data transfers">
          <LegalParagraph>
            Our service providers may process and store information in countries other than your own. Where this
            happens, we rely on those providers' own safeguards for cross-border data transfers.
          </LegalParagraph>
        </LegalSection>

        <LegalSection title="11. Changes to this policy">
          <LegalParagraph>
            We may update this Privacy Policy from time to time. If we make material changes, we'll let you know
            through the app or by email before they take effect.
          </LegalParagraph>
        </LegalSection>

        <LegalSection title="12. Contact us">
          <LegalParagraph>
            Questions about this policy, or about your information? Contact us at [Contact Email].
          </LegalParagraph>
        </LegalSection>
      </LegalDocument>
    </div>
  );
}
