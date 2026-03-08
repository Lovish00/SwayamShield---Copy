import { hospitalAPI } from './api';

export async function getNearbyHospitals(latitude, longitude, options = {}) {
  const response = await hospitalAPI.getNearbyHospitals(latitude, longitude, options);
  const hospitals = Array.isArray(response.data) ? response.data : [];

  return hospitals
    .map((hospital) => ({
      ...hospital,
      distance: Number(hospital.distance || 0),
      available_beds: Number(hospital.available_beds || 0),
      available_icu_beds: Number(hospital.available_icu_beds || 0),
    }))
    .sort((a, b) => a.distance - b.distance);
}
