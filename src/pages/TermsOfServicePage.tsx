import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { useT } from "@/hooks/useI18n";
import { LegalDocument, LegalSection, LegalParagraph, LegalList } from "@/components/legal/LegalDocument";

/**
 * DRAFT TEMPLATE — see the same note at the top of PrivacyPolicyPage.tsx.
 * Not legal advice; needs real entity/contact/jurisdiction details and a
 * lawyer's review before publishing.
 */
export function TermsOfServicePage() {
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
        <h1 className="text-xl font-bold text-ink">{t("misc.legal.termsTitle")}</h1>
      </div>

      <LegalDocument draftNotice={t("misc.legal.draftNotice")} effectiveDate="[Effective Date]">
        <LegalSection title="1. Agreement to these terms">
          <LegalParagraph>
            These Terms of Service ("Terms") are an agreement between you and [Legal Entity Name] ("Thrive AI",
            "we", "us") governing your use of the Thrive AI application (the "Service"). By creating an account or
            using the Service, you agree to these Terms. If you don't agree, please don't use the Service.
          </LegalParagraph>
        </LegalSection>

        <LegalSection title="2. What Thrive AI is — and isn't">
          <LegalParagraph>
            Thrive AI is a personal finance tracking and budgeting tool with an AI-powered Advisor. Thrive AI is
            not a bank, is not a licensed financial advisor, broker, or tax professional, and does not hold or
            move your money. Everything the AI Advisor tells you is educational in nature — not financial,
            investment, tax, or legal advice — and you should consult a licensed professional for guidance
            specific to your situation.
          </LegalParagraph>
        </LegalSection>

        <LegalSection title="3. Eligibility and your account">
          <LegalParagraph>
            You must be at least 18 years old to use Thrive AI. You're responsible for keeping your login
            credentials confidential and for everything that happens under your account. Tell us right away at
            [Contact Email] if you suspect unauthorized access to your account.
          </LegalParagraph>
        </LegalSection>

        <LegalSection title="4. Connecting bank accounts">
          <LegalParagraph>
            Bank connections are provided through Plaid, a third-party service. When you link an account, you're
            also agreeing to Plaid's own end-user terms. We display the transaction and balance data Plaid gives
            us as accurately as we can, but we don't guarantee it's complete, current, or error-free — always
            check your bank's own records for anything that matters.
          </LegalParagraph>
        </LegalSection>

        <LegalSection title="5. Free and Pro plans, billing, and cancellation">
          <LegalParagraph>
            Thrive AI offers a free plan with limited goals, budget categories, recurring bills, and AI Advisor
            questions per month, and a paid Pro plan that removes those limits. Pro subscriptions are billed and
            processed by Paddle, our payment provider and merchant of record, on a recurring basis (monthly or
            annual, as selected at checkout) until cancelled. You can cancel anytime from the Profile page or
            through Paddle's own billing portal; cancellation takes effect at the end of the current billing
            period. [Refund policy — e.g. "Refunds are handled case-by-case; contact us at [Contact Email]" or
            link to Paddle's buyer terms.]
          </LegalParagraph>
        </LegalSection>

        <LegalSection title="6. Acceptable use">
          <LegalParagraph>You agree not to:</LegalParagraph>
          <LegalList
            items={[
              "Use the Service for anything illegal, or in a way that infringes anyone else's rights.",
              "Attempt to access another user's account or data.",
              "Reverse-engineer, scrape, or interfere with the Service, or abuse the AI Advisor to generate harmful, abusive, or illegal content.",
              "Circumvent free-plan limits or payment for the Pro plan.",
            ]}
          />
        </LegalSection>

        <LegalSection title="7. Your content">
          <LegalParagraph>
            You own the data you put into Thrive AI — your transactions, goals, notes, and receipt photos. You
            grant us a limited license to use that data solely to operate and improve the Service for you (for
            example, sending it to our AI provider to answer a question you asked — see our Privacy Policy for
            details). We don't claim ownership of your content.
          </LegalParagraph>
        </LegalSection>

        <LegalSection title="8. Disclaimers and limitation of liability">
          <LegalParagraph>
            The Service is provided "as is," without warranties of any kind, to the fullest extent permitted by
            law. We do not warrant that the Service will be uninterrupted, error-free, or that any AI-generated
            content will be accurate. To the fullest extent permitted by law, [Legal Entity Name] will not be
            liable for any indirect, incidental, or consequential damages arising from your use of the Service,
            including financial decisions made based on information in the app.
          </LegalParagraph>
        </LegalSection>

        <LegalSection title="9. Termination">
          <LegalParagraph>
            You may stop using Thrive AI and delete your account at any time from Profile → Security → Delete
            Account. We may suspend or terminate accounts that violate these Terms.
          </LegalParagraph>
        </LegalSection>

        <LegalSection title="10. Governing law">
          <LegalParagraph>
            These Terms are governed by the laws of [Governing Jurisdiction], without regard to its conflict-of-law
            provisions.
          </LegalParagraph>
        </LegalSection>

        <LegalSection title="11. Changes to these terms">
          <LegalParagraph>
            We may update these Terms from time to time. If we make material changes, we'll let you know through
            the app or by email before they take effect. Continuing to use Thrive AI after changes take effect
            means you accept the updated Terms.
          </LegalParagraph>
        </LegalSection>

        <LegalSection title="12. Contact us">
          <LegalParagraph>Questions about these Terms? Contact us at [Contact Email].</LegalParagraph>
        </LegalSection>
      </LegalDocument>
    </div>
  );
}
