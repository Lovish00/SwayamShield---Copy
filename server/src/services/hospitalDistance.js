import pool from '../config/db.js';

function toFiniteNumber(value, fieldName) {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid ${fieldName}`);
  }
  return parsed;
}

function estimateEtaMinutes(distanceKm) {
  return Math.max(5, Math.round(distanceKm * 3 + 2));
}

let hospitalColumnCache = null;
let hospitalColumnCacheAt = 0;
const HOSPITAL_COLUMN_CACHE_TTL_MS = 5 * 60 * 1000;

async function getHospitalColumns() {
  const now = Date.now();
  if (hospitalColumnCache && (now - hospitalColumnCacheAt) < HOSPITAL_COLUMN_CACHE_TTL_MS) {
    return hospitalColumnCache;
  }

  const result = await pool.query(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'hospitals'
    `
  );

  hospitalColumnCache = new Set(result.rows.map((row) => row.column_name));
  hospitalColumnCacheAt = now;

  return hospitalColumnCache;
}

function resolveCoordinateExpr(columns, decimalCol, floatCol) {
  const hasDecimal = columns.has(decimalCol);
  const hasFloat = columns.has(floatCol);

  if (hasDecimal && hasFloat) {
    return `COALESCE(h.${decimalCol}::double precision, h.${floatCol}::double precision)`;
  }
  if (hasDecimal) {
    return `h.${decimalCol}::double precision`;
  }
  if (hasFloat) {
    return `h.${floatCol}::double precision`;
  }

  throw new Error('Hospitals table does not have location columns.');
}

function resolveBedExpr(columns) {
  const hasTotalBeds = columns.has('total_beds');
  const hasBeds = columns.has('beds');

  if (hasTotalBeds && hasBeds) {
    return 'COALESCE(h.total_beds, h.beds, 0)::int';
  }
  if (hasTotalBeds) {
    return 'COALESCE(h.total_beds, 0)::int';
  }
  if (hasBeds) {
    return 'COALESCE(h.beds, 0)::int';
  }
  return '0::int';
}

function resolveIcuExpr(columns) {
  if (columns.has('icu_beds')) {
    return 'COALESCE(h.icu_beds, 0)::int';
  }
  return '0::int';
}

function resolveOptionalColumnExpr(columns, columnName, fallbackSql = 'NULL::text') {
  return columns.has(columnName) ? `h.${columnName}` : fallbackSql;
}

// Reusable Haversine-based lookup for hospitals sorted by shortest distance.
export async function getNearbyHospitals(latitude, longitude, options = {}) {
  const {
    limit = 5,
    icuOnly = false,
    radiusKm = null,
    emergencyOnly = true,
    ambulanceOnly = true,
  } = options;

  const lat = toFiniteNumber(latitude, 'latitude');
  const lng = toFiniteNumber(longitude, 'longitude');
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 5, 1), 50);
  const hospitalColumns = await getHospitalColumns();

  const latitudeExpr = resolveCoordinateExpr(hospitalColumns, 'latitude', 'lat');
  const longitudeExpr = resolveCoordinateExpr(hospitalColumns, 'longitude', 'lng');
  const bedsExpr = resolveBedExpr(hospitalColumns);
  const icuExpr = resolveIcuExpr(hospitalColumns);
  const addressExpr = resolveOptionalColumnExpr(hospitalColumns, 'address');
  const phoneExpr = resolveOptionalColumnExpr(hospitalColumns, 'phone');
  const emergencyExpr = hospitalColumns.has('emergency') ? 'h.emergency' : 'TRUE';
  const ambulanceExpr = hospitalColumns.has('ambulance') ? 'COALESCE(h.ambulance, true)' : 'TRUE';
  const emergencyFilter = hospitalColumns.has('emergency')
    ? '($4::boolean = false OR h.emergency = true)'
    : '($4::boolean = false OR true)';
  const ambulanceFilter = hospitalColumns.has('ambulance')
    ? '($5::boolean = false OR COALESCE(h.ambulance, true) = true)'
    : '($5::boolean = false OR true)';

  // Clamp acos input to [-1, 1] to avoid occasional floating point range errors.
  const haversineInnerExpr = `
    (
      cos(radians($1)) *
      cos(radians(${latitudeExpr})) *
      cos(radians(${longitudeExpr}) - radians($2)) +
      sin(radians($1)) *
      sin(radians(${latitudeExpr}))
    )
  `;

  const distanceExpr = `
    (
      6371 * acos(
        LEAST(1, GREATEST(-1, ${haversineInnerExpr}))
      )
    )
  `;

  const result = await pool.query(
    `
      SELECT
        h.id,
        h.name,
        ${addressExpr} AS address,
        ${phoneExpr} AS phone,
        ${bedsExpr} AS available_beds,
        ${icuExpr} AS available_icu_beds,
        ${latitudeExpr} AS latitude,
        ${longitudeExpr} AS longitude,
        ${emergencyExpr} AS emergency,
        ${ambulanceExpr} AS ambulance,
        ${distanceExpr} AS distance
      FROM hospitals h
      WHERE ${latitudeExpr} IS NOT NULL
        AND ${longitudeExpr} IS NOT NULL
        AND ${emergencyFilter}
        AND ${ambulanceFilter}
        AND ($6::boolean = false OR ${icuExpr} > 0)
      ORDER BY distance ASC
      LIMIT $3
    `,
    [lat, lng, safeLimit, emergencyOnly, ambulanceOnly, icuOnly]
  );

  const normalized = result.rows.map((hospital) => {
    const distance = Number.parseFloat(Number(hospital.distance).toFixed(2));
    return {
      ...hospital,
      distance,
      // ETA is an approximation for ambulance arrival based on distance.
      eta_minutes: estimateEtaMinutes(distance),
      available_beds: Number(hospital.available_beds || 0),
      available_icu_beds: Number(hospital.available_icu_beds || 0),
    };
  });

  const safeRadius = radiusKm !== null && radiusKm !== undefined
    ? Number.parseFloat(radiusKm)
    : null;

  if (Number.isFinite(safeRadius)) {
    return normalized.filter((hospital) => hospital.distance <= safeRadius);
  }

  return normalized;
}
