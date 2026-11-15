import type { User } from 'firebase/auth';
import { LogIn, LogOut } from 'lucide-react';
import type { ViewMode } from '../types/feedback';

interface HeaderProps {
  activeView: ViewMode;
  onSwitchView: (view: ViewMode) => void;
  user: User | null;
  authReady: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
}

export function Header({
  activeView,
  onSwitchView,
  user,
  authReady,
  onSignIn,
  onSignOut,
}: HeaderProps) {
  return (
    <header className="no-print w-full bg-white/95 backdrop-blur-md shadow-sm border-b border-slate-200/80 px-4 sm:px-8 py-3 flex justify-between items-center gap-4 sticky top-0 z-40">
      <div className="font-extrabold text-xl text-slate-800 flex items-center gap-2.5 whitespace-nowrap shrink-0">
        <span className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-lg shadow-md shadow-blue-500/20">
          F
        </span>
        <span>
          Feedback<span className="text-blue-600">Hub</span>
        </span>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <button
          type="button"
          onClick={() => onSwitchView('submit')}
          className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all active:scale-95 flex flex-col items-center leading-tight whitespace-nowrap shrink-0 cursor-pointer ${
            activeView === 'submit'
              ? 'bg-blue-600 text-white shadow-md hover:bg-blue-700'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <span>Submit Feedback</span>
          <span className="text-[10px] opacity-90 font-medium mt-0.5">
            ප්‍රතිපෝෂණ ලබා දෙන්න
          </span>
        </button>

        <button
          type="button"
          onClick={() => onSwitchView('dashboard')}
          className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all active:scale-95 flex flex-col items-center leading-tight whitespace-nowrap shrink-0 cursor-pointer ${
            activeView === 'dashboard'
              ? 'bg-blue-600 text-white shadow-md hover:bg-blue-700'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <span>View Dashboard</span>
          <span className="text-[10px] opacity-80 font-medium mt-0.5">
            දත්ත පුවරුව
          </span>
        </button>

        {authReady && (
          user ? (
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              <span className="hidden md:inline text-xs font-semibold text-slate-600 max-w-[140px] truncate">
                {user.displayName || user.email}
              </span>
              <button
                type="button"
                onClick={onSignOut}
                title="Sign out"
                aria-label="Sign out"
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onSignIn}
              className="flex items-center gap-1.5 px-3 sm:px-3.5 py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-900 text-white transition-all whitespace-nowrap shrink-0 cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign In</span>
            </button>
          )
        )}
      </div>
    </header>
  );
}
