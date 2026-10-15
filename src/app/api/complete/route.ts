import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/session";
import { issueCertificate } from "@/lib/store";

export async function POST(request: Request) {
  try {
    const jar = await cookies();
    const sessionId = jar.get(SESSION_COOKIE)?.value;
    if (!sessionId) {
      return NextResponse.json(
        { error: "Unlock with your license before certifying." },
        { status: 401 },
      );
    }

    const body = (await request.json()) as {
      studentName?: string;
      moduleSlug?: string;
    };
    const certificate = await issueCertificate({
      sessionId,
      studentName: body.studentName ?? "",
      moduleSlug: body.moduleSlug ?? "btc-explorer",
    });

    return NextResponse.json({ ok: true, id: certificate.id });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not issue certificate.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
