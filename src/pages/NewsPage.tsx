// src/pages/NewsPage.tsx
import { useState, useEffect } from 'react';
import { ArrowLeft, Search, Pin, Megaphone, Trophy, RefreshCw, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface NewsItem {
  id: number;
  title: string;
  body: string;
  is_published: boolean;
  is_pinned: boolean;
  category: 'tournament' | 'update' | 'announce';
  published_at: string | null;
  created_at: string;
}

interface Props { onBack: () => void; }

const CAT_LABEL: Record<string, string> = { tournament: 'Турнир', update: 'Обновление', announce: 'Анонс' };
const CAT_COLOR: Record<string, string> = {
  tournament: 'bg-yellow-500/20 text-yellow-400',
  update:     'bg-blue-500/20 text-blue-400',
  announce:   'bg-primary-500/20 text-primary-400',
};
const CAT_ICON: Record<string, React.FC<{className?:string}>> = {
  tournament: Trophy,
  update:     RefreshCw,
  announce:   Megaphone,
};

export function NewsPage({ onBack }: Props) {
  const [news, setNews]       = useState<NewsItem[]>([]);
  const [filter, setFilter]   = useState<'all' | NewsItem['category']>('all');
  const [search, setSearch]   = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<NewsItem | null>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('news')
      .select('*')
      .eq('is_published', true)
      .order('is_pinned', { ascending: false })
      .order('published_at', { ascending: false });
    if (data) setNews(data);
    setLoading(false);
  };

  const filtered = news.filter(n => {
    const matchCat    = filter === 'all' || n.category === filter;
    const matchSearch = !search || n.title.toLowerCase().includes(search.toLowerCase()) || n.body.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  if (selected) return (
    <div className="min-h-screen bg-dark-300 text-white">
      <header className="bg-dark-100/95 backdrop-blur-md border-b border-dark-50 sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center gap-4">
          <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-white flex items-center gap-1.5 text-sm">
            <ArrowLeft className="w-4 h-4" /> Назад
          </button>
        </div>
      </header>
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center gap-2 mb-4">
          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${CAT_COLOR[selected.category]}`}>
            {CAT_LABEL[selected.category]}
          </span>
          {selected.is_pinned && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-primary-500/20 text-primary-400">
              <Pin className="w-3 h-3" /> Закреплено
            </span>
          )}
          <span className="text-gray-500 text-xs ml-auto flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {selected.published_at ? new Date(selected.published_at).toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}
          </span>
        </div>
        <h1 className="font-display font-bold text-3xl text-white mb-6">{selected.title}</h1>
        <div className="text-gray-300 leading-relaxed whitespace-pre-wrap text-base">{selected.body}</div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-dark-300 text-white">
      <header className="bg-dark-100/95 backdrop-blur-md border-b border-dark-50 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center gap-4">
          <button onClick={onBack} className="text-gray-400 hover:text-white flex items-center gap-1.5 text-sm">
            <ArrowLeft className="w-4 h-4" /> Назад
          </button>
          <div className="h-5 w-px bg-dark-50" />
          <span className="font-display font-bold text-white">Новости и анонсы</span>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
        {/* Search + filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск новостей..."
              className="w-full bg-dark-100 border border-dark-50 rounded-xl pl-9 pr-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-primary-500" />
          </div>
          <div className="flex gap-2 flex-wrap">
            {(['all', 'tournament', 'update', 'announce'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-2 rounded-xl text-xs font-medium transition-all border ${
                  filter === f ? 'bg-primary-500 text-white border-primary-500' : 'bg-dark-100 border-dark-50 text-gray-400 hover:text-white'
                }`}>
                {f === 'all' ? 'Все' : CAT_LABEL[f]}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-6 h-6 text-primary-500 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <Megaphone className="w-12 h-12 mx-auto mb-3 text-gray-700" />
            <p>Новостей пока нет</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(n => {
              const Icon = CAT_ICON[n.category];
              return (
                <div key={n.id} onClick={() => setSelected(n)}
                  className={`card flex items-start gap-4 cursor-pointer hover:border-primary-500/30 transition-all ${n.is_pinned ? 'border-primary-500/30 bg-primary-500/5' : ''}`}>
                  <div className="w-12 h-12 rounded-xl bg-dark-100 border border-dark-50 flex items-center justify-center shrink-0">
                    <Icon className={`w-5 h-5 ${n.category === 'tournament' ? 'text-yellow-400' : n.category === 'update' ? 'text-blue-400' : 'text-primary-400'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${CAT_COLOR[n.category]}`}>
                        {CAT_LABEL[n.category]}
                      </span>
                      {n.is_pinned && (
                        <span className="flex items-center gap-1 text-xs text-primary-400">
                          <Pin className="w-3 h-3" /> Закреплено
                        </span>
                      )}
                      <span className="text-gray-600 text-xs ml-auto">
                        {n.published_at ? new Date(n.published_at).toLocaleDateString('ru', { day: 'numeric', month: 'long' }) : ''}
                      </span>
                    </div>
                    <h3 className="font-bold text-white text-base mb-1">{n.title}</h3>
                    <p className="text-gray-400 text-sm line-clamp-2">{n.body}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
