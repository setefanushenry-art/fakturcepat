import { FakturHeader, FakturItem, FakturSummary } from '../types';
import { formatRupiah } from './calculations';

/**
 * Exports current items as Excel-compatible CSV with UTF-8 BOM
 */
export function exportFakturToCsv(header: FakturHeader, items: FakturItem[], summary: FakturSummary) {
  const headers = [
    'No',
    'Nama Barang',
    'Qty',
    'Qty Bns',
    'Satuan',
    'Hrg / Sat (Rp)',
    'Disc (%)',
    'Diskon Bertingkat (%)',
    'Nominal Diskon (Rp)',
    'Jumlah (Rp)',
    'Total Net (Rp)',
    'HPP (Rp)',
    'Exp Date',
    'Batch',
    'Kd. Brg',
  ];

  const rows = items.map((item) => [
    item.urutan,
    `"${item.namaObat.replace(/"/g, '""')}"`,
    item.jumlah,
    item.qtyBonus || 0,
    `"${item.satuan || 'BOX'}"`,
    item.hargaBeli,
    item.diskonPersen,
    item.diskonBertingkatPersen || 0,
    item.nominalDiskon,
    item.subtotalBruto || (item.jumlah * item.hargaBeli),
    item.total,
    item.hpp,
    `"${item.tanggalExp || '-'}"`,
    `"${item.noBatch || '-'}"`,
    `"${item.kodeBarang || '-'}"`,
  ]);

  // Add Summary Rows
  rows.push([]);
  rows.push(['INFORMASI FAKTUR PBF']);
  rows.push(['No. Faktur', `"${header.noFaktur || '-'}"`]);
  rows.push(['Nama Distributor/PBF', `"${header.namaPBF || '-'}"`]);
  rows.push(['Tanggal Faktur', `"${header.tanggalFaktur || '-'}"`]);
  if (header.noSeriPajak) rows.push(['No. Seri Pajak', `"${header.noSeriPajak}"`]);
  if (header.noRefSP) rows.push(['No. Ref SP', `"${header.noRefSP}"`]);
  if (header.paymentType) rows.push(['Tipe Pembayaran', `"${header.paymentType}"`]);
  if (summary.cashDiskonNominal) rows.push(['Cash Diskon', summary.cashDiskonNominal]);
  rows.push([]);
  rows.push(['RINGKASAN & PAJAK']);
  rows.push(['Total Item', summary.totalItem]);
  rows.push(['Total Qty', summary.totalQty]);
  rows.push(['Subtotal Bruto', summary.subtotalBruto]);
  rows.push(['Total Diskon', summary.totalDiskonNominal]);
  rows.push(['Total Net Baris', summary.totalNetBaris ?? (summary.subtotalBruto - summary.totalDiskonNominal)]);
  if (summary.dpp) rows.push(['DPP (11/12)', summary.dpp]);
  if (summary.ppnNominal) rows.push(['PPN (12%)', summary.ppnNominal]);
  rows.push(['Grand Total Net', summary.grandTotal]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const safeFilename = (header.noFaktur || 'Rekap_Faktur_PBF').replace(/[^a-zA-Z0-9_-]/g, '_');
  link.setAttribute('href', url);
  link.setAttribute('download', `${safeFilename}_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Formats rekap for WhatsApp or text message sharing
 */
export function generateWhatsAppSummary(
  header: FakturHeader,
  items: FakturItem[],
  summary: FakturSummary
): string {
  const lines: string[] = [];
  lines.push(`📋 *REKAP PEMBELIAN FAKTUR PBF*`);
  lines.push(`━━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`📄 *No. Faktur:* ${header.noFaktur || '-'}`);
  lines.push(`🏢 *PBF:* ${header.namaPBF || '-'}`);
  lines.push(`📅 *Tanggal:* ${header.tanggalFaktur || '-'}`);
  if (header.noSeriPajak) lines.push(`📑 *No. Seri Pajak:* ${header.noSeriPajak}`);
  if (header.noRefSP) lines.push(`📌 *Ref SP:* ${header.noRefSP}`);
  lines.push(`━━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`*DAFTAR BARANG (SESUAI FAKTUR):*`);

  items.forEach((item) => {
    let discText = `${item.diskonPersen}%`;
    if (item.diskonBertingkatPersen > 0) discText += ` + ${item.diskonBertingkatPersen}%`;

    lines.push(
      `${item.urutan}. *${item.namaObat}* ${item.kodeBarang ? `(${item.kodeBarang})` : ''}\n` +
      `   • Batch: ${item.noBatch || '-'} | Exp: ${item.tanggalExp} | Sat: ${item.satuan || 'BOX'}\n` +
      `   • Qty: ${item.jumlah} ${item.qtyBonus ? `(+ Bns ${item.qtyBonus})` : ''} | Hrg/Sat: ${formatRupiah(item.hargaBeli)}\n` +
      `   • Disc: ${discText} | HPP/Sat: ${formatRupiah(item.hpp)}\n` +
      `   • Jumlah (Bruto): ${formatRupiah(item.subtotalBruto || (item.jumlah * item.hargaBeli))} | Total (Net): *${formatRupiah(item.total)}*`
    );
  });

  lines.push(`━━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`📊 *RINGKASAN AKHIR:*`);
  lines.push(`• Total Jenis Barang: ${summary.totalItem} item`);
  lines.push(`• Total Kuantitas: ${summary.totalQty} unit`);
  lines.push(`• Subtotal Bruto: ${formatRupiah(summary.subtotalBruto)}`);
  lines.push(`• Total Diskon: ${formatRupiah(summary.totalDiskonNominal)} (Rata-rata: ${summary.avgDiskonPersen}%)`);
  lines.push(`• Total Net Baris: ${formatRupiah(summary.totalNetBaris ?? (summary.subtotalBruto - summary.totalDiskonNominal))}`);
  if (summary.dpp && summary.ppnNominal) {
    lines.push(`• DPP (11/12): ${formatRupiah(summary.dpp)}`);
    lines.push(`• PPN (12%): ${formatRupiah(summary.ppnNominal)}`);
  }
  lines.push(`• *GRAND TOTAL: ${formatRupiah(summary.grandTotal)}*`);
  lines.push(`━━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`_Direkap via Sistem Rekap Faktur PBF Farmasi_`);

  return lines.join('\n');
}
