"use client";

import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BlurOverlayProps {
  message: string;
  upgradeLabel?: string;
  onUpgrade?: () => void;
}

export default function BlurOverlay({
  message,
  upgradeLabel = "업그레이드",
  onUpgrade,
}: BlurOverlayProps) {
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-xl bg-[#0D0F14]/60 backdrop-blur-sm">
      <Lock className="w-6 h-6 text-[#F5B800] mb-2" />
      <p className="text-sm text-[#8B95A5] text-center px-4 mb-3">{message}</p>
      {onUpgrade && (
        <Button
          size="sm"
          onClick={onUpgrade}
          className="bg-[#F5B800] text-[#0D0F14] hover:bg-[#FFD54F] font-semibold"
        >
          {upgradeLabel}
        </Button>
      )}
    </div>
  );
}
