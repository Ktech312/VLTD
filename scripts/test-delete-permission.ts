// Who is offered a Delete control: owners and admins yes, a team member (role "member") no.
import assert from "node:assert/strict";
import { canDeleteItemsIn, DELETE_NOT_ALLOWED_NOTE, isSharedProfile } from "../src/lib/auth";

let passed = 0, failed = 0;
function test(name: string, fn: () => void) { try { fn(); passed++; console.log("PASS ", name); } catch (e) { failed++; console.log("FAIL ", name, (e as Error).message.slice(0, 200)); } }
test("the owner of a profile (no team role) can delete", () => assert.equal(canDeleteItemsIn({ member_role: null }), true));
test("a profile with no role field (own profile) can delete", () => assert.equal(canDeleteItemsIn({}), true));
test("an admin of a team profile can delete", () => assert.equal(canDeleteItemsIn({ member_role: "admin" }), true));
test("a team member cannot", () => assert.equal(canDeleteItemsIn({ member_role: "member" }), false));
test("nothing known yet leaves the decision to the database (true)", () => { assert.equal(canDeleteItemsIn(null), true); assert.equal(canDeleteItemsIn(undefined), true); });
test("the explanation names who can delete", () => assert.ok(/owner or an admin/.test(DELETE_NOT_ALLOWED_NOTE)));
test("a team member's profile is a shared profile", () => assert.equal(isSharedProfile({ member_role: "member" }), true));
console.log(`${passed} passed, ${failed} failed`); process.exit(failed ? 1 : 0);
