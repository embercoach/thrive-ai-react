// Owned by the i18n conversion pass for src/components/transactions/*.
// Populated by converting: AddTransactionModal, BillRow, CategoryRow,
// EditTransactionModal, ManageBudgetsModal, ManageRecurringModal,
// TransactionForm, TransactionRow.
export const transactions = {
  // Text genuinely shared, word-for-word and in the same role, across more
  // than one of the components above (form field labels/placeholders and
  // a couple of tiny validation/status words).
  shared: {
    delete: "Delete",
    deleting: "Deleting…",
    saving: "Saving…",
    expense: "Expense",
    income: "Income",
    typeLabel: "Type",
    categoryLabel: "Category",
    amountLabel: "Amount",
    amountPlaceholder: "0.00",
    fillNameAmount: "Please fill in name and amount.",
  },

  addModal: {
    title: "Add Transaction",
    submitLabel: "Add Transaction",
  },

  editModal: {
    title: "Edit Transaction",
    deletePartTitle: "Delete part of this split?",
    deleteTitle: "Delete this transaction?",
    deleteSplitMessage:
      '"{name}" was split across {count} categories. Removing just this part leaves the rest, so the split will no longer add up to what you actually spent.',
    deleteMessage:
      '"{name}" will be removed and your balance, category totals and budgets will recalculate. This can\'t be undone.',
    deleteAllParts: "Delete all {count} parts",
    keepIt: "Keep it",
    onlyThisPart: "Only this part",
    recurringNotice: "Created by a recurring bill. Editing changes only this one entry, not the bill itself.",
    splitNotice: "One part of a {count}-way split. Changing the amount here won't adjust the other parts.",
    saveChanges: "Save changes",
    deleteTransactionAria: "Delete transaction",
  },

  billRow: {
    overdue: "Overdue",
    today: "Today",
    tomorrow: "Tomorrow",
  },

  categoryRow: {
    overBudget: "{amount} over budget",
    leftOfBudget: "{amount} left of budget",
    noBudgetSet: "No budget set",
  },

  manageBudgets: {
    title: "Manage Budgets",
    noCategoriesYet:
      "No spending categories yet this month, add a transaction first, or set a budget for a new category below.",
    noLimitPlaceholder: "No limit",
    addBudgetLabel: "Add a budget for another category",
    categoryPlaceholder: "e.g. Travel",
    saving: "Saving...",
    addBudget: "Add Budget",
    freePlanUsage: "Free plan: {used} of {limit} budgets used",
    clearToRemove: "Clear an amount to remove that category's budget.",
    enterCategoryAmount: "Enter a category and an amount greater than 0.",
  },

  manageRecurring: {
    title: "Manage Recurring",
    noneYet: "No recurring bills or income set up yet.",
    deleteTitle: "Delete this recurring item?",
    deleteMessage:
      '"{name}" will stop creating new transactions. Any it already made will stay in your history. This can\'t be undone.',
    pauseAria: "Pause",
    resumeAria: "Resume",
    monthly: "Monthly",
    weekly: "Weekly",
    nextDateDisplay: "{frequency} · next {date}",
    nameLabel: "Name",
    namePlaceholder: "e.g. Rent",
    categoryPlaceholder: "e.g. Housing",
    frequencyLabel: "Frequency",
    nextDateLabel: "Next Date",
    cancel: "Cancel",
    save: "Save",
    addRecurring: "Add Recurring",
    freePlanUsage: "Free plan: {used} of {limit} recurring items used",
  },

  form: {
    eachSplitPositive: "Each split amount must be greater than 0.",
    splitNeedsTwo: "A split needs at least two categories with amounts.",
    unallocated: "{amount} still unallocated.",
    splitOverBy: "Split is over by {amount}.",
    merchantLabel: "Merchant",
    merchantPlaceholder: "e.g. Woolworths",
    totalAmountLabel: "Total amount",
    splitAcrossLabel: "Split across",
    cancelSplit: "Cancel split",
    removeSplitLineAria: "Remove split line",
    addCategory: "Add category",
    balanced: "Balanced",
    amountLeft: "{amount} left",
    amountOver: "{amount} over",
    categoryPlaceholder: "e.g. Food, Housing, Transport…",
    splitAcrossCategories: "Split across categories",
    accountLabel: "Account",
    accountPlaceholder: "e.g. Cheque card (optional)",
    dateLabel: "Date",
    notesLabel: "Notes",
    notesPlaceholder: "Anything worth remembering (optional)",
  },

  row: {
    partOfSplitAria: "Part of a split",
    hasNotesAria: "Has notes",
  },
};
