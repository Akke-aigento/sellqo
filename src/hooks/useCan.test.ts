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

  describe("marketing role", () => {
    it("can read+write campaigns, discount_codes, ads, seo, cms", () => {
      expect(canWithRoles(["marketing"], "write", "marketing")).toBe(true);
      expect(canWithRoles(["marketing"], "write", "discount_codes")).toBe(true);
      expect(canWithRoles(["marketing"], "write", "ads")).toBe(true);
      expect(canWithRoles(["marketing"], "write", "seo")).toBe(true);
      expect(canWithRoles(["marketing"], "write", "cms")).toBe(true);
    });

    it("cannot see invoices, credit_notes, payments, vat", () => {
      expect(canWithRoles(["marketing"], "read", "invoices")).toBe(false);
      expect(canWithRoles(["marketing"], "read", "credit_notes")).toBe(false);
      expect(canWithRoles(["marketing"], "read", "payments")).toBe(false);
      expect(canWithRoles(["marketing"], "read", "vat")).toBe(false);
    });

    it("can read but not write orders (no status changes)", () => {
      expect(canWithRoles(["marketing"], "read", "orders")).toBe(true);
      expect(canWithRoles(["marketing"], "write", "orders")).toBe(false);
      expect(canWithRoles(["marketing"], "correct", "order_status")).toBe(false);
    });

    it("can configure ads but cannot release ad_budgets", () => {
      expect(canWithRoles(["marketing"], "write", "ads")).toBe(true);
      expect(canWithRoles(["marketing"], "write", "ad_budgets")).toBe(false);
      expect(canWithRoles(["marketing"], "read", "ad_budgets")).toBe(false);
    });

    it("cannot manage integrations, team, settings or platform_billing", () => {
      expect(canWithRoles(["marketing"], "write", "integrations")).toBe(false);
      expect(canWithRoles(["marketing"], "read", "team")).toBe(false);
      expect(canWithRoles(["marketing"], "write", "settings_general")).toBe(false);
      expect(canWithRoles(["marketing"], "write", "platform_billing")).toBe(false);
    });

    it("can read products/customers for segmentation and campaign links", () => {
      expect(canWithRoles(["marketing"], "read", "products")).toBe(true);
      expect(canWithRoles(["marketing"], "read", "customers")).toBe(true);
      expect(canWithRoles(["marketing"], "write", "customers")).toBe(false);
    });

    it("platform_admin bypasses even marketing-only restrictions", () => {
      expect(canWithRoles(["platform_admin"], "write", "ad_budgets")).toBe(true);
      expect(canWithRoles(["platform_admin"], "read", "invoices")).toBe(true);
    });
  });
});
