// src/pages/FaqPage.tsx
import { useState } from 'react';
import { ArrowLeft, Search, ChevronDown } from 'lucide-react';

interface FaqItem { cat: string; q: string; a: string; }

const FAQ: FaqItem[] = [
  { cat: 'tournament', q: 'Как зарегистрироваться на турнир?', a: 'Зайди на страницу нужного турнира и нажми кнопку «Участвовать». Для участия нужна команда — создай её в профиле во вкладке «Моя команда» или попроси капитана добавить тебя.' },
  { cat: 'tournament', q: 'Как создать команду?', a: 'Перейди в профиль → вкладка «Моя команда» → кнопка «Создать команду». Укажи название, тег до 5 символов и описание. После создания ты становишься капитаном и можешь добавлять игроков.' },
  { cat: 'tournament', q: 'Можно ли участвовать в нескольких турнирах одновременно?', a: 'Да, одна команда может быть зарегистрирована на несколько активных турниров при условии что расписание матчей не пересекается.' },
  { cat: 'tournament', q: 'Какие форматы турниров доступны?', a: 'На платформе доступны три формата: 1v1 (Duel) на карте aim_map, 2v2 (Wingman) с пулом из 7 карт, и 5v5 (Competitive) со стандартным пулом из 7 карт. Формат указан в описании каждого турнира.' },
  { cat: 'lobby', q: 'Что делать когда открылось лобби?', a: 'Зайди на страницу турнира и нажми «Войти в лобби». После того как все игроки зайдут, судья запустит подтверждение готовности — нажми «Я готов». Затем начнётся вето карт, капитаны банят и пикают карты по очереди.' },
  { cat: 'lobby', q: 'Что такое вето карт?', a: 'Вето — это процесс выбора карты для матча. Капитаны команд по очереди банят карты из пула. Последняя оставшаяся карта становится децайдером. В форматах 5v5 и 2v2 пул состоит из 7 карт, в 1v1 карта фиксирована.' },
  { cat: 'lobby', q: 'Сколько времени есть на бан или пик карты?', a: 'На каждое действие в вето отводится 30 секунд. Если капитан не успел выбрать — система забанит случайную доступную карту автоматически.' },
  { cat: 'lobby', q: 'Что значат фазы лобби?', a: 'Лобби проходит через несколько фаз: «Открыто» — игроки заходят, «Готовность» — каждый подтверждает что готов, «Вето» — выбор карты, «Матч» — идёт игра. Переход между фазами делает судья через панель управления.' },
  { cat: 'team', q: 'Как добавить игрока в команду?', a: 'Только капитан может добавлять участников. Перейди на страницу команды → вкладка «Состав» → введи email игрока в поле «Добавить игрока». Игрок должен быть зарегистрирован на платформе.' },
  { cat: 'team', q: 'Можно ли состоять в двух командах?', a: 'Нет, каждый игрок может быть только в одной команде. Чтобы вступить в новую — сначала нужно покинуть текущую через кнопку «Покинуть» на странице команды.' },
  { cat: 'account', q: 'Как привязать Steam аккаунт?', a: 'Зайди в профиль. Если Steam ещё не привязан, в разделе «Обзор» появится кнопка «Привязать Steam». После авторизации аватар и статистика CS2 подтянутся автоматически.' },
  { cat: 'account', q: 'Почему не отображается статистика CS2?', a: 'Убедись что в настройках Steam в разделе «Конфиденциальность» пункт «Подробности игры» установлен на «Открытый». Закрытый профиль блокирует доступ к статистике.' },
  { cat: 'account', q: 'Могу ли я обнулить свою статистику?', a: 'Обнулить личную статистику невозможно. Данные берутся напрямую из Steam и обновляются автоматически при каждом обновлении страницы профиля.' },
  { cat: 'account', q: 'Как пожаловаться на игрока?', a: 'Зайди в профиль → в разделе друзей найди игрока и нажми кнопку жалобы. Либо напиши в поддержку через Discord. Жалобы рассматриваются модераторами в течение 24 часов.' },
];

const CAT_LABEL: Record<string, string> = { tournament: 'Турниры', team: 'Команды', lobby: 'Лобби', account: 'Аккаунт' };
const CATS = ['tournament', 'team', 'lobby', 'account'];

interface Props { onBack: () => void; }

export function FaqPage({ onBack }: Props) {
  const [search, setSearch]   = useState('');
  const [cat, setCat]         = useState('all');
  const [open, setOpen]       = useState<string | null>(null);

  const toggle = (id: string) => setOpen(prev => prev === id ? null : id);

  const filtered = FAQ.filter(f => {
    const matchCat    = cat === 'all' || f.cat === cat;
    const matchSearch = !search || f.q.toLowerCase().includes(search.toLowerCase()) || f.a.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const groupedCats = cat === 'all' ? CATS : [cat];

  return (
    <div className="min-h-screen bg-dark-300 text-white">
      <header className="bg-dark-100/95 backdrop-blur-md border-b border-dark-50 sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center gap-4">
          <button onClick={onBack} className="text-gray-400 hover:text-white flex items-center gap-1.5 text-sm">
            <ArrowLeft className="w-4 h-4" /> Назад
          </button>
          <div className="h-5 w-px bg-dark-50" />
          <span className="font-display font-bold text-white">Часто задаваемые вопросы</span>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск по вопросам..."
            className="w-full bg-dark-100 border border-dark-50 rounded-xl pl-9 pr-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-primary-500" />
        </div>

        {/* Category filter */}
        <div className="flex gap-2 flex-wrap">
          {(['all', ...CATS] as const).map(c => (
            <button key={c} onClick={() => setCat(c)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all border ${
                cat === c ? 'bg-primary-500 text-white border-primary-500' : 'bg-dark-100 border-dark-50 text-gray-400 hover:text-white'
              }`}>
              {c === 'all' ? 'Все' : CAT_LABEL[c]}
            </button>
          ))}
        </div>

        {/* FAQ groups */}
        {groupedCats.map(c => {
          const items = filtered.filter(f => f.cat === c);
          if (!items.length) return null;
          return (
            <div key={c}>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3 px-1">{CAT_LABEL[c]}</p>
              <div className="space-y-2">
                {items.map((f, i) => {
                  const id = `${c}-${i}`;
                  const isOpen = open === id;
                  return (
                    <div key={id} className={`bg-dark-100 border rounded-xl overflow-hidden transition-all ${isOpen ? 'border-primary-500/30' : 'border-dark-50'}`}>
                      <button onClick={() => toggle(id)}
                        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left">
                        <span className={`text-sm font-medium ${isOpen ? 'text-primary-400' : 'text-white'}`}>{f.q}</span>
                        <ChevronDown className={`w-4 h-4 shrink-0 text-gray-500 transition-transform ${isOpen ? 'rotate-180 text-primary-400' : ''}`} />
                      </button>
                      {isOpen && (
                        <div className="px-5 pb-4 text-sm text-gray-400 leading-relaxed border-t border-dark-50 pt-3">
                          {f.a}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-16 text-gray-500">
            <Search className="w-10 h-10 mx-auto mb-3 text-gray-700" />
            <p>Ничего не найдено</p>
          </div>
        )}
      </div>
    </div>
  );
}
