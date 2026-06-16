-- Per-plate enrichment cache from listings and on-demand catalog fills.
-- Keyed by normalized license plate (no dashes). TTL enforced in application code.

create table public.plate_specification_values (
  license_plate text not null,
  spec_key text not null references public.specifications (spec_key) on delete cascade,

  value_text text,
  value_numeric numeric,
  value_boolean boolean,

  source text not null,
  verification text not null check (verification in (
    'verified',
    'listing_claim',
    'trim_inferred'
  )),

  listing_url text,
  fetched_at timestamptz not null default now(),

  primary key (license_plate, spec_key)
);

create index plate_specification_values_fetched_at_idx
  on public.plate_specification_values (fetched_at);

alter table public.plate_specification_values enable row level security;

-- Writes and reads use the service role in server code (RLS bypass).
