export type LegalBlock =
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] };

export type LegalSection = {
  heading: string;
  blocks: LegalBlock[];
};

export type LegalDoc = {
  slug: "terms" | "privacy" | "refund";
  title: string;
  description: string;
  updated: string;
  sections: LegalSection[];
};

export const LEGAL_UPDATED = "October 16, 2026";

function domain(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (raw) {
    try {
      return new URL(raw).hostname;
    } catch {
      // Fall through to the placeholder below.
    }
  }
  return "yourdomain.com";
}

export function supportEmail(): string {
  return `hello@${domain()}`;
}

export function privacyEmail(): string {
  return `privacy@${domain()}`;
}
