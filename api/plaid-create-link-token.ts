import type { VercelRequest, VercelResponse } from "@vercel/node";
import { captureApiError } from "./_lib/sentry";
import { createClient } from "@supabase/supabase-js";
import { Configuration, PlaidApi, PlaidEnvironments, CountryCode, Products } from "plaid";

// Same pattern as api/chat.ts: a service-role client used only to verify
// the caller's Supabase session, never to read or write app data directly.
const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

// Deliberately self-contained rather than imported from a shared api/_lib
// module — every function in this directory duplicates its own small
// constants instead (see api/chat.ts's SYMBOLS, api/send-bill-reminders.ts's
// formatAmount), so each Vercel function stays independently deployable.
const plaidClient = new PlaidApi(
  new Configuration({
    // Plaid only has two real environments today (sandbox and production —
    // the old separate "development" tier is gone), so this only ever picks
    // between those two.
    basePath: PlaidEnvironments[process.env.PLAID_ENV === "production" ? "production" : "sandbox"],
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
        "PLAID-SECRET": process.env.PLAID_SECRET,
      },
    },
  })
);

// Every country Plaid currently has real bank coverage in. Widening this
// list only changes which institutions Link shows to search for — it has
// no cost or downside, so there's no reason to scope it down to wherever
// Thrive AI's users happen to be today.
const PLAID_COUNTRY_CODES = [
  CountryCode.Us,
  CountryCode.Ca,
  CountryCode.Gb,
  CountryCode.Ie,
  CountryCode.Fr,
  CountryCode.Es,
  CountryCode.Nl,
  CountryCode.De,
  CountryCode.It,
];

// Free plan gets one connected bank; Pro is unlimited. Enforced here (not
// just by disabling the "Connect a bank" button) so a free user can't just
// call this endpoint directly and open Link anyway — the real check that
// matters is the one in api/plaid-exchange-public-token.ts, since that's
// what actually creates the row, but failing fast here avoids sending
// someone through the whole Link flow only to be rejected at the end.
const FREE_BANK_LIMIT = 1;

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

  if (!process.env.PLAID_CLIENT_ID || !process.env.PLAID_SECRET) {
    res.status(500).json({ error: "Server misconfigured: missing Plaid credentials" });
    return;
  }

  try {
    const { data: profile } = await supabaseAdmin.from("profiles").select("is_pro").eq("id", userId).single();
    if (!profile?.is_pro) {
      const { count } = await supabaseAdmin
        .from("plaid_items")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId);
      if ((count ?? 0) >= FREE_BANK_LIMIT) {
        res.status(402).json({ error: "Free plan includes 1 connected bank. Upgrade to Pro to connect more." });
        return;
      }
    }

    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: userId },
      client_name: "Thrive AI",
      products: [Products.Transactions],
      country_codes: PLAID_COUNTRY_CODES,
      language: "en",
    });

    res.status(200).json({ link_token: response.data.link_token });
  } catch (err) {
    console.error("plaid-create-link-token error:", err);
    captureApiError(err, { route: "plaid-create-link-token" });
    res.status(500).json({ error: "Couldn't start bank connection. Please try again." });
  }
}
