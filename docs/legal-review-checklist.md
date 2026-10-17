# Legal review checklist

Before launch, a lawyer reviews and edits the three legal pages. The copy is
drafted to be accurate to the code; counsel's pass should be tweaks, not
rewrites. Budget one hour.

## Source files (single source of truth per page)

- Terms: [`src/content/legal/terms.ts`](../src/content/legal/terms.ts)
- Privacy: [`src/content/legal/privacy.ts`](../src/content/legal/privacy.ts)
- Refund: [`src/content/legal/refund.ts`](../src/content/legal/refund.ts)
- Shared: [`src/content/legal/shared.ts`](../src/content/legal/shared.ts)
  (last-updated date, contact derivation from `NEXT_PUBLIC_APP_URL`)
- Renderer: [`src/components/legal-doc.tsx`](../src/components/legal-doc.tsx)
- Footer: [`src/components/site-footer.tsx`](../src/components/site-footer.tsx)

Live at `/terms`, `/privacy`, `/refund`. Rendered by `LegalDoc`; edit the
content files, not the renderer.

## Items counsel must confirm

- [ ] **Governing jurisdiction.** The terms page currently says the
  jurisdiction "will be confirmed during legal review." Pick one and write
  it in.
- [ ] **Refund enforceability + window.** 7-day full refund — confirm the 7-day window itself with counsel before publishing. One email, processed via
  Gumroad in 5–10 business days. Confirm this matches Gumroad's seller terms
  and the card networks' rules in the chosen jurisdiction.
- [ ] **Cookie classification.** We set one cookie (`cd_session`, httpOnly,
  `Secure` in production, 14-day expiry, `SameSite=Lax`, strictly necessary
  for sign-in). Confirm no banner is required under GDPR/ePrivacy, and
  confirm the wording on the privacy page.
- [ ] **GDPR DPA language.** Our subprocessors are Supabase (Postgres, US
  region), Resend (email), and Gumroad (payments). Confirm whether customer
  DPAs with each are needed, and whether the US-region storage needs a
  transfer-mechanism note for EU learners.
- [ ] **Retention periods.** Account data: lifetime + 12 months. Certificate
  records (id, name, milestone, hash): indefinite, for verify-link
  permanence. Confirm both survive a deletion-request challenge.
- [ ] **Marketing claims.** "7-day money-back guarantee," "no sale of data
  — ever," "education, not financial advice." Confirm each is defensible as
  written wherever it appears (legal pages, footer, Gumroad listings).
- [ ] **Certificate disclaimer.** The certificate is described as a record of
  completion, not a credential or licence. Confirm that framing holds where
  certificates are shown (`/cert`, `/verify`, share copy).
- [ ] **Children's age gate.** The policy says under-18s are excluded but the
  app enforces no age check. Confirm whether a self-declaration at unlock is
  required.
- [ ] **Gumroad product descriptions.** Each of the three tier listings must
  link the public `/terms`, `/privacy`, and `/refund` URLs. This is edited in
  the Gumroad dashboard, not the repo — confirm it is done.

## Contact routing

- General + refund requests: `hello@<domain>` (derived from
  `NEXT_PUBLIC_APP_URL`; falls back to `hello@yourdomain.com` when unset).
- Privacy requests (access, deletion, portability): `privacy@<domain>`.
- Decide who answers each inbox before launch, and set the 30-day response
  expectation on the privacy inbox.

## After review

1. Apply counsel's edits to the three content files.
2. Bump `LEGAL_UPDATED` in `src/content/legal/shared.ts` to the review date.
3. Re-run `node --test tests/legal.test.mjs` and `npx playwright test legal`.
4. Record the review date and reviewer here:

> Reviewed by: _pending_ · Date: _pending_
