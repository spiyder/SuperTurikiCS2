// src/pages/PrivacyPage.tsx
import { ArrowLeft, ShieldCheck } from 'lucide-react';

interface Props { onBack: () => void; }

export function PrivacyPage({ onBack }: Props) {
  return (
    <div className="min-h-screen bg-dark-300 text-white">
      <header className="bg-dark-100/95 backdrop-blur-md border-b border-dark-50 sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center gap-4">
          <button onClick={onBack} className="text-gray-400 hover:text-white flex items-center gap-1.5 text-sm">
            <ArrowLeft className="w-4 h-4" /> Назад
          </button>
          <div className="h-5 w-px bg-dark-50" />
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary-500" />
            <span className="font-display font-bold text-white">Политика конфиденциальности</span>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-10 space-y-8 text-gray-300 leading-relaxed">
        <p className="text-gray-500 text-sm">Последнее обновление: 17 июня 2026</p>

        <section>
          <h2 className="font-display font-bold text-xl text-white mb-3">1. Какие данные мы собираем</h2>
          <p className="mb-2">При регистрации мы собираем: email, никнейм, аватар (если используется вход через Steam или Google). При входе через Steam дополнительно сохраняется Steam ID и публичная игровая статистика CS2.</p>
          <p>Мы не запрашиваем доступ к инвентарю, друзьям или истории покупок Steam — только публичный профиль и статистику игры.</p>
        </section>

        <section>
          <h2 className="font-display font-bold text-xl text-white mb-3">2. Как мы используем данные</h2>
          <p className="mb-2">Собранные данные используются для: идентификации в турнирах, отображения статистики в профиле, отправки уведомлений о матчах на email, обеспечения работы команд и лобби.</p>
          <p>Мы не продаём и не передаём твои данные третьим лицам в маркетинговых целях.</p>
        </section>

        <section>
          <h2 className="font-display font-bold text-xl text-white mb-3">3. Хранение данных</h2>
          <p>Данные хранятся на серверах Supabase с использованием политик безопасности на уровне строк (Row Level Security). Доступ к личным данным имеют только сам пользователь и администрация платформы в рамках модерации.</p>
        </section>

        <section>
          <h2 className="font-display font-bold text-xl text-white mb-3">4. Email уведомления</h2>
          <p>Если ты состоишь в команде, участвующей в матче, мы отправляем напоминание на email за час до начала. Отказаться от уведомлений можно покинув команду или удалив аккаунт.</p>
        </section>

        <section>
          <h2 className="font-display font-bold text-xl text-white mb-3">5. Файлы cookie</h2>
          <p>Платформа использует технические cookie для поддержания сессии авторизации. Мы не используем сторонние трекеры или рекламные cookie.</p>
        </section>

        <section>
          <h2 className="font-display font-bold text-xl text-white mb-3">6. Удаление данных</h2>
          <p>Для удаления аккаунта и всех связанных данных обратись в поддержку через Discord или форму баг-репорта с темой «Удаление аккаунта». Запрос обрабатывается в течение 7 дней.</p>
        </section>

        <section>
          <h2 className="font-display font-bold text-xl text-white mb-3">7. Изменения политики</h2>
          <p>При существенных изменениях данной политики пользователи будут уведомлены через раздел «Новости» на платформе.</p>
        </section>

        <div className="pt-6 border-t border-dark-50 text-gray-500 text-sm">
          Вопросы по обработке данных — обращайся через Discord или форму баг-репорта.
        </div>
      </div>
    </div>
  );
}
