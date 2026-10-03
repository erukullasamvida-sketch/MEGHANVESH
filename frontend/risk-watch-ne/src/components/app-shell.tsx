import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  Brain,
  Check,
  Database,
  FileText,
  LayoutDashboard,
  LogOut,
  Map,
  Menu,
  Settings as SettingsIcon,
  TriangleAlert,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { useStationSelection } from "@/hooks/use-station-selection";
import { useDemoMode } from "@/hooks/use-demo-mode";
import { supabase } from "@/integrations/supabase/client";
import { getAWSStations } from "@/lib/api/aws";
import {
  DEMO_SCENARIOS,
  getDemoScenarioDetails,
  getDemoScenarioLabel,
  type DemoScenario,
} from "@/lib/demo-anomaly";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/risk-map", label: "AWS Station Map", icon: Map },
  { to: "/prediction", label: "Anomaly Detection", icon: Brain },
  { to: "/alerts", label: "Sensor Alerts", icon: Bell },
  { to: "/analytics", label: "Sensor Analytics", icon: BarChart3 },
  { to: "/field-reports", label: "Station Inspection", icon: FileText },
  { to: "/data-sources", label: "AWS Data", icon: Database },
  { to: "/about", label: "About", icon: Activity },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
] as const;

const MOBILE_NAV = [
  { to: "/dashboard", label: "Home", icon: LayoutDashboard },
  { to: "/risk-map", label: "Map", icon: Map },
  { to: "/alerts", label: "Alerts", icon: Bell },
  { to: "/field-reports", label: "Inspect", icon: FileText },
] as const;

function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-4 py-4">
      <img src="/favicon.svg" alt="" className="h-9 w-9 shrink-0 rounded-md" />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-sidebar-foreground">MEGHANVESH</p>
        <p className="truncate text-[11px] text-sidebar-foreground/60">SIH26073 · Station intelligence</p>
      </div>
    </div>
  );
}

export function DemoAnomalyNotifier() {
  const { demoActive, demoStationId, demoScenario } = useDemoMode();
  const previousState = useRef({ demoActive, demoScenario });
  const notificationId = useRef<string | number>();

  useEffect(() => {
    const previous = previousState.current;
    const scenarioChanged =
      previous.demoActive !== demoActive || previous.demoScenario !== demoScenario;
    previousState.current = { demoActive, demoScenario };

    if (!scenarioChanged) return;

    if (notificationId.current !== undefined) {
      toast.dismiss(notificationId.current);
      notificationId.current = undefined;
    }
    if (!demoActive || demoScenario === "NORMAL") return;

    const details = getDemoScenarioDetails(demoScenario);
    const stationId =
      demoScenario === "TEMPERATURE_SPIKE"
        ? "AWS-ASSAM-001"
        : demoScenario === "PRESSURE_ANOMALY"
          ? "AWS-MEGHALAYA-002"
          : demoStationId;
    const value =
      demoScenario === "TEMPERATURE_SPIKE"
        ? "49°C"
        : demoScenario === "PRESSURE_ANOMALY"
          ? "702 hPa"
          : demoScenario === "HUMIDITY_ANOMALY"
            ? `${details.values.relative_humidity}% relative humidity`
            : undefined;
    const status = demoScenario === "COMMUNICATION_FAILURE" ? "OFFLINE" : undefined;

    notificationId.current = toast.custom(
      (id) => (
        <div
          role="alert"
          className="w-[min(380px,calc(100vw-2rem))] rounded-md border border-red-300 bg-red-950 p-4 text-white shadow-xl"
        >
          <div className="flex items-start gap-3">
            <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-300" />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-bold">ANOMALY DETECTED</p>
                <button
                  type="button"
                  className="-mr-1 -mt-1 rounded p-1 text-white/70 hover:bg-white/10 hover:text-white"
                  aria-label="Dismiss anomaly notification"
                  onClick={() => toast.dismiss(id)}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-1 break-words text-xs text-white/80">Station: {stationId}</p>
              <p className="mt-1 text-sm font-semibold">Type: {getDemoScenarioLabel(demoScenario)}</p>
              <p className="mt-1 text-xs text-white/85">
                Severity: {details.severity}
                {details.confidence !== undefined && ` · Confidence: ${details.confidence}%`}
              </p>
              {value && <p className="mt-1 text-xs text-white/85">Value: {value}</p>}
              {status && <p className="mt-1 text-xs text-white/85">Status: {status}</p>}
              <p className="mt-2 text-xs leading-relaxed text-white/75">{details.reason}</p>
            </div>
          </div>
        </div>
      ),
      { duration: 8000, position: "bottom-right" },
    );
  }, [demoActive, demoScenario, demoStationId]);

  return null;
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="flex flex-col gap-1 px-2 pb-4">
      {NAV.map((item) => {
        const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({
  title,
  subtitle,
  actions,
  children,
  user,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  user?: { name: string; role: string } | null;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { selectStation } = useStationSelection();
  const {
    demoActive,
    demoStationId,
    demoScenario,
    startDemo,
    setDemoStationId,
    setDemoScenario,
    resetDemo,
  } = useDemoMode();
  const { data: demoStations = [] } = useQuery({
    queryKey: ["aws_demo_stations"],
    queryFn: getAWSStations,
    enabled: demoActive,
  });
  const { data: searchResults = [], isFetching } = useQuery({
    queryKey: ["aws_station_search", search.trim()],
    queryFn: async () => {
      const query = search.trim().toLowerCase();
      const stations = await getAWSStations();
      return stations.filter(
        (station) =>
          station.name.toLowerCase().includes(query) ||
          station.station_id.toLowerCase().includes(query),
      );
    },
    enabled: Boolean(search.trim()),
  });

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <Brand />
        <div className="flex-1 overflow-y-auto">
          <NavList />
        </div>
        <div className="border-t border-sidebar-border p-3">
          <button
            onClick={signOut}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-navy/60"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute inset-y-0 left-0 flex w-64 flex-col bg-sidebar">
            <div className="flex items-center justify-between">
              <Brand />
              <button
                className="mr-3 rounded-md p-2 text-sidebar-foreground/70"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <NavList onNavigate={() => setOpen(false)} />
            </div>
            <div className="border-t border-sidebar-border p-3">
              <button
                onClick={signOut}
                className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/75"
              >
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="lg:pl-60">
        <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3">
            <button
              className="rounded-md p-2 text-foreground lg:hidden"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="relative block min-w-0 md:block">
              <Input
                placeholder="Search AWS stations..."
                className="h-9 max-w-md"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              {search.trim() && (
                <div className="absolute mt-1 w-full max-w-md overflow-hidden rounded-md border border-border bg-card shadow-md">
                  {isFetching && (
                    <p className="px-3 py-2 text-sm text-muted-foreground">Searching...</p>
                  )}
                  {!isFetching && searchResults.length === 0 && (
                    <p className="px-3 py-2 text-sm text-muted-foreground">No AWS stations found.</p>
                  )}
                  {!isFetching &&
                    searchResults.map((station) => (
                      <button
                        key={station.station_id}
                        type="button"
                        className="block w-full px-3 py-2 text-left hover:bg-muted"
                        onClick={() => {
                          selectStation(station.station_id);
                          setSearch(station.name);
                        }}
                      >
                        <span className="block text-sm font-medium text-foreground">
                          {station.name}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {station.station_id}
                        </span>
                      </button>
                    ))}
                </div>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <Link
                to="/alerts"
                className="relative rounded-md p-2 text-muted-foreground hover:text-foreground"
                aria-label="Alerts"
              >
                <Bell className="h-5 w-5" />
              </Link>
              {demoActive ? (
                <span className="rounded-md border border-orange-800/20 bg-orange-50 px-2 py-1 text-[11px] font-bold text-orange-900">
                  DEMO MODE
                </span>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    selectStation(demoStationId);
                    startDemo();
                  }}
                >
                  Enable Demo Mode
                </Button>
              )}
              <div className="flex items-center gap-2">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  {(user?.name ?? "A").charAt(0).toUpperCase()}
                </div>
                <div className="hidden min-w-0 sm:block">
                  <p className="truncate text-xs font-semibold text-foreground">
                    {user?.name ?? "Officer"}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {user?.role ?? "System User"}
                  </p>
                </div>
              </div>
            </div>
          </div>
          {demoActive && (
            <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-2.5">
              <span className="text-xs font-semibold text-orange-900">Simulated sensor anomaly</span>
              <Select
                value={demoStationId}
                onValueChange={(stationId) => {
                  setDemoStationId(stationId);
                  selectStation(stationId);
                }}
              >
                <SelectTrigger className="h-8 w-[min(280px,100%)] text-xs" aria-label="Demo AWS station">
                  <SelectValue placeholder="Choose AWS station" />
                </SelectTrigger>
                <SelectContent>
                  {demoStations.map((station) => (
                    <SelectItem key={station.station_id} value={station.station_id}>
                      {station.name} · {station.station_id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={demoScenario}
                onValueChange={(value) => {
                  const scenario = value as DemoScenario;
                  const requiredStation =
                    scenario === "TEMPERATURE_SPIKE"
                      ? "AWS-ASSAM-001"
                      : scenario === "PRESSURE_ANOMALY"
                        ? "AWS-MEGHALAYA-002"
                        : undefined;
                  if (requiredStation) {
                    setDemoStationId(requiredStation);
                    selectStation(requiredStation);
                  }
                  setDemoScenario(scenario);
                }}
              >
                <SelectTrigger className="h-8 w-[210px] text-xs" aria-label="Demo scenario">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEMO_SCENARIOS.map((scenario) => (
                    <SelectItem key={scenario.value} value={scenario.value}>
                      {scenario.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" size="sm" variant="outline" onClick={resetDemo}>
                Reset Demo
              </Button>
            </div>
          )}
        </header>

        <main className="px-4 pb-24 pt-5 lg:px-6 lg:pb-8">
          <div className="mb-5 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
            <div className="min-w-0">
              <h1 className="min-w-0 break-words text-xl font-bold tracking-tight text-foreground lg:text-2xl">
                {title}
              </h1>
              {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
            </div>
            {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
          </div>
          {children}
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <MobileBottomNav />
    </div>
  );
}

function MobileBottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-border bg-card lg:hidden">
      {MOBILE_NAV.map((item) => {
        const active = pathname.startsWith(item.to);
        return (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium",
              active ? "text-primary" : "text-muted-foreground",
            )}
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-lg border border-border bg-card", className)}>
      {(title || actions) && (
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            {title && <h2 className="truncate text-sm font-semibold text-foreground">{title}</h2>}
            {description && (
              <p className="truncate text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          {actions && <div className="shrink-0">{actions}</div>}
        </div>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function KpiCard({
  label,
  value,
  unit,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string | number;
  unit?: string;
  icon: typeof Activity;
  tone?: "default" | "high" | "critical" | "info" | "healthy" | "warning" | "anomalous" | "offline";
}) {
  const tones: Record<string, string> = {
    default: "bg-accent text-accent-foreground",
    high: "bg-risk-high-soft text-risk-high",
    critical: "bg-risk-critical-soft text-risk-critical",
    info: "bg-secondary text-secondary-foreground",
    healthy: "bg-emerald-50 text-emerald-800",
    warning: "bg-amber-50 text-amber-900",
    anomalous: "bg-orange-50 text-orange-900",
    offline: "bg-slate-100 text-slate-700",
  };
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-md", tones[tone])}>
          <Icon className="h-4.5 w-4.5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-bold leading-none text-foreground">
            {value}
            {unit && <span className="ml-1 text-sm font-medium text-muted-foreground">{unit}</span>}
          </p>
        </div>
      </div>
    </div>
  );
}

export function EmptyRow({ children }: { children: ReactNode }) {
  return <p className="py-8 text-center text-sm text-muted-foreground">{children}</p>;
}

export { AlertTriangle, Activity };
