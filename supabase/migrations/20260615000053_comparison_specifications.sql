-- Catalog of comparison rows shown in the UI.
-- Labels are Dutch (user-facing). Column names are English.

create table public.comparison_specifications (
  spec_key text primary key,
  group_key text not null,
  group_label text not null,
  group_sort_order integer not null,
  label text not null,
  sort_order integer not null,
  value_source text not null check (value_source in ('rdw', 'equipment', 'unavailable')),
  value_key text not null,
  display_type text not null default 'text' check (display_type in (
    'text',
    'boolean',
    'currency',
    'date',
    'power_kw',
    'distance_km',
    'mass_kg',
    'volume_cc',
    'year',
    'length_cm',
    'co2_g_km'
  )),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index comparison_specifications_group_sort_idx
  on public.comparison_specifications (group_sort_order, sort_order);

create index comparison_specifications_active_idx
  on public.comparison_specifications (is_active)
  where is_active = true;

alter table public.comparison_specifications enable row level security;

create policy comparison_specifications_public_read
  on public.comparison_specifications
  for select
  using (is_active = true);

insert into public.comparison_specifications (
  spec_key, group_key, group_label, group_sort_order, label, sort_order,
  value_source, value_key, display_type
) values
  -- Algemeen
  ('brand_model', 'general', 'Algemeen', 1, 'Merk & model', 10, 'rdw', 'brand_model', 'text'),
  ('trim_package', 'general', 'Algemeen', 1, 'Uitvoering / pakket', 20, 'equipment', 'trim_package', 'text'),
  ('primary_color', 'general', 'Algemeen', 1, 'Kleur', 30, 'rdw', 'primary_color', 'text'),
  ('first_registration_year', 'general', 'Algemeen', 1, 'Bouwjaar', 40, 'rdw', 'first_registration_year', 'year'),
  ('apk_expiry_date', 'general', 'Algemeen', 1, 'APK vervaldatum', 50, 'rdw', 'apk_expiry_date', 'date'),
  ('catalog_price', 'general', 'Algemeen', 1, 'Catalogusprijs', 60, 'rdw', 'catalog_price', 'currency'),
  ('vehicle_type', 'general', 'Algemeen', 1, 'Voertuigsoort', 70, 'rdw', 'vehicle_type', 'text'),
  ('body_type', 'general', 'Algemeen', 1, 'Carrosserie', 80, 'rdw', 'body_type', 'text'),
  ('door_count', 'general', 'Algemeen', 1, 'Aantal deuren', 90, 'rdw', 'door_count', 'text'),
  ('seat_count', 'general', 'Algemeen', 1, 'Aantal zitplaatsen', 100, 'rdw', 'seat_count', 'text'),

  -- Afmetingen & gewicht
  ('vehicle_length_cm', 'dimensions', 'Afmetingen & gewicht', 2, 'Lengte', 10, 'rdw', 'vehicle_length_cm', 'length_cm'),
  ('vehicle_width_cm', 'dimensions', 'Afmetingen & gewicht', 2, 'Breedte', 20, 'rdw', 'vehicle_width_cm', 'length_cm'),
  ('vehicle_height_cm', 'dimensions', 'Afmetingen & gewicht', 2, 'Hoogte', 30, 'rdw', 'vehicle_height_cm', 'length_cm'),
  ('wheelbase_cm', 'dimensions', 'Afmetingen & gewicht', 2, 'Wielbasis', 40, 'rdw', 'wheelbase_cm', 'length_cm'),
  ('curb_weight_kg', 'dimensions', 'Afmetingen & gewicht', 2, 'Massa rijklaar', 50, 'rdw', 'curb_weight_kg', 'mass_kg'),
  ('empty_weight_kg', 'dimensions', 'Afmetingen & gewicht', 2, 'Massa ledig', 60, 'rdw', 'empty_weight_kg', 'mass_kg'),
  ('max_towing_weight_braked_kg', 'dimensions', 'Afmetingen & gewicht', 2, 'Max. trekgewicht (geremd)', 70, 'rdw', 'max_towing_weight_braked_kg', 'mass_kg'),

  -- Motor & aandrijving
  ('fuel_type', 'powertrain', 'Motor & aandrijving', 3, 'Brandstof', 10, 'rdw', 'fuel_type', 'text'),
  ('power_kw', 'powertrain', 'Motor & aandrijving', 3, 'Vermogen', 20, 'rdw', 'power_kw', 'power_kw'),
  ('engine_displacement_cc', 'powertrain', 'Motor & aandrijving', 3, 'Cilinderinhoud', 30, 'rdw', 'engine_displacement_cc', 'volume_cc'),
  ('cylinder_count', 'powertrain', 'Motor & aandrijving', 3, 'Aantal cilinders', 40, 'rdw', 'cylinder_count', 'text'),
  ('electric_range_wltp', 'powertrain', 'Motor & aandrijving', 3, 'Actieradius (WLTP)', 50, 'rdw', 'electric_range_wltp', 'distance_km'),
  ('electric_consumption_wltp', 'powertrain', 'Motor & aandrijving', 3, 'Elektrisch verbruik (WLTP)', 60, 'rdw', 'electric_consumption_wltp', 'text'),
  ('co2_emission_g_km', 'powertrain', 'Motor & aandrijving', 3, 'CO2-uitstoot', 70, 'rdw', 'co2_emission_g_km', 'co2_g_km'),
  ('emission_standard', 'powertrain', 'Motor & aandrijving', 3, 'Emissienorm', 80, 'rdw', 'emission_standard', 'text'),

  -- Veiligheid & assistentie
  ('adaptive_cruise_control', 'safety', 'Veiligheid & assistentie', 4, 'Adaptive cruise control', 10, 'equipment', 'adaptive_cruise_control', 'boolean'),
  ('lane_assist', 'safety', 'Veiligheid & assistentie', 4, 'Rijstrookassistent', 20, 'equipment', 'lane_assist', 'boolean'),
  ('lane_keep_assist', 'safety', 'Veiligheid & assistentie', 4, 'Lane keep assist', 30, 'equipment', 'lane_keep_assist', 'boolean'),
  ('blind_spot_monitor', 'safety', 'Veiligheid & assistentie', 4, 'Dodehoekdetectie', 40, 'equipment', 'blind_spot_monitor', 'boolean'),
  ('traffic_sign_recognition', 'safety', 'Veiligheid & assistentie', 4, 'Verkeersbordherkenning', 50, 'equipment', 'traffic_sign_recognition', 'boolean'),
  ('autonomous_emergency_braking', 'safety', 'Veiligheid & assistentie', 4, 'Autonome noodrem', 60, 'equipment', 'autonomous_emergency_braking', 'boolean'),
  ('parking_assist', 'safety', 'Veiligheid & assistentie', 4, 'Parkeerassistent', 70, 'equipment', 'parking_assist', 'boolean'),

  -- Comfort & interieur
  ('heated_seats', 'comfort', 'Comfort & interieur', 5, 'Stoelverwarming', 10, 'equipment', 'heated_seats', 'boolean'),
  ('heated_steering_wheel', 'comfort', 'Comfort & interieur', 5, 'Stuurverwarming', 20, 'equipment', 'heated_steering_wheel', 'boolean'),
  ('leather_upholstery', 'comfort', 'Comfort & interieur', 5, 'Lederen bekleding', 30, 'equipment', 'leather_upholstery', 'boolean'),
  ('dual_zone_climate_control', 'comfort', 'Comfort & interieur', 5, 'Climate control (2 zones)', 40, 'equipment', 'dual_zone_climate_control', 'boolean'),
  ('electric_seats', 'comfort', 'Comfort & interieur', 5, 'Elektrisch verstelbare stoelen', 50, 'equipment', 'electric_seats', 'boolean'),
  ('keyless_entry', 'comfort', 'Comfort & interieur', 5, 'Keyless entry', 60, 'equipment', 'keyless_entry', 'boolean'),
  ('electric_tailgate', 'comfort', 'Comfort & interieur', 5, 'Elektrische achterklep', 70, 'equipment', 'electric_tailgate', 'boolean'),
  ('panoramic_roof', 'comfort', 'Comfort & interieur', 5, 'Panoramadak', 80, 'equipment', 'panoramic_roof', 'boolean'),
  ('sunroof', 'comfort', 'Comfort & interieur', 5, 'Schuifdak', 90, 'equipment', 'sunroof', 'boolean'),

  -- Exterieur & licht
  ('led_headlights', 'exterior', 'Exterieur & licht', 6, 'LED koplampen', 10, 'equipment', 'led_headlights', 'boolean'),
  ('adaptive_headlights', 'exterior', 'Exterieur & licht', 6, 'Adaptieve koplampen', 20, 'equipment', 'adaptive_headlights', 'boolean'),
  ('parking_sensors_front', 'exterior', 'Exterieur & licht', 6, 'Parkeersensoren voor', 30, 'equipment', 'parking_sensors_front', 'boolean'),
  ('parking_sensors_rear', 'exterior', 'Exterieur & licht', 6, 'Parkeersensoren achter', 40, 'equipment', 'parking_sensors_rear', 'boolean'),
  ('parking_camera', 'exterior', 'Exterieur & licht', 6, 'Achteruitrijcamera', 50, 'equipment', 'parking_camera', 'boolean'),
  ('tow_hitch', 'exterior', 'Exterieur & licht', 6, 'Trekhaak', 60, 'equipment', 'tow_hitch', 'boolean'),

  -- Infotainment & connectiviteit
  ('navigation', 'connectivity', 'Infotainment & connectiviteit', 7, 'Navigatie', 10, 'equipment', 'navigation', 'boolean'),
  ('apple_carplay', 'connectivity', 'Infotainment & connectiviteit', 7, 'Apple CarPlay', 20, 'equipment', 'apple_carplay', 'boolean'),
  ('android_auto', 'connectivity', 'Infotainment & connectiviteit', 7, 'Android Auto', 30, 'equipment', 'android_auto', 'boolean'),
  ('wireless_phone_charging', 'connectivity', 'Infotainment & connectiviteit', 7, 'Draadloos opladen', 40, 'equipment', 'wireless_phone_charging', 'boolean');
