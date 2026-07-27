import { useState } from "react";

export function useBalanceVisibility() {
  const [hidden, setHidden] = useState(false);
  return { hidden, toggle: () => setHidden((h) => !h) };
}
