import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0D0F14] flex flex-col items-center justify-center text-center px-4">
      <h1 className="text-6xl font-bold text-[#F5B800] mb-4">404</h1>
      <h2 className="text-xl font-bold text-white mb-2">
        페이지를 찾을 수 없습니다
      </h2>
      <p className="text-sm text-[#8B95A5] mb-8">
        요청하신 페이지가 존재하지 않거나 이동되었습니다.
      </p>
      <div className="flex gap-3">
        <Link href="/">
          <Button
            variant="outline"
            className="border-[#2A2D36] text-white hover:bg-[#1A1D26]"
          >
            홈으로
          </Button>
        </Link>
        <Link href="/app">
          <Button className="bg-[#F5B800] text-[#0D0F14] hover:bg-[#FFD54F]">
            시그널 보기
          </Button>
        </Link>
      </div>
    </div>
  );
}
