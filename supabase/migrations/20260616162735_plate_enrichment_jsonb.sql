-- Replace per-spec rows with one JSON blob per plate.
-- This cuts row count ~50× (one row per plate instead of one per spec),
-- shrinks indexes, and simplifies the store: 1 select and 1 upsert per plate.
--
-- JSON key names match the TypeScript EnrichedSpecValue fields (camelCase)
-- so store.ts can round-trip without a mapping layer.

-- ---------------------------------------------------------------------------
-- 1. New table
-- ---------------------------------------------------------------------------

create table public.plate_enrichment_cache (
  license_plate text primary key,
  specs         jsonb not null default '{}',
  fetched_at    timestamptz not null default now()
);

create index plate_enrichment_cache_fetched_at_idx
  on public.plate_enrichment_cache (fetched_at);

alter table public.plate_enrichment_cache enable row level security;

-- ---------------------------------------------------------------------------
-- 2. Migrate existing data
-- ---------------------------------------------------------------------------

insert into public.plate_enrichment_cache (license_plate, specs, fetched_at)
select
  license_plate,
  jsonb_object_agg(
    spec_key,
    jsonb_build_object(
      'valueText',    value_text,
      'valueNumeric', value_numeric,
      'valueBoolean', value_boolean,
      'verification', verification,
      'source',       source,
      'listingUrl',   listing_url
    )
  ) as specs,
  max(fetched_at) as fetched_at
from public.plate_specification_values
group by license_plate;

-- ---------------------------------------------------------------------------
-- 3. Drop old table (index and FK drop automatically)
-- ---------------------------------------------------------------------------

drop table public.plate_specification_values;
