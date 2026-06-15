// src/lib/maps.ts
// Маппулы по формату турнира

export type MatchFormat = '1v1' | '2v2' | '5v5';

export interface MapInfo {
  name: string;
  displayName: string;
  gradient: string;
}

export const MAPS_BY_FORMAT: Record<MatchFormat, MapInfo[]> = {
  '1v1': [
    { name: 'aim_map', displayName: 'Aim Map', gradient: 'linear-gradient(135deg,#e05c1a,#8b2a00)' },
  ],
  '2v2': [
    { name: 'de_nuke',           displayName: 'Nuke',           gradient: 'linear-gradient(135deg,#8bc2c2,#2e8b8b)' },
    { name: 'de_inferno',        displayName: 'Inferno',        gradient: 'linear-gradient(135deg,#c27a3a,#8b4a0a)' },
    { name: 'de_dust2_wingman',  displayName: 'Dust2 Wingman',  gradient: 'linear-gradient(135deg,#d4a96a,#9c6a2e)' },
    { name: 'de_mirage_wingman', displayName: 'Mirage Wingman', gradient: 'linear-gradient(135deg,#c2a46b,#8b6914)' },
    { name: 'de_train_wingman',  displayName: 'Train Wingman',  gradient: 'linear-gradient(135deg,#7a8c9e,#3a4a5a)' },
    { name: 'de_anubis_wingman', displayName: 'Anubis Wingman', gradient: 'linear-gradient(135deg,#c2956b,#8b5a14)' },
    { name: 'de_overpass',       displayName: 'Overpass',       gradient: 'linear-gradient(135deg,#6b9ec2,#2e6e9c)' },
  ],
  '5v5': [
    { name: 'de_mirage',   displayName: 'Mirage',   gradient: 'linear-gradient(135deg,#c2a46b,#8b6914)' },
    { name: 'de_dust2',    displayName: 'Dust2',    gradient: 'linear-gradient(135deg,#d4a96a,#9c6a2e)' },
    { name: 'de_overpass', displayName: 'Overpass', gradient: 'linear-gradient(135deg,#6b9ec2,#2e6e9c)' },
    { name: 'de_anubis',   displayName: 'Anubis',   gradient: 'linear-gradient(135deg,#c2956b,#8b5a14)' },
    { name: 'de_inferno',  displayName: 'Inferno',  gradient: 'linear-gradient(135deg,#c27a3a,#8b4a0a)' },
    { name: 'de_ancient',  displayName: 'Ancient',  gradient: 'linear-gradient(135deg,#7ec286,#2e8b40)' },
    { name: 'de_nuke',     displayName: 'Nuke',     gradient: 'linear-gradient(135deg,#8bc2c2,#2e8b8b)' },
  ],
};

// Порядок вето по формату
// 1v1: aim_map — там только одна карта, сразу играют
// 2v2: 7 карт — к1 бан, к2 бан, к1 бан, к2 бан, к1 бан, к2 пик → децайдер
// 5v5: 7 карт — к1 бан, к2 бан, к1 бан, к2 бан, к1 бан, к2 пик → децайдер

export interface VetoStep {
  team: 'team1' | 'team2';
  action: 'ban' | 'pick';
  label: string;
}

export const VETO_ORDER_BY_FORMAT: Record<MatchFormat, VetoStep[]> = {
  '1v1': [], // нет вето — одна карта
  '2v2': [
    { team: 'team1', action: 'ban',  label: 'банит' },
    { team: 'team2', action: 'ban',  label: 'банит' },
    { team: 'team1', action: 'ban',  label: 'банит' },
    { team: 'team2', action: 'ban',  label: 'банит' },
    { team: 'team1', action: 'ban',  label: 'банит' },
    { team: 'team2', action: 'pick', label: 'выбирает' },
  ],
  '5v5': [
    { team: 'team1', action: 'ban',  label: 'банит' },
    { team: 'team2', action: 'ban',  label: 'банит' },
    { team: 'team1', action: 'ban',  label: 'банит' },
    { team: 'team2', action: 'ban',  label: 'банит' },
    { team: 'team1', action: 'ban',  label: 'банит' },
    { team: 'team2', action: 'pick', label: 'выбирает' },
  ],
};

export function getFormatLabel(format: MatchFormat): string {
  return { '1v1': '1v1 (Duel)', '2v2': '2v2 (Wingman)', '5v5': '5v5 (Competitive)' }[format];
}

export function getPlayersPerTeam(format: MatchFormat): number {
  return { '1v1': 1, '2v2': 2, '5v5': 5 }[format];
}
