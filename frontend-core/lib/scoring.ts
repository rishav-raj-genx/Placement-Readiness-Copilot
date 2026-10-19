import type { CoCurricularProfile } from '@/types';

export function scoreCoCurricular(evidence: CoCurricularProfile): number {
  const hackathonPoints = Math.min(3, Math.max(0, evidence.hackathonsCount)) / 3 * 35;
  const certificationPoints = Math.min(3, Math.max(0, evidence.certificationsCount)) / 3 * 35;
  const leadershipPoints = evidence.clubLeadership ? 30 : 0;
  return Math.round((hackathonPoints + certificationPoints + leadershipPoints) * 100) / 100;
}
