import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/risk/$id")({
  beforeLoad: () => {
    throw redirect({ to: "/risk-map" });
  },
});
