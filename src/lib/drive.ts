import type { Drive, Step } from "@/lib/content";

export type StepLocation = {
  drive: Drive;
  driveIndex: number;
  step: Step;
  stepIndex: number;
};

export function findStep(drives: Drive[], stepId: string): StepLocation | null {
  for (let driveIndex = 0; driveIndex < drives.length; driveIndex++) {
    const drive = drives[driveIndex];
    const stepIndex = drive.steps.findIndex((step) => step.id === stepId);
    if (stepIndex >= 0) {
      return { drive, driveIndex, step: drive.steps[stepIndex], stepIndex };
    }
  }
  return null;
}

export function findStepBySlug(
  drives: Drive[],
  driveSlug: string,
  stepSlug: string,
): StepLocation | null {
  const driveIndex = drives.findIndex((drive) => drive.slug === driveSlug);
  if (driveIndex < 0) return null;
  const drive = drives[driveIndex];
  const stepIndex = drive.steps.findIndex((step) => step.slug === stepSlug);
  if (stepIndex < 0) return null;
  return { drive, driveIndex, step: drive.steps[stepIndex], stepIndex };
}

/** Null when the learner may open or pass this step. */
export function stepBlockedReason(
  drives: Drive[],
  stepId: string,
  passed: Record<string, string>,
): string | null {
  const found = findStep(drives, stepId);
  if (!found) return "Unknown step.";

  if (found.driveIndex > 0) {
    const prev = drives[found.driveIndex - 1];
    const last = prev.steps[prev.steps.length - 1];
    if (!passed[last.id]) return "Finish the previous stop first.";
  }

  if (found.stepIndex > 0) {
    const prev = found.drive.steps[found.stepIndex - 1];
    if (!passed[prev.id]) return "Finish the previous screen first.";
  }

  return null;
}

export function driveUnlocked(
  drives: Drive[],
  driveIndex: number,
  passed: Record<string, string>,
): boolean {
  if (driveIndex === 0) return true;
  const prev = drives[driveIndex - 1];
  const last = prev.steps[prev.steps.length - 1];
  return Boolean(passed[last.id]);
}

export function driveComplete(drive: Drive, passed: Record<string, string>): boolean {
  return drive.steps.every((step) => Boolean(passed[step.id]));
}

export function countFinishedDrives(
  drives: Drive[],
  passed: Record<string, string>,
): number {
  return drives.filter((drive) => driveComplete(drive, passed)).length;
}

export function stepHref(trackSlug: string, drive: Drive, step: Step): string {
  return `/track/${trackSlug}/${drive.slug}/${step.slug}`;
}

/** First screen the learner still needs. Null when the road is finished. */
export function resumeHref(
  trackSlug: string,
  drives: Drive[],
  passed: Record<string, string>,
): string | null {
  for (let i = 0; i < drives.length; i++) {
    if (!driveUnlocked(drives, i, passed)) return null;
    const open = drives[i].steps.find((step) => !passed[step.id]);
    if (open) return stepHref(trackSlug, drives[i], open);
  }
  return null;
}

export function followingHref(
  trackSlug: string,
  drives: Drive[],
  stepId: string,
): string {
  const found = findStep(drives, stepId);
  if (!found) return `/track/${trackSlug}`;
  const nextInDrive = found.drive.steps[found.stepIndex + 1];
  if (nextInDrive) return stepHref(trackSlug, found.drive, nextInDrive);
  const nextDrive = drives[found.driveIndex + 1];
  if (nextDrive?.steps[0]) return stepHref(trackSlug, nextDrive, nextDrive.steps[0]);
  return "/course";
}

/** Prior screen, or the track road on the first screen. */
export function previousHref(
  trackSlug: string,
  drives: Drive[],
  stepId: string,
): string {
  const found = findStep(drives, stepId);
  if (!found) return `/track/${trackSlug}`;
  if (found.stepIndex > 0) {
    return stepHref(trackSlug, found.drive, found.drive.steps[found.stepIndex - 1]);
  }
  if (found.driveIndex > 0) {
    const prev = drives[found.driveIndex - 1];
    return stepHref(trackSlug, prev, prev.steps[prev.steps.length - 1]);
  }
  return `/track/${trackSlug}`;
}

/** Where a drive row should open: the unfinished screen, or the first for review. */
export function driveEntryHref(
  trackSlug: string,
  drive: Drive,
  passed: Record<string, string>,
): string {
  const open = drive.steps.find((step) => !passed[step.id]);
  return stepHref(trackSlug, drive, open ?? drive.steps[0]);
}
