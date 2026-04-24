import type { ReactNode } from "react";
import { AppLayout } from "./AppLayout";

// Auth guard temporarily disabled — app is open for now.
export function AuthGate({ children }: { children: ReactNode }) {
  return <AppLayout>{children}</AppLayout>;
}
