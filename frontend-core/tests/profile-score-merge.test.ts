import { describe, expect, it } from 'vitest';

interface ProfileScores {
  resume: number;
  github: number;
  projects: number;
  linkedin: number;
  mock_interview: number;
}

function mergeProfileScores(
  currentScores: ProfileScores,
  newScores: { resume?: number | null; github?: number | null; linkedin?: number | null; mock_interview?: number | null }
): { updatedScores: ProfileScores; projectsScore: number; totalReadiness: number } {
  // Phase 1: Deep Merge (preserve untouched categories like GitHub)
  const updatedScores: ProfileScores = {
    resume: (typeof newScores.resume === 'number' && newScores.resume > 0)
      ? newScores.resume
      : currentScores.resume,
    github: (typeof newScores.github === 'number' && newScores.github > 0)
      ? newScores.github
      : currentScores.github,
    linkedin: (typeof newScores.linkedin === 'number' && newScores.linkedin > 0)
      ? newScores.linkedin
      : currentScores.linkedin,
    mock_interview: (typeof newScores.mock_interview === 'number' && newScores.mock_interview > 0)
      ? newScores.mock_interview
      : currentScores.mock_interview,
    projects: currentScores.projects,
  };

  // Phase 2: Derived Projects Recalculation
  const projectsScore = Math.round((updatedScores.resume + updatedScores.github) / 2);
  updatedScores.projects = projectsScore;

  // Phase 3: Global Readiness Score Sync (5 active categories)
  const totalReadiness = Math.round(
    (updatedScores.resume +
      updatedScores.github +
      projectsScore +
      updatedScores.linkedin +
      updatedScores.mock_interview) / 5
  );

  return { updatedScores, projectsScore, totalReadiness };
}

describe('Profile Score Deep Merge & Recalculation', () => {
  it('Phase 1: preserves existing GitHub score when a new resume is uploaded', () => {
    const currentScores: ProfileScores = {
      resume: 75,
      github: 80,
      projects: 78,
      linkedin: 70,
      mock_interview: 85,
    };

    const { updatedScores } = mergeProfileScores(currentScores, {
      resume: 90, // User uploaded new resume
      github: null, // Untouched / not in update
      linkedin: null,
    });

    expect(updatedScores.resume).toBe(90);
    expect(updatedScores.github).toBe(80); // Preserved!
    expect(updatedScores.linkedin).toBe(70); // Preserved!
    expect(updatedScores.mock_interview).toBe(85); // Preserved!
  });

  it('Phase 2: recalculates derived projects score from resume and github', () => {
    const currentScores: ProfileScores = {
      resume: 70,
      github: 90,
      projects: 0,
      linkedin: 60,
      mock_interview: 80,
    };

    const { updatedScores, projectsScore } = mergeProfileScores(currentScores, {
      resume: 85,
    });

    // projects = Math.round((85 + 90) / 2) = Math.round(175 / 2) = 88
    expect(projectsScore).toBe(88);
    expect(updatedScores.projects).toBe(88);
  });

  it('Phase 3: synchronizes total readiness score across all 5 active categories', () => {
    const currentScores: ProfileScores = {
      resume: 80,
      github: 70,
      projects: 75,
      linkedin: 65,
      mock_interview: 85,
    };

    // User updates resume to 90
    const { updatedScores, projectsScore, totalReadiness } = mergeProfileScores(currentScores, {
      resume: 90,
    });

    // resume: 90, github: 70 -> projectsScore: (90+70)/2 = 80
    expect(projectsScore).toBe(80);
    expect(updatedScores.projects).toBe(80);

    // totalReadiness = Math.round((90 + 70 + 80 + 65 + 85) / 5) = Math.round(390 / 5) = 78
    expect(totalReadiness).toBe(78);
  });
});
