import React from 'react';
import { Session } from '../types';
import { Plus, Trash2, ChevronRight, FileText, Clock } from 'lucide-react';

interface DashboardProps {
  sessions: Session[];
  onCreateSession: () => void;
  onContinueSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ sessions, onCreateSession, onContinueSession, onDeleteSession }) => {
  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex justify-between items-end">
        <div>
           <h1 className="text-3xl font-bold text-slate-900">研究项目列表</h1>
           <p className="text-slate-500 mt-2">管理所有的用户体验研究 Session</p>
        </div>
        <button
          onClick={onCreateSession}
          className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:bg-indigo-700 hover:shadow-xl transition-all flex items-center gap-2"
        >
          <Plus size={20} />
          新建 Session
        </button>
      </div>

      <div className="grid gap-4">
        {sessions.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300 text-slate-400">
                <FileText size={48} className="mx-auto mb-4 opacity-50" />
                <p>暂无研究项目，请点击上方按钮开始。</p>
            </div>
        ) : (
            sessions.map(session => (
                <div 
                    key={session.id} 
                    onClick={() => onContinueSession(session.id)}
                    className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 group relative overflow-hidden cursor-pointer"
                >
                    <div className="flex-1 w-full">
                        <div className="flex items-center gap-3 mb-2">
                             <span className="font-mono text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded">
                                {session.id.slice(-6).toUpperCase()}
                             </span>
                             <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                                 session.status === 'completed' 
                                 ? 'bg-green-100 text-green-700' 
                                 : 'bg-amber-100 text-amber-700'
                             }`}>
                                {session.status === 'completed' ? '已完成' : '进行中'}
                             </span>
                        </div>
                        <h3 className="font-bold text-lg text-slate-800">
                            {session.persona.ageGroup ? `${session.persona.ageGroup} / ${session.persona.familyStructure}` : '新研究项目'}
                        </h3>
                        <div className="text-sm text-slate-500 mt-1 flex items-center gap-4">
                             <span className="flex items-center gap-1"><Clock size={14}/> {new Date(session.updatedAt).toLocaleDateString()}</span>
                             {session.aiSummary && <span className="text-indigo-600 font-medium">已生成 AI 报告</span>}
                        </div>
                    </div>

                    <div className="flex items-center gap-3 relative z-20">
                         <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onContinueSession(session.id);
                            }}
                            className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-indigo-600 font-medium rounded-lg text-sm transition-colors flex items-center gap-1"
                         >
                            {session.status === 'completed' ? '查看报告' : '继续研究'} <ChevronRight size={16} />
                         </button>
                         <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onDeleteSession(session.id);
                            }}
                            className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="删除"
                         >
                            <Trash2 size={18} />
                         </button>
                    </div>
                </div>
            ))
        )}
      </div>
    </div>
  );
};

export default Dashboard;