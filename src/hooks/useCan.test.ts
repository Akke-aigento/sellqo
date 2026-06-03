import { describe, it, expect } from "vitest";
import { canWithRoles } from "./useCan";

describe("useCan / canWithRoles matrix", () => {
  it("platform_admin passes regardless of resource/action", () => {
    expect(canWithRoles(["platform_admin"], "write", "platform_billing")).toBe(true);
    expect(canWithRoles(["platform_admin"], "write", "vat")).toBe(true);
    expect(canWithRoles(["platform_admin"], "read", "webhooks_api")).toBe(true);
  });

  it("tenant_admin can write orders and read invoices", () => {
    expect(canWithRoles(["tenant_admin"], "write", "orders")).toBe(true);
    expect(canWithRoles(["tenant_admin"], "read", "invoices")).toBe(true);
  });

  it("staff can write orders but NOT integrations or platform_billing", () => {
    expect(canWithRoles(["staff"], "write", "orders")).toBe(true);
    expect(canWithRoles(["staff"], "write", "integrations")).toBe(false);
    expect(canWithRoles(["staff"], "write", "platform_billing")).toBe(false);
  });

  it("accountant can write vat and read invoices but not products", () => {
    expect(canWithRoles(["accountant"], "write", "vat")).toBe(true);
    expect(canWithRoles(["accountant"], "read", "invoices")).toBe(true);
    expect(canWithRoles(["accountant"], "write", "products")).toBe(false);
  });

  it("warehouse can write orders/returns but not marketing/cms", () => {
    expect(canWithRoles(["warehouse"], "write", "orders")).toBe(true);
    expect(canWithRoles(["warehouse"], "write", "returns")).toBe(true);
    expect(canWithRoles(["warehouse"], "write", "marketing")).toBe(false);
    expect(canWithRoles(["warehouse"], "read", "marketing")).toBe(false);
  });

  it("viewer is read-only everywhere it has access, never write", () => {
    expect(canWithRoles(["viewer"], "read", "orders")).toBe(true);
    expect(canWithRoles(["viewer"], "read", "products")).toBe(true);
    expect(canWithRoles(["viewer"], "write", "orders")).toBe(false);
    expect(canWithRoles(["viewer"], "write", "products")).toBe(false);
    expect(canWithRoles(["viewer"], "read", "team")).toBe(false);
  });

  it("empty roles always returns false", () => {
    expect(canWithRoles([], "read", "orders")).toBe(false);
    expect(canWithRoles([], "write", "products")).toBe(false);
  });

  it("combined roles get the union of permissions", () => {
    expect(canWithRoles(["viewer", "warehouse"], "write", "orders")).toBe(true);
    expect(canWithRoles(["viewer", "accountant"], "write", "vat")).toBe(true);
  });
});
