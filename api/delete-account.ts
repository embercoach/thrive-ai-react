import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

// Same pattern as every other api/*.ts: a service-role client that bypasses
// RLS, because this handler must read and delete across every table this
// user owns, not just what RLS would let their own session touch.
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

// Every table that stores rows keyed by user_id, in an order that's safe to
// delete in (children before anything they might reference) even though
// this project's tables have no ON DELETE CASCADE to lean on. profiles is
// deleted last since it's the "parent" row conceptually, and auth.admin.
// deleteUser() is called only after every one of these has succeeded — if
// this account is ever recreated with the same id (it can't be, since
// deleteUser() is what frees the email/id, but as a matter of ordering
// discipline) no orphaned rows would already exist under it.
const USER_ID_TABLES = [
  "chat_messages",
  "notification_log",
  "push_subscriptions",
  "feedback",
  "transactions",
  "recurring",
  "budgets",
  "goals",
  "plaid_accounts",
  "plaid_items",
  "paddle_subscriptions",
] as const;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: "Missing or invalid authorization" });
    return;
  }
  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData?.user) {
    res.status(401).json({ error: "Invalid or expired session" });
    return;
  }
  const userId = authData.user.id;

  try {
    // Best-effort: ask Plaid to invalidate every linked item's access_token
    // before the local plaid_items rows (which hold those tokens) are
    // deleted below. Unlike api/plaid-remove-item.ts (which aborts a single
    // disconnect if this fails, since the user can just retry that one
    // item), a failure here must NOT block the rest of account deletion —
    // there's no "retry later" once the account and its rows are gone. Any
    // item that fails to release at Plaid is logged for manual cleanup
    // rather than left to silently strand the user's data.
    const { data: items } = await supabaseAdmin
      .from("plaid_items")
      .select("id, access_token")
      .eq("user_id", userId);
    for (const item of items ?? []) {
      try {
        await plaidClient.itemRemove({ access_token: item.access_token });
      } catch (err) {
        console.error(`delete-account: Plaid itemRemove failed for item ${item.id} (user ${userId}):`, err);
      }
    }

    for (const table of USER_ID_TABLES) {
      const { error } = await supabaseAdmin.from(table).delete().eq("user_id", userId);
      if (error) {
        console.error(`delete-account: failed deleting from ${table} for user ${userId}:`, error);
        res.status(500).json({ error: "Couldn't delete your account. Please try again." });
        return;
      }
    }

    // profiles.id IS the user id (not a user_id foreign key column), and is
    // removed last since every table above conceptually hangs off it.
    const { error: profileError } = await supabaseAdmin.from("profiles").delete().eq("id", userId);
    if (profileError) {
      console.error(`delete-account: failed deleting profile for user ${userId}:`, profileError);
      res.status(500).json({ error: "Couldn't delete your account. Please try again." });
      return;
    }

    // Deletes the auth.users row itself and invalidates every existing
    // session/refresh token for this user — done last, only once every
    // owned row is confirmed gone, so a failure here never leaves an
    // account that still signs in but has no data behind it.
    const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteUserError) {
      console.error(`delete-account: failed deleting auth user ${userId}:`, deleteUserError);
      res.status(500).json({ error: "Couldn't delete your account. Please try again." });
      return;
    }

    res.status(200).json({ success: true });
  } catch (err) {
    console.error("delete-account error:", err);
    res.status(500).json({ error: "Couldn't delete your account. Please try again." });
  }
}
