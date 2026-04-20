import { useRef, useState } from "react";
import { AlertTriangle, ChevronDown, Clock, Loader2, Play, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// ─── Query history (localStorage) ────────────────────────────────────────────

const HISTORY_KEY = "admin_sql_history";
const MAX_HISTORY = 20;

function getHistory(): string[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]"); }
  catch { return []; }
}

function pushHistory(sql: string) {
  const trimmed = sql.trim();
  if (!trimmed) return;
  const next = [trimmed, ...getHistory().filter((q) => q !== trimmed)].slice(0, MAX_HISTORY);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
}

function clearHistory() {
  localStorage.removeItem(HISTORY_KEY);
}

// ─── Types ────────────────────────────────────────────────────────────────────

type SqlResult = {
  type?: "select" | "mutation";
  rows?: Record<string, unknown>[];
  rowCount?: number;
  error?: string;
  detail?: string;
};

// ─── Quick-access starter queries ─────────────────────────────────────────────

const STARTERS = [
  { label: "Profiles",     sql: "select * from public.profiles order by created_at desc limit 20;" },
  { label: "Listings",     sql: "select * from public.listings order by created_at desc limit 20;" },
  { label: "Purchases",    sql: "select * from public.purchases order by created_at desc limit 20;" },
  { label: "Waitlist",     sql: "select * from public.waitlist order by created_at desc limit 20;" },
  { label: "Audit log",    sql: "select * from public.audit_log order by created_at desc limit 20;" },
  { label: "Errors",       sql: "select * from public.captured_errors order by created_at desc limit 20;" },
  { label: "Payouts",      sql: "select * from public.payout_requests order by created_at desc limit 20;" },
  { label: "GDPR",         sql: "select * from public.data_subject_requests order by created_at desc limit 20;" },
  { label: "Anon jobs",    sql: "select * from public.anonymisation_jobs order by created_at desc limit 20;" },
  { label: "Table sizes",  sql: "select relname as table, n_live_tup as rows from pg_stat_user_tables order by n_live_tup desc;" },
];

// ─── Component ────────────────────────────────────────────────────────────────

const AdminSql = () => {
  const [sql, setSql] = useState(STARTERS[0].sql);
  const [result, setResult] = useState<SqlResult | null>(null);
  const [running, setRunning] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<string[]>(getHistory);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function run() {
    const query = sql.trim();
    if (!query) return;
    setRunning(true);
    setResult(null);

    const { data, error } = await supabase.rpc("admin_execute_sql", { p_sql: query });

    setRunning(false);

    if (error) {
      toast.error(error.message);
      setResult({ error: error.message });
      return;
    }

    const res = data as SqlResult;
    setResult(res);

    if (res.error) {
      toast.error(res.error);
    } else {
      pushHistory(query);
      setHistory(getHistory());
      if (res.type === "mutation") {
        toast.success(`${res.rowCount} row${res.rowCount !== 1 ? "s" : ""} affected`);
      }
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      run();
    }
    // Tab → insert 2 spaces
    if (e.key === "Tab") {
      e.preventDefault();
      const el = e.currentTarget;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const next = sql.slice(0, start) + "  " + sql.slice(end);
      setSql(next);
      requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = start + 2; });
    }
  }

  const cols = result?.rows?.length ? Object.keys(result.rows[0]) : [];

  return (
    <div className="container mx-auto max-w-7xl px-6 py-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">SQL Runner</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Execute any SQL against the database. Admin only. Use <kbd className="rounded border border-border bg-muted px-1 py-0.5 text-xs">⌘ Enter</kbd> to run.
        </p>
      </header>

      {/* ── Quick starters ─────────────────────────────────────────── */}
      <div className="mt-4 flex flex-wrap gap-2">
        {STARTERS.map((s) => (
          <button
            key={s.label}
            onClick={() => setSql(s.sql)}
            className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* ── Editor ─────────────────────────────────────────────────── */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-2">
          <span className="text-xs font-medium text-muted-foreground">SQL</span>
          <div className="flex items-center gap-2">
            {history.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setShowHistory((v) => !v)}
              >
                <Clock className="mr-1.5 h-3.5 w-3.5" />
                History
                <ChevronDown className={`ml-1 h-3 w-3 transition-transform ${showHistory ? "rotate-180" : ""}`} />
              </Button>
            )}
          </div>
        </div>

        {/* History dropdown */}
        {showHistory && (
          <div className="border-b border-border bg-muted/10">
            <div className="flex items-center justify-between px-4 py-2">
              <span className="text-xs font-medium text-muted-foreground">Recent queries</span>
              <button
                onClick={() => { clearHistory(); setHistory([]); setShowHistory(false); }}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3 w-3" /> Clear
              </button>
            </div>
            <div className="max-h-48 overflow-y-auto">
              {history.map((q, i) => (
                <button
                  key={i}
                  onClick={() => { setSql(q); setShowHistory(false); }}
                  className="w-full truncate border-t border-border/50 px-4 py-2 text-left font-mono text-xs text-muted-foreground hover:bg-muted/50"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        <textarea
          ref={textareaRef}
          value={sql}
          onChange={(e) => setSql(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={8}
          spellCheck={false}
          className="w-full resize-y bg-transparent p-4 font-mono text-sm text-foreground outline-none placeholder:text-muted-foreground/50 min-h-[140px]"
          placeholder="select * from public.profiles limit 10;"
        />

        <div className="flex items-center justify-between border-t border-border px-4 py-3">
          <p className="text-xs text-muted-foreground">
            {result && !result.error && (
              result.type === "select"
                ? `${result.rowCount} row${result.rowCount !== 1 ? "s" : ""} returned`
                : `${result.rowCount} row${result.rowCount !== 1 ? "s" : ""} affected`
            )}
          </p>
          <Button onClick={run} disabled={running || !sql.trim()}>
            {running
              ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              : <Play className="mr-2 h-4 w-4" />}
            Run
          </Button>
        </div>
      </div>

      {/* ── Error ──────────────────────────────────────────────────── */}
      {result?.error && (
        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-destructive/20 bg-destructive/5 p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div>
            <p className="text-sm font-medium text-destructive">{result.error}</p>
            {result.detail && (
              <p className="mt-0.5 font-mono text-xs text-muted-foreground">{result.detail}</p>
            )}
          </div>
        </div>
      )}

      {/* ── Results table ───────────────────────────────────────────── */}
      {result && !result.error && result.rows && result.rows.length > 0 && (
        <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs font-medium uppercase text-muted-foreground">
                  {cols.map((c) => (
                    <th key={c} className="whitespace-nowrap px-4 py-3">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {result.rows.map((row, i) => (
                  <tr key={i} className="hover:bg-muted/20">
                    {cols.map((c) => (
                      <td key={c} className="max-w-xs px-4 py-3 text-xs">
                        {row[c] === null || row[c] === undefined ? (
                          <span className="italic text-muted-foreground">null</span>
                        ) : typeof row[c] === "object" ? (
                          <details className="cursor-pointer">
                            <summary className="text-xs text-primary hover:underline">json</summary>
                            <pre className="mt-1 max-w-sm overflow-x-auto rounded bg-muted/50 p-1.5 text-xs">
                              {JSON.stringify(row[c], null, 2)}
                            </pre>
                          </details>
                        ) : (
                          <span className="font-mono">{String(row[c])}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {result && !result.error && result.type === "mutation" && (
        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 dark:border-green-900 dark:bg-green-950/30">
          <span className="text-sm font-medium text-green-700 dark:text-green-400">
            {result.rowCount} row{result.rowCount !== 1 ? "s" : ""} affected
          </span>
        </div>
      )}
    </div>
  );
};

export default AdminSql;
