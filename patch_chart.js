const fs = require('fs');
const c  = fs.readFileSync('src/components/dashboard/OverviewDashboard.jsx', 'utf8');

const newSection = `const METRICS = [
  { key: 'pos',      label: 'Purchase Orders', shortLabel: 'POs',      color: '#0d9488', lightBg: '#f0fdfa', border: '#99f6e4' },
  { key: 'invoices', label: 'Invoices',         shortLabel: 'Invoices', color: '#7c3aed', lightBg: '#f5f3ff', border: '#ddd6fe' },
  { key: 'rfqs',     label: 'RFQs',             shortLabel: 'RFQs',     color: '#d97706', lightBg: '#fffbeb', border: '#fde68a' },
  { key: 'advances', label: 'Advances',          shortLabel: 'Advances', color: '#0ea5e9', lightBg: '#f0f9ff', border: '#bae6fd' },
];

/* Mini inline sparkline rendered inside each summary card */
function MiniSparkline({ values, color }) {
  const w = 80, h = 26;
  const max = Math.max(...values, 1);
  const pts = values.map((v, i) => [
    (i / (values.length - 1 || 1)) * w,
    h - Math.max((v / max) * h, 1),
  ]);
  const line = buildSmoothPath(pts);
  const area = line + ' L ' + w + ',' + h + ' L 0,' + h + ' Z';
  const gid = 'spark' + color.replace('#','');
  return (
    <svg width={w} height={h} viewBox={'0 0 ' + w + ' ' + h} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={"url(#" + gid + ")"} />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ActivityChart({ data, xKey, xFullKey, isTodayKey }) {
  const [activeMetrics, setActiveMetrics] = React.useState(['pos', 'invoices', 'rfqs', 'advances']);
  const [hovIdx,        setHovIdx]        = React.useState(null);
  const [normalized,    setNormalized]    = React.useState(true);

  const metricStats = METRICS.map(m => {
    const vals     = data.map(d => d[m.key] || 0);
    const total    = vals.reduce((s, v) => s + v, 0);
    const max      = Math.max(...vals, 1);
    const todayVal = isTodayKey ? (data.find(d => d[isTodayKey]) || {})[m.key] || 0 : null;
    const mid      = Math.floor(vals.length / 2);
    const first    = vals.slice(0, mid).reduce((s, v) => s + v, 0) || 0;
    const last     = vals.slice(mid).reduce((s, v) => s + v, 0)  || 0;
    const trend    = first === 0 ? (last > 0 ? 100 : 0) : Math.round(((last - first) / first) * 100);
    return { ...m, vals, total, max, todayVal, trend };
  });

  const SVG_W = 560, SVG_H = 190;
  const PAD_B = 28, PAD_T = 14, PAD_R = 12;
  const PAD_L = normalized ? 12 : 40;
  const chartW = SVG_W - PAD_L - PAD_R;
  const chartH = SVG_H - PAD_T - PAD_B;
  const n = data.length;
  const toX = i => PAD_L + (i / (n - 1 || 1)) * chartW;
  const hasAnyData = metricStats.some(m => m.total > 0);

  const globalMax = Math.max(...metricStats.filter(m => activeMetrics.includes(m.key)).map(m => m.max), 1);
  const niceGlobalMax = (() => {
    if (globalMax <= 5) return 5;
    const mag = Math.pow(10, Math.floor(Math.log10(globalMax)));
    return Math.ceil(globalMax / mag) * mag;
  })();

  const toYNorm = (val, mMax) => PAD_T + chartH - Math.max((val / Math.max(mMax, 1)) * chartH, 0);
  const toYAbs  = val => PAD_T + chartH - Math.max((val / niceGlobalMax) * chartH, 0);
  const toggleMetric = key => setActiveMetrics(prev =>
    prev.includes(key) ? (prev.length > 1 ? prev.filter(k => k !== key) : prev) : [...prev, key]
  );
  const gridTicks = [0, 25, 50, 75, 100];

  return (
    <div className="space-y-0">
      {/* Summary cards with sparklines */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-5">
        {metricStats.map(m => {
          const active  = activeMetrics.includes(m.key);
          const trendUp = m.trend >= 0;
          return (
            <div
              key={m.key}
              onClick={() => toggleMetric(m.key)}
              className={"relative overflow-hidden rounded-2xl p-3.5 border cursor-pointer transition-all duration-200 select-none " + (active ? "shadow-sm hover:shadow-md hover:-translate-y-0.5" : "opacity-40 grayscale")}
              style={active ? { background: m.lightBg, borderColor: m.border } : { background: '#f8fafc', borderColor: '#e2e8f0' }}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">{m.shortLabel}</span>
                {active && m.trend !== 0 && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: trendUp ? '#dcfce7' : '#fee2e2', color: trendUp ? '#16a34a' : '#dc2626' }}>
                    {trendUp ? '↑' : '↓'} {Math.abs(m.trend)}%
                  </span>
                )}
              </div>
              <p className="text-2xl font-black leading-none tabular-nums" style={{ color: active ? m.color : '#94a3b8' }}>
                {m.total.toLocaleString()}
              </p>
              {isTodayKey && m.todayVal !== null && (
                <p className="text-[10px] font-semibold mt-0.5" style={{ color: m.color + 'bb' }}>+{m.todayVal} today</p>
              )}
              <div className="mt-2 opacity-90">
                <MiniSparkline values={m.vals} color={active ? m.color : '#cbd5e1'} />
              </div>
              {active && <div className="absolute top-2.5 right-2.5 w-1.5 h-1.5 rounded-full" style={{ background: m.color }} />}
            </div>
          );
        })}
      </div>

      {/* Normalized / Absolute toggle */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-semibold text-slate-400">
          {normalized ? 'Each metric on its own scale — trends are comparable regardless of volume' : 'Absolute values — proportional to actual counts'}
        </p>
        <div className="flex items-center gap-0.5 bg-slate-100 rounded-lg p-0.5 shrink-0">
          <button onClick={() => setNormalized(true)}  className={"px-2.5 py-1 rounded-md text-[10px] font-bold transition-all " + ( normalized ? "bg-white text-slate-800 shadow-sm" : "text-slate-400 hover:text-slate-600")}>Normalized</button>
          <button onClick={() => setNormalized(false)} className={"px-2.5 py-1 rounded-md text-[10px] font-bold transition-all " + (!normalized ? "bg-white text-slate-800 shadow-sm" : "text-slate-400 hover:text-slate-600")}>Absolute</button>
        </div>
      </div>

      {/* Main SVG area chart */}
      <div className="relative w-full rounded-2xl" style={{ background: 'linear-gradient(180deg,#f8fafc 0%,#ffffff 100%)', border: '1px solid #f1f5f9' }}>
        <svg viewBox={"0 0 " + SVG_W + " " + SVG_H} className="w-full" style={{ height: 200, overflow: 'visible' }}>
          <defs>
            {METRICS.map(m => (
              <linearGradient key={m.key} id={"area2-" + m.key} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={m.color} stopOpacity="0.22" />
                <stop offset="100%" stopColor={m.color} stopOpacity="0" />
              </linearGradient>
            ))}
          </defs>

          {normalized
            ? gridTicks.map(pct => {
                const y = PAD_T + chartH - (pct / 100) * chartH;
                return (
                  <g key={pct}>
                    <line x1={PAD_L} y1={y} x2={SVG_W - PAD_R} y2={y} stroke={pct === 0 ? '#cbd5e1' : '#e2e8f0'} strokeWidth={pct === 0 ? 1.5 : 1} strokeDasharray={pct === 0 ? '' : '5 4'} />
                    {pct > 0 && pct < 100 && <text x={PAD_L - 4} y={y} textAnchor="end" dominantBaseline="middle" fontSize="8.5" fill="#d1d5db" fontWeight="600">{pct}%</text>}
                  </g>
                );
              })
            : gridTicks.map(pct => {
                const v = (pct / 100) * niceGlobalMax;
                const y = toYAbs(v);
                return (
                  <g key={pct}>
                    <line x1={PAD_L} y1={y} x2={SVG_W - PAD_R} y2={y} stroke={pct === 0 ? '#cbd5e1' : '#e2e8f0'} strokeWidth={pct === 0 ? 1.5 : 1} strokeDasharray={pct === 0 ? '' : '5 4'} />
                    {pct > 0 && <text x={PAD_L - 5} y={y} textAnchor="end" dominantBaseline="middle" fontSize="9" fill="#94a3b8" fontWeight="600">{Math.round(v) >= 1000 ? (Math.round(v)/1000).toFixed(1) + 'k' : Math.round(v)}</text>}
                  </g>
                );
              })
          }

          {isTodayKey && data.map((d, i) => d[isTodayKey] ? (
            <rect key={i} x={toX(i) - (chartW/n)*0.7} y={PAD_T - 4} width={(chartW/n)*1.4} height={chartH + 4} rx={6} fill="#0d948812" />
          ) : null)}

          {hovIdx !== null && (
            <line x1={toX(hovIdx)} y1={PAD_T} x2={toX(hovIdx)} y2={PAD_T + chartH} stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4 3" />
          )}

          {METRICS.filter(m => activeMetrics.includes(m.key)).map(m => {
            const ms  = metricStats.find(s => s.key === m.key);
            const pts = data.map((d, i) => {
              const v = d[m.key] || 0;
              const y = normalized ? toYNorm(v, ms.max) : toYAbs(v);
              return [toX(i), y];
            });
            const lp = buildSmoothPath(pts);
            const ap = lp + ' L ' + toX(n-1) + ',' + (PAD_T+chartH) + ' L ' + toX(0) + ',' + (PAD_T+chartH) + ' Z';
            return (
              <g key={m.key}>
                <path d={ap} fill={"url(#area2-" + m.key + ")"} />
                <path d={lp} fill="none" stroke={m.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                {pts.map(([x, y], i) => (
                  <circle key={i} cx={x} cy={y} r={hovIdx === i ? 5.5 : 3} fill={hovIdx === i ? m.color : '#fff'} stroke={m.color} strokeWidth="2" style={{ transition: 'all 0.15s ease' }} />
                ))}
              </g>
            );
          })}

          {data.map((d, i) => {
            const isToday = isTodayKey && d[isTodayKey];
            return (
              <text key={i} x={toX(i)} y={SVG_H - PAD_B + 16} textAnchor="middle" fontSize="10.5"
                fontWeight={hovIdx === i || isToday ? '800' : '600'}
                fill={hovIdx === i || isToday ? '#0d9488' : '#94a3b8'}>
                {d[xKey]}{isToday ? ' ●' : ''}
              </text>
            );
          })}

          {data.map((d, i) => (
            <rect key={i} x={toX(i)-(chartW/n)/2} y={PAD_T} width={chartW/n} height={chartH+PAD_B}
              fill="transparent" style={{ cursor: 'crosshair' }}
              onMouseEnter={() => setHovIdx(i)} onMouseLeave={() => setHovIdx(null)} />
          ))}
        </svg>

        {hovIdx !== null && data[hovIdx] && (() => {
          const d       = data[hovIdx];
          const leftPct = (toX(hovIdx) / SVG_W) * 100;
          const clamped = Math.min(Math.max(leftPct, 15), 85);
          const isToday = isTodayKey && d[isTodayKey];
          return (
            <div className="absolute pointer-events-none z-40" style={{ bottom: 40, left: clamped + '%', transform: 'translateX(-50%)' }}>
              <div className="bg-slate-900 text-white rounded-2xl py-3 px-4 shadow-2xl border border-slate-700/50 w-52">
                <div className="flex items-center justify-between mb-2.5">
                  <p className="text-[10px] font-black text-teal-400 uppercase tracking-widest">{d[xFullKey || xKey]}</p>
                  {isToday && <span className="text-[9px] font-bold bg-teal-500/20 text-teal-300 px-1.5 py-0.5 rounded-full">TODAY</span>}
                </div>
                <div className="space-y-1.5">
                  {METRICS.filter(m => activeMetrics.includes(m.key)).map(m => {
                    const val  = d[m.key] || 0;
                    const ms   = metricStats.find(s => s.key === m.key);
                    const normP = ms.max > 0 ? Math.round((val/ms.max)*100) : 0;
                    return (
                      <div key={m.key} className="flex items-center justify-between gap-3 text-[11px]">
                        <span className="flex items-center gap-1.5 text-slate-400">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: m.color }} />{m.shortLabel}
                        </span>
                        <div className="flex items-center gap-2">
                          {normalized && <span className="text-[9px] font-semibold text-slate-500">{normP}%</span>}
                          <span className="font-black text-white tabular-nums">{val.toLocaleString()}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2.5 pt-2 border-t border-white/10 flex justify-between text-[10px]">
                  <span className="text-slate-500 font-semibold">Day Total</span>
                  <span className="text-white font-black">{METRICS.filter(m=>activeMetrics.includes(m.key)).reduce((s,m)=>s+(d[m.key]||0),0).toLocaleString()}</span>
                </div>
              </div>
            </div>
          );
        })()}

        {!hasAnyData && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pb-8 pointer-events-none">
            <BarChart3 className="w-10 h-10 text-slate-200 mb-2.5" />
            <p className="text-sm font-bold text-slate-300">No activity recorded yet</p>
            <p className="text-[11px] text-slate-200 mt-0.5">Data will appear as transactions are created</p>
          </div>
        )}
      </div>
    </div>
  );
}
`;

const start = c.indexOf('const METRICS = [');
const end   = c.indexOf('\nfunction ProcurementChart(');
const result = c.slice(0, start) + newSection + '\n' + c.slice(end);
fs.writeFileSync('src/components/dashboard/OverviewDashboard.jsx', result, 'utf8');
console.log('Done. New length:', result.length);
