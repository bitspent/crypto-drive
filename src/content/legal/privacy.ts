import { LEGAL_UPDATED, type LegalDoc } from "./shared";

export const privacyDoc: LegalDoc = {
  slug: "privacy",
  title: "Privacy Policy",
  description:
    "What Crypto Drive collects, why we collect it, where it lives, how long we keep it, and the rights you have over it.",
  updated: LEGAL_UPDATED,
  sections: [
    {
      heading: "What we collect",
      blocks: [
        {
          type: "list",
          items: [
            "Your email address, provided at unlock.",
            "Your licence key hash and tier (we store a one-way hash, never the key itself).",
            "Purchase metadata from Gumroad: product, price, currency, and date.",
            "Your course progress: steps completed, answers submitted, certificates earned.",
            "Your practice wallet state: simulated balances and transaction history.",
            "Your IP address, used for rate limiting and abuse prevention.",
            "Your user agent string, used for debugging display problems.",
          ],
        },
      ],
    },
    {
      heading: "What we never collect",
      blocks: [
        {
          type: "list",
          items: [
            "Real Bitcoin addresses, extended public keys, or wallet descriptors.",
            "Seed phrases, private keys, or anything that could move real funds.",
            "Payment card details — Gumroad processes every payment and never shares card numbers with us.",
          ],
        },
      ],
    },
    {
      heading: "How we use your data",
      blocks: [
        {
          type: "list",
          items: [
            "To deliver the course: unlock your tier, save your progress, run the practice wallet.",
            "To issue and verify certificates you earn.",
            "To send transactional email: licence delivery, receipts, and service notices.",
            "To prevent abuse: rate limiting, fraud detection, and licence sharing checks.",
          ],
        },
      ],
    },
    {
      heading: "Where your data lives",
      blocks: [
        {
          type: "paragraph",
          text: "Course data is stored in Supabase (Postgres, US region). The app itself runs on Vercel. Transactional email is sent through Resend. Payments are processed by Gumroad. These four providers are our only subprocessors, named here so your procurement or compliance team can review them directly.",
        },
      ],
    },
    {
      heading: "How long we keep it",
      blocks: [
        {
          type: "paragraph",
          text: "We keep your account data for the lifetime of your account plus 12 months, then delete it. Certificate records are the exception: the certificate id, holder name, milestone, and attestation hash are retained indefinitely so that public verify links keep working — that permanence is the point of a verifiable credential.",
        },
        {
          type: "paragraph",
          text: "If you ask for deletion, we remove everything except certificate records within 30 days.",
        },
      ],
    },
    {
      heading: "Who we share it with",
      blocks: [
        {
          type: "paragraph",
          text: "Nobody beyond the three subprocessors named above. There is no analytics beyond what this page discloses, no advertising network, no data broker, and no sale of personal data — ever. We disclose data to authorities only where legally compelled, and we will tell you unless the law forbids it.",
        },
      ],
    },
    {
      heading: "Your rights",
      blocks: [
        {
          type: "paragraph",
          text: "You may ask for a copy of your data, a correction, deletion, or a portable export at any time. Send one email to {{privacy}} from the address on your account and we will respond within 30 days.",
        },
      ],
    },
    {
      heading: "Cookies",
      blocks: [
        {
          type: "paragraph",
          text: "We set exactly one cookie: cd_session, an httpOnly session identifier with a 14-day expiry that keeps you signed in. It carries the Secure flag in production. It is strictly necessary for the course to function. There are no tracking cookies, no third-party cookies, and no cookie-based analytics — which is why you see no cookie banner.",
        },
      ],
    },
    {
      heading: "Children",
      blocks: [
        {
          type: "paragraph",
          text: "Crypto Drive is not for users under 18. We do not knowingly collect data from children; if you believe a child has created an account, contact us and we will delete it promptly.",
        },
      ],
    },
    {
      heading: "Changes to this policy",
      blocks: [
        {
          type: "paragraph",
          text: "When this policy changes, we will tell you by email and with an in-app notice before the new policy takes effect. The previous version remains available on request.",
        },
      ],
    },
  ],
};
