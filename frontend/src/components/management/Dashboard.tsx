import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';
import { Users, CheckCircle, AlertTriangle, XCircle, Scan, TrendingUp, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

interface DashboardStats {
  total_persons: number;
  active_persons: number;
  compliance_valid: number;
  compliance_warning: number;
  compliance_expired: number;
  scans_today: number;
}

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      // Fetch stats from dedicated endpoints
      const [statsRes, auditRes] = await Promise.all([
        api.get('/persons/stats'),
        api.get('/audit/stats', { params: { days: 1 } }),
      ]);

      return {
        total_persons: statsRes.data.total_persons || 0,
        active_persons: statsRes.data.active_persons || 0,
        compliance_valid: statsRes.data.compliance_valid || 0,
        compliance_warning: statsRes.data.compliance_warning || 0,
        compliance_expired: statsRes.data.compliance_expired || 0,
        scans_today: auditRes.data.by_action?.scan || 0,
      } as DashboardStats;
    },
  });

  const statCards = [
    {
      name: 'Personen gesamt',
      value: stats?.total_persons || 0,
      icon: <Users className="w-6 h-6" />,
      color: 'text-primary-400',
      bg: 'bg-gradient-primary',
      isGradient: true,
    },
    {
      name: 'Compliance OK',
      value: stats?.compliance_valid || 0,
      icon: <CheckCircle className="w-6 h-6" />,
      color: 'text-success-400',
      bg: 'bg-success-500/15',
      borderColor: 'border-success-500/30',
    },
    {
      name: 'Warnung',
      value: stats?.compliance_warning || 0,
      icon: <AlertTriangle className="w-6 h-6" />,
      color: 'text-warning-400',
      bg: 'bg-warning-500/15',
      borderColor: 'border-warning-500/30',
    },
    {
      name: 'Abgelaufen',
      value: stats?.compliance_expired || 0,
      icon: <XCircle className="w-6 h-6" />,
      color: 'text-danger-400',
      bg: 'bg-danger-500/15',
      borderColor: 'border-danger-500/30',
    },
    {
      name: 'Scans heute',
      value: stats?.scans_today || 0,
      icon: <Scan className="w-6 h-6" />,
      color: 'text-primary-400',
      bg: 'bg-primary-500/15',
      borderColor: 'border-primary-500/30',
    },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-400 mt-1">Übersicht über das System</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {statCards.map((stat, index) => (
          <div
            key={stat.name}
            className="glass rounded-xl p-4 border border-[#334155] card-hover"
          >
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${stat.isGradient ? stat.bg : stat.bg} ${stat.borderColor ? `border ${stat.borderColor}` : ''}`}>
                <div className={stat.isGradient ? 'text-white' : stat.color}>{stat.icon}</div>
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stat.value}</p>
                <p className="text-sm text-gray-400">{stat.name}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="glass rounded-xl p-6 border border-[#334155]">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary-500/15 border border-primary-500/30">
              <TrendingUp className="w-4 h-4 text-primary-400" />
            </div>
            Letzte Aktivitäten
          </h2>
          <div className="space-y-3">
            <p className="text-gray-400 text-sm">Keine aktuellen Aktivitäten</p>
          </div>
        </div>

        {/* Quick Links */}
        <div className="glass rounded-xl p-6 border border-[#334155]">
          <h2 className="text-lg font-semibold text-white mb-4">Schnellzugriff</h2>
          <div className="grid grid-cols-2 gap-3">
            <Link
              to="/persons"
              className="group flex items-center justify-between p-4 glass-light rounded-xl hover:bg-dark-elevated/80 transition-all duration-200 hover:-translate-y-0.5"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary-500/15 border border-primary-500/30">
                  <Users className="w-5 h-5 text-primary-400" />
                </div>
                <span className="text-sm font-medium text-white">Personen verwalten</span>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-500 group-hover:text-primary-400 group-hover:translate-x-1 transition-all" />
            </Link>
            <Link
              to="/scanner"
              className="group flex items-center justify-between p-4 bg-gradient-primary rounded-xl shadow-glow-sm hover:shadow-glow transition-all duration-200 hover:-translate-y-0.5"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-white/10">
                  <Scan className="w-5 h-5 text-white" />
                </div>
                <span className="text-sm font-medium text-white">Scanner öffnen</span>
              </div>
              <ArrowRight className="w-4 h-4 text-white/70 group-hover:text-white group-hover:translate-x-1 transition-all" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
