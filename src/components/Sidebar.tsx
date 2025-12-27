import { Code, FileText, Zap, Settings, ChevronRight, Sparkles } from 'lucide-react';

interface Mode {
  id: string;
  label: string;
  icon: React.ReactNode;
  description: string;
}

interface SidebarProps {
  activeMode: string;
  onModeChange: (modeId: string) => void;
}

const modes: Mode[] = [
  {
    id: 'chat',
    label: 'Chat',
    icon: <Zap size={20} />,
    description: 'General conversation',
  },
  {
    id: 'code',
    label: 'Code Mode',
    icon: <Code size={20} />,
    description: 'Code analysis & generation',
  },
  {
    id: 'analysis',
    label: 'Analysis',
    icon: <FileText size={20} />,
    description: 'PDF & document analysis',
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: <Settings size={20} />,
    description: 'Configure preferences',
  },
];

export default function Sidebar({ activeMode, onModeChange }: SidebarProps) {
  return (
    <div className="w-64 glass-soft glass-hover glass-glow relative border-r border-white/20 flex flex-col">
      <div className="px-6 py-6 border-b border-purple-500/20">
        <div className="flex items-center gap-2">
          <Sparkles size={20} className="text-purple-300" />
          <h2 className="text-lg font-bold cosmo-text">
            Granthika
          </h2>
        </div>
        <p className="text-xs text-purple-300/50 mt-1">Select conversation mode</p>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-2">
        {modes.map((mode) => (
          <button
            key={mode.id}
            onClick={() => onModeChange(mode.id)}
            className={`w-full flex items-start gap-3 px-4 py-3 rounded-xl transition-all group glass-hover relative ${

              activeMode === mode.id
                ? 'bg-white/25 shadow-2xl border border-white/30'
                : 'bg-white/10 hover:bg-white/20 border border-white/10'
            }`}
          >
            <div
              className={`mt-0.5 flex-shrink-0 transition-colors ${
                activeMode === mode.id ? 'text-purple-300' : 'text-purple-300/50 group-hover:text-purple-300'
              }`}
            >
              {mode.icon}
            </div>
            <div className="flex-1 text-left">
              <p
                className={`text-sm font-medium transition-colors ${
                  activeMode === mode.id ? 'text-purple-200' : 'text-purple-100/80 group-hover:text-purple-200'
                }`}
              >
                {mode.label}
              </p>
              <p className="text-xs text-purple-300/50 mt-0.5 group-hover:text-purple-300/70 transition-colors">
                {mode.description}
              </p>
            </div>
            {activeMode === mode.id && (
              <ChevronRight size={16} className="text-purple-300 flex-shrink-0 mt-0.5 animate-slideInRight" />
            )}
          </button>
        ))}
      </nav>

      <div className="border-t border-purple-500/20 px-4 py-4">
        <div className="backdrop-blur-sm bg-purple-600/20 border border-purple-500/30 rounded-xl p-4 hover:bg-purple-600/30 transition-all">
          <p className="text-xs font-semibold text-purple-200 mb-2">Pro Tip</p>
          <p className="text-xs text-purple-300/80 leading-relaxed">
            Switch between modes to access different conversation features and analysis tools.
          </p>
        </div>
      </div>
    </div>
  );
}
