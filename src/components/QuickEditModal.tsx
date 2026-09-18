import React, { useEffect, useRef } from 'react';
import { FakturItem, DiscountSyncSource } from '../types';
import { formatRupiah } from '../utils/calculations';
import { normalizeExpiryDate, isDateExpired } from '../utils/validation';
import { CurrencyInput } from './CurrencyInput';
import { PercentInput } from './PercentInput';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Plus,
  Minus,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Copy,
  Wand2,
  Calendar,
  Package,
  Calculator,
  Zap,
  ArrowRight,
} from 'lucide-react';

export interface QuickEditModalProps {
  isOpen: boolean;
  item: FakturItem | null;
  itemIndex: number;
  totalItems: number;
  onClose: () => void;
  onUpdateItem: (
    index: number,
    updatedItem: FakturItem,
    syncSource?: DiscountSyncSource
  ) => void;
  onNavigate: (newIndex: number) => void;
  onDeleteItem?: (index: number) => void;
  onDuplicateItem?: (index: number) => void;
  onAutoFixItem?: (index: number) => void;
}

const COMMON_SATUAN = ['BOX', 'BOTOL', 'TUBE', 'STRIP', 'PACK', 'TABLET', 'PCS', 'VIAL', 'AMPUL'];
const DISCOUNT_PRESETS = [0, 2, 2.5, 5, 10, 15, 20];

export const QuickEditModal: React.FC<QuickEditModalProps> = ({
  isOpen,
  item,
  itemIndex,
  totalItems,
  onClose,
  onUpdateItem,
  onNavigate,
  onDeleteItem,
  onDuplicateItem,
  onAutoFixItem,
}) => {
  const modalContentRef = useRef<HTMLDivElement>(null);

  // Keyboard navigation & Escape handling
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.altKey && e.key === 'ArrowLeft' && itemIndex > 0) {
        e.preventDefault();
        onNavigate(itemIndex - 1);
      } else if (e.altKey && e.key === 'ArrowRight' && itemIndex < totalItems - 1) {
        e.preventDefault();
        onNavigate(itemIndex + 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, itemIndex, totalItems, onClose, onNavigate]);

  // Scroll to top of modal whenever navigated to another item
  useEffect(() => {
    if (modalContentRef.current) {
      modalContentRef.current.scrollTop = 0;
    }
  }, [itemIndex]);

  if (!isOpen || !item) return null;

  const isExpired = isDateExpired(item.tanggalExp);
  const hasErrors = !item.isValid || (item.validationErrors && item.validationErrors.length > 0);
  const subtotalBruto = item.subtotalBruto || item.jumlah * item.hargaBeli;

  const handleFieldChange = (
    field: keyof FakturItem,
    value: any,
    syncSource?: DiscountSyncSource
  ) => {
    const updated = {
      ...item,
      [field]: value,
    };
    onUpdateItem(itemIndex, updated as FakturItem, syncSource);
  };

  const handleStepQty = (delta: number) => {
    const current = Math.max(0, item.jumlah || 0);
    const next = Math.max(0, current + delta);
    handleFieldChange('jumlah', next, item.discountMode || 'percentages');
  };

  const handleStepQtyBonus = (delta: number) => {
    const current = Math.max(0, item.qtyBonus || 0);
    const next = Math.max(0, current + delta);
    handleFieldChange('qtyBonus', next);
  };

  const handleDateBlur = (rawVal: string) => {
    if (!rawVal) return;
    const norm = normalizeExpiryDate(rawVal);
    if (norm.isValid && norm.formatted !== rawVal) {
      handleFieldChange('tanggalExp', norm.formatted);
    }
  };

  const handleNextOrFinish = () => {
    if (itemIndex < totalItems - 1) {
      onNavigate(itemIndex + 1);
    } else {
      onClose();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-edit-modal-title"
      className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center sm:p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-xl max-h-[92vh] sm:max-h-[88vh] rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-4 py-3 sm:px-5 sm:py-3.5 border-b border-slate-200 bg-slate-50/90 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
              {item.urutan}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-800" id="quick-edit-modal-title">
                  Edit Cepat Barang
                </span>
                <span className="text-[11px] font-medium text-slate-500">
                  ({itemIndex + 1} dari {totalItems})
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                {hasErrors ? (
                  <span className="inline-flex items-center gap-1 text-[10px] text-amber-700 font-semibold bg-amber-100/80 px-2 py-0.2 rounded-full border border-amber-300">
                    <AlertCircle className="w-3 h-3" />
                    Perlu Periksa ({item.validationErrors.length})
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 font-medium bg-emerald-50 px-2 py-0.2 rounded-full border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3" />
                    Data Valid
                  </span>
                )}
                {isExpired && (
                  <span className="text-[10px] text-rose-700 font-bold bg-rose-100 px-1.5 py-0.2 rounded-full border border-rose-300">
                    Expired!
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Navigation Controls in Header */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              id="quick-edit-btn-prev"
              disabled={itemIndex === 0}
              onClick={() => onNavigate(itemIndex - 1)}
              title="Baris Sebelumnya (Alt + ←)"
              className="w-8 h-8 rounded-lg flex items-center justify-center border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              id="quick-edit-btn-next"
              disabled={itemIndex >= totalItems - 1}
              onClick={() => onNavigate(itemIndex + 1)}
              title="Baris Selanjutnya (Alt + →)"
              className="w-8 h-8 rounded-lg flex items-center justify-center border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              id="quick-edit-btn-close"
              onClick={onClose}
              title="Tutup Modal (Esc)"
              className="w-8 h-8 ml-1 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Live Calculation Summary Banner (Real-time Feedback) */}
        <div className="bg-slate-900 text-white px-4 py-3 sm:px-5 border-b border-slate-800 shrink-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center sm:text-left">
            <div className="bg-slate-800/80 rounded-lg p-2 border border-slate-700/60">
              <span className="text-[10px] text-slate-400 block font-medium">Jumlah Bruto</span>
              <span className="text-xs sm:text-sm font-bold font-mono text-slate-200 truncate block">
                {formatRupiah(subtotalBruto)}
              </span>
            </div>
            <div className="bg-slate-800/80 rounded-lg p-2 border border-slate-700/60">
              <span className="text-[10px] text-teal-300 block font-medium">
                Potongan Disc {item.nominalDiskon > 0 ? `(${item.diskonPersen}%)` : ''}
              </span>
              <span className="text-xs sm:text-sm font-bold font-mono text-teal-300 truncate block">
                {formatRupiah(item.nominalDiskon)}
              </span>
            </div>
            <div className="bg-teal-950/70 rounded-lg p-2 border border-teal-700/60">
              <span className="text-[10px] text-teal-300 block font-bold">Total Net Baris</span>
              <span className="text-sm sm:text-base font-black font-mono text-teal-200 truncate block">
                {formatRupiah(item.total)}
              </span>
            </div>
            <div className="bg-emerald-950/70 rounded-lg p-2 border border-emerald-700/60">
              <span className="text-[10px] text-emerald-300 block font-bold">HPP / Satuan</span>
              <span className="text-xs sm:text-sm font-bold font-mono text-emerald-200 truncate block">
                {formatRupiah(item.hpp)}
              </span>
            </div>
          </div>
        </div>

        {/* Scrollable Form Content */}
        <div
          ref={modalContentRef}
          className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 custom-scrollbar"
        >
          {/* Validation Warnings / Auto Fix Banner */}
          {hasErrors && (
            <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 flex items-start justify-between gap-3 text-xs text-amber-900">
              <div className="space-y-1">
                <div className="font-semibold flex items-center gap-1 text-amber-800">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>Catatan Validasi Baris Ini:</span>
                </div>
                <ul className="list-disc list-inside text-[11px] text-amber-700 space-y-0.5">
                  {item.validationErrors.map((err, i) => (
                    <li key={i}>{err.message}</li>
                  ))}
                </ul>
              </div>
              {onAutoFixItem && (
                <button
                  type="button"
                  id="quick-edit-btn-autofix"
                  onClick={() => onAutoFixItem(itemIndex)}
                  className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  <span>Auto-Fix</span>
                </button>
              )}
            </div>
          )}

          {/* Section 1: Nama Barang & Satuan */}
          <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <label
                htmlFor={`quick-edit-nama-${item.id}`}
                className="text-xs font-bold text-slate-800 flex items-center gap-1.5"
              >
                <Package className="w-3.5 h-3.5 text-teal-600" />
                <span>Nama Barang / Obat *</span>
              </label>
              {item.rawDiscountCode && (
                <span className="text-[10px] font-mono text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200 font-semibold">
                  Kode Faktur: {item.rawDiscountCode}
                </span>
              )}
            </div>

            <input
              id={`quick-edit-nama-${item.id}`}
              type="text"
              value={item.namaObat}
              onChange={(e) => handleFieldChange('namaObat', e.target.value)}
              placeholder="Contoh: PANADOL EXTRA 10S, AMOXICILLIN 500MG..."
              className="w-full px-3 py-2 text-sm font-semibold rounded-lg border border-slate-300 bg-white text-slate-800 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
            />

            {/* Satuan & Quick Chips */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor={`quick-edit-satuan-${item.id}`}
                  className="text-[11px] font-medium text-slate-600"
                >
                  Satuan Kemasan
                </label>
                <span className="text-[10px] text-slate-400">Pilih cepat:</span>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {COMMON_SATUAN.map((sat) => {
                  const isSelected = (item.satuan || '').toUpperCase() === sat;
                  return (
                    <button
                      key={sat}
                      type="button"
                      onClick={() => handleFieldChange('satuan', sat)}
                      className={`px-2.5 py-1 text-xs rounded-md font-semibold transition-all ${
                        isSelected
                          ? 'bg-teal-600 text-white shadow-xs'
                          : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {sat}
                    </button>
                  );
                })}
              </div>
              <input
                id={`quick-edit-satuan-${item.id}`}
                type="text"
                value={item.satuan || ''}
                onChange={(e) => handleFieldChange('satuan', e.target.value.toUpperCase())}
                placeholder="Atau ketik satuan manual..."
                className="w-full px-2.5 py-1.5 text-xs font-semibold uppercase rounded-lg border border-slate-300 bg-white text-slate-800 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Section 2: Identifikasi Batch, Exp Date, Kd. Brg */}
          <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200 space-y-3">
            <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-teal-600" />
              <span>Identifikasi & Kadaluarsa</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label
                  htmlFor={`quick-edit-kdbrg-${item.id}`}
                  className="text-[11px] font-medium text-slate-600 block mb-1"
                >
                  Kode Barang (Kd. Brg)
                </label>
                <input
                  id={`quick-edit-kdbrg-${item.id}`}
                  type="text"
                  value={item.kodeBarang || ''}
                  onChange={(e) => handleFieldChange('kodeBarang', e.target.value)}
                  placeholder="0102537"
                  className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-300 bg-white text-slate-800 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label
                  htmlFor={`quick-edit-batch-${item.id}`}
                  className="text-[11px] font-medium text-slate-600 block mb-1"
                >
                  No. Batch
                </label>
                <input
                  id={`quick-edit-batch-${item.id}`}
                  type="text"
                  value={item.noBatch || ''}
                  onChange={(e) => handleFieldChange('noBatch', e.target.value)}
                  placeholder="WE18MT"
                  className="w-full px-2.5 py-1.5 text-xs font-mono uppercase rounded-lg border border-slate-300 bg-white text-slate-800 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label
                  htmlFor={`quick-edit-exp-${item.id}`}
                  className="text-[11px] font-medium text-slate-600 block mb-1"
                >
                  Tanggal Exp (YYYY-MM)
                </label>
                <input
                  id={`quick-edit-exp-${item.id}`}
                  type="text"
                  value={item.tanggalExp || ''}
                  onChange={(e) => handleFieldChange('tanggalExp', e.target.value)}
                  onBlur={(e) => handleDateBlur(e.target.value)}
                  placeholder="2030-08"
                  className={`w-full px-2.5 py-1.5 text-xs font-mono font-medium rounded-lg border focus:ring-2 focus:ring-teal-500 focus:outline-hidden ${
                    isExpired
                      ? 'border-rose-400 bg-rose-50 text-rose-900 font-bold'
                      : !item.tanggalExp
                      ? 'border-amber-300 bg-amber-50 text-amber-900'
                      : 'border-slate-300 bg-white text-slate-800'
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Section 3: Kuantitas & Bonus (Touch Steppers for Mobile) */}
          <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200 space-y-3">
            <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-teal-600" />
              <span>Jumlah Kuantitas (Qty & Bonus)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Qty Utama */}
              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <div className="text-[11px] font-semibold text-slate-700 mb-1.5">
                  Jumlah Satuan (Qty)
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleStepQty(-1)}
                    title="Kurangi 1 Qty"
                    className="w-11 h-11 rounded-lg bg-slate-100 hover:bg-slate-200 active:bg-slate-300 flex items-center justify-center text-slate-700 font-bold transition-all select-none"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <input
                    id={`quick-edit-qty-${item.id}`}
                    type="number"
                    min="0"
                    step="any"
                    value={item.jumlah}
                    onChange={(e) =>
                      handleFieldChange(
                        'jumlah',
                        parseFloat(e.target.value) || 0,
                        item.discountMode || 'percentages'
                      )
                    }
                    className="flex-1 text-center font-bold font-mono text-base py-2 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => handleStepQty(1)}
                    title="Tambah 1 Qty"
                    className="w-11 h-11 rounded-lg bg-slate-100 hover:bg-slate-200 active:bg-slate-300 flex items-center justify-center text-slate-700 font-bold transition-all select-none"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Qty Bonus */}
              <div className="bg-white p-2.5 rounded-lg border border-blue-200 bg-blue-50/20">
                <div className="text-[11px] font-semibold text-blue-900 mb-1.5 flex items-center justify-between">
                  <span>Qty Bonus (Gratis)</span>
                  <span className="text-[10px] text-blue-600 font-normal">Tidak menambah tagihan</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleStepQtyBonus(-1)}
                    title="Kurangi 1 Qty Bonus"
                    className="w-11 h-11 rounded-lg bg-blue-50 hover:bg-blue-100 active:bg-blue-200 flex items-center justify-center text-blue-700 font-bold transition-all select-none"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <input
                    id={`quick-edit-qty-bonus-${item.id}`}
                    type="number"
                    min="0"
                    step="any"
                    value={item.qtyBonus === undefined ? 0 : item.qtyBonus}
                    onChange={(e) =>
                      handleFieldChange('qtyBonus', parseFloat(e.target.value) || 0)
                    }
                    className="flex-1 text-center font-bold font-mono text-base py-2 rounded-lg border border-blue-300 bg-white text-blue-950 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => handleStepQtyBonus(1)}
                    title="Tambah 1 Qty Bonus"
                    className="w-11 h-11 rounded-lg bg-blue-50 hover:bg-blue-100 active:bg-blue-200 flex items-center justify-center text-blue-700 font-bold transition-all select-none"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Harga Beli & Diskon (Kalkulasi Terintegrasi) */}
          <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200 space-y-3.5">
            <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Calculator className="w-3.5 h-3.5 text-teal-600" />
              <span>Harga Beli & Pemotongan Diskon</span>
            </div>

            {/* Harga Beli Satuan */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label
                  htmlFor={`quick-edit-harga-${item.id}`}
                  className="text-xs font-bold text-slate-700"
                >
                  Harga Beli Satuan (Rp) *
                </label>
                <span className="text-[11px] text-slate-500">
                  Subtotal: <strong>{formatRupiah(subtotalBruto)}</strong>
                </span>
              </div>
              <CurrencyInput
                id={`quick-edit-harga-${item.id}`}
                value={item.hargaBeli}
                onChange={(val) => handleFieldChange('hargaBeli', val)}
                className="w-full px-3 py-2 text-base font-bold font-mono rounded-lg border border-slate-300 bg-white text-slate-900 text-right focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
              />
            </div>

            {/* Diskon 1 (%) & Presets */}
            <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <label
                  htmlFor={`quick-edit-disc1-${item.id}`}
                  className="text-xs font-bold text-slate-700"
                >
                  Diskon 1 (D %)
                </label>
                <span className="text-[10px] text-slate-400">Pilihan cepat:</span>
              </div>

              {/* Quick Percentage Chips */}
              <div className="flex flex-wrap gap-1.5">
                {DISCOUNT_PRESETS.map((pct) => {
                  const isCurrent = Math.abs(item.diskonPersen - pct) < 0.01;
                  return (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => handleFieldChange('diskonPersen', pct, 'percentages')}
                      className={`px-2.5 py-1 text-xs rounded-md font-semibold transition-all ${
                        isCurrent
                          ? 'bg-teal-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {pct}%
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <PercentInput
                  id={`quick-edit-disc1-${item.id}`}
                  value={item.diskonPersen}
                  onChange={(val) => handleFieldChange('diskonPersen', val, 'percentages')}
                  className="w-28 px-2.5 py-1.5 text-xs font-mono font-bold text-center rounded-lg border border-slate-300 bg-white text-slate-800"
                />
                <span className="text-xs text-slate-500">
                  = Potongan <strong>{formatRupiah(subtotalBruto * (item.diskonPersen / 100))}</strong>
                </span>
              </div>
            </div>

            {/* Diskon Bertingkat & Nominal Diskon */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Diskon Bertingkat */}
              <div className="bg-white p-2.5 rounded-lg border border-teal-200">
                <label
                  htmlFor={`quick-edit-disc2-${item.id}`}
                  className="text-[11px] font-bold text-teal-900 block mb-1"
                >
                  Disc Bertingkat (+D2 %)
                </label>
                <PercentInput
                  id={`quick-edit-disc2-${item.id}`}
                  value={item.diskonBertingkatPersen}
                  onChange={(val) =>
                    handleFieldChange('diskonBertingkatPersen', val, 'percentages')
                  }
                  className="w-full px-2 py-1.5 text-xs font-mono text-center rounded-lg border border-teal-300 bg-white text-slate-800"
                />
                <span className="text-[10px] text-teal-700 block mt-1">
                  Dihitung setelah potongan D1
                </span>
              </div>

              {/* Nominal Diskon Rp */}
              <div className="bg-white p-2.5 rounded-lg border border-amber-200">
                <label
                  htmlFor={`quick-edit-nominal-${item.id}`}
                  className="text-[11px] font-bold text-amber-900 block mb-1"
                >
                  Nominal Diskon (Rp)
                </label>
                <CurrencyInput
                  id={`quick-edit-nominal-${item.id}`}
                  value={item.nominalDiskon}
                  onChange={(val) => handleFieldChange('nominalDiskon', val, 'nominal')}
                  className="w-full px-2 py-1.5 text-xs font-mono text-right rounded-lg border border-amber-300 bg-white text-slate-800"
                />
                <span className="text-[10px] text-amber-700 block mt-1">
                  Sinkronisasi 2 arah dengan %
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Sticky Modal Footer Actions (Touch Friendly for Mobile) */}
        <div className="p-3 sm:p-4 border-t border-slate-200 bg-slate-50/95 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1.5">
            {onDeleteItem && (
              <button
                type="button"
                id="quick-edit-btn-delete"
                onClick={() => {
                  onDeleteItem(itemIndex);
                  onClose();
                }}
                title="Hapus baris obat ini"
                className="h-10 px-3 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Hapus</span>
              </button>
            )}

            {onDuplicateItem && (
              <button
                type="button"
                id="quick-edit-btn-duplicate"
                onClick={() => onDuplicateItem(itemIndex)}
                title="Duplikat baris ini"
                className="h-10 px-3 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Duplikat</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              id="quick-edit-btn-cancel"
              onClick={onClose}
              className="h-10 px-4 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 text-xs font-semibold transition-colors"
            >
              Tutup
            </button>

            <button
              type="button"
              id="quick-edit-btn-save-next"
              onClick={handleNextOrFinish}
              className="h-10 px-4 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white rounded-lg text-xs font-bold shadow-xs inline-flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <span>{itemIndex < totalItems - 1 ? 'Simpan & Lanjut' : 'Selesai'}</span>
              {itemIndex < totalItems - 1 ? (
                <ArrowRight className="w-3.5 h-3.5" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
