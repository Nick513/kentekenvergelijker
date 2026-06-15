"use client";

import { useEffect } from "react";

export function SiteHeaderHeight() {
  useEffect(() => {
    const header = document.querySelector("header");
    if (!header) return;

    const update = () => {
      document.documentElement.style.setProperty(
        "--kv-header-height",
        `${header.getBoundingClientRect().height}px`,
      );
    };

    update();

    const observer = new ResizeObserver(update);
    observer.observe(header);
    window.addEventListener("resize", update);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  return null;
}
