import { describe, expect, it } from "vitest";
import { planClaim } from "./claim";

describe("planClaim", () => {
  it("attaches a new email to the guest", () => {
    expect(
      planClaim({
        guest: { id: "guest-1", email: null },
        account: null,
      }),
    ).toEqual({ type: "attach", userId: "guest-1" });
  });

  it("merges guest routes into an existing email account", () => {
    expect(
      planClaim({
        guest: { id: "guest-1", email: null },
        account: { id: "acct-1", email: "a@example.com" },
      }),
    ).toEqual({ type: "merge", accountId: "acct-1", guestId: "guest-1" });
  });

  it("reuses the account when there is no guest", () => {
    expect(
      planClaim({
        guest: null,
        account: { id: "acct-1", email: "a@example.com" },
      }),
    ).toEqual({ type: "reuse", userId: "acct-1" });
  });

  it("creates an account when there is no guest and no email user", () => {
    expect(planClaim({ guest: null, account: null })).toEqual({ type: "create" });
  });

  it("does not merge a signed-in account into a different email", () => {
    expect(
      planClaim({
        guest: { id: "acct-a", email: "a@example.com" },
        account: { id: "acct-b", email: "b@example.com" },
      }),
    ).toEqual({ type: "reuse", userId: "acct-b" });
  });

  it("reuses when the guest is already the email account", () => {
    expect(
      planClaim({
        guest: { id: "acct-1", email: "a@example.com" },
        account: { id: "acct-1", email: "a@example.com" },
      }),
    ).toEqual({ type: "reuse", userId: "acct-1" });
  });
});
