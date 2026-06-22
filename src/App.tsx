  // App.tsx — diff от оригинала
  // Изменения:
  //   1. Импорт TournamentPage
  //   2. Состояние selectedTournament
  //   3. Кнопка "Участвовать" открывает TournamentPage
  //   4. Условный рендер TournamentPage
  //
  // Ниже — ПОЛНЫЙ обновлённый файл App.tsx
  
  import { useState, useEffect } from 'react';
  import {
    Trophy, Users, Gamepad2, Zap, Shield, Target, Crown, Star,
    ChevronRight, Menu, X, Play, Calendar, Award, TrendingUp,
    MessageCircle, Send,
  } from 'lucide-react';
  import { supabase } from './lib/supabase';
  import { AuthModal } from './components/AuthModal';
  import { AdminPage } from './pages/AdminPage';
  import { ProfileDropdown } from './components/ProfileDropdown';
  import { ProfilePage } from './pages/ProfilePage';
  import { TournamentPage } from './pages/TournamentPage';
import { MatchLobbyPage } from './pages/MatchLobbyPage';
import { DirectLobbyWrapper } from './components/DirectLobbyWrapper';
import { QuickLobbyPage } from './pages/QuickLobbyPage';
import { NewsPage } from './pages/NewsPage';
import { LfgPage } from './pages/LfgPage';
import { TeamPage } from './pages/TeamPage';
import { BugReportPage } from './pages/BugReportPage';
import { RulesPage } from './pages/RulesPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { SupportChat } from './components/SupportChat';
import { NotificationsBell } from './components/NotificationsBell';
import { FaqPage } from './pages/FaqPage'; // ← НОВЫЙ ИМПОРТ
  import { useSteamAuth } from './hooks/useSteamAuth';
  import type { User as SupabaseUser } from '@supabase/supabase-js';
  
  const ADMIN_EMAIL = 'penisnegra123666228@gmail.com';
  
  interface Tournament {
    id: number;
    name: string;
    date: string;
    prize: string;
    slots_taken: number;
    slots_total: number;
    status: string;
  }
  
  interface SiteStats {
    players_count: string;
    tournaments_count: string;
    prize_pool: string;
    support: string;
  }
  
  function App() {
    useSteamAuth(); // ← добавь сюда
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const [activeTab, setActiveTab] = useState<'player' | 'captain' | 'manager'>('player');
    const [authOpen, setAuthOpen] = useState(false);
    const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
    const [user, setUser] = useState<SupabaseUser | null>(null);
    const [tournaments, setTournaments] = useState<Tournament[]>([]);
    const [siteStats, setSiteStats] = useState<SiteStats>({
      players_count: '10,000+', tournaments_count: '500+', prize_pool: '1M+', support: '24/7'
    });
    const [showProfile, setShowProfile] = useState(false);
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
    const [directLobbyId, setDirectLobbyId] = useState<string | null>(null);
    const [showQuickLobby, setShowQuickLobby] = useState(false);
    const [showNews, setShowNews] = useState(false);
    const [showFaq, setShowFaq] = useState(false);
    const [showLfg, setShowLfg] = useState(false);
    const [showTeam, setShowTeam] = useState(false);
    const [showBugReport, setShowBugReport] = useState(false);
    const [showRules, setShowRules] = useState(false);
    const [showPrivacy, setShowPrivacy] = useState(false);
  
    useEffect(() => {
      const params = new URLSearchParams(window.location.search);
      const lobbyParam = params.get('lobby');
      if (lobbyParam) setDirectLobbyId(lobbyParam);
      const qlobbyParam = params.get('qlobby');
      if (qlobbyParam) setShowQuickLobby(true);
    }, []);

    useEffect(() => {
      const handleScroll = () => setScrolled(window.scrollY > 50);
      window.addEventListener('scroll', handleScroll);
      return () => window.removeEventListener('scroll', handleScroll);
    }, []);
  
    useEffect(() => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setUser(session?.user ?? null);
        if (session?.user) loadUserAvatar(session.user.id);
      });
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
        setUser(session?.user ?? null);
        if (session?.user) loadUserAvatar(session.user.id);
      });
      return () => subscription.unsubscribe();
    }, []);
 
  useEffect(() => {
    loadTournaments();
    loadStats();
  }, []);
 
  const loadUserAvatar = async (userId: string) => {
    const { data } = await supabase.from('profiles').select('avatar_url').eq('id', userId).single();
    if (data?.avatar_url) setAvatarUrl(data.avatar_url);
  };
 
  const loadTournaments = async () => {
    const { data } = await supabase.from('tournaments').select('*').neq('status', 'finished').order('created_at', { ascending: false }).limit(3);
    if (data && data.length > 0) setTournaments(data);
  };
 
  const loadStats = async () => {
    const { data } = await supabase.from('site_stats').select('*').single();
    if (data) setSiteStats(data);
  };
 
  const isAdmin = user?.email === ADMIN_EMAIL;
 
  const openLogin = () => { setAuthMode('login'); setAuthOpen(true); };
  const openRegister = () => { setAuthMode('register'); setAuthOpen(true); };
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setAvatarUrl(null);
    setShowProfile(false);
    setSelectedTournament(null); // ← НОВОЕ
  };
  const getUserName = () => user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Игрок';
 
  if (showQuickLobby) return (
    <QuickLobbyPage lobbyId={new URLSearchParams(window.location.search).get('qlobby') ?? undefined} />
  );
  if (directLobbyId) return (
    <DirectLobbyWrapper
      matchId={directLobbyId}
      user={user}
      onBack={() => { setDirectLobbyId(null); window.history.replaceState({}, '', '/'); }}
    />
  );
  if (isAdmin) return <AdminPage onLogout={handleLogout} />;
  if (showNews) return <NewsPage onBack={() => setShowNews(false)} />;
  if (showFaq)  return <FaqPage  onBack={() => setShowFaq(false)}  />;
  if (showLfg)  return <LfgPage  user={user} onBack={() => setShowLfg(false)} onOpenLogin={openLogin} />;
  if (showTeam && user) return <TeamPage user={user} onBack={() => setShowTeam(false)} showToast={(msg) => console.log(msg)} />;
  if (showBugReport) return <BugReportPage user={user} onBack={() => setShowBugReport(false)} onOpenLogin={openLogin} />;
  if (showRules)   return <RulesPage   onBack={() => setShowRules(false)} />;
  if (showPrivacy) return <PrivacyPage onBack={() => setShowPrivacy(false)} />;
  if (showProfile && user) return <ProfilePage user={user} onBack={() => setShowProfile(false)} onAvatarChange={(url) => setAvatarUrl(url)} />;
  if (selectedTournament) return (
    <TournamentPage
      tournament={selectedTournament}
      user={user}
      onBack={() => setSelectedTournament(null)}
      onOpenLogin={openLogin}
    />
  );
 
  const displayTournaments = tournaments.length > 0 ? tournaments : [
    { id: 1, name: 'LEAGUE OPEN QUALIFIER', date: '15 июня в 19:00 МСК', prize: '50,000 ₽', slots_taken: 64, slots_total: 128, status: 'open' },
    { id: 2, name: 'PRO SERIES #3', date: '20 июня в 20:00 МСК', prize: '100,000 ₽', slots_taken: 32, slots_total: 64, status: 'soon' },
    { id: 3, name: 'AMATEUR CUP', date: '25 июня в 18:00 МСК', prize: '25,000 ₽', slots_taken: 89, slots_total: 128, status: 'open' },
  ];
 
  const features = [
    { icon: Trophy, title: 'Турниры каждый день', description: 'Участвуй в ежедневных турнирах с призовым фондом и получай опыт.' },
    { icon: Users, title: 'Поиск команды', description: 'Находи единомышленников и создавай сильнейшие составы.' },
    { icon: TrendingUp, title: 'Рейтинг и статистика', description: 'Отслеживай свой прогресс и сравнивай с другими игроками.' },
    { icon: Shield, title: 'Защита от читеров', description: 'Продвинутая система античита для честной игры.' },
  ];
 
  const steps = [
    { number: '01', title: 'Зарегистрируйся', description: 'Создай аккаунт за 30 секунд через Steam или email.' },
    { number: '02', title: 'Собери команду', description: 'Используй поиск игроков или вступи в готовую команду.' },
    { number: '03', title: 'Участвуй в турнирах', description: 'Регистрируйся на турниры, играй матчи и выигрывай призы.' },
  ];
 
  const roles = [
    { id: 'player' as const, icon: Target, title: 'Игрок', description: 'Если ты хочешь сиять на сцене — это для тебя. Показывай свои навыки, побеждай и становись легендой.' },
    { id: 'captain' as const, icon: Crown, title: 'Капитан', description: 'Мозг команды всегда на месте. Веди свою команду к победе, разрабатывай тактики и мотивируй тиммейтов.' },
    { id: 'manager' as const, icon: Award, title: 'Менеджер', description: 'Управляй командой, найди спонсоров и построй карьеру своих игроков.' },
  ];
 
  return (
    <div className="min-h-screen bg-dark-300">
      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} initialMode={authMode} />
 
      {/* Header */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-dark-100/95 backdrop-blur-md shadow-lg' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 md:h-20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg flex items-center justify-center">
                <Gamepad2 className="w-6 h-6 text-white" />
              </div>
              <span className="font-display font-bold text-xl md:text-2xl text-white">
                Super<span className="text-primary-500">Turiki</span>CS2
              </span>
            </div>
            <nav className="hidden md:flex items-center gap-5 flex-wrap">
              <a href="#tournaments" className="text-gray-300 hover:text-primary-500 transition-colors">Турниры</a>
              <a href="#features" className="text-gray-300 hover:text-primary-500 transition-colors">Возможности</a>
              <button onClick={() => setShowNews(true)} className="text-gray-300 hover:text-primary-500 transition-colors">Новости</button>
              <button onClick={() => setShowLfg(true)} className="text-gray-300 hover:text-primary-500 transition-colors">LFG</button>
              <button onClick={() => { setShowQuickLobby(true); window.history.replaceState({}, '', '?quicklobby'); }} className="text-gray-300 hover:text-primary-500 transition-colors">Быстрое лобби</button>
              {user && <button onClick={() => setShowTeam(true)} className="text-gray-300 hover:text-primary-500 transition-colors">Команда</button>}
              <button onClick={() => setShowFaq(true)} className="text-gray-300 hover:text-primary-500 transition-colors">FAQ</button>
              <a href="#how-it-works" className="text-gray-300 hover:text-primary-500 transition-colors">Как это работает</a>
              <a href="#community" className="text-gray-300 hover:text-primary-500 transition-colors">Сообщество</a>
            </nav>
            <div className="hidden md:flex items-center gap-4">
              {user ? (
                <>
                  <NotificationsBell user={user} onTeamJoined={() => setShowTeam(false)} />
                  <ProfileDropdown user={user} avatarUrl={avatarUrl} onLogout={handleLogout} onOpenProfile={() => setShowProfile(true)} />
                </>
              ) : (
                <>
                  <button onClick={openLogin} className="text-gray-300 hover:text-white transition-colors">Войти</button>
                  <button onClick={openRegister} className="btn-primary">Регистрация</button>
                </>
              )}
            </div>
            <button className="md:hidden text-white" onClick={() => setIsMenuOpen(!isMenuOpen)}>
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
 
        {isMenuOpen && (
          <div className="md:hidden bg-dark-100 border-t border-dark-50">
            <div className="px-4 py-4 space-y-4">
              <a href="#tournaments" className="block text-gray-300 hover:text-primary-500">Турниры</a>
              <a href="#features" className="block text-gray-300 hover:text-primary-500">Возможности</a>
              <button onClick={() => { setShowNews(true); setIsMenuOpen(false); }} className="block text-gray-300 hover:text-primary-500">Новости</button>
              <button onClick={() => { setShowLfg(true); setIsMenuOpen(false); }} className="block text-gray-300 hover:text-primary-500">LFG</button>
              {user && <button onClick={() => { setShowTeam(true); setIsMenuOpen(false); }} className="block text-gray-300 hover:text-primary-500">Команда</button>}
              <button onClick={() => { setShowFaq(true); setIsMenuOpen(false); }} className="block text-gray-300 hover:text-primary-500">FAQ</button>
              <a href="#how-it-works" className="block text-gray-300 hover:text-primary-500">Как это работает</a>
              <a href="#community" className="block text-gray-300 hover:text-primary-500">Сообщество</a>
              <div className="pt-4 border-t border-dark-50 flex gap-4">
                {user ? (
                  <>
                    <button onClick={() => { setIsMenuOpen(false); setShowProfile(true); }} className="flex-1 py-2 text-gray-300 hover:text-white text-center">Мой профиль</button>
                    <button onClick={handleLogout} className="flex-1 py-2 text-gray-300 hover:text-white text-center">Выйти</button>
                  </>
                ) : (
                  <>
                    <button onClick={openLogin} className="flex-1 py-2 text-gray-300 hover:text-white">Войти</button>
                    <button onClick={openRegister} className="flex-1 btn-primary text-center">Регистрация</button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </header>
 
      {/* Hero */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-dark-400 via-dark-300 to-dark-200" />
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-primary-600/10 rounded-full blur-3xl" />
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: `radial-gradient(circle at 2px 2px, rgba(249,115,22,0.15) 1px, transparent 0)`, backgroundSize: '40px 40px' }} />
        </div>
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="animate-float mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500/10 border border-primary-500/30 rounded-full">
              <span className="w-2 h-2 bg-primary-500 rounded-full animate-pulse" />
              <span className="text-primary-400 text-sm font-medium">Open Beta — открытая бета</span>
            </div>
          </div>
          <h1 className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight">
            Киберспортивная платформа<br />
            <span className="text-gradient">нового поколения</span>
          </h1>
          <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-10">
            Участвуй в турнирах CS2, создавай команды и соревнуйся с лучшими игроками СНГ. Платформа для тех, кто играет на победу.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <button onClick={user ? () => setShowProfile(true) : openRegister} className="btn-primary flex items-center gap-2 text-lg px-8 py-4">
              <Play className="w-5 h-5" />
              {user ? `Привет, ${getUserName()}!` : 'Начать играть'}
            </button>
            <button className="btn-outline flex items-center gap-2 text-lg px-8 py-4">
              Узнать больше <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto">
            {[
              { value: siteStats.players_count, label: 'Игроков' },
              { value: siteStats.tournaments_count, label: 'Турниров' },
              { value: siteStats.prize_pool, label: 'Призовой фонд' },
              { value: siteStats.support, label: 'Поддержка' },
            ].map((stat, idx) => (
              <div key={idx} className="text-center">
                <div className="font-display text-2xl md:text-3xl font-bold text-primary-500">{stat.value}</div>
                <div className="text-gray-500 text-sm">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
          <div className="w-6 h-10 border-2 border-gray-600 rounded-full flex items-start justify-center p-2">
            <div className="w-1 h-2 bg-primary-500 rounded-full animate-bounce" />
          </div>
        </div>
      </section>
 
      {/* Tournaments */}
      <section id="tournaments" className="py-20 md:py-32 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="text-primary-500 font-semibold text-sm uppercase tracking-wider">Активные турниры</span>
            <h2 className="section-title mt-2">Ближайшие турниры</h2>
            <p className="text-gray-400 max-w-2xl mx-auto">Выбери турнир и начни свой путь к победе уже сегодня</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayTournaments.map((tournament) => (
              // ← ИЗМЕНЕНО: весь onClick теперь открывает TournamentPage
              <div
                key={tournament.id}
                className="card group cursor-pointer hover:transform hover:-translate-y-1"
                onClick={() => setSelectedTournament(tournament)}
              >
                <div className="flex items-center justify-between mb-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${tournament.status === 'open' ? 'bg-green-500/20 text-green-400' : 'bg-primary-500/20 text-primary-400'}`}>
                    {tournament.status === 'open' ? 'Открыта регистрация' : 'Скоро'}
                  </span>
                  <Trophy className="w-5 h-5 text-primary-500" />
                </div>
                <h3 className="font-display text-xl font-bold text-white mb-3 group-hover:text-primary-500 transition-colors">{tournament.name}</h3>
                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-gray-400 text-sm"><Calendar className="w-4 h-4 text-primary-500" />{tournament.date}</div>
                  <div className="flex items-center gap-2 text-gray-400 text-sm"><Award className="w-4 h-4 text-primary-500" />Призовой фонд: {tournament.prize}</div>
                  <div className="flex items-center gap-2 text-gray-400 text-sm"><Users className="w-4 h-4 text-primary-500" />Слотов: {tournament.slots_taken}/{tournament.slots_total}</div>
                </div>
                {/* Progress bar */}
                <div className="h-1.5 bg-dark-50 rounded-full mb-4 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary-500 transition-all"
                    style={{ width: `${Math.round((tournament.slots_taken / tournament.slots_total) * 100)}%` }}
                  />
                </div>
                <button
                  className="w-full btn-primary"
                  onClick={e => { e.stopPropagation(); setSelectedTournament(tournament); }}
                >
                  {user ? 'Подробнее / Участвовать' : 'Подробнее'}
                </button>
              </div>
            ))}
          </div>
          <div className="text-center mt-10">
            <button className="btn-outline flex items-center gap-2 mx-auto">Все турниры <ChevronRight className="w-5 h-5" /></button>
          </div>
        </div>
      </section>
 
      {/* Features */}
      <section id="features" className="py-20 md:py-32 bg-dark-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="text-primary-500 font-semibold text-sm uppercase tracking-wider">Почему мы</span>
            <h2 className="section-title mt-2">Экосистема, а не сервис</h2>
            <p className="text-gray-400 max-w-3xl mx-auto text-lg">SuperTurikiCS2 — это не просто киберспортивная платформа, а целая экосистема, объединяющая игроков, тренеров, организаторов и бренды.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, idx) => (
              <div key={idx} className="card text-center hover:bg-dark-100 group">
                <div className="w-16 h-16 bg-gradient-to-br from-primary-500/20 to-primary-600/20 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:from-primary-500/30 group-hover:to-primary-600/30 transition-all">
                  <feature.icon className="w-8 h-8 text-primary-500" />
                </div>
                <h3 className="font-display font-bold text-lg text-white mb-2">{feature.title}</h3>
                <p className="text-gray-400 text-sm">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
 
      {/* How it works */}
      <section id="how-it-works" className="py-20 md:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="text-primary-500 font-semibold text-sm uppercase tracking-wider">Старт</span>
            <h2 className="section-title mt-2">Как это работает</h2>
            <p className="text-gray-400 max-w-2xl mx-auto">Три простых шага до первого турнира</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((step, idx) => (
              <div key={idx} className="relative">
                {idx < steps.length - 1 && <div className="hidden md:block absolute top-12 left-full w-full h-0.5 bg-gradient-to-r from-primary-500/50 to-transparent" />}
                <div className="text-center">
                  <div className="w-24 h-24 bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-primary-500/30">
                    <span className="font-display text-3xl font-bold text-white">{step.number}</span>
                  </div>
                  <h3 className="font-display text-xl font-bold text-white mb-3">{step.title}</h3>
                  <p className="text-gray-400">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
 
      {/* Roles */}
      <section className="py-20 md:py-32 bg-dark-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="text-primary-500 font-semibold text-sm uppercase tracking-wider">Роли</span>
            <h2 className="section-title mt-2">Ты можешь стать кем захочешь</h2>
            <p className="text-gray-400 max-w-2xl mx-auto">На SuperTurikiCS2 нет одной роли — ты сам выбираешь, кем быть</p>
          </div>
          <div className="flex justify-center mb-8">
            <div className="bg-dark-100 rounded-full p-1.5 flex gap-1">
              {roles.map((role) => (
                <button key={role.id} onClick={() => setActiveTab(role.id)}
                  className={`px-6 py-3 rounded-full font-medium transition-all ${activeTab === role.id ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/30' : 'text-gray-400 hover:text-white'}`}>
                  {role.title}
                </button>
              ))}
            </div>
          </div>
          <div className="max-w-2xl mx-auto">
            {roles.map((role) => (
              <div key={role.id} className={`transition-all duration-300 ${activeTab === role.id ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 hidden'}`}>
                <div className="card">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center">
                      <role.icon className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="font-display text-2xl font-bold text-white">{role.title}</h3>
                  </div>
                  <p className="text-gray-300 text-lg">{role.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
 
      {/* Community */}
      <section id="community" className="py-20 md:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="text-primary-500 font-semibold text-sm uppercase tracking-wider">Связь</span>
            <h2 className="section-title mt-2">Сообщество</h2>
            <p className="text-gray-400 max-w-2xl mx-auto">Мы там, где игроки</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: Play, name: 'Twitch', desc: 'Смотри турниры вживую', color: '#9146FF', href: 'https://www.twitch.tv/fatemchik' },
              { icon: MessageCircle, name: 'Discord', desc: 'Общайся с сообществом', color: '#5865F2', href: 'https://discord.gg/mf4DhqrH5v' },
              { icon: Send, name: 'Telegram', desc: 'Новости и анонсы', color: '#0088cc', href: 'https://t.me/superturikiCS2' },
            ].map((platform, idx) => (
              <a key={idx} href={platform.href} target="_blank" rel="noopener noreferrer" className="card flex items-center gap-4 cursor-pointer hover:border-primary-500/50 group">
                <div className="w-14 h-14 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110" style={{ backgroundColor: `${platform.color}20` }}>
                  <platform.icon className="w-7 h-7" style={{ color: platform.color }} />
                </div>
                <div>
                  <h3 className="font-bold text-white group-hover:text-primary-500 transition-colors">{platform.name}</h3>
                  <p className="text-gray-400 text-sm">{platform.desc}</p>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>
 
      {/* CTA */}
      <section className="py-20 md:py-32 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-primary-600/20 via-dark-300 to-dark-400" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary-500/10 rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 mb-6">
            <Star className="w-5 h-5 text-primary-500" />
            <Star className="w-6 h-6 text-primary-500" />
            <Star className="w-5 h-5 text-primary-500" />
          </div>
          <h2 className="font-display text-3xl md:text-5xl font-bold text-white mb-6">Готов начать?</h2>
          <p className="text-lg text-gray-300 mb-8 max-w-2xl mx-auto">
            Создай аккаунт за минуту и присоединяйся к ближайшему турниру. Регистрация доступна только лицам <strong className="text-primary-500">18+</strong>.
          </p>
          {!user && (
            <>
              <button onClick={openRegister} className="btn-primary text-lg px-10 py-4 animate-pulse-glow">Зарегистрироваться бесплатно</button>
              <p className="text-gray-500 text-sm mt-6">
                Регистрируясь, вы подтверждаете, что вам исполнилось 18 лет, и принимаете{' '}
                <a href="#" className="text-primary-500 hover:underline">пользовательское соглашение</a>{' '}и{' '}
                <a href="#" className="text-primary-500 hover:underline">политику конфиденциальности</a>.
              </p>
            </>
          )}
        </div>
      </section>
 
      {/* Footer */}
      <footer className="bg-dark-200 border-t border-dark-50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div className="md:col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg flex items-center justify-center">
                  <Gamepad2 className="w-6 h-6 text-white" />
                </div>
                <span className="font-display font-bold text-xl text-white">Super<span className="text-primary-500">Turiki</span>CS2</span>
              </div>
              <p className="text-gray-400 max-w-md">Киберспортивная платформа нового поколения для турнирной игры в CS2.</p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Навигация</h4>
              <ul className="space-y-2">
                {['#tournaments:Турниры', '#features:Возможности', '#how-it-works:Как это работает', '#community:Сообщество'].map(item => {
                  const [href, label] = item.split(':');
                  return <li key={href}><a href={href} className="text-gray-400 hover:text-primary-500 transition-colors">{label}</a></li>;
                })}
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Поддержка</h4>
              <ul className="space-y-2">
                <li><button onClick={() => setShowNews(true)} className="text-gray-400 hover:text-primary-500 transition-colors">Новости</button></li>
                <li><button onClick={() => setShowFaq(true)} className="text-gray-400 hover:text-primary-500 transition-colors">FAQ</button></li>
                <li><button onClick={() => setShowRules(true)} className="text-gray-400 hover:text-primary-500 transition-colors">Правила</button></li>
                <li><button onClick={() => setShowPrivacy(true)} className="text-gray-400 hover:text-primary-500 transition-colors">Конфиденциальность</button></li>
                <li><button onClick={() => setShowBugReport(true)} className="text-gray-400 hover:text-primary-500 transition-colors">Баг-репорт</button></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-dark-50 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-gray-500 text-sm">© 2026 SuperTurikiCS2. Все права защищены.</p>
            <div className="flex items-center gap-4">
              <a href="https://www.twitch.tv/fatemchik" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-primary-500 transition-colors"><Play className="w-5 h-5" /></a>
              <a href="https://discord.gg/mf4DhqrH5v" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-primary-500 transition-colors"><MessageCircle className="w-5 h-5" /></a>
              <a href="https://t.me/superturikiCS2" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-primary-500 transition-colors"><Send className="w-5 h-5" /></a>
            </div>
          </div>
        </div>
      </footer>
 
      <SupportChat user={user} onOpenLogin={openLogin} />
    </div>
  );
}
 
export default App;