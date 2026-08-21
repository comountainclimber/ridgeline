export type ClaimUser = {
  id: string;
  email: string | null;
};

export type ClaimPlan =
  | { type: "attach"; userId: string }
  | { type: "merge"; accountId: string; guestId: string }
  | { type: "create" }
  | { type: "reuse"; userId: string };

export function planClaim(input: {
  guest: ClaimUser | null;
  account: ClaimUser | null;
}): ClaimPlan {
  const { guest, account } = input;

  if (guest && !guest.email) {
    if (account && account.id !== guest.id) {
      return { type: "merge", accountId: account.id, guestId: guest.id };
    }
    return { type: "attach", userId: guest.id };
  }

  if (account) return { type: "reuse", userId: account.id };
  return { type: "create" };
}
