import type React from "react";
import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { Suspense } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Meeting Slayer",
  description:
    "Meeting Slayer - a fun, Microsoft Teams themed mini-game where you break meetings like bricks, dodge the calendar chaos, and rack up your score.",
  applicationName: "Meeting Slayer",
  authors: [{ name: "Pranay Gupta", url: "https://pranaygupta.in" }],
  creator: "Pranay Gupta",
  publisher: "Pranay Gupta",
  keywords: [
    "Meeting Slayer",
    "Microsoft Teams",
    "mini-game",
    "brick breaker",
    "web game",
    "arcade",
    "calendar chaos",
  ],
  themeColor: "#6264A7",
  colorScheme: "dark",
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: "/",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans antialiased">
        <Suspense fallback={null}>{children}</Suspense>
        <Analytics />
      </body>
    </html>
  );
}
