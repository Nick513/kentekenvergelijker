// RDW snapshot helpers for dev scripts — mirrors lib/rdw/map.ts fuel/power logic.

function titleCaseWords(value) {
  return value
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function isElectricFuel(description) {
  return /^elektriciteit$/i.test(description?.trim() ?? "");
}

function getHybridClass(fuelRecords) {
  for (const fuel of fuelRecords) {
    const hybridClass = fuel.klasse_hybride_elektrisch_voertuig?.trim();
    if (hybridClass) return hybridClass;
  }
  return null;
}

export function pickFuelType(fuelRecords) {
  if (!fuelRecords?.length) return null;

  const hybridClass = getHybridClass(fuelRecords);
  const fuelDescriptions = fuelRecords
    .map((fuel) => fuel.brandstof_omschrijving?.trim())
    .filter(Boolean);

  const uniqueFuels = [
    ...new Set(fuelDescriptions.map((description) => titleCaseWords(description))),
  ];

  if (hybridClass) {
    const combustion = fuelDescriptions.find((description) => !isElectricFuel(description));
    if (combustion) {
      const combustionLabel = titleCaseWords(combustion).toLowerCase();
      if (hybridClass.startsWith("OVC")) {
        return `Plug-in hybride (${combustionLabel})`;
      }
      return `Hybride ${combustionLabel}`;
    }
  }

  if (uniqueFuels.length > 1) {
    return uniqueFuels.join(" + ");
  }

  return uniqueFuels[0] ?? null;
}

function parseOptionalNumber(value) {
  if (!value) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function pickPowerKw(fuelRecords) {
  const hybridClass = getHybridClass(fuelRecords);

  if (hybridClass) {
    for (const fuel of fuelRecords) {
      if (!isElectricFuel(fuel.brandstof_omschrijving)) {
        const combustion = parseOptionalNumber(fuel.nettomaximumvermogen);
        if (combustion !== null) return combustion;
      }
    }
  }

  const hasCombustionPower = fuelRecords.some(
    (fuel) =>
      fuel.brandstof_omschrijving &&
      !isElectricFuel(fuel.brandstof_omschrijving) &&
      fuel.nettomaximumvermogen,
  );

  if (hasCombustionPower) {
    for (const fuel of fuelRecords) {
      const combustion = parseOptionalNumber(fuel.nettomaximumvermogen);
      if (combustion !== null) return combustion;
    }
  }

  for (const fuel of fuelRecords) {
    const electric = parseOptionalNumber(fuel.netto_max_vermogen_elektrisch);
    if (electric !== null) return electric;
  }

  return null;
}

export function pickCo2EmissionGKm(fuelRecords) {
  for (const fuel of fuelRecords) {
    const parsed = fuel.co2_uitstoot_gecombineerd
      ? Number.parseInt(fuel.co2_uitstoot_gecombineerd, 10)
      : null;
    if (parsed !== null && Number.isFinite(parsed)) return parsed;
  }
  return null;
}
