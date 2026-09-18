import React from 'react';
import { Pill, History, Save, PlusCircle, CheckCircle2, AlertTriangle } from 'lucide-react';

interface HeaderProps {
  autoSaveSecondsLeft: number;
  lastSavedTime: string | null;
  historyCount: number;
  onOpenHistory: () => void;
  onManualSave: () => void;
  onNewRekap: () => void;
  hasErrors: boolean;
  itemCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  autoSaveSecondsLeft,
  lastSavedTime,
  historyCount,
  onOpenHistory,
  onManualSave,
  onNewRekap,
  hasErrors,
  itemCount,
}) => {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          {/* Brand & Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-xs">
              <Pill className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                  Rekap Faktur PBF Farmasi
                </h1>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-teal-50 text-teal-700 border border-teal-200">
                  Regex & Vision
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Ekstraksi otomatis teks faktur, scan galeri, sinkronisasi diskon bertingkat & validasi kedaluwarsa
              </p>
            </div>
          </div>

          {/* Action Bar & Auto-save status */}
          <div className="flex flex-wrap items-center gap-2">
            {/* 30-sec Auto Save Indicator */}
            <div
              id="auto-save-indicator"
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600"
              title="Aplikasi otomatis menyimpan data setiap 30 detik"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="font-medium text-slate-700">Auto Save:</span>
              <span className="text-slate-500 tabular-nums">{autoSaveSecondsLeft}s</span>
              {lastSavedTime && (
                <span className="text-[11px] text-slate-400 hidden md:inline">
                  (tersimpan {lastSavedTime})
                </span>
              )}
            </div>

            {/* Validation Badge */}
            {itemCount > 0 && (
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border ${
                  hasErrors
                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                    : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                }`}
              >
                {hasErrors ? (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    <span>Perlu Perbaikan</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Semua Valid</span>
                  </>
                )}
              </div>
            )}

            {/* Riwayat Rekapan Button */}
            <button
              id="btn-open-history"
              onClick={onOpenHistory}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-medium transition-colors shadow-xs active:bg-slate-100"
            >
              <History className="w-3.5 h-3.5 text-slate-500" />
              <span>Riwayat</span>
              {historyCount > 0 && (
                <span className="px-1.5 py-0.2 bg-teal-100 text-teal-800 rounded-full text-[11px] font-semibold">
                  {historyCount}
                </span>
              )}
            </button>

            {/* Simpan Sekarang */}
            <button
              id="btn-manual-save"
              onClick={onManualSave}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-medium transition-colors shadow-xs active:bg-teal-800"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Simpan</span>
            </button>

            {/* Rekap Baru */}
            <button
              id="btn-new-rekap"
              onClick={onNewRekap}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition-colors active:bg-slate-300"
              title="Mulai lembar rekap faktur baru"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Baru</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
