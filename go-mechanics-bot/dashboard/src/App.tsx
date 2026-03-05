import React, { useEffect, useState } from 'react';
import { Bot, Play, Pause, Activity, FileJson, CheckCircle2, Clock, Eye, History } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

// @ts-ignore
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8081';
const API_URL = `${API_BASE}/api/status`;

export default function Dashboard() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch(API_URL);
        const json = await res.json();
        if (json.error) {
          setError(json.error);
        } else {
          setData(json);
          setError(null);
        }
      } catch (err: any) {
        setError("Cannot connect to orchestrator API");
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 1500);
    return () => clearInterval(interval);
  }, []);

  const handleStartBot = async () => {
    try {
      await fetch(`${API_BASE}/api/bot/start`, { method: 'POST' });
      // Optimistic UI update could go here
    } catch (err) {
      console.error("Failed to start bot", err);
    }
  };

  const handleStopBot = async () => {
    try {
      await fetch(`${API_BASE}/api/bot/stop`, { method: 'POST' });
    } catch (err) {
      console.error("Failed to stop bot", err);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-300 flex items-center justify-center p-8">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-900/30 text-red-500 mb-6 font-bold">!</div>
          <h1 className="text-2xl font-bold text-white mb-2">API Offline</h1>
          <p className="text-slate-500">Could not connect to Go Mechanics Orchestrator API.<br />Ensure `infinite_loop.py` and the API are running.</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center">Loading...</div>;
  }

  const { metrics, recent_features } = data;

  // Derived visual state
  const isSleeping = metrics.status.includes('Sleep');
  const isError = metrics.status.includes('Error');
  const isOffline = metrics.status.includes('Offline');
  const isPausedByUser = metrics.status.includes('Paused by User');

  const targetState = metrics.target_state || 'paused'; // New DB property
  const isTargetRunning = targetState === 'running';

  let statusColor = "text-blue-400";
  let statusBg = "bg-blue-900/30";
  let statusBorder = "border-blue-500/30";
  let glowClass = "shadow-[0_0_15px_rgba(59,130,246,0.5)]";

  if (isPausedByUser) {
    statusColor = "text-slate-400";
    statusBg = "bg-slate-800/80";
    statusBorder = "border-slate-500/50";
    glowClass = "";
  } else if (isSleeping) {
    statusColor = "text-amber-400";
    statusBg = "bg-amber-900/40";
    statusBorder = "border-amber-500/40";
    glowClass = "shadow-[0_0_15px_rgba(251,191,36,0.3)]";
  } else if (isError) {
    statusColor = "text-red-400";
    statusBg = "bg-red-900/40";
    statusBorder = "border-red-500/40";
    glowClass = "shadow-[0_0_15px_rgba(239,68,68,0.5)]";
  } else if (isOffline) {
    statusColor = "text-slate-500";
    statusBg = "bg-slate-900/80";
    statusBorder = "border-slate-700/50";
    glowClass = "";
  }

  // Fake chart data based on iterations connecting history
  const chartData = Array.from({ length: 15 }).map((_, i) => ({
    iteration: Math.max(0, metrics.loop_iterations - 14 + i),
    discovered: Math.max(0, metrics.features_discovered - (14 - i) * 0.4),
    implemented: Math.max(0, metrics.features_implemented - (14 - i) * 0.4)
  }));

  return (
    <div className="min-h-screen bg-[#020617] text-slate-300 font-sans selection:bg-blue-500/30">

      {/* Background ambient glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-1/4 -right-1/4 w-[1000px] h-[1000px] rounded-full bg-blue-900/10 blur-[120px]"></div>
        <div className="absolute -bottom-1/4 -left-1/4 w-[800px] h-[800px] rounded-full bg-indigo-900/10 blur-[100px]"></div>
      </div>

      {/* Header */}
      <header className="border-b border-slate-800/60 bg-slate-950/60 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white p-2.5 rounded-xl shadow-lg shadow-blue-500/20">
              <Bot size={24} />
            </div>
            <div>
              <h1 className="font-bold text-xl tracking-tight text-white leading-tight">Go Mechanics <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400 font-medium">Auto-Dev</span></h1>
              <p className="text-xs text-slate-500 font-mono tracking-wider">SYSTEM METRICS // LIVE</p>
            </div>
          </div>

          <div className="flex items-center gap-6">

            {/* Control Panel */}
            <div className="flex items-center bg-slate-900/80 rounded-full p-1 border border-slate-800 shadow-inner">
              <button
                onClick={handleStartBot}
                disabled={isTargetRunning}
                className={`flex items-center gap-2 px-6 py-2 rounded-full font-medium transition-all duration-300 ${isTargetRunning ? 'bg-blue-600/20 text-blue-400 cursor-default' : 'hover:bg-blue-600 hover:text-white text-slate-400'}`}
              >
                <Play size={16} className={isTargetRunning ? 'animate-pulse' : ''} />
                <span>START</span>
              </button>
              <button
                onClick={handleStopBot}
                disabled={!isTargetRunning}
                className={`flex items-center gap-2 px-6 py-2 rounded-full font-medium transition-all duration-300 ${!isTargetRunning ? 'bg-slate-800 text-slate-300 cursor-default shadow-md border border-slate-700' : 'hover:bg-slate-700 text-slate-400'}`}
              >
                <Pause size={16} />
                <span>PAUSE</span>
              </button>
            </div>

            {/* Status indicator */}
            <div className={`flex items-center gap-3 px-5 py-2 rounded-full border ${statusBg} ${statusBorder} ${glowClass} transition-all duration-500 bg-opacity-40 backdrop-blur-md`}>
              {isSleeping || isOffline || isPausedByUser ? <Pause size={14} className={statusColor} /> : <Activity size={14} className={`${statusColor} animate-pulse`} />}
              <span className={`text-sm font-semibold tracking-wide ${statusColor}`}>
                {metrics.status.toUpperCase()}
              </span>
            </div>

          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 relative z-10">

        {/* Status Message */}
        <div className="mb-10 p-6 rounded-2xl border border-slate-800/80 bg-slate-900/40 backdrop-blur-sm flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl shadow-black/20">
          <div>
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
              <Activity size={14} className="text-blue-400" /> Current Operation Target
            </h2>
            <p className="text-2xl md:text-3xl text-white font-light tracking-tight">{metrics.status_message || 'Initializing system...'}</p>
          </div>
          <div className="text-right border-l border-slate-800/60 pl-6">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Session Uptime</h2>
            <p className="text-indigo-300 font-mono text-lg">{new Date(metrics.start_time).toLocaleString()}</p>
          </div>
        </div>

        {/* Big Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          {/* Iterations */}
          <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800/80 rounded-3xl p-7 hover:border-indigo-500/50 hover:bg-slate-800/60 transition-all duration-300 group">
            <div className="flex justify-between items-start mb-6">
              <div className="p-3 bg-indigo-500/20 text-indigo-400 rounded-2xl transition-transform group-hover:scale-110">
                <Play size={22} className="ml-0.5" />
              </div>
            </div>
            <p className="text-5xl font-light text-white mb-2 tracking-tighter">{metrics.loop_iterations}</p>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Cycles Run</p>
          </div>

          {/* Discovered */}
          <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800/80 rounded-3xl p-7 hover:border-amber-500/50 hover:bg-slate-800/60 transition-all duration-300 group">
            <div className="flex justify-between items-start mb-6">
              <div className="p-3 bg-amber-500/20 text-amber-400 rounded-2xl transition-transform group-hover:scale-110">
                <Eye size={22} />
              </div>
            </div>
            <p className="text-5xl font-light text-white mb-2 tracking-tighter">{metrics.features_discovered}</p>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Features Captured</p>
          </div>

          {/* Analyzed */}
          <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800/80 rounded-3xl p-7 hover:border-fuchsia-500/50 hover:bg-slate-800/60 transition-all duration-300 group">
            <div className="flex justify-between items-start mb-6">
              <div className="p-3 bg-fuchsia-500/20 text-fuchsia-400 rounded-2xl transition-transform group-hover:scale-110">
                <FileJson size={22} />
              </div>
            </div>
            <p className="text-5xl font-light text-white mb-2 tracking-tighter">{metrics.features_analyzed}</p>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">GPT Spec'd</p>
          </div>

          {/* Implemented */}
          <div className="bg-gradient-to-b from-blue-900/20 to-slate-900/60 backdrop-blur-md border border-blue-500/30 rounded-3xl p-7 hover:border-blue-400 hover:shadow-[0_0_30px_rgba(59,130,246,0.2)] transition-all duration-500 group relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-[40px]"></div>
            <div className="flex justify-between items-start mb-6 relative">
              <div className="p-3 bg-blue-500 text-white rounded-2xl shadow-lg shadow-blue-500/30 transition-transform group-hover:scale-110">
                <CheckCircle2 size={22} />
              </div>
            </div>
            <div className="flex items-baseline gap-3 mb-2 relative">
              <p className="text-5xl font-bold text-white tracking-tighter">{metrics.features_implemented}</p>
              <span className="text-blue-400 font-medium text-sm px-2 py-0.5 rounded-full bg-blue-900/30 border border-blue-500/20">/ {metrics.estimated_percent_copied}% Clone</span>
            </div>
            <p className="text-xs font-semibold text-blue-200 uppercase tracking-wider relative">Gravity Coded</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Chart */}
          <div className="lg:col-span-2 bg-slate-900/60 backdrop-blur-md border border-slate-800/80 rounded-3xl p-8 shadow-xl shadow-black/20">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-lg font-semibold text-white flex items-center gap-3">
                <div className="p-1.5 bg-indigo-500/20 rounded-lg text-indigo-400"><Activity size={18} /></div> Progression Matrix
              </h2>
              <div className="flex gap-4 text-xs font-medium">
                <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div>Discovered</div>
                <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]"></div>Implemented</div>
              </div>
            </div>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorDisc" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorImpl" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="iteration" stroke="#475569" tick={{ fill: '#64748b', fontSize: 12, fontWeight: 500 }} tickMargin={10} axisLine={false} tickLine={false} />
                  <YAxis stroke="#475569" tick={{ fill: '#64748b', fontSize: 12, fontWeight: 500 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px', color: '#f1f5f9', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)' }}
                    itemStyle={{ color: '#e2e8f0', fontWeight: 500 }}
                  />
                  <Area type="monotone" dataKey="discovered" stroke="#f59e0b" fillOpacity={1} fill="url(#colorDisc)" strokeWidth={3} />
                  <Area type="monotone" dataKey="implemented" stroke="#3b82f6" fillOpacity={1} fill="url(#colorImpl)" strokeWidth={3} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Timeline Feed */}
          <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800/80 rounded-3xl p-8 flex flex-col h-full max-h-[420px] shadow-xl shadow-black/20">
            <h2 className="text-lg font-semibold text-white mb-8 flex items-center gap-3 shrink-0">
              <div className="p-1.5 bg-slate-800 rounded-lg text-slate-400"><Clock size={18} /></div> Live Feed
            </h2>
            <div className="overflow-y-auto flex-1 pr-4 space-y-6 custom-scrollbar">
              {recent_features.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-60">
                  <History size={32} className="mb-2" />
                  <p>Awaiting telemetry...</p>
                </div>
              ) : (
                recent_features.map((log: any, i: number) => {
                  let iconColor = "text-amber-500 bg-amber-500/10 border-amber-500/30";
                  let icon = <Eye size={12} />;
                  let actionText = "Captured Data";
                  if (log.status === 'analyzed') {
                    iconColor = "text-fuchsia-500 bg-fuchsia-500/10 border-fuchsia-500/30";
                    icon = <FileJson size={12} />;
                    actionText = "GPT Analysis";
                  } else if (log.status === 'implemented') {
                    iconColor = "text-blue-500 bg-blue-500/10 border-blue-500/30 glow-blue";
                    icon = <CheckCircle2 size={12} />;
                    actionText = "Code Deployed";
                  }

                  return (
                    <div key={log.id} className="relative pl-8 pb-2 group">
                      {/* Timeline line */}
                      {i !== recent_features.length - 1 && (
                        <div className="absolute left-[13px] top-8 bottom-[-16px] w-[2px] bg-slate-800 group-hover:bg-slate-700 transition-colors"></div>
                      )}

                      <div className={`absolute left-0 top-1 w-7 h-7 rounded-full border flex items-center justify-center shadow-lg ${iconColor} z-10 bg-slate-950`}>
                        {icon}
                      </div>

                      <div className="bg-slate-800/30 p-4 rounded-2xl border border-slate-800 hover:border-slate-700 transition hover:bg-slate-800/50">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-[10px] font-bold tracking-wider uppercase text-slate-500">{actionText}</span>
                          <span className="text-[10px] font-mono font-medium text-slate-500 bg-slate-950 px-2 py-0.5 rounded-full border border-slate-800">
                            {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-white tracking-wide">
                          {log.feature_name}
                        </p>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}
