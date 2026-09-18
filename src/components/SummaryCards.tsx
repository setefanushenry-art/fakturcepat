import React from 'react';
import { FakturSummary, FakturItem, FakturHeader } from '../types';
import { formatRupiah } from '../utils/calculations';
import {
  Download,
  Share2,
  Printer,
  Trash2,
  Wand2,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Coins,
  Package,
} from 'lucide-react';

interface SummaryCardsProps {
  summary: FakturSummary;
  header: FakturHeader;
  items: FakturItem[];
  onAutoFixAll: () => void;
  onClearAll: () => void;
  onExportCsv: () => void;
  onCopyFormattedText: () => void;
  onPrint: () => void;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({
  summary,
  header,
  items,
  onAutoFixAll,
  onClearAll,
  onExportCsv,
  onCopyFormattedText,
  onPrint,
}) => {
  return (
    <div className="space-y-4">
      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Total Item & Qty */}
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs">
          <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
            <Package className="w-3.5 h-3.5 text-slate-400" />
            <span>Total Item & Qty</span>
          </div>
          <div className="text-xl font-bold text-slate-800">
            {summary.totalItem} <span className="text-xs font-normal text-slate-500">Item</span>
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            Total Qty: <span className="font-semibold text-slate-700">{summary.totalQty}</span>
            {summary.totalQtyBonus > 0 && (
              <span className="text-blue-600 ml-1 font-medium">(+{summary.totalQtyBonus} bns)</span>
            )}
          </div>
        </div>

        {/* Subtotal Bruto */}
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs">
          <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1">
            Subtotal Bruto
          </div>
          <div className="text-lg font-bold text-slate-800 font-mono">
            {formatRupiah(summary.subtotalBruto)}
          </div>
          <div className="text-xs text-slate-400 mt-0.5">Qty × Harga Satuan</div>
        </div>

        {/* Total Diskon */}
        <div className="bg-white rounded-xl border border-teal-200 bg-teal-50/20 p-3.5 shadow-xs">
          <div className="text-[11px] font-medium text-teal-800 uppercase tracking-wider mb-1 flex items-center gap-1">
            <Coins className="w-3.5 h-3.5 text-teal-600" />
            <span>Total Diskon</span>
          </div>
          <div className="text-lg font-bold text-teal-700 font-mono">
            {formatRupiah(summary.totalDiskonNominal)}
          </div>
          <div className="text-xs text-teal-600/80 mt-0.5">
            Diskon % & Bertingkat ({summary.avgDiskonPersen}%)
          </div>
        </div>

        {/* Total Net Baris (Sum of Line Totals) */}
        <div className="bg-white rounded-xl border border-emerald-200 bg-emerald-50/20 p-3.5 shadow-xs">
          <div className="text-[11px] font-medium text-emerald-800 uppercase tracking-wider mb-1 flex items-center gap-1">
            <span>Total Net Baris</span>
          </div>
          <div className="text-lg font-bold text-emerald-700 font-mono">
            {formatRupiah(summary.totalNetBaris ?? (summary.subtotalBruto - summary.totalDiskonNominal))}
          </div>
          <div className="text-xs text-emerald-600/80 mt-0.5">
            Total biaya semua item
          </div>
        </div>

        {/* Grand Total Net */}
        <div className="bg-slate-900 text-white rounded-xl p-3.5 shadow-xs col-span-2 sm:col-span-1 lg:col-span-1">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-medium text-slate-300 uppercase tracking-wider mb-1">
              Grand Total Rekap
            </div>
            {summary.itemWithErrorsCount > 0 ? (
              <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {summary.itemWithErrorsCount} cek
              </span>
            ) : (
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Valid
              </span>
            )}
          </div>
          <div className="text-xl font-black tracking-tight text-white font-mono mt-0.5">
            {formatRupiah(summary.grandTotal)}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5 truncate">
            {summary.dpp && summary.ppnNominal ? (
              <>DPP: {formatRupiah(summary.dpp)} | PPN 12%</>
            ) : (
              'Netto setelah pajak & cash diskon'
            )}
          </div>
        </div>
      </div>

      {/* Century Specific Header Metadata (If Available) */}
      {(header.noSeriPajak || header.noRefSP || header.paymentType) && (
        <div className="bg-slate-50 rounded-xl border border-slate-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-4 text-slate-600">
            {header.noSeriPajak && (
              <div>
                <span className="text-slate-400 mr-1">No. Seri Pajak:</span>
                <span className="font-mono font-semibold text-slate-800">{header.noSeriPajak}</span>
              </div>
            )}
            {header.noRefSP && (
              <div>
                <span className="text-slate-400 mr-1">No. Ref SP:</span>
                <span className="font-mono font-semibold text-slate-800">{header.noRefSP}</span>
              </div>
            )}
            {header.paymentType && (
              <div>
                <span className="text-slate-400 mr-1">Tipe Pembayaran:</span>
                <span className="font-medium text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">{header.paymentType}</span>
              </div>
            )}
          </div>
          {summary.dpp !== undefined && summary.ppnNominal !== undefined && (
            <div className="text-[11px] text-slate-500 bg-white px-2.5 py-1 rounded-lg border border-slate-200 font-mono">
              Formula Pajak: DPP = Subtotal × 11/12 ({formatRupiah(summary.dpp)}) + PPN 12% ({formatRupiah(summary.ppnNominal)})
            </div>
          )}
        </div>
      )}

      {/* Action Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs flex flex-wrap items-center justify-between gap-2">
        {/* Validation quick-fix banner if any errors */}
        <div className="flex items-center gap-2">
          {summary.itemWithErrorsCount > 0 ? (
            <button
              type="button"
              id="btn-fix-all-errors"
              onClick={onAutoFixAll}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold shadow-xs transition-colors"
            >
              <Wand2 className="w-3.5 h-3.5" />
              <span>Perbaiki {summary.itemWithErrorsCount} Data Otomatis</span>
            </button>
          ) : (
            <span className="text-xs text-emerald-700 font-medium flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Semua format tanggal & diskon valid</span>
            </span>
          )}
        </div>

        {/* Export & Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Export CSV */}
          <button
            type="button"
            id="btn-export-csv"
            onClick={onExportCsv}
            disabled={items.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-medium transition-colors disabled:opacity-50"
            title="Download file CSV untuk Microsoft Excel / Google Sheets"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Export Excel (CSV)</span>
          </button>

          {/* Copy formatted WhatsApp text */}
          <button
            type="button"
            id="btn-copy-wa"
            onClick={onCopyFormattedText}
            disabled={items.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-medium transition-colors disabled:opacity-50"
            title="Salin ringkasan rapi untuk pesan WhatsApp atau catatan"
          >
            <Share2 className="w-3.5 h-3.5 text-blue-600" />
            <span>Salin Ringkasan</span>
          </button>

          {/* Print */}
          <button
            type="button"
            id="btn-print-rekap"
            onClick={onPrint}
            disabled={items.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-medium transition-colors disabled:opacity-50"
            title="Cetak struk rekapitulasi pembelian"
          >
            <Printer className="w-3.5 h-3.5 text-slate-600" />
            <span>Cetak / PDF</span>
          </button>

          {/* Clear All */}
          <button
            type="button"
            id="btn-clear-table"
            onClick={onClearAll}
            disabled={items.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50/70 hover:bg-rose-100 text-rose-700 text-xs font-semibold transition-all disabled:opacity-40 disabled:pointer-events-none cursor-pointer active:scale-95 shadow-xs"
            title="Kosongkan seluruh baris tabel rekap"
          >
            <Trash2 className="w-4 h-4 text-rose-600" />
            <span>Kosongkan Tabel</span>
          </button>
        </div>
      </div>
    </div>
  );
};
