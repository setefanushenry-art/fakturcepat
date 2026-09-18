export interface FakturItem {
  id: string;
  urutan: number;
  namaObat: string;
  kodeBarang?: string; // (Kd. Brg) e.g. "0102537"
  noBatch: string; // Batch e.g. "WE18MT"
  tanggalExp: string; // Exp Date e.g. "2030-08" atau "01/08/2030"
  satuan?: string; // Satuan e.g. "BOX", "BOTOL", "TUBE", "PACK"
  jumlah: number; // Qty e.g. 2, 12, 5
  qtyBonus?: number; // Qty Bns e.g. 0
  diskonPersen: number; // Disc (%) e.g. 0, 12.5, 7.5
  diskonBertingkatPersen: number; // Diskon Bertingkat (%) / Cash Diskon
  nominalDiskon: number; // Total Nominal Diskon (Rp)
  hargaBeli: number; // Hrg / Sat e.g. 161213
  subtotalBruto: number; // Jumlah = Qty * Hrg/Sat e.g. 322426
  hpp: number; // Harga Pokok Penjualan / net unit price (Rp)
  total: number; // Total bayar baris / Line Total net (Rp)
  validationErrors: ValidationErrorItem[];
  isValid: boolean;
  rawDiscountCode?: string; // Info jika ada kode D, E, dsb dari faktur
  discountMode?: 'percentages' | 'nominal'; // Tracks whether discount was last set by percentage or nominal
}

export interface ValidationErrorItem {
  field:
    | 'namaObat'
    | 'kodeBarang'
    | 'noBatch'
    | 'tanggalExp'
    | 'satuan'
    | 'jumlah'
    | 'qtyBonus'
    | 'hargaBeli'
    | 'diskonPersen'
    | 'diskonBertingkatPersen'
    | 'nominalDiskon';
  message: string;
  suggestedValue?: any;
}

export interface FakturHeader {
  id: string;
  noFaktur: string;
  namaPBF: string;
  tanggalFaktur: string;
  jatuhTempo?: string;
  catatan?: string;
  // Metadata khusus Faktur Century / PBF
  noSeriPajak?: string; // Kode dan Nomor Seri Faktur Pajak
  noRefSP?: string; // No. Ref / No SP
  noPesanan?: string; // No. Pesanan
  tanggalSP?: string; // Tanggal SP
  paymentType?: string; // * Payment Type (e.g. BANK BCA Virtual Account)
  cashDiskonPersen?: number; // Cash Diskon (default 2%)
  ppnPersen?: number; // PPN (default 12%)
}

export interface FakturSummary {
  totalItem: number;
  totalQty: number;
  totalQtyBonus: number;
  subtotalBruto: number; // SubTotal (Sum of Jumlah)
  totalDiskonNominal: number; // Diskon barang
  totalNetBaris: number; // Total net cost of all line items (Sum of item.total)
  cashDiskonNominal: number; // Cash Diskon (2%)
  subtotalSetelahDiskon: number; // SubTotal Setelah Diskon
  dpp: number; // Dasar Pengenaan Pajak
  ppnNominal: number; // PPN
  grandTotal: number; // TOTAL Tagihan
  avgDiskonPersen: number;
  itemWithErrorsCount: number;
}

export interface FakturRekapRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  header: FakturHeader;
  items: FakturItem[];
  summary: FakturSummary;
  rawTextSource?: string;
}

export type DiscountSyncSource = 'percentages' | 'nominal' | 'auto';
