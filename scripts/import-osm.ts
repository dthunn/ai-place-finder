import { config } from "dotenv";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Pool } from "pg";

const DATA_FILE = path.resolve(process.cwd(), "data/export.geojson");
const BATCH_SIZE = 200;

// Priority order for picking a single category out of OSM's several
// classification keys (a feature can carry more than one).
const CATEGORY_KEYS = ["amenity", "shop", "leisure", "tourism", "office", "craft", "healthcare"] as const;

interface OsmFeature {
  type: "Feature";
  id: string;
  properties: Record<string, string>;
  geometry: {
    type: string;
    coordinates: [number, number];
  };
}

interface PlaceRow {
  osm_id: number;
  osm_type: string;
  name: string | null;
  category: string | null;
  subcategory: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  website: string | null;
  phone: string | null;
  cuisine: string | null;
  opening_hours: string | null;
  wheelchair: string | null;
  outdoor_seating: boolean | null;
  tags: Record<string, string>;
  lon: number;
  lat: number;
}

function parseYesNo(value: string | undefined): boolean | null {
  if (value === "yes") return true;
  if (value === "no") return false;
  return null;
}

function toRow(feature: OsmFeature): PlaceRow | null {
  if (feature.geometry?.type !== "Point") return null;

  const [osmType, osmIdRaw] = feature.id.split("/");
  const osmId = Number(osmIdRaw);
  if (!osmType || !Number.isFinite(osmId)) return null;

  const props = feature.properties ?? {};
  const [lon, lat] = feature.geometry.coordinates;

  const categoryKey = CATEGORY_KEYS.find((key) => props[key]);
  const category = categoryKey ? props[categoryKey] : null;
  const subcategory = categoryKey ?? null;

  const houseNumber = props["addr:housenumber"];
  const street = props["addr:street"];
  const address = [houseNumber, street].filter(Boolean).join(" ") || null;

  return {
    osm_id: osmId,
    osm_type: osmType,
    name: props.name ?? null,
    category,
    subcategory,
    address,
    city: props["addr:city"] ?? null,
    state: props["addr:state"] ?? null,
    postal_code: props["addr:postcode"] ?? null,
    website: props.website ?? props["contact:website"] ?? null,
    phone: props.phone ?? props["contact:phone"] ?? null,
    cuisine: props.cuisine ?? null,
    opening_hours: props.opening_hours ?? null,
    wheelchair: props.wheelchair ?? null,
    outdoor_seating: parseYesNo(props.outdoor_seating),
    tags: props,
    lon,
    lat,
  };
}

const COLUMNS = [
  "osm_id",
  "osm_type",
  "name",
  "category",
  "subcategory",
  "address",
  "city",
  "state",
  "postal_code",
  "website",
  "phone",
  "cuisine",
  "opening_hours",
  "wheelchair",
  "outdoor_seating",
  "tags",
  "location",
] as const;

function buildInsert(rows: PlaceRow[]): { text: string; values: unknown[] } {
  const values: unknown[] = [];
  const tuples = rows.map((row, i) => {
    const base = i * 18;
    values.push(
      row.osm_id,
      row.osm_type,
      row.name,
      row.category,
      row.subcategory,
      row.address,
      row.city,
      row.state,
      row.postal_code,
      row.website,
      row.phone,
      row.cuisine,
      row.opening_hours,
      row.wheelchair,
      row.outdoor_seating,
      JSON.stringify(row.tags),
    );
    const placeholders = Array.from({ length: 16 }, (_, j) => `$${base + j + 1}`);
    const lonPlaceholder = `$${base + 17}`;
    const latPlaceholder = `$${base + 18}`;
    values.push(row.lon, row.lat);
    return `(${placeholders.join(", ")}, ST_SetSRID(ST_MakePoint(${lonPlaceholder}, ${latPlaceholder}), 4326)::geography)`;
  });

  const text = `
    INSERT INTO places (${COLUMNS.join(", ")})
    VALUES ${tuples.join(", ")}
    ON CONFLICT (osm_type, osm_id) DO UPDATE SET
      name = EXCLUDED.name,
      category = EXCLUDED.category,
      subcategory = EXCLUDED.subcategory,
      address = EXCLUDED.address,
      city = EXCLUDED.city,
      state = EXCLUDED.state,
      postal_code = EXCLUDED.postal_code,
      website = EXCLUDED.website,
      phone = EXCLUDED.phone,
      cuisine = EXCLUDED.cuisine,
      opening_hours = EXCLUDED.opening_hours,
      wheelchair = EXCLUDED.wheelchair,
      outdoor_seating = EXCLUDED.outdoor_seating,
      tags = EXCLUDED.tags,
      location = EXCLUDED.location;
  `;

  return { text, values };
}

async function main() {
  config({ path: ".env.local" });

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set (add it to .env.local)");
  }

  const raw = readFileSync(DATA_FILE, "utf-8");
  const geojson = JSON.parse(raw) as { features: OsmFeature[] };

  const rows = geojson.features.map(toRow).filter((row): row is PlaceRow => row !== null);
  const skipped = geojson.features.length - rows.length;

  console.log(`Parsed ${rows.length} places (skipped ${skipped} non-point/invalid features)`);

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  let imported = 0;
  try {
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const { text, values } = buildInsert(batch);
      await pool.query(text, values);
      imported += batch.length;
      console.log(`Imported ${imported}/${rows.length}`);
    }
  } finally {
    await pool.end();
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
