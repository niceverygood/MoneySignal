"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, TrendingUp, Bell, User } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/app", label: "시그널", icon: TrendingUp },
  { href: "/app/backtest", label: "백테스트", icon: BarChart3 },
  { href: "/app/notifications", label: "알림", icon: Bell },
  { href: "/app/my", label: "내정보", icon: User },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[#0D0F14] flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0D0F14]/95 backdrop-blur-sm border-b border-[#2A2D36]">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/app" className="text-lg font-bold text-gold-gradient">
            MONEY SIGNAL
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/app/notifications"
              className="relative p-2 text-[#8B95A5] hover:text-white transition-colors"
            >
              <Bell className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-lg mx-auto w-full px-4 pb-20">
        {children}
      </main>

      {/* Bottom tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#0D0F14]/95 backdrop-blur-sm border-t border-[#2A2D36]">
        <div className="max-w-lg mx-auto flex">
          {tabs.map((tab) => {
            const isActive =
              tab.href === "/app"
                ? pathname === "/app"
                : pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "flex-1 flex flex-col items-center py-2 gap-1 transition-colors",
                  isActive
                    ? "text-[#F5B800]"
                    : "text-[#8B95A5] hover:text-white"
                )}
              >
                <tab.icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
