import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CivicNotice QA — Human-reviewed notice quality control",
  description:
    "AI-assisted quality control for clear, complete, and accountable government notices.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
