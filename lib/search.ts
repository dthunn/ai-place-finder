import { pool } from "./db";
import { embedText } from "./embeddings";

const DEFAULT_RADIUS_METERS = 1500;

export interface SearchParams {
  semanticQuery: string;
  category?: string | null;
  near?: string | null;
  radiusMeters?: number | null;
}

export interface SearchResult {
  id: number;
  name: string | null;
  category: string | null;
  search_text: string | null;
  lat: number;
  lon: number;
  similarity: number;
}

export type SearchOutcome =
  | { error: string }
  | { category: string | null; near: string | null; radiusMeters: number | null; results: SearchResult[] };

export async function searchPlaces({
  semanticQuery,
  category = null,
  near = null,
  radiusMeters = null,
}: SearchParams): Promise<SearchOutcome> {
  let anchor: { lat: number; lon: number } | null = null;
  if (near) {
    const { rows } = await pool.query(
      `SELECT ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lon
       FROM places
       WHERE name ILIKE $1
       ORDER BY (LOWER(name) = LOWER($2)) DESC, LENGTH(name) ASC
       LIMIT 1`,
      [`%${near}%`, near],
    );
    if (rows.length === 0) {
      return { error: `Could not find a place matching "${near}"` };
    }
    anchor = rows[0];
  }

  const queryEmbedding = await embedText(semanticQuery);
  const vectorLiteral = `[${queryEmbedding.join(",")}]`;

  const conditions = ["embedding IS NOT NULL", "name IS NOT NULL"];
  const values: unknown[] = [vectorLiteral];

  if (category) {
    values.push(category);
    conditions.push(`category = $${values.length}`);
  }

  const effectiveRadius = radiusMeters ?? DEFAULT_RADIUS_METERS;
  if (anchor) {
    values.push(anchor.lon, anchor.lat, effectiveRadius);
    const lonIdx = values.length - 2;
    const latIdx = values.length - 1;
    const radiusIdx = values.length;
    conditions.push(
      `ST_DWithin(location, ST_SetSRID(ST_MakePoint($${lonIdx}, $${latIdx}), 4326)::geography, $${radiusIdx})`,
    );
  }

  const { rows } = await pool.query<SearchResult>(
    `
    SELECT
      id,
      name,
      category,
      search_text,
      ST_Y(location::geometry) AS lat,
      ST_X(location::geometry) AS lon,
      1 - (embedding <=> $1::vector) AS similarity
    FROM places
    WHERE ${conditions.join(" AND ")}
    ORDER BY embedding <=> $1::vector
    LIMIT 20;
    `,
    values,
  );

  return {
    category,
    near,
    radiusMeters: anchor ? effectiveRadius : null,
    results: rows,
  };
}
