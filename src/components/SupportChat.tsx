// src/components/SupportChat.tsx
// Виджет поддержки: быстрые ответы из FAQ → если не помогло, создаёт тикет в bug_reports

import { useState, useRef, useEffect } from 'react';
import { X, Zap, Send, ChevronRight, MessageCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { User as SupabaseUser } from '@supabase/supabase-js';

interface QuickFaq { q: string; a: string; }

const QUICK_FAQ: QuickFaq[] = [
  { q: 'Как зарегистрироваться на турнир?', a: 'Зайди на страницу турнира и нажми «Участвовать». Для этого нужна команда — создай её в разделе «Команда» в навбаре.' },
  { q: 'Как создать команду?', a: 'Перейди в раздел «Команда» → кнопка «Создать команду». Укажи название и тег до 5 символов.' },
  { q: 'Как привязать Steam?', a: 'В профиле нажми кнопку «Привязать Steam» в блоке статистики CS2 — пройдёшь авторизацию через Steam.' },
  { q: 'Что такое вето карт?', a: 'Капитаны по очереди банят карты из пула, последняя оставшаяся становится децайдером. На каждое действие 30 секунд.' },
  { q: 'Не отображается статистика CS2', a: 'Проверь в настройках Steam: Конфиденциальность → «Подробности игры» должно быть «Открытый».' },
  { q: 'Как добавить игрока в команду?', a: 'Капитан вводит ник игрока в разделе команды → «Состав» → «Добавить игрока». Игроку придёт приглашение в колокольчик уведомлений.' },
];

type Step = 'menu' | 'answer' | 'ticket' | 'done';

interface Props {
  user: SupabaseUser | null;
  onOpenLogin: () => void;
}

export function SupportChat({ user, onOpenLogin }: Props) {
  const [open, setOpen]   = useState(false);
  const [step, setStep]   = useState<Step>('menu');
  const [selected, setSelected] = useState<QuickFaq | null>(null);
  const [ticketTitle, setTicketTitle] = useState('');
  const [ticketDesc, setTicketDesc]   = useState('');
  const [submitting, setSubmitting]   = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const openFaq = (faq: QuickFaq) => { setSelected(faq); setStep('answer'); };

  const goTicket = () => {
    setTicketTitle(selected?.q ?? '');
    setStep('ticket');
  };

  const submitTicket = async () => {
    if (!user) { onOpenLogin(); return; }
    if (!ticketDesc.trim()) return;
    setSubmitting(true);
    await supabase.from('bug_reports').insert({
      user_id: user.id,
      username: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Игрок',
      title: ticketTitle.trim() || 'Вопрос из чата поддержки',
      description: ticketDesc.trim(),
      severity: 'medium',
      page_url: window.location.pathname,
      status: 'open',
    });
    setSubmitting(false);
    setStep('done');
  };

  const reset = () => {
    setStep('menu'); setSelected(null); setTicketTitle(''); setTicketDesc('');
  };

  const closeWidget = () => { setOpen(false); setTimeout(reset, 300); };

  return (
    <>
      {/* FAB button */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 z-50 btn-primary flex items-center gap-2 shadow-2xl shadow-primary-500/30"
      >
        {open ? <X className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
        Поддержка
      </button>

      {/* Panel */}
      {open && (
        <div ref={panelRef}
          className="fixed bottom-24 right-6 z-50 w-[360px] max-h-[560px] bg-dark-200 border border-dark-50 rounded-2xl shadow-2xl overflow-hidden flex flex-col">

          {/* Header */}
          <div className="bg-gradient-to-r from-primary-600 to-primary-500 px-5 py-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-white" />
              <span className="font-display font-bold text-white">Поддержка</span>
            </div>
            <button onClick={closeWidget} className="text-white/80 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">

            {/* MENU — quick FAQ list */}
            {step === 'menu' && (
              <div className="space-y-3">
                <p className="text-gray-400 text-sm">Привет! Выбери вопрос или напиши свой — поможем разобраться.</p>
                <div className="space-y-2">
                  {QUICK_FAQ.map((faq, i) => (
                    <button key={i} onClick={() => openFaq(faq)}
                      className="w-full flex items-center justify-between gap-2 px-4 py-3 bg-dark-100 hover:bg-dark-50/60 border border-dark-50 rounded-xl text-left transition-colors">
                      <span className="text-sm text-gray-200">{faq.q}</span>
                      <ChevronRight className="w-4 h-4 text-gray-500 shrink-0" />
                    </button>
                  ))}
                </div>
                <button onClick={goTicket}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary-500/10 hover:bg-primary-500/20 border border-primary-500/30 rounded-xl text-primary-400 text-sm font-medium transition-colors mt-2">
                  <Send className="w-4 h-4" /> У меня другой вопрос
                </button>
              </div>
            )}

            {/* ANSWER */}
            {step === 'answer' && selected && (
              <div className="space-y-4">
                <div className="bg-dark-100 rounded-xl p-4 border border-dark-50">
                  <p className="text-white font-medium text-sm mb-2">{selected.q}</p>
                  <p className="text-gray-400 text-sm leading-relaxed">{selected.a}</p>
                </div>
                <p className="text-gray-500 text-xs text-center">Это решило проблему?</p>
                <div className="flex gap-2">
                  <button onClick={closeWidget}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 rounded-xl text-green-400 text-sm font-medium transition-colors">
                    <CheckCircle2 className="w-4 h-4" /> Да, спасибо
                  </button>
                  <button onClick={goTicket}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-dark-100 hover:bg-dark-50/60 border border-dark-50 rounded-xl text-gray-300 text-sm font-medium transition-colors">
                    Нет, нужна помощь
                  </button>
                </div>
                <button onClick={() => setStep('menu')} className="text-gray-500 text-xs hover:text-gray-300 transition-colors w-full text-center">
                  ← Назад к вопросам
                </button>
              </div>
            )}

            {/* TICKET form */}
            {step === 'ticket' && (
              <div className="space-y-4">
                <p className="text-gray-400 text-sm">Опиши проблему — мы передадим её в техподдержку и ответим как можно скорее.</p>

                {!user ? (
                  <div className="text-center py-6">
                    <p className="text-yellow-300 text-sm mb-3">Войди в аккаунт чтобы отправить обращение</p>
                    <button onClick={onOpenLogin} className="btn-primary text-sm">Войти</button>
                  </div>
                ) : (
                  <>
                    <input value={ticketTitle} onChange={e => setTicketTitle(e.target.value)} maxLength={100}
                      placeholder="Краткая тема"
                      className="w-full bg-dark-100 border border-dark-50 rounded-xl px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-primary-500" />
                    <textarea value={ticketDesc} onChange={e => setTicketDesc(e.target.value)} rows={4} maxLength={500}
                      placeholder="Расскажи подробнее, что случилось..."
                      className="w-full bg-dark-100 border border-dark-50 rounded-xl px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-primary-500 resize-none" />
                    <button onClick={submitTicket} disabled={submitting || !ticketDesc.trim()}
                      className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50">
                      {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      Отправить в поддержку
                    </button>
                  </>
                )}
                <button onClick={() => setStep('menu')} className="text-gray-500 text-xs hover:text-gray-300 transition-colors w-full text-center">
                  ← Назад к вопросам
                </button>
              </div>
            )}

            {/* DONE */}
            {step === 'done' && (
              <div className="text-center py-8">
                <div className="w-14 h-14 bg-green-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-7 h-7 text-green-400" />
                </div>
                <p className="font-display font-bold text-white text-lg mb-1">Обращение отправлено</p>
                <p className="text-gray-500 text-sm mb-5">Мы свяжемся с тобой в ближайшее время.</p>
                <button onClick={closeWidget} className="btn-primary text-sm">Закрыть</button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
