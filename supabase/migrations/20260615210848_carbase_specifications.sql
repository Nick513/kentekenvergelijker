-- Add Autoweek/Carbase specification rows that are not already in comparison_specifications.
-- Existing rows (brand_model, body_type, lane_assist, etc.) are left unchanged.
-- Labels are Dutch (user-facing). Column names and spec_keys are English.

alter table public.comparison_specifications
  drop constraint if exists comparison_specifications_value_source_check;

alter table public.comparison_specifications
  add constraint comparison_specifications_value_source_check
  check (value_source in ('rdw', 'equipment', 'catalog', 'unavailable'));

insert into public.comparison_specifications (
  spec_key, group_key, group_label, group_sort_order, label, sort_order,
  value_source, value_key, display_type
) values
  -- Algemeen (new Carbase rows only; existing rows like brand_model stay as-is)
  ('fiscal_list_price', 'general', 'Algemeen', 1, 'Nieuwprijs fiscaal', 110, 'catalog', 'fiscal_list_price', 'currency'),
  ('list_price_ready_to_drive', 'general', 'Algemeen', 1, 'Nieuwprijs rijklaar', 120, 'catalog', 'list_price_ready_to_drive', 'currency'),
  ('delivery_costs', 'general', 'Algemeen', 1, 'Afleveringskosten', 130, 'catalog', 'delivery_costs', 'currency'),
  ('road_tax', 'general', 'Algemeen', 1, 'Wegenbelasting', 140, 'catalog', 'road_tax', 'text'),
  ('classification', 'general', 'Algemeen', 1, 'Classificatie', 150, 'catalog', 'classification', 'text'),
  ('transmission', 'general', 'Algemeen', 1, 'Schakeling', 160, 'catalog', 'transmission', 'text'),
  ('segment', 'general', 'Algemeen', 1, 'Segment', 170, 'catalog', 'segment', 'text'),
  ('energy_label', 'general', 'Algemeen', 1, 'Energielabel', 180, 'catalog', 'energy_label', 'text'),
  ('company_car_tax', 'general', 'Algemeen', 1, 'Bijtelling', 190, 'catalog', 'company_car_tax', 'text'),
  ('model_introduction', 'general', 'Algemeen', 1, 'Introductie', 200, 'catalog', 'model_introduction', 'text'),
  ('model_end', 'general', 'Algemeen', 1, 'Einde', 210, 'catalog', 'model_end', 'text'),

  -- Motorisering (added to existing powertrain group)
  ('drivetrain_fuel', 'powertrain', 'Motor & aandrijving', 3, 'Aandrijflijn', 90, 'catalog', 'drivetrain_fuel', 'text'),
  ('propulsion_system', 'powertrain', 'Motor & aandrijving', 3, 'Aandrijvingssyteem', 100, 'catalog', 'propulsion_system', 'text'),
  ('max_power_total', 'powertrain', 'Motor & aandrijving', 3, 'Max. vermogen totaal', 110, 'catalog', 'max_power_total', 'text'),
  ('max_torque_total', 'powertrain', 'Motor & aandrijving', 3, 'Max. koppel totaal', 120, 'catalog', 'max_torque_total', 'text'),
  ('drive_wheels', 'powertrain', 'Motor & aandrijving', 3, 'Aandrijving', 130, 'catalog', 'drive_wheels', 'text'),

  -- Brandstofmotor
  ('cylinder_layout', 'combustion_engine', 'Brandstofmotor', 8, 'Cilinders', 10, 'catalog', 'cylinder_layout', 'text'),
  ('valves_per_cylinder', 'combustion_engine', 'Brandstofmotor', 8, 'Kleppen per cilinder', 20, 'catalog', 'valves_per_cylinder', 'text'),
  ('bore_x_stroke', 'combustion_engine', 'Brandstofmotor', 8, 'Boring x slag', 30, 'catalog', 'bore_x_stroke', 'text'),
  ('compression_ratio', 'combustion_engine', 'Brandstofmotor', 8, 'Compressieverhouding', 40, 'catalog', 'compression_ratio', 'text'),
  ('max_power_engine', 'combustion_engine', 'Brandstofmotor', 8, 'Max. vermogen', 50, 'catalog', 'max_power_engine', 'text'),
  ('max_torque_engine', 'combustion_engine', 'Brandstofmotor', 8, 'Max. koppel', 60, 'catalog', 'max_torque_engine', 'text'),
  ('fuel_system', 'combustion_engine', 'Brandstofmotor', 8, 'Brandstofsysteem', 70, 'catalog', 'fuel_system', 'text'),
  ('valve_actuation', 'combustion_engine', 'Brandstofmotor', 8, 'Klepbediening', 80, 'catalog', 'valve_actuation', 'text'),
  ('turbo', 'combustion_engine', 'Brandstofmotor', 8, 'Turbo', 90, 'catalog', 'turbo', 'text'),
  ('catalytic_converter', 'combustion_engine', 'Brandstofmotor', 8, 'Katalysator', 100, 'catalog', 'catalytic_converter', 'text'),
  ('fuel_tank_capacity', 'combustion_engine', 'Brandstofmotor', 8, 'Brandstoftank', 110, 'catalog', 'fuel_tank_capacity', 'text'),
  ('rpm_at_100_kmh', 'combustion_engine', 'Brandstofmotor', 8, 'Toerental bij 100 km/h (theoretisch)', 120, 'catalog', 'rpm_at_100_kmh', 'text'),
  ('rpm_at_130_kmh', 'combustion_engine', 'Brandstofmotor', 8, 'Toerental bij 130 km/h (theoretisch)', 130, 'catalog', 'rpm_at_130_kmh', 'text'),

  -- Prestaties
  ('top_speed', 'performance', 'Prestaties', 9, 'Topsnelheid', 10, 'catalog', 'top_speed', 'text'),
  ('acceleration_0_100', 'performance', 'Prestaties', 9, 'Acceleratie 0-100 km/h', 20, 'catalog', 'acceleration_0_100', 'text'),

  -- Verbruik (NEDC)
  ('fuel_consumption_combined_nedc', 'consumption_nedc', 'Verbruik (NEDC)', 10, 'Verbruik gecombineerd', 10, 'catalog', 'fuel_consumption_combined_nedc', 'text'),
  ('fuel_consumption_urban_nedc', 'consumption_nedc', 'Verbruik (NEDC)', 10, 'Verbruik binnen bebouwde kom', 20, 'catalog', 'fuel_consumption_urban_nedc', 'text'),
  ('fuel_consumption_extra_urban_nedc', 'consumption_nedc', 'Verbruik (NEDC)', 10, 'Verbruik buiten bebouwde kom', 30, 'catalog', 'fuel_consumption_extra_urban_nedc', 'text'),
  ('electricity_consumption_nedc', 'consumption_nedc', 'Verbruik (NEDC)', 10, 'Stroomverbruik', 40, 'catalog', 'electricity_consumption_nedc', 'text'),
  ('electric_range_nedc', 'consumption_nedc', 'Verbruik (NEDC)', 10, 'Actieradius', 50, 'catalog', 'electric_range_nedc', 'text'),

  -- Onderstel
  ('front_suspension', 'chassis', 'Onderstel', 11, 'Wielophanging voor', 10, 'catalog', 'front_suspension', 'text'),
  ('rear_suspension', 'chassis', 'Onderstel', 11, 'Wielophanging achter', 20, 'catalog', 'rear_suspension', 'text'),
  ('front_springs', 'chassis', 'Onderstel', 11, 'Vering voor', 30, 'catalog', 'front_springs', 'text'),
  ('rear_springs', 'chassis', 'Onderstel', 11, 'Vering achter', 40, 'catalog', 'rear_springs', 'text'),
  ('front_stabilizer', 'chassis', 'Onderstel', 11, 'Stabilisator voor', 50, 'catalog', 'front_stabilizer', 'text'),
  ('rear_stabilizer', 'chassis', 'Onderstel', 11, 'Stabilisator achter', 60, 'catalog', 'rear_stabilizer', 'text'),
  ('front_brakes', 'chassis', 'Onderstel', 11, 'Remmen voor', 70, 'catalog', 'front_brakes', 'text'),
  ('rear_brakes', 'chassis', 'Onderstel', 11, 'Remmen achter', 80, 'catalog', 'rear_brakes', 'text'),
  ('front_tire_size', 'chassis', 'Onderstel', 11, 'Bandenmaat voor', 90, 'catalog', 'front_tire_size', 'text'),
  ('rear_tire_size', 'chassis', 'Onderstel', 11, 'Bandenmaat achter', 100, 'catalog', 'rear_tire_size', 'text'),
  ('turning_circle', 'chassis', 'Onderstel', 11, 'Draaicirkel', 110, 'catalog', 'turning_circle', 'text'),

  -- Gewichten (new rows only; empty_weight_kg etc. already in dimensions)
  ('max_payload', 'weights', 'Gewichten', 12, 'Max. laadvermogen', 10, 'catalog', 'max_payload', 'text'),
  ('max_permissible_weight', 'weights', 'Gewichten', 12, 'Max. toelaatbare gewicht', 20, 'catalog', 'max_permissible_weight', 'text'),
  ('max_front_axle_weight', 'weights', 'Gewichten', 12, 'Max. gewicht vooras', 30, 'catalog', 'max_front_axle_weight', 'text'),
  ('max_rear_axle_weight', 'weights', 'Gewichten', 12, 'Max. gewicht achteras', 40, 'catalog', 'max_rear_axle_weight', 'text'),
  ('max_towing_weight_unbraked_kg', 'weights', 'Gewichten', 12, 'Max. trekgewicht ongeremd', 50, 'catalog', 'max_towing_weight_unbraked_kg', 'text'),
  ('max_ball_pressure', 'weights', 'Gewichten', 12, 'Max. kogeldruk', 60, 'catalog', 'max_ball_pressure', 'text'),
  ('max_roof_load', 'weights', 'Gewichten', 12, 'Max. dakbelasting', 70, 'catalog', 'max_roof_load', 'text'),

  -- Bagage / laadruimte
  ('luggage_volume', 'luggage', 'Bagage / laadruimte', 13, 'Inhoud', 10, 'catalog', 'luggage_volume', 'text'),
  ('cargo_length_min_max', 'luggage', 'Bagage / laadruimte', 13, 'Lengte min./max.', 20, 'catalog', 'cargo_length_min_max', 'text'),
  ('cargo_width_min_max', 'luggage', 'Bagage / laadruimte', 13, 'Breedte min./max.', 30, 'catalog', 'cargo_width_min_max', 'text'),
  ('cargo_height', 'luggage', 'Bagage / laadruimte', 13, 'Hoogte', 40, 'catalog', 'cargo_height', 'text'),
  ('load_sill_height', 'luggage', 'Bagage / laadruimte', 13, 'Hoogte tildrempel', 50, 'catalog', 'load_sill_height', 'text'),

  -- Exterieure maten (new rows only; length/width/height already in dimensions)
  ('front_track_width', 'exterior_dimensions', 'Exterieure maten', 14, 'Spoorbreedte voor', 10, 'catalog', 'front_track_width', 'text'),
  ('rear_track_width', 'exterior_dimensions', 'Exterieure maten', 14, 'Spoorbreedte achter', 20, 'catalog', 'rear_track_width', 'text'),
  ('ground_clearance', 'exterior_dimensions', 'Exterieure maten', 14, 'Bodemvrijheid', 30, 'catalog', 'ground_clearance', 'text'),

  -- Interieure maten
  ('seat_to_pedal_distance', 'interior_dimensions', 'Interieure maten', 15, 'Afstand rugleuning/pedalen', 10, 'catalog', 'seat_to_pedal_distance', 'text'),
  ('front_headroom', 'interior_dimensions', 'Interieure maten', 15, 'Hoofdruimte voor', 20, 'catalog', 'front_headroom', 'text'),
  ('front_backrest_length', 'interior_dimensions', 'Interieure maten', 15, 'Lengte rugleuning voor', 30, 'catalog', 'front_backrest_length', 'text'),
  ('front_seat_length', 'interior_dimensions', 'Interieure maten', 15, 'Lengte zitting voor', 40, 'catalog', 'front_seat_length', 'text'),
  ('front_entry_height', 'interior_dimensions', 'Interieure maten', 15, 'Instaphoogte voor', 50, 'catalog', 'front_entry_height', 'text'),
  ('front_interior_width', 'interior_dimensions', 'Interieure maten', 15, 'Interieurbreedte voor', 60, 'catalog', 'front_interior_width', 'text'),

  -- Veiligheid (new rows only; lane_assist, blind_spot_monitor, etc. already exist)
  ('crash_test_result', 'safety', 'Veiligheid & assistentie', 4, 'Botsproef resultaat', 80, 'catalog', 'crash_test_result', 'text'),
  ('abs', 'safety', 'Veiligheid & assistentie', 4, 'ABS', 90, 'catalog', 'abs', 'text'),
  ('brake_force_distribution', 'safety', 'Veiligheid & assistentie', 4, 'Remkrachtverdeling', 100, 'catalog', 'brake_force_distribution', 'text'),
  ('brake_assist', 'safety', 'Veiligheid & assistentie', 4, 'Remassistent', 110, 'catalog', 'brake_assist', 'text'),
  ('collision_warning', 'safety', 'Veiligheid & assistentie', 4, 'Botswaarschuwingssysteem', 120, 'catalog', 'collision_warning', 'text'),
  ('pedestrian_emergency_braking', 'safety', 'Veiligheid & assistentie', 4, 'Noodremassistent voetgangers', 130, 'catalog', 'pedestrian_emergency_braking', 'text'),
  ('stability_control', 'safety', 'Veiligheid & assistentie', 4, 'Stabiliteitsregeling', 140, 'catalog', 'stability_control', 'text'),
  ('traction_control', 'safety', 'Veiligheid & assistentie', 4, 'Tractiecontrole', 150, 'catalog', 'traction_control', 'text'),
  ('limited_slip_differential', 'safety', 'Veiligheid & assistentie', 4, 'Sperdifferentieel', 160, 'catalog', 'limited_slip_differential', 'text'),
  ('adaptive_dampers', 'safety', 'Veiligheid & assistentie', 4, 'Automatisch geregelde schokdemping', 170, 'catalog', 'adaptive_dampers', 'text'),
  ('automatic_level_control', 'safety', 'Veiligheid & assistentie', 4, 'Automatische niveauregeling', 180, 'catalog', 'automatic_level_control', 'text'),
  ('hill_assist', 'safety', 'Veiligheid & assistentie', 4, 'Hill assist', 190, 'catalog', 'hill_assist', 'text'),
  ('steering_assist', 'safety', 'Veiligheid & assistentie', 4, 'Stuurassistent', 200, 'catalog', 'steering_assist', 'text'),
  ('fatigue_detection', 'safety', 'Veiligheid & assistentie', 4, 'Vermoeidheidssensor', 210, 'catalog', 'fatigue_detection', 'text'),
  ('tire_pressure_monitor', 'safety', 'Veiligheid & assistentie', 4, 'Bandenspanningsensor', 220, 'catalog', 'tire_pressure_monitor', 'text'),
  ('night_vision', 'safety', 'Veiligheid & assistentie', 4, 'Nachtzicht met persoonsherkenning', 230, 'catalog', 'night_vision', 'text'),
  ('precrash_system', 'safety', 'Veiligheid & assistentie', 4, 'Precrash systeem', 240, 'catalog', 'precrash_system', 'text'),
  ('high_beam_assist', 'safety', 'Veiligheid & assistentie', 4, 'Grootlicht assistent', 250, 'catalog', 'high_beam_assist', 'text'),
  ('cross_traffic_warning', 'safety', 'Veiligheid & assistentie', 4, 'Cross traffic warning', 260, 'catalog', 'cross_traffic_warning', 'text'),
  ('driver_airbag', 'safety', 'Veiligheid & assistentie', 4, 'Airbag bestuurder', 270, 'catalog', 'driver_airbag', 'text'),
  ('passenger_airbag', 'safety', 'Veiligheid & assistentie', 4, 'Airbag passagier', 280, 'catalog', 'passenger_airbag', 'text'),
  ('side_airbags', 'safety', 'Veiligheid & assistentie', 4, 'Zij-airbags', 290, 'catalog', 'side_airbags', 'text'),
  ('curtain_airbags', 'safety', 'Veiligheid & assistentie', 4, 'Hoofd/gordijnairbags', 300, 'catalog', 'curtain_airbags', 'text'),
  ('driver_knee_airbag', 'safety', 'Veiligheid & assistentie', 4, 'Knieairbag bestuurder', 310, 'catalog', 'driver_knee_airbag', 'text'),
  ('isofix', 'safety', 'Veiligheid & assistentie', 4, 'ISOFIX bevestigingsbeugel', 320, 'catalog', 'isofix', 'text'),
  ('emergency_call', 'safety', 'Veiligheid & assistentie', 4, 'Emergency call', 330, 'catalog', 'emergency_call', 'text'),

  -- Comfort (new rows only)
  ('central_locking', 'comfort', 'Comfort & interieur', 5, 'Centrale deurvergrendeling', 100, 'catalog', 'central_locking', 'text'),
  ('smartphone_key', 'comfort', 'Comfort & interieur', 5, 'Smartphone key', 110, 'catalog', 'smartphone_key', 'text'),
  ('start_button', 'comfort', 'Comfort & interieur', 5, 'Startknop', 120, 'catalog', 'start_button', 'text'),
  ('paddle_shifters', 'comfort', 'Comfort & interieur', 5, 'Stuurschakeling', 130, 'catalog', 'paddle_shifters', 'text'),
  ('electric_windows', 'comfort', 'Comfort & interieur', 5, 'Elektrische ramen', 140, 'catalog', 'electric_windows', 'text'),
  ('power_steering', 'comfort', 'Comfort & interieur', 5, 'Stuurbekrachtiging', 150, 'catalog', 'power_steering', 'text'),
  ('cruise_control', 'comfort', 'Comfort & interieur', 5, 'Cruise control', 160, 'catalog', 'cruise_control', 'text'),
  ('air_conditioning', 'comfort', 'Comfort & interieur', 5, 'Airconditioning', 170, 'catalog', 'air_conditioning', 'text'),
  ('electric_parking_brake', 'comfort', 'Comfort & interieur', 5, 'Elektrische parkeerrem', 180, 'catalog', 'electric_parking_brake', 'text'),
  ('start_stop_system', 'comfort', 'Comfort & interieur', 5, 'Start/stop-systeem', 190, 'catalog', 'start_stop_system', 'text'),

  -- Interieur (new rows only; heated_seats, navigation, etc. already exist elsewhere)
  ('front_seat_height_adjustment', 'interior', 'Interieur', 16, 'Hoogteverstelling voorstoelen', 10, 'catalog', 'front_seat_height_adjustment', 'text'),
  ('front_seat_lumbar_support', 'interior', 'Interieur', 16, 'Lendensteunverstelling voorstoelen', 20, 'catalog', 'front_seat_lumbar_support', 'text'),
  ('ventilated_front_seats', 'interior', 'Interieur', 16, 'Geventileerde voorstoelen', 30, 'catalog', 'ventilated_front_seats', 'text'),
  ('sport_seats', 'interior', 'Interieur', 16, 'Sportstoelen', 40, 'catalog', 'sport_seats', 'text'),
  ('leather_steering_wheel', 'interior', 'Interieur', 16, 'Met leer bekleed stuur', 50, 'catalog', 'leather_steering_wheel', 'text'),
  ('adjustable_steering_wheel', 'interior', 'Interieur', 16, 'Verstelbaar stuur', 60, 'catalog', 'adjustable_steering_wheel', 'text'),
  ('rear_headrests', 'interior', 'Interieur', 16, 'Hoofdsteunen achter', 70, 'catalog', 'rear_headrests', 'text'),
  ('folding_rear_seats', 'interior', 'Interieur', 16, 'Neerklapbare achterbank', 80, 'catalog', 'folding_rear_seats', 'text'),
  ('sliding_rear_seats', 'interior', 'Interieur', 16, 'Verschuifbare achterbank', 90, 'catalog', 'sliding_rear_seats', 'text'),
  ('center_armrest', 'interior', 'Interieur', 16, 'Middenarmsteun', 100, 'catalog', 'center_armrest', 'text'),
  ('preheater', 'interior', 'Interieur', 16, 'Voorverwarmingsinstallatie', 110, 'catalog', 'preheater', 'text'),
  ('auto_dimming_rearview_mirror', 'interior', 'Interieur', 16, 'Automatisch dimmende binnenspiegel', 120, 'catalog', 'auto_dimming_rearview_mirror', 'text'),
  ('reading_lights', 'interior', 'Interieur', 16, 'Leeslampje(s)', 130, 'catalog', 'reading_lights', 'text'),
  ('vanity_mirror_light', 'interior', 'Interieur', 16, 'Verlichte make-up spiegel', 140, 'catalog', 'vanity_mirror_light', 'text'),
  ('adjustable_dashboard_lighting', 'interior', 'Interieur', 16, 'Regelbare dashboardverlichting', 150, 'catalog', 'adjustable_dashboard_lighting', 'text'),
  ('tachometer', 'interior', 'Interieur', 16, 'Toerenteller', 160, 'catalog', 'tachometer', 'text'),
  ('tripmeter', 'interior', 'Interieur', 16, 'Dagteller', 170, 'catalog', 'tripmeter', 'text'),
  ('coolant_temperature_gauge', 'interior', 'Interieur', 16, 'Koelwatertemperatuurmeter', 180, 'catalog', 'coolant_temperature_gauge', 'text'),
  ('outside_temperature_gauge', 'interior', 'Interieur', 16, 'Buitentemperatuurmeter', 190, 'catalog', 'outside_temperature_gauge', 'text'),
  ('trip_computer', 'interior', 'Interieur', 16, 'Boardcomputer', 200, 'catalog', 'trip_computer', 'text'),
  ('digital_instrument_cluster', 'interior', 'Interieur', 16, 'Digital instrumentarium', 210, 'catalog', 'digital_instrument_cluster', 'text'),
  ('head_up_display', 'interior', 'Interieur', 16, 'Headup display', 220, 'catalog', 'head_up_display', 'text'),
  ('audio_system', 'interior', 'Interieur', 16, 'Audioinstallatie', 230, 'catalog', 'audio_system', 'text'),
  ('dab_radio', 'interior', 'Interieur', 16, 'Digitale radio (DAB+)', 240, 'catalog', 'dab_radio', 'text'),
  ('steering_wheel_audio_controls', 'interior', 'Interieur', 16, 'Stuurwielbediening voor audio', 250, 'catalog', 'steering_wheel_audio_controls', 'text'),
  ('audio_input', 'interior', 'Interieur', 16, 'Audio-ingang', 260, 'catalog', 'audio_input', 'text'),
  ('bluetooth', 'interior', 'Interieur', 16, 'Bluetooth', 270, 'catalog', 'bluetooth', 'text'),
  ('over_the_air_updates', 'interior', 'Interieur', 16, 'Over-The-Air updates', 280, 'catalog', 'over_the_air_updates', 'text'),

  -- Exterieur (new rows only; led_headlights, parking_camera, etc. already exist)
  ('rain_sensor', 'exterior', 'Exterieur & licht', 6, 'Regensensor', 70, 'catalog', 'rain_sensor', 'text'),
  ('alloy_wheels', 'exterior', 'Exterieur & licht', 6, 'Lichtmetalen velgen', 80, 'catalog', 'alloy_wheels', 'text'),
  ('roof_rails', 'exterior', 'Exterieur & licht', 6, 'Dakrails', 90, 'catalog', 'roof_rails', 'text'),
  ('metallic_paint', 'exterior', 'Exterieur & licht', 6, 'Metallic lak', 100, 'catalog', 'metallic_paint', 'text'),
  ('color_matched_bumpers', 'exterior', 'Exterieur & licht', 6, 'Meegespoten bumpers', 110, 'catalog', 'color_matched_bumpers', 'text'),
  ('tinted_glass', 'exterior', 'Exterieur & licht', 6, 'Getint glas', 120, 'catalog', 'tinted_glass', 'text'),
  ('privacy_rear_glass', 'exterior', 'Exterieur & licht', 6, 'Privacy glas achter', 130, 'catalog', 'privacy_rear_glass', 'text'),
  ('power_mirrors', 'exterior', 'Exterieur & licht', 6, 'Elektrische buitenspiegels', 140, 'catalog', 'power_mirrors', 'text'),
  ('folding_mirrors', 'exterior', 'Exterieur & licht', 6, 'Inklapbare buitenspiegels', 150, 'catalog', 'folding_mirrors', 'text'),
  ('auto_dimming_mirrors', 'exterior', 'Exterieur & licht', 6, 'Automatisch dimmende buitenspiegels', 160, 'catalog', 'auto_dimming_mirrors', 'text'),
  ('turn_signal_mirrors', 'exterior', 'Exterieur & licht', 6, 'Richtingaanwijzer in buitenspiegels', 170, 'catalog', 'turn_signal_mirrors', 'text'),
  ('fog_lights', 'exterior', 'Exterieur & licht', 6, 'Mistlampen voor', 180, 'catalog', 'fog_lights', 'text'),
  ('automatic_headlights', 'exterior', 'Exterieur & licht', 6, 'Automatisch inschakelende verlichting', 190, 'catalog', 'automatic_headlights', 'text'),
  ('xenon_headlights', 'exterior', 'Exterieur & licht', 6, 'Xenon koplampen', 200, 'catalog', 'xenon_headlights', 'text'),
  ('led_taillights', 'exterior', 'Exterieur & licht', 6, 'Led achterlichten', 210, 'catalog', 'led_taillights', 'text'),
  ('headlight_washers', 'exterior', 'Exterieur & licht', 6, 'Koplampsproeiers', 220, 'catalog', 'headlight_washers', 'text'),
  ('alarm', 'exterior', 'Exterieur & licht', 6, 'Inbraakalarm', 230, 'catalog', 'alarm', 'text'),

  -- Service & garantie
  ('service_interval', 'service_warranty', 'Service & garantie', 17, 'Onderhoudsbeurt', 10, 'catalog', 'service_interval', 'text'),
  ('general_warranty', 'service_warranty', 'Service & garantie', 17, 'Algemene garantie', 20, 'catalog', 'general_warranty', 'text'),
  ('body_warranty', 'service_warranty', 'Service & garantie', 17, 'Carrosserie garantie', 30, 'catalog', 'body_warranty', 'text')

on conflict (spec_key) do nothing;
