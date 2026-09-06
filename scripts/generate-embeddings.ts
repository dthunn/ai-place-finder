import { config } from "dotenv";
import { Pool } from "pg";
import OpenAI from "openai";

const EMBEDDING_MODEL = "text-embedding-3-small";
const BATCH_SIZE = 100;

interface PlaceRow {
  id: number;
  name: string | null;
  category: string | null;
  cuisine: string | null;
  opening_hours: string | null;
  wheelchair: string | null;
  outdoor_seating: boolean | null;
  address: string | null;
  city: string | null;
  state: string | null;
}

function buildSearchText(place: PlaceRow): string {
  const name = place.name ?? "This place";
  const parts: string[] = [];

  if (place.category) {
    const location =
      place.city && place.state
        ? ` in ${place.city}, ${place.state}`
        : place.city
          ? ` in ${place.city}`
          : "";
    parts.push(`${name} is a ${place.category}${location}.`);
  } else {
    parts.push(`${name}.`);
  }

  if (place.cuisine) {
    parts.push(`It serves ${place.cuisine.replace(/;/g, ", ")}.`);
  }

  if (place.outdoor_seating === true) {
    parts.push("It has outdoor seating.");
  }

  if (place.wheelchair === "yes") {
    parts.push("It is wheelchair accessible.");
  } else if (place.wheelchair === "limited") {
    parts.push("It has limited wheelchair accessibility.");
  }

  if (place.opening_hours) {
    parts.push(`Hours: ${place.opening_hours}.`);
  }

  if (place.address) {
    const cityState = [place.city, place.state].filter(Boolean).join(", ");
    parts.push(`Located at ${place.address}${cityState ? `, ${cityState}` : ""}.`);
  }

  return parts.join(" ");
}

async function main() {
  config({ path: ".env.local" });

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set (add it to .env.local)");
  }
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set (add it to .env.local)");
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    const { rows } = await pool.query<PlaceRow>(`
      SELECT id, name, category, cuisine, opening_hours, wheelchair, outdoor_seating, address, city, state
      FROM places
      WHERE embedding IS NULL
    `);

    console.log(`Found ${rows.length} places without embeddings`);

    let processed = 0;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const searchTexts = batch.map(buildSearchText);

      const response = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: searchTexts,
      });

      for (let j = 0; j < batch.length; j++) {
        const place = batch[j];
        const searchText = searchTexts[j];
        const embedding = response.data[j].embedding;
        const vectorLiteral = `[${embedding.join(",")}]`;

        await pool.query(`UPDATE places SET search_text = $1, embedding = $2::vector WHERE id = $3`, [
          searchText,
          vectorLiteral,
          place.id,
        ]);
      }

      processed += batch.length;
      console.log(`Embedded ${processed}/${rows.length}`);
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
