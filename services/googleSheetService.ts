
import { PKLData } from "../types";

/**
 * SOURCE DATA (FETCHING)
 */
const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQhvZdx-Xv_0M29sMqHaftdOweqqWvCnDaXx6IZmiioqae2kYIhJZ5ToP_pQZax0XYO-8FnyagK1__6/pub?output=csv';

/**
 * TARGET IDS (SAVING)
 */
const TARGET_SHEET_ID = '1Wq14Vhri5MZoVP7XN-mMQAB9Yh3Ccag6n66_NyLcCsg';
const TARGET_DRIVE_FOLDER_ID = '1v512TPNJm752mNGSM4GufacyAGn6QlQs';

/**
 * URL Aplikasi Web dari Google Apps Script
 */
const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwuVMijv5L9IZRd7t0HmaSQ5Sesgy5yaqOtyuO__irsX-Mlys8Mi8iVGrEo7vEnAPEl/exec';

/**
 * Mengubah URL Google Drive menjadi Direct Link Gambar yang lebih reliabel.
 * Menggunakan endpoint thumbnail dengan parameter ukuran (sz=w800) agar loading lebih cepat
 * dan melewati filter preview standar Google Drive yang sering memblokir tag <img>.
 */
const getDirectDriveUrl = (url: string): string => {
  if (!url || typeof url !== 'string') return '';
  if (!url.includes('drive.google.com')) return url;
  
  try {
    // Regex untuk mengekstrak ID file dari format /d/ID atau ?id=ID
    const regex = /\/d\/([^/?#]+)|id=([^&?#]+)/;
    const match = url.match(regex);
    const id = match ? (match[1] || match[2]) : null;
    
    if (id) {
      // Endpoint thumbnail lebih stabil untuk ditampilkan di dashboard dibanding /uc?id=
      return `https://drive.google.com/thumbnail?id=${id}&sz=w800`;
    }
  } catch (e) {
    console.error("Error parsing Drive URL:", e);
  }
  
  return url;
};

export const fetchPKLDataFromSheet = async (): Promise<PKLData[]> => {
  try {
    // Gunakan no-cache agar selalu mendapatkan data terbaru
    // Tambahkan timestamp query parameter untuk memaksa bypass cache Google
    const timestamp = new Date().getTime();
    const response = await fetch(`${CSV_URL}&t=${timestamp}`, {
      cache: 'no-store',
      headers: {
        'Pragma': 'no-cache',
        'Cache-Control': 'no-cache'
      }
    });
    if (!response.ok) throw new Error('Gagal mengambil data dari Google Sheet');
    
    const csvText = await response.text();
    
    // Robust CSV parser to handle newlines inside quotes
    const parsedRows: string[][] = [];
    let row: string[] = [];
    let currentItem = '';
    let inQuotes = false;
    
    for (let i = 0; i < csvText.length; i++) {
      let char = csvText[i];
      let nextChar = csvText[i+1];
      
      if (char === '"') {
        if (inQuotes && nextChar === '"') {
           currentItem += '"';
           i++; // skip escaped quote
        } else {
           inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        row.push(currentItem);
        currentItem = '';
      } else if ((char === '\n' || char === '\r') && !inQuotes) {
        if (char === '\r' && nextChar === '\n') {
            i++;
        }
        row.push(currentItem);
        parsedRows.push(row);
        row = [];
        currentItem = '';
      } else {
        currentItem += char;
      }
    }
    if (currentItem || row.length > 0) {
        row.push(currentItem);
        parsedRows.push(row);
    }

    const result: PKLData[] = [];
    
    // Start from index 1 to skip header
    for (let i = 1; i < parsedRows.length; i++) {
      const currentLine = parsedRows[i];
      if (currentLine.length < 5) continue;
      
      // Clean function won't need to replace surrounding quotes anymore
      // because our parser handles quotes, but let's keep it safe by just trimming whitespace.
      const clean = (val: string) => {
        if (!val) return '';
        return val.trim();
      };

      result.push({
        id_pkl: clean(currentLine[0]),
        tanggal_data: clean(currentLine[1]),
        nama_pedagang: clean(currentLine[2]),
        kelurahan: clean(currentLine[3]),
        alamat: clean(currentLine[4]),
        jenis_dagangan: clean(currentLine[5]),
        status: clean(currentLine[6]) === 'Sudah Relokasi' ? 'Sudah Relokasi' : 'Belum Relokasi',
        foto_before: getDirectDriveUrl(clean(currentLine[7])),
        foto_after: getDirectDriveUrl(clean(currentLine[8])),
        history_penertiban: clean(currentLine[9]) || 'Tidak ada catatan'
      });
    }
    return result;
  } catch (error) {
    console.error("Error fetching data:", error);
    throw error;
  }
};

export const submitPKLData = async (payload: any) => {
  return sendToAppsScript({ ...payload, action: 'CREATE' });
};

export const updatePKLData = async (payload: any) => {
  return sendToAppsScript({ ...payload, action: 'UPDATE' });
};

export const deletePKLData = async (id_pkl: string) => {
  return sendToAppsScript({ id_pkl, action: 'DELETE' });
};

const sendToAppsScript = async (payload: any) => {
  try {
    // Normalisasi payload agar kompatibel secara menyeluruh baik dengan schema UI React maupun header Google Sheet/Drive script
    const normalizedPayload = {
      ...payload,
      // 1. Lowercase/Snake keys (for database/UI compatibility)
      id_pkl: payload.id_pkl || payload.id || '',
      tanggal_data: payload.tanggal_data || new Date().toLocaleDateString('id-ID'),
      nama_pedagang: payload.nama_pedagang || payload.nama || '',
      kelurahan: payload.kelurahan || '',
      alamat: payload.alamat || '',
      jenis_dagangan: payload.jenis_dagangan || payload.jenis || '',
      status: payload.status || 'Belum Relokasi',
      history_penertiban: payload.history_penertiban || payload.history || '',
      foto_before: payload.foto_before || payload.fotoBeforeBase64 || '',
      foto_after: payload.foto_after || payload.fotoAfterBase64 || '',

      // 2. Capitalized/Space keys (matching actual Sheet Column Headers exactly!)
      "ID_PKL": payload.id_pkl || payload.id || '',
      "Tanggal Data": payload.tanggal_data || new Date().toLocaleDateString('id-ID'),
      "Nama Pedagang": payload.nama_pedagang || payload.nama || '',
      "Kelurahan": payload.kelurahan || '',
      "Alamat / Lokasi": payload.alamat || '',
      "Jenis Dagangan": payload.jenis_dagangan || payload.jenis || '',
      "Status": payload.status || 'Belum Relokasi',
      "Foto Before": payload.foto_before || payload.fotoBeforeBase64 || '',
      "Foto After": payload.foto_after || payload.fotoAfterBase64 || '',
      "History Penertiban": payload.history_penertiban || payload.history || '',

      // 3. Legacy/Alternate names (backward compatibility)
      id: payload.id || payload.id_pkl || '',
      nama: payload.nama || payload.nama_pedagang || '',
      jenis: payload.jenis || payload.jenis_dagangan || '',
      history: payload.history || payload.history_penertiban || '',
      fotoBeforeBase64: payload.fotoBeforeBase64 || payload.foto_before || '',
      fotoAfterBase64: payload.fotoAfterBase64 || payload.foto_after || '',
    };

    const finalPayload = {
      ...normalizedPayload,
      targetSheetId: TARGET_SHEET_ID,
      targetFolderId: TARGET_DRIVE_FOLDER_ID,
    };

    const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(finalPayload),
    });

    // Karena mode no-cors, kita tidak bisa membaca response body, 
    // tapi fetch akan throw error jika gagal koneksi.
    return { success: true };
  } catch (error) {
    console.error("Apps Script Sync Error:", error);
    throw error;
  }
};

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};
