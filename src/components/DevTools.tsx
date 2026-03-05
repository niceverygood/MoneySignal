"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

const Agentation = dynamic(
  () => import("agentation").then((mod) => mod.Agentation),
  { ssr: false }
);

const SECRET_KEY = "bottledev";

function getInitialEnabled(): boolean {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get("devtools") === SECRET_KEY) {
    localStorage.setItem("devtools", "true");
    return true;
  }
  if (params.get("devtools") === "off") {
    localStorage.removeItem("devtools");
    return false;
  }
  return localStorage.getItem("devtools") === "true";
}

export function DevTools() {
  const [enabled] = useState(getInitialEnabled);

  if (!enabled && process.env.NODE_ENV !== "development") return null;
  return <Agentation />;
}
