// src/pages/RulesPage.tsx
import { ArrowLeft, FileText } from 'lucide-react';

interface Props { onBack: () => void; }

export function RulesPage({ onBack }: Props) {
  return (
    <div className="min-h-screen bg-dark-300 text-white">
      <header className="bg-dark-100/95 backdrop-blur-md border-b border-dark-50 sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center gap-4">
          <button onClick={onBack} className="text-gray-400 hover:text-white flex items-center gap-1.5 text-sm">
            <ArrowLeft className="w-4 h-4" /> Назад
          </button>
          <div className="h-5 w-px bg-dark-50" />
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary-500" />
            <span className="font-display font-bold text-white">Правила использования</span>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-10 space-y-8 text-gray-300 leading-relaxed">
        <p className="text-gray-500 text-sm">Последнее обновление: 17 июня 2026</p>

        <section>
          <h2 className="font-display font-bold text-xl text-white mb-3">1. Общие положения</h2>
          <p>SuperTurikiCS2 — киберспортивная платформа для организации турниров по CS2. Используя платформу, ты соглашаешься с настоящими правилами. Регистрация доступна только лицам старше 18 лет.</p>
        </section>

        <section>
          <h2 className="font-display font-bold text-xl text-white mb-3">2. Регистрация и аккаунт</h2>
          <p className="mb-2">При регистрации ты обязуешься указывать достоверную информацию. Один человек может иметь только один аккаунт на платформе. Передача аккаунта третьим лицам запрещена.</p>
          <p>Администрация имеет право заблокировать аккаунт за нарушение правил без предварительного уведомления.</p>
        </section>

        <section>
          <h2 className="font-display font-bold text-xl text-white mb-3">3. Участие в турнирах</h2>
          <p className="mb-2">Регистрируясь на турнир, команда обязуется явиться на матч в назначенное время. Опоздание более чем на 15 минут может привести к техническому поражению по решению судьи.</p>
          <p className="mb-2">Запрещено использование читов, эксплойтов, стороннего ПО для получения нечестного преимущества. Подтверждённое использование читов влечёт дисквалификацию и блокировку аккаунта.</p>
          <p>Решение судьи в рамках турнира является финальным. Апелляции принимаются через форму баг-репорта в течение 24 часов после матча.</p>
        </section>

        <section>
          <h2 className="font-display font-bold text-xl text-white mb-3">4. Поведение на платформе</h2>
          <p className="mb-2">Запрещены: оскорбления, дискриминация, угрозы, спам, реклама сторонних сервисов в чатах, читерство, договорные матчи (match-fixing).</p>
          <p>Нарушение данных правил влечёт предупреждение, временную или постоянную блокировку в зависимости от тяжести нарушения.</p>
        </section>

        <section>
          <h2 className="font-display font-bold text-xl text-white mb-3">5. Призовые фонды</h2>
          <p>Выплата призовых производится в течение 14 рабочих дней после завершения турнира при условии прохождения верификации победителя. Платформа удерживает комиссию в размере, указанном на странице турнира.</p>
        </section>

        <section>
          <h2 className="font-display font-bold text-xl text-white mb-3">6. Ограничение ответственности</h2>
          <p>Платформа не несёт ответственности за технические проблемы на стороне игрока (интернет-соединение, неполадки игры, сбои оборудования), которые могут повлиять на результат матча.</p>
        </section>

        <section>
          <h2 className="font-display font-bold text-xl text-white mb-3">7. Изменения правил</h2>
          <p>Администрация имеет право изменять данные правила. Об существенных изменениях пользователи будут уведомлены через раздел «Новости».</p>
        </section>

        <div className="pt-6 border-t border-dark-50 text-gray-500 text-sm">
          Вопросы по правилам — обращайся через Discord или форму баг-репорта.
        </div>
      </div>
    </div>
  );
}
