import React, { useState, useEffect, useRef, useMemo } from 'react';
import { FakturHeader, FakturItem, FakturRekapRecord, FakturSummary, DiscountSyncSource } from './types';
import {
  calculateItemRow,
  reindexAndRecalculateItems,
  calculateGrandSummary,
} from './utils/calculations';
import { normalizeExpiryDate } from './utils/validation';
import { parsePbfInvoiceText, SAMPLE_PBF_INVOICES } from './utils/pbfRegexParser';
import { exportFakturToCsv, generateWhatsAppSummary } from './utils/exportHelpers';

import { Header } from './components/Header';
import { InvoiceInfoBar } from './components/InvoiceInfoBar';
import { InputExtractor } from './components/InputExtractor';
import { FakturTable } from './components/FakturTable';
import { SummaryCards } from './components/SummaryCards';
import { HistoryModal } from './components/HistoryModal';
import { Toast, ToastMessage } from './components/Toast';
import { ConfirmModal, ConfirmDialogState } from './components/ConfirmModal';

const STORAGE_ACTIVE_KEY = 'pbf_active_draft_v1';
const STORAGE_HISTORY_KEY = 'pbf_history_records_v1';
const AUTO_SAVE_INTERVAL_SECONDS = 30;

export default function App() {
  // Initial Header state
  const [header, setHeader] = useState<FakturHeader>({
    id: `faktur_${Date.now()}`,
    noFaktur: 'FP-ENS/2026/0891',
    namaPBF: 'PT Enseval Putera Megatrading Tbk',
    tanggalFaktur: '11/09/2026',
    catatan: '',
  });

  // Initial Items state
  const [items, setItems] = useState<FakturItem[]>(() => {
    // Check if active draft exists in localStorage
    try {
      const saved = localStorage.getItem(STORAGE_ACTIVE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.isCleared) {
          return [];
        }
        if (parsed.items && Array.isArray(parsed.items)) {
          return reindexAndRecalculateItems(parsed.items);
        }
      }
    } catch (e) {
      console.error('Failed to parse active draft:', e);
    }

    // Default sample on initial launch only
    const initialParsed = parsePbfInvoiceText(SAMPLE_PBF_INVOICES[0].text);
    return initialParsed.items;
  });

  // History modal & records
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [historyRecords, setHistoryRecords] = useState<FakturRekapRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_HISTORY_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Auto-save countdown
  const [autoSaveSecondsLeft, setAutoSaveSecondsLeft] = useState(AUTO_SAVE_INTERVAL_SECONDS);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);

  // Toast notifications
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const addToast = (
    type: ToastMessage['type'],
    text: string,
    action?: { label: string; onClick: () => void }
  ) => {
    const id = `toast_${Date.now()}_${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, text, action }]);
  };

  // Grand summary recalculation
  const summary: FakturSummary = useMemo(() => {
    return calculateGrandSummary(
      items,
      header.cashDiskonPersen ?? 2,
      header.ppnPersen ?? 12
    );
  }, [items, header.cashDiskonPersen, header.ppnPersen]);

  // Ref to hold current state for interval auto-save without closure staleness
  const stateRef = useRef({ header, items, summary });
  useEffect(() => {
    stateRef.current = { header, items, summary };
  }, [header, items, summary]);

  // Core Save Routine
  const saveCurrentDraft = (isAutomatic = false) => {
    const current = stateRef.current;

    try {
      const draftPayload = {
        header: current.header,
        items: current.items,
        updatedAt: new Date().toISOString(),
        isCleared: current.items.length === 0,
      };
      localStorage.setItem(STORAGE_ACTIVE_KEY, JSON.stringify(draftPayload));

      // Save/update snapshot in history list if there are items
      if (current.items.length > 0) {
        setHistoryRecords((prev) => {
          const existingIndex = prev.findIndex((r) => r.id === current.header.id);
          const recordSnapshot: FakturRekapRecord = {
            id: current.header.id,
            createdAt: existingIndex >= 0 ? prev[existingIndex].createdAt : new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            header: current.header,
            items: current.items,
            summary: current.summary,
          };

          let updatedHistory: FakturRekapRecord[];
          if (existingIndex >= 0) {
            updatedHistory = [...prev];
            updatedHistory[existingIndex] = recordSnapshot;
          } else {
            updatedHistory = [recordSnapshot, ...prev];
          }

          // Keep last 30 records
          if (updatedHistory.length > 30) {
            updatedHistory = updatedHistory.slice(0, 30);
          }

          localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(updatedHistory));
          return updatedHistory;
        });
      }

      const nowStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setLastSavedTime(nowStr);

      if (!isAutomatic) {
        addToast('success', `Data faktur "${current.header.noFaktur || 'Rekap'}" berhasil disimpan.`);
      }
    } catch (e) {
      console.error('Error saving:', e);
    }
  };

  // 30-Second Auto Save Interval Timer
  useEffect(() => {
    const timer = setInterval(() => {
      setAutoSaveSecondsLeft((prev) => {
        if (prev <= 1) {
          saveCurrentDraft(true);
          return AUTO_SAVE_INTERVAL_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Update item row with automatic re-calculation and bidirectional discount sync
  const handleUpdateItem = (
    index: number,
    updatedItem: FakturItem,
    syncSource: DiscountSyncSource = 'auto'
  ) => {
    setItems((prev) => {
      const copy = [...prev];
      // Run automatic recalculation and sync according to source
      copy[index] = calculateItemRow(updatedItem, syncSource);
      return copy;
    });
  };

  // Delete item row
  const handleDeleteItem = (index: number) => {
    const deletedItem = items[index];
    if (!deletedItem) return;

    setItems((prev) => {
      const filtered = prev.filter((_, i) => i !== index);
      const reindexed = reindexAndRecalculateItems(filtered);
      try {
        localStorage.setItem(
          STORAGE_ACTIVE_KEY,
          JSON.stringify({
            header,
            items: reindexed,
            updatedAt: new Date().toISOString(),
            isCleared: reindexed.length === 0,
          })
        );
      } catch (e) {
        console.error(e);
      }
      return reindexed;
    });

    addToast('info', `Baris obat "${deletedItem.namaObat || 'obat'}" dihapus.`, {
      label: 'Urungkan',
      onClick: () => {
        setItems((prev) => {
          const restored = [...prev];
          restored.splice(index, 0, deletedItem);
          const reindexed = reindexAndRecalculateItems(restored);
          try {
            localStorage.setItem(
              STORAGE_ACTIVE_KEY,
              JSON.stringify({
                header,
                items: reindexed,
                updatedAt: new Date().toISOString(),
                isCleared: false,
              })
            );
          } catch (e) {
            console.error(e);
          }
          return reindexed;
        });
        addToast('success', 'Baris obat berhasil dipulihkan.');
      },
    });
  };

  // Duplicate item row
  const handleDuplicateItem = (index: number) => {
    const target = items[index];
    if (!target) return;
    const duplicated = calculateItemRow({
      ...target,
      id: `item_${Date.now()}_${Math.random()}`,
      urutan: items.length + 1,
      namaObat: `${target.namaObat} (Salinan)`,
    });

    setItems((prev) => {
      const copy = [...prev];
      copy.splice(index + 1, 0, duplicated);
      return reindexAndRecalculateItems(copy);
    });
    addToast('info', 'Baris obat berhasil digandakan.');
  };

  // Add single empty row
  const handleAddNewRow = () => {
    const newEmpty = calculateItemRow({
      id: `item_${Date.now()}`,
      urutan: items.length + 1,
      namaObat: '',
      jumlah: 1,
      hargaBeli: 0,
      diskonPersen: 0,
      diskonBertingkatPersen: 0,
      nominalDiskon: 0,
      tanggalExp: '01/12/2028',
      noBatch: '',
    });
    setItems((prev) => [...prev, newEmpty]);
  };

  // Auto-fix single item (e.g. normalize 12/29 -> 01/12/2029 or cap discount)
  const handleAutoFixItem = (index: number) => {
    setItems((prev) => {
      const copy = [...prev];
      const item = copy[index];
      if (!item) return prev;

      // Fix Expiry Date if needed
      const expNorm = normalizeExpiryDate(item.tanggalExp);
      const fixedExp = expNorm.isValid ? expNorm.formatted : '01/12/2029';

      // Fix Discounts if needed
      const subtotal = item.jumlah * item.hargaBeli;
      const fixedDisc1 = Math.min(100, Math.max(0, item.diskonPersen || 0));
      const fixedDisc2 = Math.min(100, Math.max(0, item.diskonBertingkatPersen || 0));
      const fixedNominal = Math.min(subtotal, Math.max(0, item.nominalDiskon || 0));

      copy[index] = calculateItemRow({
        ...item,
        tanggalExp: fixedExp,
        diskonPersen: fixedDisc1,
        diskonBertingkatPersen: fixedDisc2,
        nominalDiskon: fixedNominal,
      });

      return copy;
    });
    addToast('success', 'Data baris berhasil diperbaiki otomatis.');
  };

  // Auto-fix all invalid items
  const handleAutoFixAll = () => {
    setItems((prev) => {
      return prev.map((item) => {
        const expNorm = normalizeExpiryDate(item.tanggalExp);
        const fixedExp = expNorm.isValid ? expNorm.formatted : '01/12/2029';
        const subtotal = item.jumlah * item.hargaBeli;
        const fixedDisc1 = Math.min(100, Math.max(0, item.diskonPersen || 0));
        const fixedDisc2 = Math.min(100, Math.max(0, item.diskonBertingkatPersen || 0));
        const fixedNominal = Math.min(subtotal, Math.max(0, item.nominalDiskon || 0));

        return calculateItemRow({
          ...item,
          tanggalExp: fixedExp,
          diskonPersen: fixedDisc1,
          diskonBertingkatPersen: fixedDisc2,
          nominalDiskon: fixedNominal,
        });
      });
    });
    addToast('success', 'Semua data tanggal dan diskon berhasil disinkronisasi & diperbaiki.');
  };

  // Handle Extraction Success (from Regex or OCR Vision)
  const handleExtractSuccess = (
    extractedItems: FakturItem[],
    extractedHeader?: Partial<FakturHeader>,
    isAppend = false
  ) => {
    if (extractedHeader) {
      setHeader((prev) => ({
        ...prev,
        noFaktur: extractedHeader.noFaktur || prev.noFaktur,
        namaPBF: extractedHeader.namaPBF || prev.namaPBF,
        tanggalFaktur: extractedHeader.tanggalFaktur || prev.tanggalFaktur,
      }));
    }

    setItems((prev) => {
      const combined = isAppend ? [...prev, ...extractedItems] : extractedItems;
      return reindexAndRecalculateItems(combined);
    });

    addToast(
      'success',
      `Berhasil mengekstrak ${extractedItems.length} produk obat dari faktur.`
    );
  };

  // Core Clear All Table items routine with ConfirmModal and Undo support
  const handleClearAllTable = () => {
    if (items.length === 0) {
      addToast('info', 'Tabel rekap sudah dalam kondisi kosong.');
      return;
    }

    const backupItems = [...items];

    setConfirmDialog({
      isOpen: true,
      title: 'Kosongkan Seluruh Tabel Rekap?',
      message: `Apakah Anda yakin ingin mengosongkan seluruh ${items.length} baris obat pada tabel aktif saat ini? Anda dapat mengembalikan data menggunakan tombol Urungkan.`,
      confirmLabel: 'Ya, Kosongkan Tabel',
      cancelLabel: 'Batal',
      variant: 'danger',
      onConfirm: () => {
        setItems([]);
        try {
          localStorage.setItem(
            STORAGE_ACTIVE_KEY,
            JSON.stringify({
              header,
              items: [],
              updatedAt: new Date().toISOString(),
              isCleared: true,
            })
          );
        } catch (e) {
          console.error(e);
        }
        addToast('info', 'Semua baris obat pada tabel berhasil dikosongkan.', {
          label: 'Urungkan',
          onClick: () => {
            const restored = reindexAndRecalculateItems(backupItems);
            setItems(restored);
            try {
              localStorage.setItem(
                STORAGE_ACTIVE_KEY,
                JSON.stringify({
                  header,
                  items: restored,
                  updatedAt: new Date().toISOString(),
                  isCleared: false,
                })
              );
            } catch (e) {
              console.error(e);
            }
            addToast('success', 'Tabel obat berhasil dipulihkan.');
          },
        });
      },
    });
  };

  // Handle New Rekap (Reset)
  const handleNewRekap = () => {
    if (items.length > 0) {
      setConfirmDialog({
        isOpen: true,
        title: 'Buat Lembar Rekap Baru?',
        message: 'Lembar faktur saat ini akan disimpan otomatis ke Riwayat Faktur sebelum membuka lembar rekap baru yang bersih.',
        confirmLabel: 'Buat Lembar Baru',
        cancelLabel: 'Batal',
        variant: 'primary',
        onConfirm: () => {
          doCreateNewRekap();
        },
      });
    } else {
      doCreateNewRekap();
    }
  };

  const doCreateNewRekap = () => {
    saveCurrentDraft(true);
    const newId = `faktur_${Date.now()}`;
    const newHeader: FakturHeader = {
      id: newId,
      noFaktur: '',
      namaPBF: '',
      tanggalFaktur: new Date().toLocaleDateString('id-ID'),
      catatan: '',
    };
    setHeader(newHeader);
    setItems([]);
    try {
      localStorage.setItem(
        STORAGE_ACTIVE_KEY,
        JSON.stringify({
          header: newHeader,
          items: [],
          updatedAt: new Date().toISOString(),
          isCleared: true,
        })
      );
    } catch (e) {
      console.error(e);
    }
    addToast('info', 'Lembar rekap baru siap digunakan.');
  };

  // Load Record from History
  const handleLoadRecord = (record: FakturRekapRecord) => {
    setHeader(record.header);
    setItems(reindexAndRecalculateItems(record.items));
    addToast('success', `Rekapan "${record.header.noFaktur || 'Faktur'}" berhasil dimuat.`);
  };

  // Delete Record from History
  const handleDeleteRecord = (id: string) => {
    setHistoryRecords((prev) => {
      const filtered = prev.filter((r) => r.id !== id);
      localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(filtered));
      return filtered;
    });
    addToast('info', 'Rekapan riwayat berhasil dihapus.');
  };

  // Clear all History
  const handleClearAllHistory = () => {
    setHistoryRecords([]);
    localStorage.removeItem(STORAGE_HISTORY_KEY);
    addToast('info', 'Seluruh riwayat rekapan telah dibersihkan.');
  };

  // Export CSV
  const handleExportCsv = () => {
    exportFakturToCsv(header, items, summary);
    addToast('success', 'File CSV berhasil diunduh untuk Excel.');
  };

  // Copy WhatsApp format
  const handleCopyFormattedText = async () => {
    const text = generateWhatsAppSummary(header, items, summary);
    try {
      await navigator.clipboard.writeText(text);
      addToast('success', 'Ringkasan berhasil disalin ke clipboard.');
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      addToast('success', 'Ringkasan disalin ke clipboard.');
    }
  };

  // Print
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col font-sans">
      {/* Top Header */}
      <Header
        autoSaveSecondsLeft={autoSaveSecondsLeft}
        lastSavedTime={lastSavedTime}
        historyCount={historyRecords.length}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onManualSave={() => saveCurrentDraft(false)}
        onNewRekap={handleNewRekap}
        hasErrors={summary.itemWithErrorsCount > 0}
        itemCount={items.length}
      />

      {/* Main Content Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-5">
        {/* Invoice Info Bar */}
        <InvoiceInfoBar
          header={header}
          onChange={setHeader}
          itemCount={items.length}
        />

        {/* Input Extractor (Paste Regex, Camera/Gallery Scan, or Manual Add) */}
        <InputExtractor
          onExtractSuccess={handleExtractSuccess}
          onAddItem={(newItem) => {
            setItems((prev) => reindexAndRecalculateItems([...prev, newItem]));
            addToast('success', `Obat "${newItem.namaObat}" ditambahkan.`);
          }}
          existingCount={items.length}
        />

        {/* Core Faktur Table */}
        <FakturTable
          items={items}
          onUpdateItem={handleUpdateItem}
          onDeleteItem={handleDeleteItem}
          onDuplicateItem={handleDuplicateItem}
          onAddNewRow={handleAddNewRow}
          onAutoFixItem={handleAutoFixItem}
          onClearAll={handleClearAllTable}
        />

        {/* Grand Summary & Action Cards */}
        <SummaryCards
          summary={summary}
          header={header}
          items={items}
          onAutoFixAll={handleAutoFixAll}
          onClearAll={handleClearAllTable}
          onExportCsv={handleExportCsv}
          onCopyFormattedText={handleCopyFormattedText}
          onPrint={handlePrint}
        />
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-slate-500 border-t border-slate-200 bg-white">
        <p>
          Rekap Faktur PBF Farmasi &copy; 2026 &bull; Kompatibel Android, iOS & Web &bull; Auto Save 30 Detik Aktif
        </p>
      </footer>

      {/* History Modal */}
      <HistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        records={historyRecords}
        onLoadRecord={handleLoadRecord}
        onDeleteRecord={handleDeleteRecord}
        onClearAllHistory={handleClearAllHistory}
      />

      {/* Confirmation Modal */}
      <ConfirmModal
        dialog={confirmDialog}
        onClose={() => setConfirmDialog(null)}
      />

      {/* Toast Notifications */}
      <Toast
        toasts={toasts}
        onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
      />
    </div>
  );
}
