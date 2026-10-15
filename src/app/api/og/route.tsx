import { ImageResponse } from "@vercel/og";
import { getCertificate } from "@/lib/store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return new Response("Missing certificate id", { status: 400 });
  }

  const cert = await getCertificate(id);
  if (!cert) {
    return new Response("Certificate not found", { status: 404 });
  }

  const issued = new Date(cert.issuedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "linear-gradient(145deg, #0B0E14 0%, #151B28 55%, #1A1408 100%)",
          color: "#F4F1EA",
          padding: "56px 64px",
          fontFamily: "Georgia, serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div
            style={{
              display: "flex",
              fontSize: 22,
              letterSpacing: 6,
              color: "#F0A500",
              fontFamily: "sans-serif",
              fontWeight: 700,
            }}
          >
            CRYPTO DRIVE
          </div>
          <div style={{ display: "flex", fontSize: 28, color: "#A8B2C1" }}>
            {cert.module}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "flex", fontSize: 22, color: "#A8B2C1" }}>
            This certifies that
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 64,
              lineHeight: 1.1,
              fontWeight: 700,
              maxWidth: 900,
            }}
          >
            {cert.studentName}
          </div>
          <div style={{ display: "flex", fontSize: 28, color: "#D7DDE8", maxWidth: 860 }}>
            passed {cert.milestone} on Crypto Drive.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            borderTop: "1px solid rgba(240,165,0,0.35)",
            paddingTop: 28,
            fontFamily: "sans-serif",
            fontSize: 20,
            color: "#A8B2C1",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span>Issued {issued}</span>
            <span style={{ color: "#F0A500" }}>ID {cert.id}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
            <span>Attestation hash</span>
            <span style={{ fontFamily: "monospace", color: "#F4F1EA" }}>{cert.hash}</span>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
