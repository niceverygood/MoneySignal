"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Package,
  Users,
  DollarSign,
  Wallet,
  Settings,
  Crown,
  ArrowLeft,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

const sidebarItems = [
  { href: "/partner/dashboard", label: "대시보드", icon: LayoutDashboard },
  { href: "/partner/products", label: "상품 관리", icon: Package },
  { href: "/partner/subscribers", label: "구독자", icon: Users },
  { href: "/partner/revenue", label: "수익/정산", icon: DollarSign },
  { href: "/partner/withdraw", label: "출금", icon: Wallet },
  { href: "/partner/settings", label: "설정", icon: Settings },
];

export default function PartnerLayout({
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
          <p className="text-[10px] text-[#8B95A5] mt-1">파트너 대시보드</p>
        </div>

        {/* Partner tier badge */}
        <div className="p-4 border-b border-[#2A2D36]">
          <div className="flex items-center gap-2">
            <Crown className="w-4 h-4 text-[#F5B800]" />
            <Badge className="bg-[#F5B800]/10 text-[#F5B800] border-0 text-xs">
              Starter
            </Badge>
          </div>
          <p className="text-[10px] text-[#8B95A5] mt-1">
            다음 등급까지 구독자 51명 필요
          </p>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {sidebarItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                  isActive
                    ? "bg-[#F5B800]/10 text-[#F5B800]"
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
            className="flex items-center gap-2 px-3 py-2 text-sm text-[#8B95A5] hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            구독자 앱으로
          </Link>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-[#0D0F14]/95 backdrop-blur-sm border-b border-[#2A2D36]">
        <div className="px-4 h-14 flex items-center justify-between">
          <Link
            href="/partner/dashboard"
            className="text-lg font-bold text-gold-gradient"
          >
            MONEY SIGNAL
          </Link>
          <Badge className="bg-[#F5B800]/10 text-[#F5B800] border-0 text-[10px]">
            Partner
          </Badge>
        </div>
        {/* Mobile nav */}
        <div className="flex overflow-x-auto px-2 pb-2 gap-1 scrollbar-hide">
          {sidebarItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-colors",
                  isActive
                    ? "bg-[#F5B800] text-[#0D0F14]"
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

      {/* Main content */}
      <main className="flex-1 md:ml-64 pt-[100px] md:pt-0">
        <div className="max-w-6xl mx-auto p-4 md:p-8">{children}</div>
      </main>
    </div>
  );
}
