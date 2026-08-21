import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import {
  hasValidPeselChecksum,
  hashPeselSha256,
  normalizePesel,
} from "../_shared/peselHash.ts";
import { parseRedeemBody } from "../_shared/redeemInvitation.ts";

Deno.test("normalizePesel accepts a valid checksum", () => {
  assertEquals(normalizePesel("44051401359"), "44051401359");
  assertEquals(normalizePesel("440-514-01359"), "44051401359");
});

Deno.test("normalizePesel rejects wrong length or checksum", () => {
  assertEquals(normalizePesel("123"), null);
  assertEquals(hasValidPeselChecksum("44051401358"), false);
  assertEquals(normalizePesel("44051401358"), null);
});

Deno.test("hashPeselSha256 is stable and independent of display formatting", async () => {
  const first = await hashPeselSha256("44051401359", "test-salt");
  const second = await hashPeselSha256("44051401359", "test-salt");
  assertEquals(first, second);
  assertEquals(first.length, 64);
  const otherSalt = await hashPeselSha256("44051401359", "other");
  assertEquals(otherSalt === first, false);
});

Deno.test("parseRedeemBody requires token, password, name and consent", () => {
  const parsed = parseRedeemBody({
    token: "a".repeat(32),
    password: "dlugiehaslo1",
    full_name: "Anna Nowak",
    consent_family_portal: true,
  });
  assertEquals(parsed.fullName, "Anna Nowak");
});

Deno.test("parseRedeemBody rejects missing consent", () => {
  assertThrows(() =>
    parseRedeemBody({
      token: "a".repeat(32),
      password: "dlugiehaslo1",
      full_name: "Anna",
      consent_family_portal: false,
    })
  );
});
