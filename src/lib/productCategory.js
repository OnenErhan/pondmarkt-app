function normalizeCategory(category) {
  return String(category ?? '')
    .toLocaleLowerCase('tr-TR')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isSemiFinishedCategory(category) {
  const normalized = normalizeCategory(category);
  return normalized.includes('yari mamul') || normalized.includes('yarimamul') || normalized.includes('semi');
}

export function isFinishedCategory(category) {
  const normalized = normalizeCategory(category);
  if (!normalized) return true;
  if (normalized.includes('tam mamul')) return true;
  return !isSemiFinishedCategory(normalized);
}
