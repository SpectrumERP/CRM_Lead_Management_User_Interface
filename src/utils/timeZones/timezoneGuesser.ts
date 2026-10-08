export function guessWindowsTimeZone(country: string, state: string, city: string): string | null {
  const c = (country || '').toLowerCase();
  const s = (state || '').toLowerCase();
  const ci = (city || '').toLowerCase();

  if (c.includes('india')) return 'India Standard Time';
  if (c.includes('united arab emirates') || c === 'uae') return 'Arabian Standard Time';
  if (c.includes('singapore')) return 'Singapore Standard Time';
  if (c.includes('china')) return 'China Standard Time';
  if (c.includes('japan')) return 'Tokyo Standard Time';
  if (c.includes('united kingdom') || c === 'uk' || c === 'great britain') return 'GMT Standard Time';
  
  if (c.includes('united states') || c === 'usa' || c === 'us') {
    if (['ca', 'california', 'wa', 'washington', 'or', 'oregon', 'nv', 'nevada'].includes(s)) return 'Pacific Standard Time';
    if (['ny', 'new york', 'fl', 'florida', 'pa', 'pennsylvania', 'oh', 'ohio', 'ga', 'georgia', 'mi', 'michigan', 'nc', 'north carolina', 'va', 'virginia', 'nj', 'new jersey', 'ma', 'massachusetts', 'md', 'maryland', 'sc', 'south carolina'].includes(s)) return 'Eastern Standard Time';
    if (['il', 'illinois', 'tx', 'texas', 'mn', 'minnesota', 'mo', 'missouri', 'wi', 'wisconsin', 'tn', 'tennessee', 'in', 'indiana', 'al', 'alabama', 'la', 'louisiana'].includes(s)) return 'Central Standard Time';
    if (['co', 'colorado', 'az', 'arizona', 'ut', 'utah', 'nm', 'new mexico', 'id', 'idaho', 'mt', 'montana', 'wy', 'wyoming'].includes(s)) return 'Mountain Standard Time';
    if (['ak', 'alaska'].includes(s)) return 'Alaskan Standard Time';
    if (['hi', 'hawaii'].includes(s)) return 'Hawaiian Standard Time';
    return 'Eastern Standard Time'; // Default for US
  }

  if (c.includes('australia')) {
    if (['nsw', 'new south wales', 'vic', 'victoria', 'tas', 'tasmania', 'act', 'australian capital territory'].includes(s)) return 'AUS Eastern Standard Time';
    if (['qld', 'queensland'].includes(s)) return 'E. Australia Standard Time';
    if (['sa', 'south australia', 'nt', 'northern territory'].includes(s)) return 'AUS Central Standard Time';
    if (['wa', 'western australia'].includes(s)) return 'W. Australia Standard Time';
    return 'AUS Eastern Standard Time';
  }

  if (c.includes('canada')) {
    if (['bc', 'british columbia'].includes(s)) return 'Pacific Standard Time';
    if (['ab', 'alberta'].includes(s)) return 'Mountain Standard Time';
    if (['mb', 'manitoba', 'sk', 'saskatchewan'].includes(s)) return 'Canada Central Standard Time';
    if (['on', 'ontario', 'qc', 'quebec'].includes(s)) return 'Eastern Standard Time';
    return 'Eastern Standard Time';
  }

  if (c.includes('russia')) {
    if (['moscow', 'st petersburg'].includes(ci) || ci.includes('moscow')) return 'Russian Standard Time';
    if (['yekaterinburg', 'ekaterinburg'].includes(ci)) return 'Ekaterinburg Standard Time';
    if (['novosibirsk', 'omsk'].includes(ci)) return 'N. Central Asia Standard Time';
    if (['vladivostok'].includes(ci)) return 'Vladivostok Standard Time';
    return 'Russian Standard Time';
  }

  if (['germany', 'france', 'spain', 'italy', 'netherlands', 'belgium'].includes(c)) return 'W. Europe Standard Time';
  if (['brazil', 'brasil'].includes(c)) return 'E. South America Standard Time';
  if (['argentina'].includes(c)) return 'Argentina Standard Time';
  if (['mexico'].includes(c)) return 'Central Standard Time (Mexico)';
  if (['south africa'].includes(c)) return 'South Africa Standard Time';
  if (['egypt'].includes(c)) return 'Egypt Standard Time';
  if (['saudi arabia'].includes(c)) return 'Arab Standard Time';

  return null;
}
