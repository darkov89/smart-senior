import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import {
  inviteRedirectUrl,
  isSuperadminRole,
  orgAdminAppMetadata,
  parseOnboardBody,
} from "../_shared/onboardOrganization.ts";

Deno.test("parseOnboardBody requires org_name and a valid admin_email", () => {
  const parsed = parseOnboardBody({
    org_name: "  Dom Srebrny  ",
    admin_email: "Admin@Example.COM",
    address: " ul. Lipowa 1 ",
    resident_limit: 40,
    admin_full_name: " Anna Nowak ",
  });
  assertEquals(parsed.orgName, "Dom Srebrny");
  assertEquals(parsed.adminEmail, "admin@example.com");
  assertEquals(parsed.address, "ul. Lipowa 1");
  assertEquals(parsed.residentLimit, 40);
  assertEquals(parsed.adminFullName, "Anna Nowak");
});

Deno.test("parseOnboardBody allows optional address and resident_limit", () => {
  const parsed = parseOnboardBody({
    org_name: "Dom",
    admin_email: "a@b.pl",
  });
  assertEquals(parsed.address, null);
  assertEquals(parsed.residentLimit, null);
  assertEquals(parsed.adminFullName, "");
});

Deno.test("parseOnboardBody rejects invalid email, empty name, and quota", () => {
  assertThrows(() => parseOnboardBody({ org_name: "", admin_email: "a@b.pl" }));
  assertThrows(() =>
    parseOnboardBody({ org_name: "Dom", admin_email: "not-an-email" })
  );
  assertThrows(() =>
    parseOnboardBody({ org_name: "Dom", admin_email: "a@b.pl", resident_limit: 0 })
  );
  assertThrows(() =>
    parseOnboardBody({
      org_name: "Dom",
      admin_email: "a@b.pl",
      resident_limit: 1.5,
    })
  );
});

Deno.test("isSuperadminRole matches JWT enum, not the story alias super_admin", () => {
  assertEquals(isSuperadminRole("superadmin"), true);
  assertEquals(isSuperadminRole("super_admin"), false);
  assertEquals(isSuperadminRole("org_admin"), false);
});

Deno.test("orgAdminAppMetadata binds the new tenant id", () => {
  const organizationId = "11111111-1111-4111-8111-111111111111";
  assertEquals(orgAdminAppMetadata(organizationId), {
    role: "org_admin",
    organization_id: organizationId,
  });
});

Deno.test("inviteRedirectUrl uses SITE_URL /logowanie and rejects junk", () => {
  assertEquals(
    inviteRedirectUrl("https://smart-senior.pages.dev/"),
    "https://smart-senior.pages.dev/logowanie",
  );
  assertEquals(inviteRedirectUrl(undefined), undefined);
  assertEquals(inviteRedirectUrl("javascript:alert(1)"), undefined);
});
