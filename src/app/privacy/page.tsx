import type { Metadata } from "next";
import { LegalDoc } from "@/components/legal-doc";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { privacyDoc } from "@/content/legal/privacy";
import { getAppUrl } from "@/lib/share";

export const metadata: Metadata = {
  title: privacyDoc.title,
  description: privacyDoc.description,
  alternates: { canonical: `${getAppUrl()}/privacy` },
};

export default function PrivacyPage() {
  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-10 sm:px-8 sm:py-14">
        <LegalDoc doc={privacyDoc} />
      </main>
      <SiteFooter />
    </div>
  );
}
