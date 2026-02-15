"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Package, Edit, Users } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Product } from "@/types";
import { CATEGORY_LABELS } from "@/types";

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function fetchProducts() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: partner } = await supabase
        .from("partners")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (partner) {
        const { data } = await supabase
          .from("products")
          .select("*")
          .eq("partner_id", partner.id)
          .order("created_at", { ascending: false });

        if (data) setProducts(data as Product[]);
      }
      setLoading(false);
    }

    fetchProducts();
  }, [supabase]);

  const toggleActive = async (productId: string, isActive: boolean) => {
    await supabase
      .from("products")
      .update({ is_active: isActive })
      .eq("id", productId);

    setProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, is_active: isActive } : p))
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-[#F5B800] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">상품 관리</h1>
        <Link href="/partner/products/new">
          <Button className="bg-[#F5B800] text-[#0D0F14] hover:bg-[#FFD54F]">
            <Plus className="w-4 h-4 mr-2" />
            상품 만들기
          </Button>
        </Link>
      </div>

      {products.length === 0 ? (
        <Card className="bg-[#1A1D26] border-[#2A2D36] p-8 text-center">
          <Package className="w-12 h-12 text-[#2A2D36] mx-auto mb-3" />
          <p className="text-[#8B95A5] mb-3">아직 상품이 없습니다</p>
          <Link href="/partner/products/new">
            <Button className="bg-[#F5B800] text-[#0D0F14] hover:bg-[#FFD54F]">
              첫 상품 만들기
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {products.map((product) => (
            <Card
              key={product.id}
              className={cn(
                "bg-[#1A1D26] border-[#2A2D36] p-4",
                !product.is_active && "opacity-60"
              )}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-white font-semibold">{product.name}</h3>
                  <Badge
                    variant="outline"
                    className="border-[#2A2D36] text-[#8B95A5] text-[10px] mt-1"
                  >
                    {CATEGORY_LABELS[product.category as keyof typeof CATEGORY_LABELS] ||
                      product.category}
                  </Badge>
                </div>
                <Switch
                  checked={product.is_active}
                  onCheckedChange={(checked) =>
                    toggleActive(product.id, checked)
                  }
                />
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#8B95A5]">월 구독료</span>
                  <span className="text-white font-mono">
                    {product.price_monthly.toLocaleString()}원
                  </span>
                </div>
                {product.price_quarterly && (
                  <div className="flex justify-between">
                    <span className="text-[#8B95A5]">분기</span>
                    <span className="text-white font-mono">
                      {product.price_quarterly.toLocaleString()}원
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-[#8B95A5]">일일 최대 시그널</span>
                  <span className="text-white">{product.max_signals_per_day}개</span>
                </div>
              </div>

              {/* Features */}
              {product.features && (product.features as string[]).length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-[#2A2D36]">
                  {(product.features as string[]).map((feature, i) => (
                    <Badge
                      key={i}
                      variant="outline"
                      className="border-[#2A2D36] text-[#8B95A5] text-[10px]"
                    >
                      ✅ {feature}
                    </Badge>
                  ))}
                </div>
              )}

              <div className="flex gap-2 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 border-[#2A2D36] text-[#8B95A5] hover:text-white"
                >
                  <Edit className="w-3.5 h-3.5 mr-1" />
                  수정
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-[#2A2D36] text-[#8B95A5] hover:text-white"
                >
                  <Users className="w-3.5 h-3.5" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
