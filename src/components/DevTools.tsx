"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const Agentation = dynamic(
  () => import("agentation").then((mod) => mod.Agentation),
  { ssr: false }
);

const SECRET_KEY = "bottledev";

export function DevTools() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("devtools") === SECRET_KEY) {
      localStorage.setItem("devtools", "true");
      setEnabled(true);
    } else if (localStorage.getItem("devtools") === "true") {
      setEnabled(true);
    }

    if (params.get("devtools") === "off") {
      localStorage.removeItem("devtools");
      setEnabled(false);
    }
  }, []);

  if (!enabled && process.env.NODE_ENV !== "development") return null;
  return <Agentation />;
}
