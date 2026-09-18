import React, { useState } from 'react';
import { FakturItem, DiscountSyncSource } from '../types';
import { formatRupiah } from '../utils/calculations';
import { normalizeExpiryDate, isDateExpired } from '../utils/validation';
import { CurrencyInput } from './CurrencyInput';
import { PercentInput } from './PercentInput';
import { QuickEditModal } from './QuickEditModal';
import {
  Trash2,
  Copy,
  AlertCircle,
  CheckCircle2,
  Wand2,
  ArrowRight,
  Plus,
  HelpCircle,
  LayoutGrid,
  Table as TableIcon,
  Pencil,
  Zap,
} from 'lucide-react';

interface FakturTableProps {
  items: FakturItem[];
  onUpdateItem: (index: number, updatedItem: FakturItem, syncSource?: DiscountSyncSource) => void;
  onDeleteItem: (index: number) => void;
  onDuplicateItem: (index: number) => void;
  onAddNewRow: () => void;
  onAutoFixItem: (index: number) => void;
  onClearAll?: () => void;
}

export const FakturTable: React.FC<FakturTableProps> = ({
  items,
  onUpdateItem,
  onDeleteItem,
  onDuplicateItem,
  onAddNewRow,
  onAutoFixItem,
  onClearAll,
}) => {
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [columnPreset, setColumnPreset] = useState<'standard' | 'detailed'>('standard');
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const [quickEditOnClick, setQuickEditOnClick] = useState<boolean>(true);

  // Field change handler that preserves synchronization and re-calculates automatically
  const handleFieldChange = (
    index: number,
    field: keyof FakturItem,
    value: any,
    explicitSyncSource?: DiscountSyncSource
  ) => {
    const currentItem = items[index];
    if (!currentItem) return;

    let syncSource: DiscountSyncSource = explicitSyncSource || 'auto';
    if (!explicitSyncSource) {
      if (field === 'nominalDiskon') {
        syncSource = 'nominal';
      } else if (field === 'diskonPersen' || field === 'diskonBertingkatPersen') {
        syncSource = 'percentages';
      } else if (field === 'hargaBeli' || field === 'jumlah') {
        // Automatic sync source based on whether item was configured by nominal or percentages
        syncSource =
          currentItem.discountMode ||
          (currentItem.nominalDiskon > 0 && currentItem.diskonPersen === 0
            ? 'nominal'
            : 'percentages');
      }
    }

    const updatedRaw = {
      ...currentItem,
      [field]: value,
    };

    onUpdateItem(index, updatedRaw as FakturItem, syncSource);
  };

  // Blur handler for date normalization (e.g. 2030-08 -> 01/08/2030 or 12/29 -> 01/12/2029)
  const handleDateBlur = (index: number, rawVal: string) => {
    if (!rawVal) return;
    const norm = normalizeExpiryDate(rawVal);
    if (norm.isValid && norm.formatted !== rawVal) {
      handleFieldChange(index, 'tanggalExp', norm.formatted);
    }
  };

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-xs">
        <div className="max-w-md mx-auto">
          <div className="w-14 h-14 bg-teal-50 text-teal-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-teal-100">
            <TableIcon className="w-7 h-7" />
          </div>
          <h3 className="text-base font-semibold text-slate-800 mb-1">
            Belum Ada Data Rekap Faktur
          </h3>
          <p className="text-xs text-slate-500 mb-6">
            Tempel teks faktur PBF di kotak atas, ambil foto faktur dari galeri/kamera, atau klik tombol Tambah Baris di bawah.
          </p>
          <button
            type="button"
            id="btn-empty-add-row"
            onClick={onAddNewRow}
            className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Baris Manual Pertama</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Table Toolbar */}
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-800">
            Daftar Barang Faktur ({items.length} Baris)
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Edit Mode Toggle */}
          <button
            type="button"
            id="toggle-quick-edit-mode"
            onClick={() => setQuickEditOnClick((prev) => !prev)}
            title="Klik baris pada tabel untuk membuka pop-up Edit Cepat terintegrasi"
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
              quickEditOnClick
                ? 'bg-teal-50 border-teal-300 text-teal-800 shadow-xs'
                : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900'
            }`}
          >
            <Zap className={`w-3.5 h-3.5 ${quickEditOnClick ? 'text-teal-600 fill-teal-600' : 'text-slate-400'}`} />
            <span className="hidden md:inline">Mode Edit Cepat:</span>
            <span>{quickEditOnClick ? 'Aktif' : 'Nonaktif'}</span>
          </button>

          {/* Column Preset Toggle */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs">
            <button
              type="button"
              id="preset-standard-columns"
              onClick={() => setColumnPreset('standard')}
              title="Tampilkan kolom rekap faktur standar"
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                columnPreset === 'standard'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Standar
            </button>
            <button
              type="button"
              id="preset-detailed-columns"
              onClick={() => setColumnPreset('detailed')}
              title="Tampilkan kolom lengkap (+ Diskon Bertingkat & Nominal Diskon Rp)"
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                columnPreset === 'detailed'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              + Diskon Bertingkat & Nominal
            </button>
          </div>

          {/* View Mode Toggle for Android/iOS */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs">
            <button
              type="button"
              id="view-mode-table"
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-colors ${
                viewMode === 'table'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Tabel</span>
            </button>
            <button
              type="button"
              id="view-mode-cards"
              onClick={() => setViewMode('cards')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-colors ${
                viewMode === 'cards'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Kartu</span>
            </button>
          </div>

          {items.length > 0 && onClearAll && (
            <button
              type="button"
              id="btn-table-toolbar-clear"
              onClick={onClearAll}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-rose-200 bg-rose-50/70 hover:bg-rose-100 text-rose-700 text-xs font-medium transition-colors cursor-pointer"
              title="Kosongkan seluruh baris tabel"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Kosongkan</span>
            </button>
          )}

          <button
            type="button"
            id="btn-table-add-row"
            onClick={onAddNewRow}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-medium rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah Baris</span>
          </button>
        </div>
      </div>

      {/* Datalist for Satuan Autocomplete */}
      <datalist id="satuan-options">
        <option value="BOX" />
        <option value="BOTOL" />
        <option value="TUBE" />
        <option value="PACK" />
        <option value="STRIP" />
        <option value="TABLET" />
        <option value="VIAL" />
        <option value="AMPUL" />
        <option value="POT" />
        <option value="PCS" />
      </datalist>

      {/* Quick Edit Guidance Tip */}
      <div className="px-4 py-2 bg-teal-50/70 border-b border-teal-100 flex flex-wrap items-center justify-between gap-2 text-xs text-teal-950">
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-md bg-teal-600 text-white flex items-center justify-center shrink-0">
            <Zap className="w-3.5 h-3.5 fill-current text-amber-300" />
          </span>
          <span className="text-[11px] sm:text-xs">
            <strong>Mode Edit Cepat:</strong> Klik baris mana saja atau tombol &ldquo;Edit&rdquo; untuk mengubah semua field (harga, diskon, jumlah) sekaligus dalam satu pop-up terpadu.
          </span>
        </div>
        <button
          type="button"
          onClick={() => setEditingItemIndex(0)}
          className="text-[11px] text-teal-800 bg-teal-100 hover:bg-teal-200 px-2.5 py-1 rounded-md font-semibold transition-colors shrink-0 ml-auto cursor-pointer"
        >
          Buka Edit Cepat (Baris 1)
        </button>
      </div>

      {/* TABLE VIEW (Exact Century Invoice Columns Order) */}
      {viewMode === 'table' && (
        <div className="relative">
          {/* Scroll Indicator Hint */}
          <div className="block lg:hidden px-4 py-1.5 bg-amber-50 border-b border-amber-100 text-[11px] text-amber-800 flex items-center justify-between">
            <span>Geser ke kanan untuk melihat seluruh kolom faktur ➔</span>
          </div>

          <div
            id="faktur-table-scroll-container"
            className="overflow-x-auto overflow-y-auto max-h-[620px] custom-scrollbar"
            tabIndex={0}
          >
            <table className="w-full text-left border-collapse min-w-[1340px]">
              {/* Table Header: Susunan kolom rekap faktur standar */}
              <thead className="bg-slate-100/95 sticky top-0 z-20 backdrop-blur-xs text-[11px] font-semibold text-slate-700 uppercase tracking-wider border-b border-slate-200 select-none">
                <tr>
                  {/* 1. No */}
                  <th className="py-2.5 px-2 text-center w-10">No</th>

                  {/* 2. Nama Barang */}
                  <th className="py-2.5 px-3 min-w-[220px] w-64">Nama Barang</th>

                  {/* 3. Qty */}
                  <th className="py-2.5 px-2 text-center w-16">
                    <div>Qty</div>
                    <div className="text-[9px] text-slate-400 normal-case font-normal">Beli</div>
                  </th>

                  {/* 4. Qty Bns */}
                  <th className="py-2.5 px-2 text-center w-16 bg-blue-50/40">
                    <div className="text-blue-900">Qty Bns</div>
                    <div className="text-[9px] text-blue-500 normal-case font-normal">Bonus</div>
                  </th>

                  {/* 5. Satuan */}
                  <th className="py-2.5 px-2 text-center w-20">
                    <div>Satuan</div>
                    <div className="text-[9px] text-slate-400 normal-case font-normal">Kemasan</div>
                  </th>

                  {/* 6. Hrg / Sat */}
                  <th className="py-2.5 px-2.5 text-right w-30">
                    <div>Hrg / Sat</div>
                    <div className="text-[9px] text-slate-400 normal-case font-normal">Harga Beli Rp</div>
                  </th>

                  {/* 7. Disc (%) */}
                  <th className="py-2.5 px-2 text-center w-20">
                    <div className="flex items-center justify-center gap-0.5">
                      <span>Disc</span>
                      <span className="text-[10px] text-teal-600 font-bold">%</span>
                    </div>
                  </th>

                  {/* Optional: Diskon Bertingkat (Only in detailed preset) */}
                  {columnPreset === 'detailed' && (
                    <th className="py-2.5 px-2 text-center w-24 bg-teal-50/50">
                      <div className="text-teal-900">Bertingkat</div>
                      <div className="text-[9px] text-teal-600 font-bold">+D2 %</div>
                    </th>
                  )}

                  {/* Optional: Nominal Diskon Rp (Only in detailed preset) */}
                  {columnPreset === 'detailed' && (
                    <th className="py-2.5 px-2.5 text-right w-32 bg-amber-50/40">
                      <div className="text-amber-950 font-bold">Diskon Rp</div>
                      <div className="text-[9px] text-amber-700 normal-case font-normal">Sinkron ⇄ %</div>
                    </th>
                  )}

                  {/* 8. Jumlah (Bruto) */}
                  <th className="py-2.5 px-3 text-right w-32 bg-slate-50/70">
                    <div className="font-bold text-slate-800">Jumlah</div>
                    <div className="text-[9px] text-slate-500 normal-case font-normal">Qty × Hrg/Sat</div>
                  </th>

                  {/* 9. Total (Net Line Total) */}
                  <th className="py-2.5 px-3 text-right w-32 bg-teal-50/70 border-l border-teal-100">
                    <div className="font-bold text-teal-950">Total</div>
                    <div className="text-[9px] text-teal-700 normal-case font-normal">Bruto − Diskon</div>
                  </th>

                  {/* 10. HPP / Sat (Farmasi Apotek) */}
                  <th className="py-2.5 px-2.5 text-right w-28 bg-emerald-50/40 text-emerald-900">
                    <div className="font-bold">HPP / Sat</div>
                    <div className="text-[9px] text-emerald-600 normal-case font-normal">Harga Net Unit</div>
                  </th>

                  {/* 11. Exp Date */}
                  <th className="py-2.5 px-2 text-center w-28">
                    <div>Exp Date</div>
                    <div className="text-[9px] text-slate-400 normal-case font-normal">Tgl Kadaluarsa</div>
                  </th>

                  {/* 12. Batch */}
                  <th className="py-2.5 px-2 text-center w-24">
                    <div>Batch</div>
                    <div className="text-[9px] text-slate-400 normal-case font-normal">No. Batch</div>
                  </th>

                  {/* 13. (Kd. Brg) */}
                  <th className="py-2.5 px-2 text-center w-24">
                    <div>(Kd. Brg)</div>
                    <div className="text-[9px] text-slate-400 normal-case font-normal">Kode Barang</div>
                  </th>

                  {/* 14. Aksi */}
                  <th className="py-2.5 px-2 text-center w-28">Aksi</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200 text-xs">
                {items.map((item, index) => {
                  const hasErrors = !item.isValid;
                  const isExpired = isDateExpired(item.tanggalExp);
                  const subtotalBruto = item.subtotalBruto || (item.jumlah * item.hargaBeli);

                  return (
                    <tr
                      key={item.id}
                      onClick={() => {
                        if (quickEditOnClick) {
                          setEditingItemIndex(index);
                        }
                      }}
                      className={`hover:bg-teal-50/50 transition-colors cursor-pointer group ${
                        hasErrors ? 'bg-amber-50/30' : index % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'
                      }`}
                      title="Klik baris ini untuk membuka Edit Cepat (modal pop-up)"
                    >
                      {/* 1. No */}
                      <td className="py-2 px-2 text-center font-medium text-slate-500">
                        <div className="flex items-center justify-center gap-1">
                          {hasErrors ? (
                            <span
                              className="text-amber-600 cursor-pointer"
                              title={item.validationErrors.map((e) => e.message).join('\n')}
                            >
                              <AlertCircle className="w-3.5 h-3.5" />
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">{item.urutan}</span>
                          )}
                        </div>
                      </td>

                      {/* 2. Nama Barang */}
                      <td className="py-2 px-3">
                        <div className="space-y-1">
                          <input
                            type="text"
                            value={item.namaObat}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) =>
                              handleFieldChange(index, 'namaObat', e.target.value)
                            }
                            placeholder="Nama barang / obat..."
                            className={`w-full text-xs px-2 py-1 rounded border font-medium focus:ring-1 focus:ring-teal-500 focus:outline-hidden ${
                              !item.namaObat.trim()
                                ? 'border-amber-400 bg-amber-50/50 text-amber-900'
                                : 'border-slate-200 bg-white text-slate-800'
                            }`}
                          />
                          {item.rawDiscountCode && (
                            <span className="inline-block text-[10px] text-teal-700 bg-teal-50 px-1.5 py-0.2 rounded border border-teal-100 font-mono">
                              {item.rawDiscountCode}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 3. Qty (Beli) */}
                      <td className="py-2 px-2 text-center">
                        <input
                          type="number"
                          value={item.jumlah === 0 ? '' : item.jumlah}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) =>
                            handleFieldChange(index, 'jumlah', parseFloat(e.target.value) || 0)
                          }
                          min="1"
                          step="1"
                          className={`w-14 text-center text-xs px-1 py-1 rounded border font-bold focus:ring-1 focus:ring-teal-500 focus:outline-hidden ${
                            item.jumlah <= 0
                              ? 'border-amber-400 bg-amber-50/50 text-amber-900'
                              : 'border-slate-200 bg-white text-slate-800'
                          }`}
                          title="Jumlah kuantiti beli"
                        />
                      </td>

                      {/* 4. Qty Bns (Bonus) */}
                      <td className="py-2 px-2 text-center bg-blue-50/20">
                        <input
                          type="number"
                          value={item.qtyBonus === undefined ? 0 : item.qtyBonus}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) =>
                            handleFieldChange(index, 'qtyBonus', parseFloat(e.target.value) || 0)
                          }
                          min="0"
                          step="1"
                          className="w-14 text-center text-xs px-1 py-1 rounded border border-blue-200 bg-white text-blue-900 font-semibold focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                          title="Kuantitas bonus faktur (Qty Bns)"
                        />
                      </td>

                      {/* 5. Satuan */}
                      <td className="py-2 px-2 text-center">
                        <input
                          list="satuan-options"
                          type="text"
                          value={item.satuan || ''}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) =>
                            handleFieldChange(index, 'satuan', e.target.value.toUpperCase())
                          }
                          placeholder="BOX"
                          className="w-18 text-center text-xs font-semibold uppercase px-1 py-1 rounded border border-slate-200 bg-white text-slate-800 focus:ring-1 focus:ring-teal-500 focus:outline-hidden"
                          title="Satuan kemasan barang (BOX, BOTOL, TUBE, PACK, STRIP, dsb.)"
                        />
                      </td>

                      {/* 6. Hrg / Sat (Harga Satuan dengan pemisah ribuan) */}
                      <td className="py-2 px-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <CurrencyInput
                          id={`input-harga-beli-${item.id}`}
                          value={item.hargaBeli}
                          onChange={(val) =>
                            handleFieldChange(index, 'hargaBeli', val)
                          }
                          className={`w-28 text-right text-xs px-2 py-1 rounded border font-mono focus:ring-1 focus:ring-teal-500 focus:outline-hidden ${
                            item.hargaBeli <= 0
                              ? 'border-amber-400 bg-amber-50/50 text-amber-900'
                              : 'border-slate-200 bg-white text-slate-800'
                          }`}
                        />
                      </td>

                      {/* 7. Disc (%) */}
                      <td className="py-2 px-2 text-center" onClick={(e) => e.stopPropagation()}>
                        <PercentInput
                          id={`input-disc1-${item.id}`}
                          value={item.diskonPersen}
                          onChange={(val) =>
                            handleFieldChange(index, 'diskonPersen', val, 'percentages')
                          }
                          className={`w-16 text-center text-xs px-1 py-1 rounded border font-mono focus:ring-1 focus:ring-teal-500 focus:outline-hidden ${
                            item.diskonPersen < 0 || item.diskonPersen > 100
                              ? 'border-amber-400 bg-amber-50 text-amber-900'
                              : 'border-slate-200 bg-white text-slate-800'
                          }`}
                        />
                      </td>

                      {/* Optional: Diskon Bertingkat (detailed preset) */}
                      {columnPreset === 'detailed' && (
                        <td className="py-2 px-2 text-center bg-teal-50/20" onClick={(e) => e.stopPropagation()}>
                          <PercentInput
                            id={`input-disc2-${item.id}`}
                            value={item.diskonBertingkatPersen}
                            onChange={(val) =>
                              handleFieldChange(index, 'diskonBertingkatPersen', val, 'percentages')
                            }
                            className="w-16 text-center text-xs px-1 py-1 rounded border border-teal-200 bg-white text-slate-800 font-mono focus:ring-1 focus:ring-teal-500 focus:outline-hidden"
                          />
                        </td>
                      )}

                      {/* Optional: Nominal Diskon Rp (detailed preset) */}
                      {columnPreset === 'detailed' && (
                        <td className="py-2 px-2.5 text-right bg-amber-50/20" onClick={(e) => e.stopPropagation()}>
                          <CurrencyInput
                            id={`input-nominal-diskon-${item.id}`}
                            value={item.nominalDiskon}
                            onChange={(val) =>
                              handleFieldChange(index, 'nominalDiskon', val, 'nominal')
                            }
                            className="w-28 text-right text-xs px-2 py-1 rounded border border-amber-200 bg-white text-slate-800 font-mono focus:ring-1 focus:ring-teal-500 focus:outline-hidden"
                          />
                        </td>
                      )}

                      {/* 8. Jumlah (Bruto Baris = Qty × Hrg / Sat) */}
                      <td className="py-2 px-3 text-right font-mono font-semibold text-slate-900 bg-slate-50/40">
                        {formatRupiah(subtotalBruto)}
                      </td>

                      {/* 9. Total (Net Baris Setelah Diskon: Subtotal Bruto - Diskon) */}
                      <td className="py-2 px-3 text-right font-mono font-bold text-teal-900 bg-teal-50/30 border-l border-teal-100/70">
                        <div className="flex flex-col items-end">
                          <span className="text-xs">{formatRupiah(item.total)}</span>
                          {item.nominalDiskon > 0 ? (
                            <span className="text-[10px] text-emerald-600 font-normal font-sans">
                              -disc {formatRupiah(item.nominalDiskon)}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-normal font-sans">
                              (net)
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 10. HPP / Sat (Harga Pokok per Satuan) */}
                      <td className="py-2 px-2.5 text-right font-mono font-bold text-emerald-700 bg-emerald-50/20">
                        {formatRupiah(item.hpp)}
                      </td>

                      {/* 11. Exp Date */}
                      <td className="py-2 px-2 text-center">
                        <div className="space-y-0.5">
                          <input
                            type="text"
                            value={item.tanggalExp || ''}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) =>
                              handleFieldChange(index, 'tanggalExp', e.target.value)
                            }
                            onBlur={(e) => handleDateBlur(index, e.target.value)}
                            placeholder="2030-08"
                            className={`w-24 text-center text-xs px-1.5 py-1 rounded border font-mono focus:ring-1 focus:ring-teal-500 focus:outline-hidden ${
                              !item.tanggalExp || !normalizeExpiryDate(item.tanggalExp).isValid
                                ? 'border-amber-400 bg-amber-50 text-amber-900 font-medium'
                                : isExpired
                                ? 'border-rose-400 bg-rose-50 text-rose-900 font-bold'
                                : 'border-slate-200 bg-white text-slate-800'
                            }`}
                            title="Format kadaluarsa (contoh: 2030-08 atau 01/08/2030)"
                          />
                          {isExpired && (
                            <div className="text-[9px] text-rose-600 font-semibold leading-none">
                              Expired!
                            </div>
                          )}
                        </div>
                      </td>

                      {/* 12. Batch */}
                      <td className="py-2 px-2 text-center">
                        <input
                          type="text"
                          value={item.noBatch || ''}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) =>
                            handleFieldChange(index, 'noBatch', e.target.value)
                          }
                          placeholder="WE18MT"
                          className="w-22 text-center text-xs px-1.5 py-1 rounded border border-slate-200 bg-white text-slate-800 font-mono focus:ring-1 focus:ring-teal-500 focus:outline-hidden"
                          title="Nomor Batch Barang (contoh: WE18MT, D6F927B)"
                        />
                      </td>

                      {/* 13. (Kd. Brg) - Kode Barang */}
                      <td className="py-2 px-2 text-center">
                        <input
                          type="text"
                          value={item.kodeBarang || ''}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) =>
                            handleFieldChange(index, 'kodeBarang', e.target.value)
                          }
                          placeholder="0102537"
                          className="w-22 text-center text-xs px-1.5 py-1 rounded border border-slate-200 bg-white text-slate-800 font-mono focus:ring-1 focus:ring-teal-500 focus:outline-hidden"
                          title="Kode Barang (contoh: 0102537)"
                        />
                      </td>

                      {/* 14. Aksi */}
                      <td className="py-2 px-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            id={`btn-quick-edit-row-${item.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingItemIndex(index);
                            }}
                            title="Edit Cepat (Buka pop-up terintegrasi)"
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-teal-700 bg-teal-50 hover:bg-teal-100 active:bg-teal-200 border border-teal-200 transition-colors cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          {hasErrors && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onAutoFixItem(index);
                              }}
                              title="Perbaiki otomatis tanggal atau diskon"
                              className="p-1 rounded hover:bg-amber-100 text-amber-700 transition-colors"
                            >
                              <Wand2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            id={`btn-duplicate-row-${item.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onDuplicateItem(index);
                            }}
                            title="Duplikat baris"
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            id={`btn-delete-row-${item.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteItem(index);
                            }}
                            title="Hapus baris obat ini"
                            aria-label={`Hapus ${item.namaObat || 'baris barang'}`}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 active:bg-rose-100 active:scale-95 transition-all cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CARD VIEW (For Mobile screens) */}
      {viewMode === 'cards' && (
        <div className="space-y-3 p-3">
          <div className="p-3 bg-teal-50/90 border border-teal-200 rounded-xl flex items-center justify-between text-xs text-teal-900 shadow-2xs">
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-teal-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Zap className="w-4 h-4 fill-current text-amber-300" />
              </span>
              <div>
                <span className="font-bold block text-teal-950">Mode Edit Cepat HP Aktif</span>
                <span className="text-[11px] text-teal-700">
                  Ketuk kartu mana saja untuk mengubah seluruh data (harga, diskon, kuantitas) dalam pop-up layar penuh yang nyaman di HP.
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[620px] overflow-y-auto custom-scrollbar">
            {items.map((item, index) => {
              const hasErrors = !item.isValid;
              const isExpired = isDateExpired(item.tanggalExp);
              const subtotalBruto = item.subtotalBruto || (item.jumlah * item.hargaBeli);

              return (
                <div
                  key={item.id}
                  onClick={() => setEditingItemIndex(index)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer hover:border-teal-400 hover:shadow-md ${
                    hasErrors ? 'bg-amber-50/40 border-amber-300' : 'bg-white border-slate-200'
                  } shadow-xs space-y-2.5`}
                >
                  {/* Top Row: Urutan, Nama Barang, Aksi */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1">
                      <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center shrink-0">
                        {item.urutan}
                      </span>
                      <input
                        type="text"
                        value={item.namaObat}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => handleFieldChange(index, 'namaObat', e.target.value)}
                        placeholder="Nama barang..."
                        className="w-full text-xs font-semibold text-slate-800 border border-slate-200 rounded px-2 py-1 bg-white focus:ring-1 focus:ring-teal-500"
                      />
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        id={`btn-quick-edit-card-${item.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingItemIndex(index);
                        }}
                        title="Buka Edit Cepat"
                        className="px-2.5 py-1 rounded-lg bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white text-xs font-bold inline-flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
                      >
                        <Zap className="w-3.5 h-3.5 fill-current text-amber-300" />
                        <span>Edit</span>
                      </button>
                      {hasErrors && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onAutoFixItem(index);
                          }}
                          title="Perbaiki otomatis"
                          className="p-1 text-amber-600 hover:bg-amber-100 rounded"
                        >
                          <Wand2 className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        id={`btn-duplicate-card-${item.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onDuplicateItem(index);
                        }}
                        title="Duplikat baris"
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        id={`btn-delete-card-${item.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteItem(index);
                        }}
                        title="Hapus baris"
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 active:bg-rose-100 transition-all cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Primary Numbers Grid: Qty, Qty Bns, Satuan, Hrg / Sat */}
                  <div className="grid grid-cols-4 gap-2 text-xs" onClick={(e) => e.stopPropagation()}>
                    <div>
                      <label className="text-[10px] text-slate-500 block">Qty</label>
                      <input
                        type="number"
                        value={item.jumlah}
                        onChange={(e) =>
                          handleFieldChange(index, 'jumlah', parseFloat(e.target.value) || 0)
                        }
                        className="w-full px-2 py-1 border border-slate-200 rounded bg-white text-xs font-bold text-center"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-blue-700 font-medium block">Qty Bns</label>
                      <input
                        type="number"
                        value={item.qtyBonus === undefined ? 0 : item.qtyBonus}
                        onChange={(e) =>
                          handleFieldChange(index, 'qtyBonus', parseFloat(e.target.value) || 0)
                        }
                        className="w-full px-2 py-1 border border-blue-200 rounded bg-white text-xs font-semibold text-center text-blue-900"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 block">Satuan</label>
                      <input
                        list="satuan-options"
                        type="text"
                        value={item.satuan || ''}
                        onChange={(e) => handleFieldChange(index, 'satuan', e.target.value.toUpperCase())}
                        placeholder="BOX"
                        className="w-full text-xs px-1.5 py-1 border border-slate-200 rounded bg-white font-semibold text-center uppercase"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 block">Hrg / Sat</label>
                      <CurrencyInput
                        id={`card-harga-beli-${item.id}`}
                        value={item.hargaBeli}
                        onChange={(val) =>
                          handleFieldChange(index, 'hargaBeli', val)
                        }
                        className="w-full px-2 py-1 border border-slate-200 rounded bg-white text-xs font-mono text-right"
                      />
                    </div>
                  </div>

                  {/* Discount Options: Disc (%), Bertingkat (%) & Nominal Diskon (Rp) */}
                  <div className="grid grid-cols-3 gap-2 text-xs bg-slate-50/80 p-2 rounded-lg border border-slate-200" onClick={(e) => e.stopPropagation()}>
                    <div>
                      <label className="text-[10px] text-slate-700 font-medium block">Disc (%)</label>
                      <PercentInput
                        id={`card-disc1-${item.id}`}
                        value={item.diskonPersen}
                        onChange={(val) =>
                          handleFieldChange(index, 'diskonPersen', val, 'percentages')
                        }
                        className="w-full px-1.5 py-1 border border-slate-200 rounded bg-white text-xs font-mono text-center"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-teal-800 font-medium block">+D2 (%)</label>
                      <PercentInput
                        id={`card-disc2-${item.id}`}
                        value={item.diskonBertingkatPersen}
                        onChange={(val) =>
                          handleFieldChange(index, 'diskonBertingkatPersen', val, 'percentages')
                        }
                        className="w-full px-1.5 py-1 border border-teal-200 rounded bg-white text-xs font-mono text-center"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-amber-900 font-medium block">Nominal Rp</label>
                      <CurrencyInput
                        id={`card-nominal-${item.id}`}
                        value={item.nominalDiskon}
                        onChange={(val) =>
                          handleFieldChange(index, 'nominalDiskon', val, 'nominal')
                        }
                        className="w-full px-2 py-1 border border-amber-200 rounded bg-white text-xs font-mono text-right"
                      />
                    </div>
                  </div>

                  {/* Summary Row: Jumlah (Bruto), Total (Net), & HPP */}
                  <div className="grid grid-cols-3 gap-2 text-xs pt-1 border-t border-slate-100">
                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                      <span className="text-[10px] text-slate-500 block font-medium">Jumlah:</span>
                      <span className="text-xs font-bold text-slate-800 font-mono block truncate">
                        {formatRupiah(subtotalBruto)}
                      </span>
                    </div>

                    <div className="bg-teal-50/80 p-2 rounded-lg border border-teal-200">
                      <span className="text-[10px] text-teal-800 block font-medium">Total:</span>
                      <span className="text-xs font-bold text-teal-950 font-mono block truncate">
                        {formatRupiah(item.total)}
                      </span>
                    </div>

                    <div className="bg-emerald-50/70 p-2 rounded-lg border border-emerald-200">
                      <span className="text-[10px] text-emerald-800 block font-medium">HPP / Sat:</span>
                      <span className="text-xs font-bold text-emerald-700 font-mono block truncate">
                        {formatRupiah(item.hpp)}
                      </span>
                    </div>
                  </div>

                  {/* Info Tambahan: Exp Date, Batch, Kd. Brg */}
                  <div className="grid grid-cols-3 gap-2 text-xs bg-slate-50/60 p-2 rounded-lg border border-slate-100" onClick={(e) => e.stopPropagation()}>
                    <div>
                      <label className="text-[10px] text-slate-500 block">Exp Date</label>
                      <input
                        type="text"
                        value={item.tanggalExp || ''}
                        onChange={(e) => handleFieldChange(index, 'tanggalExp', e.target.value)}
                        onBlur={(e) => handleDateBlur(index, e.target.value)}
                        placeholder="2030-08"
                        className="w-full text-xs px-1.5 py-0.5 border border-slate-200 rounded bg-white font-mono text-center"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 block">Batch</label>
                      <input
                        type="text"
                        value={item.noBatch || ''}
                        onChange={(e) => handleFieldChange(index, 'noBatch', e.target.value)}
                        placeholder="Batch"
                        className="w-full text-xs px-1.5 py-0.5 border border-slate-200 rounded bg-white font-mono text-center"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 block">(Kd. Brg)</label>
                      <input
                        type="text"
                        value={item.kodeBarang || ''}
                        onChange={(e) => handleFieldChange(index, 'kodeBarang', e.target.value)}
                        placeholder="0102537"
                        className="w-full text-xs px-1.5 py-0.5 border border-slate-200 rounded bg-white font-mono text-center"
                      />
                    </div>
                  </div>

                  {/* Errors display if any */}
                  {hasErrors && (
                    <div className="bg-amber-50 rounded-lg p-2 text-[11px] text-amber-800 border border-amber-200 space-y-1">
                      {item.validationErrors.map((err, i) => (
                        <div key={i} className="flex items-center gap-1">
                          <AlertCircle className="w-3 h-3 text-amber-600 shrink-0" />
                          <span>{err.message}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Integrated Quick Edit Modal */}
      {editingItemIndex !== null && items[editingItemIndex] && (
        <QuickEditModal
          isOpen={editingItemIndex !== null}
          item={items[editingItemIndex]}
          itemIndex={editingItemIndex}
          totalItems={items.length}
          onClose={() => setEditingItemIndex(null)}
          onNavigate={(newIdx) => {
            if (newIdx >= 0 && newIdx < items.length) {
              setEditingItemIndex(newIdx);
            }
          }}
          onUpdateItem={onUpdateItem}
          onDeleteItem={(idx) => {
            onDeleteItem(idx);
            if (items.length <= 1) {
              setEditingItemIndex(null);
            } else if (idx >= items.length - 1) {
              setEditingItemIndex(items.length - 2);
            }
          }}
          onDuplicateItem={onDuplicateItem}
          onAutoFixItem={onAutoFixItem}
        />
      )}
    </div>
  );
};
