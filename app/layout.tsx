import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Tartalom Elemző",
  description: "Beadandók mintázatelemzése, interaktív hőtérkép és tanári jelentés",
  applicationName: "AI Beadandóelemző",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", shortcut: "/icon.svg", apple: "/icon.svg" },
  appleWebApp: { capable: true, title: "AI Elemző", statusBarStyle: "black-translucent" }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="hu">
      <body>{children}</body>
    </html>
  );
}
