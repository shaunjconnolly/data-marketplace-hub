import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bug, CheckCircle2, Info, Loader2, RefreshCw, ShieldCheck, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { toast } from "sonner";

type CapturedError = {
  id: string;
  message: string;
  context: Record<string, unknown> | null;
  created_at: string;
};

type AuditEntry = {
  id: string;
  actor_id: string | null;
  actor_type: string | null;
  entity_type: string | null;
  action: string;
  payload: Record<string, unknown> | null;
  created_at: string;
};

const AdminMonitoring = () => {
  const [errors, setErrors] = useState<CapturedError[] | null>(null);
  const [audit, setAudit] = useState<AuditEntry[] | null>(null);
  const [errSearch, setErrSearch] = useState("");
  const [auditSearch, setAuditSearch] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    const [{ data: errData, error: errErr }, { data: auditData, error: auditErr }] =
      await Promise.all([
        supabase
          .from("captured_errors")
          .select("id, message, context, created_at")
          .order("created_at", { ascending: false })
          .limit(200),
        supabase
          .from("audit_log")
          .select("id, actor_id, actor_type, entity_type, action, payload, created_at")
          .order("created_at", { ascending: false })
          .limit(200),
      ]);
    setLoading(false);
    if (errErr) { toast.error("Could not load errors"); setErrors([]); }
    else setErrors((errData ?? []) as CapturedError[]);
    if (auditErr) { toast.error("Could not load audit log"); setAudit([]); }
    else setAudit((auditData ?? []) as AuditEntry[]);
  }

  useEffect(() => { load(); }, []);

  type ChainBreak = { broken_id: string; broken_at: string; action: string; stored_prev: string; expected_prev: string };
  const [chainResult, setChainResult] = useState<{ ok: boolean; breaks: ChainBreak[] } | null>(null);
  const [verifying, setVerifying] = useState(false);

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

  const filteredErrors = useMemo(() => {
    if (!errors) return [];
    const q = errSearch.trim().toLowerCase();
    if (!q) return errors;
    return errors.filter(
      (e) =>
        e.message.toLowerCase().includes(q) ||
        JSON.stringify(e.context ?? {}).toLowerCase().includes(q),
    );
  }, [errors, errSearch]);

  const filteredAudit = useMemo(() => {
    if (!audit) return [];
    const q = auditSearch.trim().toLowerCase();
    if (!q) return audit;
    return audit.filter(
      (a) =>
        a.action.toLowerCase().includes(q) ||
        (a.entity_type ?? "").toLowerCase().includes(q) ||
        (a.actor_id ?? "").toLowerCase().includes(q),
    );
  }, [audit, auditSearch]);

  return (
    <div className="container mx-auto max-w-6xl px-6 py-10">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Monitoring
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Captured errors and platform audit log — last 200 entries each.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </header>

      <Tabs defaultValue="errors" className="mt-6">
        <TabsList>
          <TabsTrigger value="errors">
            <Bug className="mr-1.5 h-4 w-4" />
            Errors
            {errors && errors.length > 0 && (
              <span className="ml-2 rounded-full bg-destructive/15 px-1.5 py-0.5 text-xs font-medium text-destructive">
                {errors.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="audit">
            <Info className="mr-1.5 h-4 w-4" />
            Audit log
            {audit && (
              <span className="ml-2 rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                {audit.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Errors ─────────────────────────────────────────── */}
        <TabsContent value="errors" className="mt-4">
          <Input
            value={errSearch}
            onChange={(e) => setErrSearch(e.target.value)}
            placeholder="Search errors…"
            className="max-w-xs"
          />
          <div className="mt-4 space-y-3">
            {errors === null ? (
              <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
            ) : filteredErrors.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
                {errSearch ? "No matching errors." : "No errors recorded. Good."}
              </div>
            ) : (
              filteredErrors.map((e) => (
                <div
                  key={e.id}
                  className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4"
                >
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground break-words">
                        {e.message}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {new Date(e.created_at).toLocaleString()}
                      </p>
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

        {/* ── Audit log ──────────────────────────────────────── */}
        <TabsContent value="audit" className="mt-4">
          <div className="flex flex-wrap items-center gap-3">
            <Input
              value={auditSearch}
              onChange={(e) => setAuditSearch(e.target.value)}
              placeholder="Search actions, entity types, actor IDs…"
              className="max-w-xs"
            />
            <Button variant="outline" size="sm" onClick={verifyChain} disabled={verifying}>
              {verifying ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="mr-2 h-4 w-4" />
              )}
              Verify chain integrity
            </Button>
          </div>

          {chainResult && (
            <div
              className={`mt-3 flex items-start gap-3 rounded-2xl border p-4 ${
                chainResult.ok
                  ? "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30"
                  : "border-destructive/20 bg-destructive/5"
              }`}
            >
              {chainResult.ok ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
              ) : (
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              )}
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
                          <th className="px-3 py-2">Broken row</th>
                          <th className="px-3 py-2">Time</th>
                          <th className="px-3 py-2">Action</th>
                          <th className="px-3 py-2">Stored prev</th>
                          <th className="px-3 py-2">Expected prev</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-destructive/10">
                        {chainResult.breaks.map((b) => (
                          <tr key={b.broken_id}>
                            <td className="px-3 py-2 font-mono">{b.broken_id.slice(0, 8)}…</td>
                            <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                              {new Date(b.broken_at).toLocaleString()}
                            </td>
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
          <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card">
            {audit === null ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : filteredAudit.length === 0 ? (
              <p className="px-6 py-12 text-center text-sm text-muted-foreground">
                {auditSearch ? "No matching entries." : "No audit entries yet."}
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left text-xs font-medium uppercase text-muted-foreground">
                    <th className="px-4 py-3">Time</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Entity</th>
                    <th className="px-4 py-3">Actor</th>
                    <th className="px-4 py-3">Payload</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredAudit.map((a) => (
                    <tr key={a.id} className="hover:bg-muted/20">
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                        {new Date(a.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-foreground">
                        {a.action}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {a.entity_type ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {a.actor_type === "anonymous"
                          ? "anon"
                          : a.actor_id
                            ? a.actor_id.slice(0, 8) + "…"
                            : "—"}
                      </td>
                      <td className="max-w-xs px-4 py-3">
                        {a.payload ? (
                          <details className="cursor-pointer">
                            <summary className="text-xs text-primary hover:underline">
                              view
                            </summary>
                            <pre className="mt-1 overflow-x-auto rounded bg-muted/50 p-1.5 text-xs">
                              {JSON.stringify(a.payload, null, 2)}
                            </pre>
                          </details>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminMonitoring;
