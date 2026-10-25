import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PWA } from "@/components/pwa";
export const metadata: Metadata = {
  title: "myn. — The AI that shows you where to click.",
  description:
    "Your real-time visual AI companion. Share your screen. Ask naturally. Stay in flow.",
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
