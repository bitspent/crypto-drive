import type { Metadata } from "next";
import { LegalDoc } from "@/components/legal-doc";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { refundDoc } from "@/content/legal/refund";
import { getAppUrl } from "@/lib/share";

export const metadata: Metadata = {
  title: refundDoc.title,
  description: refundDoc.description,
  alternates: { canonical: `${getAppUrl()}/refund` },
};

export default function RefundPage() {
  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-10 sm:px-8 sm:py-14">
        <LegalDoc doc={refundDoc} />
      </main>
      <SiteFooter />
    </div>
  );
}
