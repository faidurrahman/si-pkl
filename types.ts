
export interface PKLData {
  id_pkl: string;
  tanggal_data: string;
  nama_pedagang: string;
  kelurahan: string;
  alamat: string;
  jenis_dagangan: string;
  status: 'Sudah Relokasi' | 'Belum Relokasi';
  foto_before?: string;
  foto_after?: string;
  history_penertiban: string;
}

export interface DashboardStats {
  total: number;
  relocated: number;
  notRelocated: number;
  byDistrict: Record<string, number>;
  byType: Record<string, number>;
}
