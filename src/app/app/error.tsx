"use client";

import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <AlertTriangle className="w-12 h-12 text-[#FF5252] mb-4" />
      <h2 className="text-lg font-bold text-white mb-2">오류가 발생했습니다</h2>
      <p className="text-sm text-[#8B95A5] mb-6 max-w-sm">
        {error.message || "일시적인 오류가 발생했습니다. 다시 시도해주세요."}
      </p>
      <Button
        onClick={reset}
        className="bg-[#F5B800] text-[#0D0F14] hover:bg-[#FFD54F]"
      >
        다시 시도
      </Button>
    </div>
  );
}
