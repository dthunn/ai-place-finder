"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

const emptySubscribe = () => () => {};

// Avoids a hydration mismatch (server never knows the resolved theme) without
// the classic `useEffect(() => setMounted(true), [])` pattern, which triggers
// React's "setState synchronously within an effect" warning.
function useIsClient() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

export default function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const isClient = useIsClient();

  if (!isClient) {
    return <div className="h-8.5 w-8.5" />;
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="flex cursor-pointer items-center justify-center rounded-md border-0 bg-transparent p-2 text-muted outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
    >
      {isDark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
