import { useEffect, useMemo, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { Chart, registerables } from 'chart.js';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { LogIn } from 'lucide-react';
import type { FeedbackCounts, FeedbackRating, FeedbackRecord } from '../types/feedback';

Chart.register(...registerables);

interface DashboardViewProps {
  feedbacks: FeedbackRecord[];
  isLoading: boolean;
  user: User | null;
  onSignIn: () => void;
  onShowToast: (message: string) => void;
}

function toJsDate(timestamp: FeedbackRecord['timestamp']): Date | null {
  if (!timestamp) return null;
  if (timestamp instanceof Date) return timestamp;
  if (typeof (timestamp as { toDate?: () => Date }).toDate === 'function') {
    return (timestamp as { toDate: () => Date }).toDate();
  }
  return null;
}

function getRatingLabel(type: FeedbackRating) {
  if (type === 'good') {
    return {
      text: 'Great / හොඳයි',
      classes: 'bg-green-100 text-green-700',
    };
  }
  if (type === 'average') {
    return {
      text: 'Average / සාමාන්‍යයි',
      classes: 'bg-yellow-100 text-yellow-800',
    };
  }
  return {
    text: 'Poor / දුර්වලයි',
    classes: 'bg-red-100 text-red-700',
  };
}

export function DashboardView({
  feedbacks,
  isLoading,
  user,
  onSignIn,
  onShowToast,
}: DashboardViewProps) {
  const [selectedSessionFilter, setSelectedSessionFilter] = useState<string>('ALL');
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);

  const dashboardContentRef = useRef<HTMLDivElement | null>(null);
  const barCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const pieCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const barChartRef = useRef<Chart | null>(null);
  const pieChartRef = useRef<Chart | null>(null);

  const uniqueSessions = useMemo(() => {
    const set = new Set<string>();
    feedbacks.forEach((f) => {
      const sName = f.sessionName?.trim() ? f.sessionName.trim() : 'General Session';
      set.add(sName);
    });
    return Array.from(set).sort();
  }, [feedbacks]);

  const effectiveFilter = useMemo(() => {
    if (selectedSessionFilter === 'ALL') return 'ALL';
    return uniqueSessions.includes(selectedSessionFilter) ? selectedSessionFilter : 'ALL';
  }, [selectedSessionFilter, uniqueSessions]);

  const filteredFeedbacks = useMemo(() => {
    if (effectiveFilter === 'ALL') return feedbacks;
    return feedbacks.filter((f) => {
      const sName = f.sessionName?.trim() ? f.sessionName.trim() : 'General Session';
      return sName === effectiveFilter;
    });
  }, [feedbacks, effectiveFilter]);

  const sortedFeedbacks = useMemo(() => {
    return [...filteredFeedbacks].sort((a, b) => {
      const dA = toJsDate(a.timestamp)?.getTime() ?? 0;
      const dB = toJsDate(b.timestamp)?.getTime() ?? 0;
      return dB - dA;
    });
  }, [filteredFeedbacks]);

  const counts: FeedbackCounts = useMemo(() => {
    const good = filteredFeedbacks.filter((f) => f.type === 'good').length;
    const average = filteredFeedbacks.filter((f) => f.type === 'average').length;
    const poor = filteredFeedbacks.filter((f) => f.type === 'poor').length;
    return {
      total: filteredFeedbacks.length,
      good,
      average,
      poor,
    };
  }, [filteredFeedbacks]);

  const getPct = (val: number) =>
    counts.total > 0 ? `${Math.round((val / counts.total) * 100)}%` : '0%';

  const reportDateText = useMemo(() => {
    return new Date().toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, [feedbacks.length, effectiveFilter]);

  useEffect(() => {
    if (barChartRef.current) {
      barChartRef.current.destroy();
      barChartRef.current = null;
    }
    if (pieChartRef.current) {
      pieChartRef.current.destroy();
      pieChartRef.current = null;
    }

    if (counts.total === 0) return;

    Chart.defaults.font.family = "'Plus Jakarta Sans', 'Noto Sans Sinhala', sans-serif";
    Chart.defaults.color = '#64748b';

    if (barCanvasRef.current) {
      barChartRef.current = new Chart(barCanvasRef.current, {
        type: 'bar',
        data: {
          labels: ['Great (හොඳයි)', 'Average (සාමාන්‍යයි)', 'Poor (දුර්වලයි)'],
          datasets: [
            {
              label: 'Feedback Count',
              data: [counts.good, counts.average, counts.poor],
              backgroundColor: ['#84cc16', '#eab308', '#ef4444'],
              borderRadius: 8,
              maxBarThickness: 50,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 300 },
          plugins: {
            legend: { display: false },
            tooltip: { cornerRadius: 8, padding: 10 },
          },
          scales: {
            y: { beginAtZero: true, ticks: { stepSize: 1, precision: 0 } },
            x: { grid: { display: false } },
          },
        },
      });
    }

    if (pieCanvasRef.current) {
      pieChartRef.current = new Chart(pieCanvasRef.current, {
        type: 'doughnut',
        data: {
          labels: ['Great (හොඳයි)', 'Average (සාමාන්‍යයි)', 'Poor (දුර්වලයි)'],
          datasets: [
            {
              data: [counts.good, counts.average, counts.poor],
              backgroundColor: ['#84cc16', '#eab308', '#ef4444'],
              borderWidth: 2,
              borderColor: '#ffffff',
              hoverOffset: 6,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 300 },
          cutout: '65%',
          plugins: {
            legend: { position: 'bottom', labels: { boxWidth: 12, padding: 16 } },
            tooltip: {
              callbacks: {
                label: (context) => {
                  const label = context.label ? `${context.label}: ` : '';
                  const value = Number(context.parsed) || 0;
                  const total = (context.dataset.data as number[]).reduce(
                    (a, b) => a + b,
                    0
                  );
                  const pct = total > 0 ? `${Math.round((value / total) * 100)}%` : '0%';
                  return `${label}${value} (${pct})`;
                },
              },
            },
          },
        },
      });
    }

    return () => {
      if (barChartRef.current) {
        barChartRef.current.destroy();
        barChartRef.current = null;
      }
      if (pieChartRef.current) {
        pieChartRef.current.destroy();
        pieChartRef.current = null;
      }
    };
  }, [counts]);

  const handleDownloadPdf = async () => {
    if (!dashboardContentRef.current || isExportingPdf) return;

    setIsExportingPdf(true);
    const currentFilterName =
      effectiveFilter === 'ALL'
        ? 'All-Sessions'
        : effectiveFilter.replace(/[^a-z0-9]/gi, '_');
    const filename = `Feedback_Report_${currentFilterName}.pdf`;

    try {
      barChartRef.current?.resize();
      pieChartRef.current?.resize();

      await new Promise((resolve) => setTimeout(resolve, 150));

      const dataUrl = await toPng(dashboardContentRef.current, {
        pixelRatio: 2,
        backgroundColor: '#f8fafc',
        cacheBust: true,
      });

      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to render dashboard snapshot'));
        img.src = dataUrl;
      });

      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'in',
        format: 'letter',
      });

      const margin = 0.45;
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const usableWidth = pageWidth - margin * 2;
      const usableHeight = pageHeight - margin * 2;

      const imgAspect = img.height / img.width;
      const renderWidth = usableWidth;
      const renderHeight = renderWidth * imgAspect;

      if (renderHeight <= usableHeight) {
        pdf.addImage(dataUrl, 'PNG', margin, margin, renderWidth, renderHeight);
      } else {
        // Slice tall captures across pages cleanly
        const totalPages = Math.ceil(renderHeight / usableHeight);
        for (let page = 0; page < totalPages; page++) {
          if (page > 0) pdf.addPage();
          const yOffset = margin - page * usableHeight;
          pdf.addImage(dataUrl, 'PNG', margin, yOffset, renderWidth, renderHeight);
        }
      }

      pdf.save(filename);
      onShowToast('PDF report downloaded successfully!');
    } catch (error) {
      console.error('PDF generation error:', error);
      onShowToast('Failed to generate PDF report.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  if (!user) {
    return (
      <div className="w-full max-w-2xl bg-white p-8 rounded-2xl shadow-sm border border-slate-200/80 text-center flex flex-col items-center gap-4 animate-fade-in">
        <h2 className="text-2xl font-extrabold text-slate-800">
          Dashboard & Analytics
        </h2>
        <p className="text-sm text-slate-600 max-w-md">
          Sign in with your Google account to view real-time feedback analytics,
          session breakdowns, and export PDF reports.
        </p>
        <button
          type="button"
          onClick={onSignIn}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm transition-colors cursor-pointer"
        >
          <LogIn className="w-4 h-4" />
          <span>Sign In with Google</span>
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl flex flex-col gap-6 animate-fade-in">
      {/* Control Header Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-200/70 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800">
            Dashboard & Analytics <br />
            <span className="text-lg text-slate-500 font-bold">
              දත්ත පුවරුව සහ විශ්ලේෂණ
            </span>
          </h1>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          <div className="flex flex-col gap-1">
            <label
              htmlFor="session-filter"
              className="text-[11px] font-bold text-slate-500 tracking-wide no-print"
            >
              Filter Session / සැසිය තෝරන්න
            </label>
            <select
              id="session-filter"
              value={effectiveFilter}
              onChange={(e) => setSelectedSessionFilter(e.target.value)}
              className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm transition-all cursor-pointer"
            >
              <option value="ALL">All Sessions / සියලුම සැසි</option>
              {uniqueSessions.map((session) => (
                <option key={session} value={session}>
                  {session}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            disabled={isExportingPdf}
            onClick={handleDownloadPdf}
            className="no-print mt-auto flex flex-col items-center justify-center bg-slate-900 hover:bg-black disabled:opacity-60 text-white px-5 py-2 rounded-xl font-bold text-sm transition-all shadow-md active:scale-95 leading-tight cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <svg
                className="w-4 h-4 text-red-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <span>
                {isExportingPdf ? 'Generating PDF...' : 'Download PDF Report'}
              </span>
            </div>
            {!isExportingPdf && (
              <span className="text-[10px] text-slate-300 font-medium mt-0.5">
                PDF වාර්තාව බාගන්න
              </span>
            )}
          </button>
        </div>
      </div>

      {/* PDF Export Container */}
      <div
        ref={dashboardContentRef}
        id="dashboard-content"
        className="flex flex-col gap-6 p-6 sm:p-8 bg-slate-50 rounded-2xl border border-slate-200/60 shadow-inner"
      >
        {/* Report Header */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 break-avoid">
          <div>
            <span className="text-xs font-extrabold text-blue-600 tracking-wide">
              Official Feedback Report
            </span>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-800 mt-0.5">
              Report Session:{' '}
              <span className="text-blue-600 underline decoration-blue-200 underline-offset-4">
                {effectiveFilter === 'ALL' ? 'All Sessions' : effectiveFilter}
              </span>
            </h2>
          </div>
          <div className="text-left sm:text-right text-xs text-slate-500 font-medium tabular-nums">
            <div>
              Generated on:{' '}
              <span className="font-bold text-slate-700">{reportDateText}</span>
            </div>
            <div className="mt-0.5 text-slate-400">Feedback Hub Analytics</div>
          </div>
        </div>

        {/* Stats Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 border-b-4 border-b-blue-500 flex flex-col items-center justify-center break-avoid text-center">
            <span className="text-slate-600 font-semibold mb-1 text-sm leading-tight">
              Total Responses
              <br />
              <span className="text-xs text-slate-500">මුළු ප්‍රතිචාර</span>
            </span>
            <span className="text-4xl font-black text-slate-800 font-mono-num">
              {isLoading ? '—' : counts.total}
            </span>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 border-b-4 border-b-[#84cc16] flex flex-col items-center justify-center break-avoid text-center">
            <span className="text-slate-600 font-semibold mb-1 text-sm leading-tight">
              Great
              <br />
              <span className="text-xs text-slate-500">හොඳයි</span>
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black text-[#6da510] font-mono-num">
                {isLoading ? '—' : counts.good}
              </span>
              <span className="text-base font-bold text-slate-400 tabular-nums">
                ({getPct(counts.good)})
              </span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 border-b-4 border-b-[#eab308] flex flex-col items-center justify-center break-avoid text-center">
            <span className="text-slate-600 font-semibold mb-1 text-sm leading-tight">
              Average
              <br />
              <span className="text-xs text-slate-500">සාමාන්‍යයි</span>
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black text-[#b59406] font-mono-num">
                {isLoading ? '—' : counts.average}
              </span>
              <span className="text-base font-bold text-slate-400 tabular-nums">
                ({getPct(counts.average)})
              </span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 border-b-4 border-b-[#ef4444] flex flex-col items-center justify-center break-avoid text-center">
            <span className="text-slate-600 font-semibold mb-1 text-sm leading-tight">
              Poor
              <br />
              <span className="text-xs text-slate-500">දුර්වලයි</span>
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black text-[#c50e0a] font-mono-num">
                {isLoading ? '—' : counts.poor}
              </span>
              <span className="text-base font-bold text-slate-400 tabular-nums">
                ({getPct(counts.poor)})
              </span>
            </div>
          </div>
        </div>

        {/* Charts Section Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-2">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/60 h-[280px] flex flex-col break-avoid">
            <h3 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
              <svg
                className="w-4 h-4 text-blue-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
              Distribution Count / ව්‍යාප්ති ගණන
            </h3>
            <div className="relative w-full flex-1 min-h-[180px] flex items-center justify-center">
              <canvas ref={barCanvasRef} />
              {counts.total === 0 && (
                <div className="absolute inset-0 flex items-center justify-center text-slate-400 font-medium text-sm bg-white/95">
                  {isLoading ? 'Loading feedback...' : 'No feedback submitted yet'}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/60 h-[280px] flex flex-col break-avoid">
            <h3 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
              <svg
                className="w-4 h-4 text-purple-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"
                />
              </svg>
              Proportion Breakdown / ප්‍රතිශතය
            </h3>
            <div className="relative w-full flex-1 min-h-[180px] flex items-center justify-center">
              <canvas ref={pieCanvasRef} />
              {counts.total === 0 && (
                <div className="absolute inset-0 flex items-center justify-center text-slate-400 font-medium text-sm bg-white/95">
                  {isLoading ? 'Loading feedback...' : 'No feedback submitted yet'}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Session Log Breakdown (Latest 5) */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/60 mt-2 break-avoid">
          <h3 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
            <svg
              className="w-4 h-4 text-emerald-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Session Log Breakdown / සැසි සාරාංශය
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 font-bold text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4">
                    Session Name
                    <br />
                    <span className="text-[10px] font-medium">සැසියේ නම</span>
                  </th>
                  <th className="py-2.5 px-4">
                    Rating
                    <br />
                    <span className="text-[10px] font-medium">ශ්‍රේණිගත කිරීම</span>
                  </th>
                  <th className="py-2.5 px-4 text-right">
                    Time Recorded
                    <br />
                    <span className="text-[10px] font-medium">වේලාව</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {isLoading ? (
                  <tr>
                    <td colSpan={3} className="py-4 text-center text-slate-400">
                      Loading records...
                    </td>
                  </tr>
                ) : sortedFeedbacks.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-4 text-center text-slate-400">
                      No records to display.
                    </td>
                  </tr>
                ) : (
                  sortedFeedbacks.slice(0, 5).map((item) => {
                    const badge = getRatingLabel(item.type);
                    const jsDate = toJsDate(item.timestamp);
                    const timeStr = jsDate
                      ? jsDate.toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'Just now';

                    return (
                      <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-4 font-semibold text-slate-800">
                          {item.sessionName || 'General Session'}
                        </td>
                        <td className="py-2.5 px-4">
                          <span
                            className={`${badge.classes} font-bold px-2 py-0.5 rounded`}
                          >
                            {badge.text}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-right text-slate-500 tabular-nums">
                          {timeStr}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Detailed Responses Table */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/60 mt-2 break-avoid">
          <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
            <svg
              className="w-4 h-4 text-blue-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            Detailed Responses / සවිස්තරාත්මක ප්‍රතිචාර
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs font-bold text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 min-w-[120px]">
                    Session
                    <br />
                    <span className="text-[10px] font-medium">සැසිය</span>
                  </th>
                  <th className="py-3 px-4 min-w-[100px]">
                    Date
                    <br />
                    <span className="text-[10px] font-medium">දිනය</span>
                  </th>
                  <th className="py-3 px-4 min-w-[110px]">
                    Rating
                    <br />
                    <span className="text-[10px] font-medium">ශ්‍රේණිගත කිරීම</span>
                  </th>
                  <th className="py-3 px-4 min-w-[180px]">
                    Learning Points
                    <br />
                    <span className="text-[10px] font-medium">ඉගෙන ගත් කරුණු</span>
                  </th>
                  <th className="py-3 px-4 min-w-[180px]">
                    Suggestions
                    <br />
                    <span className="text-[10px] font-medium">යෝජනා</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-6 text-center text-slate-400 font-medium"
                    >
                      Loading detailed responses...
                    </td>
                  </tr>
                ) : sortedFeedbacks.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-6 text-center text-slate-400 font-medium"
                    >
                      No detailed responses to display.
                    </td>
                  </tr>
                ) : (
                  sortedFeedbacks.map((item) => {
                    const badge = getRatingLabel(item.type);
                    const jsDate = toJsDate(item.timestamp);
                    const dateStr = jsDate
                      ? jsDate.toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'Just now';

                    return (
                      <tr
                        key={item.id}
                        className="hover:bg-slate-50 transition-colors break-avoid"
                      >
                        <td className="py-3 px-4 font-semibold text-slate-800 align-top">
                          {item.sessionName || 'General Session'}
                        </td>
                        <td className="py-3 px-4 text-slate-500 whitespace-nowrap text-xs align-top tabular-nums">
                          {dateStr}
                        </td>
                        <td className="py-3 px-4 align-top">
                          <span
                            className={`${badge.classes} font-bold px-2 py-0.5 rounded text-xs whitespace-nowrap`}
                          >
                            {badge.text}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-700 whitespace-pre-wrap align-top text-sm min-w-[150px]">
                          {item.learningPoints ? (
                            item.learningPoints
                          ) : (
                            <span className="text-slate-300 italic">None</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-700 whitespace-pre-wrap align-top text-sm min-w-[150px]">
                          {item.suggestions ? (
                            item.suggestions
                          ) : (
                            <span className="text-slate-300 italic">None</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
