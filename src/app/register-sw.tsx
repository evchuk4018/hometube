"use client";

import { useEffect } from "react";
import { appPath } from "./app-path";

export function RegisterServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register(appPath("/sw.js"));
  }, []);
  return null;
}
