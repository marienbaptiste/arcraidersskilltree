import type { Metadata } from "next";
import { Geist, Geist_Mono, Montserrat } from "next/font/google";
import "./globals.css";
import { SkillProvider } from "@/context/SkillContext";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Arc Raiders Skill Tree Calculator - Definitive Skill Tree Planner",
  description: "The definitive Arc Raiders skill tree calculator and planner. Plan your character build with our interactive skill tree tool for Arc Raiders. Explore all skill paths, calculate optimal builds, and share your character configuration.",
  keywords: [
    "Arc Raiders",
    "skill tree calculator",
    "Arc Raiders skill tree",
    "definitive skill tree calculator",
    "Arc Raiders planner",
    "Arc Raiders build calculator",
    "skill planner",
    "character build",
    "Arc Raiders skills",
    "Arc Raiders builder",
  ],
  openGraph: {
    title: "Arc Raiders Skill Tree Calculator - Definitive Skill Tree Planner",
    description: "Plan your Arc Raiders character build with the definitive interactive skill tree calculator",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Arc Raiders Skill Tree Calculator",
    description: "The definitive Arc Raiders skill tree calculator and planner",
  },
  icons: {
    icon: [
      { url: '/favicon.ico?v=3', sizes: 'any' },
      { url: '/icon-192.png?v=3', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png?v=3', sizes: '512x512', type: 'image/png' },
    ],
    shortcut: '/favicon.ico?v=3',
    apple: '/apple-touch-icon.png?v=3',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" translate="no" className="notranslate">
      <head>
        <meta name="google" content="notranslate" />
        {/* Mobile fullscreen/PWA support */}
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#050709" />
        <link rel="manifest" href="/site.webmanifest" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${montserrat.variable} antialiased notranslate`}
        translate="no"
      >
        <SkillProvider>{children}</SkillProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
