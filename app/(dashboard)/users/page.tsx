"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Users,
  UserPlus,
  Search,
  SlidersHorizontal,
  Shield,
  Mail,
  Key,
  Trash2,
  Edit3,
  X,
  Check,
  AlertTriangle,
  Loader2,
  Lock,
  BadgeAlert,
  UserCheck,
  RotateCcw,
  HelpCircle,
} from "lucide-react";
import ProductTour, { ProductTourStep } from "@/components/ProductTour";
import {
  listAdminUsers,
  createAdminUser,
  updateAdminUser,
  deleteAdminUser,
} from "@/actions/user-actions";
import {
  getOperatorsList,
  updateOperatorShift,
  createOperator,
  deleteOperator,
  OperatorItem,
} from "@/actions/operator-actions";

const USER_TOUR_STEPS: ProductTourStep[] = [
  {
    target: "users-header",
    title: "Manajemen Akun",
    description:
      "Halaman ini dipakai untuk membuat, mengedit, dan menghapus akun sesuai role akses masing-masing pengguna.",
  },
  {
    target: "users-create",
    title: "Tambah Akun",
    description:
      "Gunakan tombol ini saat perlu menambahkan admin, operator, QC, mending, atau manager baru.",
  },
  {
    target: "users-filters",
    title: "Cari dan Filter",
    description:
      "Cari akun berdasarkan nama, ID pegawai, email, atau batasi daftar berdasarkan role tertentu.",
  },
  {
    target: "users-table",
    title: "Daftar Pengguna",
    description:
      "Tabel ini menampilkan akun yang tersedia beserta tombol edit dan hapus pada kolom aksi.",
  },
];

interface UserAccount {
  id: string;
  email: string;
  full_name: string;
  employee_id: string;
  role: "admin" | "manager" | "operator" | "inspeksi" | "mending";
  created_at: string;
}

export default function UserManagementPage() {
  const [activeTab, setActiveTab] = useState<"users" | "operators">("users");
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [isTourOpen, setIsTourOpen] = useState(false);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState("");

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Selected user for Edit/Delete
  const [selectedUser, setSelectedUser] = useState<UserAccount | null>(null);

  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [role, setRole] = useState("operator");

  // Operator Team Management state
  const [operatorsList, setOperatorsList] = useState<OperatorItem[]>([]);
  const [operatorsLoading, setOperatorsLoading] = useState(false);
  const [isAddOperatorModalOpen, setIsAddOperatorModalOpen] = useState(false);
  const [newOperatorName, setNewOperatorName] = useState("");
  const [newOperatorShift, setNewOperatorShift] = useState("A");

  useEffect(() => {
    fetchUsers();
    fetchOperators();
  }, []);

  const fetchOperators = async () => {
    setOperatorsLoading(true);
    try {
      const res = await getOperatorsList();
      if (res.success && res.data) {
        setOperatorsList(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setOperatorsLoading(false);
    }
  };

  const handleUpdateOperatorShift = async (id: number, newShift: string) => {
    try {
      const res = await updateOperatorShift(id, newShift);
      if (res.success) {
        setOperatorsList((prev) =>
          prev.map((op) => (op.id === id ? { ...op, shift: newShift } : op))
        );
      } else {
        alert("Gagal memperbarui tim: " + res.error);
      }
    } catch (err: any) {
      alert("Terjadi kesalahan: " + err.message);
    }
  };

  const handleAddOperatorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOperatorName.trim()) {
      return alert("Nama operator wajib diisi!");
    }
    setActionLoading(true);
    try {
      const res = await createOperator(newOperatorName, newOperatorShift);
      if (res.success && res.data) {
        setOperatorsList((prev) => [...prev, res.data!]);
        setIsAddOperatorModalOpen(false);
        setNewOperatorName("");
        setNewOperatorShift("A");
        alert("Operator berhasil ditambahkan!");
      } else {
        alert("Gagal menambah operator: " + res.error);
      }
    } catch (err: any) {
      alert("Terjadi kesalahan: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteOperatorSubmit = async (op: OperatorItem) => {
    if (!window.confirm(`Yakin ingin menghapus operator "${op.nama_operator}"?`)) {
      return;
    }
    try {
      const res = await deleteOperator(op.id);
      if (res.success) {
        setOperatorsList((prev) => prev.filter((o) => o.id !== op.id));
        alert("Operator berhasil dihapus!");
      } else {
        alert("Gagal menghapus operator: " + res.error);
      }
    } catch (err: any) {
      alert("Terjadi kesalahan: " + err.message);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await listAdminUsers();
      if (res.success && res.data) {
        setUsers(res.data as UserAccount[]);
      } else {
        alert("Gagal memuat daftar pengguna: " + res.error);
      }
    } catch (err) {
      console.error(err);
      alert("Terjadi kesalahan teknis saat memuat data.");
    } finally {
      setLoading(false);
    }
  };

  // Filtered users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchSearch =
        u.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.employee_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.email || "").toLowerCase().includes(searchQuery.toLowerCase());

      const matchRole = filterRole ? u.role === filterRole : true;

      return matchSearch && matchRole;
    });
  }, [users, searchQuery, filterRole]);

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setEmail("");
    setPassword("");
    setFullName("");
    setEmployeeId("");
    setRole("operator");
    setIsCreateModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (user: UserAccount) => {
    setSelectedUser(user);
    setEmail(user.email);
    setPassword(""); // leave blank for no change
    setFullName(user.full_name);
    setEmployeeId(user.employee_id);
    setRole(user.role);
    setIsEditModalOpen(true);
  };

  // Open Delete Modal
  const handleOpenDeleteModal = (user: UserAccount) => {
    setSelectedUser(user);
    setIsDeleteModalOpen(true);
  };

  // Handle Create Submit
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || !fullName || !employeeId) {
      return alert("Harap isi semua kolom wajib!");
    }

    const computedEmail = `${employeeId}@dji.local`;
    setActionLoading(true);
    try {
      const res = await createAdminUser({
        email: computedEmail,
        password,
        fullName,
        employeeId,
        role,
      });

      if (res.success) {
        setIsCreateModalOpen(false);
        await fetchUsers();
        alert("Akun berhasil dibuat!");
      } else {
        alert("Gagal membuat akun: " + res.error);
      }
    } catch (err: any) {
      alert("Terjadi kesalahan: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Edit Submit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    if (!fullName || !employeeId) {
      return alert("Harap isi semua kolom wajib!");
    }

    const computedEmail = `${employeeId}@dji.local`;
    setActionLoading(true);
    try {
      const res = await updateAdminUser(selectedUser.id, {
        email: computedEmail,
        fullName,
        employeeId,
        role,
        ...(password ? { password } : {}),
      });

      if (res.success) {
        setIsEditModalOpen(false);
        setSelectedUser(null);
        await fetchUsers();
        alert("Akun berhasil diperbarui!");
      } else {
        alert("Gagal memperbarui akun: " + res.error);
      }
    } catch (err: any) {
      alert("Terjadi kesalahan: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Delete Confirm
  const handleDeleteConfirm = async () => {
    if (!selectedUser) return;

    setActionLoading(true);
    try {
      const res = await deleteAdminUser(selectedUser.id);
      if (res.success) {
        setIsDeleteModalOpen(false);
        setSelectedUser(null);
        await fetchUsers();
        alert("Akun berhasil dihapus!");
      } else {
        alert("Gagal menghapus akun: " + res.error);
      }
    } catch (err: any) {
      alert("Terjadi kesalahan: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Helper to render role badge
  const renderRoleBadge = (roleName: string) => {
    const config: Record<
      string,
      { bg: string; text: string; label: string; icon: any }
    > = {
      admin: {
        bg: "bg-red-50 border-red-100",
        text: "text-red-700",
        label: "Admin",
        icon: Shield,
      },
      manager: {
        bg: "bg-amber-50 border-amber-100",
        text: "text-amber-700",
        label: "Manager",
        icon: UserCheck,
      },
      operator: {
        bg: "bg-blue-50 border-blue-100",
        text: "text-blue-700",
        label: "Operator",
        icon: Users,
      },
      inspeksi: {
        bg: "bg-emerald-50 border-emerald-100",
        text: "text-emerald-700",
        label: "Inspeksi (QC)",
        icon: UserCheck,
      },
      mending: {
        bg: "bg-purple-50 border-purple-100",
        text: "text-purple-700",
        label: "Mending",
        icon: SlidersHorizontal,
      },
    };

    const c = config[roleName] || {
      bg: "bg-slate-50 border-slate-100",
      text: "text-slate-700",
      label: roleName,
      icon: Users,
    };
    const Icon = c.icon;

    return (
      <span
        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold border ${c.bg} ${c.text}`}
      >
        <Icon className="w-3 h-3" /> {c.label}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div
        data-tour="users-header"
        className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white border border-[#e9ecef] rounded-[24px] p-6 shadow-[0_8px_30px_rgba(0,0,0,0.015)]"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800 flex items-center gap-2">
            <Users className="w-6 h-6 text-[#0070bc]" /> Manajemen Akun Pengguna
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Buat, edit, dan kelola hak akses kredensial akun operator, inspeksi,
            mending, dan admin.
          </p>
        </div>
        <div
          data-tour="users-create"
          className="flex flex-wrap items-center gap-3"
        >
          <button
            type="button"
            onClick={() => setIsTourOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-sky-100 bg-sky-50 px-4 py-2 text-sm font-bold text-[#0070bc] shadow-sm transition-all hover:bg-sky-100"
          >
            <HelpCircle className="w-4 h-4" />
            Tutorial
          </button>
          {activeTab === "users" ? (
            <button
              onClick={handleOpenCreateModal}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 shadow-sm hover:shadow-md transition-all cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              Tambah Akun Baru
            </button>
          ) : (
            <button
              onClick={() => setIsAddOperatorModalOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 shadow-sm hover:shadow-md transition-all cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              Tambah Operator Baru
            </button>
          )}
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-1">
        <button
          type="button"
          onClick={() => setActiveTab("users")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
            activeTab === "users"
              ? "bg-[#0070bc] text-white shadow-md shadow-sky-500/20"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Akun Pengguna ({users.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("operators")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
            activeTab === "operators"
              ? "bg-[#0070bc] text-white shadow-md shadow-sky-500/20"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span>Kelola Tim Operator ({operatorsList.length})</span>
        </button>
      </div>

      {activeTab === "users" ? (
        <>

      {/* Search & Filters */}
      <div
        data-tour="users-filters"
        className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white border border-[#e9ecef] rounded-[24px] p-4 shadow-[0_8px_30px_rgba(0,0,0,0.015)]"
      >
        {/* Search Input */}
        <div className="relative">
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            placeholder="Cari nama, ID, atau email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-700"
          />
        </div>

        {/* Filter Role */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider whitespace-nowrap">
            Role:
          </span>
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold cursor-pointer"
          >
            <option value="">Semua Role</option>
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
            <option value="operator">Operator</option>
            <option value="inspeksi">Inspeksi (QC)</option>
            <option value="mending">Mending</option>
          </select>
        </div>

        {/* Reset Filter Button */}
        <div className="flex justify-end">
          <button
            onClick={() => {
              setSearchQuery("");
              setFilterRole("");
            }}
            disabled={!searchQuery && !filterRole}
            className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 disabled:opacity-40 rounded-xl border border-slate-200 transition-all cursor-pointer w-full md:w-auto"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div
        data-tour="users-table"
        className="bg-white border border-[#e9ecef] rounded-[24px] shadow-[0_8px_30px_rgba(0,0,0,0.01)] overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 uppercase font-semibold text-xs border-b border-slate-100">
              <tr>
                <th className="px-6 py-4">ID Pegawai</th>
                <th className="px-6 py-4">Nama Lengkap</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Role Akses</th>
                <th className="px-6 py-4">Dibuat Pada</th>
                <th className="px-6 py-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-slate-400 font-medium"
                  >
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-500 mb-2" />
                    Memuat daftar pengguna...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-slate-400 font-medium"
                  >
                    Tidak ada akun pengguna yang cocok.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr
                    key={u.id}
                    className="hover:bg-slate-50/60 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap font-bold text-slate-800">
                      {u.employee_id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-semibold text-slate-700">
                      {u.full_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-slate-600 font-medium">
                      {u.email || "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {renderRoleBadge(u.role)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-400 font-semibold">
                      {new Date(u.created_at).toLocaleDateString("id-ID", {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-xs">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleOpenEditModal(u)}
                          className="p-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-100 transition-colors cursor-pointer"
                          title="Edit Akun"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenDeleteModal(u)}
                          className="p-1.5 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg border border-red-100 transition-colors cursor-pointer"
                          title="Hapus Akun"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      </>
    ) : (
      /* UI MANAJEMEN TIM OPERATOR (SHIFT A, B, C) */
      <div className="space-y-6">
        <div className="bg-sky-50 border border-sky-100 rounded-2xl p-4 flex items-start gap-3 shadow-xs">
          <Shield className="w-5 h-5 text-[#0070bc] shrink-0 mt-0.5" />
          <div>
            <h4 className="text-xs font-bold text-sky-900 uppercase tracking-wide">
              Pengaturan Rotasi & Tim Operator
            </h4>
            <p className="text-xs text-sky-700 mt-0.5 leading-relaxed font-medium">
              Pindahkan operator antar Tim/Shift (A, B, C) kapan saja sesuai jadwal rotasi. Perubahan akan langsung tersinkronisasi otomatis ke form input operator di lapangan.
            </p>
          </div>
        </div>

        {operatorsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-[#0070bc] animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { shift: "A", name: "Tim A", desc: "Shift Pagi (07:10 - 15:10)", color: "from-blue-500 to-sky-600" },
              { shift: "B", name: "Tim B", desc: "Shift Sore (15:10 - 23:10)", color: "from-amber-500 to-orange-500" },
              { shift: "C", name: "Tim C", desc: "Shift Malam (23:10 - 07:10)", color: "from-indigo-600 to-purple-600" },
            ].map((team) => {
              const teamOperators = operatorsList.filter((op) => op.shift === team.shift);
              return (
                <div key={team.shift} className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm flex flex-col justify-between">
                  <div>
                    {/* Card Header */}
                    <div className={`p-4 bg-gradient-to-r ${team.color} text-white flex items-center justify-between`}>
                      <div>
                        <h3 className="font-black text-base uppercase tracking-tight">{team.name}</h3>
                        <p className="text-[11px] text-white/80 font-medium">{team.desc}</p>
                      </div>
                      <span className="bg-white/20 backdrop-blur-md text-white font-black text-xs px-3 py-1 rounded-xl shadow-xs">
                        {teamOperators.length} Operator
                      </span>
                    </div>

                    {/* Operator List */}
                    <div className="p-4 space-y-2.5 max-h-[500px] overflow-y-auto custom-scrollbar">
                      {teamOperators.length === 0 ? (
                        <div className="p-6 text-center text-xs text-slate-400 font-medium">
                          Belum ada operator di {team.name}
                        </div>
                      ) : (
                        teamOperators.map((op, idx) => (
                          <div key={op.id} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-2xl hover:bg-slate-100/80 transition-all gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-7 h-7 rounded-xl bg-white border border-slate-200 flex items-center justify-center font-bold text-xs text-slate-600 shrink-0">
                                {idx + 1}
                              </div>
                              <span className="font-bold text-slate-800 text-xs sm:text-sm truncate">
                                {op.nama_operator}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {/* Shift Select Dropdown */}
                              <select
                                value={op.shift}
                                onChange={(e) => handleUpdateOperatorShift(op.id, e.target.value)}
                                className="bg-white border border-slate-200 rounded-xl px-2 py-1 text-[11px] font-extrabold text-slate-700 focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-2xs"
                                title="Pindahkan ke tim lain"
                              >
                                <option value="A">Tim A</option>
                                <option value="B">Tim B</option>
                                <option value="C">Tim C</option>
                              </select>

                              {/* Delete Operator */}
                              <button
                                type="button"
                                onClick={() => handleDeleteOperatorSubmit(op)}
                                className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                title="Hapus Operator"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Bottom Add Operator Button */}
                  <div className="p-3 bg-slate-50 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => {
                        setNewOperatorShift(team.shift);
                        setIsAddOperatorModalOpen(true);
                      }}
                      className="w-full py-2 px-3 rounded-xl border border-dashed border-slate-300 hover:border-blue-400 bg-white hover:bg-blue-50 text-slate-600 hover:text-blue-600 font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>+ Tambah ke {team.name}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    )}

      {/* CREATE MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-[24px] border border-slate-100 shadow-2xl w-full max-w-md overflow-hidden animate-scaleIn">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-blue-500" /> Tambah Akun Baru
              </h2>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4">
              {/* Full Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder=""
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-700"
                />
              </div>

              {/* Employee ID */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                  NIP (Nomor Induk Pegawai)
                </label>
                <input
                  type="text"
                  required
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  placeholder=""
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-700"
                />
              </div>

              {/* Role Select */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                  Role Akses
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-700 cursor-pointer"
                >
                  <option value="operator">
                    Operator (Form Input Produksi)
                  </option>
                  <option value="inspeksi">Inspeksi (Mutu/QC)</option>
                  <option value="mending">Mending (Departemen Mending)</option>
                  <option value="admin">Admin (Akses Penuh)</option>
                </select>
              </div>

              <div className="border-t border-slate-100 my-2 pt-2"></div>

              {/* Email (Hidden, Auto-generated) */}
              <input type="hidden" value={`${employeeId}@dji.local`} />

              {/* Password */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Key className="w-3 h-3" /> Password Awal
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  minLength={6}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-700"
                />
              </div>

              <div className="flex items-center gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="flex-1 px-4 py-2 text-xs font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex-1 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl transition-colors cursor-pointer flex justify-center items-center gap-1"
                >
                  {actionLoading ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Check className="w-3 h-3" />
                  )}
                  Simpan Akun
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {isEditModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-[24px] border border-slate-100 shadow-2xl w-full max-w-md overflow-hidden animate-scaleIn">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-blue-500" /> Edit Akun Pengguna
              </h2>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              {/* Full Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Nama Lengkap"
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-700"
                />
              </div>

              {/* Employee ID */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                  NIP (Nomor Induk Pegawai)
                </label>
                <input
                  type="text"
                  required
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  placeholder="ID Pegawai"
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-700"
                />
              </div>

              {/* Role Select */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                  Role Akses
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-700 cursor-pointer"
                >
                  <option value="operator">
                    Operator (Form Input Produksi)
                  </option>
                  <option value="inspeksi">Inspeksi (Mutu/QC)</option>
                  <option value="mending">Mending (Departemen Mending)</option>
                  <option value="admin">Admin (Akses Penuh)</option>
                </select>
              </div>

              <div className="border-t border-slate-100 my-2 pt-2"></div>

              {/* Email (Hidden, Auto-generated) */}
              <input type="hidden" value={`${employeeId}@dji.local`} />

              {/* Password Change */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Lock className="w-3 h-3" /> Ubah Password
                  </label>
                  <span className="text-[9px] text-slate-400 font-bold uppercase">
                    (Kosongkan jika tidak diganti)
                  </span>
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Ganti password (min. 6 karakter)"
                  minLength={6}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-700"
                />
              </div>

              <div className="flex items-center gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 px-4 py-2 text-xs font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex-1 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl transition-colors cursor-pointer flex justify-center items-center gap-1"
                >
                  {actionLoading ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Check className="w-3 h-3" />
                  )}
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE MODAL */}
      <ProductTour
        steps={USER_TOUR_STEPS}
        isOpen={isTourOpen}
        onClose={() => setIsTourOpen(false)}
      />

      {isDeleteModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-[24px] border border-slate-100 shadow-2xl w-full max-w-sm overflow-hidden animate-scaleIn">
            <div className="p-6 text-center space-y-4">
              <div className="w-12 h-12 bg-rose-50 border border-rose-100 rounded-full flex items-center justify-center mx-auto text-rose-600">
                <AlertTriangle className="w-6 h-6" />
              </div>

              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-800">
                  Hapus Akun Pengguna?
                </h3>
                <p className="text-xs text-slate-500">
                  Anda akan menghapus akun milik{" "}
                  <span className="font-bold text-slate-700">
                    {selectedUser.full_name}
                  </span>{" "}
                  ({selectedUser.employee_id}).
                </p>
                <p className="text-[10px] text-rose-500 font-bold bg-rose-50/50 p-2 rounded-lg border border-rose-100/60 leading-relaxed">
                  Tindakan ini permanen dan akan menghapus kredensial login
                  Supabase serta seluruh hak akses pengguna tersebut.
                </p>
              </div>

              <div className="flex items-center gap-3 pt-3">
                <button
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="flex-1 px-4 py-2 text-xs font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  disabled={actionLoading}
                  className="flex-1 px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-xl transition-colors cursor-pointer flex justify-center items-center gap-1"
                >
                  {actionLoading ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                  Hapus Permanen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Modal Tambah Operator Baru */}
      {isAddOperatorModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-100 flex flex-col animate-scaleUp">
            <div className="p-6 bg-gradient-to-br from-blue-600 to-sky-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center">
                  <UserPlus className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-black uppercase">Tambah Operator Baru</h3>
                  <p className="text-xs text-sky-100 font-medium mt-0.5">Daftarkan operator ke dalam tim/shift</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddOperatorModalOpen(false)}
                className="text-white/80 hover:text-white p-1 rounded-xl hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddOperatorSubmit} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block">
                  Nama Operator
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Budi Santoso"
                  value={newOperatorName}
                  onChange={(e) => setNewOperatorName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block">
                  Pilih Tim / Shift Utama
                </label>
                <select
                  value={newOperatorShift}
                  onChange={(e) => setNewOperatorShift(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="A">Tim A (Shift Pagi)</option>
                  <option value="B">Tim B (Shift Sore)</option>
                  <option value="C">Tim C (Shift Malam)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddOperatorModalOpen(false)}
                  className="py-3 px-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs uppercase tracking-wide transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs uppercase tracking-wide shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
                >
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Simpan Operator"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
