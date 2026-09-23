// src/pages/AdminPage.jsx
// Admin panel: create ASHA worker + doctor accounts, manage users
import { useState, useEffect } from "react";
import {
  UserPlus, Users, ShieldCheck, Trash2, RefreshCw,
  Eye, EyeOff, CheckCircle, AlertCircle, Edit2, X
} from "lucide-react";
import { adminListUsers, adminCreateUser, adminUpdateUser, adminDeleteUser } from "../utils/api";

// ── Helper: readable message from axios/FastAPI error ────────────
const getErrMsg = (err, fallback = "Something went wrong.") => {
  const detail = err?.response?.data?.detail;
  if (!detail) return err?.response?.data?.message || fallback;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map(d => d.msg || d.message || JSON.stringify(d)).join("; ");
  return detail.message || detail.error || fallback;
};

const ROLE_META = {
  asha:         { label: "ASHA Worker", color: "bg-teal-100 text-teal-700 border-teal-200" },
  field_worker: { label: "ASHA Worker", color: "bg-teal-100 text-teal-700 border-teal-200" },
  doctor:       { label: "Doctor",      color: "bg-blue-100 text-blue-700 border-blue-200" },
  admin:        { label: "Admin",       color: "bg-purple-100 text-purple-700 border-purple-200" },
};

function RoleBadge({ role }) {
  const m = ROLE_META[role] || { label: role, color: "bg-gray-100 text-gray-600 border-gray-200" };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${m.color}`}>
      {m.label}
    </span>
  );
}

export default function AdminPage() {
  const [users, setUsers]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [editUser, setEditUser]     = useState(null);   // user being edited
  const [toast, setToast]           = useState(null);   // { msg, type }
  const [showPass, setShowPass]     = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    name: "", username: "", password: "", role: "asha", phc_id: ""
  });

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await adminListUsers();
      setUsers(data);
    } catch {
      showToast("Failed to load users", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const openCreateForm = () => {
    setEditUser(null);
    setForm({ name: "", username: "", password: "", role: "asha", phc_id: "" });
    setShowForm(true);
    setShowPass(false);
  };

  const openEditForm = (user) => {
    setEditUser(user);
    setForm({ name: user.name, username: user.username || "", password: "", role: user.role, phc_id: user.phc_id || "" });
    setShowForm(true);
    setShowPass(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editUser) {
        const payload = { name: form.name, role: form.role, phc_id: form.phc_id || null };
        if (form.password) payload.password = form.password;
        await adminUpdateUser(editUser.user_id, payload);
        showToast(`${form.name}'s account updated`);
      } else {
        await adminCreateUser({
          name:     form.name,
          username: form.username,
          password: form.password,
          role:     form.role,
          phc_id:   form.phc_id || null,
        });
        showToast(`Account created for ${form.name} (${form.username})`);
      }
      setShowForm(false);
      fetchUsers();
    } catch (err) {
      const msg = getErrMsg(err, "Failed to save user");
      showToast(msg, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = async (user) => {
    if (!window.confirm(`Deactivate ${user.name}'s account?`)) return;
    try {
      await adminDeleteUser(user.user_id);
      showToast(`${user.name}'s account deactivated`);
      fetchUsers();
    } catch (err) {
      showToast(getErrMsg(err, "Failed to deactivate"), "error");
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-3 sm:p-6 space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl border text-sm font-semibold transition-all
          ${toast.type === "error"
            ? "bg-rose-50 border-rose-200 text-rose-700"
            : "bg-[#E8F7F6] border-[#22AEB0]/30 text-[#1F2F42]"}`}
        >
          {toast.type === "error" ? <AlertCircle size={18} /> : <CheckCircle size={18} className="text-[#22AEB0]" />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#1F2F42] tracking-tight">User Management</h1>
          <p className="text-xs text-[#94A1AB] font-medium mt-0.5">
            Create and manage ASHA worker and doctor accounts
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button onClick={fetchUsers} disabled={loading} className="btn-outline gap-2 text-xs py-2.5 px-4">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
          <button onClick={openCreateForm} className="btn-primary gap-2 text-xs py-2.5 px-4">
            <UserPlus size={14} />
            New Account
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { role: "asha",   label: "ASHA Workers", color: "text-[#22AEB0]", bg: "bg-[#E8F7F6]" },
          { role: "doctor", label: "Doctors",      color: "text-blue-600",  bg: "bg-blue-50"   },
          { role: "admin",  label: "Admins",        color: "text-purple-600", bg: "bg-purple-50" },
        ].map(({ role, label, color, bg }) => {
          const count = users.filter(u => u.role === role || (role === "asha" && u.role === "field_worker")).length;
          return (
            <div key={role} className={`card-static p-5 flex items-center gap-4`}>
              <div className={`p-3 rounded-xl ${bg}`}>
                <Users size={20} className={color} />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#1F2F42]">{count}</p>
                <p className="text-xs font-semibold text-[#657685]">{label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create / Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-[#1F2F42]/50 backdrop-blur-sm z-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-[#E1E9EC] w-full max-w-lg p-8 relative">
            <button
              onClick={() => setShowForm(false)}
              className="absolute top-5 right-5 text-[#94A1AB] hover:text-[#1F2F42] transition cursor-pointer"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-[#E8F7F6] rounded-xl">
                {editUser ? <Edit2 size={20} className="text-[#22AEB0]" /> : <UserPlus size={20} className="text-[#22AEB0]" />}
              </div>
              <div>
                <h2 className="text-lg font-bold text-[#1F2F42]">
                  {editUser ? "Edit Account" : "Create New Account"}
                </h2>
                <p className="text-xs text-[#94A1AB] font-medium">
                  {editUser ? "Update user details below" : "Credentials will be shared with the user"}
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#657685] mb-1.5">Full Name *</label>
                  <input
                    className="input-themed"
                    placeholder="e.g. Priya Sharma"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#657685] mb-1.5">Role *</label>
                  <select
                    className="input-themed"
                    value={form.role}
                    onChange={e => setForm({ ...form, role: e.target.value })}
                  >
                    <option value="asha">ASHA Worker</option>
                    <option value="doctor">Doctor</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>

              {!editUser && (
                <div>
                  <label className="block text-xs font-semibold text-[#657685] mb-1.5">Username *</label>
                  <input
                    className="input-themed font-mono"
                    placeholder="e.g. asha_priya"
                    value={form.username}
                    onChange={e => setForm({ ...form, username: e.target.value.toLowerCase().replace(/\s/g, "_") })}
                    required={!editUser}
                  />
                  <p className="text-[10px] text-[#94A1AB] mt-1">This will be their login username</p>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[#657685] mb-1.5">
                  {editUser ? "New Password (leave blank to keep current)" : "Password *"}
                </label>
                <div className="relative">
                  <input
                    className="input-themed pr-11"
                    type={showPass ? "text" : "password"}
                    placeholder={editUser ? "Leave blank to keep existing" : "Minimum 6 characters"}
                    value={form.password}
                    onChange={e => setForm({ ...form, password: e.target.value })}
                    required={!editUser}
                    minLength={editUser ? 0 : 6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A1AB] hover:text-[#22AEB0] transition cursor-pointer"
                  >
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#657685] mb-1.5">PHC / Centre (optional)</label>
                <input
                  className="input-themed"
                  placeholder="e.g. PHC Shivpuri"
                  value={form.phc_id}
                  onChange={e => setForm({ ...form, phc_id: e.target.value })}
                />
              </div>

              {/* Credentials preview for new users */}
              {!editUser && form.username && form.password && (
                <div className="bg-[#E8F7F6] border border-[#22AEB0]/20 rounded-xl p-4">
                  <p className="text-xs font-bold text-[#1F2F42] mb-2 flex items-center gap-1.5">
                    <ShieldCheck size={13} className="text-[#22AEB0]" />
                    Credentials to share with user
                  </p>
                  <p className="text-xs text-[#657685] font-mono">
                    Username: <strong className="text-[#1F2F42]">{form.username}</strong>
                  </p>
                  <p className="text-xs text-[#657685] font-mono">
                    Password: <strong className="text-[#1F2F42]">{form.password}</strong>
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 px-4 py-3 text-sm font-semibold text-[#657685] bg-[#F7FAFB] border border-[#E1E9EC] rounded-xl hover:bg-[#E1E9EC] transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 btn-primary py-3 text-sm gap-2"
                >
                  {submitting ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    editUser ? "Update Account" : "Create Account"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="card-static overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E1E9EC] flex items-center gap-2">
          <Users size={18} className="text-[#22AEB0]" />
          <h2 className="font-bold text-[#1F2F42] text-sm">All Accounts</h2>
          <span className="ml-auto text-xs text-[#94A1AB] font-medium">{users.length} users</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-[#94A1AB] text-sm">Loading users...</div>
        ) : users.length === 0 ? (
          <div className="p-10 text-center">
            <Users size={36} className="text-[#E1E9EC] mx-auto mb-3" />
            <p className="text-sm text-[#94A1AB] font-medium">No accounts yet. Create the first one!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E1E9EC] bg-[#F7FAFB]">
                  <th className="text-left px-5 py-3 text-xs font-bold text-[#657685] uppercase tracking-wider">Name</th>
                  <th className="text-left px-5 py-3 text-xs font-bold text-[#657685] uppercase tracking-wider">Username</th>
                  <th className="text-left px-5 py-3 text-xs font-bold text-[#657685] uppercase tracking-wider">Role</th>
                  <th className="text-left px-5 py-3 text-xs font-bold text-[#657685] uppercase tracking-wider">Status</th>
                  <th className="text-left px-5 py-3 text-xs font-bold text-[#657685] uppercase tracking-wider">PHC</th>
                  <th className="text-right px-5 py-3 text-xs font-bold text-[#657685] uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr
                    key={u.user_id}
                    className={`border-b border-[#F7FAFB] hover:bg-[#F7FAFB] transition-colors ${!u.is_active ? "opacity-50" : ""}`}
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-[#22AEB0]/10 flex items-center justify-center text-[#22AEB0] text-xs font-bold flex-shrink-0">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-semibold text-[#1F2F42]">{u.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs text-[#657685]">{u.username || "—"}</td>
                    <td className="px-5 py-3.5"><RoleBadge role={u.role} /></td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border
                        ${u.is_active
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-rose-50 text-rose-600 border-rose-200"}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${u.is_active ? "bg-emerald-500" : "bg-rose-500"}`} />
                        {u.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-[#94A1AB]">{u.phc_id || "—"}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditForm(u)}
                          className="p-2 text-[#657685] hover:text-[#22AEB0] hover:bg-[#E8F7F6] rounded-lg transition cursor-pointer"
                          title="Edit user"
                        >
                          <Edit2 size={14} />
                        </button>
                        {u.is_active && (
                          <button
                            onClick={() => handleDeactivate(u)}
                            className="p-2 text-[#657685] hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                            title="Deactivate account"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
