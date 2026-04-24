import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "北大爱心社｜爱心万里行 2026 福建永春路",
  description:
    "国王与天使小平台：支持邀请注册、匿名守护、随机任务、盲视角后台和活动结束后查看结果。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}