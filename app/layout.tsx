import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Tartalom Elemző",
  description: "AI-stílus elemzés, kockázattérkép és Javítóasztal"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="hu">
      <body>{children}</body>
    </html>
  );
}
