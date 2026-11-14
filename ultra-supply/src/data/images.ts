/**
 * Placeholder photography (Unsplash). Replace these URLs with the company's own
 * photographs once available — every image on the public site is referenced here
 * or stored in the database (products, categories, partners).
 * If a remote image fails to load, <Img> falls back to a branded placeholder.
 */
const u = (id: string, w = 1600) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=75`;

export const images = {
  hero: u('photo-1625246333195-78d9c38ad449', 2200),
  intro: u('photo-1581091226825-a6a2a5aee158', 1400),
  introSecondary: u('photo-1565043589221-1a6fd9ae45c7', 900),
  logistics: u('photo-1494412574643-ff11b0a5c1c3', 2200),
  warehouse: u('photo-1586528116311-ad8dd3c8310d', 1400),
  sourcing: u('photo-1578575437130-527eed3abbec', 1000),
  distribution: u('photo-1553413077-190dd305871c', 1000),
  about: u('photo-1504917595217-d4dc5ebe6122', 1600),
  field: u('photo-1500382017468-9049fed747ef', 2000),
  quote: u('photo-1581092160562-40aa08e78837', 1600),
  contact: u('photo-1586528116311-ad8dd3c8310d', 2000),
  sectors: {
    agricultural: u('photo-1530267981375-f0de937f5f13', 1200),
    industrial: u('photo-1581094794329-c8112a89af12', 1200),
    hydraulic: u('photo-1621905251189-08b45d6a269e', 1200),
    irrigation: u('photo-1563514227147-6d2ff665a6a0', 1200),
    bearings: u('photo-1537462715879-360eeb61a0ad', 1200),
    automotive: u('photo-1487754180451-c456f719a1fc', 1200),
  },
  products: {
    bearings: u('photo-1537462715879-360eeb61a0ad', 900),
    pump: u('photo-1621905251189-08b45d6a269e', 900),
    tractor: u('photo-1530267981375-f0de937f5f13', 900),
    irrigation: u('photo-1563514227147-6d2ff665a6a0', 900),
    spares: u('photo-1581094794329-c8112a89af12', 900),
    tools: u('photo-1530124566582-a618bc2615dc', 900),
    harvester: u('photo-1574943320219-553eb213f72d', 900),
    engine: u('photo-1487754180451-c456f719a1fc', 900),
    gears: u('photo-1565043589221-1a6fd9ae45c7', 900),
    workshop: u('photo-1504222490345-c075b6008014', 900),
    valves: u('photo-1581092160562-40aa08e78837', 900),
    sprinkler: u('photo-1592982537447-7440770cbfc9', 900),
  },
};
