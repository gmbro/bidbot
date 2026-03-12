import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "나라장터 AI 공고 모니터",
  description: "나라장터 입찰공고에서 AI 관련 지원사업을 실시간으로 모니터링하고 슬랙으로 알림을 받으세요.",
  keywords: ["나라장터", "입찰공고", "AI", "지원사업", "공공조달"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        {/* 배경 효과 */}
        <div className="bg-grid" />
        <div className="bg-gradient-orb orb-1" />
        <div className="bg-gradient-orb orb-2" />
        <div className="bg-gradient-orb orb-3" />

        {children}
      </body>
    </html>
  );
}
