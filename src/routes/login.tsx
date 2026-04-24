import { createFileRoute, redirect } from "@tanstack/react-router";

// Auth guard temporarily disabled — login redirects to dashboard.
export const Route = createFileRoute("/login")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
  component: () => null,
});
