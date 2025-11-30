/**
 * Mexican Bank Codes for SPEI/CLABE
 *
 * The first 3 digits of a CLABE identify the bank.
 * This mapping allows auto-detection of the bank from a CLABE number.
 *
 * Source: Banco de Mexico SPEI participant list
 */

export interface BankInfo {
  code: string;        // 3-digit bank code (for CLABE prefix)
  speiCode: string;    // 5-digit SPEI code (for API)
  name: string;        // Full bank name
  shortName: string;   // Short display name
}

// Bank code mapping (CLABE prefix to bank info)
export const BANK_CODES: Record<string, BankInfo> = {
  '002': { code: '002', speiCode: '40002', name: 'BANCO NACIONAL DE MEXICO, S.A.', shortName: 'BANAMEX' },
  '012': { code: '012', speiCode: '40012', name: 'BBVA MEXICO, S.A.', shortName: 'BBVA' },
  '014': { code: '014', speiCode: '40014', name: 'BANCO SANTANDER MEXICO, S.A.', shortName: 'SANTANDER' },
  '021': { code: '021', speiCode: '40021', name: 'HSBC MEXICO, S.A.', shortName: 'HSBC' },
  '030': { code: '030', speiCode: '40030', name: 'BANCO DEL BAJIO, S.A.', shortName: 'BAJIO' },
  '032': { code: '032', speiCode: '40032', name: 'IXE BANCO, S.A.', shortName: 'IXE' },
  '036': { code: '036', speiCode: '40036', name: 'BANCO INBURSA, S.A.', shortName: 'INBURSA' },
  '037': { code: '037', speiCode: '40037', name: 'BANCO INTERACCIONES, S.A.', shortName: 'INTERACCIONES' },
  '042': { code: '042', speiCode: '40042', name: 'BANCA MIFEL, S.A.', shortName: 'MIFEL' },
  '044': { code: '044', speiCode: '40044', name: 'SCOTIABANK INVERLAT, S.A.', shortName: 'SCOTIABANK' },
  '058': { code: '058', speiCode: '40058', name: 'BANCO REGIONAL DE MONTERREY, S.A.', shortName: 'BANREGIO' },
  '059': { code: '059', speiCode: '40059', name: 'BANCO INVEX, S.A.', shortName: 'INVEX' },
  '060': { code: '060', speiCode: '40060', name: 'BANSI, S.A.', shortName: 'BANSI' },
  '062': { code: '062', speiCode: '40062', name: 'BANCA AFIRME, S.A.', shortName: 'AFIRME' },
  '072': { code: '072', speiCode: '40072', name: 'BANCO MERCANTIL DEL NORTE, S.A.', shortName: 'BANORTE' },
  '106': { code: '106', speiCode: '40106', name: 'BANK OF AMERICA MEXICO, S.A.', shortName: 'BANK OF AMERICA' },
  '108': { code: '108', speiCode: '40108', name: 'MUFG BANK MEXICO, S.A.', shortName: 'MUFG' },
  '110': { code: '110', speiCode: '40110', name: 'JP MORGAN, S.A.', shortName: 'JP MORGAN' },
  '112': { code: '112', speiCode: '40112', name: 'BMONEX, S.A.', shortName: 'BMONEX' },
  '113': { code: '113', speiCode: '40113', name: 'VE POR MAS, S.A.', shortName: 'VE POR MAS' },
  '124': { code: '124', speiCode: '40124', name: 'DEUTSCHE BANK MEXICO, S.A.', shortName: 'DEUTSCHE BANK' },
  '126': { code: '126', speiCode: '40126', name: 'CREDIT SUISSE MEXICO, S.A.', shortName: 'CREDIT SUISSE' },
  '127': { code: '127', speiCode: '40127', name: 'BANCO AZTECA, S.A.', shortName: 'AZTECA' },
  '128': { code: '128', speiCode: '40128', name: 'BANCO AUTOFIN MEXICO, S.A.', shortName: 'AUTOFIN' },
  '129': { code: '129', speiCode: '40129', name: 'BARCLAYS BANK MEXICO, S.A.', shortName: 'BARCLAYS' },
  '130': { code: '130', speiCode: '40130', name: 'BANCO COMPARTAMOS, S.A.', shortName: 'COMPARTAMOS' },
  '131': { code: '131', speiCode: '40131', name: 'BANCO FAMSA, S.A.', shortName: 'FAMSA' },
  '132': { code: '132', speiCode: '40132', name: 'BANCO MULTIVA, S.A.', shortName: 'MULTIVA' },
  '133': { code: '133', speiCode: '40133', name: 'ACTINVER, S.A.', shortName: 'ACTINVER' },
  '134': { code: '134', speiCode: '40134', name: 'BANCO INTERCAM, S.A.', shortName: 'INTERCAM' },
  '136': { code: '136', speiCode: '40136', name: 'BANCO BANCREA, S.A.', shortName: 'BANCREA' },
  '137': { code: '137', speiCode: '40137', name: 'BANCO SHINHAN DE MEXICO, S.A.', shortName: 'SHINHAN' },
  '138': { code: '138', speiCode: '40138', name: 'BANCO INMOBILIARIO MEXICANO, S.A.', shortName: 'BIM' },
  '140': { code: '140', speiCode: '40140', name: 'NU MEXICO FINANCIERA, S.A.', shortName: 'NU MEXICO' },
  '141': { code: '141', speiCode: '40141', name: 'CIBanco, S.A.', shortName: 'CIBanco' },
  '143': { code: '143', speiCode: '40143', name: 'CAJA BIENESTAR, S.A.', shortName: 'BIENESTAR' },
  '145': { code: '145', speiCode: '40145', name: 'BANCO FORJADORES, S.A.', shortName: 'FORJADORES' },
  '147': { code: '147', speiCode: '40147', name: 'BANKAOOL, S.A.', shortName: 'BANKAOOL' },
  '148': { code: '148', speiCode: '40148', name: 'CONSUBANCO, S.A.', shortName: 'CONSUBANCO' },
  '150': { code: '150', speiCode: '40150', name: 'BANCO COVALTO, S.A.', shortName: 'COVALTO' },
  '151': { code: '151', speiCode: '40151', name: 'DONDÉ BANCO, S.A.', shortName: 'DONDE' },
  '152': { code: '152', speiCode: '40152', name: 'BANCOPPEL, S.A.', shortName: 'BANCOPPEL' },
  '154': { code: '154', speiCode: '40154', name: 'BANCO PROGRESO CHIHUAHUA, S.A.', shortName: 'PROGRESO' },
  '155': { code: '155', speiCode: '40155', name: 'ICBC MEXICO, S.A.', shortName: 'ICBC' },
  '156': { code: '156', speiCode: '40156', name: 'SABADELL, S.A.', shortName: 'SABADELL' },
  '157': { code: '157', speiCode: '40157', name: 'KLAR, S.A.', shortName: 'KLAR' },
  '158': { code: '158', speiCode: '40158', name: 'MIZUHO BANK MEXICO, S.A.', shortName: 'MIZUHO' },
  '159': { code: '159', speiCode: '40159', name: 'BANCO CAJA SOCIAL MEXICO, S.A.', shortName: 'CAJA SOCIAL' },
  '160': { code: '160', speiCode: '40160', name: 'BANCO S3 CACEIS MEXICO, S.A.', shortName: 'S3 CACEIS' },
  '166': { code: '166', speiCode: '40166', name: 'BANCO FINTERRA, S.A.', shortName: 'FINTERRA' },
  '168': { code: '168', speiCode: '40168', name: 'BANCO HIPOTECARIO FEDERAL, S.N.C.', shortName: 'SHF' },
  // STP and other payment processors
  '646': { code: '646', speiCode: '90646', name: 'STP', shortName: 'STP' },
  '659': { code: '659', speiCode: '90659', name: 'ASP INTEGRA OPC', shortName: 'ASP INTEGRA' },
  '670': { code: '670', speiCode: '90670', name: 'LIBERTAD SERVICIOS FINANCIEROS', shortName: 'LIBERTAD' },
  '677': { code: '677', speiCode: '90677', name: 'CAJA POP MEXICA', shortName: 'CAJA POP' },
  '680': { code: '680', speiCode: '90680', name: 'CRISTOBAL COLON', shortName: 'CRISTOBAL COLON' },
  '683': { code: '683', speiCode: '90683', name: 'CAJA TELEFONISTAS', shortName: 'CAJA TEL' },
  '684': { code: '684', speiCode: '90684', name: 'OPERADORA DE PAGOS MOVILES DE MEXICO', shortName: 'OPM' },
  '685': { code: '685', speiCode: '90685', name: 'FONDO FIRA', shortName: 'FIRA' },
  '686': { code: '686', speiCode: '90686', name: 'NU MEXICO', shortName: 'NU' },
  '689': { code: '689', speiCode: '90689', name: 'FOMPED', shortName: 'FOMPED' },
  '699': { code: '699', speiCode: '90699', name: 'CUENCA', shortName: 'CUENCA' },
  '703': { code: '703', speiCode: '90703', name: 'TESORED', shortName: 'TESORED' },
  '706': { code: '706', speiCode: '90706', name: 'ARCUS', shortName: 'ARCUS' },
  '710': { code: '710', speiCode: '90710', name: 'NVIO PAGOS', shortName: 'NVIO' },
  '722': { code: '722', speiCode: '90722', name: 'MERCADO PAGO', shortName: 'MERCADO PAGO' },
  '723': { code: '723', speiCode: '90723', name: 'CUBO PAGO', shortName: 'CUBO PAGO' },
  '902': { code: '902', speiCode: '90902', name: 'INDEVAL', shortName: 'INDEVAL' },
};

// SPEI code mapping for API use
export const SPEI_CODES: Record<string, BankInfo> = Object.values(BANK_CODES).reduce(
  (acc, bank) => {
    acc[bank.speiCode] = bank;
    return acc;
  },
  {} as Record<string, BankInfo>
);

/**
 * Get bank info from a CLABE number
 * @param clabe - 18-digit CLABE number
 * @returns Bank info or null if not found
 */
export function getBankFromClabe(clabe: string): BankInfo | null {
  if (!clabe || clabe.length < 3) return null;
  const bankCode = clabe.substring(0, 3);
  return BANK_CODES[bankCode] || null;
}

/**
 * Get bank info from a SPEI code
 * @param speiCode - 5-digit SPEI code (e.g., '40012' for BBVA)
 * @returns Bank info or null if not found
 */
export function getBankFromSpeiCode(speiCode: string): BankInfo | null {
  return SPEI_CODES[speiCode] || null;
}

/**
 * Get all banks as array sorted by name
 */
export function getAllBanks(): BankInfo[] {
  return Object.values(BANK_CODES).sort((a, b) => a.shortName.localeCompare(b.shortName));
}

/**
 * Get popular/common banks for quick selection
 */
export function getPopularBanks(): BankInfo[] {
  const popularCodes = ['012', '002', '014', '072', '021', '044', '127', '140', '684'];
  return popularCodes.map(code => BANK_CODES[code]).filter(Boolean);
}

/**
 * Search banks by name
 * @param query - Search query
 * @returns Matching banks
 */
export function searchBanks(query: string): BankInfo[] {
  if (!query) return getAllBanks();
  const lowerQuery = query.toLowerCase();
  return Object.values(BANK_CODES).filter(
    bank =>
      bank.name.toLowerCase().includes(lowerQuery) ||
      bank.shortName.toLowerCase().includes(lowerQuery) ||
      bank.code.includes(query) ||
      bank.speiCode.includes(query)
  );
}

/**
 * Format bank select options for UI
 */
export function getBankSelectOptions(): { value: string; label: string }[] {
  return getAllBanks().map(bank => ({
    value: bank.speiCode,
    label: bank.shortName,
  }));
}
