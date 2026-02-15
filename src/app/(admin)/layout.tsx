"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  UserCog,
  TrendingUp,
  DollarSign,
  Wallet,
  BarChart3,
  ArrowLeft,
  Shield,
} from "lucide-react";

const sidebarItems = [
  { href: "/admin", label: "대시보드", icon: LayoutDashboard },
  { href: "/admin/partners", label: "파트너 관리", icon: UserCog },
  { href: "/admin/users", label: "유저 관리", icon: Users },
  { href: "/admin/signals", label: "시그널 관리", icon: TrendingUp },
  { href: "/admin/revenue", label: "전체 매출", icon: DollarSign },
  { href: "/admin/withdrawals", label: "출금 처리", icon: Wallet },
  { href: "/admin/backtest", label: "백테스트", icon: BarChart3 },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[#0D0F14] flex">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 border-r border-[#2A2D36] flex-col bg-[#0D0F14] fixed h-full">
        <div className="p-4 border-b border-[#2A2D36]">
          <Link href="/" className="text-lg font-bold text-gold-gradient">
            MONEY SIGNAL
          </Link>
          <div className="flex items-center gap-1.5 mt-1">
            <Shield className="w-3 h-3 text-[#FF5252]" />
            <p className="text-[10px] text-[#FF5252] font-medium">관리자 모드</p>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {sidebarItems.map((item) => {
            const isActive =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                  isActive
                    ? "bg-[#FF5252]/10 text-[#FF5252]"
                    : "text-[#8B95A5] hover:text-white hover:bg-[#1A1D26]"
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-[#2A2D36]">
          <Link
            href="/app"
            className="flex items-center gap-2 px-3 py-2 text-sm text-[#8B95A5] hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
            메인 앱으로
          </Link>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-[#0D0F14]/95 backdrop-blur-sm border-b border-[#2A2D36]">
        <div className="px-4 h-14 flex items-center justify-between">
          <Link href="/admin" className="text-lg font-bold text-gold-gradient">
            MONEY SIGNAL
          </Link>
          <div className="flex items-center gap-1.5">
            <Shield className="w-3 h-3 text-[#FF5252]" />
            <span className="text-[10px] text-[#FF5252]">Admin</span>
          </div>
        </div>
        <div className="flex overflow-x-auto px-2 pb-2 gap-1 scrollbar-hide">
          {sidebarItems.map((item) => {
            const isActive =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs whitespace-nowrap",
                  isActive
                    ? "bg-[#FF5252] text-white"
                    : "bg-[#1A1D26] text-[#8B95A5]"
                )}
              >
                <item.icon className="w-3.5 h-3.5" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>

      <main className="flex-1 md:ml-64 pt-[100px] md:pt-0">
        <div className="max-w-7xl mx-auto p-4 md:p-8">{children}</div>
      </main>
    </div>
  );
}
