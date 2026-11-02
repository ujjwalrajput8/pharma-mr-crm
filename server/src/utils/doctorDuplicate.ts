/** Letters and digits only, any script — "Boring-Road" and "boring road" squash alike. */
const squash = (value: string) => value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

/**
 * Two doctors are the same doctor when their name and area match, ignoring
 * case, punctuation and a leading "Dr." — so "Dr. R.K. Sharma, Boring Road"
 * and "rk sharma, BORING-ROAD" share a key. "Drishti" keeps its "Dr".
 */
export function doctorDuplicateKey(fullName: string, area: string | null | undefined): string {
  const name = fullName.trim().replace(/^dr(\.\s*|\s+)/i, '');
  return `${squash(name)}|${squash(area ?? '')}`;
}
