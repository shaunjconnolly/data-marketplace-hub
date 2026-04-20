import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, Bell, Bug, CheckCircle2, FileText, Info,
  Loader2, Mail, RefreshCw, ShieldAlert, ShieldCheck,
  ShoppingCart, Users, Database, Activity, Scale,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

type CapturedError = {
  id: string; message: string; context: Record<string, unknown> | null; created_at: string;
};
type AuditEntry = {
  id: string; actor_id: string | null; actor_type: string | null; entity_type: string | null;
  action: string; payload: Record<string, unknown> | null; created_at: string;
};
type ChainBreak = {
  broken_id: string; broken_at: string; action: string; stored_prev: string; expected_prev: string;
};
type Profile = {
  id: string; display_name: string | null; company: string | null;
  primary_role: string | null; onboarding_completed: boolean | null; created_at: string;
};
type Listing = {
  id: string; title: string; status: string;
  price_per_record: number | null; total_records: number | null; created_at: string;
};
type AccessRequest = {
  id: string; listing_id: string; buyer_id: string; status: string; created_at: string;
};
type Purchase = {
  id: string; listing_id: string; buyer_id: string; seller_id: string; created_at: string;
};
type DsRequest = {
  id: string; user_id: string; request_type: string; status: string; created_at: string;
};
type ConsentRecord = {
  id: string; user_id: string; purpose: string; consented: boolean; created_at: string;
};
type Notification = {
  id: string; user_id: string; type: string; message: string; read: boolean; created_at: string;
};
type OutboundEmail = {
  id: string; recipient_email: string; subject: string | null; status: string; created_at: string;
};
type AnonJob = {
  id: string; listing_id: string; status: string;
  risk_score: number | null; flagged_for_review: boolean | null; created_at: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (s: string) => new Date(s).toLocaleString();
const short = (id: string) => id.slice(0, 8) + "…";

function statusCls(s: string) {
  if (["published", "complete", "converted", "approved", "sent", "completed"].includes(s))
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300";
  if (["pending", "waiting", "queued", "processing", "invited"].includes(s))
    return "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300";
  if (["failed", "declined", "rejected", "archived"].includes(s))
    return "bg-destructive/10 text-destructive";
  return "bg-muted text-muted-foreground";
}

function StatusBadge({ value }: { value: string | null }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusCls(value)}`}>
      {value}
    </span>
  );
}

function JsonCell({ value }: { value: unknown }) {
  if (value === null || value === undefined) return <span className="text-muted-foreground">—</span>;
  if (typeof value === "boolean")
    return <span className={value ? "text-emerald-600" : "text-muted-foreground"}>{value ? "yes" : "no"}</span>;
  if (typeof value === "object")
    return (
      <details className="cursor-pointer">
        <summary className="text-xs text-primary hover:underline">view</summary>
        <pre className="mt-1 max-w-xs overflow-x-auto rounded bg-muted/50 p-1.5 text-xs">
          {JSON.stringify(value, null, 2)}
        </pre>
      </details>
    );
  return <span>{String(value)}</span>;
}

// ─── Generic table shell ──────────────────────────────────────────────────────

type ColDef<T> = {
  label: string;
  render: (row: T) => React.ReactNode;
  className?: string;
};

function DataTable<T extends { id: string }>({
  cols, rows, loading, emptyMsg,
}: {
  cols: ColDef<T>[];
  rows: T[];
  loading: boolean;
  emptyMsg?: string;
}) {
  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card">
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <p className="px-6 py-12 text-center text-sm text-muted-foreground">{emptyMsg ?? "No records."}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs font-medium uppercase text-muted-foreground">
                {cols.map((c) => (
                  <th key={c.label} className={`px-4 py-3 whitespace-nowrap ${c.className ?? ""}`}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-muted/20">
                  {cols.map((c) => (
                    <td key={c.label} className={`px-4 py-3 text-xs ${c.className ?? ""}`}>
                      {c.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label, value, icon: Icon, accent,
}: {
  label: string; value: number | null; icon: React.ElementType; accent?: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${accent ?? "bg-muted"}`}>
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <div>
        <p className="text-2xl font-semibold tabular-nums text-foreground">
          {value === null ? <Loader2 className="h-4 w-4 animate-spin" /> : value.toLocaleString()}
        </p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

// ─── Search hook ──────────────────────────────────────────────────────────────

function useSearch<T>(items: T[] | null, fields: (keyof T)[]) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    if (!items) return [];
    const term = q.trim().toLowerCase();
    if (!term) return items;
    return items.filter((row) =>
      fields.some((f) => String(row[f] ?? "").toLowerCase().includes(term))
    );
  }, [items, q, fields]);
  return { q, setQ, filtered };
}

// ─── Main component ───────────────────────────────────────────────────────────

const AdminMonitoring = () => {
  const [loading, setLoading] = useState(false);

  // table data
  const [errors, setErrors] = useState<CapturedError[] | null>(null);
  const [audit, setAudit] = useState<AuditEntry[] | null>(null);
  const [profiles, setProfiles] = useState<Profile[] | null>(null);
  const [listings, setListings] = useState<Listing[] | null>(null);
  const [requests, setRequests] = useState<AccessRequest[] | null>(null);
  const [purchases, setPurchases] = useState<Purchase[] | null>(null);
  const [dsRequests, setDsRequests] = useState<DsRequest[] | null>(null);
  const [consents, setConsents] = useState<ConsentRecord[] | null>(null);
  const [notifications, setNotifications] = useState<Notification[] | null>(null);
  const [emails, setEmails] = useState<OutboundEmail[] | null>(null);
  const [anonJobs, setAnonJobs] = useState<AnonJob[] | null>(null);

  // chain verify
  const [chainResult, setChainResult] = useState<{ ok: boolean; breaks: ChainBreak[] } | null>(null);
  const [verifying, setVerifying] = useState(false);

  async function load() {
    setLoading(true);
    const results = await Promise.allSettled([
      supabase.from("captured_errors").select("id,message,context,created_at").order("created_at", { ascending: false }).limit(200),
      supabase.from("audit_log").select("id,actor_id,actor_type,entity_type,action,payload,created_at").order("created_at", { ascending: false }).limit(200),
      supabase.from("profiles").select("id,display_name,company,primary_role,onboarding_completed,created_at").order("created_at", { ascending: false }).limit(200),
      supabase.from("listings").select("id,title,status,price_per_record,total_records,created_at").order("created_at", { ascending: false }).limit(200),
      supabase.from("access_requests").select("id,listing_id,buyer_id,status,created_at").order("created_at", { ascending: false }).limit(200),
      supabase.from("purchases").select("id,listing_id,buyer_id,seller_id,created_at").order("created_at", { ascending: false }).limit(200),
      supabase.from("data_subject_requests").select("id,user_id,request_type,status,created_at").order("created_at", { ascending: false }).limit(200),
      supabase.from("consent_records").select("id,user_id,purpose,consented,created_at").order("created_at", { ascending: false }).limit(200),
      supabase.from("notifications").select("id,user_id,type,message,read,created_at").order("created_at", { ascending: false }).limit(200),
      supabase.from("outbound_emails").select("id,recipient_email,subject,status,created_at").order("created_at", { ascending: false }).limit(200),
      supabase.from("anonymisation_jobs").select("id,listing_id,status,risk_score,flagged_for_review,created_at").order("created_at", { ascending: false }).limit(200),
    ]);
    setLoading(false);

    const [errR, auditR, profR, listR, reqR, purR, dsR, conR, notR, emlR, jobR] = results;

    function unwrap<T>(r: typeof results[0], set: (v: T[] | null) => void, label: string) {
      if (r.status === "fulfilled") {
        if (r.value.error) { toast.error(`Could not load ${label}`); set([]); }
        else set((r.value.data ?? []) as T[]);
      } else { set([]); }
    }

    unwrap<CapturedError>(errR, setErrors, "errors");
    unwrap<AuditEntry>(auditR, setAudit, "audit log");
    unwrap<Profile>(profR, setProfiles, "users");
    unwrap<Listing>(listR, setListings, "listings");
    unwrap<AccessRequest>(reqR, setRequests, "access requests");
    unwrap<Purchase>(purR, setPurchases, "purchases");
    unwrap<DsRequest>(dsR, setDsRequests, "GDPR requests");
    unwrap<ConsentRecord>(conR, setConsents, "consents");
    unwrap<Notification>(notR, setNotifications, "notifications");
    unwrap<OutboundEmail>(emlR, setEmails, "emails");
    unwrap<AnonJob>(jobR, setAnonJobs, "anon jobs");
  }

  useEffect(() => { load(); }, []);

  async function verifyChain() {
    setVerifying(true);
    setChainResult(null);
    const { data, error } = await supabase.rpc("verify_audit_chain");
    setVerifying(false);
    if (error) { toast.error("Verification failed: " + error.message); return; }
    const breaks = (data ?? []) as ChainBreak[];
    setChainResult({ ok: breaks.length === 0, breaks });
    if (breaks.length === 0) toast.success("Audit chain intact — no tampering detected");
    else toast.error(`${breaks.length} chain break${breaks.length !== 1 ? "s" : ""} detected`);
  }

  // search state per tab
  const errS = useSearch(errors, ["message"]);
  const auditS = useSearch(audit, ["action", "entity_type", "actor_id"]);
  const profS = useSearch(profiles, ["display_name", "company", "primary_role"]);
  const listS = useSearch(listings, ["title", "status"]);
  const reqS = useSearch(requests, ["status", "buyer_id", "listing_id"]);
  const purS = useSearch(purchases, ["buyer_id", "seller_id", "listing_id"]);
  const dsS = useSearch(dsRequests, ["request_type", "status", "user_id"]);
  const conS = useSearch(consents, ["purpose", "user_id"]);
  const notS = useSearch(notifications, ["type", "message", "user_id"]);
  const emlS = useSearch(emails, ["recipient_email", "subject", "status"]);
  const jobS = useSearch(anonJobs, ["status", "listing_id"]);

  const cnt = (a: unknown[] | null) => (a === null ? null : a.length);

  function TabBadge({ n }: { n: number | null }) {
    if (n === null) return null;
    return (
      <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
        {n}
      </span>
    );
  }

  return (
    <div className="container mx-auto max-w-7xl px-6 py-10">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Monitoring</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Live view of all platform tables — last 200 rows each.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh all
        </Button>
      </header>

      <Tabs defaultValue="overview" className="mt-6">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="overview"><Activity className="mr-1.5 h-4 w-4" />Overview</TabsTrigger>
          <TabsTrigger value="errors">
            <Bug className="mr-1.5 h-4 w-4" />Errors
            {errors && errors.length > 0 && (
              <span className="ml-1.5 rounded-full bg-destructive/15 px-1.5 py-0.5 text-xs font-medium text-destructive">{errors.length}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="audit"><ShieldCheck className="mr-1.5 h-4 w-4" />Audit<TabBadge n={cnt(audit)} /></TabsTrigger>
          <TabsTrigger value="users"><Users className="mr-1.5 h-4 w-4" />Users<TabBadge n={cnt(profiles)} /></TabsTrigger>
          <TabsTrigger value="listings"><Database className="mr-1.5 h-4 w-4" />Listings<TabBadge n={cnt(listings)} /></TabsTrigger>
          <TabsTrigger value="requests"><FileText className="mr-1.5 h-4 w-4" />Requests<TabBadge n={cnt(requests)} /></TabsTrigger>
          <TabsTrigger value="purchases"><ShoppingCart className="mr-1.5 h-4 w-4" />Purchases<TabBadge n={cnt(purchases)} /></TabsTrigger>
          <TabsTrigger value="gdpr"><Scale className="mr-1.5 h-4 w-4" />GDPR<TabBadge n={cnt(dsRequests)} /></TabsTrigger>
          <TabsTrigger value="comms"><Mail className="mr-1.5 h-4 w-4" />Comms<TabBadge n={cnt(emails)} /></TabsTrigger>
          <TabsTrigger value="jobs"><Bell className="mr-1.5 h-4 w-4" />Jobs<TabBadge n={cnt(anonJobs)} /></TabsTrigger>
        </TabsList>

        {/* ── Overview ──────────────────────────────────────────── */}
        <TabsContent value="overview" className="mt-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <StatCard label="Users (profiles)" value={cnt(profiles)} icon={Users} />
            <StatCard label="Listings" value={cnt(listings)} icon={Database} />
            <StatCard label="Access requests" value={cnt(requests)} icon={FileText} />
            <StatCard label="Purchases" value={cnt(purchases)} icon={ShoppingCart} />
            <StatCard label="GDPR requests" value={cnt(dsRequests)} icon={Scale} />
            <StatCard label="Consent records" value={cnt(consents)} icon={CheckCircle2} />
            <StatCard label="Notifications" value={cnt(notifications)} icon={Bell} />
            <StatCard label="Outbound emails" value={cnt(emails)} icon={Mail} />
            <StatCard label="Anon jobs" value={cnt(anonJobs)} icon={Activity} />
            <StatCard label="Audit log entries" value={cnt(audit)} icon={ShieldCheck} />
            <StatCard
              label="Captured errors"
              value={cnt(errors)}
              icon={Bug}
              accent={(errors?.length ?? 0) > 0 ? "bg-destructive/10" : undefined}
            />
          </div>
        </TabsContent>

        {/* ── Errors ────────────────────────────────────────────── */}
        <TabsContent value="errors" className="mt-4">
          <Input value={errS.q} onChange={(e) => errS.setQ(e.target.value)} placeholder="Search errors…" className="max-w-xs" />
          <div className="mt-4 space-y-3">
            {errors === null ? (
              <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
            ) : errS.filtered.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
                {errS.q ? "No matching errors." : "No errors recorded. Good."}
              </div>
            ) : (
              errS.filtered.map((e) => (
                <div key={e.id} className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm font-medium text-foreground">{e.message}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{fmt(e.created_at)}</p>
                      {e.context && Object.keys(e.context).length > 0 && (
                        <pre className="mt-2 overflow-x-auto rounded-lg bg-muted/50 p-2 text-xs text-foreground">
                          {JSON.stringify(e.context, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </TabsContent>

        {/* ── Audit log ─────────────────────────────────────────── */}
        <TabsContent value="audit" className="mt-4">
          <div className="flex flex-wrap items-center gap-3">
            <Input value={auditS.q} onChange={(e) => auditS.setQ(e.target.value)} placeholder="Search actions, entity types, actor IDs…" className="max-w-xs" />
            <Button variant="outline" size="sm" onClick={verifyChain} disabled={verifying}>
              {verifying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
              Verify chain integrity
            </Button>
          </div>

          {chainResult && (
            <div className={`mt-3 flex items-start gap-3 rounded-2xl border p-4 ${chainResult.ok ? "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30" : "border-destructive/20 bg-destructive/5"}`}>
              {chainResult.ok
                ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
                : <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {chainResult.ok
                    ? "Audit chain intact — no tampering detected."
                    : `${chainResult.breaks.length} chain break${chainResult.breaks.length !== 1 ? "s" : ""} detected — possible tampering.`}
                </p>
                {!chainResult.ok && (
                  <div className="mt-3 overflow-x-auto rounded-lg border border-destructive/20">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-destructive/20 bg-destructive/10 text-left font-medium uppercase text-muted-foreground">
                          <th className="px-3 py-2">Row</th><th className="px-3 py-2">Time</th>
                          <th className="px-3 py-2">Action</th><th className="px-3 py-2">Stored prev</th>
                          <th className="px-3 py-2">Expected prev</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-destructive/10">
                        {chainResult.breaks.map((b) => (
                          <tr key={b.broken_id}>
                            <td className="px-3 py-2 font-mono">{short(b.broken_id)}</td>
                            <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{fmt(b.broken_at)}</td>
                            <td className="px-3 py-2 font-mono">{b.action}</td>
                            <td className="px-3 py-2 font-mono text-muted-foreground">{b.stored_prev.slice(0, 12)}…</td>
                            <td className="px-3 py-2 font-mono text-muted-foreground">{b.expected_prev.slice(0, 12)}…</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          <DataTable<AuditEntry>
            loading={audit === null}
            rows={auditS.filtered}
            emptyMsg={auditS.q ? "No matching entries." : "No audit entries yet."}
            cols={[
              { label: "Time", render: (a) => <span className="whitespace-nowrap text-muted-foreground">{fmt(a.created_at)}</span> },
              { label: "Action", render: (a) => <span className="font-mono">{a.action}</span> },
              { label: "Entity", render: (a) => <span className="text-muted-foreground">{a.entity_type ?? "—"}</span> },
              { label: "Actor", render: (a) => <span className="text-muted-foreground">{a.actor_type === "anonymous" ? "anon" : a.actor_id ? short(a.actor_id) : "—"}</span> },
              { label: "Payload", render: (a) => <JsonCell value={a.payload} /> },
            ]}
          />
        </TabsContent>

        {/* ── Users ─────────────────────────────────────────────── */}
        <TabsContent value="users" className="mt-4">
          <Input value={profS.q} onChange={(e) => profS.setQ(e.target.value)} placeholder="Search name, company, role…" className="max-w-xs" />
          <DataTable<Profile>
            loading={profiles === null}
            rows={profS.filtered}
            cols={[
              { label: "ID", render: (p) => <span className="font-mono text-muted-foreground">{short(p.id)}</span> },
              { label: "Name", render: (p) => <span className="font-medium">{p.display_name ?? "—"}</span> },
              { label: "Company", render: (p) => <span className="text-muted-foreground">{p.company ?? "—"}</span> },
              { label: "Role", render: (p) => <span className="text-muted-foreground">{p.primary_role ?? "—"}</span> },
              { label: "Onboarded", render: (p) => <JsonCell value={p.onboarding_completed} /> },
              { label: "Joined", render: (p) => <span className="whitespace-nowrap text-muted-foreground">{fmt(p.created_at)}</span> },
            ]}
          />
        </TabsContent>

        {/* ── Listings ──────────────────────────────────────────── */}
        <TabsContent value="listings" className="mt-4">
          <Input value={listS.q} onChange={(e) => listS.setQ(e.target.value)} placeholder="Search title or status…" className="max-w-xs" />
          <DataTable<Listing>
            loading={listings === null}
            rows={listS.filtered}
            cols={[
              { label: "ID", render: (l) => <span className="font-mono text-muted-foreground">{short(l.id)}</span> },
              { label: "Title", render: (l) => <span className="font-medium">{l.title}</span> },
              { label: "Status", render: (l) => <StatusBadge value={l.status} /> },
              { label: "Price / rec", render: (l) => <span className="text-muted-foreground">{l.price_per_record != null ? `$${l.price_per_record}` : "—"}</span> },
              { label: "Records", render: (l) => <span className="text-muted-foreground">{l.total_records?.toLocaleString() ?? "—"}</span> },
              { label: "Created", render: (l) => <span className="whitespace-nowrap text-muted-foreground">{fmt(l.created_at)}</span> },
            ]}
          />
        </TabsContent>

        {/* ── Access Requests ───────────────────────────────────── */}
        <TabsContent value="requests" className="mt-4">
          <Input value={reqS.q} onChange={(e) => reqS.setQ(e.target.value)} placeholder="Search status, IDs…" className="max-w-xs" />
          <DataTable<AccessRequest>
            loading={requests === null}
            rows={reqS.filtered}
            cols={[
              { label: "ID", render: (r) => <span className="font-mono text-muted-foreground">{short(r.id)}</span> },
              { label: "Listing", render: (r) => <span className="font-mono text-muted-foreground">{short(r.listing_id)}</span> },
              { label: "Buyer", render: (r) => <span className="font-mono text-muted-foreground">{short(r.buyer_id)}</span> },
              { label: "Status", render: (r) => <StatusBadge value={r.status} /> },
              { label: "Created", render: (r) => <span className="whitespace-nowrap text-muted-foreground">{fmt(r.created_at)}</span> },
            ]}
          />
        </TabsContent>

        {/* ── Purchases ─────────────────────────────────────────── */}
        <TabsContent value="purchases" className="mt-4">
          <Input value={purS.q} onChange={(e) => purS.setQ(e.target.value)} placeholder="Search buyer, seller, listing IDs…" className="max-w-xs" />
          <DataTable<Purchase>
            loading={purchases === null}
            rows={purS.filtered}
            cols={[
              { label: "ID", render: (p) => <span className="font-mono text-muted-foreground">{short(p.id)}</span> },
              { label: "Listing", render: (p) => <span className="font-mono text-muted-foreground">{short(p.listing_id)}</span> },
              { label: "Buyer", render: (p) => <span className="font-mono text-muted-foreground">{short(p.buyer_id)}</span> },
              { label: "Seller", render: (p) => <span className="font-mono text-muted-foreground">{short(p.seller_id)}</span> },
              { label: "Created", render: (p) => <span className="whitespace-nowrap text-muted-foreground">{fmt(p.created_at)}</span> },
            ]}
          />
        </TabsContent>

        {/* ── GDPR ──────────────────────────────────────────────── */}
        <TabsContent value="gdpr" className="mt-4 space-y-8">
          <section>
            <h2 className="text-sm font-semibold text-foreground">Data subject requests</h2>
            <Input value={dsS.q} onChange={(e) => dsS.setQ(e.target.value)} placeholder="Search type, status, user ID…" className="mt-2 max-w-xs" />
            <DataTable<DsRequest>
              loading={dsRequests === null}
              rows={dsS.filtered}
              cols={[
                { label: "ID", render: (r) => <span className="font-mono text-muted-foreground">{short(r.id)}</span> },
                { label: "User", render: (r) => <span className="font-mono text-muted-foreground">{short(r.user_id)}</span> },
                { label: "Type", render: (r) => <span className="capitalize">{r.request_type}</span> },
                { label: "Status", render: (r) => <StatusBadge value={r.status} /> },
                { label: "Created", render: (r) => <span className="whitespace-nowrap text-muted-foreground">{fmt(r.created_at)}</span> },
              ]}
            />
          </section>
          <section>
            <h2 className="text-sm font-semibold text-foreground">Consent records</h2>
            <Input value={conS.q} onChange={(e) => conS.setQ(e.target.value)} placeholder="Search purpose, user ID…" className="mt-2 max-w-xs" />
            <DataTable<ConsentRecord>
              loading={consents === null}
              rows={conS.filtered}
              cols={[
                { label: "ID", render: (c) => <span className="font-mono text-muted-foreground">{short(c.id)}</span> },
                { label: "User", render: (c) => <span className="font-mono text-muted-foreground">{short(c.user_id)}</span> },
                { label: "Purpose", render: (c) => <span className="capitalize">{c.purpose}</span> },
                { label: "Consented", render: (c) => <JsonCell value={c.consented} /> },
                { label: "Recorded", render: (c) => <span className="whitespace-nowrap text-muted-foreground">{fmt(c.created_at)}</span> },
              ]}
            />
          </section>
        </TabsContent>

        {/* ── Comms ─────────────────────────────────────────────── */}
        <TabsContent value="comms" className="mt-4 space-y-8">
          <section>
            <h2 className="text-sm font-semibold text-foreground">Outbound emails</h2>
            <Input value={emlS.q} onChange={(e) => emlS.setQ(e.target.value)} placeholder="Search email, subject, status…" className="mt-2 max-w-xs" />
            <DataTable<OutboundEmail>
              loading={emails === null}
              rows={emlS.filtered}
              cols={[
                { label: "ID", render: (e) => <span className="font-mono text-muted-foreground">{short(e.id)}</span> },
                { label: "Recipient", render: (e) => <span>{e.recipient_email}</span> },
                { label: "Subject", render: (e) => <span className="text-muted-foreground">{e.subject ?? "—"}</span> },
                { label: "Status", render: (e) => <StatusBadge value={e.status} /> },
                { label: "Queued", render: (e) => <span className="whitespace-nowrap text-muted-foreground">{fmt(e.created_at)}</span> },
              ]}
            />
          </section>
          <section>
            <h2 className="text-sm font-semibold text-foreground">Notifications</h2>
            <Input value={notS.q} onChange={(e) => notS.setQ(e.target.value)} placeholder="Search type, message, user ID…" className="mt-2 max-w-xs" />
            <DataTable<Notification>
              loading={notifications === null}
              rows={notS.filtered}
              cols={[
                { label: "ID", render: (n) => <span className="font-mono text-muted-foreground">{short(n.id)}</span> },
                { label: "User", render: (n) => <span className="font-mono text-muted-foreground">{short(n.user_id)}</span> },
                { label: "Type", render: (n) => <span className="capitalize">{n.type}</span> },
                { label: "Message", render: (n) => <span className="max-w-xs truncate text-muted-foreground">{n.message}</span> },
                { label: "Read", render: (n) => <JsonCell value={n.read} /> },
                { label: "Created", render: (n) => <span className="whitespace-nowrap text-muted-foreground">{fmt(n.created_at)}</span> },
              ]}
            />
          </section>
        </TabsContent>

        {/* ── Anon Jobs ─────────────────────────────────────────── */}
        <TabsContent value="jobs" className="mt-4">
          <Input value={jobS.q} onChange={(e) => jobS.setQ(e.target.value)} placeholder="Search status, listing ID…" className="max-w-xs" />
          <DataTable<AnonJob>
            loading={anonJobs === null}
            rows={jobS.filtered}
            cols={[
              { label: "ID", render: (j) => <span className="font-mono text-muted-foreground">{short(j.id)}</span> },
              { label: "Listing", render: (j) => <span className="font-mono text-muted-foreground">{short(j.listing_id)}</span> },
              { label: "Status", render: (j) => <StatusBadge value={j.status} /> },
              {
                label: "Risk", render: (j) => {
                  const s = j.risk_score;
                  if (s === null) return <span className="text-muted-foreground">—</span>;
                  const cls = s >= 0.6 ? "text-destructive" : s >= 0.3 ? "text-amber-600" : "text-emerald-600";
                  return <span className={`font-mono font-semibold ${cls}`}>{(s * 100).toFixed(0)}%</span>;
                },
              },
              {
                label: "Flagged", render: (j) => j.flagged_for_review
                  ? <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">flagged</span>
                  : <span className="text-muted-foreground">—</span>,
              },
              { label: "Created", render: (j) => <span className="whitespace-nowrap text-muted-foreground">{fmt(j.created_at)}</span> },
            ]}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminMonitoring;
