-- Restructure vehicle catalog: separate consumer identity, RDW data, and spec values.
-- vehicle_configurations: brand + model + trim (consumer catalog identity)
-- configurations: RDW type-approval identity (many plates share one row)
-- configuration_links: maps vehicle_configurations to configurations
-- vehicle_configuration_specification_values: spec values per vehicle_configuration

-- ---------------------------------------------------------------------------
-- 1. RDW configurations (moved out of vehicle_configurations)
-- ---------------------------------------------------------------------------

create table public.configurations (
  configuration_key text primary key,

  type_approval_number text,
  variant text,
  vehicle_type text,
  rdw_configuration_code text,
  eu_type_approval_amendment_number text,

  rdw_vehicle jsonb not null default '{}',
  rdw_fuel jsonb,

  source text not null default 'rdw' check (source = 'rdw'),
  fetched_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index configurations_fetched_at_idx
  on public.configurations (fetched_at);

alter table public.configurations enable row level security;

create trigger configurations_updated_at
  before update on public.configurations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. Replace vehicle_configurations with consumer catalog identity
-- ---------------------------------------------------------------------------

alter table public.vehicle_configurations rename to vehicle_configurations_legacy;

drop trigger if exists vehicle_configurations_updated_at on public.vehicle_configurations_legacy;

-- Index names are global; drop legacy indexes so the new table can reuse them.
drop index if exists public.vehicle_configurations_brand_model_name_idx;
drop index if exists public.vehicle_configurations_fetched_at_idx;

create table public.vehicle_configurations (
  id uuid primary key default gen_random_uuid(),

  brand text not null,
  model_name text not null,
  trim_name text not null default '',

  catalog_key text not null unique,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index vehicle_configurations_brand_model_name_idx
  on public.vehicle_configurations (brand, model_name);

create index vehicle_configurations_catalog_key_idx
  on public.vehicle_configurations (catalog_key);

alter table public.vehicle_configurations enable row level security;

create trigger vehicle_configurations_updated_at
  before update on public.vehicle_configurations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. Link vehicle configurations to RDW configurations
-- ---------------------------------------------------------------------------

create table public.configuration_links (
  vehicle_configuration_id uuid not null
    references public.vehicle_configurations (id) on delete cascade,
  configuration_key text not null
    references public.configurations (configuration_key) on delete cascade,

  primary key (vehicle_configuration_id, configuration_key)
);

create index configuration_links_configuration_key_idx
  on public.configuration_links (configuration_key);

alter table public.configuration_links enable row level security;

-- ---------------------------------------------------------------------------
-- 4. Specification values per vehicle configuration
-- ---------------------------------------------------------------------------

create table public.vehicle_configuration_specification_values (
  vehicle_configuration_id uuid not null
    references public.vehicle_configurations (id) on delete cascade,
  spec_key text not null
    references public.comparison_specifications (spec_key) on delete restrict,

  value_text text,
  value_numeric numeric,
  value_boolean boolean,

  source text not null,
  fetched_at timestamptz not null default now(),

  primary key (vehicle_configuration_id, spec_key),

  constraint vehicle_configuration_specification_values_has_value
    check (
      value_text is not null
      or value_numeric is not null
      or value_boolean is not null
    )
);

create index vehicle_configuration_specification_values_spec_key_idx
  on public.vehicle_configuration_specification_values (spec_key);

alter table public.vehicle_configuration_specification_values enable row level security;

-- ---------------------------------------------------------------------------
-- 5. Migrate legacy vehicle_configurations data
-- ---------------------------------------------------------------------------

insert into public.configurations (
  configuration_key,
  type_approval_number,
  variant,
  vehicle_type,
  rdw_configuration_code,
  eu_type_approval_amendment_number,
  rdw_vehicle,
  rdw_fuel,
  source,
  fetched_at,
  updated_at
)
select
  configuration_key,
  type_approval_number,
  variant,
  vehicle_type,
  rdw_configuration_code,
  eu_type_approval_amendment_number,
  rdw_vehicle,
  rdw_fuel,
  source,
  fetched_at,
  updated_at
from public.vehicle_configurations_legacy;

insert into public.vehicle_configurations (
  brand,
  model_name,
  trim_name,
  catalog_key,
  created_at,
  updated_at
)
select
  brand,
  model_name,
  '',
  'rdw:' || configuration_key,
  fetched_at,
  updated_at
from public.vehicle_configurations_legacy;

insert into public.configuration_links (
  vehicle_configuration_id,
  configuration_key
)
select
  vc.id,
  legacy.configuration_key
from public.vehicle_configurations_legacy legacy
join public.vehicle_configurations vc
  on vc.catalog_key = 'rdw:' || legacy.configuration_key;

insert into public.vehicle_configuration_specification_values (
  vehicle_configuration_id,
  spec_key,
  value_text,
  value_numeric,
  source,
  fetched_at
)
select
  vc.id,
  spec.spec_key,
  spec.value_text,
  spec.value_numeric,
  'rdw',
  legacy.fetched_at
from public.vehicle_configurations_legacy legacy
join public.vehicle_configurations vc
  on vc.catalog_key = 'rdw:' || legacy.configuration_key
cross join lateral (
  values
    ('fuel_type', legacy.fuel_type::text, null::numeric),
    ('body_type', legacy.body_type, null::numeric),
    ('power_kw', null::text, legacy.power_kw),
    ('engine_displacement_cc', null::text, legacy.engine_displacement_cc::numeric),
    ('door_count', legacy.door_count::text, legacy.door_count::numeric)
) as spec (spec_key, value_text, value_numeric)
where spec.value_text is not null or spec.value_numeric is not null;

drop table public.vehicle_configurations_legacy;
