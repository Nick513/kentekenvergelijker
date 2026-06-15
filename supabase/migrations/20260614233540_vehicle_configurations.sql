-- RDW configuration catalog (not keyed by kenteken).
-- One row per unique homologated vehicle configuration, reused across many plates.
-- configuration_key is derived in application code from RDW identity fields.

create table public.vehicle_configurations (
  configuration_key text primary key,

  brand text not null,
  model_name text not null,

  type_approval_number text,
  variant text,
  vehicle_type text,
  rdw_configuration_code text,
  eu_type_approval_amendment_number text,

  fuel_type text,
  power_kw numeric,
  engine_displacement_cc integer,
  body_type text,
  door_count integer,
  european_vehicle_category text,

  rdw_vehicle jsonb not null,
  rdw_fuel jsonb,

  source text not null default 'rdw' check (source = 'rdw'),
  fetched_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index vehicle_configurations_brand_model_name_idx
  on public.vehicle_configurations (brand, model_name);

create index vehicle_configurations_fetched_at_idx
  on public.vehicle_configurations (fetched_at);

alter table public.vehicle_configurations enable row level security;

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger vehicle_configurations_updated_at
  before update on public.vehicle_configurations
  for each row execute function public.set_updated_at();
