"use client";

import { useState, useEffect } from "react";
import { X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getUpgradeMessage, getNextTier, getTierLabel } from "@/lib/tier-access";
import type { TierKey } from "@/lib/tier-access";
import Link from "next/link";

export default function TierUpgradeBanner({ tier }: { tier: TierKey }) {
  const [dismissed, setDismissed] = useState(false);
  const message = getUpgradeMessage(tier);
  const nextTier = getNextTier(tier);

  useEffect(() => {
    const lastDismissed = localStorage.getItem("upgrade_banner_dismissed");
    if (lastDismissed) {
      const date = new Date(lastDismissed);
      const today = new Date();
      if (date.toDateString() === today.toDateString()) {
        setDismissed(true);
      }
    }
  }, []);

  if (!message || !nextTier || dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem("upgrade_banner_dismissed", new Date().toISOString());
  };

  return (
    <div className="relative flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-[#F5B800]/10 to-[#FFD54F]/5 border border-[#F5B800]/20">
      <Sparkles className="w-5 h-5 text-[#F5B800] shrink-0" />
      <p className="text-xs text-[#8B95A5] flex-1">{message}</p>
      <Link href="/app/subscribe">
        <Button
          size="sm"
          className="bg-[#F5B800] text-[#0D0F14] hover:bg-[#FFD54F] text-[10px] h-7 px-3 font-semibold shrink-0"
        >
          {getTierLabel(nextTier)}로 업그레이드
        </Button>
      </Link>
      <button
        onClick={handleDismiss}
        className="absolute top-1 right-1 p-1 text-[#8B95A5] hover:text-white"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}
