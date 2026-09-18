import React, { useState } from 'react';
import { FakturRekapRecord } from '../types';
import { formatRupiah } from '../utils/calculations';
import {
  X,
  History,
  Trash2,
  FolderOpen,
  Calendar,
  Building2,
  FileText,
  AlertTriangle,
  Search,
} from 'lucide-react';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  records: FakturRekapRecord[];
  onLoadRecord: (record: FakturRekapRecord) => void;
  onDeleteRecord: (id: string) => void;
  onClearAllHistory: () => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  isOpen,
  onClose,
  records,
  onLoadRecord,
  onDeleteRecord,
  onClearAllHistory,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isConfirmingClearAll, setIsConfirmingClearAll] = useState(false);

  if (!isOpen) return null;

  const filtered = records.filter((rec) => {
    const query = searchTerm.toLowerCase();
    return (
      (rec.header.noFaktur || '').toLowerCase().includes(query) ||
      (rec.header.namaPBF || '').toLowerCase().includes(query) ||
      (rec.items || []).some((item) => item.namaObat.toLowerCase().includes(query))
    );
  });

  const selectedRecord = records.find((r) => r.id === selectedRecordId);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">
                Riwayat Rekapan Faktur PBF
              </h2>
              <p className="text-xs text-slate-500">
                Data rekapan tersimpan otomatis & dapat dibuka kembali atau dihapus
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {records.length > 0 && (
              isConfirmingClearAll ? (
                <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-200 px-2 py-1 rounded-lg">
                  <span className="text-xs text-rose-800 font-medium">Hapus semua?</span>
                  <button
                    type="button"
                    id="btn-confirm-clear-all-history"
                    onClick={() => {
                      onClearAllHistory();
                      setIsConfirmingClearAll(false);
                    }}
                    className="text-xs bg-rose-600 hover:bg-rose-700 text-white font-semibold px-2 py-0.5 rounded cursor-pointer transition-colors"
                  >
                    Ya
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsConfirmingClearAll(false)}
                    className="text-xs text-slate-600 hover:text-slate-800 px-1.5 py-0.5 rounded hover:bg-rose-100 cursor-pointer transition-colors"
                  >
                    Batal
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  id="btn-delete-all-history"
                  onClick={() => setIsConfirmingClearAll(true)}
                  className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2.5 py-1.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus Semua</span>
                </button>
              )
            )}
            <button
              type="button"
              id="btn-close-history-modal"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="px-6 py-3 border-b border-slate-200 bg-white">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari berdasarkan No. Faktur, Nama PBF, atau Nama Obat..."
              className="w-full text-xs pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>

        {/* Modal Body: Split view (List on left, Preview on right) */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200 min-h-[350px]">
          {/* Left Column: History Records List */}
          <div className="overflow-y-auto max-h-[450px] p-4 space-y-2.5 custom-scrollbar">
            {filtered.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <History className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p className="text-xs">Tidak ada riwayat rekapan yang ditemukan.</p>
              </div>
            ) : (
              filtered.map((rec) => {
                const isSelected = rec.id === selectedRecordId;
                const formattedDate = new Date(rec.updatedAt).toLocaleString('id-ID', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <div
                    key={rec.id}
                    onClick={() => setSelectedRecordId(rec.id)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-teal-500 bg-teal-50/40 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800">
                          <FileText className="w-3.5 h-3.5 text-teal-600" />
                          <span>{rec.header.noFaktur || 'Tanpa No. Faktur'}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-600 mt-0.5">
                          <Building2 className="w-3 h-3 text-slate-400" />
                          <span>{rec.header.namaPBF || 'Distributor Umum'}</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-xs font-bold text-slate-900 font-mono">
                          {formatRupiah(rec.summary.grandTotal)}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {rec.items.length} item obat
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-100 text-[11px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formattedDate}
                      </span>

                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => {
                            onLoadRecord(rec);
                            onClose();
                          }}
                          className="inline-flex items-center gap-1 text-teal-700 hover:text-teal-800 font-semibold px-2 py-1 rounded hover:bg-teal-100/60 cursor-pointer"
                        >
                          <FolderOpen className="w-3.5 h-3.5" />
                          <span>Buka</span>
                        </button>

                        {confirmDeleteId === rec.id ? (
                          <div className="flex items-center gap-1 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded">
                            <span className="text-[10px] text-rose-800 font-semibold">Hapus?</span>
                            <button
                              type="button"
                              onClick={() => {
                                onDeleteRecord(rec.id);
                                if (selectedRecordId === rec.id) {
                                  setSelectedRecordId(null);
                                }
                                setConfirmDeleteId(null);
                              }}
                              className="text-[10px] bg-rose-600 hover:bg-rose-700 text-white font-bold px-1.5 py-0.5 rounded cursor-pointer transition-colors"
                            >
                              Ya
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="text-[10px] text-slate-500 hover:text-slate-800 px-1 py-0.5 rounded cursor-pointer"
                            >
                              Batal
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            id={`btn-delete-history-${rec.id}`}
                            onClick={() => setConfirmDeleteId(rec.id)}
                            className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Hapus rekapan ini dari riwayat"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Right Column: Record Preview */}
          <div className="p-4 overflow-y-auto max-h-[450px] bg-slate-50/40 custom-scrollbar">
            {selectedRecord ? (
              <div className="space-y-4">
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">
                      {selectedRecord.header.noFaktur || 'Faktur'}
                    </span>
                    <span className="text-xs font-bold text-teal-700 font-mono">
                      {formatRupiah(selectedRecord.summary.grandTotal)}
                    </span>
                  </div>
                  <div className="text-xs text-slate-600">
                    PBF: <span className="font-medium">{selectedRecord.header.namaPBF || '-'}</span>
                  </div>
                  <div className="text-xs text-slate-600">
                    Tgl Faktur: <span className="font-medium">{selectedRecord.header.tanggalFaktur || '-'}</span>
                  </div>

                  <div className="flex items-center gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => {
                        onLoadRecord(selectedRecord);
                        onClose();
                      }}
                      className="flex-1 inline-flex items-center justify-center gap-2 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
                    >
                      <FolderOpen className="w-4 h-4" />
                      <span>Muat ke Tabel Kerja</span>
                    </button>
                    <button
                      type="button"
                      id="btn-delete-selected-history"
                      onClick={() => {
                        onDeleteRecord(selectedRecord.id);
                        setSelectedRecordId(null);
                      }}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                      title="Hapus rekapan ini dari riwayat"
                    >
                      <Trash2 className="w-4 h-4 text-rose-600" />
                      <span>Hapus</span>
                    </button>
                  </div>
                </div>

                {/* Items List inside record */}
                <div>
                  <h4 className="text-xs font-semibold text-slate-700 mb-2">
                    Daftar Obat ({selectedRecord.items.length}):
                  </h4>
                  <div className="space-y-1.5">
                    {selectedRecord.items.map((item, idx) => (
                      <div
                        key={item.id || idx}
                        className="bg-white p-2.5 rounded-lg border border-slate-200 text-xs flex items-center justify-between"
                      >
                        <div>
                          <div className="font-medium text-slate-800">{item.namaObat}</div>
                          <div className="text-[11px] text-slate-500">
                            {item.jumlah} x {formatRupiah(item.hargaBeli)} | Disc: {item.diskonPersen}%
                            {item.diskonBertingkatPersen > 0 && ` + ${item.diskonBertingkatPersen}%`} | Exp: {item.tanggalExp}
                          </div>
                        </div>
                        <div className="text-right font-mono font-bold text-slate-800">
                          {formatRupiah(item.total)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 py-12">
                <FolderOpen className="w-8 h-8 text-slate-300 mb-2" />
                <p className="text-xs">Pilih rekapan di sebelah kiri untuk melihat rincian.</p>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-medium rounded-lg transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
