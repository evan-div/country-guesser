import { getCountry } from '../../data/countries'

/**
 * Capitals shown to the player, where the dataset's single value is misleading or
 * incomplete (multiple constitutional capitals, legislative vs executive seats).
 */
const DISPLAY_CAPITALS: Record<string, string[]> = {
  ZAF: ['Pretoria', 'Cape Town', 'Bloemfontein'],
  BOL: ['Sucre', 'La Paz'],
  SWZ: ['Mbabane', 'Lobamba'],
  LKA: ['Sri Jayawardenepura Kotte', 'Colombo'],
  MNG: ['Ulaanbaatar'],
  MYS: ['Kuala Lumpur', 'Putrajaya'],
  BEN: ['Porto-Novo', 'Cotonou'],
}

/** Extra accepted spellings / alternate names for capitals (answers only). */
const CAPITAL_ALIASES: Record<string, string[]> = {
  USA: ['Washington', 'Washington DC', 'Washington, D.C.'],
  UKR: ['Kiev'],
  ZAF: ['Tshwane'],
  KAZ: ['Nur-Sultan', 'Akmola'],
  MMR: ['Nay Pyi Taw', 'Naypyitaw', 'Nay Pyi Daw', 'Naypyidaw'],
  MNG: ['Ulan Bator', 'Ulaanbaatar', 'Ulanbaatar'],
  LKA: ['Kotte', 'Sri Jayewardenepura Kotte'],
  MEX: ['Ciudad de Mexico', 'CDMX', 'Mexico'],
  GTM: ['Guatemala', 'Ciudad de Guatemala'],
  PAN: ['Panama'],
  KWT: ['Kuwait'],
  DJI: ['Djibouti City'],
  LUX: ['Luxembourg City'],
  SMR: ['San Marino'],
  MCO: ['Monaco-Ville', 'Monaco Ville'],
  VAT: ['Vatican'],
  SGP: ['Singapore City'],
  CHE: ['Berne'],
  PSE: ['East Jerusalem'],
  KIR: ['Tarawa', 'Bairiki'],
  PLW: ['Melekeok'],
  CHN: ['Peking'],
  IND: ['Delhi'],
  VNM: ['Ha Noi'],
  MDA: ['Kishinev', 'Chisinau'],
  TKM: ['Ashkhabad'],
  ITA: ['Roma'],
  CZE: ['Praha'],
  POL: ['Warszawa'],
  PRT: ['Lisboa'],
  AUT: ['Wien'],
  BEL: ['Bruxelles', 'Brussel'],
  DNK: ['Kobenhavn', 'København'],
  ROU: ['Bucuresti', 'București'],
  GRC: ['Athina'],
  SRB: ['Beograd'],
  BRA: ['Brasilia'],
  YEM: ['Sanaa', 'Sana'],
  TCD: ['Ndjamena'],
  TON: ['Nukualofa'],
  KNA: ['Basse-Terre'],
  ATG: ["St John's", 'St Johns'],
  GRD: ["Saint George's", 'St Georges'],
  BRN: ['Bandar Seri Begawan', 'BSB'],
  CIV: ['Yamoussoukro'],
  KOR: ['Seoul'],
  NPL: ['Katmandu'],
  BGD: ['Dacca'],
  MDV: ['Male'],
}

export function displayCapitals(code: string): string[] {
  return DISPLAY_CAPITALS[code] ?? getCountry(code).capitals
}

/** Every answer accepted as the capital of `code`. */
export function acceptedCapitals(code: string): string[] {
  return [...new Set([...getCountry(code).capitals, ...displayCapitals(code), ...(CAPITAL_ALIASES[code] ?? [])])]
}

/** Main capital used for hint patterns. */
export function primaryCapital(code: string): string {
  return displayCapitals(code)[0]
}
