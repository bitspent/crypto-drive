"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  moduleSlug: string;
  courseTitle: string;
};

export function CertifyForm({ moduleSlug, courseTitle }: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function finish() {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentName: name, moduleSlug }),
      });
      const data = (await res.json()) as { error?: string; id?: string };
      if (!res.ok || !data.id) {
        setError(data.error || "Could not issue certificate.");
        return;
      }
      router.push(`/cert/${data.id}`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4 max-w-md">
      <p className="coach-cue text-lg leading-relaxed text-[var(--fog)]">
        <span className="mb-2 block font-[family-name:var(--font-display)] text-xs tracking-[0.2em] text-[var(--amber)]">
          COACH
        </span>
        One certificate for {courseTitle}. Put the name you’d use on LinkedIn.
      </p>
      <div className="space-y-2">
        <label className="text-sm text-[var(--fog)]" htmlFor="name">
          Name on certificate
        </label>
        <Input
          id="name"
          required
          placeholder="Alex Rivera"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      {error ? (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      ) : null}
      <Button
        size="lg"
        disabled={pending || name.trim().length < 2}
        onClick={finish}
      >
        {pending ? "Issuing…" : "Issue my certificate"}
      </Button>
    </div>
  );
}
