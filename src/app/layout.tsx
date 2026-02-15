import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#0D0F14",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: "머니시그널 - AI 매수 시그널 실시간 알림 서비스",
  description:
    "AI가 코인·선물·주식 매수 시그널을 포착하여 실시간으로 알려드립니다. 서버 기록 기반 투명한 실적 공개.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://moneysignal.io"
  ),
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "머니시그널",
  },
  openGraph: {
    title: "머니시그널 - AI 매수 시그널 실시간 알림",
    description: "AI가 포착한 매수 시그널, 실시간으로 받아보세요",
    siteName: "MoneySignal",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
