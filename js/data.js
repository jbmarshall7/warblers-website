/* ============================================================
   Warblers Meadery — catalog data
   ------------------------------------------------------------
   PLACEHOLDER DATA. Mead names, styles, ABV, tasting notes,
   volumes, prices and availability are structural stand-ins
   (spec §6.3). Tasting notes must NOT be published until they
   are real — every note below is flagged placeholder: true.
   Replace this file's contents with confirmed product facts
   before launch.
   ============================================================ */

window.WARBLERS_PRODUCTS = [
  {
    id: "goldcrest",
    name: "Goldcrest",
    character: "A bright, off-dry traditional mead.",
    style: "Traditional",
    abv: "12.5",
    honey: "[PLACEHOLDER — honey varietal]",
    volume: "500",
    price: 24,
    availability: "stock",           // stock | limited | soldout | soon
    // NOTE: placeholder tasting note — do not publish as real.
    placeholder: true,
    tasting: "[PLACEHOLDER — real tasting notes required. Aroma, sweetness (dry→sweet), body, notable flavors, and finish go here once confirmed.]",
    pairing: "[PLACEHOLDER — pairing suggestion]",
    hue: "#F6C868"
  },
  {
    id: "dawn-chorus",
    name: "Dawn Chorus",
    character: "A layered melomel with orchard fruit.",
    style: "Melomel",
    abv: "13",
    honey: "[PLACEHOLDER — honey varietal] + [fruit]",
    volume: "500",
    price: 27,
    availability: "limited",
    placeholder: true,
    tasting: "[PLACEHOLDER — real tasting notes required.]",
    pairing: "[PLACEHOLDER — pairing suggestion]",
    hue: "#E8A33D"
  },
  {
    id: "yellowthroat",
    name: "Yellowthroat",
    character: "A crisp, low-ABV session mead.",
    style: "Session",
    abv: "6.5",
    honey: "[PLACEHOLDER — honey varietal]",
    volume: "375",
    price: 18,
    availability: "stock",
    placeholder: true,
    tasting: "[PLACEHOLDER — real tasting notes required.]",
    pairing: "[PLACEHOLDER — pairing suggestion]",
    hue: "#A9B972"
  },
  {
    id: "nightjar",
    name: "Nightjar",
    character: "A spiced winter mead, barrel-rested.",
    style: "Metheglin",
    abv: "14",
    honey: "[PLACEHOLDER — honey varietal] + spice",
    volume: "500",
    price: 32,
    availability: "soon",
    placeholder: true,
    tasting: "[PLACEHOLDER — real tasting notes required.]",
    pairing: "[PLACEHOLDER — pairing suggestion]",
    hue: "#C97E1E"
  }
];

/* ============================================================
   Merch (spec §9, Phase 2) — branded goods on the same cart.
   Not alcohol, so no shipping-state / age restriction, though
   age-appropriate marketing still applies. Prices/items below
   are PLACEHOLDER examples — replace with real product facts.
   ============================================================ */
window.WARBLERS_MERCH = [
  { id: "m-glass",   name: "Warblers Tasting Glass", kind: "Glassware", character: "Tulip glass etched with the warbler mark.", price: 14, availability: "stock",   hue: "#F6C868", image: "tasting-glass.png" },
  { id: "m-tee",     name: "Songbird Tee",           kind: "Apparel",   character: "Soft cotton tee, warbler print on the chest.", price: 26, availability: "stock",   hue: "#A9B972", image: "shirt.jpeg" },
  { id: "m-cap",     name: "Meadery Cap",            kind: "Apparel",   character: "Embroidered six-panel in honey and cream.",   price: 24, availability: "limited", hue: "#E8A33D", image: "hat.jpeg" },
  { id: "m-tote",    name: "Honey Run Tote",         kind: "Accessory", character: "Heavy canvas tote for four bottles.",         price: 18, availability: "stock",   hue: "#C97E1E", image: "tote.jpeg" },
  { id: "m-sticker", name: "Warbler Sticker Pack",   kind: "Accessory", character: "Five weatherproof songbird stickers.",        price: 8,  availability: "stock",   hue: "#8C9C6A", image: "stickers.jpeg" }
];

/* Upcoming appearances — farmers markets, renaissance faires, pop-ups.
   Rendered on BOTH Find Us and Events. Add entries as they're confirmed:
     { name: "Newtown Farmers Market", date: "Sat Aug 2", time: "9am\u20131pm",
       place: "Fairfield Hills, Newtown CT", note: "Bottles + tastes", url: "" }
   While the list is empty, both pages show a friendly "coming soon" card. */
window.WARBLERS_APPEARANCES = [];

/* ------------------------------------------------------------
   Allowed shipping states (spec §7).
   Owner-confirmed 2026-07-18: Warblers ships within CONNECTICUT
   only, plus free local pickup in Newtown CT (chosen at checkout).
   Extend this list only with confirmed licensing for each state.
   ------------------------------------------------------------ */
window.WARBLERS_ALLOWED_STATES = ["CT","Connecticut"];

/* Full US state list for the checkout selector. */
window.WARBLERS_US_STATES = [
  ["AL","Alabama"],["AK","Alaska"],["AZ","Arizona"],["AR","Arkansas"],["CA","California"],
  ["CO","Colorado"],["CT","Connecticut"],["DE","Delaware"],["DC","District of Columbia"],
  ["FL","Florida"],["GA","Georgia"],["HI","Hawaii"],["ID","Idaho"],["IL","Illinois"],
  ["IN","Indiana"],["IA","Iowa"],["KS","Kansas"],["KY","Kentucky"],["LA","Louisiana"],
  ["ME","Maine"],["MD","Maryland"],["MA","Massachusetts"],["MI","Michigan"],["MN","Minnesota"],
  ["MS","Mississippi"],["MO","Missouri"],["MT","Montana"],["NE","Nebraska"],["NV","Nevada"],
  ["NH","New Hampshire"],["NJ","New Jersey"],["NM","New Mexico"],["NY","New York"],
  ["NC","North Carolina"],["ND","North Dakota"],["OH","Ohio"],["OK","Oklahoma"],["OR","Oregon"],
  ["PA","Pennsylvania"],["RI","Rhode Island"],["SC","South Carolina"],["SD","South Dakota"],
  ["TN","Tennessee"],["TX","Texas"],["UT","Utah"],["VT","Vermont"],["VA","Virginia"],
  ["WA","Washington"],["WV","West Virginia"],["WI","Wisconsin"],["WY","Wyoming"]
];
