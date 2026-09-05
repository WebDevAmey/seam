import type { Metadata } from "next";
import { DM_Mono, DM_Sans, Fraunces, Space_Grotesk } from "next/font/google";
import { MotionProvider } from "@/components/landing/MotionProvider";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
});
const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});
const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});
// The landing page's display serif — matches ovrt.in's own choice, kept
// separate from the dashboard's Space Grotesk (see DECISIONS.md).
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  axes: ["SOFT", "WONK"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Seam: Revenue Recovery for Shopify + Razorpay",
  description: "Seam joins your Shopify checkout funnel to your Razorpay payment rail, attributes lost revenue to a cause, and executes bounded recovery.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${dmSans.variable} ${dmMono.variable} ${fraunces.variable}`}>
      <body>
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
