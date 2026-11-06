import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PWA } from "@/components/pwa";
export const metadata: Metadata = {
  title: "myn. — Learn it. Do it. Or let MYN do it.",
  description:
    "Your AI companion that sees your screen, understands what you’re doing, and helps you get things done.",
  manifest: "/manifest.webmanifest",
};
export const viewport: Viewport = { themeColor: "#111318" };
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <PWA />
      </body>
    </html>
  );
}
