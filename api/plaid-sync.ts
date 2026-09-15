import type { VercelRequest, VercelResponse } from "@vercel/node";
import { captureApiError } from "./_lib/sentry";
import { createClient } from "@supabase/supabase-js";
import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

const plaidClient = new PlaidApi(
  new Configuration({
    basePath: PlaidEnvironments[process.env.PLAID_ENV === "production" ? "production" : "sandbox"],
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
        "PLAID-SECRET": process.env.PLAID_SECRET,
      },
    },
  })
);

// Deliberately duplicated from src/lib/plaidCategories.ts rather than
// imported — api/ functions in this project are self-contained (see
// api/chat.ts's own note on this), so small helpers like this are kept in
// both places on purpose instead of sharing a module across the client
// bundle and the Vercel functions.
function mapPlaidCategory(primary: string | null | undefined): string {
  switch (primary) {
    case "INCOME":
      return "Income";
    case "TRANSFER_IN":
    case "TRANSFER_OUT":
    case "LOAN_DISBURSEMENTS":
      return "Transfer";
    case "LOAN_PAYMENTS":
      return "Loan Payments";
    case "BANK_FEES":
      return "Fees";
    case "ENTERTAINMENT":
      return "Entertainment";
    case "FOOD_AND_DRINK":
      return "Food";
    case "GENERAL_MERCHANDISE":
      return "Shopping";
    case "HOME_IMPROVEMENT":
      return "Home";
    case "MEDICAL":
      return "Health";
    case "PERSONAL_CARE":
      return "Personal Care";
    case "GENERAL_SERVICES":
      return "Services";
    case "GOVERNMENT_AND_NON_PROFIT":
      return "Government & Non-Profit";
    case "TRANSPORTATION":
      return "Transport";
    case "TRAVEL":
      return "Travel";
    case "RENT_AND_UTILITIES":
      return "Housing";
    case "OTHER":
    default:
      return "Other";
  }
}

interface PlaidItemRow {
  id: string;
  user_id: string;
  item_id: string;
  access_token: string;
  cursor: string | null;
}

interface SyncTotals {
  itemsSynced: number;
  itemsFailed: number;
  transactionsAdded: number;
  transactionsRemoved: number;
}

/**
 * Refreshes account balances, then pulls every transaction change since
 * this Item's stored cursor and applies it to the shared `transactions`
 * table. Wrapped by the caller in a try/catch per item — one Item hitting
 * an error (e.g. the user changed their bank password and Plaid needs them
 * to reconnect) must never stop every other Item in the same batch from
 * syncing, especially in cron mode where a single run covers every user.
 */
async function syncItem(item: PlaidItemRow, fallbackCurrency: string, totals: SyncTotals) {
  const accountsResponse = await plaidClient.accountsGet({ access_token: item.access_token });
  const { data: existingAccounts } = await supabaseAdmin
    .from("plaid_accounts")
    .select("id, account_id, institution_id, institution_name")
    .eq("item_id", item.id);
  const meta = existingAccounts?.[0];

  const accountRows = accountsResponse.data.accounts.map((a) => ({
    item_id: item.id,
    user_id: item.user_id,
    account_id: a.account_id,
    institution_id: meta?.institution_id ?? null,
    institution_name: meta?.institution_name ?? "Connected Bank",
    name: a.name,
    mask: a.mask,
    type: a.type,
    subtype: a.subtype,
    current_balance: a.balances.current,
    available_balance: a.balances.available,
    currency: a.balances.iso_currency_code ?? fallbackCurrency,
  }));
  const { data: upsertedAccounts, error: accountsError } = await supabaseAdmin
    .from("plaid_accounts")
    .upsert(accountRows, { onConflict: "account_id" })
    .select("id, account_id");
  if (accountsError) throw accountsError;

  const accountIdByPlaidId = new Map((upsertedAccounts ?? []).map((a) => [a.account_id, a.id]));

  let cursor = item.cursor ?? undefined;
  let hasMore = true;
  const upsertRows: Record<string, unknown>[] = [];
  const removedIds: string[] = [];

  while (hasMore) {
    const syncResponse = await plaidClient.transactionsSync({ access_token: item.access_token, cursor });
    for (const t of [...syncResponse.data.added, ...syncResponse.data.modified]) {
      upsertRows.push({
        user_id: item.user_id,
        name: t.merchant_name || t.name || "Transaction",
        amount: -t.amount,
        category: mapPlaidCategory(t.personal_finance_category?.primary),
        date: t.date,
        currency: t.iso_currency_code ?? fallbackCurrency,
        source: "plaid",
        plaid_transaction_id: t.transaction_id,
        plaid_account_id: accountIdByPlaidId.get(t.account_id) ?? null,
      });
    }
    for (const r of syncResponse.data.removed) {
      if (r.transaction_id) removedIds.push(r.transaction_id);
    }
    cursor = syncResponse.data.next_cursor;
    hasMore = syncResponse.data.has_more;
  }

  if (upsertRows.length) {
    const { error } = await supabaseAdmin.from("transactions").upsert(upsertRows, { onConflict: "plaid_transaction_id" });
    if (error) throw error;
    totals.transactionsAdded += upsertRows.length;
  }
  if (removedIds.length) {
    const { error } = await supabaseAdmin
      .from("transactions")
      .delete()
      .eq("user_id", item.user_id)
      .in("plaid_transaction_id", removedIds);
    if (error) throw error;
    totals.transactionsRemoved += removedIds.length;
  }

  await supabaseAdmin
    .from("plaid_items")
    .update({ cursor, status: "active", last_synced_at: new Date().toISOString() })
    .eq("id", item.id);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: "Missing or invalid authorization" });
    return;
  }

  const cronSecret = process.env.CRON_SECRET;
  const isCron = !!cronSecret && token === cronSecret;

  let userId: string | null = null;
  if (!isCron) {
    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !authData?.user) {
      res.status(401).json({ error: "Invalid or expired session" });
      return;
    }
    userId = authData.user.id;
  }

  if (!process.env.PLAID_CLIENT_ID || !process.env.PLAID_SECRET) {
    res.status(500).json({ error: "Server misconfigured: missing Plaid credentials" });
    return;
  }

  const totals: SyncTotals = { itemsSynced: 0, itemsFailed: 0, transactionsAdded: 0, transactionsRemoved: 0 };

  try {
    let itemsQuery = supabaseAdmin.from("plaid_items").select("id, user_id, item_id, access_token, cursor");
    if (userId) itemsQuery = itemsQuery.eq("user_id", userId);
    const { data: items, error: itemsError } = await itemsQuery;
    if (itemsError) throw itemsError;

    // Currencies are fetched once, keyed by user, rather than per item — a
    // user with two connected banks shouldn't cost two profile lookups.
    const userIds = [...new Set((items ?? []).map((i) => i.user_id))];
    const { data: profiles } = await supabaseAdmin.from("profiles").select("id, currency").in("id", userIds);
    const currencyByUser = new Map((profiles ?? []).map((p) => [p.id, p.currency || "USD"]));

    for (const item of (items ?? []) as PlaidItemRow[]) {
      try {
        await syncItem(item, currencyByUser.get(item.user_id) ?? "USD", totals);
        totals.itemsSynced++;
      } catch (err) {
        console.error(`plaid-sync error for item ${item.item_id}:`, err);
        totals.itemsFailed++;
        await supabaseAdmin.from("plaid_items").update({ status: "error" }).eq("id", item.id);
      }
    }

    res.status(200).json(totals);
  } catch (err) {
    console.error("plaid-sync error:", err);
    captureApiError(err, { route: "plaid-sync" });
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
}
