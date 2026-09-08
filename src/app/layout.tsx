import type { Metadata, Viewport } from "next";
import { Inter, Fraunces } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "tavilga.mn",
  description:
    "Орчин үеийн тавилга, 3D-д тохируулдаг, виртуал өрөөний төлөвлөгчөөр өөрийн өрөөнд урьдчилан байрлуулна.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#faf9f6" };

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="mn" className={`${sans.variable} ${display.variable}`}>
      <body className="min-h-screen flex flex-col">
        <a href="#main-content" className="skip-link">Үндсэн агуулга руу очих</a>
        <Header />
        <main id="main-content" className="min-w-0 flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
