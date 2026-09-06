CREATE TABLE places (
    id BIGSERIAL PRIMARY KEY,
    osm_id BIGINT NOT NULL,
    osm_type TEXT NOT NULL,
    name TEXT,
    category TEXT,
    subcategory TEXT,
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    address TEXT,
    city TEXT,
    state TEXT,
    postal_code TEXT,
    website TEXT,
    phone TEXT,
    cuisine TEXT,
    opening_hours TEXT,
    wheelchair TEXT,
    outdoor_seating BOOLEAN,
    tags JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- Semantic search
    search_text TEXT,
    embedding VECTOR(1536),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(osm_type, osm_id)
);


CREATE INDEX places_location_idx
ON places
USING GIST (location);

CREATE INDEX places_category_idx
ON places(category);

CREATE INDEX places_tags_idx
ON places
USING GIN(tags);

CREATE INDEX places_embedding_idx
ON places
USING hnsw (embedding vector_cosine_ops);