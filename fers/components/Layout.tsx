import React from 'react';
import { Home } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  onGoHome: () => void;
  title?: string;
}

const Layout: React.FC<LayoutProps> = ({ children, onGoHome, title }) => {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={onGoHome}>
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">
              F
            </div>
            <span className="font-bold text-lg tracking-tight text-slate-800">FERS 未来体验研究</span>
          </div>
          
          {title && (
             <div className="hidden md:block absolute left-1/2 transform -translate-x-1/2 text-sm font-medium text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                {title}
             </div>
          )}

          <button 
            onClick={onGoHome}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-600"
            title="返回首页"
          >
            <Home size={20} />
          </button>
        </div>
      </header>
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-8">
        {children}
      </main>
      <footer className="py-6 text-center text-slate-400 text-sm">
        &copy; {new Date().getFullYear()} Future Experience Research System
      </footer>
    </div>
  );
};

export default Layout;