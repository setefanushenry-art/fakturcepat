import { FakturItem, FakturSummary, DiscountSyncSource } from '../types';
import { validateFakturItem } from './validation';

/**
 * Formats a number with Indonesian locale:
 * Thousand separator is dot (.), decimal separator is comma (,).
 * e.g. 7356.55 -> "7.356,55"
 * 31100 -> "31.100,00"
 */
export function formatRupiahNumber(amount: number, decimals: number = 2): string {
  if (isNaN(amount) || amount === null || amount === undefined) {
    return `0,${'0'.repeat(decimals)}`;
  }
  const fixed = amount.toFixed(decimals);
  const [intPart, decPart] = fixed.split('.');
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return decimals > 0 ? `${formattedInt},${decPart}` : formattedInt;
}

/**
 * Format currency to IDR Rupiah with exactly 2 decimal digits
 * e.g. 7356.55 -> "Rp 7.356,55"
 * 31100 -> "Rp 31.100,00"
 */
export function formatRupiah(amount: number): string {
  return `Rp ${formatRupiahNumber(amount, 2)}`;
}

/**
 * Formats percentage with 2 decimal places e.g. 5 -> "5,00%" or 5.25 -> "5,25%"
 */
export function formatPersen(val: number, decimals: number = 2): string {
  if (isNaN(val) || val === null || val === undefined) {
    return `0,${'0'.repeat(decimals)}%`;
  }
  return `${formatRupiahNumber(val, decimals)}%`;
}

/**
 * Parses an Indonesian formatted string into a JavaScript number.
 * Handles:
 * - "7.356,55" -> 7356.55
 * - "31.100,00" -> 31100
 * - "31.100" -> 31100
 * - "7356,55" -> 7356.55
 * - "7356.55" -> 7356.55
 * - 7356.55 -> 7356.55
 */
export function parseIndonesianNumber(input: string | number): number {
  if (typeof input === 'number') {
    return isNaN(input) ? 0 : Math.round(input * 100) / 100;
  }
  if (!input || !input.trim()) return 0;
  let clean = input.trim();

  // If string contains both '.' and ',', check which is last to determine decimal
  const lastDot = clean.lastIndexOf('.');
  const lastComma = clean.lastIndexOf(',');

  if (lastComma > lastDot) {
    // Indonesian standard: "7.356,55" or "7356,55"
    clean = clean.replace(/\./g, '').replace(',', '.');
  } else if (lastDot > lastComma) {
    // Could be English "7,356.55" or Indonesian thousand "31.100" or raw float "7356.55"
    if (lastComma !== -1) {
      // Has comma before dot: English thousands "7,356.55"
      clean = clean.replace(/,/g, '');
    } else {
      // Only dot exists. Check parts
      const parts = clean.split('.');
      if (parts.length === 2 && parts[1].length !== 3) {
        // e.g. "7356.55" or "10.5" -> decimal dot
        clean = clean;
      } else {
        // e.g. "31.100" or "1.250.000" -> thousand dots
        clean = clean.replace(/\./g, '');
      }
    }
  } else {
    // Digits only
    clean = clean.replace(/[^\d-]/g, '');
  }

  const num = parseFloat(clean);
  return isNaN(num) ? 0 : Math.round(num * 100) / 100;
}

/**
 * Calculates and synchronizes row values:
 * - Subtotal Bruto = Jumlah * Harga Beli (Purchase Price * Quantity)
 * - Impact of Diskon (%): Primary discount D1
 * - Impact of Tiered Discounts (%): Secondary discount D2 applied on subtotal after D1
 * - Impact of Nominal Diskon (Rp): Flat/custom discount amount with bidirectional sync
 * - Line Total = Subtotal Bruto - Total Discount (Net payable for this item row)
 * - HPP (Harga Pokok Penjualan / Net unit price) = Line Total / Jumlah
 * - Automatic re-validation of line item
 */
export function calculateItemRow(
  rawItem: Partial<FakturItem>,
  syncSource: DiscountSyncSource = 'auto'
): FakturItem {
  const jumlah = Math.max(0, Number(rawItem.jumlah) || 0);
  const hargaBeli = Math.max(0, Math.round((Number(rawItem.hargaBeli) || 0) * 100) / 100);
  const subtotalBruto = Math.round(jumlah * hargaBeli * 100) / 100;

  // Determine effective sync mode:
  // If 'auto', inspect whether the item was previously set via nominal or percentage
  let effectiveMode: 'percentages' | 'nominal' = 'percentages';
  if (syncSource === 'nominal') {
    effectiveMode = 'nominal';
  } else if (syncSource === 'percentages') {
    effectiveMode = 'percentages';
  } else {
    // 'auto': respect last discount mode or fallback
    if (rawItem.discountMode === 'nominal' && (rawItem.nominalDiskon ?? 0) > 0 && (rawItem.diskonBertingkatPersen ?? 0) === 0) {
      effectiveMode = 'nominal';
    } else {
      effectiveMode = 'percentages';
    }
  }

  let diskonPersen = Math.min(100, Math.max(0, Math.round((Number(rawItem.diskonPersen) || 0) * 100) / 100));
  let diskonBertingkatPersen = Math.min(100, Math.max(0, Math.round((Number(rawItem.diskonBertingkatPersen) || 0) * 100) / 100));
  let nominalDiskon = Math.max(0, Math.round((Number(rawItem.nominalDiskon) || 0) * 100) / 100);

  if (effectiveMode === 'percentages') {
    // 1. Primary Discount (%): D1 applied to subtotalBruto
    const d1Nom = subtotalBruto * (diskonPersen / 100);
    const subtotalAfterD1 = Math.max(0, subtotalBruto - d1Nom);

    // 2. Tiered Discount (%): D2 applied to subtotalAfterD1
    const d2Nom = subtotalAfterD1 * (diskonBertingkatPersen / 100);

    // 3. Combined Nominal Discount: D1 + D2 (capped at subtotalBruto)
    nominalDiskon = Math.min(subtotalBruto, Math.round((d1Nom + d2Nom) * 100) / 100);
  } else {
    // User directly edited or locked Nominal Diskon (Rp)
    // Nominal discount cannot exceed gross subtotal
    nominalDiskon = Math.min(subtotalBruto, nominalDiskon);

    // Synchronize to effective primary percentage
    if (subtotalBruto > 0) {
      diskonPersen = Math.round(((nominalDiskon / subtotalBruto) * 100) * 100) / 100;
    } else {
      diskonPersen = 0;
    }
    diskonBertingkatPersen = 0; // Reset tiered discount to avoid double reduction
  }

  // 4. Line Total = Subtotal Bruto - Total Discount (Net total for this line item)
  const lineTotal = Math.max(0, Math.round((subtotalBruto - nominalDiskon) * 100) / 100);

  // 5. Net Unit Price (HPP) = Line Total / Jumlah (if Jumlah > 0)
  const qtyBonus = Math.max(0, Number(rawItem.qtyBonus) || 0);
  const hpp = jumlah > 0 ? Math.round((lineTotal / jumlah) * 100) / 100 : 0;

  const itemToValidate: FakturItem = {
    id: rawItem.id || `item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    urutan: rawItem.urutan ?? 1,
    namaObat: (rawItem.namaObat || '').trim(),
    kodeBarang: (rawItem.kodeBarang || '').trim(),
    noBatch: (rawItem.noBatch || '').trim(),
    tanggalExp: rawItem.tanggalExp || '',
    satuan: (rawItem.satuan || '').trim().toUpperCase(),
    jumlah,
    qtyBonus,
    hargaBeli,
    diskonPersen,
    diskonBertingkatPersen,
    nominalDiskon,
    subtotalBruto,
    hpp,
    total: lineTotal,
    discountMode: effectiveMode,
    validationErrors: [],
    isValid: true,
    rawDiscountCode: rawItem.rawDiscountCode,
  };

  const validationErrors = validateFakturItem(itemToValidate);
  itemToValidate.validationErrors = validationErrors;
  itemToValidate.isValid = validationErrors.length === 0;

  return itemToValidate;
}

/**
 * Recalculates all items and re-indexes the urutan (1, 2, 3...)
 */
export function reindexAndRecalculateItems(
  items: FakturItem[],
  syncSource: DiscountSyncSource = 'auto'
): FakturItem[] {
  return items.map((item, index) =>
    calculateItemRow(
      {
        ...item,
        urutan: index + 1,
      },
      syncSource
    )
  );
}

/**
 * Computes Grand Summary across all items with Century invoice breakdown:
 * - SubTotal Bruto (Sum of line Gross Subtotal: Jumlah * Harga Beli)
 * - Total Diskon (Sum of line discounts: regular + tiered + nominal)
 * - Total Net Baris (Sum of all item line totals)
 * - Cash Diskon (default 2% on net line subtotal)
 * - SubTotal Setelah Diskon (Total Net Baris - Cash Diskon)
 * - Dasar Pengenaan Pajak (DPP = SubTotal Setelah Diskon * 11/12)
 * - PPN (12% of DPP)
 * - TOTAL Tagihan Akhir (SubTotal Setelah Diskon + PPN)
 */
export function calculateGrandSummary(
  items: FakturItem[],
  cashDiskonPersen: number = 2,
  ppnPersen: number = 12
): FakturSummary {
  const totalItem = items.length;
  let totalQty = 0;
  let totalQtyBonus = 0;
  let subtotalBruto = 0;
  let totalDiskonNominal = 0;
  let totalNetBaris = 0;
  let invalidCount = 0;

  for (const item of items) {
    totalQty += item.jumlah;
    totalQtyBonus += item.qtyBonus || 0;
    subtotalBruto += item.subtotalBruto || (item.jumlah * item.hargaBeli);
    totalDiskonNominal += item.nominalDiskon || 0;
    totalNetBaris += item.total ?? Math.max(0, (item.jumlah * item.hargaBeli) - item.nominalDiskon);
    if (!item.isValid) {
      invalidCount++;
    }
  }

  subtotalBruto = Math.round(subtotalBruto * 100) / 100;
  totalDiskonNominal = Math.round(totalDiskonNominal * 100) / 100;
  totalNetBaris = Math.round(totalNetBaris * 100) / 100;

  // Subtotal after all line item discounts (matches sum of line totals)
  const subtotalAfterItemDisc = totalNetBaris;

  // Cash Diskon (e.g. 2% on Century invoice)
  const cashDiskonNominal = Math.round(subtotalAfterItemDisc * (cashDiskonPersen / 100) * 100) / 100;

  // SubTotal Setelah Diskon
  const subtotalSetelahDiskon = Math.max(0, Math.round((subtotalAfterItemDisc - cashDiskonNominal) * 100) / 100);

  // Dasar Pengenaan Pajak (DPP):
  // According to Indonesian pharmaceutical distribution tax formula (PMK):
  // DPP = SubTotal Setelah Diskon * (11 / 12)
  const dpp = Math.round(subtotalSetelahDiskon * (11 / 12) * 100) / 100;

  // PPN = DPP * (ppnPersen / 100) (e.g. 12% on Century invoice)
  const ppnNominal = Math.round(dpp * (ppnPersen / 100) * 100) / 100;

  // TOTAL tagihan akhir = SubTotal Setelah Diskon + PPN (rounded to whole Rupiah like Century invoice)
  const grandTotal = Math.round(subtotalSetelahDiskon + ppnNominal);

  const avgDiskonPersen =
    subtotalBruto > 0 ? Math.round(((totalDiskonNominal / subtotalBruto) * 100) * 100) / 100 : 0;

  return {
    totalItem,
    totalQty,
    totalQtyBonus,
    subtotalBruto,
    totalDiskonNominal,
    totalNetBaris,
    cashDiskonNominal,
    subtotalSetelahDiskon,
    dpp,
    ppnNominal,
    grandTotal,
    avgDiskonPersen,
    itemWithErrorsCount: invalidCount,
  };
}
