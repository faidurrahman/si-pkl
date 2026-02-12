
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend 
} from 'recharts';
import { 
  LayoutDashboard, 
  Users, 
  CheckCircle, 
  XCircle, 
  Search, 
  MapPin,
  TrendingUp,
  RefreshCw,
  Info,
  Camera,
  X,
  ClipboardList,
  Clock,
  PlusCircle,
  UploadCloud,
  Loader2,
  Pencil,
  Trash2,
  AlertTriangle,
  Lock,
  LogIn,
  LogOut,
  ShieldCheck,
  User
} from 'lucide-react';
import React, { useState, useMemo, useEffect } from 'react';
import { INITIAL_PKL_DATA } from './constants';
import { PKLData } from './types';
import StatCard from './components/StatCard';
import { analyzePKLData } from './services/geminiService';
import { fetchPKLDataFromSheet, submitPKLData, updatePKLData, deletePKLData, fileToBase64 } from './services/googleSheetService';

const KELURAHAN_LIST = [
  "Baru",
  "Bulogading",
  "Lae-Lae",
  "Lajangiru",
  "Losari",
  "Maloku",
  "Mangkura",
  "Pisang Selatan",
  "Pisang Utara",
  "Sawerigading"
];

interface UserAuth {
  username: string;
  role: 'super_admin' | 'admin';
  kelurahan?: string;
}

const App: React.FC = () => {
  // Authentication State
  const [user, setUser] = useState<UserAuth | null>(null);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // App State
  const [data, setData] = useState<PKLData[]>(INITIAL_PKL_DATA);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Sudah Relokasi' | 'Belum Relokasi'>('All');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'table'>('dashboard');
  
  const [lastSync, setLastSync] = useState<Date>(new Date());
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState(false);
  
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  const [selectedTrader, setSelectedTrader] = useState<PKLData | null>(null);

  // Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    id_pkl: '',
    nama: '',
    kelurahan: KELURAHAN_LIST[0],
    alamat: '',
    jenis: '',
    status: 'Belum Relokasi',
    history: '',
    fotoBeforeBase64: '',
    fotoAfterBase64: ''
  });
  const [previews, setPreviews] = useState<{before: string, after: string}>({ before: '', after: '' });

  // Delete State
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Logic to filter data based on user role
  const scopedData = useMemo(() => {
    if (!user) return [];
    if (user.role === 'super_admin') return data;
    return data.filter(item => item.kelurahan.trim().toLowerCase() === user.kelurahan?.trim().toLowerCase());
  }, [data, user]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError(null);

    setTimeout(() => {
      const { username, password } = loginForm;
      const inputUser = username.trim().toLowerCase();
      const inputPass = password.trim();

      // Super Admin: superadmin / samiun15
      if (inputUser === 'superadmin' && inputPass === 'samiun15') {
        setUser({ username: 'Super Admin', role: 'super_admin' });
        setIsLoggingIn(false);
        return;
      }

      // Admin Kelurahan: Username = Password = Nama Kelurahan
      let foundAdmin = false;
      for (const kel of KELURAHAN_LIST) {
        const normalizedKel = kel.toLowerCase().replace(/\s+/g, '');
        const inputPassNormalized = inputPass.toLowerCase().replace(/\s+/g, '');
        
        if (inputUser === normalizedKel && inputPassNormalized === normalizedKel) {
          setUser({ username: `Admin ${kel}`, role: 'admin', kelurahan: kel });
          foundAdmin = true;
          break;
        }
      }

      if (!foundAdmin) {
        setLoginError('User name atau password salah!');
      }
      setIsLoggingIn(false);
    }, 800);
  };

  const handleLogout = () => {
    setUser(null);
    setLoginForm({ username: '', password: '' });
    setLoginError(null);
    setSelectedDistrict(null);
    setActiveTab('dashboard');
  };

  const loadData = async (silent = false) => {
    if (!silent) setIsSyncing(true);
    try {
      const sheetData = await fetchPKLDataFromSheet();
      if (sheetData && sheetData.length > 0) {
        setData(sheetData);
        setLastSync(new Date());
        setSyncError(false);
      }
    } catch (err) {
      setSyncError(true);
    } finally {
      if (!silent) setIsSyncing(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadData();
      const interval = setInterval(() => loadData(true), 30000); 
      return () => clearInterval(interval);
    }
  }, [user]);

  // Set default kelurahan in form for admins
  useEffect(() => {
    if (isFormOpen && !isEditMode && user?.role === 'admin' && user.kelurahan) {
      setFormData(prev => ({ ...prev, kelurahan: user.kelurahan || '' }));
    }
  }, [isFormOpen, isEditMode, user]);

  const stats = useMemo(() => {
    const total = scopedData.length;
    const relocated = scopedData.filter(d => d.status === 'Sudah Relokasi').length;
    const notRelocated = total - relocated;
    const byDistrictMap: Record<string, number> = {};
    scopedData.forEach(d => {
      const key = (d.kelurahan || 'Unknown').trim();
      byDistrictMap[key] = (byDistrictMap[key] || 0) + 1;
    });
    const districtData = Object.entries(byDistrictMap).map(([name, value]) => {
      const dRelocated = scopedData.filter(d => d.kelurahan.trim() === name && d.status === 'Sudah Relokasi').length;
      return { 
        name, 
        value, 
        relocated: dRelocated, 
        notRelocated: value - dRelocated, 
        percentage: value > 0 ? Math.round((dRelocated / value) * 100) : 0 
      };
    }).sort((a, b) => b.value - a.value);

    let districtStats = null;
    if (selectedDistrict) {
      const districtPKLs = scopedData.filter(d => d.kelurahan.trim().toLowerCase() === selectedDistrict.trim().toLowerCase());
      const dRelocated = districtPKLs.filter(d => d.status === 'Sudah Relokasi').length;
      districtStats = { 
        total: districtPKLs.length, 
        relocated: dRelocated, 
        notRelocated: districtPKLs.length - dRelocated 
      };
    }
    return { total, relocated, notRelocated, districtData, districtStats };
  }, [scopedData, selectedDistrict]);

  const filteredData = useMemo(() => {
    return scopedData.filter(item => {
      const s = searchTerm.trim().toLowerCase();
      const matchesSearch = !s || item.nama_pedagang.toLowerCase().includes(s) || item.kelurahan.toLowerCase().includes(s) || item.id_pkl.toLowerCase().includes(s);
      const matchesDistrict = !selectedDistrict || item.kelurahan.trim().toLowerCase() === selectedDistrict.trim().toLowerCase();
      const matchesStatus = statusFilter === 'All' || item.status === statusFilter;
      return matchesSearch && matchesDistrict && matchesStatus;
    });
  }, [scopedData, searchTerm, selectedDistrict, statusFilter]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, type: 'before' | 'after') => {
    const file = e.target.files?.[0];
    if (file) {
      const base64 = await fileToBase64(file);
      setFormData(prev => ({ ...prev, [type === 'before' ? 'fotoBeforeBase64' : 'fotoAfterBase64']: base64 }));
      setPreviews(prev => ({ ...prev, [type]: URL.createObjectURL(file) }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (isEditMode) {
        await updatePKLData(formData);
      } else {
        await submitPKLData(formData);
      }
      alert(`Data berhasil ${isEditMode ? 'diperbarui' : 'dikirim'}!`);
      closeForm();
      setTimeout(() => loadData(), 2000);
    } catch (err) {
      alert('Gagal memproses data.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    setIsDeleting(true);
    try {
      await deletePKLData(deletingId);
      setTimeout(async () => {
        await loadData();
        setDeletingId(null);
        setIsDeleting(false);
        alert('Data pedagang berhasil dihapus.');
      }, 2000);
    } catch (err) {
      alert('Gagal menghapus data.');
      setIsDeleting(false);
    }
  };

  const openFormForEdit = (item: PKLData) => {
    setIsEditMode(true);
    setFormData({
      id_pkl: item.id_pkl,
      nama: item.nama_pedagang,
      kelurahan: item.kelurahan,
      alamat: item.alamat,
      jenis: item.jenis_dagangan,
      status: item.status,
      history: item.history_penertiban,
      fotoBeforeBase64: '', 
      fotoAfterBase64: ''
    });
    setPreviews({
      before: item.foto_before || '',
      after: item.foto_after || ''
    });
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setIsEditMode(false);
    setFormData({ id_pkl: '', nama: '', kelurahan: user?.role === 'admin' ? (user.kelurahan || '') : KELURAHAN_LIST[0], alamat: '', jenis: '', status: 'Belum Relokasi', history: '', fotoBeforeBase64: '', fotoAfterBase64: '' });
    setPreviews({ before: '', after: '' });
  };

  const resetAllFilters = () => {
    setSelectedDistrict(null);
    setSearchTerm('');
    setStatusFilter('All');
  };

  // Login View
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-500/10 blur-[120px] rounded-full" />
          <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full" />
        </div>
        
        <div className="w-full max-w-md animate-in fade-in zoom-in duration-500">
          <div className="bg-white rounded-[32px] shadow-2xl overflow-hidden border border-slate-200">
            <div className="bg-slate-900 p-10 text-center relative overflow-hidden">
               <div className="absolute top-0 right-0 p-12 bg-emerald-500/10 blur-2xl rounded-full -mr-12 -mt-12" />
               <div className="relative z-10 inline-flex bg-emerald-500 p-4 rounded-3xl shadow-lg shadow-emerald-500/30 mb-6">
                 <LayoutDashboard size={32} className="text-white" />
               </div>
               <h1 className="text-3xl font-bold text-white tracking-tight relative z-10">SI-PKL Admin</h1>
               <p className="text-slate-400 mt-2 text-sm relative z-10">Sistem Monitoring Pedagang Kaki Lima</p>
            </div>
            
            <form onSubmit={handleLogin} className="p-10 space-y-6">
              {loginError && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-5 py-4 rounded-2xl text-xs font-bold flex items-center gap-3 animate-shake shadow-sm">
                  <AlertTriangle size={18} className="shrink-0" />
                  <span>{loginError}</span>
                </div>
              )}
              
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">User Name</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      required
                      type="text" 
                      placeholder="Masukkan user name..." 
                      className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500 transition-all text-sm font-medium"
                      value={loginForm.username}
                      onChange={(e) => {
                        setLoginForm({...loginForm, username: e.target.value});
                        if (loginError) setLoginError(null);
                      }}
                    />
                  </div>
                </div>
                
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      required
                      type="password" 
                      placeholder="••••••••" 
                      className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500 transition-all text-sm font-medium"
                      value={loginForm.password}
                      onChange={(e) => {
                        setLoginForm({...loginForm, password: e.target.value});
                        if (loginError) setLoginError(null);
                      }}
                    />
                  </div>
                </div>
              </div>
              
              <button 
                disabled={isLoggingIn}
                type="submit" 
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl transition-all shadow-xl shadow-emerald-600/20 active:scale-95 flex items-center justify-center gap-3"
              >
                {isLoggingIn ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <>
                    <LogIn size={20} />
                    <span>Login Dashboard</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#f8fafc]">
      <aside className="w-full md:w-72 bg-slate-900 text-slate-300 p-6 flex flex-col space-y-8 md:sticky top-0 h-auto md:h-screen z-10 shadow-2xl">
        <div className="flex items-center space-x-3 text-white">
          <div className="bg-emerald-500 p-2.5 rounded-xl shadow-lg shadow-emerald-500/20"><LayoutDashboard size={24} /></div>
          <div><span className="text-xl font-bold tracking-tight block">SI-PKL</span><span className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">Monitoring System</span></div>
        </div>

        <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50">
           <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center text-emerald-400">
                {user.role === 'super_admin' ? <ShieldCheck size={20} /> : <User size={20} />}
             </div>
             <div className="flex-1 overflow-hidden">
                <p className="text-xs font-bold text-white truncate">{user.username}</p>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest truncate">{user.role === 'super_admin' ? 'Super Admin' : 'Admin'}</p>
             </div>
           </div>
        </div>

        <nav className="flex-1 space-y-2">
          <button onClick={() => { setActiveTab('dashboard'); setSelectedDistrict(null); }} className={`w-full flex items-center space-x-3 p-3.5 rounded-xl transition-all ${activeTab === 'dashboard' && !selectedDistrict ? 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/30 font-bold' : 'hover:bg-slate-800'}`}><TrendingUp size={20} /><span>Overview</span></button>
          <button onClick={() => setActiveTab('table')} className={`w-full flex items-center space-x-3 p-3.5 rounded-xl transition-all ${activeTab === 'table' ? 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/30 font-bold' : 'hover:bg-slate-800'}`}><Users size={20} /><span>Database PKL</span></button>
          <div className="pt-4"><button onClick={() => { setIsEditMode(false); setIsFormOpen(true); }} className="w-full flex items-center justify-center space-x-3 p-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all shadow-lg shadow-emerald-600/20 active:scale-95"><PlusCircle size={20} /><span>Tambah Data</span></button></div>
        </nav>

        <div className="pt-8 border-t border-slate-800 space-y-4">
          <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700">
            <div className="flex items-center justify-between mb-2">
               <div className="flex items-center gap-2"><div className={`w-2 h-2 rounded-full ${syncError ? 'bg-red-500' : 'bg-emerald-500 animate-pulse'}`} /><span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sync Status</span></div>
               {isSyncing && <RefreshCw size={12} className="text-emerald-400 animate-spin" />}
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-300"><Clock size={12} /><span>{lastSync.toLocaleTimeString('id-ID')}</span></div>
          </div>
          
          <button onClick={handleLogout} className="w-full flex items-center space-x-3 p-3.5 rounded-xl hover:bg-red-500 hover:text-white transition-all text-slate-500">
            <LogOut size={20} />
            <span className="font-bold">Logout</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-slate-900">
              {user.role === 'admin' ? `Wilayah: ${user.kelurahan}` : (selectedDistrict ? `Wilayah: ${selectedDistrict}` : 'Dashboard Utama')}
            </h1>
            <p className="text-slate-500 text-sm">Monitoring PKL Kota - {lastSync.toLocaleString('id-ID')}</p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input type="text" placeholder="Cari ID atau Nama..." className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none shadow-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
        </header>

        {activeTab === 'dashboard' ? (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard title="Total PKL" value={selectedDistrict ? (stats.districtStats?.total ?? 0) : stats.total} icon={<Users />} color="text-blue-600 bg-blue-100" />
              <StatCard title="Relokasi" value={selectedDistrict ? (stats.districtStats?.relocated ?? 0) : stats.relocated} icon={<CheckCircle />} color="text-emerald-600 bg-emerald-100" />
              <StatCard title="Belum" value={selectedDistrict ? (stats.districtStats?.notRelocated ?? 0) : stats.notRelocated} icon={<XCircle />} color="text-red-600 bg-red-100" />
              <StatCard title="Efektivitas" value={selectedDistrict ? `${(stats.districtStats?.total ?? 0) > 0 ? Math.round(((stats.districtStats?.relocated ?? 0) / (stats.districtStats?.total ?? 1)) * 100) : 0}%` : (user.role === 'super_admin' ? `${stats.districtData.length} Wilayah` : `${Math.round((stats.relocated / (stats.total || 1)) * 100)}% Progress`)} icon={<TrendingUp />} color="text-amber-600 bg-amber-100" />
            </div>

            {user.role === 'super_admin' && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/20">
                    <div className="flex items-center gap-3"><ClipboardList className="text-blue-600" size={20} /><h3 className="font-bold text-slate-800">Rekapitulasi Wilayah</h3></div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-slate-400 text-[10px] font-bold uppercase tracking-widest border-b border-slate-100">
                      <tr><th className="px-6 py-4">Kelurahan</th><th className="px-6 py-4 text-center">Total</th><th className="px-6 py-4 text-center">Relokasi</th><th className="px-6 py-4 text-center">Belum</th><th className="px-6 py-4">Progress</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {stats.districtData.map((district) => (
                        <tr key={district.name} onClick={() => setSelectedDistrict(district.name)} className={`hover:bg-emerald-50 transition-colors cursor-pointer ${selectedDistrict === district.name ? 'bg-emerald-50' : ''}`}>
                          <td className="px-6 py-4 font-bold text-slate-900">{district.name}</td>
                          <td className="px-6 py-4 text-center font-bold text-slate-500">{district.value}</td>
                          <td className="px-6 py-4 text-center"><span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-bold">{district.relocated}</span></td>
                          <td className="px-6 py-4 text-center"><span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-[10px] font-bold">{district.notRelocated}</span></td>
                          <td className="px-6 py-4"><div className="flex items-center gap-3"><div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: `${district.percentage}%` }} /></div><span className="text-[10px] font-bold text-slate-400">{district.percentage}%</span></div></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className={`bg-white rounded-2xl shadow-xl border-2 transition-all duration-500 overflow-hidden ${(selectedDistrict || user.role === 'admin') ? 'border-emerald-500/40 ring-8 ring-emerald-500/5' : 'border-white'}`}>
               <div className={`p-6 border-b flex flex-col md:flex-row md:items-center justify-between gap-4 ${(selectedDistrict || user.role === 'admin') ? 'bg-emerald-50/30' : 'bg-slate-50/10'}`}>
                  <div className="flex items-center gap-3"><div className="bg-emerald-500 text-white p-2 rounded-xl"><Users size={18} /></div><div><h3 className="font-bold text-slate-900">{(selectedDistrict || user.role === 'admin') ? `Daftar: ${user.role === 'admin' ? user.kelurahan : selectedDistrict}` : 'Daftar Pedagang'}</h3><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{filteredData.length} pedagang ditemukan</p></div></div>
                  <div className="flex items-center gap-3">
                    <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-wider outline-none"><option value="All">Semua Status</option><option value="Sudah Relokasi">Sudah Relokasi</option><option value="Belum Relokasi">Belum Relokasi</option></select>
                    {(selectedDistrict || statusFilter !== 'All') && <button onClick={resetAllFilters} className="bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2"><RefreshCw size={14} /> RESET</button>}
                  </div>
               </div>
               <div className="overflow-x-auto">
                 <table className="w-full text-left">
                   <thead className="bg-slate-50/50 text-slate-400 text-[10px] font-bold uppercase tracking-widest border-b border-slate-100">
                     <tr><th className="px-6 py-4">ID</th><th className="px-6 py-4">Pedagang</th><th className="px-6 py-4">Dagangan</th><th className="px-6 py-4">Status</th><th className="px-6 py-4 text-center">Aksi</th></tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                     {filteredData.slice(0, 50).map((item, idx) => (
                       <tr key={`${item.id_pkl}-${idx}`} className="hover:bg-slate-50 transition-colors group">
                         <td className="px-6 py-4 font-mono text-xs text-slate-400">{item.id_pkl}</td>
                         <td className="px-6 py-4"><span className="font-bold text-slate-900 block group-hover:text-emerald-600">{item.nama_pedagang}</span><span className="text-[10px] text-slate-400 uppercase tracking-tighter">{item.kelurahan}</span></td>
                         <td className="px-6 py-4 text-xs text-slate-500">{item.jenis_dagangan}</td>
                         <td className="px-6 py-4"><span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${item.status === 'Sudah Relokasi' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{item.status}</span></td>
                         <td className="px-6 py-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button onClick={() => setSelectedTrader(item)} className="p-2 bg-slate-100 rounded-lg hover:bg-emerald-500 hover:text-white transition-all" title="Detail"><Info size={14} /></button>
                              <button onClick={() => openFormForEdit(item)} className="p-2 bg-slate-100 rounded-lg hover:bg-blue-500 hover:text-white transition-all" title="Edit"><Pencil size={14} /></button>
                              {user.role === 'super_admin' && (
                                <button onClick={() => setDeletingId(item.id_pkl)} className="p-2 bg-slate-100 rounded-lg hover:bg-red-500 hover:text-white transition-all" title="Hapus"><Trash2 size={14} /></button>
                              )}
                            </div>
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
             <div className="p-6 border-b border-slate-100 bg-slate-50/30 flex justify-between items-center"><h3 className="font-bold text-slate-800">Database Semua Pedagang</h3><button onClick={() => loadData()} className="text-[10px] font-bold text-slate-500 flex items-center gap-2 hover:text-emerald-600 transition-colors uppercase tracking-widest"><RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} /> REFRESH</button></div>
             <div className="overflow-x-auto">
                <table className="w-full text-left">
                   <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">
                     <tr><th className="px-6 py-4">ID</th><th className="px-6 py-4">Nama</th><th className="px-6 py-4">Kelurahan</th><th className="px-6 py-4">Status</th><th className="px-6 py-4 text-center">Aksi</th></tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                     {filteredData.map((item, idx) => (
                       <tr key={`${item.id_pkl}-${idx}`} className="hover:bg-slate-50 transition-colors group">
                         <td className="px-6 py-4 font-mono text-xs text-slate-400">{item.id_pkl}</td>
                         <td className="px-6 py-4 font-bold text-slate-900">{item.nama_pedagang}</td>
                         <td className="px-6 py-4 text-sm text-slate-600">{item.kelurahan}</td>
                         <td className="px-6 py-4"><span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${item.status === 'Sudah Relokasi' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{item.status}</span></td>
                         <td className="px-6 py-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button onClick={() => setSelectedTrader(item)} className="p-2 bg-slate-100 rounded-lg hover:bg-emerald-500 hover:text-white transition-all"><Info size={14} /></button>
                              <button onClick={() => openFormForEdit(item)} className="p-2 bg-slate-100 rounded-lg hover:bg-blue-500 hover:text-white transition-all"><Pencil size={14} /></button>
                              {user.role === 'super_admin' && (
                                <button onClick={() => setDeletingId(item.id_pkl)} className="p-2 bg-slate-100 rounded-lg hover:bg-red-500 hover:text-white transition-all"><Trash2 size={14} /></button>
                              )}
                            </div>
                         </td>
                       </tr>
                     ))}
                   </tbody>
                </table>
             </div>
          </div>
        )}
      </main>

      {/* Modal Tambah/Edit Data */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 border border-white/20">
            <div className="bg-slate-900 p-8 text-white flex justify-between items-center relative">
              <div><h2 className="text-2xl font-bold tracking-tight">{isEditMode ? 'Update Data PKL' : 'Input Data Pedagang Baru'}</h2><p className="text-slate-400 text-sm mt-1">{isEditMode ? `Memperbarui data ID: ${formData.id_pkl}` : 'Data akan disimpan otomatis ke Google Drive & Sheet'}</p></div>
              <button onClick={closeForm} className="bg-slate-800 p-2.5 rounded-full hover:bg-red-500 transition-all border border-slate-700"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8 overflow-y-auto max-h-[70vh]">
               <div className="space-y-4">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4 border-b pb-2"><ClipboardList className="text-emerald-500" size={18} /> Informasi Dasar</h3>
                  <div><label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">Nama Pedagang</label><input required type="text" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500/20" value={formData.nama} onChange={(e) => setFormData({...formData, nama: e.target.value})} /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">Kelurahan</label>
                      <select 
                        required 
                        disabled={user?.role === 'admin'}
                        className={`w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500/20 ${user?.role === 'admin' ? 'opacity-70 cursor-not-allowed' : ''}`} 
                        value={formData.kelurahan} 
                        onChange={(e) => setFormData({...formData, kelurahan: e.target.value})}
                      >
                        {KELURAHAN_LIST.map(k => <option key={k} value={k}>{k}</option>)}
                      </select>
                    </div>
                    <div><label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">Jenis Dagangan</label><input required type="text" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none" value={formData.jenis} onChange={(e) => setFormData({...formData, jenis: e.target.value})} /></div>
                  </div>
                  <div><label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">Alamat / Lokasi</label><textarea required rows={2} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none" value={formData.alamat} onChange={(e) => setFormData({...formData, alamat: e.target.value})}></textarea></div>
                  <div><label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">Status</label><select className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none" value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value})}><option value="Belum Relokasi">Belum Relokasi</option><option value="Sudah Relokasi">Sudah Relokasi</option></select></div>
                  <div><label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">History Penertiban</label><textarea rows={2} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none" value={formData.history} placeholder="Contoh: Sudah teguran ke-3" onChange={(e) => setFormData({...formData, history: e.target.value})}></textarea></div>
               </div>
               <div className="space-y-6">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4 border-b pb-2"><Camera className="text-emerald-500" size={18} /> Dokumentasi</h3>
                  <div className="grid grid-cols-1 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">FOTO SEBELUM (BEFORE)</label>
                      <div onClick={() => document.getElementById('file-before')?.click()} className="aspect-video bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:border-emerald-500 hover:bg-emerald-50 transition-all overflow-hidden">{previews.before ? <img src={previews.before} className="w-full h-full object-cover" /> : <><UploadCloud className="text-slate-300 mb-2" size={32} /><span className="text-xs text-slate-400">Klik untuk upload</span></>}<input id="file-before" type="file" className="hidden" accept="image/*" onChange={(e) => handleFileChange(e, 'before')} /></div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">FOTO SESUDAH (AFTER)</label>
                      <div onClick={() => document.getElementById('file-after')?.click()} className="aspect-video bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:border-emerald-500 hover:bg-emerald-50 transition-all overflow-hidden">{previews.after ? <img src={previews.after} className="w-full h-full object-cover" /> : <><UploadCloud className="text-slate-300 mb-2" size={32} /><span className="text-xs text-slate-400">Klik untuk upload</span></>}<input id="file-after" type="file" className="hidden" accept="image/*" onChange={(e) => handleFileChange(e, 'after')} /></div>
                    </div>
                  </div>
               </div>
               <div className="md:col-span-2 pt-6 border-t flex justify-end gap-4"><button type="button" onClick={closeForm} className="px-6 py-3 text-sm font-bold text-slate-500 hover:text-slate-800">Batal</button><button disabled={isSubmitting} type="submit" className="px-12 py-3 bg-emerald-600 text-white font-bold rounded-2xl hover:bg-emerald-500 transition-all shadow-xl shadow-emerald-600/20 flex items-center gap-2">{isSubmitting ? <><Loader2 className="animate-spin" size={18} /><span>Memproses...</span></> : (isEditMode ? 'Update Data' : 'Simpan Data')}</button></div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus */}
      {deletingId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
           <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 p-8 text-center">
              <div className="mx-auto w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-6">
                <AlertTriangle size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Hapus Data?</h3>
              <p className="text-slate-500 text-sm mb-8">Data pedagang dengan ID <span className="font-mono font-bold text-slate-700">{deletingId}</span> akan dihapus dari sistem.</p>
              <div className="flex flex-col gap-3">
                 <button 
                   disabled={isDeleting}
                   onClick={confirmDelete} 
                   className="w-full py-3.5 bg-red-600 text-white font-bold rounded-2xl hover:bg-red-700 transition-all shadow-lg shadow-red-600/20 flex items-center justify-center gap-2"
                 >
                   {isDeleting ? <><Loader2 className="animate-spin" size={18} /><span>Menghapus...</span></> : 'Hapus Sekarang'}
                 </button>
                 <button 
                   disabled={isDeleting}
                   onClick={() => setDeletingId(null)} 
                   className="w-full py-3.5 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-all"
                 >
                   Batal
                 </button>
              </div>
           </div>
        </div>
      )}

      {selectedTrader && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 border border-white/20">
              <div className="bg-slate-900 p-8 text-white flex justify-between items-center relative overflow-hidden">
                 <div className="absolute top-0 right-0 p-16 bg-emerald-500/10 blur-3xl rounded-full -mr-16 -mt-16" />
                 <div className="relative z-10">
                    <h2 className="text-2xl font-bold tracking-tight">{selectedTrader.nama_pedagang}</h2>
                    <div className="flex items-center gap-3 mt-2 text-slate-400 text-sm"><span className="bg-slate-800 px-2.5 py-1 rounded-lg font-mono text-xs border border-slate-700">ID: {selectedTrader.id_pkl}</span><span className="flex items-center gap-1.5"><MapPin size={14} className="text-emerald-500"/> {selectedTrader.kelurahan}</span></div>
                 </div>
                 <button onClick={() => setSelectedTrader(null)} className="bg-slate-800 p-2.5 rounded-full hover:bg-red-500 transition-all z-10 border border-slate-700"><X size={20} /></button>
              </div>
              <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-10 overflow-y-auto max-h-[75vh]">
                 <div className="space-y-6">
                    <h3 className="font-bold text-slate-800 flex items-center gap-3 mb-4 text-lg"><Camera size={20} className="text-emerald-500" /> Dokumentasi Foto</h3>
                    <div className="grid grid-cols-1 gap-6">
                       <div className="space-y-2"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">BEFORE</label><div className="aspect-video bg-slate-100 rounded-2xl overflow-hidden border-2 border-slate-100 shadow-inner">{selectedTrader.foto_before ? <img src={selectedTrader.foto_before} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-300 text-xs italic">N/A</div>}</div></div>
                       <div className="space-y-2"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">AFTER</label><div className="aspect-video bg-slate-100 rounded-2xl overflow-hidden border-2 border-slate-100 shadow-inner">{selectedTrader.foto_after ? <img src={selectedTrader.foto_after} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-300 text-xs italic">Belum Ada</div>}</div></div>
                    </div>
                 </div>
                 <div className="space-y-6">
                    <h3 className="font-bold text-slate-800 flex items-center gap-3 mb-4 text-lg"><ClipboardList size={20} className="text-emerald-500" /> Informasi Lengkap</h3>
                    <div className="space-y-4">
                       <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100"><p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Status Relokasi</p><span className={`px-3 py-1 rounded-xl text-xs font-bold shadow-sm inline-block ${selectedTrader.status === 'Sudah Relokasi' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{selectedTrader.status}</span></div>
                       <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100"><p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Lokasi/Alamat</p><p className="text-sm font-bold text-slate-700">{selectedTrader.alamat}</p></div>
                       <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100"><p className="text-[10px] font-bold text-slate-400 uppercase mb-2">History Penertiban</p><p className="text-sm text-slate-600 italic border-l-4 border-emerald-500/20 pl-4 py-1">{selectedTrader.history_penertiban || "Tidak ada catatan."}</p></div>
                    </div>
                 </div>
              </div>
              <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-end"><button onClick={() => setSelectedTrader(null)} className="px-12 py-3.5 bg-slate-900 text-white font-bold rounded-2xl hover:bg-emerald-600 transition-all uppercase tracking-widest text-xs">Tutup</button></div>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;
