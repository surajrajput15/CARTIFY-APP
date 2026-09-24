import { useState, useEffect, useCallback } from 'react';
import { Search, Loader2, CheckCircle2, XCircle, Eye, Star } from 'lucide-react';
import toast from 'react-hot-toast';
import { fetchAdminReviews, patchReviewStatus } from '../../services/reviewApi';
import { isNetworkError } from '../../utils/apiError';
import { formatDate } from '../../utils/format';

const STATUS_LABELS = { pending: 'Pending', approved: 'Approved', hidden: 'Hidden' };
const STATUS_COLORS = { pending: 'text-amber-600 bg-amber-50', approved: 'text-green-600 bg-green-50', hidden: 'text-gray-600 bg-gray-50' };

function StatusBadge({ status }) {
    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${STATUS_COLORS[status] || 'text-gray-600 bg-gray-50'}`}>
            {STATUS_LABELS[status] || status}
        </span>
    );
}

function Stars({ rating }) {
    return (
        <span className="flex items-center gap-0.5">
            {[...Array(5)].map((_, i) => (
                <Star key={i} size={14} className={i < rating ? 'text-amber-400 fill-current' : 'text-gray-300'} />
            ))}
        </span>
    );
}

export default function AdminReviewsTab() {
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [statusFilter, setStatusFilter] = useState('all');
    const [search, setSearch] = useState('');
    const [actionLoading, setActionLoading] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params = { page, limit: 20, status: statusFilter !== 'all' ? statusFilter : undefined, search: search || undefined };
            const res = await fetchAdminReviews(params);
            setReviews(res.data.reviews || []);
            setTotal(res.data.total || 0);
        } catch (err) {
            if (!isNetworkError(err)) toast.error('Failed to load reviews');
        } finally {
            setLoading(false);
        }
    }, [page, statusFilter, search]);

    useEffect(() => { load(); }, [load]);

    const handleModerate = async (reviewId, action) => {
        setActionLoading(reviewId);
        try {
            await patchReviewStatus(reviewId, action);
            toast.success(`Review ${action}d successfully`);
            load();
        } catch (err) {
            if (!isNetworkError(err)) toast.error(err?.response?.data?.message || `Failed to ${action} review`);
        } finally {
            setActionLoading(null);
        }
    };

    const statusOptions = [
        { value: 'all', label: 'All' },
        { value: 'pending', label: 'Pending' },
        { value: 'approved', label: 'Approved' },
        { value: 'hidden', label: 'Hidden' }
    ];

    return (
        <div className="space-y-6">
            <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Reviews Moderation</h2>
                    <p className="text-sm text-gray-500">Moderate customer reviews: approve or hide. Pending reviews are not visible on the storefront.</p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
                        {statusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input type="text" placeholder="Search user, title, comment..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="w-64 pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm bg-white" />
                    </div>
                </div>
            </header>

            {loading ? (
                <div className="py-16 flex justify-center"><Loader2 size={26} className="animate-spin text-teal-600" /></div>
            ) : reviews.length === 0 ? (
                <div className="py-16 text-center text-gray-500">No reviews found</div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm" role="grid">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                                <th className="px-4 py-3 text-left font-bold text-gray-600">Product</th>
                                <th className="px-4 py-3 text-left font-bold text-gray-600">User</th>
                                <th className="px-4 py-3 text-left font-bold text-gray-600">Rating</th>
                                <th className="px-4 py-3 text-left font-bold text-gray-600 hidden md:table-cell">Title</th>
                                <th className="px-4 py-3 text-left font-bold text-gray-600 hidden lg:table-cell">Comment</th>
                                <th className="px-4 py-3 text-left font-bold text-gray-600">Status</th>
                                <th className="px-4 py-3 text-left font-bold text-gray-600 hidden xl:table-cell">Date</th>
                                <th className="px-4 py-3 text-right font-bold text-gray-600">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {reviews.map(r => (
                                <tr key={r._id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 font-medium text-gray-900">{r.product?.title || 'Unknown Product'}</td>
                                    <td className="px-4 py-3 text-gray-500">{r.userName}</td>
                                    <td className="px-4 py-3"><Stars rating={r.rating} /></td>
                                    <td className="px-4 py-3 text-gray-600 hidden md:table-cell truncate max-w-xs">{r.title || '—'}</td>
                                    <td className="px-4 py-3 text-gray-500 hidden lg:table-cell truncate max-w-md">{r.comment || '—'}</td>
                                    <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                                    <td className="px-4 py-3 text-gray-500 hidden xl:table-cell">{formatDate(r.createdAt)}</td>
                                    <td className="px-4 py-3 text-right">
                                        {r.status === 'pending' && (
                                            <>
                                                <button type="button" onClick={() => handleModerate(r._id, 'approve')} disabled={actionLoading === r._id} className="px-3 py-1.5 bg-green-600 text-white text-sm font-bold rounded-lg hover:bg-green-700 transition-colors min-h-[36px] disabled:opacity-50"><CheckCircle2 size={14} className="mr-1" /> Approve</button>
                                                <button type="button" onClick={() => handleModerate(r._id, 'hide')} disabled={actionLoading === r._id} className="px-3 py-1.5 bg-red-600 text-white text-sm font-bold rounded-lg hover:bg-red-700 transition-colors min-h-[36px] disabled:opacity-50 ml-2"><XCircle size={14} className="mr-1" /> Hide</button>
                                            </>
                                        )}
                                        {r.status === 'approved' && (
                                            <button type="button" onClick={() => handleModerate(r._id, 'hide')} disabled={actionLoading === r._id} className="px-3 py-1.5 bg-red-600 text-white text-sm font-bold rounded-lg hover:bg-red-700 transition-colors min-h-[36px] disabled:opacity-50"><XCircle size={14} className="mr-1" /> Hide</button>
                                        )}
                                        {r.status === 'hidden' && (
                                            <button type="button" onClick={() => handleModerate(r._id, 'approve')} disabled={actionLoading === r._id} className="px-3 py-1.5 bg-green-600 text-white text-sm font-bold rounded-lg hover:bg-green-700 transition-colors min-h-[36px] disabled:opacity-50"><CheckCircle2 size={14} className="mr-1" /> Approve</button>
                                        )}
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
        </div>
    );
}