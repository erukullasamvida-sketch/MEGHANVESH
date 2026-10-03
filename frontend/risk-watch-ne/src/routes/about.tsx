import { createFileRoute } from "@tanstack/react-router";

import { AppShell, SectionCard } from "@/components/app-shell";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "MEGHANVESH" },
      {
        name: "description",
        content:
          "AI/ML-based intelligent anomaly detection for Automatic Weather Stations, with explainable sensor findings and station health.",
      },
      { property: "og:title", content: "MEGHANVESH | About" },
      {
        property: "og:description",
        content: "Monitor AWS data, detect sensor faults, and explain anomaly results.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <AppShell
      title="AI/ML-Based Intelligent Anomaly Detection for Automatic Weather Stations"
      subtitle="MEGHANVESH · Ministry of Earth Sciences (MoES)"
    >
      <div className="space-y-4">
        <SectionCard title="Problem">
          <p className="max-w-4xl text-sm leading-6 text-muted-foreground">
            AWS sensors continuously generate meteorological observations. Faulty sensors, sudden spikes, frozen readings, communication failures, and abnormal combinations can reduce data reliability and complicate downstream analysis.
          </p>
        </SectionCard>

        <SectionCard title="System flow">
          <ol className="grid gap-2 sm:grid-cols-5">
            {["Monitor", "Detect", "Classify", "Explain", "Alert"].map((step, index) => (
              <li key={step} className="flex items-center gap-2 rounded-md border border-border p-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent text-xs font-bold text-accent-foreground">{index + 1}</span>
                <span className="text-sm font-semibold text-foreground">{step}</span>
              </li>
            ))}
          </ol>
        </SectionCard>

        <SectionCard title="Detection and station health">
          <ul className="grid gap-x-8 gap-y-2 text-sm text-muted-foreground sm:grid-cols-2">
            {[
              "Real-time analysis of the latest available observations (on request)",
              "Sensor fault detection for spikes, frozen values, drift, and data quality",
              "Temporal pattern analysis against station history",
              "Multivariate consistency across temperature, pressure, and humidity",
              "Cross-station comparison for shared changes",
              "Evidence confidence with backend-provided anomaly reasons",
              "Station health status and stale/offline awareness",
            ].map((item) => <li key={item} className="flex gap-2"><span className="text-primary">•</span>{item}</li>)}
          </ul>
          <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
            The current interface uses seeded SIH26073 demo observations. It does not claim a live physical station feed.
          </p>
        </SectionCard>
      </div>
    </AppShell>
  );
}
