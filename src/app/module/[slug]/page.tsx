import { redirect } from "next/navigation";
import { getTrack } from "@/lib/content";
import { resumeHref } from "@/lib/drive";
import { getSessionId } from "@/lib/session";
import { getStudentBySession } from "@/lib/store";

const FALLBACK = "/track/bitcoin/what-is/satoshi";

type Props = {
  params: Promise<{ slug: string }>;
};

/** Legacy module routes → current Bitcoin resume (or first what-is screen). */
export default async function LegacyModuleRedirect({ params }: Props) {
  await params;
  const sessionId = await getSessionId();
  const student = await getStudentBySession(sessionId);
  const track = await getTrack("bitcoin");
  if (student && track?.drives?.length) {
    redirect(resumeHref(track.slug, track.drives, student.modulesPassed) ?? FALLBACK);
  }
  redirect(FALLBACK);
}
