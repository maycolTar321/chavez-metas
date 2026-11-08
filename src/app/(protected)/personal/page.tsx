"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  UserPlus,
  Search,
  Edit3,
  Power,
  X,
} from "lucide-react";
import { useAppContext } from "@/components/layout/AppShell";
import { ROLE_LABELS } from "@/lib/permissions";
import type { UserRole } from "@/db/schema";

interface UserItem {
  id: number;
  username: string;
  email: string;
  fullName: string;
  role: UserRole;
  branchId: number | null;
  branchName: string | null;
  branchCode: string | null;
  canRegisterSales: boolean;
  canEditSales: boolean;
  canVoidSales: boolean;
  canManageGoals: boolean;
  isActive: boolean;
  phone: string | null;
  lastLoginAt: string | null;
}

export default function PersonalPage() {
  const { user, branches, selectedBranchId } = useAppContext();
  const [usersList, setUsersList] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    fullName: "",
    password: "",
    role: "TRABAJADOR" as UserRole,
    branchId: user.branchId || (branches[0]?.id ?? 0),
    canRegisterSales: true,
    canEditSales: false,
    canVoidSales: false,
    canManageGoals: false,
    isActive: true,
    phone: "",
  });
  const [saving, setSaving] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const q = selectedBranchId ? `?branchId=${selectedBranchId}` : "";
      const res = await fetch(`/api/users${q}`);
      if (res.ok) {
        const data = await res.json();
        setUsersList(data.users || []);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedBranchId]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  function openCreateModal() {
    setEditingUser(null);
    setFormData({
      username: "",
      email: "",
      fullName: "",
      password: "",
      role: "TRABAJADOR",
      branchId:
        user.role === "ADMIN_SUCURSAL"
          ? user.branchId || 0
          : selectedBranchId || branches[0]?.id || 0,
      canRegisterSales: true,
      canEditSales: false,
      canVoidSales: false,
      canManageGoals: false,
      isActive: true,
      phone: "",
    });
    setModalOpen(true);
  }

  function openEditModal(u: UserItem) {
    setEditingUser(u);
    setFormData({
      username: u.username,
      email: u.email,
      fullName: u.fullName,
      password: "",
      role: u.role,
      branchId: u.branchId || 0,
      canRegisterSales: u.canRegisterSales,
      canEditSales: u.canEditSales,
      canVoidSales: u.canVoidSales,
      canManageGoals: u.canManageGoals,
      isActive: u.isActive,
      phone: u.phone || "",
    });
    setModalOpen(true);
  }

  async function handleSaveUser(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const isGlobalRole =
        formData.role === "SUPERADMIN" || formData.role === "GERENCIA";
      const payload = {
        ...formData,
        branchId: isGlobalRole ? null : Number(formData.branchId) || null,
        password: formData.password.trim() ? formData.password : undefined,
      };

      const url = editingUser ? `/api/users/${editingUser.id}` : "/api/users";
      const method = editingUser ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Error al guardar el usuario");
        setSaving(false);
        return;
      }
      setModalOpen(false);
      await loadUsers();
    } finally {
      setSaving(false);
    }
  }

  async function toggleUserActive(u: UserItem) {
    if (u.id === user.id) {
      alert("No puedes desactivar tu propio usuario.");
      return;
    }
    const res = await fetch(`/api/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !u.isActive }),
    });
    if (res.ok) {
      await loadUsers();
    }
  }

  const filtered = usersList.filter(
    (u) =>
      u.fullName.toLowerCase().includes(search.toLowerCase()) ||
      u.username.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.branchName || "").toLowerCase().includes(search.toLowerCase())
  );

  const canManageUsers =
    user.role === "SUPERADMIN" || user.role === "ADMIN_SUCURSAL";

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-blue-100 text-blue-800">
            Control de Acceso y Roles por Sucursal
          </span>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1">
            Administración de Personal y Permisos
          </h1>
          <p className="text-xs text-slate-500">
            Gestiona trabajadores, encargados, administradores de sucursal y gerencia con aislamiento estricto de datos.
          </p>
        </div>

        {canManageUsers && (
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition"
          >
            <UserPlus className="w-4 h-4" />
            <span>Registrar Personal</span>
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl p-4 border border-slate-200 flex items-center justify-between gap-3">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nombre, usuario, correo o sucursal..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-300 text-xs"
          />
        </div>
        <span className="text-xs font-bold text-slate-500">
          Total: {filtered.length} usuarios
        </span>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 px-4">Personal</th>
                <th className="py-3.5 px-4">Rol del Sistema</th>
                <th className="py-3.5 px-4">Sucursal Asignada</th>
                <th className="py-3.5 px-4">Permisos Operativos</th>
                <th className="py-3.5 px-4 text-center">Estado</th>
                <th className="py-3.5 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-10 text-center text-xs text-slate-500"
                  >
                    Cargando personal...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-10 text-center text-xs text-slate-500"
                  >
                    No se encontraron usuarios.
                  </td>
                </tr>
              ) : (
                filtered.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="py-3.5 px-4">
                      <p className="font-bold text-slate-900">{u.fullName}</p>
                      <p className="text-xs text-slate-500">
                        @{u.username} • {u.email}
                      </p>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex px-2.5 py-1 rounded-lg bg-blue-50 text-blue-800 text-xs font-bold">
                        {ROLE_LABELS[u.role]}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-xs font-semibold text-slate-700">
                      {u.branchName ? (
                        <span>
                          {u.branchCode} — {u.branchName}
                        </span>
                      ) : (
                        <span className="text-slate-400">
                          🌐 Acceso Global Multi-Sucursal
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap gap-1 text-[10px] font-bold">
                        {u.canRegisterSales && (
                          <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Reg. Ventas
                          </span>
                        )}
                        {(u.canEditSales || u.role === "SUPERADMIN") && (
                          <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                            Editar Ventas
                          </span>
                        )}
                        {(u.canVoidSales || u.role === "SUPERADMIN") && (
                          <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                            Anular Ventas
                          </span>
                        )}
                        {(u.canManageGoals || u.role === "SUPERADMIN") && (
                          <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                            Metas
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          u.isActive
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {u.isActive ? "ACTIVO" : "INACTIVO"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      {canManageUsers && (
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditModal(u)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
                            title="Editar usuario / restablecer contraseña"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          {u.id !== user.id && (
                            <button
                              type="button"
                              onClick={() => toggleUserActive(u)}
                              className={`p-1.5 rounded-lg ${
                                u.isActive
                                  ? "bg-amber-50 text-amber-700 hover:bg-amber-100"
                                  : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                              }`}
                              title={
                                u.isActive
                                  ? "Desactivar acceso"
                                  : "Activar acceso"
                              }
                            >
                              <Power className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Crear / Editar Usuario */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {editingUser ? "Editar Personal y Permisos" : "Registrar Nuevo Personal"}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold uppercase text-slate-700 mb-1">
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  required
                  value={formData.fullName}
                  onChange={(e) =>
                    setFormData({ ...formData, fullName: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-semibold"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold uppercase text-slate-700 mb-1">
                    Usuario (Login) *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={Boolean(editingUser)}
                    value={formData.username}
                    onChange={(e) =>
                      setFormData({ ...formData, username: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 disabled:bg-slate-100"
                  />
                </div>
                <div>
                  <label className="block font-bold uppercase text-slate-700 mb-1">
                    Correo Electrónico *
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold uppercase text-slate-700 mb-1">
                    {editingUser
                      ? "Nueva Contraseña (dejar vacío para no cambiar)"
                      : "Contraseña Inicial *"}
                  </label>
                  <input
                    type="password"
                    required={!editingUser}
                    minLength={6}
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    placeholder="Mínimo 6 caracteres"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-bold uppercase text-slate-700 mb-1">
                    Teléfono
                  </label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold uppercase text-slate-700 mb-1">
                    Rol *
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        role: e.target.value as UserRole,
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-semibold"
                  >
                    {user.role === "SUPERADMIN" && (
                      <>
                        <option value="SUPERADMIN">SUPERADMIN</option>
                        <option value="GERENCIA">GERENCIA</option>
                        <option value="ADMIN_SUCURSAL">
                          ADMINISTRADOR DE SUCURSAL
                        </option>
                      </>
                    )}
                    <option value="ENCARGADO">ENCARGADO DE TURNO</option>
                    <option value="TRABAJADOR">TRABAJADOR</option>
                  </select>
                </div>

                {formData.role !== "SUPERADMIN" &&
                  formData.role !== "GERENCIA" && (
                    <div>
                      <label className="block font-bold uppercase text-slate-700 mb-1">
                        Sucursal Asignada *
                      </label>
                      <select
                        disabled={user.role === "ADMIN_SUCURSAL"}
                        value={formData.branchId}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            branchId: Number(e.target.value),
                          })
                        }
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 font-semibold disabled:bg-slate-100"
                      >
                        {branches.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.code} — {b.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <p className="font-bold text-slate-800">
                  Permisos Específicos:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.canRegisterSales}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          canRegisterSales: e.target.checked,
                        })
                      }
                      className="rounded border-slate-300 text-blue-600"
                    />
                    <span>Autorizado a registrar ventas</span>
                  </label>

                  {user.role === "SUPERADMIN" && (
                    <>
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={formData.canEditSales}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              canEditSales: e.target.checked,
                            })
                          }
                          className="rounded border-slate-300 text-blue-600"
                        />
                        <span>Editar ventas registradas</span>
                      </label>
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={formData.canVoidSales}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              canVoidSales: e.target.checked,
                            })
                          }
                          className="rounded border-slate-300 text-blue-600"
                        />
                        <span>Anular ventas con auditoría</span>
                      </label>
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={formData.canManageGoals}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              canManageGoals: e.target.checked,
                            })
                          }
                          className="rounded border-slate-300 text-blue-600"
                        />
                        <span>Crear / Modificar metas mensuales</span>
                      </label>
                    </>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 font-semibold text-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold"
                >
                  {saving ? "Guardando..." : "Guardar Usuario"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
