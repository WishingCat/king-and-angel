import "./globals.css";
import type { Metadata } from "next";
import { Fraunces, JetBrains_Mono, Noto_Serif_SC } from "next/font/google";

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal"],
  variable: "--font-display",
  display: "swap",
});

const notoSerifSC = Noto_Serif_SC({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-han",
  display: "swap",
});

const jetBrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "信笺 · 国王与天使 · 福建永春路 2026",
  description:
    "北大爱心社 爱心万里行 2026 福建永春路。以一封封信笺为形，把心愿、配对、突然之间的温柔封存起来。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${fraunces.variable} ${notoSerifSC.variable} ${jetBrains.variable}`}
    >
      <body>
        <div className="page-grain" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}
