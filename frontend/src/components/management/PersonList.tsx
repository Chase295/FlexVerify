import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import type { Person, PaginatedResponse } from '../../types';
import {
  Search,
  Plus,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Clock,
  UserCircle,
} from 'lucide-react';
import clsx from 'clsx';
import AuthenticatedImage from '../common/AuthenticatedImage';

const statusConfig = {
  valid: { icon: CheckCircle, color: 'text-success-400', bg: 'bg-success-500/15', border: 'border-success-500/30', label: 'OK' },
  warning: { icon: AlertTriangle, color: 'text-warning-400', bg: 'bg-warning-500/15', border: 'border-warning-500/30', label: 'Warnung' },
  expired: { icon: XCircle, color: 'text-danger-400', bg: 'bg-danger-500/15', border: 'border-danger-500/30', label: 'Abgelaufen' },
  pending: { icon: Clock, color: 'text-gray-400', bg: 'bg-gray-500/15', border: 'border-gray-500/30', label: 'Ausstehend' },
};

export default function PersonList() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const pageSize = 20;

  const { data, isLoading, error } = useQuery({
    queryKey: ['persons', page, search, statusFilter],
    queryFn: async () => {
      const params: any = { page, page_size: pageSize };
      if (search) params.search = search;
      if (statusFilter) params.compliance_status = statusFilter;

      const response = await api.get<PaginatedResponse<Person>>('/persons', { params });
      return response.data;
    },
  });

  const totalPages = data ? Math.ceil(data.total / pageSize) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Personen</h1>
          <p className="text-gray-400 mt-1">
            {data?.total || 0} Personen gesamt
          </p>
        </div>
        <Link to="/persons/new" className="btn-primary">
          <Plus className="w-5 h-5 mr-2" />
          Neue Person
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Name, E-Mail oder Personalnummer suchen..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="input pl-10"
          />
        </div>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="input w-auto"
        >
          <option value="">Alle Status</option>
          <option value="valid">OK</option>
          <option value="warning">Warnung</option>
          <option value="expired">Abgelaufen</option>
          <option value="pending">Ausstehend</option>
        </select>
      </div>

      {/* Table */}
      <div className="glass rounded-xl border border-[#334155] overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-500 border-t-transparent" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-64 text-danger-400">
            Fehler beim Laden der Daten
          </div>
        ) : data?.items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <UserCircle className="w-12 h-12 mb-2" />
            <p>Keine Personen gefunden</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#334155]">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Person
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Personalnr.
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Face-ID
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Aktualisiert
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#334155]">
                {data?.items.map((person) => {
                  const status = statusConfig[person.compliance_status] || statusConfig.pending;
                  const StatusIcon = status.icon;

                  return (
                    <tr
                      key={person.id}
                      className="table-row-hover transition-colors"
                    >
                      <td className="px-4 py-3">
                        <Link
                          to={`/persons/${person.id}`}
                          className="flex items-center gap-3 group"
                        >
                          <div className="w-10 h-10 rounded-full bg-dark-card flex items-center justify-center overflow-hidden border border-[#334155]">
                            {person.has_photo ? (
                              <AuthenticatedImage
                                src={`/persons/${person.id}/photo`}
                                alt=""
                                className="w-full h-full object-cover"
                                fallbackClassName="w-6 h-6"
                                showLoadingSpinner={false}
                              />
                            ) : (
                              <UserCircle className="w-6 h-6 text-gray-400" />
                            )}
                          </div>
                          <div>
                            <p className="text-white font-medium group-hover:text-primary-400 transition-colors">{person.full_name}</p>
                            <p className="text-sm text-gray-400">{person.email || '-'}</p>
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-300">
                        {person.personnel_number || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={clsx('inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border', status.bg, status.color, status.border)}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {person.has_face_vectors ? (
                          <span className="badge-success">Aktiv</span>
                        ) : (
                          <span className="badge-neutral">Kein Foto</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-400">
                        {new Date(person.updated_at).toLocaleDateString('de-DE')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {data && totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[#334155]">
            <p className="text-sm text-gray-400">
              Seite {page} von {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-secondary py-1.5 px-3"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="btn-secondary py-1.5 px-3"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
