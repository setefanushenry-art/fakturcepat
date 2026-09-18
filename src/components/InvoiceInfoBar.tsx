import React from 'react';
import { FakturHeader } from '../types';
import { FileText, Building2, Calendar, Edit3 } from 'lucide-react';

interface InvoiceInfoBarProps {
  header: FakturHeader;
  onChange: (header: FakturHeader) => void;
  itemCount: number;
}

const COMMON_PBFS = [
  'PT Enseval Putera Megatrading Tbk',
  'PT Kimia Farma Trading & Distribution',
  'PT Anugrah Argon Medica (AAM)',
  'PT Anugrah Pharmindo Lestari (APL)',
  'PT Mensa Binasukses (MBS)',
  'PT Parit Padang Global',
  'PT Tempo Scan Pacific Tbk',
  'PT Penta Valent',
  'PT Dos Ni Roha',
  'PT Antar Mitra Sembada',
];

export const InvoiceInfoBar: React.FC<InvoiceInfoBarProps> = ({ header, onChange, itemCount }) => {
  const handleChange = (field: keyof FakturHeader, val: string) => {
    onChange({
      ...header,
      [field]: val,
    });
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
      <div className="flex flex-col lg:flex-row lg:items-center gap-4 justify-between">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
          {/* No Faktur */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-teal-600" />
              <span>No. Faktur PBF</span>
            </label>
            <input
              type="text"
              id="input-no-faktur"
              value={header.noFaktur}
              onChange={(e) => handleChange('noFaktur', e.target.value)}
              placeholder="Contoh: FP-2026/0891"
              className="w-full text-xs sm:text-sm px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-slate-50/50"
            />
          </div>

          {/* Nama PBF */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-teal-600" />
              <span>Nama Distributor / PBF</span>
            </label>
            <div className="relative">
              <input
                type="text"
                id="input-nama-pbf"
                list="pbf-list"
                value={header.namaPBF}
                onChange={(e) => handleChange('namaPBF', e.target.value)}
                placeholder="Contoh: PT Enseval Putera Megatrading"
                className="w-full text-xs sm:text-sm px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-slate-50/50"
              />
              <datalist id="pbf-list">
                {COMMON_PBFS.map((pbf) => (
                  <option key={pbf} value={pbf} />
                ))}
              </datalist>
            </div>
          </div>

          {/* Tanggal Faktur */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-teal-600" />
              <span>Tanggal Faktur</span>
            </label>
            <input
              type="text"
              id="input-tanggal-faktur"
              value={header.tanggalFaktur}
              onChange={(e) => handleChange('tanggalFaktur', e.target.value)}
              placeholder="DD/MM/YYYY"
              className="w-full text-xs sm:text-sm px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-slate-50/50"
            />
          </div>
        </div>

        {/* Quick Meta Stats */}
        <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
          <div className="text-right">
            <div className="text-[11px] text-slate-500 uppercase tracking-wider font-medium">
              Data Terekap
            </div>
            <div className="text-base font-bold text-slate-800">
              {itemCount} <span className="text-xs font-normal text-slate-500">Baris Obat</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
