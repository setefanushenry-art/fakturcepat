import React, { useState, useRef } from 'react';
import {
  Clipboard,
  Camera,
  Image as ImageIcon,
  Sparkles,
  ChevronDown,
  Upload,
  RefreshCw,
  Plus,
  Info,
  Check,
  Trash2,
  X,
} from 'lucide-react';
import { SAMPLE_PBF_INVOICES, parsePbfInvoiceText } from '../utils/pbfRegexParser';
import { FakturItem, FakturHeader } from '../types';
import { calculateItemRow, formatRupiah } from '../utils/calculations';
import { compressInvoiceImage, formatBytes } from '../utils/imageCompressor';
import { CurrencyInput } from './CurrencyInput';
import { PercentInput } from './PercentInput';

interface InputExtractorProps {
  onExtractSuccess: (items: FakturItem[], header?: Partial<FakturHeader>, isAppend?: boolean) => void;
  onAddItem: (item: FakturItem) => void;
  existingCount: number;
}

export const InputExtractor: React.FC<InputExtractorProps> = ({
  onExtractSuccess,
  onAddItem,
  existingCount,
}) => {
  const [activeTab, setActiveTab] = useState<'paste' | 'scan' | 'manual'>('paste');
  const [rawText, setRawText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractMode, setExtractMode] = useState<'replace' | 'append'>('replace');
  const [scanImagePreview, setScanImagePreview] = useState<string | null>(null);
  const [scanStatus, setScanStatus] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [textParseError, setTextParseError] = useState<string | null>(null);
  const [manualError, setManualError] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressionInfo, setCompressionInfo] = useState<{
    original: string;
    compressed: string;
    ratio: string;
  } | null>(null);

  // Manual Add Form State
  const [manualName, setManualName] = useState('');
  const [manualQty, setManualQty] = useState<number>(10);
  const [manualPrice, setManualPrice] = useState<number>(45000);
  const [manualDisc1, setManualDisc1] = useState<number>(5);
  const [manualDisc2, setManualDisc2] = useState<number>(0);
  const [manualNominalDiskon, setManualNominalDiskon] = useState<number>(22500);
  const [manualExp, setManualExp] = useState('12/29');
  const [manualBatch, setManualBatch] = useState('BTH-01');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Sync helper for manual discount percentages -> nominal
  const updateManualDiscountsFromPercentages = (
    qty: number,
    price: number,
    d1: number,
    d2: number
  ) => {
    const bruto = (qty || 0) * (price || 0);
    const d1Nom = bruto * ((d1 || 0) / 100);
    const afterD1 = bruto - d1Nom;
    const d2Nom = afterD1 * ((d2 || 0) / 100);
    const totalNom = Math.round((d1Nom + d2Nom) * 100) / 100;
    setManualNominalDiskon(totalNom);
  };

  const handleManualPriceChange = (val: number) => {
    setManualPrice(val);
    updateManualDiscountsFromPercentages(manualQty, val, manualDisc1, manualDisc2);
  };

  const handleManualQtyChange = (val: number) => {
    setManualQty(val);
    updateManualDiscountsFromPercentages(val, manualPrice, manualDisc1, manualDisc2);
  };

  const handleManualDisc1Change = (val: number) => {
    setManualDisc1(val);
    updateManualDiscountsFromPercentages(manualQty, manualPrice, val, manualDisc2);
  };

  const handleManualDisc2Change = (val: number) => {
    setManualDisc2(val);
    updateManualDiscountsFromPercentages(manualQty, manualPrice, manualDisc1, val);
  };

  // Bidirectional sync: when user inputs Nominal Diskon (Rp), update Diskon 1 (%) automatically!
  const handleManualNominalChange = (val: number) => {
    setManualNominalDiskon(val);
    const bruto = (manualQty || 0) * (manualPrice || 0);
    if (bruto > 0) {
      const p = Math.round(((val / bruto) * 100) * 100) / 100;
      setManualDisc1(p);
      setManualDisc2(0); // Clear tiered discount to prevent conflict
    } else {
      setManualDisc1(0);
      setManualDisc2(0);
    }
  };

  // Handle sample selection
  const handleSelectSample = (sampleIdx: number) => {
    const sample = SAMPLE_PBF_INVOICES[sampleIdx];
    if (sample) {
      setRawText(sample.text);
    }
  };

  // Run Regex parsing on raw text
  const handleExtractText = () => {
    if (!rawText.trim()) return;
    setIsProcessing(true);
    setTextParseError(null);

    try {
      const result = parsePbfInvoiceText(rawText);
      if (result.items.length === 0) {
        setTextParseError(
          'Tidak ada data obat yang berhasil diekstrak otomatis. Pastikan teks mencakup nama obat dan kuantitas/harga.'
        );
      } else {
        onExtractSuccess(result.items, result.header, extractMode === 'append');
      }
    } catch (err: any) {
      setTextParseError(`Error saat parsing: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle image file selection (Gallery or Camera) with automatic client-side compression
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setScanError('Harap pilih file gambar (JPG, PNG, atau WEBP).');
      return;
    }

    setIsCompressing(true);
    setScanError(null);
    setScanStatus('Mengoptimalkan resolusi foto faktur...');

    try {
      // Compress image client-side to max 1920px width/height and quality 0.85
      // This reduces 15MB smartphone photos down to ~300KB-600KB without losing text sharpness
      const result = await compressInvoiceImage(file, 1920, 0.85);
      setScanImagePreview(result.dataUrl);

      const ratio = Math.round((1 - result.compressedSize / result.originalSize) * 100);
      setCompressionInfo({
        original: formatBytes(result.originalSize),
        compressed: formatBytes(result.compressedSize),
        ratio: ratio > 0 ? `${ratio}% lebih hemat & cepat` : 'Ukuran Optimal',
      });
      setScanStatus(null);
    } catch (err: any) {
      console.warn('Image compression fallback:', err);
      // Fallback to standard reader if canvas is unsupported
      const reader = new FileReader();
      reader.onload = () => {
        setScanImagePreview(reader.result as string);
        setCompressionInfo(null);
        setScanStatus(null);
      };
      reader.readAsDataURL(file);
    } finally {
      setIsCompressing(false);
      // Reset input value so user can pick the same file again if desired
      e.target.value = '';
    }
  };

  // Process OCR Scan via Server Gemini Vision API
  const handleProcessScan = async () => {
    if (!scanImagePreview) return;
    setIsProcessing(true);
    setScanStatus('Memproses gambar dengan AI Gemini Vision OCR...');
    setScanError(null);

    try {
      const res = await fetch('/api/scan-invoice-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: scanImagePreview,
        }),
      });

      // Safely check content-type before parsing JSON to prevent Unexpected token '<'
      const contentType = res.headers.get('content-type') || '';
      let data: any = null;

      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const rawResponseText = await res.text();
        if (res.status === 413) {
          throw new Error('Ukuran foto terlalu besar untuk jaringan server. Silakan coba pilih foto lain atau potong bagian tepi faktur.');
        }
        throw new Error(`Server memberikan respons tidak terduga (${res.status}): ${rawResponseText.slice(0, 100)}`);
      }

      if (!res.ok) {
        throw new Error(data?.error || `Gagal memproses gambar (status ${res.status})`);
      }

      const extractedItemsRaw = data.data?.items || [];
      const headerRaw: Partial<FakturHeader> = {
        noFaktur: data.data?.noFaktur,
        namaPBF: data.data?.namaPBF,
        tanggalFaktur: data.data?.tanggalFaktur,
      };

      if (extractedItemsRaw.length === 0) {
        throw new Error('AI tidak menemukan daftar obat dari foto faktur. Pastikan foto cukup terang, fokus, dan teks nama obat terbaca jelas.');
      }

      // Calculate and format items
      const calculatedItems: FakturItem[] = extractedItemsRaw.map((it: any, idx: number) => {
        return calculateItemRow({
          urutan: idx + 1,
          namaObat: it.namaObat || 'Obat Tanpa Nama',
          jumlah: Number(it.jumlah) || 1,
          hargaBeli: Number(it.hargaBeli) || 0,
          diskonPersen: Number(it.diskonPersen) || 0,
          diskonBertingkatPersen: Number(it.diskonBertingkatPersen) || 0,
          nominalDiskon: Number(it.nominalDiskon) || 0,
          tanggalExp: it.tanggalExp || '',
          noBatch: it.noBatch || '',
        });
      });

      setScanStatus(`Berhasil mengekstrak ${calculatedItems.length} produk dari foto faktur!`);
      onExtractSuccess(calculatedItems, headerRaw, extractMode === 'append');
    } catch (err: any) {
      console.error(err);
      setScanError(err.message || 'Terjadi kesalahan saat mengekstrak foto faktur.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle manual single row add
  const handleManualAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualName.trim()) {
      setManualError('Nama obat wajib diisi.');
      return;
    }
    setManualError(null);

    const newItem = calculateItemRow(
      {
        urutan: existingCount + 1,
        namaObat: manualName,
        jumlah: manualQty || 1,
        hargaBeli: manualPrice || 0,
        diskonPersen: manualDisc1 || 0,
        diskonBertingkatPersen: manualDisc2 || 0,
        nominalDiskon: manualNominalDiskon || 0,
        tanggalExp: manualExp,
        noBatch: manualBatch,
      },
      'percentages'
    );

    onAddItem(newItem);
    // Reset name
    setManualName('');
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
      {/* Mode Tabs */}
      <div className="flex border-b border-slate-200 bg-slate-50/75 p-1 gap-1">
        <button
          id="tab-paste-text"
          type="button"
          onClick={() => setActiveTab('paste')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs sm:text-sm font-medium transition-all ${
            activeTab === 'paste'
              ? 'bg-white text-teal-800 shadow-xs border border-slate-200/60 font-semibold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
          }`}
        >
          <Clipboard className="w-4 h-4 text-teal-600" />
          <span>Copy-Paste Teks Faktur (Regex)</span>
        </button>

        <button
          id="tab-scan-photo"
          type="button"
          onClick={() => setActiveTab('scan')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs sm:text-sm font-medium transition-all ${
            activeTab === 'scan'
              ? 'bg-white text-teal-800 shadow-xs border border-slate-200/60 font-semibold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
          }`}
        >
          <Camera className="w-4 h-4 text-teal-600" />
          <span>Scan & Foto Galeri (AI OCR)</span>
        </button>

        <button
          id="tab-manual-add"
          type="button"
          onClick={() => setActiveTab('manual')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs sm:text-sm font-medium transition-all ${
            activeTab === 'manual'
              ? 'bg-white text-teal-800 shadow-xs border border-slate-200/60 font-semibold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
          }`}
        >
          <Plus className="w-4 h-4 text-teal-600" />
          <span>Tambah Manual</span>
        </button>
      </div>

      {/* Tab 1: Copy-Paste Teks Faktur */}
      {activeTab === 'paste' && (
        <div className="p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="text-xs text-slate-500">
              Tempel teks faktur PBF dari WhatsApp, email, scan OCR, atau salinan PDF:
            </div>

            {/* Quick Sample Selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-600">Gunakan Contoh PBF:</span>
              <select
                id="select-sample-pbf"
                onChange={(e) => handleSelectSample(Number(e.target.value))}
                defaultValue=""
                className="text-xs bg-slate-50 border border-slate-300 rounded-md px-2 py-1 text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-teal-500"
              >
                <option value="" disabled>
                  Pilih Contoh Format Faktur
                </option>
                {SAMPLE_PBF_INVOICES.map((s, idx) => (
                  <option key={s.name} value={idx}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="relative">
            <textarea
              id="textarea-faktur-raw"
              rows={5}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder={`Contoh teks yang didukung:
1. AMOXICILLIN 500MG TAB  10 BOX  @ 48.000  D: 5%  D2: 2%  EXP: 12/29  BTH: B881  446.880
2. CEFIXIME 100MG CAP      5 BOX  @ 135.000 E: 25000       EXP: 05/27  BTH: C101  650.000
(Sistem otomatis mengekstrak kolom, memformat tanggal exp, serta mendeteksi diskon bertingkat & kode diskon non-D)`}
              className="w-full text-xs font-mono p-3 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-slate-50/30 custom-scrollbar resize-y"
            />
          </div>

          {textParseError && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center justify-between">
              <span>{textParseError}</span>
              <button
                type="button"
                onClick={() => setTextParseError(null)}
                className="text-rose-500 hover:text-rose-800 p-0.5 rounded cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Action Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-3 text-xs text-slate-600">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="extractMode"
                  value="replace"
                  checked={extractMode === 'replace'}
                  onChange={() => setExtractMode('replace')}
                  className="text-teal-600 focus:ring-teal-500"
                />
                <span>Ganti tabel rekap</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="extractMode"
                  value="append"
                  checked={extractMode === 'append'}
                  onChange={() => setExtractMode('append')}
                  className="text-teal-600 focus:ring-teal-500"
                />
                <span>Tambah ke baris bawah</span>
              </label>
            </div>

            <div className="flex items-center gap-2">
              {rawText && (
                <button
                  type="button"
                  id="btn-clear-raw-text"
                  onClick={() => {
                    setRawText('');
                    setTextParseError(null);
                  }}
                  className="inline-flex items-center gap-1 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 px-2.5 py-1.5 rounded-lg font-medium transition-colors cursor-pointer"
                  title="Kosongkan kotak teks"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Kosongkan Teks</span>
                </button>
              )}
              <button
                id="btn-ekstrak-regex"
                type="button"
                onClick={handleExtractText}
                disabled={isProcessing || !rawText.trim()}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-xs sm:text-sm font-semibold transition-colors shadow-xs cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>{isProcessing ? 'Mengekstrak...' : 'Ekstrak Data Produk (Regex)'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Scan & Foto Galeri (AI OCR) */}
      {activeTab === 'scan' && (
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            {/* Upload & Capture Buttons */}
            <div className="space-y-3">
              <p className="text-xs text-slate-600">
                Pilih foto lembar faktur fisik PBF langsung dari kamera perangkat atau galeri foto HP/Laptop Anda.
              </p>

              <div className="grid grid-cols-2 gap-2">
                {/* Take Photo with Camera */}
                <button
                  type="button"
                  id="btn-take-camera"
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed border-teal-300 bg-teal-50/50 hover:bg-teal-50 text-teal-800 transition-colors"
                >
                  <Camera className="w-6 h-6 text-teal-600" />
                  <span className="text-xs font-semibold">Buka Kamera</span>
                </button>

                {/* Pick Image from Gallery */}
                <button
                  type="button"
                  id="btn-pick-gallery"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 transition-colors"
                >
                  <ImageIcon className="w-6 h-6 text-slate-600" />
                  <span className="text-xs font-semibold">Pilih Dari Galeri</span>
                </button>
              </div>

              {/* Hidden Inputs */}
              <input
                type="file"
                ref={cameraInputRef}
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                className="hidden"
              />
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />

              <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800 flex gap-2">
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Tips Scan Faktur:</span>
                  <ul className="list-disc ml-4 mt-0.5 space-y-0.5 text-[11px] text-blue-700">
                    <li>Posisikan faktur mendatar dengan cahaya yang cukup.</li>
                    <li>Pastikan nama obat, kolom Qty, Harga Satuan, Diskon, dan Exp Date terbaca jelas.</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Preview and Action */}
            <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 flex flex-col items-center justify-center min-h-[180px]">
              {scanImagePreview ? (
                <div className="w-full space-y-3">
                  <div className="relative max-h-56 overflow-hidden rounded-lg border border-slate-200 bg-black/5 flex items-center justify-center">
                    <img
                      src={scanImagePreview}
                      alt="Foto Faktur"
                      className="max-h-52 w-auto object-contain rounded-md"
                    />
                  </div>

                  {compressionInfo && (
                    <div className="flex items-center justify-between text-[11px] text-slate-600 bg-emerald-50 border border-emerald-200/80 px-2.5 py-1.5 rounded-lg">
                      <span>Ukuran Foto: <span className="line-through text-slate-400 mr-1">{compressionInfo.original}</span><strong className="text-emerald-700">{compressionInfo.compressed}</strong></span>
                      <span className="text-emerald-700 font-semibold">{compressionInfo.ratio}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      id="btn-clear-scan-photo"
                      onClick={() => {
                        setScanImagePreview(null);
                        setCompressionInfo(null);
                        setScanStatus(null);
                        setScanError(null);
                      }}
                      className="inline-flex items-center gap-1 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 px-2.5 py-1.5 rounded-lg font-medium transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Hapus Foto</span>
                    </button>
                    <button
                      type="button"
                      id="btn-scan-ocr-submit"
                      onClick={handleProcessScan}
                      disabled={isProcessing || isCompressing}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold transition-colors shadow-xs disabled:opacity-50"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{isProcessing ? 'Mengekstrak AI...' : 'Ekstrak Produk Dari Foto'}</span>
                    </button>
                  </div>
                </div>
              ) : isCompressing ? (
                <div className="text-center text-teal-700 py-6 space-y-2">
                  <RefreshCw className="w-7 h-7 mx-auto text-teal-600 animate-spin" />
                  <p className="text-xs font-medium">Mengompresi & menyiapkan foto faktur...</p>
                </div>
              ) : (
                <div className="text-center text-slate-400 py-6">
                  <Upload className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  <p className="text-xs">Belum ada foto yang dipilih</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Ambil foto dari kamera atau pilih file gambar dari galeri
                  </p>
                </div>
              )}

              {/* Status or Error */}
              {scanStatus && (
                <div className="mt-2 text-xs text-teal-700 font-medium text-center flex items-center justify-center gap-1.5">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  <span>{scanStatus}</span>
                </div>
              )}
              {scanError && (
                <div className="mt-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 p-3 rounded-xl text-center w-full space-y-2">
                  <p className="font-medium leading-relaxed">{scanError}</p>
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                    {scanImagePreview && (
                      <button
                        type="button"
                        onClick={handleProcessScan}
                        disabled={isProcessing}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs transition-colors"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin' : ''}`} />
                        <span>{isProcessing ? 'Mencoba lagi...' : 'Coba Lagi Sekarang'}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setActiveTab('paste')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-rose-300 text-rose-700 hover:bg-rose-100/50 text-xs font-medium transition-colors"
                    >
                      <Clipboard className="w-3.5 h-3.5" />
                      <span>Gunakan Ekstraksi Teks (Regex)</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Tambah Baris Manual */}
      {activeTab === 'manual' && (
        <form onSubmit={handleManualAddSubmit} className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Nama Obat & Kemasan *
              </label>
              <input
                type="text"
                id="input-manual-nama"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                placeholder="Contoh: AMOXICILLIN 500MG BOX 100 TAB"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-hidden bg-slate-50/50"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Jumlah (Qty)</label>
              <input
                type="number"
                id="input-manual-qty"
                value={manualQty === 0 ? '' : manualQty}
                onChange={(e) => handleManualQtyChange(parseFloat(e.target.value) || 0)}
                min="1"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-hidden bg-slate-50/50 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Harga Beli (Rp)
                <span className="text-[10px] text-slate-400 ml-1">(titik ribuan, 2 desimal)</span>
              </label>
              <CurrencyInput
                id="input-manual-price"
                value={manualPrice}
                onChange={handleManualPriceChange}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-hidden bg-slate-50/50 font-mono text-right"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Diskon 1 (%)</label>
              <PercentInput
                id="input-manual-disc1"
                value={manualDisc1}
                onChange={handleManualDisc1Change}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-hidden bg-slate-50/50 font-mono text-center"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Diskon Bertingkat (%)
              </label>
              <PercentInput
                id="input-manual-disc2"
                value={manualDisc2}
                onChange={handleManualDisc2Change}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-hidden bg-slate-50/50 font-mono text-center"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-amber-800 mb-1">
                Nominal Diskon (Rp)
                <span className="text-[10px] text-amber-600 ml-1">⇄ Diskon 1 (%)</span>
              </label>
              <CurrencyInput
                id="input-manual-nominal"
                value={manualNominalDiskon}
                onChange={handleManualNominalChange}
                className="w-full text-xs px-3 py-2 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-hidden bg-amber-50/30 font-mono text-right font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Tanggal Exp (contoh: 12/29)
              </label>
              <input
                type="text"
                id="input-manual-exp"
                value={manualExp}
                onChange={(e) => setManualExp(e.target.value)}
                placeholder="12/29 atau 01/12/2029"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-hidden bg-slate-50/50 font-mono"
              />
            </div>

            <div className="sm:col-span-2 lg:col-span-1">
              <label className="block text-xs font-medium text-slate-600 mb-1">No. Batch</label>
              <input
                type="text"
                id="input-manual-batch"
                value={manualBatch}
                onChange={(e) => setManualBatch(e.target.value)}
                placeholder="BTH-991A"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-hidden bg-slate-50/50 font-mono"
              />
            </div>
          </div>

          {/* Live Preview Calculation Bar */}
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-slate-600">
              <span>Subtotal Bruto:</span>
              <span className="font-mono font-semibold text-slate-800">
                {formatRupiah((manualQty || 0) * (manualPrice || 0))}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-amber-700">
              <span>Potongan Diskon:</span>
              <span className="font-mono font-semibold">
                {formatRupiah(manualNominalDiskon || 0)}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-emerald-700">
              <span>HPP / Unit:</span>
              <span className="font-mono font-semibold">
                {formatRupiah(
                  (manualQty || 0) > 0
                    ? Math.max(0, (manualQty || 0) * (manualPrice || 0) - (manualNominalDiskon || 0)) / (manualQty || 1)
                    : 0
                )}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-teal-900">
              <span>Total Net:</span>
              <span className="font-mono font-bold text-teal-800">
                {formatRupiah(Math.max(0, (manualQty || 0) * (manualPrice || 0) - (manualNominalDiskon || 0)))}
              </span>
            </div>
          </div>

          {manualError && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center justify-between">
              <span>{manualError}</span>
              <button
                type="button"
                onClick={() => setManualError(null)}
                className="text-rose-500 hover:text-rose-800 p-0.5 rounded cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => {
                setManualName('');
                setManualQty(1);
                setManualPrice(0);
                setManualDisc1(0);
                setManualDisc2(0);
                setManualNominalDiskon(0);
                setManualExp('');
                setManualBatch('');
                setManualError(null);
              }}
              className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 px-2 py-1 rounded hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
              <span>Reset Form</span>
            </button>

            <button
              type="submit"
              id="btn-manual-submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold transition-colors shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambahkan Baris Obat</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
