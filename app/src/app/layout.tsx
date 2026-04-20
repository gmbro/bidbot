import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "공공사업 통합 모니터링 AI | AI·클라우드·플랫폼 공고 추적",
  description: "나라장터, 기업마당, NIPA, 행안부, 서울AI 등 공공기관의 AI·생성형AI·플랫폼·클라우드 관련 사업 공고를 실시간으로 통합 모니터링합니다.",
  keywords: ["공공사업", "입찰공고", "AI", "생성형AI", "클라우드", "플랫폼", "나라장터", "기업마당", "NIPA", "행안부", "서울AI"],
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
