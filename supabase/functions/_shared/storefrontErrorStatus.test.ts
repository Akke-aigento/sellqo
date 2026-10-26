import { assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { statusForStorefrontError, storefrontErrorCode } from "./storefrontErrorStatus.ts";

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
