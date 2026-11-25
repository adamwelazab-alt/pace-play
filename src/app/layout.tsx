import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font" });

export const metadata: Metadata = {
  title: "Pace of Play Ratings",
  description: "Anonymous pace-of-play ratings for golf club members.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0f4d32" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={manrope.variable}>
      <body>{children}</body>
    </html>
  );
}
