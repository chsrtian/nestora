type AmenityRelation = {
  amenity_id?: string | null;
  amenities?: { name?: string | null } | null;
};

export type RentalFilterCriteria = {
  search?: string;
  city?: string;
  propertyType?: string;
  minPrice?: string;
  maxPrice?: string;
  minBedrooms?: string;
  amenityId?: string;
  petFriendly?: boolean;
  validCoordinates?: boolean;
  verifiedCabadbaran?: boolean;
};

export type FilterableRental = {
  title?: string | null;
  description?: string | null;
  address_line?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  property_type?: string | null;
  price?: number | null;
  bedrooms?: number | null;
  lat?: number | null;
  lng?: number | null;
  verification_status?: string | null;
  property_amenities?: AmenityRelation[] | null;
};

const VERIFIED_CITY = "cabadbaran";
const PET_FRIENDLY_KEYS = new Set([
  "petfriendly",
  "petallowed",
  "petsallowed",
]);

function normalize(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function normalizeAmenityKey(value: string | null | undefined) {
  return normalize(value).replace(/[^a-z0-9]/g, "");
}

export function parseRentalFilterNumber(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function validateRentalFilters(filters: RentalFilterCriteria) {
  const minPrice = parseRentalFilterNumber(filters.minPrice);
  const maxPrice = parseRentalFilterNumber(filters.maxPrice);
  const minBedrooms = parseRentalFilterNumber(filters.minBedrooms);

  if (filters.minPrice?.trim() && minPrice === null) {
    return "Minimum price must be a valid number.";
  }

  if (filters.maxPrice?.trim() && maxPrice === null) {
    return "Maximum price must be a valid number.";
  }

  if (minPrice !== null && minPrice < 0) {
    return "Minimum price cannot be negative.";
  }

  if (maxPrice !== null && maxPrice < 0) {
    return "Maximum price cannot be negative.";
  }

  if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
    return "Minimum price cannot be greater than maximum price.";
  }

  if (filters.minBedrooms?.trim() && minBedrooms === null) {
    return "Bedrooms must be a valid number.";
  }

  if (minBedrooms !== null && minBedrooms < 0) {
    return "Bedrooms cannot be negative.";
  }

  return null;
}

export function hasValidRentalCoordinates(property: FilterableRental) {
  return (
    typeof property.lat === "number" &&
    typeof property.lng === "number" &&
    Number.isFinite(property.lat) &&
    Number.isFinite(property.lng) &&
    property.lat >= -90 &&
    property.lat <= 90 &&
    property.lng >= -180 &&
    property.lng <= 180
  );
}

export function isVerifiedCabadbaranRental(property: FilterableRental) {
  return (
    property.verification_status === "verified" &&
    normalize(property.city).includes(VERIFIED_CITY)
  );
}

export function isPetFriendlyRental(property: FilterableRental) {
  return (property.property_amenities ?? []).some((item) => {
    const key = normalizeAmenityKey(item.amenities?.name);
    return PET_FRIENDLY_KEYS.has(key) || key.includes("petfriendly");
  });
}

function propertyIncludesSearch(property: FilterableRental, search: string) {
  const haystack = [
    property.title,
    property.description,
    property.address_line,
    property.city,
    property.state,
    property.country,
    property.property_type,
  ]
    .map(normalize)
    .join(" ");

  return haystack.includes(search);
}

export function matchesRentalFilters(
  property: FilterableRental,
  filters: RentalFilterCriteria,
) {
  const search = normalize(filters.search);
  const city = normalize(filters.city);
  const propertyType = normalize(filters.propertyType);
  const minPrice = parseRentalFilterNumber(filters.minPrice);
  const maxPrice = parseRentalFilterNumber(filters.maxPrice);
  const minBedrooms = parseRentalFilterNumber(filters.minBedrooms);

  if (search && !propertyIncludesSearch(property, search)) {
    return false;
  }

  if (city && !normalize(property.city).includes(city)) {
    return false;
  }

  if (
    propertyType &&
    !normalize(property.property_type).includes(propertyType)
  ) {
    return false;
  }

  if (minPrice !== null || maxPrice !== null) {
    if (typeof property.price !== "number") {
      return false;
    }

    if (minPrice !== null && property.price < minPrice) {
      return false;
    }

    if (maxPrice !== null && property.price > maxPrice) {
      return false;
    }
  }

  if (minBedrooms !== null) {
    if (typeof property.bedrooms !== "number") {
      return false;
    }

    if (property.bedrooms < minBedrooms) {
      return false;
    }
  }

  if (filters.amenityId) {
    const hasAmenity = (property.property_amenities ?? []).some(
      (item) => item.amenity_id === filters.amenityId,
    );
    if (!hasAmenity) {
      return false;
    }
  }

  if (filters.petFriendly && !isPetFriendlyRental(property)) {
    return false;
  }

  if (filters.validCoordinates && !hasValidRentalCoordinates(property)) {
    return false;
  }

  if (
    filters.verifiedCabadbaran &&
    !isVerifiedCabadbaranRental(property)
  ) {
    return false;
  }

  return true;
}

export function filterRentals<T extends FilterableRental>(
  properties: T[],
  filters: RentalFilterCriteria,
) {
  const validationError = validateRentalFilters(filters);
  if (validationError) return [];

  return properties.filter((property) =>
    matchesRentalFilters(property, filters),
  );
}
