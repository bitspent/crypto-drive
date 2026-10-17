import { LEGAL_UPDATED, type LegalDoc } from "./shared";

export const termsDoc: LegalDoc = {
  slug: "terms",
  title: "Terms of Service",
  description:
    "The terms governing your use of Crypto Drive: what the course is, what it is not, licenses, liability, and how to reach us.",
  updated: LEGAL_UPDATED,
  sections: [
    {
      heading: "What Crypto Drive is",
      blocks: [
        {
          type: "paragraph",
          text: "Crypto Drive is an educational course that teaches Bitcoin fundamentals through guided lessons and simulated exercises. You receive payments, verify them, send small test amounts, and practise key management — all with play money, never real funds.",
        },
        {
          type: "paragraph",
          text: "The certificate you can earn is a record of completion. It is not a professional credential, a licence, a degree, or evidence of regulated status. It carries no employment, compliance, or regulatory standing on its own.",
        },
      ],
    },
    {
      heading: "What this course is not",
      blocks: [
        {
          type: "paragraph",
          text: "Nothing in this course is financial advice, investment advice, or a recommendation to buy, sell, or hold any asset. Crypto Drive is not a regulated financial service, a broker, an exchange, or a custodian.",
        },
        {
          type: "paragraph",
          text: "If you make decisions about real money or real Bitcoin, consult a qualified professional who understands your situation. Do not treat course exercises as instructions for handling real funds.",
        },
      ],
    },
    {
      heading: "Simulated practice",
      blocks: [
        {
          type: "paragraph",
          text: "All wallet exercises use simulated data and, where enabled, the signet test network. No real Bitcoin is involved at any point. Every address, balance, and transaction shown inside the practice wallet is fictional and deterministic, generated so you can learn safely.",
        },
        {
          type: "paragraph",
          text: "Never send real funds to any address shown in the course. Practice addresses are not monitored, and anything sent to them cannot be recovered by us.",
        },
      ],
    },
    {
      heading: "Your account and licence",
      blocks: [
        {
          type: "paragraph",
          text: "One licence covers one learner. Licences are non-transferable: do not share your licence key, lend your account, or publish course materials. Demo keys are for evaluation only and may be disabled at any time.",
        },
        {
          type: "paragraph",
          text: "We may suspend or terminate accounts used for key sharing, fraud, automated scraping, or any attempt to disrupt the service.",
        },
      ],
    },
    {
      heading: "Your rights",
      blocks: [
        {
          type: "list",
          items: [
            "Access the course content included in your tier for as long as your account is in good standing.",
            "Export a copy of your learning data and certificate records on request.",
            "Ask us to delete your account and personal data, as described in the Privacy Policy.",
            "Keep a working public verify link for each certificate you earned, including after cancellation.",
          ],
        },
      ],
    },
    {
      heading: "Our rights",
      blocks: [
        {
          type: "list",
          items: [
            "Update, correct, or reorganise course content at any time; we will not remove a tier you paid for without offering an equivalent or a refund.",
            "Suspend or terminate accounts for abuse, fraud, or violation of these terms.",
            "Discontinue the service with at least 30 days notice by email; the refund policy applies to recent purchases.",
          ],
        },
      ],
    },
    {
      heading: "Refunds",
      blocks: [
        {
          type: "paragraph",
          text: "Every purchase carries a 7-day money-back guarantee: one email, no forms, no questions asked. The full policy lives on the Refund Policy page.",
        },
      ],
    },
    {
      heading: "Limitation of liability",
      blocks: [
        {
          type: "paragraph",
          text: "The course is provided for education without warranty of accuracy, completeness, or fitness for any particular purpose. To the maximum extent permitted by law, we are not liable for decisions you make based on course content, for funds sent to practice addresses, or for any indirect or consequential loss.",
        },
        {
          type: "paragraph",
          text: "Our total liability for any claim arising from your use of Crypto Drive is limited to the amount you paid for your licence.",
        },
      ],
    },
    {
      heading: "Changes to these terms",
      blocks: [
        {
          type: "paragraph",
          text: "When these terms change, we will tell you by email and with an in-app notice before the new terms take effect. Continued use of the course after the effective date means you accept the updated terms.",
        },
      ],
    },
    {
      heading: "Governing law",
      blocks: [
        {
          type: "paragraph",
          text: "The governing jurisdiction for these terms will be confirmed during legal review before launch.",
        },
      ],
    },
  ],
};
