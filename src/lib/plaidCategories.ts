/**
 * Maps Plaid's `personal_finance_category.primary` taxonomy (18 fixed
 * upper-snake-case values, e.g. "FOOD_AND_DRINK") onto the free-text
 * category labels this app already uses everywhere (budgets, the Home
 * brief, the AI advisor). Categories in this app are just strings a user
 * types into a field — there's no shared enum to import — so this exists
 * purely to make a synced transaction land on a sensible, human-readable
 * label instead of Plaid's raw constant, and ideally one that lines up
 * with what a user would have typed by hand (so a "Food" budget still
 * catches bank-synced coffee purchases, not just manually-entered ones).
 *
 * A pure function (not living only inside the sync endpoint) so it's
 * unit-testable on its own — same reasoning as computeAlerts and
 * periodTransactions elsewhere in this codebase.
 */
export function mapPlaidCategory(primary: string | null | undefined): string {
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
