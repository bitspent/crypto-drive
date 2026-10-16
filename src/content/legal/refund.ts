import { LEGAL_UPDATED, type LegalDoc } from "./shared";

export const refundDoc: LegalDoc = {
  slug: "refund",
  title: "Refund Policy",
  description:
    "A 14-day money-back guarantee on every tier. One email, no forms, no questions asked.",
  updated: LEGAL_UPDATED,
  sections: [
    {
      heading: "The guarantee",
      blocks: [
        {
          type: "paragraph",
          text: "Every purchase — Starter, Certified, and VIP — carries a 14-day money-back guarantee from the date of purchase. If the course is not for you, for any reason or no reason, you get a full refund.",
        },
      ],
    },
    {
      heading: "After 14 days",
      blocks: [
        {
          type: "paragraph",
          text: "Purchases older than 14 days are not eligible for refunds. If something in the course is broken — a step that cannot be completed, a certificate that will not issue — tell us and we will fix the defect promptly, regardless of purchase date.",
        },
      ],
    },
    {
      heading: "How to ask",
      blocks: [
        {
          type: "paragraph",
          text: "Send one email to {{support}} from the address you purchased with. No forms, no account login, no chat queue, no exit interview. Include your purchase email if you write from a different address.",
        },
      ],
    },
    {
      heading: "How refunds arrive",
      blocks: [
        {
          type: "paragraph",
          text: "Refunds are processed through Gumroad back to your original payment method, usually within 5–10 business days depending on your bank. You will receive a confirmation email once the refund is issued.",
        },
      ],
    },
    {
      heading: "Why we do this",
      blocks: [
        {
          type: "paragraph",
          text: "This is an educational product, and the honest way to sell education is to let you try it first. Work through the drives, earn the certificate, and then decide whether it was worth it.",
        },
      ],
    },
  ],
};
