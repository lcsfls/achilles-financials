/** Von Enable Banking abgedeckte Länder (EWR + UK). */
export const COUNTRIES: Array<{ code: string; de: string; en: string }> = [
  { code: "AT", de: "Österreich", en: "Austria" },
  { code: "BE", de: "Belgien", en: "Belgium" },
  { code: "BG", de: "Bulgarien", en: "Bulgaria" },
  { code: "HR", de: "Kroatien", en: "Croatia" },
  { code: "CY", de: "Zypern", en: "Cyprus" },
  { code: "CZ", de: "Tschechien", en: "Czechia" },
  { code: "DK", de: "Dänemark", en: "Denmark" },
  { code: "EE", de: "Estland", en: "Estonia" },
  { code: "FI", de: "Finnland", en: "Finland" },
  { code: "FR", de: "Frankreich", en: "France" },
  { code: "DE", de: "Deutschland", en: "Germany" },
  { code: "GR", de: "Griechenland", en: "Greece" },
  { code: "HU", de: "Ungarn", en: "Hungary" },
  { code: "IS", de: "Island", en: "Iceland" },
  { code: "IE", de: "Irland", en: "Ireland" },
  { code: "IT", de: "Italien", en: "Italy" },
  { code: "LV", de: "Lettland", en: "Latvia" },
  { code: "LI", de: "Liechtenstein", en: "Liechtenstein" },
  { code: "LT", de: "Litauen", en: "Lithuania" },
  { code: "LU", de: "Luxemburg", en: "Luxembourg" },
  { code: "MT", de: "Malta", en: "Malta" },
  { code: "NL", de: "Niederlande", en: "Netherlands" },
  { code: "NO", de: "Norwegen", en: "Norway" },
  { code: "PL", de: "Polen", en: "Poland" },
  { code: "PT", de: "Portugal", en: "Portugal" },
  { code: "RO", de: "Rumänien", en: "Romania" },
  { code: "SK", de: "Slowakei", en: "Slovakia" },
  { code: "SI", de: "Slowenien", en: "Slovenia" },
  { code: "ES", de: "Spanien", en: "Spain" },
  { code: "SE", de: "Schweden", en: "Sweden" },
  { code: "GB", de: "Großbritannien", en: "United Kingdom" },
];

export function countryName(code: string, lang: "de" | "en"): string {
  const c = COUNTRIES.find((x) => x.code === code);
  return c ? c[lang] : code;
}
