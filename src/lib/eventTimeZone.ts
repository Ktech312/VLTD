// An event has no stored time zone, only the place it is held (city, state or province, country). That is enough to name the zone for almost every event
// in the catalogue, and the zone is what decides when its last day is over: an LA event is still on at 8 pm on its last evening in Los Angeles even though
// it is already the next day in UTC. Where the place does not name a zone (no state for a US event, an unlisted country, online) this returns null and
// the viewer's own calendar is used instead.

export type EventPlace = { city?: string | null; state_region?: string | null; country?: string | null };

const NY = "America/New_York";
const CHI = "America/Chicago";
const DEN = "America/Denver";
const LA = "America/Los_Angeles";

// US states and territories. Where a state spans two zones the one most of its events fall in is used.
const US_BY_CODE: Record<string, string> = {
  AL: CHI, AK: "America/Anchorage", AZ: "America/Phoenix", AR: CHI, CA: LA, CO: DEN, CT: NY, DE: NY, DC: NY, FL: NY, GA: NY, HI: "Pacific/Honolulu", ID: DEN,
  IL: CHI, IN: NY, IA: CHI, KS: CHI, KY: NY, LA: CHI, ME: NY, MD: NY, MA: NY, MI: NY, MN: CHI, MS: CHI, MO: CHI, MT: DEN, NE: CHI, NV: LA, NH: NY, NJ: NY,
  NM: DEN, NY: NY, NC: NY, ND: CHI, OH: NY, OK: CHI, OR: LA, PA: NY, RI: NY, SC: NY, SD: CHI, TN: CHI, TX: CHI, UT: DEN, VT: NY, VA: NY, WA: LA, WV: NY,
  WI: CHI, WY: DEN, PR: "America/Puerto_Rico", GU: "Pacific/Guam", VI: "America/Puerto_Rico",
};
const US_NAMES: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA", colorado: "CO", connecticut: "CT", delaware: "DE", "district of columbia": "DC",
  florida: "FL", georgia: "GA", hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA", kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME",
  maryland: "MD", massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS", missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV",
  "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY", "north carolina": "NC", "north dakota": "ND", ohio: "OH", oklahoma: "OK",
  oregon: "OR", pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC", "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT",
  virginia: "VA", washington: "WA", "west virginia": "WV", wisconsin: "WI", wyoming: "WY", "puerto rico": "PR",
};
const CANADA: Record<string, string> = {
  ON: "America/Toronto", QC: "America/Toronto", MB: "America/Winnipeg", SK: "America/Regina", AB: "America/Edmonton", BC: "America/Vancouver",
  NS: "America/Halifax", NB: "America/Halifax", PE: "America/Halifax", NL: "America/St_Johns",
  ONTARIO: "America/Toronto", QUEBEC: "America/Toronto", MANITOBA: "America/Winnipeg", ALBERTA: "America/Edmonton", "BRITISH COLUMBIA": "America/Vancouver",
};
const BY_COUNTRY: Record<string, string> = {
  GB: "Europe/London", IE: "Europe/Dublin", DE: "Europe/Berlin", FR: "Europe/Paris", BE: "Europe/Brussels", NL: "Europe/Amsterdam", CH: "Europe/Zurich",
  AT: "Europe/Vienna", CZ: "Europe/Prague", ES: "Europe/Madrid", IT: "Europe/Rome", PT: "Europe/Lisbon", SE: "Europe/Stockholm", DK: "Europe/Copenhagen",
  NO: "Europe/Oslo", PL: "Europe/Warsaw", JP: "Asia/Tokyo", HK: "Asia/Hong_Kong", TW: "Asia/Taipei", MY: "Asia/Kuala_Lumpur", SG: "Asia/Singapore",
  QA: "Asia/Qatar", AE: "Asia/Dubai", KR: "Asia/Seoul", NZ: "Pacific/Auckland", MX: "America/Mexico_City", CO: "America/Bogota", EC: "America/Guayaquil",
  PE: "America/Lima", GT: "America/Guatemala", BR: "America/Sao_Paulo", AR: "America/Argentina/Buenos_Aires", CL: "America/Santiago",
};

/** The IANA zone the event's place is in, or null when the place does not say. */
export function eventTimeZone(place: EventPlace): string | null {
  const country = (place.country ?? "").trim().toUpperCase();
  let region = (place.state_region ?? "").trim();
  // Rows saved from a search carry "City, ST" in the city and no state of their own.
  if (!region && place.city) {
    const tail = place.city.split(",").pop()?.trim() ?? "";
    if (/^[A-Za-z]{2}$/.test(tail) && place.city.includes(",")) region = tail;
  }
  const key = region.toUpperCase();
  if (country === "CA") return CANADA[key] ?? null;
  if (country === "US" || country === "" || country === "USA") {
    const code = key.length === 2 ? key : US_NAMES[region.toLowerCase()];
    return (code && US_BY_CODE[code]) || null;
  }
  return BY_COUNTRY[country] ?? null;
}
