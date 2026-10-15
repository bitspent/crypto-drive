import type { Metadata } from "next";
import { Figtree, Syne } from "next/font/google";
import Script from "next/script";
import { RouteStage } from "@/components/route-stage";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const themeBoot = `(function(){try{var t=localStorage.getItem('cd-theme');if(t==='light'||t==='dark'){document.documentElement.classList.toggle('dark',t==='dark');document.documentElement.style.colorScheme=t;}else{var d=window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.toggle('dark',d);document.documentElement.style.colorScheme=d?'dark':'light';}}catch(e){document.documentElement.classList.add('dark');}})();`;

const display = Syne({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const body = Figtree({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "Crypto Drive",
    template: "%s · Crypto Drive",
  },
  description:
    "Learn to use Bitcoin and crypto wallets the way you’d learn to drive — short coach cues, hands-on milestones, and certificates you can verify.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${display.variable} ${body.variable} min-h-dvh antialiased`}
    >
      <body className="flex min-h-dvh flex-col road-atmosphere">
        <Script id="cd-theme-boot" strategy="beforeInteractive">
          {themeBoot}
        </Script>
        <ThemeProvider>
          <RouteStage>{children}</RouteStage>
        </ThemeProvider>
      </body>
    </html>
  );
}
