import { assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { isStripeError, onlinePayUnavailable, publicStorefrontError, statusForStorefrontError, storefrontErrorCode } from "./storefrontErrorStatus.ts";

Deno.test("EVENT_FULL en TICKET_TYPE_FULL geven 409", () => {
  assertEquals(statusForStorefrontError(JSON.stringify({ code: 'EVENT_FULL', message: 'Dit evenement is volzet', spots_left: 0 })), 409);
  assertEquals(statusForStorefrontError(JSON.stringify({ code: 'TICKET_TYPE_FULL', message: 'Dit tickettype is uitverkocht', spots_left: 2 })), 409);
  // Combiticket gebruikt dezelfde code.
  assertEquals(statusForStorefrontError(JSON.stringify({ code: 'TICKET_TYPE_FULL', message: 'Dit combiticket is uitverkocht', spots_left: 0 })), 409);
});

Deno.test("andere codes en gewone fouten blijven 500", () => {
  for (const code of ['EVENT_DATE_UNAVAILABLE', 'TICKET_TYPE_UNAVAILABLE', 'TICKET_TYPE_NOT_ON_SALE', 'INSUFFICIENT_STOCK', 'SEAT_SELECTION_REQUIRED', 'ADDON_INVALID']) {
    assertEquals(statusForStorefrontError(JSON.stringify({ code, message: 'x' })), 500, code);
  }
  assertEquals(statusForStorefrontError('cart_id is required'), 500);
  assertEquals(statusForStorefrontError('{kapot'), 500);
  assertEquals(statusForStorefrontError('{"message":"geen code"}'), 500);
  assertEquals(statusForStorefrontError('{"code":409}'), 500);
  assertEquals(statusForStorefrontError(undefined), 500);
  assertEquals(statusForStorefrontError(null), 500);
});

Deno.test("de code wordt niet uit een tekst met de code erin gehaald", () => {
  // Enkel een JSON-object met code telt, geen vrije tekst die toevallig de code noemt.
  assertEquals(statusForStorefrontError('EVENT_FULL'), 500);
  assertEquals(storefrontErrorCode('fout: {"code":"EVENT_FULL"}'), null);
});

// FIXES-0711 — Stripe-fouten en sleutels nooit naar de gast.

Deno.test("Stripe-fout → ONLINE_PAY_UNAVAILABLE, aan tafel met de bediening-tekst", () => {
  const stripeErr = Object.assign(new Error("The provided key 'sk_live_***abc' does not have access to account 'acct_1AbCdEf'"), { type: 'StripePermissionError', statusCode: 403, raw: {} });
  const out = JSON.parse(String(publicStorefrontError('table_check_pay', stripeErr, stripeErr.message)));
  assertEquals(out.code, 'ONLINE_PAY_UNAVAILABLE');
  assertEquals(out.message, 'Online betalen lukt nu niet. Vraag de rekening aan de bediening.');
  assertEquals(JSON.stringify(out).includes('sk_live'), false);
  // Buiten de tafel: andere raad.
  assertEquals(JSON.parse(String(publicStorefrontError('checkout_complete', stripeErr, stripeErr.message))).message, onlinePayUnavailable('checkout_complete').message);
  // Status blijft wat ze was (500): enkel de tekst verandert.
  assertEquals(statusForStorefrontError(publicStorefrontError('table_check_pay', stripeErr, stripeErr.message)), 500);
});

Deno.test("sleutel of account-ID in een gewone fout → ook afgeschermd", () => {
  assertEquals(storefrontErrorCode(publicStorefrontError('checkout_complete', new Error('x'), 'boom acct_1SlXhD2NSrtUWCOr')), 'ONLINE_PAY_UNAVAILABLE');
  assertEquals(storefrontErrorCode(publicStorefrontError('get_products', new Error('x'), 'Invalid API Key provided: sk_test_123')), 'ONLINE_PAY_UNAVAILABLE');
});

Deno.test("gewone fouten blijven byte-gelijk", () => {
  for (const m of ['cart_id is required', JSON.stringify({ code: 'EVENT_FULL', message: 'Dit evenement is volzet', spots_left: 0 }), 'Unknown action: x']) {
    assertEquals(publicStorefrontError('cart_add_item', new Error(m), m), m);
  }
  assertEquals(isStripeError(new Error('nope')), false);
  // Review: niet-strings komen ongewijzigd terug (geen "undefined" of "[object Object]").
  assertEquals(publicStorefrontError('cart_get', {}, undefined), undefined);
  const obj = { code: 'X' };
  assertEquals(publicStorefrontError('cart_get', obj, obj), obj);
  assertEquals(isStripeError({ type: 'StripeConnectionError' }), true);
});
