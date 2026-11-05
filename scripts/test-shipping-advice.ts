// Packaging advice in generated listings follows what the item IS: no record mailer for a guitar, no top loader for a poster.
import assert from "node:assert/strict";
import { shippingNote } from "../src/lib/listingGenerator";
import { TAXONOMY } from "../src/lib/taxonomy";

let passed = 0, failed = 0;
function test(name: string, fn: () => void) { try { fn(); passed++; console.log("PASS ", name); } catch (e) { failed++; console.log("FAIL ", name, (e as Error).message.slice(0, 260)); } }
const note = (universe: string, categoryLabel: string, subcategoryLabel?: string, extra: Record<string, unknown> = {}) => shippingNote({ title: "x", universe, categoryLabel, subcategoryLabel, ...extra } as never);

test("a guitar is not shipped in a record mailer: hard case or sturdy padded box, quote by size and weight, no invented price", () => {
  const n = note("MUSIC", "Instruments & Gear", "Guitars");
  assert.ok(!/record mailer|stiffener|mailer/i.test(n), n);
  assert.ok(/hard case|sturdy box/i.test(n) && /carrier quote/i.test(n) && !/\$\d/.test(n), n);
});
test("the guitar case holds when the category is only the stored code and the subcategory is blank", () => {
  const n = shippingNote({ title: "Telecaster", universe: "MUSIC", category: "INSTRUMENTS_GEAR" } as never);
  assert.ok(!/record mailer/i.test(n) && /hard case|sturdy box/i.test(n), n);
});
test("a vinyl record still ships in a record mailer with stiffeners", () => assert.ok(/record mailer with cardboard stiffeners/i.test(note("MUSIC", "Audio Formats", "Vinyl Records"))));
test("a shellac 78 or an acetate is never put in a flat mailer", () => { for (const sub of ["Shellac 78s", "Acetate Discs"]) { const n = note("MUSIC", "Audio Formats", sub); assert.ok(!/record mailer|stiffener/i.test(n) && /rigid box/i.test(n), n); } });
test("CDs and cassettes ship in a padded mailer or small box, not a record mailer", () => { for (const sub of ["CDs", "Cassette Tapes", "8-Track"]) { const n = note("MUSIC", "Audio Formats", sub); assert.ok(!/record mailer/i.test(n) && /padded mailer/i.test(n), n); } });
test("pedals and microphones ship in a snug padded box; amps and players in a sturdy padded box", () => {
  assert.ok(/snug padded box/i.test(note("MUSIC", "Instruments & Gear", "Pedals & Effects")));
  assert.ok(/sturdy box padded/i.test(note("MUSIC", "Audio Players", "Amps")));
});
test("a gig poster or sheet music ships flat or rolled, never in a record mailer or top loader", () => { const n = note("MUSIC", "Print & Ephemera", "Gig Posters"); assert.ok(/flat between stiff boards|tube/i.test(n) && !/record mailer|top loader/i.test(n), n); });
test("a movie poster in any universe ships flat or rolled", () => { const n = note("POP_CULTURE", "Movies / TV / Film", "Posters"); assert.ok(/flat between stiff boards|tube/i.test(n), n); });
test("a raw comic ships bagged and boarded in a rigid mailer; a slabbed comic is double-boxed", () => {
  assert.ok(/bagged and boarded in a rigid mailer/i.test(note("POP_CULTURE", "Comics")));
  assert.ok(/double-boxed/i.test(note("POP_CULTURE", "Comics", undefined, { grade: "CGC 9.8" })));
});
test("cards are unchanged: raw card in a top loader inside a bubble mailer, slab double-boxed", () => {
  assert.ok(/top loader and team bag inside a bubble mailer/i.test(note("SPORTS", "Sports Cards", "Baseball")));
  assert.ok(/double-boxed/i.test(note("TCG", "Trading Card Games", undefined, { grade: "PSA 10" })));
});
test("sports memorabilia that is not a card is not told to use a top loader", () => { const n = note("SPORTS", "Memorabilia", "Helmets"); assert.ok(!/top loader/i.test(n) && /sturdy box/i.test(n), n); });
test("an unrecognised item gets general advice with no packaging claim", () => assert.equal(note("", "").includes("mailer"), false));
test("across the WHOLE taxonomy, 'record mailer' appears only for vinyl and flexi discs, and 'top loader' only for cards", () => {
  const bad: string[] = [];
  for (const [u, cats] of Object.entries(TAXONOMY as Record<string, Record<string, string[]>>)) {
    for (const [c, subs] of Object.entries(cats)) for (const sub of [undefined, ...subs]) {
      const n = note(u, c, sub);
      if (/record mailer/i.test(n) && !/vinyl|flexi/i.test(sub ?? "")) bad.push(`${u}/${c}/${sub ?? ""}: record mailer`);
      if (/top loader/i.test(n) && !(u === "TCG" || /card/i.test(`${c} ${sub ?? ""}`))) bad.push(`${u}/${c}/${sub ?? ""}: top loader`);
    }
  }
  assert.deepEqual(bad.slice(0, 5), []);
});
console.log(`${passed} passed, ${failed} failed`); process.exit(failed ? 1 : 0);
