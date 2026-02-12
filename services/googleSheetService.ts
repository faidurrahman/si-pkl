
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
const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzNIC_6aoVMICn170I3voOQcZ5bvS1wLdwPR0y2wq7_0q_wi0BxclbII3hdVCX6I3CZ/exec';

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
    const response = await fetch(CSV_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error('Gagal mengambil data dari Google Sheet');
    
    const csvText = await response.text();
    const lines = csvText.split(/\r?\n/);
    const result: PKLData[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // Split CSV dengan menangani data yang mungkin mengandung koma di dalam tanda kutip
      const currentLine = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
      if (currentLine.length < 5) continue;

      const clean = (val: string) => {
        if (!val) return '';
        // Hapus tanda kutip pembungkus dan spasi berlebih
        return val.replace(/^["']|["']$/g, '').trim();
      };

      result.push({
        id_pkl: clean(currentLine[0]),
        tanggal_data: clean(currentLine[1]),
        nama_pedagang: clean(currentLine[2]),
        kelurahan: clean(currentLine[3]),
        alamat: clean(currentLine[4]),
        jenis_dagangan: clean(currentLine[5]),
        status: clean(currentLine[6]) === 'Sudah Relokasi' ? 'Sudah Relokasi' : 'Belum Relokasi',
        // Terapkan konversi ke thumbnail link agar muncul di dashboard
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
    const finalPayload = {
      ...payload,
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
