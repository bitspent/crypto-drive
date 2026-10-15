import { redirect } from "next/navigation";
import { getTrack } from "@/lib/content";
import { resumeHref } from "@/lib/drive";
import { getSessionId } from "@/lib/session";
import { getStudentBySession } from "@/lib/store";

const FALLBACK = "/track/bitcoin/what-is/satoshi";

/** Legacy Slice 1 shortcut → current Bitcoin resume. */
export default async function Module1Redirect() {
  const sessionId = await getSessionId();
  const student = await getStudentBySession(sessionId);
  const track = await getTrack("bitcoin");
  if (student && track?.drives?.length) {
    redirect(resumeHref(track.slug, track.drives, student.modulesPassed) ?? FALLBACK);
  }
  redirect(FALLBACK);
}
