type ProviderProfileCompletenessLike = {
  displayName?: string | null;
  cityId?: string | null;
  serviceKeys?: string[] | null;
  basePrice?: number | null;
};

export function isProviderProfileComplete(profile: ProviderProfileCompletenessLike | null | undefined): boolean {
  if (!profile) return false;

  const displayName = String(profile.displayName ?? '').trim();
  const cityId = String(profile.cityId ?? '').trim();
  const serviceKeys = Array.isArray(profile.serviceKeys) ? profile.serviceKeys.filter(Boolean) : [];
  const basePrice = profile.basePrice;

  return displayName.length > 0
    && cityId.length > 0
    && serviceKeys.length > 0
    && typeof basePrice === 'number'
    && !Number.isNaN(basePrice);
}
