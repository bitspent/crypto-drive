import { getBitcoinProvider } from "./bitcoin/index";
import type { StepAnswer } from "./practice-types";
import type { Student } from "./store";
import { examReadiness } from "./wallet";

/**
 * Server-side final-exam grading (prove-it/exam, action wallet-exam).
 * Throws a learner-facing message naming the first incomplete task.
 * The client checklist mirrors these states, but only this runs at commit.
 */
export async function verifyWalletExam(
  student: Student,
  answer: StepAnswer | undefined,
): Promise<void> {
  const provider = getBitcoinProvider();
  const wallet = student.wallet?.exists ? student.wallet : null;
  const readiness = examReadiness(wallet, provider.network);
  if (!readiness.setup) {
    throw new Error("Set up your practice wallet first — create it in the wallet tab.");
  }
  if (!readiness.receive) {
    throw new Error(
      provider.network === "regtest"
        ? "Receive from the faucet first — the exam needs one confirmed faucet deposit."
        : "Receive first — the exam needs one confirmed deposit.",
    );
  }
  if (!readiness.send) {
    throw new Error("Send a payment first — the exam needs one confirmed send.");
  }
  if (!readiness.restore) {
    throw new Error("Restore your wallet from its 12 words first — the wallet tab proves it.");
  }
  const txid = answer?.examTxid?.trim() ?? "";
  const claim = answer?.examClaim?.trim() ?? "";
  if (!txid || !claim) {
    throw new Error("Read the chain back — paste the value the exam asks for.");
  }
  const tx = wallet?.history.find(
    (t) => t.id.toLowerCase() === txid.toLowerCase() && t.direction === "in",
  );
  if (!tx || tx.status !== "confirmed") {
    throw new Error("That deposit is not confirmed yet — wait for its confirmations.");
  }
  if (provider.network === "regtest") {
    // Any confirmed on-chain deposit counts: the chain check itself proves
    // presence, so an invented txid fails here with the not-on-chain message.
    let height: number | null;
    try {
      height = (await provider.getTxStatus(tx.id)).blockHeight;
    } catch {
      throw new Error("The faucet deposit is not on the chain yet — try again in a moment.");
    }
    if (!Number.isInteger(Number(claim)) || Number(claim) !== height) {
      throw new Error("That height does not match the explorer — read it again from the tx page.");
    }
    return;
  }
  if (tx.id.slice(0, 8).toLowerCase() !== claim.toLowerCase()) {
    throw new Error("Those characters do not match the deposit — open its details and copy them.");
  }
}
