import { useState, useEffect, useCallback } from 'react';
import { Search, Loader2, Send, Bell, UserPlus, X, Edit2, Trash2, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { fetchAdminNotifications, createNotification } from '../../services/notificationApi';
import { isNetworkError } from '../../utils/apiError';
import { formatDate } from '../../utils/format';

const TYPE_LABELS = { system: 'System', order: 'Order', promotion: 'Promotion', stock: 'Stock', security: 'Security' };
const TYPE_COLORS = { system: 'text-blue-600 bg-blue-50', order: 'text-teal-600 bg-teal-50', promotion: 'text-purple-600 bg-purple-50', stock: 'text-amber-600 bg-amber-50', security: 'text-red-600 bg-red-50' };

function TypeBadge({ type }) {
    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${TYPE_COLORS[type] || 'text-gray-600 bg-gray-50'}`}>
            {TYPE_LABELS[type] || type}
        </span>
    );
}

export default function AdminNotificationsTab() {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [typeFilter, setTypeFilter] = useState('all');
    const [unreadOnly, setUnreadOnly] = useState(false);
    const [showCompose, setShowCompose] = useState(false);
    const [compose, setCompose] = useState({ title: '', message: '', type: 'system', broadcast: true, recipientId: '' });
    const [sending, setSending] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params = { page, limit: 20, type: typeFilter !== 'all' ? typeFilter : undefined, unread: unreadOnly };
            const res = await fetchAdminNotifications(params);
            setNotifications(res.data.notifications || []);
            setTotal(res.data.total || 0);
        } catch (err) {
            if (!isNetworkError(err)) toast.error('Failed to load notifications');
        } finally {
            setLoading(false);
        }
    }, [page, typeFilter, unreadOnly]);

    useEffect(() => { load(); }, [load]);

    const handleSend = async () => {
        if (!compose.title.trim() || !compose.message.trim()) {
            toast.error('Title and message are required');
            return;
        }
        if (!compose.broadcast && !compose.recipientId.trim()) {
            toast.error('Recipient ID required for targeted notification');
            return;
        }
        setSending(true);
        try {
            await createNotification({ ...compose, recipientId: compose.broadcast ? null : compose.recipientId });
            toast.success(compose.broadcast ? 'Broadcast sent!' : 'Notification sent!');
            setShowCompose(false);
            setCompose({ title: '', message: '', type: 'system', broadcast: true, recipientId: '' });
            load();
        } catch (err) {
            if (!isNetworkError(err)) toast.error(err?.response?.data?.message || 'Failed to send notification');
        } finally {
            setSending(false);
        }
    };

    const typeOptions = [
        { value: 'all', label: 'All Types' },
        { value: 'system', label: 'System' },
        { value: 'order', label: 'Order' },
        { value: 'promotion', label: 'Promotion' },
        { value: 'stock', label: 'Stock' },
        { value: 'security', label: 'Security' }
    ];

    return (
        <div className="space-y-6">
            <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Notifications</h2>
                    <p className="text-sm text-gray-500">View all notifications and send broadcasts or targeted messages.</p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <button type="button" onClick={() => setShowCompose(true)} className="px-4 py-2.5 bg-teal-600 text-white flex items-center gap-2 rounded-lg font-bold text-sm hover:bg-teal-700 transition-colors min-h-[44px]"><Send size={16} /> New Broadcast</button>
                    <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1); }} className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
                        {typeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <label className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white cursor-pointer">
                        <input type="checkbox" checked={unreadOnly} onChange={e => { setUnreadOnly(e.target.checked); setPage(1); }} className="w-4 h-4 text-teal-600 border-gray-300 rounded" />
                        Unread only
                    </label>
                </div>
            </header>

            {showCompose && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowCompose(false)} role="dialog" aria-modal="true">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl p-6" onClick={e => e.stopPropagation()}>
                        <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2"><Bell size={20} className="text-teal-600" /> Compose Notification</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                                <select value={compose.type} onChange={e => setCompose({ ...compose, type: e.target.value })} className="w-full p-2 border border-gray-300 rounded-lg text-sm">
                                    {['system', 'order', 'promotion', 'stock', 'security'].map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                                <input type="text" value={compose.title} onChange={e => setCompose({ ...compose, title: e.target.value })} placeholder="Notification title" className="w-full p-2 border border-gray-300 rounded-lg text-sm" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                                <textarea value={compose.message} onChange={e => setCompose({ ...compose, message: e.target.value })} rows={4} placeholder="Notification message" className="w-full p-2 border border-gray-300 rounded-lg text-sm" />
                            </div>
                            <div>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" checked={compose.broadcast} onChange={e => setCompose({ ...compose, broadcast: e.target.checked, recipientId: e.target.checked ? '' : compose.recipientId })} className="w-4 h-4 text-teal-600 border-gray-300 rounded" />
                                    <span className="text-sm text-gray-700">Broadcast to all customers</span>
                                </label>
                            </div>
                            {!compose.broadcast && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Recipient User ID</label>
                                    <input type="text" value={compose.recipientId} onChange={e => setCompose({ ...compose, recipientId: e.target.value })} placeholder="Target user _id" className="w-full p-2 border border-gray-300 rounded-lg text-sm" />
                                </div>
                            )}
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <button onClick={() => setShowCompose(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">Cancel</button>
                            <button onClick={handleSend} disabled={sending} className="px-4 py-2 bg-teal-600 text-white rounded-lg font-bold text-sm hover:bg-teal-700 transition-colors disabled:opacity-50">
                                {sending ? 'Sending...' : 'Send'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {loading ? (
                <div className="py-16 flex justify-center"><Loader2 size={26} className="animate-spin text-teal-600" /></div>
            ) : notifications.length === 0 ? (
                <div className="py-16 text-center text-gray-500">No notifications found</div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm" role="grid">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                                <th className="px-4 py-3 text-left font-bold text-gray-600">Type</th>
                                <th className="px-4 py-3 text-left font-bold text-gray-600">Title</th>
                                <th className="px-4 py-3 text-left font-bold text-gray-600 hidden md:table-cell">Message</th>
                                <th className="px-4 py-3 text-left font-bold text-gray-600">Recipient</th>
                                <th className="px-4 py-3 text-left font-bold text-gray-600">Read</th>
                                <th className="px-4 py-3 text-left font-bold text-gray-600 hidden xl:table-cell">Created</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {notifications.map(n => (
                                <tr key={n._id} className={n.read ? '' : 'bg-blue-25'} className="hover:bg-gray-50">
                                    <td className="px-4 py-3"><TypeBadge type={n.type} /></td>
                                    <td className="px-4 py-3 font-medium text-gray-900">{n.title}</td>
                                    <td className="px-4 py-3 text-gray-500 hidden md:table-cell truncate max-w-xs">{n.message}</td>
                                    <td className="px-4 py-3 text-gray-600">{n.recipient ? `${n.recipient.name} (${n.recipient.email})` : <span className="text-amber-600 font-medium">Broadcast</span>}</td>
                                    <td className="px-4 py-3">{n.read ? <CheckCircle2 size={16} className="text-green-500 mx-auto" /> : <span className="text-amber-600 font-medium">Unread</span>}</td>
                                    <td className="px-4 py-3 text-gray-500 hidden xl:table-cell">{formatDate(n.createdAt)}</td>
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
        </div>
    );
}