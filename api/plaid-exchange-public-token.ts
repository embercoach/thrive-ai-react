import type { VercelRequest, VercelResponse } from "@vercel/node";
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

const FREE_BANK_LIMIT = 1;

interface ExchangeRequestBody {
  public_token: string;
}

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

  const body = req.body as ExchangeRequestBody;
  if (!body?.public_token) {
    res.status(400).json({ error: "Missing public_token" });
    return;
  }

  try {
    // Re-checked here (not just in plaid-create-link-token.ts) because that
    // first check happens before the user ever goes through the Link flow —
    // this one is the check that actually decides whether a row gets
    // written, and is the one a client could otherwise bypass by calling
    // this endpoint directly with a public_token from anywhere. Checked
    // BEFORE exchanging the public_token so a rejected attempt never
    // creates a Plaid Item that would then need to be torn down again.
    const { data: profile } = await supabaseAdmin.from("profiles").select("is_pro, currency").eq("id", userId).single();
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

    const exchangeResponse = await plaidClient.itemPublicTokenExchange({ public_token: body.public_token });
    const accessToken = exchangeResponse.data.access_token;
    const itemId = exchangeResponse.data.item_id;

    const itemResponse = await plaidClient.itemGet({ access_token: accessToken });
    const institutionId = itemResponse.data.item.institution_id ?? null;
    const institutionName = itemResponse.data.item.institution_name ?? "Connected Bank";

    const { data: itemRow, error: itemInsertError } = await supabaseAdmin
      .from("plaid_items")
      .insert({
        user_id: userId,
        item_id: itemId,
        access_token: accessToken,
        institution_id: institutionId,
        institution_name: institutionName,
      })
      .select("id")
      .single();
    if (itemInsertError || !itemRow) {
      console.error("plaid_items insert error:", itemInsertError);
      // The Item now exists at Plaid but we couldn't record it — remove it
      // there too rather than leaving an orphaned Item this app can never
      // reach again (no local row means no access_token on file for it).
      await plaidClient.itemRemove({ access_token: accessToken }).catch(() => {});
      res.status(500).json({ error: "Couldn't save this bank connection. Please try again." });
      return;
    }

    const accountsResponse = await plaidClient.accountsGet({ access_token: accessToken });
    const accountRows = accountsResponse.data.accounts.map((a) => ({
      item_id: itemRow.id,
      user_id: userId,
      account_id: a.account_id,
      institution_id: institutionId,
      institution_name: institutionName,
      name: a.name,
      mask: a.mask,
      type: a.type,
      subtype: a.subtype,
      current_balance: a.balances.current,
      available_balance: a.balances.available,
      currency: a.balances.iso_currency_code ?? profile?.currency ?? "USD",
    }));
    if (accountRows.length) {
      const { error: accountsInsertError } = await supabaseAdmin.from("plaid_accounts").insert(accountRows);
      if (accountsInsertError) console.error("plaid_accounts insert error:", accountsInsertError);
    }

    res.status(200).json({ success: true, institutionName, accountsAdded: accountRows.length });
  } catch (err) {
    console.error("plaid-exchange-public-token error:", err);
    res.status(500).json({ error: "Couldn't connect this bank. Please try again." });
  }
}
