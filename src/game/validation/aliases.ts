/**
 * Curated answer variations on top of the names found in the datasets. Every entry is a
 * name people legitimately use for the country (exonyms, former names still in common
 * use, standard abbreviations). Partial names are deliberately excluded.
 */
export const COUNTRY_ALIASES: Record<string, string[]> = {
  USA: ['USA', 'US', 'U.S.', 'U.S.A.', 'United States', 'United States of America'],
  GBR: ['UK', 'U.K.', 'United Kingdom', 'Great Britain', 'Britain', 'GB'],
  CZE: ['Czech Republic', 'Czechia', 'Czech', 'Cesko'],
  TUR: ['Turkey', 'Turkiye', 'Türkiye', 'Republic of Turkey'],
  CIV: ['Ivory Coast', "Côte d'Ivoire", "Cote d'Ivoire", 'Cote dIvoire'],
  MMR: ['Burma', 'Myanmar'],
  SWZ: ['Swaziland', 'Eswatini', 'eSwatini'],
  TLS: ['East Timor', 'Timor-Leste', 'Timor Leste'],
  CPV: ['Cape Verde', 'Cabo Verde', 'Cape Verde Islands'],
  VAT: ['Holy See', 'Vatican', 'Vatican City', 'Vatican City State', 'The Holy See'],
  MKD: ['Macedonia', 'North Macedonia', 'FYROM', 'Republic of Macedonia'],
  NLD: ['Holland', 'Netherlands', 'The Netherlands', 'Nederland'],
  COD: [
    'DRC',
    'DR Congo',
    'D.R. Congo',
    'Democratic Republic of the Congo',
    'Democratic Republic of Congo',
    'Congo-Kinshasa',
    'Congo Kinshasa',
    'Zaire',
  ],
  COG: [
    'Republic of the Congo',
    'Republic of Congo',
    'Congo Republic',
    'Congo-Brazzaville',
    'Congo Brazzaville',
    'ROC',
  ],
  KOR: ['South Korea', 'Republic of Korea', 'S. Korea', 'ROK'],
  PRK: ['North Korea', 'DPRK', 'N. Korea'],
  ARE: ['UAE', 'U.A.E.', 'United Arab Emirates', 'The Emirates', 'Emirates'],
  BIH: ['Bosnia', 'Bosnia and Herzegovina', 'Bosnia-Herzegovina', 'BiH'],
  CAF: ['CAR', 'Central African Republic'],
  FSM: ['Micronesia', 'Federated States of Micronesia', 'FSM'],
  PSE: ['Palestine', 'State of Palestine', 'Palestinian Territories', 'Palestinian Territory'],
  RUS: ['Russia', 'Russian Federation'],
  SYR: ['Syria', 'Syrian Arab Republic'],
  LAO: ['Laos', 'Lao', 'Lao PDR'],
  VNM: ['Vietnam', 'Viet Nam'],
  KNA: ['Saint Kitts and Nevis', 'St. Kitts and Nevis', 'Saint Kitts', 'St Kitts', 'St Kitts & Nevis'],
  VCT: [
    'Saint Vincent and the Grenadines',
    'Saint Vincent',
    'St. Vincent',
    'Saint Vincent and Grenadines',
    'St Vincent and the Grenadines',
  ],
  LCA: ['Saint Lucia', 'St. Lucia'],
  ATG: ['Antigua and Barbuda', 'Antigua'],
  TTO: ['Trinidad and Tobago', 'Trinidad', 'Trinidad & Tobago'],
  STP: ['Sao Tome and Principe', 'São Tomé and Príncipe', 'Sao Tome'],
  GNB: ['Guinea-Bissau', 'Guinea Bissau'],
  GNQ: ['Equatorial Guinea'],
  PNG: ['Papua New Guinea', 'PNG'],
  NZL: ['New Zealand', 'NZ', 'Aotearoa'],
  ZAF: ['South Africa', 'RSA'],
  SAU: ['Saudi Arabia', 'KSA', 'Saudi'],
  CHN: ['China', 'PRC', "People's Republic of China", 'Mainland China'],
  IRN: ['Iran', 'Persia', 'Islamic Republic of Iran'],
  BRN: ['Brunei', 'Brunei Darussalam'],
  MDA: ['Moldova', 'Republic of Moldova'],
  BLR: ['Belarus', 'Byelorussia', 'Belorussia'],
  KGZ: ['Kyrgyzstan', 'Kyrgyz Republic', 'Kirghizia'],
  GMB: ['Gambia', 'The Gambia'],
  BHS: ['Bahamas', 'The Bahamas'],
  SSD: ['South Sudan'],
  TZA: ['Tanzania', 'United Republic of Tanzania'],
  BOL: ['Bolivia'],
  VEN: ['Venezuela'],
  LKA: ['Sri Lanka', 'Ceylon'],
  THA: ['Thailand', 'Siam'],
  KHM: ['Cambodia', 'Kampuchea'],
  BFA: ['Burkina Faso', 'Burkina'],
  MHL: ['Marshall Islands', 'The Marshall Islands'],
  SLB: ['Solomon Islands', 'The Solomon Islands', 'Solomons'],
  SVK: ['Slovakia', 'Slovak Republic'],
  DEU: ['Germany', 'Deutschland'],
  ESP: ['Spain', 'España'],
  ITA: ['Italy', 'Italia'],
  JPN: ['Japan', 'Nippon', 'Nihon'],
  GRC: ['Greece', 'Hellas', 'Hellenic Republic'],
  IRL: ['Ireland', 'Republic of Ireland', 'Eire', 'Éire'],
  CHE: ['Switzerland', 'Swiss Confederation', 'Schweiz', 'Suisse'],
  AUT: ['Austria', 'Österreich'],
  KAZ: ['Kazakhstan', 'Kazakstan'],
  UKR: ['Ukraine', 'The Ukraine'],
  MDV: ['Maldives', 'The Maldives'],
  PHL: ['Philippines', 'The Philippines', 'Phillipines'],
  CMR: ['Cameroon', 'Cameroun'],
  GUY: ['Guyana'],
  DOM: ['Dominican Republic'],
  DMA: ['Dominica', 'Commonwealth of Dominica'],
  MUS: ['Mauritius'],
  SYC: ['Seychelles', 'The Seychelles'],
  COM: ['Comoros', 'The Comoros'],
}

/**
 * Inputs that name more than one playable state. Answering with these never costs a life;
 * the player is asked to be more specific (unless every option would be correct).
 */
export const AMBIGUOUS_NAMES: Record<string, string[]> = {
  Congo: ['COG', 'COD'],
  'The Congo': ['COG', 'COD'],
  Korea: ['KOR', 'PRK'],
}

/**
 * Well-known parts of sovereign states. Typing one is not counted as a guess — the player
 * is reminded to name the sovereign country instead.
 */
export const PART_OF: Record<string, string> = {
  England: 'GBR',
  Scotland: 'GBR',
  Wales: 'GBR',
  'Northern Ireland': 'GBR',
  Gibraltar: 'GBR',
  'French Guiana': 'FRA',
  Guadeloupe: 'FRA',
  Martinique: 'FRA',
  Reunion: 'FRA',
  Mayotte: 'FRA',
  Corsica: 'FRA',
  Svalbard: 'NOR',
  Alaska: 'USA',
  Hawaii: 'USA',
  Tasmania: 'AUS',
  Sicily: 'ITA',
  Sardinia: 'ITA',
  Tibet: 'CHN',
  Siberia: 'RUS',
  Zanzibar: 'TZA',
  'Canary Islands': 'ESP',
  'Balearic Islands': 'ESP',
  Azores: 'PRT',
  Madeira: 'PRT',
  Kaliningrad: 'RUS',
  Crete: 'GRC',
  Bali: 'IDN',
  Java: 'IDN',
  Sumatra: 'IDN',
  Hokkaido: 'JPN',
  Okinawa: 'JPN',
}

/** Dataset alternate names that are too generic to accept as answers. */
export const EXCLUDED_DATASET_ALIASES = new Set([
  'Island', // Iceland's native name, but also an English word
  'Prathet', // Thai for "country"
  'Thai', // a demonym
])
