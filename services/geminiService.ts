
import { GoogleGenAI } from "@google/genai";
import { PKLData } from "../types";

export const analyzePKLData = async (data: PKLData[], prompt: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  
  const dataSummary = data.map(item => ({
    id: item.id_pkl,
    nama: item.nama_pedagang,
    kelurahan: item.kelurahan,
    status: item.status,
    jenis: item.jenis_dagangan
  }));

  const systemInstruction = `
    Anda adalah seorang analis data perkotaan profesional untuk Pemerintah Kota. 
    Tugas Anda adalah menganalisis data PKL (Pedagang Kaki Lima) berikut dan memberikan wawasan, 
    rekomendasi, atau menjawab pertanyaan pengguna dengan gaya bahasa yang profesional dan informatif.
    Data yang tersedia: ${JSON.stringify(dataSummary)}
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    // Menggunakan nullish coalescing untuk memastikan string selalu dikembalikan
    return response.text ?? "Maaf, AI tidak memberikan respon teks.";
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return "Maaf, terjadi kesalahan saat melakukan analisis AI. Silakan coba lagi nanti.";
  }
};
