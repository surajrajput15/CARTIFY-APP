import { useState, useEffect, useCallback } from 'react';
import { Search, Filter, ChevronDown, ChevronUp, Loader2, AlertCircle, ShieldCheck, UserX, UserCheck, UserMinus, Eye, EyeOff, Bell, Mail, MapPin, Heart, Package, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';
import { fetchUsers, fetchUserById, fetchUserLoginHistory, patchUserStatus } from '../../services/usersApi';
import { isNetworkError } from '../../utils/apiError';
import { formatDate, formatPrice } from '../../utils/format';

const STATUS_LABELS = { active: 'Active', blocked: 'Blocked', deactivated: 'Deactivated' };
const STATUS_COLORS = { active: 'text-green-600 bg-green-50', blocked: 'text-red-600 bg-red-50', deactivated: 'text-gray-600 bg-gray-50' };

function StatusBadge({ status }) {
    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${STATUS_COLORS[status] || 'text-gray-600 bg-gray-50'}`}>
            {STATUS_LABELS[status] || status}
        </span>
    );
}

function ActionButton({ children, onClick, variant = 'primary', disabled, className = '' }) {
    const base = 'inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-bold rounded-lg transition-colors min-h-[36px]';
    const variants = {
        primary: 'bg-teal-600 text-white hover:bg-teal-700',
        danger: 'bg-red-600 text-white hover:bg-red-700',
        warning: 'bg-amber-600 text-white hover:bg-amber-700',
        ghost: 'bg-gray-100 text-gray-700 hover:bg-gray-200'
    };
    return (
        <button type="button" onClick={onClick} disabled={disabled} className={`${base} ${variants[variant]} ${className}`} aria-disabled={disabled}>
            {children}
        </button>
    );
}

export default function AdminUsersTab() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [statusFilter, setStatusFilter] = useState('all');
    const [search, setSearch] = useState('');
    const [selectedUser, setSelectedUser] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [loginHistory, setLoginHistory] = useState([]);
    const [actionLoading, setActionLoading] = useState(null);
    const [confirmAction, setConfirmAction] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params = { page, limit: 20, status: statusFilter !== 'all' ? statusFilter : undefined, search: search || undefined };
            const res = await fetchUsers(params);
            setUsers(res.data.users || []);
            setTotal(res.data.total || 0);
        } catch (err) {
            if (!isNetworkError(err)) toast.error('Failed to load users');
        } finally {
            setLoading(false);
        }
    }, [page, statusFilter, search]);

    useEffect(() => { load(); }, [load]);

    const handleDetail = async (user) => {
        setSelectedUser(user);
        setDetailLoading(true);
        try {
            const [detailRes, historyRes] = await Promise.all([
                fetchUserById(user._id),
                fetchUserLoginHistory(user._id, { limit: 10 })
            ]);
            setSelectedUser({ ...user, ...detailRes.data });
            setLoginHistory(historyRes.data.events || []);
        } catch (err) {
            if (!isNetworkError(err)) toast.error('Failed to load user details');
        } finally {
            setDetailLoading(false);
        }
    };

    const closeDetail = () => { setSelectedUser(null); setLoginHistory([]); };

    const handleStatusAction = async (user, action, reason) => {
        if (action === 'block' && !reason) {
            toast.error('Block reason is required');
            return;
        }
        setActionLoading(user._id);
        try {
            await patchUserStatus(user._id, action, reason);
            toast.success(`User ${action}ed successfully`);
            load();
            if (selectedUser?._id === user._id) handleDetail(user);
        } catch (err) {
            if (!isNetworkError(err)) toast.error(err?.response?.data?.message || `Failed to ${action} user`);
        } finally {
            setActionLoading(null);
            setConfirmAction(null);
        }
    };

    const requestConfirm = (user, action) => {
        if (action === 'block') {
            setConfirmAction({ user, action, reason: '' });
        } else {
            handleStatusAction(user, action);
        }
    };

    const statusOptions = [
        { value: 'all', label: 'All' },
        { value: 'active', label: 'Active' },
        { value: 'blocked', label: 'Blocked' },
        { value: 'deactivated', label: 'Deactivated' }
    ];

    return (
        <div className="space-y-6">
            <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Users CRM</h2>
                    <p className="text-sm text-gray-500">Manage customers: view details, orders, addresses, login history, and block/unblock/deactivate.</p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
                        {statusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input type="text" placeholder="Search name, email, phone..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="w-64 pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm bg-white" />
                    </div>
                </div>
            </header>

            {loading ? (
                <div className="py-16 flex justify-center"><Loader2 size={26} className="animate-spin text-teal-600" /></div>
            ) : users.length === 0 ? (
                <div className="py-16 text-center text-gray-500">No users found</div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm" role="grid">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                                <th className="px-4 py-3 text-left font-bold text-gray-600">User</th>
                                <th className="px-4 py-3 text-left font-bold text-gray-600 hidden md:table-cell">Role</th>
                                <th className="px-4 py-3 text-left font-bold text-gray-600 hidden lg:table-cell">Status</th>
                                <th className="px-4 py-3 text-left font-bold text-gray-600 hidden lg:table-cell">Last Login</th>
                                <th className="px-4 py-3 text-left font-bold text-gray-600 hidden xl:table-cell">Joined</th>
                                <th className="px-4 py-3 text-right font-bold text-gray-600">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {users.map(u => (
                                <tr key={u._id} className="hover:bg-gray-50 cursor-pointer" onClick={() => handleDetail(u)}>
                                    <td className="px-4 py-3 font-medium text-gray-900">{u.name}</td>
                                    <td className="px-4 py-3 text-gray-500 hidden md:table-cell capitalize">{u.role}</td>
                                    <td className="px-4 py-3 hidden lg:table-cell"><StatusBadge status={u.status} /></td>
                                    <td className="px-4 py-3 text-gray-500 hidden lg:table-cell">{u.lastLoginAt ? formatDate(u.lastLoginAt) : 'Never'}</td>
                                    <td className="px-4 py-3 text-gray-500 hidden xl:table-cell">{formatDate(u.createdAt)}</td>
                                    <td className="px-4 py-3 text-right">
                                        <ActionButton variant="ghost" onClick={e => { e.stopPropagation(); handleDetail(u); }}><Eye size={16} /> View</ActionButton>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {total > 20 && (
                        <div className="flex items-center justify-between mt-4 px-4">
                            <p className="text-sm text-gray-500">Page {page} of {Math.ceil(total / 20)} — {total} total</p>
                            <div className="flex gap-2">
                                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm disabled:opacity-50">Prev</button>
                                <button onClick={() => setPage(p => Math.min(Math.ceil(total / 20), p + 1))} disabled={page >= Math.ceil(total / 20)} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm disabled:opacity-50">Next</button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {selectedUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={closeDetail} role="dialog" aria-modal="true" aria-labelledby="detail-title">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
                        <header className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                            <h3 id="detail-title" className="text-xl font-bold text-gray-900">{selectedUser.name} ({selectedUser.email})</h3>
                            <button onClick={closeDetail} className="p-1 rounded-lg hover:bg-gray-100" aria-label="Close"><EyeOff size={20} className="text-gray-500" /></button>
                        </header>
                        <div className="p-6 overflow-y-auto flex-1">
                            {detailLoading ? <div className="py-16 flex justify-center"><Loader2 size={26} className="animate-spin text-teal-600" /></div> : (
                                <div className="space-y-6">
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                        <div className="p-3 bg-gray-50 rounded-lg"><p className="text-gray-500">Status</p><p className="font-bold"><StatusBadge status={selectedUser.status} /></p></div>
                                        <div className="p-3 bg-gray-50 rounded-lg"><p className="text-gray-500">Role</p><p className="font-bold capitalize">{selectedUser.role}</p></div>
                                        <div className="p-3 bg-gray-50 rounded-lg"><p className="text-gray-500">Last Login</p><p className="font-bold">{selectedUser.lastLoginAt ? formatDate(selectedUser.lastLoginAt) : 'Never'}</p></div>
                                        <div className="p-3 bg-gray-50 rounded-lg"><p className="text-gray-500">Joined</p><p className="font-bold">{formatDate(selectedUser.createdAt)}</p></div>
                                    </div>

                                    {selectedUser.stats && (
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                            <div className="p-3 bg-teal-50 rounded-lg"><p className="text-teal-700">Total Orders</p><p className="font-bold text-2xl">{selectedUser.stats.orderCount}</p></div>
                                            <div className="p-3 bg-teal-50 rounded-lg"><p className="text-teal-700">Total Spent</p><p className="font-bold text-2xl">{formatPrice(selectedUser.stats.totalSpent)}</p></div>
                                            <div className="p-3 bg-teal-50 rounded-lg"><p className="text-teal-700">Addresses</p><p className="font-bold text-2xl">{selectedUser.addresses?.length || 0}</p></div>
                                            <div className="p-3 bg-teal-50 rounded-lg"><p className="text-teal-700">Paid Orders</p><p className="font-bold text-2xl">{selectedUser.stats.paidOrders || 0}</p></div>
                                        </div>
                                    )}

                                    {selectedUser.addresses?.length && (
                                        <section>
                                            <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2"><MapPin size={18} className="text-teal-600" /> Addresses</h4>
                                            <div className="space-y-2">
                                                {selectedUser.addresses.map(a => (
                                                    <div key={a._id} className="p-3 bg-gray-50 rounded-lg text-sm">
                                                        <p className="font-medium">{a.fullName} {a.isDefault && <span className="ml-2 px-1.5 py-0.5 text-[10px] font-bold bg-teal-100 text-teal-700 rounded">Default</span>}</p>
                                                        <p className="text-gray-600">{a.street}, {a.city}, {a.state} - {a.pincode}</p>
                                                        <p className="text-gray-500">{a.phone}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </section>
                                    )}

                                    <section>
                                        <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2"><Bell size={18} className="text-teal-600" /> Login History (last 10)</h4>
                                        {loginHistory.length === 0 ? (
                                            <p className="text-gray-500 py-4">No login history found</p>
                                        ) : (
                                            <div className="space-y-2 max-h-60 overflow-y-auto">
                                                {loginHistory.map((evt, i) => (
                                                    <div key={i} className="p-3 bg-gray-50 rounded-lg text-sm flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center"><ShieldCheck size={14} className="text-teal-600" /></div>
                                                            <div>
                                                                <p className="font-medium">{evt.details?.method || 'Unknown'}</p>
                                                                <p className="text-gray-500 text-xs">{formatDate(evt.timestamp)} • {evt.ip || 'IP unknown'}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </section>

                                    <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-100">
                                        {selectedUser.status !== 'blocked' && (
                                            <ActionButton variant="danger" onClick={() => requestConfirm(selectedUser, 'block')} disabled={actionLoading === selectedUser._id}>
                                                <UserX size={16} /> Block
                                            </ActionButton>
                                        )}
                                        {selectedUser.status === 'blocked' && (
                                            <ActionButton variant="warning" onClick={() => handleStatusAction(selectedUser, 'unblock')} disabled={actionLoading === selectedUser._id}>
                                                <UserCheck size={16} /> Unblock
                                            </ActionButton>
                                        )}
                                        {selectedUser.status !== 'deactivated' && (
                                            <ActionButton variant="danger" onClick={() => requestConfirm(selectedUser, 'deactivate')} disabled={actionLoading === selectedUser._id}>
                                                <UserMinus size={16} /> Deactivate
                                            </ActionButton>
                                        )}
                                        {selectedUser.status === 'deactivated' && (
                                            <ActionButton variant="primary" onClick={() => handleStatusAction(selectedUser, 'activate')} disabled={actionLoading === selectedUser._id}>
                                                <UserCheck size={16} /> Activate
                                            </ActionButton>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {confirmAction && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">Confirm Block</h3>
                        <p className="text-gray-600 mb-4">Enter a reason for blocking <strong>{confirmAction.user.name}</strong>:</p>
                        <textarea value={confirmAction.reason} onChange={e => setConfirmAction({ ...confirmAction, reason: e.target.value })} rows={3} className="w-full p-3 border border-gray-300 rounded-lg text-sm" placeholder="Reason for blocking..." />
                        <div className="flex justify-end gap-3 mt-4">
                            <button onClick={() => setConfirmAction(null)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">Cancel</button>
                            <ActionButton variant="danger" onClick={() => handleStatusAction(confirmAction.user, 'block', confirmAction.reason)} disabled={actionLoading === confirmAction.user._id}>
                                <UserX size={16} /> Block User
                            </ActionButton>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}