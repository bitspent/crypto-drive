import Link from "next/link";
import {
  privacyEmail,
  supportEmail,
  type LegalBlock,
  type LegalDoc,
} from "@/content/legal/shared";

function fillTokens(text: string): string {
  return text
    .replaceAll("{{support}}", supportEmail())
    .replaceAll("{{privacy}}", privacyEmail());
}

function Block({ block }: { block: LegalBlock }) {
  if (block.type === "list") {
    return (
      <ul className="mt-3 list-disc space-y-2 pl-6 text-[var(--fog)]">
        {block.items.map((item) => (
          <li key={item} className="leading-relaxed">
            {fillTokens(item)}
          </li>
        ))}
      </ul>
    );
  }
  return <p className="mt-3 leading-relaxed text-[var(--fog)]">{fillTokens(block.text)}</p>;
}

export function LegalDoc({ doc }: { doc: LegalDoc }) {
  const contact = doc.slug === "privacy" ? privacyEmail() : supportEmail();
  return (
    <article className="mx-auto w-full max-w-[72ch]">
      <p className="font-[family-name:var(--font-display)] text-xs tracking-[0.22em] text-[var(--amber)]">
        CRYPTO DRIVE
      </p>
      <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl text-[var(--paper)] sm:text-4xl">
        {doc.title}
      </h1>
      <p className="mt-3 text-sm text-[var(--mute)]">Last updated: {doc.updated}</p>
      {doc.sections.map((section) => (
        <section key={section.heading} className="mt-10">
          <h2 className="font-[family-name:var(--font-display)] text-xl text-[var(--paper)]">
            {section.heading}
          </h2>
          {section.blocks.map((block, i) => (
            <Block
              key={block.type === "paragraph" ? block.text.slice(0, 48) : `list-${i}`}
              block={block}
            />
          ))}
        </section>
      ))}
      <p className="mt-12 border-t border-[var(--lane)]/70 pt-6 text-[var(--fog)]">
        Questions about this page? Email{" "}
        <a href={`mailto:${contact}`} className="text-[var(--amber)] hover:underline">
          {contact}
        </a>
        .
      </p>
      <p className="mt-4 text-sm text-[var(--mute)]">
        <Link href="/" className="text-[var(--amber)] hover:underline">
          Back home
        </Link>
      </p>
    </article>
  );
}
