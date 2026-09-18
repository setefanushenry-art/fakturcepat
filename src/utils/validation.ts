import { FakturItem, ValidationErrorItem } from '../types';

/**
 * Normalizes and formats expiration dates.
 * Rule: "Jika hanya tercantum bulan, otomatis cantumkan tanggal hari pertama semisal 12/29 menjadi 01/12/2029"
 * Handles formats: MM/YY, MM/YYYY, DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, etc.
 */
export function normalizeExpiryDate(rawDate: string): { formatted: string; isValid: boolean; error?: string } {
  if (!rawDate || !rawDate.trim()) {
    return { formatted: '', isValid: false, error: 'Tanggal Exp belum diisi' };
  }

  const cleaned = rawDate.trim().replace(/[-.]/g, '/');

  // Format 1: MM/YY e.g. "12/29" or "5/28" -> "01/12/2029"
  const mmyyMatch = cleaned.match(/^(\d{1,2})\/(\d{2})$/);
  if (mmyyMatch) {
    const month = parseInt(mmyyMatch[1], 10);
    const shortYear = parseInt(mmyyMatch[2], 10);
    if (month >= 1 && month <= 12) {
      const fullYear = shortYear < 70 ? 2000 + shortYear : 1900 + shortYear;
      const padMonth = month.toString().padStart(2, '0');
      return { formatted: `01/${padMonth}/${fullYear}`, isValid: true };
    }
    return { formatted: cleaned, isValid: false, error: 'Bulan harus antara 01 - 12' };
  }

  // Format 2: MM/YYYY e.g. "12/2029" or "05/2027" -> "01/05/2027"
  const mmyyyyMatch = cleaned.match(/^(\d{1,2})\/(\d{4})$/);
  if (mmyyyyMatch) {
    const month = parseInt(mmyyyyMatch[1], 10);
    const year = parseInt(mmyyyyMatch[2], 10);
    if (month >= 1 && month <= 12) {
      const padMonth = month.toString().padStart(2, '0');
      return { formatted: `01/${padMonth}/${year}`, isValid: true };
    }
    return { formatted: cleaned, isValid: false, error: 'Bulan harus antara 01 - 12' };
  }

  // Format 3: DD/MM/YY e.g. "15/12/29" -> "15/12/2029"
  const ddmmyyMatch = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (ddmmyyMatch) {
    const day = parseInt(ddmmyyMatch[1], 10);
    const month = parseInt(ddmmyyMatch[2], 10);
    const shortYear = parseInt(ddmmyyMatch[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const fullYear = shortYear < 70 ? 2000 + shortYear : 1900 + shortYear;
      const padDay = day.toString().padStart(2, '0');
      const padMonth = month.toString().padStart(2, '0');
      return { formatted: `${padDay}/${padMonth}/${fullYear}`, isValid: true };
    }
  }

  // Format 4: DD/MM/YYYY e.g. "01/12/2029"
  const ddmmyyyyMatch = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (ddmmyyyyMatch) {
    const day = parseInt(ddmmyyyyMatch[1], 10);
    const month = parseInt(ddmmyyyyMatch[2], 10);
    const year = parseInt(ddmmyyyyMatch[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const padDay = day.toString().padStart(2, '0');
      const padMonth = month.toString().padStart(2, '0');
      return { formatted: `${padDay}/${padMonth}/${year}`, isValid: true };
    }
    return { formatted: cleaned, isValid: false, error: 'Format tanggal atau bulan tidak valid' };
  }

  // Format 5: YYYY/MM e.g. "2030/08" or "2030-08" (Century format) -> "01/08/2030"
  const yyyymmMatch = cleaned.match(/^(\d{4})\/(\d{1,2})$/);
  if (yyyymmMatch) {
    const year = parseInt(yyyymmMatch[1], 10);
    const month = parseInt(yyyymmMatch[2], 10);
    if (month >= 1 && month <= 12) {
      const padMonth = month.toString().padStart(2, '0');
      return { formatted: `01/${padMonth}/${year}`, isValid: true };
    }
  }

  // Format 6: YYYY/MM/DD e.g. "2029/12/01" -> "01/12/2029"
  const yyyymmddMatch = cleaned.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (yyyymmddMatch) {
    const year = parseInt(yyyymmddMatch[1], 10);
    const month = parseInt(yyyymmddMatch[2], 10);
    const day = parseInt(yyyymmddMatch[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const padDay = day.toString().padStart(2, '0');
      const padMonth = month.toString().padStart(2, '0');
      return { formatted: `${padDay}/${padMonth}/${year}`, isValid: true };
    }
  }

  // Fallback: try parsing text like "Dec 2028" or "12-2029"
  const parsedTimestamp = Date.parse(cleaned);
  if (!isNaN(parsedTimestamp)) {
    const d = new Date(parsedTimestamp);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    return { formatted: `${day}/${month}/${year}`, isValid: true };
  }

  return { formatted: rawDate, isValid: false, error: 'Format tanggal harus DD/MM/YYYY atau MM/YYYY (contoh: 12/29)' };
}

/**
 * Checks whether an expiry date has already passed.
 */
export function isDateExpired(dateStr: string): boolean {
  if (!dateStr) return false;
  const match = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return false;
  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1;
  const year = parseInt(match[3], 10);
  const expDate = new Date(year, month, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return expDate < today;
}

/**
 * Validates a single Faktur item and returns list of validation errors.
 */
export function validateFakturItem(item: FakturItem): ValidationErrorItem[] {
  const errors: ValidationErrorItem[] = [];
  const subtotalBruto = item.jumlah * item.hargaBeli;

  // 1. Nama Obat check
  if (!item.namaObat || !item.namaObat.trim()) {
    errors.push({
      field: 'namaObat',
      message: 'Nama obat tidak boleh kosong',
    });
  }

  // 2. Jumlah check
  if (isNaN(item.jumlah) || item.jumlah <= 0) {
    errors.push({
      field: 'jumlah',
      message: 'Jumlah harus lebih besar dari 0',
      suggestedValue: 1,
    });
  }

  // 3. Harga Beli check
  if (isNaN(item.hargaBeli) || item.hargaBeli <= 0) {
    errors.push({
      field: 'hargaBeli',
      message: 'Harga beli harus lebih besar dari 0',
    });
  }

  // 4. Diskon (%) Utama check: between 0 and 100
  if (isNaN(item.diskonPersen) || item.diskonPersen < 0 || item.diskonPersen > 100) {
    errors.push({
      field: 'diskonPersen',
      message: 'Diskon (%) harus antara 0% sampai 100%',
      suggestedValue: Math.min(100, Math.max(0, item.diskonPersen || 0)),
    });
  }

  // 5. Diskon Bertingkat (%) check: between 0 and 100
  if (isNaN(item.diskonBertingkatPersen) || item.diskonBertingkatPersen < 0 || item.diskonBertingkatPersen > 100) {
    errors.push({
      field: 'diskonBertingkatPersen',
      message: 'Diskon bertingkat (%) harus antara 0% sampai 100%',
      suggestedValue: Math.min(100, Math.max(0, item.diskonBertingkatPersen || 0)),
    });
  }

  // 6. Nominal Diskon check: cannot exceed total harga sebelum diskon
  if (isNaN(item.nominalDiskon) || item.nominalDiskon < 0) {
    errors.push({
      field: 'nominalDiskon',
      message: 'Nominal diskon tidak boleh negatif',
      suggestedValue: 0,
    });
  } else if (subtotalBruto > 0 && item.nominalDiskon > subtotalBruto) {
    errors.push({
      field: 'nominalDiskon',
      message: `Nominal diskon (Rp ${item.nominalDiskon.toLocaleString('id-ID')}) melebihi subtotal sebelum diskon (Rp ${subtotalBruto.toLocaleString('id-ID')})`,
      suggestedValue: subtotalBruto,
    });
  }

  // 7. Tanggal Exp check
  const expCheck = normalizeExpiryDate(item.tanggalExp);
  if (!expCheck.isValid) {
    errors.push({
      field: 'tanggalExp',
      message: expCheck.error || 'Format tanggal kedaluwarsa tidak valid (contoh: 12/29 atau 01/12/2029)',
      suggestedValue: expCheck.formatted,
    });
  } else if (isDateExpired(expCheck.formatted)) {
    errors.push({
      field: 'tanggalExp',
      message: `Obat sudah kedaluwarsa (${expCheck.formatted})! Harap cek kembali fisik obat/faktur.`,
    });
  }

  // 8. No Batch check (optional warning)
  if (!item.noBatch || !item.noBatch.trim()) {
    errors.push({
      field: 'noBatch',
      message: 'No. Batch belum terisi (disarankan diisi untuk ketertelusuran BPOM)',
    });
  }

  return errors;
}
