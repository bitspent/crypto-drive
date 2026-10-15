import { notFound, redirect } from "next/navigation";
import { getTier, getTrack } from "@/lib/content";
import { driveEntryHref, driveUnlocked } from "@/lib/drive";
import { getSessionId } from "@/lib/session";
import { getStudentBySession } from "@/lib/store";

type Props = {
  params: Promise<{ slug: string; drive: string }>;
};

export default async function DriveIndexPage({ params }: Props) {
  const { slug, drive: driveSlug } = await params;
  const sessionId = await getSessionId();
  const student = await getStudentBySession(sessionId);
  if (!student) redirect("/unlock");

  const track = await getTrack(slug);
  if (!track) notFound();
  const tier = await getTier(student.tier);
  if (!tier.tracks.includes(track.slug) || track.status !== "ready") notFound();

  const drives = track.drives ?? [];
  const index = drives.findIndex((drive) => drive.slug === driveSlug);
  if (index < 0) notFound();
  if (!driveUnlocked(drives, index, student.modulesPassed)) {
    redirect(`/track/${track.slug}`);
  }

  redirect(driveEntryHref(track.slug, drives[index], student.modulesPassed));
}
