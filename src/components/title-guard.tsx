"use client";

import { useEffect } from "react";

/**
 * During client navigation Next removes the old <title> before the new one
 * arrives (~one server round-trip), so the tab briefly shows the URL. This
 * keeps the last title in place until the real one is back.
 */
export function TitleGuard() {
  useEffect(() => {
    let last = document.title;
    let placeholder: HTMLTitleElement | null = null;

    function check() {
      const real = Array.from(document.querySelectorAll("title")).find(
        (t) => t !== placeholder && t.textContent,
      );
      if (real) {
        last = real.textContent!;
        placeholder?.remove();
        placeholder = null;
      } else if (!placeholder && last) {
        placeholder = document.createElement("title");
        placeholder.textContent = last;
        document.head.prepend(placeholder);
      }
    }

    const observer = new MutationObserver(check);
    observer.observe(document.head, {
      subtree: true,
      childList: true,
      characterData: true,
    });
    return () => {
      observer.disconnect();
      placeholder?.remove();
    };
  }, []);

  return null;
}
