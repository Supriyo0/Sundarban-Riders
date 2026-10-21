"use client";

import { useSyncExternalStore } from "react";
import { Toaster } from "sonner";

import { useTheme } from "@/hooks/use-theme";
import { DEFAULT_MODE } from "@/lib/themes";

// Returns false during SSR and the first hydration render, true after —
// the sanctioned (warning-free, no setState-in-effect) way to diverge
// server vs client. Lets us match the server-rendered default on first
// paint, then adopt the real mode.
const noopSubscribe = () => () => {};
function useIsClient() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

/**
 * Toaster wrapper that tracks the active light/dark mode.
 *
 * Lives inside <ThemeProvider> (see layout.tsx) so it can read the
 * current mode and hand it to sonner. Colors are driven off the same
 * CSS tokens as the rest of the app, so a toast looks at home in
 * either mode without a second palette to maintain.
 *
 * The theme is gated behind `useIsClient`: the server renders
 * DEFAULT_MODE, so first client paint must too, otherwise a light-mode
 * user hydrates with a different sonner `theme` attribute than the
 * server emitted and React logs a hydration mismatch.
 */
export function ThemedToaster() {
  const { mode } = useTheme();
  const isClient = useIsClient();
  return (
    <Toaster
      theme={isClient ? mode : DEFAULT_MODE}
      position="bottom-center"
      offset={72}
      duration={2500}
      closeButton={false}
      visibleToasts={1}
      toastOptions={{
        duration: 2500,
        style: {
          background: "rgba(15, 23, 42, 0.92)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(255, 255, 255, 0.15)",
          color: "#ffffff",
          borderRadius: "16px",
          boxShadow: "0 10px 30px rgba(0, 0, 0, 0.25)",
          fontSize: "12px",
          fontWeight: 600,
          padding: "10px 16px",
        },
      }}
    />
  );
}
