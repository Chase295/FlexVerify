import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';
import {
  FileText,
  ChevronLeft,
  ChevronRight,
  Download,
  RefreshCw,
  Calendar,
  User,
  Filter,
  X,
  ChevronDown,
  ChevronUp,
  Clock,
  Eye,
  Plus,
  Edit3,
  Trash2,
  LogIn,
  LogOut,
  Scan,
  AlertCircle
} from 'lucide-react';
import clsx from 'clsx';

interface AuditLogEntry {
  id: string;
  user_id: string;
  user_email: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  old_value: any;
  new_value: any;
  ip_address: string | null;
  user_agent?: string;
  created_at: string;
}

interface AuditUser {
  id: string;
  email: string;
  full_name: string;
}

// Date range presets
const datePresets = [
  { label: 'Heute', value: 'today' },
  { label: 'Gestern', value: 'yesterday' },
  { label: 'Letzte 7 Tage', value: '7days' },
  { label: 'Letzte 30 Tage', value: '30days' },
  { label: 'Dieser Monat', value: 'month' },
  { label: 'Benutzerdefiniert', value: 'custom' },
];

export default function AuditLog() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const [resourceType, setResourceType] = useState('');
  const [userId, setUserId] = useState('');
  const [datePreset, setDatePreset] = useState('7days');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const pageSize = 25;

  // Calculate date range from preset
  const getDateRange = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (datePreset) {
      case 'today':
        return { from: today.toISOString(), to: now.toISOString() };
      case 'yesterday':
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        return { from: yesterday.toISOString(), to: today.toISOString() };
      case '7days':
        const week = new Date(today);
        week.setDate(week.getDate() - 7);
        return { from: week.toISOString(), to: now.toISOString() };
      case '30days':
        const month = new Date(today);
        month.setDate(month.getDate() - 30);
        return { from: month.toISOString(), to: now.toISOString() };
      case 'month':
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        return { from: startOfMonth.toISOString(), to: now.toISOString() };
      case 'custom':
        return {
          from: fromDate ? new Date(fromDate).toISOString() : undefined,
          to: toDate ? new Date(toDate + 'T23:59:59').toISOString() : undefined,
        };
      default:
        return { from: undefined, to: undefined };
    }
  };

  // Fetch users for filter
  const { data: users } = useQuery<AuditUser[]>({
    queryKey: ['audit-users'],
    queryFn: async () => {
      const response = await api.get('/audit/users');
      return response.data;
    },
  });

  // Fetch actions from backend
  const { data: actions } = useQuery<string[]>({
    queryKey: ['audit-actions'],
    queryFn: async () => {
      const response = await api.get('/audit/actions');
      return response.data;
    },
  });

  // Fetch resource types from backend
  const { data: resourceTypes } = useQuery<string[]>({
    queryKey: ['audit-resource-types'],
    queryFn: async () => {
      const response = await api.get('/audit/resource-types');
      return response.data;
    },
  });

  // Fetch audit logs
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['audit-logs', page, action, resourceType, userId, datePreset, fromDate, toDate],
    queryFn: async () => {
      const dateRange = getDateRange();
      const params: any = { page, page_size: pageSize };
      if (action) params.action = action;
      if (resourceType) params.resource_type = resourceType;
      if (userId) params.user_id = userId;
      if (dateRange.from) params.from_date = dateRange.from;
      if (dateRange.to) params.to_date = dateRange.to;

      const response = await api.get('/audit', { params });
      return response.data;
    },
    refetchInterval: autoRefresh ? 30000 : false,
  });

  const totalPages = data ? Math.ceil(data.total / pageSize) : 0;

  // Labels
  const actionLabels: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
    create: { label: 'Erstellt', icon: <Plus className="w-3 h-3" />, color: 'bg-success-500/20 text-success-400 border-success-500/40' },
    update: { label: 'Aktualisiert', icon: <Edit3 className="w-3 h-3" />, color: 'bg-warning-500/20 text-warning-400 border-warning-500/40' },
    delete: { label: 'Gelöscht', icon: <Trash2 className="w-3 h-3" />, color: 'bg-danger-500/20 text-danger-400 border-danger-500/40' },
    view: { label: 'Angezeigt', icon: <Eye className="w-3 h-3" />, color: 'bg-gray-500/20 text-gray-400 border-gray-500/40' },
    login: { label: 'Angemeldet', icon: <LogIn className="w-3 h-3" />, color: 'bg-primary-500/20 text-primary-400 border-primary-500/40' },
    logout: { label: 'Abgemeldet', icon: <LogOut className="w-3 h-3" />, color: 'bg-primary-500/20 text-primary-400 border-primary-500/40' },
    scan: { label: 'Scan', icon: <Scan className="w-3 h-3" />, color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40' },
  };

  const resourceLabels: Record<string, string> = {
    person: 'Person',
    field: 'Feld',
    user: 'Benutzer',
    role: 'Rolle',
    document: 'Dokument',
    settings: 'Einstellungen',
  };

  const handleExport = async () => {
    try {
      const dateRange = getDateRange();
      const params: any = {};
      if (dateRange.from) params.from_date = dateRange.from;
      if (dateRange.to) params.to_date = dateRange.to;

      const response = await api.get('/audit/export', { params, responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `audit_log_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const resetFilters = () => {
    setAction('');
    setResourceType('');
    setUserId('');
    setDatePreset('7days');
    setFromDate('');
    setToDate('');
    setPage(1);
  };

  const hasActiveFilters = action || resourceType || userId || datePreset !== '7days';

  // Format time ago
  const formatTimeAgo = (date: string) => {
    const now = new Date();
    const then = new Date(date);
    const diff = now.getTime() - then.getTime();

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Gerade eben';
    if (minutes < 60) return `vor ${minutes} Min.`;
    if (hours < 24) return `vor ${hours} Std.`;
    if (days < 7) return `vor ${days} Tagen`;
    return new Date(date).toLocaleDateString('de-DE');
  };

  // Render diff view
  const renderDiff = (old_value: any, new_value: any) => {
    if (!old_value && !new_value) return <span className="text-gray-500">Keine Details</span>;

    const oldObj = old_value || {};
    const newObj = new_value || {};
    const allKeys = [...new Set([...Object.keys(oldObj), ...Object.keys(newObj)])];

    return (
      <div className="space-y-2">
        {allKeys.map((key) => {
          const oldVal = oldObj[key];
          const newVal = newObj[key];
          const changed = JSON.stringify(oldVal) !== JSON.stringify(newVal);

          return (
            <div key={key} className="flex items-start gap-4 text-sm">
              <span className="text-gray-400 font-medium min-w-[120px]">{key}:</span>
              <div className="flex-1">
                {old_value && oldVal !== undefined && (
                  <div className={clsx('inline-block', changed && 'line-through text-danger-400/70')}>
                    {typeof oldVal === 'object' ? JSON.stringify(oldVal) : String(oldVal)}
                  </div>
                )}
                {changed && newVal !== undefined && (
                  <div className="text-success-400 font-medium">
                    → {typeof newVal === 'object' ? JSON.stringify(newVal) : String(newVal)}
                  </div>
                )}
                {!old_value && newVal !== undefined && (
                  <span className="text-white">
                    {typeof newVal === 'object' ? JSON.stringify(newVal) : String(newVal)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Audit-Log</h1>
          <p className="text-gray-400 mt-1">
            {data?.total ? `${data.total.toLocaleString()} Einträge` : 'Alle Systemaktivitäten'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Auto-refresh toggle */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={clsx(
              'btn-secondary py-2 px-3',
              autoRefresh && 'bg-primary-500/20 border-primary-500/40 text-primary-400'
            )}
            title={autoRefresh ? 'Auto-Refresh aktiv (30s)' : 'Auto-Refresh deaktiviert'}
          >
            <RefreshCw className={clsx('w-4 h-4', autoRefresh && 'animate-spin')} />
          </button>
          {/* Manual refresh */}
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="btn-secondary py-2 px-3"
            title="Aktualisieren"
          >
            <RefreshCw className={clsx('w-4 h-4', isFetching && 'animate-spin')} />
          </button>
          {/* Export */}
          <button onClick={handleExport} className="btn-secondary">
            <Download className="w-4 h-4 mr-2" />
            Export
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="glass rounded-xl border border-[#334155] p-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Date Preset */}
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <select
              value={datePreset}
              onChange={(e) => {
                setDatePreset(e.target.value);
                setPage(1);
              }}
              className="input py-1.5 px-3 w-auto text-sm"
            >
              {datePresets.map((preset) => (
                <option key={preset.value} value={preset.value}>
                  {preset.label}
                </option>
              ))}
            </select>
          </div>

          {/* Custom date inputs */}
          {datePreset === 'custom' && (
            <>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
                className="input py-1.5 px-3 w-auto text-sm"
              />
              <span className="text-gray-500">bis</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => { setToDate(e.target.value); setPage(1); }}
                className="input py-1.5 px-3 w-auto text-sm"
              />
            </>
          )}

          {/* Toggle more filters */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={clsx(
              'btn-secondary py-1.5 px-3 text-sm',
              hasActiveFilters && 'bg-primary-500/20 border-primary-500/40'
            )}
          >
            <Filter className="w-4 h-4 mr-1" />
            Filter
            {hasActiveFilters && <span className="ml-1 text-primary-400">•</span>}
          </button>

          {/* Reset filters */}
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="btn-ghost py-1.5 px-2 text-sm text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Extended Filters */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-[#334155] grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Action filter */}
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Aktion</label>
              <select
                value={action}
                onChange={(e) => { setAction(e.target.value); setPage(1); }}
                className="input py-2"
              >
                <option value="">Alle Aktionen</option>
                {(actions || Object.keys(actionLabels)).map((key) => (
                  <option key={key} value={key}>
                    {actionLabels[key]?.label || key}
                  </option>
                ))}
              </select>
            </div>

            {/* Resource Type filter */}
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Ressource</label>
              <select
                value={resourceType}
                onChange={(e) => { setResourceType(e.target.value); setPage(1); }}
                className="input py-2"
              >
                <option value="">Alle Ressourcen</option>
                {(resourceTypes || Object.keys(resourceLabels)).map((key) => (
                  <option key={key} value={key}>
                    {resourceLabels[key] || key}
                  </option>
                ))}
              </select>
            </div>

            {/* User filter */}
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Benutzer</label>
              <select
                value={userId}
                onChange={(e) => { setUserId(e.target.value); setPage(1); }}
                className="input py-2"
              >
                <option value="">Alle Benutzer</option>
                {users?.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.full_name || user.email}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="glass rounded-xl border border-[#334155] overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-500 border-t-transparent" />
          </div>
        ) : data?.items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <FileText className="w-12 h-12 mb-2" />
            <p>Keine Einträge gefunden</p>
            {hasActiveFilters && (
              <button onClick={resetFilters} className="mt-2 text-sm text-primary-400 hover:underline">
                Filter zurücksetzen
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#334155] bg-dark-elevated/50">
                  <th className="w-8"></th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                    Zeitpunkt
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                    Benutzer
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                    Aktion
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                    Ressource
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                    ID
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#334155]">
                {data?.items.map((log: AuditLogEntry) => {
                  const actionInfo = actionLabels[log.action] || {
                    label: log.action,
                    icon: <AlertCircle className="w-3 h-3" />,
                    color: 'bg-gray-500/20 text-gray-400 border-gray-500/40'
                  };
                  const isExpanded = expandedRow === log.id;

                  return (
                    <>
                      <tr
                        key={log.id}
                        className={clsx(
                          'table-row-hover cursor-pointer transition-colors',
                          isExpanded && 'bg-dark-elevated/30'
                        )}
                        onClick={() => setExpandedRow(isExpanded ? null : log.id)}
                      >
                        <td className="pl-3 py-3">
                          <button className="p-1 text-gray-500 hover:text-gray-300">
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Clock className="w-3.5 h-3.5 text-gray-500" />
                            <div>
                              <div className="text-sm text-white">{formatTimeAgo(log.created_at)}</div>
                              <div className="text-xs text-gray-500">
                                {new Date(log.created_at).toLocaleString('de-DE', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-primary-500/20 flex items-center justify-center">
                              <User className="w-3.5 h-3.5 text-primary-400" />
                            </div>
                            <span className="text-sm text-gray-300 truncate max-w-[150px]">
                              {log.user_email || '—'}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={clsx(
                            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border',
                            actionInfo.color
                          )}>
                            {actionInfo.icon}
                            {actionInfo.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-300">
                          {resourceLabels[log.resource_type] || log.resource_type}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-gray-500 font-mono">
                            {log.resource_id ? log.resource_id.slice(0, 8) : '—'}
                          </span>
                        </td>
                      </tr>

                      {/* Expanded Detail Row */}
                      {isExpanded && (
                        <tr key={`${log.id}-detail`} className="bg-dark-elevated/20">
                          <td colSpan={6} className="px-4 py-4">
                            <div className="ml-8 space-y-4">
                              {/* Metadata */}
                              <div className="flex flex-wrap gap-4 text-xs text-gray-400">
                                {log.ip_address && (
                                  <span>IP: <span className="text-gray-300 font-mono">{log.ip_address}</span></span>
                                )}
                                {log.resource_id && (
                                  <span>Ressource-ID: <span className="text-gray-300 font-mono">{log.resource_id}</span></span>
                                )}
                              </div>

                              {/* Changes */}
                              <div className="bg-dark-primary/50 rounded-lg p-4 border border-[#334155]">
                                <h4 className="text-sm font-medium text-gray-300 mb-3">
                                  {log.action === 'create' ? 'Erstellte Daten' :
                                    log.action === 'delete' ? 'Gelöschte Daten' :
                                    log.action === 'update' ? 'Änderungen' : 'Details'}
                                </h4>
                                {renderDiff(log.old_value, log.new_value)}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {data && totalPages > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[#334155] bg-dark-elevated/30">
            <p className="text-sm text-gray-400">
              Seite <span className="text-white font-medium">{page}</span> von{' '}
              <span className="text-white font-medium">{totalPages}</span>
              <span className="ml-2 text-gray-500">({data.total.toLocaleString()} Einträge)</span>
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(1)}
                disabled={page === 1}
                className="btn-secondary py-1.5 px-2 text-xs disabled:opacity-30"
              >
                Erste
              </button>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-secondary py-1.5 px-2.5 disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {/* Page numbers */}
              <div className="flex items-center gap-1 mx-2">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (page <= 3) {
                    pageNum = i + 1;
                  } else if (page >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = page - 2 + i;
                  }

                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={clsx(
                        'px-2.5 py-1 rounded text-sm font-medium transition-colors',
                        page === pageNum
                          ? 'bg-primary-500 text-white'
                          : 'text-gray-400 hover:text-white hover:bg-dark-card'
                      )}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="btn-secondary py-1.5 px-2.5 disabled:opacity-30"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage(totalPages)}
                disabled={page === totalPages}
                className="btn-secondary py-1.5 px-2 text-xs disabled:opacity-30"
              >
                Letzte
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
