import { FakturItem, FakturHeader } from '../types';
import { calculateItemRow } from './calculations';
import { normalizeExpiryDate } from './validation';

export interface ParseResult {
  header: Partial<FakturHeader>;
  items: FakturItem[];
  rawLineCount: number;
  extractedCount: number;
}

/**
 * Parses numeric strings in Indonesian format (e.g. "1.250.000,50", "45.000", "5,5")
 */
export function parseIdrNumber(str: string | undefined): number {
  if (!str) return 0;
  let clean = str.trim().replace(/^Rp\s*/i, '');
  // If format is like 1.250.000 or 1.250.000,00
  if (clean.includes('.') && clean.includes(',')) {
    clean = clean.replace(/\./g, '').replace(',', '.');
  } else if (clean.includes('.')) {
    // If multiple dots, e.g. 1.250.000 -> remove dots
    const parts = clean.split('.');
    if (parts.length > 2 || parts[parts.length - 1].length === 3) {
      clean = clean.replace(/\./g, '');
    }
  } else if (clean.includes(',')) {
    // Single comma e.g. 5,5 -> 5.5
    clean = clean.replace(',', '.');
  }
  const val = parseFloat(clean.replace(/[^\d.-]/g, ''));
  return isNaN(val) ? 0 : val;
}

/**
 * Extracts header metadata (No Faktur, Nama PBF, Tanggal Faktur, No Seri Pajak, Ref SP, Payment Type) from invoice text
 */
export function extractInvoiceHeader(text: string): Partial<FakturHeader> {
  const header: Partial<FakturHeader> = {};

  // Extract No Faktur e.g. "No. Faktur : A47260900411"
  const noFakturMatch = text.match(/(?:no\.?\s*(?:faktur|invoice|inv|nota)|faktur\s*no\.?)\s*[:#]?\s*([A-Za-z0-9\/\-_.]+)/i);
  if (noFakturMatch) {
    header.noFaktur = noFakturMatch[1].trim();
  }

  // Extract Kode & No Seri Faktur Pajak e.g. "040.003.26.71371769"
  const seriPajakMatch = text.match(/(?:kode\s*(?:dan\s*)?nomor\s*seri\s*faktur\s*pajak|faktur\s*pajak)\s*[:#]?\s*([0-9.]+)/i);
  if (seriPajakMatch) {
    header.noSeriPajak = seriPajakMatch[1].trim();
  }

  // Extract No Ref / No SP e.g. "A472609M1000362"
  const refSpMatch = text.match(/(?:no\.?\s*ref\s*\/?\s*no\.?\s*sp|no\.?\s*sp)\s*[:#]?\s*([A-Za-z0-9\-_.]+)/i);
  if (refSpMatch) {
    header.noRefSP = refSpMatch[1].trim();
  }

  // Extract No Pesanan e.g. "4979931"
  const pesananMatch = text.match(/(?:no\.?\s*pesanan|pesanan\s*no\.?)\s*[:#]?\s*([A-Za-z0-9\-_.]+)/i);
  if (pesananMatch) {
    header.noPesanan = pesananMatch[1].trim();
  }

  // Extract Tanggal SP e.g. "2026-09-07 11:02:38"
  const tglSpMatch = text.match(/(?:tanggal\s*sp)\s*[:#]?\s*([0-9\-:\s]+)/i);
  if (tglSpMatch) {
    header.tanggalSP = tglSpMatch[1].trim();
  }

  // Extract Payment Type e.g. "BANK BCA (Virtual Account)"
  const payTypeMatch = text.match(/(?:\*?\s*payment\s*type)\s*[:#]?\s*([A-Za-z0-9\s()_\-]+)/i);
  if (payTypeMatch) {
    header.paymentType = payTypeMatch[1].trim();
  }

  // Extract Cash Diskon % e.g. "Cash Diskon 2%"
  const cashDiscMatch = text.match(/cash\s*diskon\s*(\d+(?:[.,]\d+)?)\s*%/i);
  if (cashDiscMatch) {
    header.cashDiskonPersen = parseIdrNumber(cashDiscMatch[1]);
  } else {
    header.cashDiskonPersen = 2; // Default 2%
  }

  // Extract PBF Name
  if (/CENTURY\s*FRANCHISINDO/i.test(text)) {
    header.namaPBF = 'PT. CENTURY FRANCHISINDO UTAMA';
  } else {
    const pbfMatch = text.match(/(?:PT\.?|PBF|CV\.?)\s+([A-Za-z0-9\s&.,]+?)(?:\r?\n|$|,|;|\t)/i);
    if (pbfMatch) {
      header.namaPBF = pbfMatch[0].trim();
    } else {
      // Look for common PBF keywords
      const commonPbf = text.match(/(Century|Enseval|Kimia Farma|APL|Anugrah Argon|Mensa|Parit Padang|Tempo Scan|Penta Valent|Antar Mitra|Dos Ni Roha|Bina San Prima)/i);
      if (commonPbf) {
        header.namaPBF = `PT ${commonPbf[1]}`;
      }
    }
  }

  // Extract Tanggal Faktur
  const tglMatch = text.match(/(?:tgl|tanggal|date)\s*[:#]?\s*(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}|\d{4}[-/.]\d{1,2}[-/.]\d{1,2})/i);
  if (tglMatch) {
    const rawTgl = tglMatch[1].replace(/[-.]/g, '/');
    const norm = normalizeExpiryDate(rawTgl);
    header.tanggalFaktur = norm.formatted || rawTgl;
  } else if (header.tanggalSP) {
    // If Tanggal SP found e.g. "2026-09-07"
    const spDateMatch = header.tanggalSP.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (spDateMatch) {
      header.tanggalFaktur = `${spDateMatch[3]}/${spDateMatch[2]}/${spDateMatch[1]}`;
    }
  } else {
    // Current date as fallback
    const now = new Date();
    const d = now.getDate().toString().padStart(2, '0');
    const m = (now.getMonth() + 1).toString().padStart(2, '0');
    header.tanggalFaktur = `${d}/${m}/${now.getFullYear()}`;
  }

  return header;
}

/**
 * Native parser for Century Franchisindo Utama invoice lines:
 * e.g. "1 PRIMOLUT N TAB 30`S 0102537 WE18MT 2030-08 BOX 2 (dua) 0 (nol) 0 161,213 322,426"
 * or "2 NEBACETIN OINT 5GR 0102055 D6F927B 2028-06 TUBE 5 (lima) 0 (nol) 12.5 24,150 120,750"
 */
export function parseCenturyLine(line: string, rowNum: number): FakturItem | null {
  // Regex that captures Century's columns:
  // 1: No
  // 2: Nama Barang
  // 3: Kd. Brg (6-8 digits)
  // 4: Batch (letters/numbers/hyphen)
  // 5: Exp Date (YYYY-MM or YYYY-MM-DD)
  // 6: Satuan (BOX, BOTOL, TUBE, PACK, STRIP, etc.)
  // 7: Qty (number + optional terbilang)
  // 8: Qty Bns (number + optional terbilang)
  // 9: Disc (% number)
  // 10: Hrg / Sat
  // 11: Jumlah
  const pattern = /^(\d+)\s+(.+?)\s+(\d{6,8})\s+([A-Za-z0-9\-_]+)\s+(\d{4}[-/.]\d{1,2}(?:[-/.]\d{1,2})?|\d{1,2}[-/.]\d{2,4})\s+([A-Za-z]{2,10})\s+(\d+)(?:\s*\([^)]*\))?\s+(\d+)(?:\s*\([^)]*\))?\s+(\d+(?:[.,]\d+)?)\s+([\d.,]+)\s+([\d.,]+)/i;
  const match = line.match(pattern);
  if (!match) return null;

  const urutan = parseInt(match[1], 10) || rowNum;
  const namaObat = match[2].replace(/[`'"]/g, "'").trim();
  const kodeBarang = match[3].trim();
  const noBatch = match[4].trim();
  const rawExp = match[5].trim();
  const normExp = normalizeExpiryDate(rawExp);
  const tanggalExp = normExp.formatted || rawExp;
  const satuan = match[6].trim().toUpperCase();
  const jumlah = parseInt(match[7], 10) || 0;
  const qtyBonus = parseInt(match[8], 10) || 0;
  const diskonPersen = parseIdrNumber(match[9]);
  const hargaBeli = parseIdrNumber(match[10]);
  const subtotalBruto = parseIdrNumber(match[11]) || (jumlah * hargaBeli);

  return calculateItemRow(
    {
      urutan,
      namaObat,
      kodeBarang,
      noBatch,
      tanggalExp,
      satuan,
      jumlah,
      qtyBonus,
      diskonPersen,
      hargaBeli,
      subtotalBruto,
    },
    'percentages'
  );
}

/**
 * Regex-based line/row extractor for PBF Invoices.
 * Handles the rule:
 * "Jika ada huruf semisal E, dan sebagainya dan bukan D karena D adalah persentase diskon, masukkan itu sebagai di nominal diskon"
 * "Jika hanya tercantum bulan, otomatis cantumkan tanggal hari pertama semisal 12/29 menjadi 01/12/2029"
 */
export function parsePbfInvoiceText(rawText: string): ParseResult {
  const header = extractInvoiceHeader(rawText);
  const items: FakturItem[] = [];

  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // Skip known header or metadata lines
  const isHeaderNoise = (line: string) => {
    return (
      /^(no|nomor|urutan)\s+(nama|item|produk|obat)/i.test(line) ||
      /^pt\b/i.test(line) ||
      /^jl\b|^jalan\b/i.test(line) ||
      /^faktur\s*penjualan/i.test(line) ||
      /^subtotal|^total\s*tagihan|^terbilang/i.test(line) ||
      /^keterangan|^catatan|^syarat/i.test(line) ||
      /^halaman\s+\d+/i.test(line)
    );
  };

  let rowCounter = 1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isHeaderNoise(line)) continue;

    // Pattern 0: Specific Century Franchisindo Utama format:
    // e.g. "1 PRIMOLUT N TAB 30`S 0102537 WE18MT 2030-08 BOX 2 (dua) 0 (nol) 0 161,213 322,426"
    const centuryItem = parseCenturyLine(line, rowCounter);
    if (centuryItem) {
      items.push(centuryItem);
      rowCounter++;
      continue;
    }

    // Pattern A: Pipe/Tab separated row
    // e.g. "1 | AMOXICILLIN 500MG | 10 BOX | 45.000 | D: 5% | D2: 2% | E: 0 | EXP: 12/29 | BATCH: BTH998 | 418.950"
    if (line.includes('|') || line.includes('\t')) {
      const parts = (line.includes('|') ? line.split('|') : line.split('\t'))
        .map((p) => p.trim())
        .filter((p) => p.length > 0);

      if (parts.length >= 3) {
        const parsed = parseSegmentedLine(parts, rowCounter);
        if (parsed) {
          items.push(parsed);
          rowCounter++;
          continue;
        }
      }
    }

    // Pattern B: Multi-token line matching
    // Extract items using regex capture
    const parsedLine = parseSingleLineWithRegex(line, rowCounter);
    if (parsedLine) {
      items.push(parsedLine);
      rowCounter++;
      continue;
    }

    // Pattern C: Lookahead multi-line structure
    // Line 1: Nama obat
    // Line 2: Qty 10 @ 45.000 D: 5% EXP: 12/29 BATCH: B123
    if (i + 1 < lines.length && !isHeaderNoise(lines[i + 1])) {
      const combined = `${line} ${lines[i + 1]}`;
      const multiParsed = parseSingleLineWithRegex(combined, rowCounter);
      if (multiParsed && multiParsed.hargaBeli > 0) {
        items.push(multiParsed);
        rowCounter++;
        i++; // skip next line since consumed
        continue;
      }
    }
  }

  return {
    header,
    items,
    rawLineCount: lines.length,
    extractedCount: items.length,
  };
}

/**
 * Parse an array of columns (from pipe or tab separated lines)
 */
function parseSegmentedLine(parts: string[], rowNum: number): FakturItem | null {
  let namaObat = '';
  let jumlah = 0;
  let hargaBeli = 0;
  let diskonPersen = 0;
  let diskonBertingkatPersen = 0;
  let nominalDiskon = 0;
  let tanggalExp = '';
  let noBatch = '';
  let rawDiscountCode = '';

  for (let idx = 0; idx < parts.length; idx++) {
    const part = parts[idx];

    // Check for Expiry date
    const expMatch = part.match(/(?:exp|ed|kadaluarsa|expired)?\s*[:#]?\s*(\d{1,2}[\/\-.]\d{2,4})/i);
    if (expMatch && !tanggalExp) {
      const norm = normalizeExpiryDate(expMatch[1]);
      tanggalExp = norm.formatted;
      continue;
    }

    // Check for Batch
    const batchMatch = part.match(/(?:batch|lot|bth|no\.?\s*batch)\s*[:#]?\s*([A-Za-z0-9\-_]+)/i);
    if (batchMatch && !noBatch) {
      noBatch = batchMatch[1];
      continue;
    }

    // Check for Diskon rule:
    // "Jika ada huruf semisal E, dan sebagainya dan bukan D karena D adalah persentase diskon, masukkan itu sebagai di nominal diskon"
    // D or D1 = Diskon %
    const discDMatch = part.match(/(?:^|\b)(?:d|d1|disc|diskon)\s*[:#]?\s*(\d+(?:[.,]\d+)?)\s*%/i);
    if (discDMatch) {
      diskonPersen = parseIdrNumber(discDMatch[1]);
      rawDiscountCode += ` D:${diskonPersen}%`;
      continue;
    }

    // D2 / Diskon bertingkat = Diskon 2 %
    const discD2Match = part.match(/(?:^|\b)(?:d2|disc\s*2|bert)\s*[:#]?\s*(\d+(?:[.,]\d+)?)\s*%/i);
    if (discD2Match) {
      diskonBertingkatPersen = parseIdrNumber(discD2Match[1]);
      rawDiscountCode += ` D2:${diskonBertingkatPersen}%`;
      continue;
    }

    // Non-D letter code e.g. E, EXT, EXTRA, CASH, POT, NOMINAL, etc. -> Nominal Diskon!
    const discNonDMatch = part.match(/(?:^|\b)([A-CE-Za-ce-z]{1,4}|nom|pot|cash|extra)\s*[:#]?\s*(?:rp\.?\s*)?(\d{1,3}(?:[.]\d{3})*|\d+)/i);
    if (discNonDMatch && !discNonDMatch[0].includes('%')) {
      const codeLetter = discNonDMatch[1].toUpperCase();
      const nomValue = parseIdrNumber(discNonDMatch[2]);
      if (nomValue > 0) {
        nominalDiskon = nomValue;
        rawDiscountCode += ` ${codeLetter}:Rp${nomValue.toLocaleString('id-ID')}`;
        continue;
      }
    }

    // Check Qty e.g. "10 BOX" or "50"
    const qtyMatch = part.match(/^(\d+)\s*(?:box|btl|botol|strip|tab|tablet|tube|amp|vial|sach|fls|pcs)?$/i);
    if (qtyMatch && jumlah === 0) {
      jumlah = parseInt(qtyMatch[1], 10);
      continue;
    }

    // Check Price
    const priceCandidate = parseIdrNumber(part);
    if (priceCandidate > 0 && hargaBeli === 0 && jumlah > 0) {
      hargaBeli = priceCandidate;
      continue;
    }

    // Assign to nama obat if still empty and has alphabetic text
    if (!namaObat && /[A-Za-z]{3,}/.test(part) && !/^(no|urutan|\d+)$/i.test(part)) {
      namaObat = part.replace(/^\d+[\s.-]+/, '').trim();
    }
  }

  // Fallback positional assignment if standard columns
  if (!namaObat && parts.length >= 2) {
    namaObat = parts[0].replace(/^\d+[\s.-]+/, '').trim();
  }

  if (!namaObat) return null;

  return calculateItemRow(
    {
      urutan: rowNum,
      namaObat,
      jumlah: jumlah || 1,
      hargaBeli: hargaBeli || 0,
      diskonPersen,
      diskonBertingkatPersen,
      nominalDiskon,
      tanggalExp,
      noBatch,
      rawDiscountCode: rawDiscountCode.trim(),
    },
    nominalDiskon > 0 && diskonPersen === 0 ? 'nominal' : 'percentages'
  );
}

/**
 * Regex parser for single unstructured line of invoice item
 */
function parseSingleLineWithRegex(line: string, rowNum: number): FakturItem | null {
  // Check if line contains at least drug name keywords or numbers
  if (!/[A-Za-z]{2,}/.test(line)) return null;

  let namaObat = '';
  let jumlah = 0;
  let hargaBeli = 0;
  let diskonPersen = 0;
  let diskonBertingkatPersen = 0;
  let nominalDiskon = 0;
  let tanggalExp = '';
  let noBatch = '';
  let rawDiscountCode = '';

  let workingLine = line;

  // 1. Extract Expiry Date (e.g. EXP: 12/29, ED: 05/2028, or standalone 12/29)
  const expMatch = workingLine.match(/(?:exp(?:ired)?|ed|kadaluarsa)?\s*[:#]?\s*(\b\d{1,2}[\/\-.]\d{2,4}\b)/i);
  if (expMatch) {
    const rawExp = expMatch[1];
    const norm = normalizeExpiryDate(rawExp);
    tanggalExp = norm.formatted;
    workingLine = workingLine.replace(expMatch[0], ' ');
  }

  // 2. Extract Batch No (e.g. BTH-9982, LOT: B881, BATCH: 24A91)
  const batchMatch = workingLine.match(/(?:bth|batch|lot|no\.?\s*batch)\s*[:#]?\s*([A-Za-z0-9\-_]{3,20})/i);
  if (batchMatch) {
    noBatch = batchMatch[1].trim();
    workingLine = workingLine.replace(batchMatch[0], ' ');
  }

  // 3. Extract Diskon Bertingkat (e.g. D2: 2.5% or + 2%)
  const d2Match = workingLine.match(/(?:d2|disc\s*2|\+\s*)[:#]?\s*(\d+(?:[.,]\d+)?)\s*%/i);
  if (d2Match) {
    diskonBertingkatPersen = parseIdrNumber(d2Match[1]);
    rawDiscountCode += ` D2:${diskonBertingkatPersen}%`;
    workingLine = workingLine.replace(d2Match[0], ' ');
  }

  // 4. Extract Diskon Utama 'D' (%)
  // "D adalah persentase diskon"
  const dMatch = workingLine.match(/(?:d|d1|disc(?:ount)?|diskon)\s*[:#]?\s*(\d+(?:[.,]\d+)?)\s*%/i);
  if (dMatch) {
    diskonPersen = parseIdrNumber(dMatch[1]);
    rawDiscountCode += ` D:${diskonPersen}%`;
    workingLine = workingLine.replace(dMatch[0], ' ');
  } else {
    // Check if there is percentage % without prefix D
    const genericPercentMatch = workingLine.match(/(\d+(?:[.,]\d+)?)\s*%/);
    if (genericPercentMatch) {
      diskonPersen = parseIdrNumber(genericPercentMatch[1]);
      rawDiscountCode += ` D:${diskonPersen}%`;
      workingLine = workingLine.replace(genericPercentMatch[0], ' ');
    }
  }

  // 5. Extract Non-D letter code (e.g. 'E', 'EXT', 'CASH')
  // "Jika ada huruf semisal E, dan sebagainya dan bukan D karena D adalah persentase diskon, masukkan itu sebagai di nominal diskon"
  const nonDMatch = workingLine.match(/(?:\b|\s)([A-CE-Za-ce-z]{1,4})\s*[:#]?\s*(?:rp\.?\s*)?(\d{1,3}(?:[.]\d{3})+|\d{4,})/i);
  if (nonDMatch) {
    const codeLetter = nonDMatch[1].toUpperCase();
    // make sure it's not a unit like BOX, BTL, TAB
    const isUnit = /^(BOX|BTL|TAB|STR|TBE|AMP|PCS|FLS)$/i.test(codeLetter);
    if (!isUnit) {
      const val = parseIdrNumber(nonDMatch[2]);
      if (val > 0) {
        nominalDiskon = val;
        rawDiscountCode += ` ${codeLetter}:Rp${val.toLocaleString('id-ID')}`;
        workingLine = workingLine.replace(nonDMatch[0], ' ');
      }
    }
  }

  // 6. Extract Qty (Jumlah) + optional unit
  const qtyMatch = workingLine.match(/(?:qty|jumlah)?\s*[:#]?\s*(\d+)\s*(box|btl|botol|strip|tab|tablet|tube|amp|vial|sach|fls|pcs)?\b/i);
  if (qtyMatch) {
    jumlah = parseInt(qtyMatch[1], 10);
    workingLine = workingLine.replace(qtyMatch[0], ' ');
  }

  // 7. Extract Harga Beli (Unit price) & Total line price
  // Look for numbers like 45.000 or @ 45000 or 125.000,00
  const numberTokens = workingLine.match(/(?:@\s*)?(?:rp\.?\s*)?(\d{1,3}(?:[.]\d{3})+(?:,\d{2})?|\d{3,})/gi);
  if (numberTokens) {
    const numbers = numberTokens.map((n) => parseIdrNumber(n)).filter((n) => n > 0);
    if (numbers.length >= 1) {
      // Typically unit price is smaller than line total if qty > 1
      if (numbers.length >= 2 && jumlah > 1) {
        // One is likely unit price, other is line total
        const sorted = [...numbers].sort((a, b) => a - b);
        hargaBeli = sorted[0];
      } else {
        hargaBeli = numbers[0];
      }
      // Remove the matched price tokens from workingLine
      for (const token of numberTokens) {
        workingLine = workingLine.replace(token, ' ');
      }
    }
  }

  // 8. The remaining text is predominantly Nama Obat
  namaObat = workingLine
    .replace(/^\d+[\s.-]+/, '') // remove leading row number
    .replace(/[|@;:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // If no drug name found or only numbers, reject
  if (!namaObat || namaObat.length < 2 || /^\d+$/.test(namaObat)) {
    return null;
  }

  return calculateItemRow(
    {
      urutan: rowNum,
      namaObat,
      jumlah: jumlah || 1,
      hargaBeli: hargaBeli || 0,
      diskonPersen,
      diskonBertingkatPersen,
      nominalDiskon,
      tanggalExp,
      noBatch,
      rawDiscountCode: rawDiscountCode.trim(),
    },
    nominalDiskon > 0 && diskonPersen === 0 ? 'nominal' : 'percentages'
  );
}

/**
 * Pre-configured realistic PBF invoice test samples for Apotek
 */
export const SAMPLE_PBF_INVOICES = [
  {
    name: 'PT Century Franchisindo Utama (Faktur Asli Gambar 1)',
    pbf: 'PT. CENTURY FRANCHISINDO UTAMA',
    noFaktur: 'A47260900411',
    text: `FAKTUR PENJUALAN
Kode dan Nomor Seri Faktur Pajak : 040.003.26.71371769
PENGUSAHA KENA PAJAK
Nama : PT. CENTURY FRANCHISINDO UTAMA
Alamat : GEDUNG GRAND ITC PERMATA HIJAU KANTOR EMERALD
JL LETJEN SOEPENO ARTERI PERMATA HIJAU BLOK E NO 26
GROGOL UTARA KEBAYORAN LAMA JAKARTA SELATAN DKI JAKARTA 12210
N.P.W.P : 01.640.177.0-013.000

PEMBELIAN BARANG KENA PAJAK/PENERIMA JASA PAJAK
Nama : JANES ANDIK WIDJAJANTO
Alamat : TAMAN KENARI NUSANTAR BLOK PN.5 NO.22, GUNUNG PUTRI , RT000/RW000, WANAHERANG, GUNUNG PUTRI, KAB. BOGOR, JAWA BARAT, 16965
N.P.W.P : 3201020810710005

No Nama Barang (Kd. Brg) Batch Exp Date Satuan Qty Qty Bns Disc Hrg / Sat Jumlah
1 PRIMOLUT N TAB 30\`S 0102537 WE18MT 2030-08 BOX 2 (dua) 0 (nol) 0 161,213 322,426
2 INSTO REGULAR 7,5 ML 0201128 2649013 2030-04 BOTOL 12 (dua belas) 0 (nol) 0 12,507 150,086
3 ROHTO COOL 7 ML 0201578 RCRF035A 2029-03 BOTOL 12 (dua belas) 0 (nol) 0 14,283 171,398

SubTotal : 643,910.21
Diskon : 0.00
Cash Diskon 2% : 12,878.20
SubTotal Setelah Diskon : 631,032.01
Dasar Pengenaan Pajak : 578,446.01
PPN : 69,413.52
TOTAL : 700,446

No. Faktur : A47260900411
No. Ref / No SP : A472609M1000362
No. Pesanan : 4979931
Tanggal SP : 2026-09-07 11:02:38
* Payment Type : BANK BCA (Virtual Account)`,
  },
  {
    name: 'PT Century Franchisindo Utama (Faktur Asli Gambar 2 - 7 Item)',
    pbf: 'PT. CENTURY FRANCHISINDO UTAMA',
    noFaktur: 'A47260900423',
    text: `FAKTUR PENJUALAN
Kode dan Nomor Seri Faktur Pajak : 040.003.26.71371770
PENGUSAHA KENA PAJAK : PT. CENTURY FRANCHISINDO UTAMA

No Nama Barang (Kd. Brg) Batch Exp Date Satuan Qty Qty Bns Disc Hrg / Sat Jumlah
1 AMOXSAN 125MG DS 60ML 0100139 GB6125 2028-02 BOTOL 2 (dua) 0 (nol) 0 22,576 45,152
2 NEBACETIN OINT 5GR 0102055 D6F927B 2028-06 TUBE 5 (lima) 0 (nol) 12.5 24,150 120,750
3 OXOFERIN 0.001% SOL 30 ML 0102315 D6E766B 2028-05 BOTOL 2 (dua) 0 (nol) 7.5 88,550 177,100
4 SANMOL PARACETAMOL SIROP 60ML 0202935 GC9818 2028-03 BOTOL 24 (dua puluh empat) 0 (nol) 0 16,788 402,910
5 SANMOL 500MG 25CATCHCOVER@4\`S 0203536 GF8225 2028-06 BOX 2 (dua) 0 (nol) 0 48,969 97,938
6 FOLAVIT 400MG 10 STRIPS @10\`S 0304534 GD8052 2028-04 BOX 1 (satu) 0 (nol) 0 107,051 107,051
7 STREPSIL REG. CARTON PACK 2X6\` 0900306 ABH5207 2028-10 PACK 3 (tiga) 0 (nol) 0 20,385 61,154

SubTotal : 1,012,055.26
Diskon : 28,376.25
Cash Diskon 2% : 19,673.58
SubTotal Setelah Diskon : 964,005.43
Dasar Pengenaan Pajak : 883,671.64
PPN : 106,040.60
TOTAL : 1,070,046

No. Faktur : A47260900423
No. Ref / No SP : A472609M1000363
Tanggal SP : 2026-09-07 11:15:00
* Payment Type : BANK BCA (Virtual Account)`,
  },
  {
    name: 'PT Enseval Putera Megatrading (Lengkap + Diskon Bertingkat & E)',
    pbf: 'PT Enseval Putera Megatrading Tbk',
    noFaktur: 'FP-ENS/2026/0891',
    text: `PT ENSEVAL PUTERA MEGATRADING TBK
FAKTUR PENJUALAN
No. Faktur: FP-ENS/2026/0891   Tanggal: 11/09/2026
Kepada: APOTEK SEHAT SEJAHTERA

No | Nama Obat & Kemasan | Qty | Harga Satuan | Disc (%) | Disc Bertingkat | Disc E (Nominal) | Exp Date | No. Batch | Total
1 | AMOXICILLIN 500MG BOX 100 TAB | 10 BOX | 48.000 | D: 5% | D2: 2% | E: 0 | 12/29 | BTH-8812A | 446.880
2 | PARACETAMOL 500MG STRIP | 30 STR | 14.500 | D: 3% | 0% | E: 5000 | 08/2028 | PCT-9912 | 416.950
3 | CEFIXIME 100MG KAPSUL | 5 BOX | 135.000 | 0% | 0% | E: 25000 | 05/27 | CFX-202 | 650.000
4 | METFORMIN 500MG TAB | 20 BOX | 24.000 | D: 6% | D2: 1.5% | 0 | 03/2029 | MTF-334 | 444.432
5 | ANTASIDA DOEN SUSPENSI 60ML | 25 BTL | 9.800 | D: 10% | 0% | E: 4500 | 11/26 | ATD-119 | 216.000
6 | AMLODIPINE 10MG TAB | 15 BOX | 18.000 | D: 4% | D2: 2% | 0 | 01/12/2029 | AML-551 | 253.944`,
  },
  {
    name: 'PT Kimia Farma Trading & Distribution (Format Plain Text)',
    pbf: 'PT Kimia Farma Trading & Distribution',
    noFaktur: 'KF-INV/88219',
    text: `PT KIMIA FARMA TRADING & DISTRIBUTION
Cabang Farmasi Utama
FAKTUR NO: KF-INV/88219
Tgl: 10/09/2026

1. ASAM MEFENAMAT 500MG
   15 BOX @ 32.500 D: 5% EXP: 09/28 BATCH: AMF881

2. CIPROFLOXACIN 500MG TAB
   8 BOX @ 58.000 D: 7.5% E: 12000 EXP: 12/29 BATCH: CPR442

3. CETIRIZINE 10MG TAB
   20 STRIP @ 12.000 D: 3% D2: 2% EXP: 04/27 BATCH: CTZ901

4. DEXTROMETHORPHAN SYR 60ML
   12 BTL @ 16.500 D: 5% EXP: 07/2029 BATCH: DXT109`,
  },
  {
    name: 'PT Anugrah Argon Medica (AAM - Format Singkat)',
    pbf: 'PT Anugrah Argon Medica',
    noFaktur: 'AAM-2026-9921',
    text: `AAM PHARMA
INV: AAM-2026-9921 TGL: 11/09/2026

NEURALGIN RHEUMA 10 STR @ 28000 D 5% D2 1% 10/28 LOT: NRG22
SANMOL FORTE SYR 20 BTL @ 31500 E 15000 05/29 LOT: SMF88
BODREXIN DEMAM TAB 25 BOX @ 11200 D 4% 12/29 LOT: BDX01
VOLTAREN EMULGEL 20G 5 TUBE @ 65000 D 2.5% E 5000 02/2028 LOT: VLT99`,
  },
];
