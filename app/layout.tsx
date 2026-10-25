import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PWA } from "@/components/pwa";
export const metadata: Metadata = {
  title: "myn. — Your next step, together.",
  description:
    "Talk it through. Show what you see. Find your next step, together.",
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
