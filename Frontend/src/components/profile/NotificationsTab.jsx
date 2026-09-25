import { useCallback, useEffect, useState } from 'react';
import { Bell, BellRing, Loader2, AlertCircle, Check } from 'lucide-react';
import { fetchMyNotifications, markNotificationRead } from '../../services/notificationApi';
import { formatDate } from '../../utils/format';

const PAGE_SIZE = 20;

const NotificationsTab = () => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [markingId, setMarkingId] = useState(null);

  const loadPage = useCallback(async (pageToLoad, append) => {
    if (append) setLoadingMore(true);
    else {
      setLoading(true);
      setError('');
    }
    try {
      const { data } = await fetchMyNotifications({ page: pageToLoad, limit: PAGE_SIZE });
      setNotifications((prev) => (append ? [...prev, ...(data.notifications || [])] : (data.notifications || [])));
      setUnreadCount(data.unreadCount || 0);
      setPage(data.page || pageToLoad);
      setPages(data.pages || 1);
    } catch (err) {
      if (!append) setError(err?.response?.data?.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch
    loadPage(1, false);
  }, [loadPage]);

  const handleMarkRead = async (id) => {
    setMarkingId(id);
    try {
      await markNotificationRead(id);
      setNotifications((prev) => prev.map((n) => (n._id === id ? { ...n, read: true } : n)));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // Keep the item unread; the error is transient — a refresh retries it.
    } finally {
      setMarkingId(null);
    }
  };

  return (
    <section
      className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6"
      aria-label="My notifications"
    >
      <h2 className="text-lg sm:text-xl font-bold text-gray-800 flex items-center gap-2">
        <span className="relative inline-flex">
          <Bell size={20} className="text-teal-600 shrink-0" aria-hidden="true" />
          {unreadCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1" aria-hidden="true">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </span>
        Notifications
      </h2>
      <p className="text-sm text-gray-500 mt-1" aria-live="polite">
        {unreadCount > 0 ? `${unreadCount} unread` : 'You are all caught up.'}
      </p>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-gray-500" role="status">
          <Loader2 size={20} className="animate-spin" aria-hidden="true" />
          Loading notifications…
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 mt-4 p-3 rounded-xl bg-red-50 text-red-600 text-sm" role="alert">
          <AlertCircle size={16} className="shrink-0" aria-hidden="true" />
          {error}
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-10">
          <BellRing size={32} className="mx-auto text-gray-300 mb-3" aria-hidden="true" />
          <p className="text-gray-600 font-medium">No notifications yet</p>
          <p className="text-sm text-gray-500 mt-1">Order updates and offers will appear here.</p>
        </div>
      ) : (
        <>
          <ul className="mt-4 space-y-3">
            {notifications.map((n) => (
              <li
                key={n._id}
                className={`p-3 sm:p-4 rounded-xl border transition-colors ${
                  n.read ? 'border-gray-100 bg-white' : 'border-teal-200 bg-teal-50/60'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-800 text-sm sm:text-base flex items-center gap-2">
                      {!n.read && <span className="w-2 h-2 rounded-full bg-teal-600 shrink-0" aria-hidden="true" />}
                      <span className="truncate">{n.title}</span>
                    </p>
                    <p className="text-sm text-gray-600 mt-1">{n.message}</p>
                    <p className="text-xs text-gray-400 mt-1.5">
                      {n.type ? `${n.type} · ` : ''}{n.createdAt ? formatDate(n.createdAt) : ''}
                    </p>
                  </div>
                  {!n.read && (
                    <button
                      type="button"
                      onClick={() => handleMarkRead(n._id)}
                      disabled={markingId === n._id}
                      className="shrink-0 inline-flex items-center gap-1 text-xs font-bold text-teal-700 hover:text-teal-800 disabled:opacity-50 min-h-[44px] px-2"
                      aria-label={`Mark "${n.title}" as read`}
                    >
                      {markingId === n._id ? (
                        <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                      ) : (
                        <Check size={14} aria-hidden="true" />
                      )}
                      Read
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {page < pages && (
            <button
              type="button"
              onClick={() => loadPage(page + 1, true)}
              disabled={loadingMore}
              className="mt-4 w-full inline-flex items-center justify-center gap-2 border border-gray-200 rounded-xl py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50 min-h-[44px] transition-colors"
            >
              {loadingMore && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
              Load more
            </button>
          )}
        </>
      )}
    </section>
  );
};

export default NotificationsTab;
