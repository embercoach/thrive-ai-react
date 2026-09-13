import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { usePlaidLink } from "react-plaid-link";
import { ChevronLeft, Landmark, RefreshCw, Trash2, Plus, Crown } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAppData } from "@/hooks/useAppData";
import { supabase } from "@/services/supabase";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { formatMoneySigned } from "@/lib/currency";

interface PlaidAccountRow {
  id: string;
  item_id: string;
  institution_name: string;
  name: string;
  mask: string | null;
  type: string | null;
  current_balance: number | null;
  currency: string | null;
}

const FREE_BANK_LIMIT = 1;

/**
 * Every authenticated call to the plaid-* Vercel functions needs the
 * current Supabase session token — getSession() (not a cached value from
 * an earlier render) so a long-open tab doesn't call these with a token
 * that's since expired. Same pattern as useChat.ts's call to api/chat.
 */
async function authedFetch(path: string, body?: object) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Your session has expired. Please sign in again.");

  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify(body ?? {}),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Something went wrong");
  return data;
}

export function ConnectedBanksPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isPro, refetch: refetchAppData } = useAppData();

  const [accounts, setAccounts] = useState<PlaidAccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [removingItemId, setRemovingItemId] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);

  const loadAccounts = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("plaid_accounts")
      .select("id, item_id, institution_name, name, mask, type, current_balance, currency")
      .eq("user_id", user.id)
      .order("institution_name", { ascending: true });
    setAccounts(data ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const institutions = useMemo(() => {
    const map = new Map<string, { itemId: string; institutionName: string; accounts: PlaidAccountRow[] }>();
    for (const a of accounts) {
      const entry = map.get(a.item_id) ?? { itemId: a.item_id, institutionName: a.institution_name, accounts: [] };
      entry.accounts.push(a);
      map.set(a.item_id, entry);
    }
    return [...map.values()];
  }, [accounts]);

  const atFreeLimit = !isPro && institutions.length >= FREE_BANK_LIMIT;

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: async (publicToken) => {
      setConnecting(true);
      setError("");
      try {
        await authedFetch("/api/plaid-exchange-public-token", { public_token: publicToken });
        await authedFetch("/api/plaid-sync");
        await Promise.all([loadAccounts(), refetchAppData()]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't finish connecting this bank.");
      } finally {
        setConnecting(false);
        setLinkToken(null);
      }
    },
    onExit: () => {
      setConnecting(false);
      setLinkToken(null);
    },
  });

  // usePlaidLink only actually opens once it's `ready` for the token it was
  // just given — calling open() the same instant setLinkToken resolves can
  // fire before that's true, so this effect is what actually launches Link
  // the moment it becomes ready, rather than the click handler itself.
  useEffect(() => {
    if (linkToken && ready) open();
  }, [linkToken, ready, open]);

  async function handleConnect() {
    setError("");
    setConnecting(true);
    try {
      const { link_token } = await authedFetch("/api/plaid-create-link-token");
      setLinkToken(link_token);
    } catch (err) {
      setConnecting(false);
      setError(err instanceof Error ? err.message : "Couldn't start bank connection.");
    }
  }

  async function handleSyncNow() {
    setError("");
    setSyncing(true);
    try {
      await authedFetch("/api/plaid-sync");
      await Promise.all([loadAccounts(), refetchAppData()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't sync your accounts.");
    } finally {
      setSyncing(false);
    }
  }

  async function handleRemove() {
    if (!removingItemId) return;
    setRemoving(true);
    setError("");
    try {
      await authedFetch("/api/plaid-remove-item", { item_id: removingItemId });
      await Promise.all([loadAccounts(), refetchAppData()]);
      setRemovingItemId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't disconnect this bank.");
    } finally {
      setRemoving(false);
    }
  }

  const removingInstitution = institutions.find((i) => i.itemId === removingItemId);

  return (
    <div className="px-4 pt-6 pb-4 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate("/profile")}
          aria-label="Back"
          className="text-ink-secondary cursor-pointer -ml-1 p-1"
        >
          <ChevronLeft size={22} />
        </button>
        <h1 className="text-xl font-bold text-ink">Connected Banks</h1>
      </div>

      {error && (
        <p className="text-xs text-negative bg-negative/5 border border-negative/20 rounded-xl py-2 px-3">{error}</p>
      )}

      {loading ? (
        <Card>
          <p className="text-xs text-ink-secondary">Loading…</p>
        </Card>
      ) : institutions.length === 0 ? (
        <Card>
          <div className="flex items-center gap-2 mb-1.5">
            <Landmark size={16} className="text-ink-secondary" />
            <h2 className="text-sm font-bold text-ink">No banks connected yet</h2>
          </div>
          <p className="text-xs text-ink-secondary mb-3">
            Connect a bank to automatically import transactions instead of adding them by hand. Thrive AI never sees
            or stores your bank login — that's handled entirely by Plaid, a bank-connection service used by
            thousands of apps.
          </p>
          <Button size="sm" onClick={handleConnect} disabled={connecting}>
            <Plus size={14} /> {connecting ? "Connecting…" : "Connect a bank"}
          </Button>
        </Card>
      ) : (
        <>
          {institutions.map((inst) => (
            <Card key={inst.itemId}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Landmark size={16} className="text-brand" />
                  <h2 className="text-sm font-bold text-ink">{inst.institutionName}</h2>
                </div>
                <button
                  onClick={() => setRemovingItemId(inst.itemId)}
                  aria-label={`Disconnect ${inst.institutionName}`}
                  className="text-ink-muted hover:text-negative cursor-pointer p-1"
                >
                  <Trash2 size={15} />
                </button>
              </div>
              <div className="flex flex-col">
                {inst.accounts.map((a) => (
                  <div key={a.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div className="min-w-0">
                      <div className="text-sm text-ink truncate">{a.name}</div>
                      {a.mask && <div className="text-[11px] text-ink-muted">•••• {a.mask}</div>}
                    </div>
                    <div className="text-sm font-semibold text-ink flex-shrink-0">
                      {a.current_balance != null ? formatMoneySigned(a.current_balance, a.currency || "USD") : "—"}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))}

          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handleSyncNow} disabled={syncing} className="flex-1">
              <RefreshCw size={14} className={syncing ? "animate-spin" : ""} /> {syncing ? "Syncing…" : "Sync now"}
            </Button>
            {!atFreeLimit && (
              <Button size="sm" onClick={handleConnect} disabled={connecting} className="flex-1">
                <Plus size={14} /> {connecting ? "Connecting…" : "Connect another"}
              </Button>
            )}
          </div>

          {atFreeLimit && (
            <Card padding="sm">
              <div className="flex items-center gap-2">
                <Crown size={14} className="text-brand flex-shrink-0" />
                <p className="text-xs text-ink-secondary">Free plan includes 1 connected bank. Upgrade to Pro to connect more.</p>
              </div>
            </Card>
          )}
        </>
      )}

      <p className="text-[11px] text-ink-muted leading-relaxed">
        Bank data updates automatically once a day, or tap "Sync now" any time. Imported transactions appear
        alongside your manually-added ones everywhere in the app.
      </p>

      <ConfirmModal
        open={!!removingItemId}
        title="Disconnect Bank"
        message={`Disconnect ${removingInstitution?.institutionName ?? "this bank"}? Your existing transactions will be kept, but new ones will stop importing until you reconnect.`}
        confirmLabel="Disconnect"
        loading={removing}
        onConfirm={handleRemove}
        onCancel={() => setRemovingItemId(null)}
      />
    </div>
  );
}
