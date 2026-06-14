const RDW_BASE_URL = "https://opendata.rdw.nl/resource";
const VEHICLE_DATASET = "m9d7-ebf2";
const FUEL_DATASET = "8ys7-d773";

function normalizeKenteken(input) {
  return input.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 6);
}

function titleCaseWords(value) {
  return value
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function buildHeaders() {
  const headers = { Accept: "application/json" };
  const token = process.env.RDW_APP_TOKEN?.trim();
  if (token) {
    headers["X-App-Token"] = token;
  }
  return headers;
}

async function fetchDataset(dataset, licensePlate) {
  const url = new URL(`${RDW_BASE_URL}/${dataset}.json`);
  url.searchParams.set("kenteken", licensePlate);
  url.searchParams.set("$limit", "10");

  const response = await fetch(url, { headers: buildHeaders() });

  if (!response.ok) {
    throw new Error(`RDW request failed (${response.status}) for ${dataset}`);
  }

  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

function pickPowerKw(fuelRecords) {
  for (const fuel of fuelRecords) {
    const electric = Number.parseFloat(fuel.netto_max_vermogen_elektrisch ?? "");
    if (Number.isFinite(electric)) return electric;
  }

  for (const fuel of fuelRecords) {
    const combustion = Number.parseFloat(fuel.nettomaximumvermogen ?? "");
    if (Number.isFinite(combustion)) return combustion;
  }

  return null;
}

async function main() {
  const rawPlate = process.argv[2];
  if (!rawPlate) {
    console.error("Usage: node scripts/fetch-rdw.mjs <kenteken>");
    console.error("Example: node scripts/fetch-rdw.mjs HGL33B");
    process.exit(1);
  }

  const licensePlate = normalizeKenteken(rawPlate);
  if (licensePlate.length !== 6) {
    console.error(`Invalid kenteken: ${rawPlate}`);
    process.exit(1);
  }

  console.log(`Fetching RDW data for ${licensePlate}...`);

  const [vehicleRecords, fuelRecords] = await Promise.all([
    fetchDataset(VEHICLE_DATASET, licensePlate),
    fetchDataset(FUEL_DATASET, licensePlate),
  ]);

  if (vehicleRecords.length === 0) {
    console.error(`Kenteken niet gevonden: ${licensePlate}`);
    process.exit(1);
  }

  const vehicle = vehicleRecords[0];
  const fuelType = fuelRecords[0]?.brandstof_omschrijving
    ? titleCaseWords(fuelRecords[0].brandstof_omschrijving)
    : null;
  const powerKw = pickPowerKw(fuelRecords);

  const summary = {
    licensePlate,
    brand: vehicle.merk ?? null,
    modelName: vehicle.handelsbenaming ?? null,
    primaryColor: vehicle.eerste_kleur
      ? titleCaseWords(vehicle.eerste_kleur)
      : null,
    fuelType,
    powerKw,
    apkExpiry: vehicle.vervaldatum_apk_dt ?? vehicle.vervaldatum_apk ?? null,
    catalogPrice: vehicle.catalogusprijs ?? null,
    configurationKey: [
      vehicle.typegoedkeuringsnummer ?? "",
      vehicle.variant ?? "",
      vehicle.uitvoering ?? "",
      vehicle.volgnummer_wijziging_eu_typegoedkeuring ?? "",
    ].join("|"),
  };

  console.log("\nSummary:");
  console.log(JSON.stringify(summary, null, 2));

  console.log("\nRaw vehicle record:");
  console.log(JSON.stringify(vehicle, null, 2));

  if (fuelRecords.length > 0) {
    console.log("\nRaw fuel record(s):");
    console.log(JSON.stringify(fuelRecords, null, 2));
  }
}

main().catch((error) => {
  console.error("RDW fetch failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
