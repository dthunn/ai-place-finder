import { google } from "@ai-sdk/google";
import { generateText, Output } from "ai";
import { z } from "zod";

const model = google("gemini-flash-latest");

const searchParamsSchema = z.object({
  semanticQuery: z
    .string()
    .describe(
      "A concise natural-language description of the kind of place and its desired qualities, suitable for semantic similarity search against short place descriptions (e.g. 'relaxed coffee shop suitable for casual visits').",
    ),
  category: z
    .string()
    .nullable()
    .describe(
      "A specific place category if the user clearly named one, matching OSM-style values like 'cafe', 'restaurant', 'park', 'bar', 'hotel'. Null if no specific category is implied.",
    ),
  near: z
    .string()
    .nullable()
    .describe("The name of a landmark, park, or place the user wants to search near. Null if none was mentioned."),
  radiusMeters: z
    .number()
    .int()
    .nullable()
    .describe("Search radius in meters if the user gave or implied a distance. Null if not mentioned."),
});

export type SearchParamsFromQuery = z.infer<typeof searchParamsSchema>;

export async function understandQuery(query: string): Promise<SearchParamsFromQuery> {
  const { output } = await generateText({
    model,
    output: Output.object({ schema: searchParamsSchema }),
    prompt: `Extract structured place-search parameters from this user query: "${query}"`,
  });

  return output;
}
