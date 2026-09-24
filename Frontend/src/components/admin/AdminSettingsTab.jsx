import { Shield, Mail, Database, AlertTriangle, ExternalLink, User, Lock, WifiOff, Info } from 'lucide-react';

const ADMIN_EMAILS = (import.meta.env.VITE_ADMIN_EMAILS || 'surajdona2005@gmail.com').split(',').map(e => e.trim()).filter(Boolean);

export default function AdminSettingsTab() {
    return (
        <div className="space-y-6">
            <header>
                <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
                <p className="text-sm text-gray-500 mt-1">System configuration and security overview. Quick links to Control Center for actions.</p>
            </header>

            <section className="bg-white rounded-2xl border border-gray-100 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2"><Shield className="text-teal-600" size={20} /> Security & Access</h3>
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="p-3 bg-gray-50 rounded-lg">
                        <dt className="text-gray-500">Owner Email(s)</dt>
                        <dd className="font-mono text-gray-900 break-all">{ADMIN_EMAILS.join(', ') || 'Not configured'}</dd>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                        <dt className="text-gray-500">Authentication</dt>
                        <dd className="font-medium text-green-600">JWT with refresh rotation + HttpOnly cookies</dd>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                        <dt className="text-gray-500">Admin Guard</dt>
                        <dd className="font-medium text-teal-600">Owner-only (ADMIN_EMAILS allowlist)</dd>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                        <dt className="text-gray-500">Rate Limiting</dt>
                        <dd className="font-medium text-blue-600">Credential: 5/min · Session: 60/min</dd>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                        <dt className="text-gray-500">CSRF Protection</dt>
                        <dd className="font-medium text-purple-600">Double-submit cookie pattern</dd>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                        <dt className="text-gray-500">Audit Logging</dt>
                        <dd className="font-medium text-amber-600">All admin mutations logged</dd>
                    </div>
                </dl>
            </section>

            <section className="bg-white rounded-2xl border border-gray-100 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2"><Info className="text-teal-600" size={20} /> Environment</h3>
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="p-3 bg-gray-50 rounded-lg">
                        <dt className="text-gray-500">Node Environment</dt>
                        <dd className="font-mono text-gray-900 capitalize">{import.meta.env.MODE}</dd>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                        <dt className="text-gray-500">API Base URL</dt>
                        <dd className="font-mono text-gray-900 break-all">{import.meta.env.VITE_API_URL || 'Relative (same origin)'}</dd>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                        <dt className="text-gray-500">Frontend Version</dt>
                        <dd className="font-mono text-gray-900">{import.meta.env.VITE_APP_VERSION || '2.0.0'}</dd>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                        <dt className="text-gray-500">Build Time</dt>
                        <dd className="font-mono text-gray-900">{import.meta.env.VITE_BUILD_TIME || 'Unknown'}</dd>
                    </div>
                </dl>
            </section>

            <section className="bg-white rounded-2xl border border-gray-100 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2"><Database className="text-teal-600" size={20} /> Destructive Actions (Development Only)</h3>
                <p className="text-sm text-gray-500 mb-4">These actions are disabled in production (NODE_ENV=production). Available only in development.</p>
                <div className="flex flex-wrap gap-3">
                    <button type="button" className="px-4 py-2.5 bg-red-600 text-white rounded-lg font-bold text-sm hover:bg-red-700 transition-colors min-h-[44px] flex items-center gap-2" disabled>
                        <Database size={16} /> Seed Products (Dev Only)
                    </button>
                    <button type="button" className="px-4 py-2.5 bg-red-700 text-white rounded-lg font-bold text-sm hover:bg-red-800 transition-colors min-h-[44px] flex items-center gap-2" disabled>
                        <AlertTriangle size={16} /> Clear All Products (Dev Only)
                    </button>
                </div>
                <p className="text-xs text-gray-400 mt-2">Access via Control Center → Quick Actions in development mode.</p>
            </section>

            <section className="bg-white rounded-2xl border border-gray-100 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2"><ExternalLink className="text-teal-600" size={20} /> Quick Links</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <a href="/admin#control" className="p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors text-left">
                        <div className="flex items-center gap-2 mb-1"><Mail size={18} className="text-teal-600" /> <span className="font-bold text-gray-900">Control Center</span></div>
                        <p className="text-sm text-gray-500">Dashboard, stats, quick actions</p>
                    </a>
                    <a href="/admin#audit" className="p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors text-left">
                        <div className="flex items-center gap-2 mb-1"><AlertTriangle size={18} className="text-amber-600" /> <span className="font-bold text-gray-900">Audit Logs</span></div>
                        <p className="text-sm text-gray-500">Admin mutation audit trail</p>
                    </a>
                    <a href="/admin#activity" className="p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors text-left">
                        <div className="flex items-center gap-2 mb-1"><User size={18} className="text-blue-600" /> <span className="font-bold text-gray-900">User Activity</span></div>
                        <p className="text-sm text-gray-500">Customer behavior timeline</p>
                    </a>
                    <a href="/admin#settings" className="p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors text-left">
                        <div className="flex items-center gap-2 mb-1"><Info size={18} className="text-purple-600" /> <span className="font-bold text-gray-900">This Page</span></div>
                        <p className="text-sm text-gray-500">Settings & security overview</p>
                    </a>
                </div>
            </section>

            <section className="bg-white rounded-2xl border border-gray-100 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2"><Lock className="text-teal-600" size={20} /> Owner-Only Actions</h3>
                <p className="text-sm text-gray-500 mb-4">These require the owner email (ADMIN_EMAILS allowlist). Non-owner admins cannot access.</p>
                <ul className="space-y-2 text-sm text-gray-600">
                    <li className="flex items-center gap-2"><Shield size={16} className="text-teal-600" /> Promote/demote users to admin</li>
                    <li className="flex items-center gap-2"><Shield size={16} className="text-teal-600" /> Block/unblock/deactivate any user</li>
                    <li className="flex items-center gap-2"><Shield size={16} className="text-teal-600" /> Send broadcast notifications</li>
                    <li className="flex items-center gap-2"><Shield size={16} className="text-teal-600" /> Moderate reviews (approve/hide)</li>
                    <li className="flex items-center gap-2"><Shield size={16} className="text-teal-600" /> Seed/clear products (dev only)</li>
                    <li className="flex items-center gap-2"><Shield size={16} className="text-teal-600" /> Run makeAdmin script</li>
                </ul>
            </section>
        </div>
    );
}