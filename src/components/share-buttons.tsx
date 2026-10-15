"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  instagramHelpUrl,
  linkedInShareUrl,
  shareCopy,
  xIntentUrl,
} from "@/lib/share";

type Props = {
  studentName: string;
  verifyUrl: string;
};

export function ShareButtons({ studentName, verifyUrl }: Props) {
  const [copied, setCopied] = useState(false);
  const text = shareCopy(studentName, verifyUrl);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${text}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
      <a href={xIntentUrl(text)} target="_blank" rel="noopener noreferrer">
        <Button variant="secondary" className="w-full sm:w-auto">
          Share on X
        </Button>
      </a>
      <a href={linkedInShareUrl(verifyUrl)} target="_blank" rel="noopener noreferrer">
        <Button variant="secondary" className="w-full sm:w-auto">
          Share on LinkedIn
        </Button>
      </a>
      <a href={instagramHelpUrl()} target="_blank" rel="noopener noreferrer">
        <Button
          variant="secondary"
          className="w-full sm:w-auto"
          onClick={(e) => {
            e.preventDefault();
            void copyLink().then(() => {
              window.open(instagramHelpUrl(), "_blank", "noopener,noreferrer");
            });
          }}
        >
          Copy for Instagram
        </Button>
      </a>
      <Button variant="outline" className="w-full sm:w-auto" onClick={() => void copyLink()}>
        {copied ? "Copied" : "Copy share text"}
      </Button>
    </div>
  );
}
