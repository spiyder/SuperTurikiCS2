// src/pages/BugReportPage.tsx
import { useState } from 'react';
import { ArrowLeft, Bug, Send, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { User as SupabaseUser } from '@supabase/supabase-js';

interface Props { user: SupabaseUser | null; onBack: () => void; onOpenLogin: () => void; }

type Severity = 'low' | 'medium' | 'high' | 'critical';

const SEVERITY_CONFIG: Record<Severity, { label: string; color: string; desc: string }> = {
  low:      { label: 'Незначительный', color: 'bg-gray-500/20 text-gray-400',     desc: 'Косметическая проблема, не мешает использованию' },
  medium:   { label: 'Средний',        color: 'bg-yellow-500/20 text-yellow-400', desc: 'Мешает использовать отдельную функцию' },
  high:     { label: 'Серьёзный',      color: 'bg-orange-500/20 text-orange-400', desc: 'Блокирует важную функцию' },
  critical: { label: 'Критический',    color: 'bg-red-500/20 text-red-400',       desc: 'Платформа не работает или есть угроза безопасности' },
};

export function BugReportPage({ user, onBack, onOpenLogin }: Props) {
  const [title, setTitle]       = useState('');
  const [description, setDesc]  = useState('');
  const [severity, setSeverity] = useState<Severity>('medium');
  const [page, setPage]         = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone]         = useState(false);

  const submit = async () => {
    if (!user) { onOpenLogin(); return; }
    if (!title.trim() || !description.trim()) return;
    setSubmitting(true);

    await supabase.from('bug_reports').insert({
      user_id: user.id,
      username: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Игрок',
      title: title.trim(),
      description: description.trim(),
      severity,
      page_url: page.trim(),
      status: 'open',
    });

    setSubmitting(false);
    setDone(true);
  };

  if (done) return (
    <div className="min-h-screen bg-dark-300 text-white flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 bg-green-500/20 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <CheckCircle2 className="w-8 h-8 text-green-400" />
        </div>
        <h2 className="font-display font-bold text-2xl text-white mb-2">Спасибо за репорт!</h2>
        <p className="text-gray-400 text-sm mb-6">Мы рассмотрим проблему в ближайшее время. Если нужна обратная связь — напиши нам в Discord.</p>
        <button onClick={onBack} className="btn-primary">Вернуться на главную</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-dark-300 text-white">
      <header className="bg-dark-100/95 backdrop-blur-md border-b border-dark-50 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center gap-4">
          <button onClick={onBack} className="text-gray-400 hover:text-white flex items-center gap-1.5 text-sm">
            <ArrowLeft className="w-4 h-4" /> Назад
          </button>
          <div className="h-5 w-px bg-dark-50" />
          <div className="flex items-center gap-2">
            <Bug className="w-4 h-4 text-primary-500" />
            <span className="font-display font-bold text-white">Баг-репорт</span>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8">
        <p className="text-gray-400 text-sm mb-6">
          Нашёл ошибку на платформе? Опиши её подробно — это поможет нам быстрее всё исправить.
        </p>

        {!user && (
          <div className="mb-5 flex items-center gap-2 px-4 py-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-yellow-300 text-sm">
            <AlertTriangle className="w-4 h-4 shrink-0" /> Войди в аккаунт чтобы отправить репорт
          </div>
        )}

        <div className="space-y-5">
          {/* Severity */}
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">Серьёзность проблемы</label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(SEVERITY_CONFIG) as Severity[]).map(s => {
                const cfg = SEVERITY_CONFIG[s];
                return (
                  <button key={s} onClick={() => setSeverity(s)}
                    className={`text-left p-3 rounded-xl border transition-all ${
                      severity === s ? `${cfg.color} border-current` : 'bg-dark-100 border-dark-50 text-gray-400 hover:text-white'
                    }`}>
                    <p className="font-semibold text-sm">{cfg.label}</p>
                    <p className="text-xs opacity-70 mt-0.5">{cfg.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">Заголовок</label>
            <input value={title} onChange={e => setTitle(e.target.value)} maxLength={100}
              placeholder="Кратко опиши проблему"
              className="w-full bg-dark-100 border border-dark-50 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-primary-500" />
          </div>

          {/* Page */}
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">Где произошла проблема (необязательно)</label>
            <input value={page} onChange={e => setPage(e.target.value)}
              placeholder="Например: страница турнира, лобби матча"
              className="w-full bg-dark-100 border border-dark-50 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-primary-500" />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">Подробное описание</label>
            <textarea value={description} onChange={e => setDesc(e.target.value)} rows={6} maxLength={1000}
              placeholder="Что ты делал, что должно было произойти, что произошло вместо этого..."
              className="w-full bg-dark-100 border border-dark-50 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-primary-500 resize-none" />
            <p className="text-gray-600 text-xs mt-1 text-right">{description.length}/1000</p>
          </div>

          <button onClick={submit} disabled={submitting || !title.trim() || !description.trim()}
            className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Отправить репорт
          </button>
        </div>
      </div>
    </div>
  );
}
