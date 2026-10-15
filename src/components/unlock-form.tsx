"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  unlockAction,
  type UnlockState,
} from "@/app/unlock/actions";

const initialState: UnlockState = { error: null };

export function UnlockForm() {
  const [state, formAction, pending] = useActionState(
    unlockAction,
    initialState,
  );

  return (
    <form action={formAction} className="flex w-full max-w-md flex-col gap-4">
      <div className="space-y-2">
        <label htmlFor="email" className="text-sm text-[var(--fog)]">
          Work email
        </label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@company.com"
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="license" className="text-sm text-[var(--fog)]">
          License key
        </label>
        <Input
          id="license"
          name="license"
          required
          autoComplete="off"
          placeholder="From your Gumroad receipt"
        />
      </div>
      {state?.error ? (
        <p className="text-sm text-red-400" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Checking…" : "Unlock my tier"}
      </Button>
      <p className="text-xs text-[var(--mute)]">
        Use the license key from your Gumroad receipt to unlock your tier.
      </p>
    </form>
  );
}
