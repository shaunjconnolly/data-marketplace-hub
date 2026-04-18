import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, BellRing, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { captureError } from "@/lib/events";

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  action_url: string | null;
  read_at: string | null;
  created_at: string;
};

const Notifications = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<Notification[] | null>(null);
  const [marking, setMarking] = useState(false);

  useEffect(() => {
    async function load() {
      if (!user) return;
      const { data, error } = await supabase
        .from("notifications")
        .select("id, type, title, body, action_url, read_at, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) {
        captureError(error, { scope: "notifications.load" });
        setItems([]);
        return;
      }
      setItems((data ?? []) as Notification[]);
    }
    load();
  }, [user]);

  async function markOne(id: string) {
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return;
    setItems(
      (rows) =>
        rows?.map((r) =>
          r.id === id ? { ...r, read_at: new Date().toISOString() } : r,
        ) ?? null,
    );
  }

  async function markAll() {
    if (!user) return;
    setMarking(true);
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .is("read_at", null);
    setMarking(false);
    if (error) {
      toast.error("Could not mark all read");
      return;
    }
    setItems(
      (rows) =>
        rows?.map((r) =>
          r.read_at ? r : { ...r, read_at: new Date().toISOString() },
        ) ?? null,
    );
  }

  const hasUnread = items?.some((i) => !i.read_at);

  return (
    <div className="container mx-auto max-w-3xl px-6 py-10">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Notifications
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Updates on your access requests, listings, and account.
          </p>
        </div>
        {hasUnread && (
          <Button variant="outline" size="sm" onClick={markAll} disabled={marking}>
            {marking ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Check className="mr-2 h-4 w-4" />
            )}
            Mark all read
          </Button>
        )}
      </header>

      <div className="mt-8 space-y-3">
        {items === null ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <div
            className="rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center"
          >
            <BellRing className="mx-auto h-8 w-8 text-muted-foreground" />
            <h3 className="mt-3 text-base font-semibold text-foreground">
              You're all caught up
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              We'll let you know when something needs your attention.
            </p>
          </div>
        ) : (
          items.map((n) => {
            const unread = !n.read_at;
            const Wrapper: typeof Link = (props) =>
              n.action_url ? <Link {...props} to={n.action_url} /> : (props.children as never);
            const inner = (
              <div
                className={`rounded-2xl border bg-card p-5 transition-colors ${unread ? "border-primary/40" : "border-border"}`}
                style={{ boxShadow: "var(--shadow-soft)" }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {unread && (
                        <span className="h-2 w-2 rounded-full bg-primary" />
                      )}
                      <p className="text-sm font-semibold text-foreground">
                        {n.title}
                      </p>
                    </div>
                    {n.body && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {n.body}
                      </p>
                    )}
                    <p className="mt-2 text-xs text-muted-foreground">
                      {new Date(n.created_at).toLocaleString()}
                    </p>
                  </div>
                  {unread && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        markOne(n.id);
                      }}
                    >
                      Mark read
                    </Button>
                  )}
                </div>
              </div>
            );
            return n.action_url ? (
              <Link
                key={n.id}
                to={n.action_url}
                onClick={() => unread && markOne(n.id)}
                className="block"
              >
                {inner}
              </Link>
            ) : (
              <div key={n.id}>{inner}</div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default Notifications;
