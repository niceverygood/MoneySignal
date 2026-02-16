"use client";

import { cn } from "@/lib/utils";
import { Zap, Clock } from "lucide-react";
import type { TierKey } from "@/lib/tier-access";

export default function DelayBadge({ tier }: { tier: TierKey }) {
  if (tier === "free") return null;

  const configs: Record<string, { icon: typeof Zap; label: string; className: string }> = {
    bundle: {
      icon: Zap,
      label: "선공개",
      className: "bg-[#F5B800]/10 text-[#F5B800] border-[#F5B800]/30 signal-active",
    },
    premium: {
      icon: Zap,
      label: "실시간",
      className: "bg-[#00E676]/10 text-[#00E676] border-[#00E676]/30",
    },
    pro: {
      icon: Clock,
      label: "10분 딜레이",
      className: "bg-[#448AFF]/10 text-[#448AFF] border-[#448AFF]/30",
    },
    basic: {
      icon: Clock,
      label: "30분 딜레이",
      className: "bg-[#8B95A5]/10 text-[#8B95A5] border-[#8B95A5]/30",
    },
  };

  const config = configs[tier];
  if (!config) return null;
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border",
        config.className
      )}
    >
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
}
