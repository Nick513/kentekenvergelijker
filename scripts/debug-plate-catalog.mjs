// Debug catalog matching for a kenteken. Internal dev tool.
// Usage: node --env-file=.env.local scripts/debug-plate-catalog.mjs N-434-PJ

import { createCatalogClient } from "./lib/scraper/db-writer.mjs";
import {
  filterByExactFuel,
  filterModelMatches,
  resolveConfigurationId,
  trimSlugFromCatalogKey,
} from "./lib/verification/plate-catalog-resolve.mjs";
import {
  pickCo2EmissionGKm,
  pickFuelType,
  pickPowerKw,
} from "./lib/verification/rdw-snapshot.mjs";

const plate = (process.argv[2] ?? "N-434-PJ").replace(/[^A-Za-z0-9]/g, "").toUpperCase();

const RDW_BASE = "https://opendata.rdw.nl/resource";
const headers = { Accept: "application/json" };
if (process.env.RDW_APP_TOKEN) headers["X-App-Token"] = process.env.RDW_APP_TOKEN;

async function rdw(dataset) {
  const url = `${RDW_BASE}/${dataset}.json?kenteken=${plate}`;
  const res = await fetch(url, { headers });
  return res.json();
}

const [vehicle] = await rdw("m9d7-ebf2");
const fuel = await rdw("8ys7-d773");

const snapshot = {
  licensePlate: plate,
  brand: vehicle.merk?.trim() ?? "Onbekend",
  modelName: vehicle.handelsbenaming?.trim() ?? "Onbekend",
  fuelType: pickFuelType(fuel),
  engineDisplacementCc: vehicle.cilinderinhoud ? Number.parseInt(vehicle.cilinderinhoud, 10) : null,
  catalogPrice: vehicle.catalogusprijs ? Number.parseInt(vehicle.catalogusprijs, 10) : null,
  powerKw: pickPowerKw(fuel),
  co2EmissionGKm: pickCo2EmissionGKm(fuel),
  curbWeightKg: vehicle.massa_rijklaar ? Number.parseInt(vehicle.massa_rijklaar, 10) : null,
  firstRegistrationYear: vehicle.datum_eerste_toelating
    ? Number.parseInt(vehicle.datum_eerste_toelating.slice(0, 4), 10)
    : null,
  configurationKey: [
    vehicle.typegoedkeuringsnummer ?? "",
    vehicle.variant ?? "",
    vehicle.uitvoering ?? "",
    vehicle.volgnummer_wijziging_eu_typegoedkeuring ?? "",
  ].join("|"),
};

console.log("Snapshot:", snapshot);

const supabase = createCatalogClient();
const { data: configs } = await supabase
  .from("vehicle_configurations")
  .select("id, brand, model_name, trim_name, catalog_key")
  .ilike("brand", snapshot.brand)
  .not("catalog_key", "like", "rdw:%");

const modelMatches = filterModelMatches(snapshot, configs);
console.log(`Model matches: ${modelMatches.length}`);

const ids = modelMatches.map((r) => r.id);
const { data: specRows } = await supabase
  .from("vehicle_configuration_specification_values")
  .select("vehicle_configuration_id, spec_key, value_text, value_numeric, value_boolean")
  .in("vehicle_configuration_id", ids);

const fuelById = new Map();
const displacementById = new Map();
for (const row of specRows ?? []) {
  if (row.spec_key === "fuel_type" && row.value_text) fuelById.set(row.vehicle_configuration_id, row.value_text);
  if (row.spec_key === "engine_displacement_cc" && row.value_numeric !== null) {
    displacementById.set(row.vehicle_configuration_id, Number(row.value_numeric));
  }
}

let matched = ids;
if (snapshot.engineDisplacementCc) {
  const next = matched.filter((id) => {
    const d = displacementById.get(id);
    return d !== undefined && Math.abs(d - snapshot.engineDisplacementCc) <= 80;
  });
  if (next.length) matched = next;
}

const catalogKeyById = new Map(modelMatches.map((row) => [row.id, row.catalog_key]));
const exactFuel = filterByExactFuel(matched, snapshot.fuelType, fuelById, catalogKeyById);
console.log(`After displacement + exact fuel filter: ${exactFuel.length} configs`);
for (const id of exactFuel) {
  const row = modelMatches.find((r) => r.id === id);
  const hs = (specRows ?? []).find((s) => s.vehicle_configuration_id === id && s.spec_key === "heated_seats");
  console.log(" ", row?.catalog_key, "fuel=", fuelById.get(id), "heated_seats=", hs?.value_boolean ?? "-");
}

const resolvedId = resolveConfigurationId(snapshot, modelMatches, specRows ?? []);
const resolved = modelMatches.find((r) => r.id === resolvedId);
console.log("\n=== RESOLVED (single catalog row) ===");
console.log("catalog_key:", resolved?.catalog_key ?? "none");
console.log("trim:", resolved ? trimSlugFromCatalogKey(resolved.catalog_key) : "none");

if (resolvedId) {
  const specs = (specRows ?? []).filter((row) => row.vehicle_configuration_id === resolvedId);
  const equipment = specs.filter((row) => row.value_boolean === true);
  console.log(`primary spec count: ${specs.length}, equipment flags: ${equipment.length}`);
  console.log(
    "heated_seats (primary):",
    specs.find((row) => row.spec_key === "heated_seats")?.value_boolean ?? "-",
  );

  const trimSlug = resolved?.catalog_key.split("|")[3];
  const trimSiblingIds = modelMatches
    .filter((row) => row.catalog_key.split("|")[3] === trimSlug)
    .map((row) => row.id);
  const allTrimSpecs = new Set();
  for (const id of trimSiblingIds) {
    for (const row of specRows ?? []) {
      if (row.vehicle_configuration_id === id) allTrimSpecs.add(row.spec_key);
    }
  }
  console.log(
    `same-trim sibling configs: ${trimSiblingIds.length}, unique spec keys across trim: ${allTrimSpecs.size}`,
  );
  console.log("(App gap-fills equipment + agreed trim-level specs from siblings.)");
}
