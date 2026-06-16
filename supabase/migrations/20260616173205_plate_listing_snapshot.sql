-- Last-known market data from online listings, keyed by license plate.
-- No TTL: retains last-seen mileage and price even after listings expire.
-- Rows are only written or updated when a listing is found with non-null values.

create table public.plate_listing_snapshot (
  license_plate     text primary key,
  mileage_km        integer,
  asking_price_eur  integer,
  listing_url       text,
  last_seen_at      timestamptz not null default now()
);

alter table public.plate_listing_snapshot enable row level security;

-- Reads and writes use the service role (RLS bypass).
