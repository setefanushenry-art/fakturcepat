import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

// Middleware for parsing JSON with generous limit for base64 photo scans
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Custom middleware to catch body-parser errors (like PayloadTooLargeError or JSON syntax errors)
// and guarantee JSON responses instead of Express HTML error pages
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err && (err.type === 'entity.too.large' || err.status === 413 || err.statusCode === 413)) {
    return res.status(413).json({
      error: 'Ukuran payload foto terlalu besar untuk diproses server. Harap gunakan foto yang sudah dikompresi otomatis.',
    });
  }
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({
      error: 'Format data JSON tidak valid.',
    });
  }
  next(err);
});

// Lazy init for Gemini SDK
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return aiClient;
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    timestamp: new Date().toISOString(),
  });
});

/**
 * Scan & Parse Invoice Image (from Camera or Gallery) using Gemini Vision OCR
 */
app.post('/api/scan-invoice-image', async (req, res) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg' } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'Data gambar (imageBase64) wajib dikirimkan.' });
    }

    const cleanBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');

    const ai = getGeminiClient();
    if (!ai) {
      return res.status(503).json({
        error: 'GEMINI_API_KEY belum dikonfigurasi di server. Anda tetap dapat menggunakan input Teks & Regex.',
      });
    }

    const systemPrompt = `Anda adalah asisten Apoteker dan Administrasi Farmasi profesional Indonesia yang ahli membaca dan mengekstrak faktur Pedagang Besar Farmasi (PBF) seperti PT Enseval, PT Kimia Farma, PT APL, PT Mensa, PT Parit Padang, dll.
Tugas Anda adalah membaca gambar faktur ini dan mengekstrak daftar obat yang dibeli serta informasi faktur.

Aturan Penting:
1. Kolom yang diekstrak per item obat:
   - namaObat: Nama lengkap obat, sediaan, dan kemasan (contoh: "AMOXICILLIN 500MG BOX 100 TAB")
   - jumlah: Kuantitas/Qty angka bulat (contoh: 10)
   - hargaBeli: Harga satuan / HNA sebelum diskon (contoh: 45000)
   - diskonPersen: Diskon utama persen / kode D (contoh: 5 jika diskon 5%)
   - diskonBertingkatPersen: Diskon bertingkat kedua persen jika ada (contoh: 2 jika ada +2% atau D2: 2%)
   - nominalDiskon: Diskon nominal rupiah jika ada (misal kode E, pot, cash discount). Jika ada huruf non-D seperti E, masukkan ke nominalDiskon.
   - tanggalExp: Tanggal kedaluwarsa. Format harus DD/MM/YYYY. Jika di faktur hanya tertulis bulan dan tahun (contoh 12/29 atau 12/2029), otomatis ubah menjadi tanggal 1, contoh: "01/12/2029".
   - noBatch: Nomor batch/lot produksi (contoh: "BTH-9912A")
2. Ekstrak juga informasi faktur jika terlihat:
   - noFaktur (string)
   - namaPBF (string)
   - tanggalFaktur (DD/MM/YYYY)

KEMBALIKAN HANYA JSON MURNI dengan format:
{
  "noFaktur": "...",
  "namaPBF": "...",
  "tanggalFaktur": "...",
  "rawOcrText": "...",
  "items": [
    {
      "namaObat": "...",
      "jumlah": 10,
      "hargaBeli": 45000,
      "diskonPersen": 5,
      "diskonBertingkatPersen": 0,
      "nominalDiskon": 0,
      "tanggalExp": "01/12/2029",
      "noBatch": "..."
    }
  ]
}`;

    // List of candidate models with automatic fallback if a model experiences temporary spikes (503 UNAVAILABLE / 429)
    // 'gemini-3.1-flash-lite' is prioritized first as it has high availability, fast vision OCR throughput, and avoids transient 503 demand spikes
    const candidateModels = [
      'gemini-3.1-flash-lite',
      'gemini-3.6-flash',
      'gemini-flash-latest',
      'gemini-3.8-flash',
    ];
    let lastError: any = null;
    let responseText = '';

    for (const modelName of candidateModels) {
      try {
        console.log(`[OCR] Attempting invoice extraction with model: ${modelName}`);
        const response = await ai.models.generateContent({
          model: modelName,
          contents: [
            {
              role: 'user',
              parts: [
                { text: systemPrompt },
                {
                  inlineData: {
                    data: cleanBase64,
                    mimeType,
                  },
                },
              ],
            },
          ],
          config: {
            responseMimeType: 'application/json',
          },
        });

        if (response && response.text) {
          responseText = response.text;
          console.log(`[OCR] Model ${modelName} succeeded in extracting invoice data.`);
          break; // Succeeded!
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`[OCR] Model ${modelName} encountered error:`, err?.message || err);
        // Pause briefly before trying fallback model
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    if (!responseText) {
      const errStr = String(lastError?.message || lastError || '');
      const isDemandSpike =
        errStr.includes('503') ||
        errStr.includes('high demand') ||
        errStr.includes('UNAVAILABLE') ||
        errStr.includes('RESOURCE_EXHAUSTED') ||
        errStr.includes('429');

      if (isDemandSpike) {
        return res.status(503).json({
          error:
            'Layanan AI sedang mengalami lonjakan beban antrean sesaat (503). Silakan klik "Coba Lagi Sekarang" dalam beberapa detik, atau gunakan tab "Copy-Paste Teks Faktur (Regex)" yang bekerja instan tanpa kuota AI.',
        });
      }

      throw lastError || new Error('Gagal mendapatkan respon dari AI.');
    }

    let parsedData;
    try {
      parsedData = JSON.parse(responseText);
    } catch {
      // Regex parse fallback if model wrapped in markdown
      const match = responseText.match(/\{[\s\S]*\}/);
      parsedData = match ? JSON.parse(match[0]) : { items: [] };
    }

    res.json({
      success: true,
      data: parsedData,
    });
  } catch (error: any) {
    console.error('Error scanning invoice image:', error);
    const errStr = String(error?.message || error || '');
    const isDemandSpike =
      errStr.includes('503') ||
      errStr.includes('high demand') ||
      errStr.includes('UNAVAILABLE') ||
      errStr.includes('RESOURCE_EXHAUSTED') ||
      errStr.includes('429');

    const status = isDemandSpike ? 503 : 500;
    const errorMessage = isDemandSpike
      ? 'Layanan AI sedang mengalami lonjakan beban antrean sesaat (503). Silakan klik "Coba Lagi Sekarang" dalam beberapa detik, atau gunakan tab "Copy-Paste Teks Faktur (Regex)".'
      : (error?.message || 'Gagal memproses gambar faktur.');

    res.status(status).json({
      error: errorMessage,
    });
  }
});

async function startServer() {
  // Vite dev middleware or static serving
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
