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

interface RemoveRequestBody {
  item_id: string; // our plaid_items.id (uuid), not Plaid's own item_id
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

  const body = req.body as RemoveRequestBody;
  if (!body?.item_id) {
    res.status(400).json({ error: "Missing item_id" });
    return;
  }

  try {
    // Scoped by user_id, not just id — belt-and-suspenders alongside RLS
    // (which here is "no policies at all", so this query is the only thing
    // that could possibly let someone remove another user's bank — the
    // access_token would never even leave this function if this row didn't
    // match, since it's read and used together in one query).
    const { data: item, error: fetchError } = await supabaseAdmin
      .from("plaid_items")
      .select("id, access_token")
      .eq("id", body.item_id)
      .eq("user_id", userId)
      .single();
    if (fetchError || !item) {
      res.status(404).json({ error: "Bank connection not found" });
      return;
    }

    // Ask Plaid to invalidate the access_token first. If this fails, don't
    // delete the local row — that would leave an Item alive at Plaid with
    // no local record of it (and no way to remove it later, since the
    // access_token would be gone too). Better to let the user retry.
    await plaidClient.itemRemove({ access_token: item.access_token });

    const { error: deleteError } = await supabaseAdmin.from("plaid_items").delete().eq("id", item.id);
    if (deleteError) throw deleteError;

    res.status(200).json({ success: true });
  } catch (err) {
    console.error("plaid-remove-item error:", err);
    captureApiError(err, { route: "plaid-remove-item" });
    res.status(500).json({ error: "Couldn't disconnect this bank. Please try again." });
  }
}
