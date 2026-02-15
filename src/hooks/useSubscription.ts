"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile, Subscription, SubscriptionTier } from "@/types";
import { TIER_ACCESS } from "@/types";

export function useSubscription() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    async function fetchSubscriptionData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profileData) setProfile(profileData as Profile);

      const { data: subsData } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "active");

      if (subsData) setSubscriptions(subsData as Subscription[]);
      setLoading(false);
    }

    fetchSubscriptionData();
  }, [supabase]);

  const tier: SubscriptionTier = profile?.subscription_tier as SubscriptionTier || "free";
  const accessibleCategories = TIER_ACCESS[tier] || [];
  const isSubscribed = tier !== "free";
  const expiresAt = profile?.subscription_expires_at;

  return {
    profile,
    subscriptions,
    tier,
    accessibleCategories,
    isSubscribed,
    expiresAt,
    loading,
  };
}
