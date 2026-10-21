'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Code2,
  FileText,
  FolderGit2,
  GitBranch,
  Linkedin,
  Mic2,
  type LucideIcon,
} from 'lucide-react';
import { motion, useReducedMotion, useScroll, useMotionValueEvent, type MotionValue } from 'framer-motion';
import {
  buildDashboardRoadmap,
  type DashboardRoadmapNode,
  type RoadmapCategory,
  type RoadmapStatus,
} from '@/lib/dashboard-readiness';

interface CurvyRoadmapTimelineProps {
  nodes?: DashboardRoadmapNode[];
}

interface CategoryPresentation {
  icon: LucideIcon;
  color: string;
}

const CATEGORY_PRESENTATION: Record<string, CategoryPresentation> = {
  resume: { icon: FileText, color: '#A8A29E' },
  'Document Intelligence': { icon: FileText, color: '#A8A29E' },
  github: { icon: GitBranch, color: '#A8A29E' },
  'Engineering Evidence': { icon: GitBranch, color: '#A8A29E' },
  projects: { icon: FolderGit2, color: '#D93829' },
  'Proof of Work': { icon: FolderGit2, color: '#D93829' },
  linkedin: { icon: Linkedin, color: '#D93829' },
  'Professional Network': { icon: Linkedin, color: '#D93829' },
  mock_interview: { icon: Mic2, color: '#D93829' },
  '15-Minute AI Viva': { icon: Mic2, color: '#D93829' },
  leetcode: { icon: Code2, color: '#D93829' },
  'DSA & Contest Performance': { icon: Code2, color: '#D93829' },
};

const BASE_TIMELINE_STEPS = [
  {
    id: '01',
    title: 'Resume',
    category: 'Document Intelligence',
    categoryKey: 'resume' as RoadmapCategory,
    eyebrow: 'Document Intelligence',
    maxPoints: 25,
    actionLabel: 'Improve resume',
    actionHref: '/dashboard/action-plan#resume',
    side: 'left' as const,
  },
  {
    id: '02',
    title: 'GitHub',
    category: 'Engineering Evidence',
    categoryKey: 'github' as RoadmapCategory,
    eyebrow: 'Engineering Evidence',
    maxPoints: 15,
    actionLabel: 'Review GitHub score',
    actionHref: '/dashboard/action-plan#github',
    side: 'right' as const,
  },
  {
    id: '03',
    title: 'Projects',
    category: 'Proof of Work',
    categoryKey: 'projects' as RoadmapCategory,
    eyebrow: 'Proof of Work',
    maxPoints: 20,
    actionLabel: 'Manage projects',
    actionHref: '/dashboard/action-plan#projects',
    side: 'left' as const,
  },
  {
    id: '04',
    title: 'LinkedIn',
    category: 'Professional Network',
    categoryKey: 'linkedin' as RoadmapCategory,
    eyebrow: 'Professional Network',
    maxPoints: 10,
    actionLabel: 'Update profile',
    actionHref: '/dashboard/action-plan#linkedin',
    side: 'right' as const,
  },
  {
    id: '05',
    title: 'LeetCode',
    category: 'DSA & Contest Performance',
    categoryKey: 'leetcode' as RoadmapCategory,
    eyebrow: 'DSA & Contest Performance',
    maxPoints: 10,
    actionLabel: 'Practice LeetCode',
    actionHref: '/dashboard/action-plan#leetcode',
    side: 'left' as const,
  },
  {
    id: '06',
    title: 'Mock Interview',
    category: '15-Minute AI Viva',
    categoryKey: 'mock_interview' as RoadmapCategory,
    eyebrow: '15-Minute AI Viva',
    maxPoints: 20,
    actionLabel: 'Start mock interview',
    actionHref: '/dashboard/interview',
    side: 'right' as const,
  },
] as const;

const DESKTOP_PATH = 'M500 0 C360 150 640 250 500 400 C360 550 640 650 500 800 C360 950 640 1050 500 1200 C360 1350 640 1450 500 1600 C360 1750 640 1850 500 2000';
const MOBILE_PATH = 'M40 0 C12 150 68 250 40 400 C12 550 68 650 40 800 C12 950 68 1050 40 1200 C12 1350 68 1450 40 1600 C12 1750 68 1850 40 2000';

function formatPoints(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function CurvyRoadmapTimeline({ nodes = buildDashboardRoadmap(null) }: CurvyRoadmapTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const [activeNode, setActiveNode] = useState<string>('01');
  const [scrollProgress, setScrollProgress] = useState(0);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start 75%', 'end 80%'],
  });

  useMotionValueEvent(scrollYProgress, 'change', (latest) => setScrollProgress(latest));

  // Hardcode the Sequence Structure: strictly enforce these 6 steps in this exact order.
  // Map the user's fetched data into this structure, but DO NOT remove the step if data is missing.
  const timelineSteps = useMemo(() => {
    const nodeMap = new Map<string, DashboardRoadmapNode>();
    if (nodes && Array.isArray(nodes)) {
      for (const node of nodes) {
        if (node.category) nodeMap.set(node.category, node);
        if (node.id) nodeMap.set(node.id, node);
      }
    }

    return BASE_TIMELINE_STEPS.map((step) => {
      const match = nodeMap.get(step.categoryKey) ?? nodeMap.get(step.id);
      const rawScore = typeof match?.rawScore === 'number' && Number.isFinite(match.rawScore)
        ? Math.max(0, Math.min(100, match.rawScore))
        : 0;
      const weightedPoints = typeof match?.weightedPoints === 'number' && Number.isFinite(match.weightedPoints)
        ? Math.max(0, Math.min(step.maxPoints, match.weightedPoints))
        : Math.round(rawScore * (step.maxPoints / 100) * 10) / 10;
      const status: RoadmapStatus = match?.status ?? (rawScore >= 75 ? 'Ready' : rawScore > 0 ? 'In progress' : 'Evidence needed');

      return {
        ...step,
        rawScore,
        weightedPoints,
        status,
        actionHref: match?.actionHref ?? step.actionHref,
        actionLabel: match?.actionLabel ?? step.actionLabel,
      };
    });
  }, [nodes]);

  return (
    <section ref={containerRef} aria-labelledby="roadmap-heading" className="relative mx-auto w-full max-w-6xl py-10 sm:py-14">
      <header className="mx-auto mb-14 max-w-2xl text-center sm:mb-20">
        <div className="inline-flex items-center rounded-full border border-stone-800 bg-stone-900 px-4 py-1 text-xs font-semibold text-stone-300">
          Readiness roadmap
        </div>
        <h2 id="roadmap-heading" className="mt-4 font-[var(--font-display)] text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
          Trace the evidence behind your score
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-white/55 sm:text-base">
          Follow each category score from the source evidence. Missing evidence stays at zero until it is added.
        </p>
      </header>

      <div className="relative">
        <RoadPath id="mobile" path={MOBILE_PATH} progress={scrollYProgress} reduceMotion={Boolean(reduceMotion)} className="absolute bottom-0 left-0 top-0 w-20 md:hidden" viewBox="0 0 80 2000" />
        <RoadPath id="desktop" path={DESKTOP_PATH} progress={scrollYProgress} reduceMotion={Boolean(reduceMotion)} className="absolute inset-0 hidden h-full w-full md:block" viewBox="0 0 1000 2000" />

        <div className="relative z-10 space-y-20 md:space-y-28">
          {timelineSteps.map((node, index) => {
            const presentation = CATEGORY_PRESENTATION[node.category] ?? CATEGORY_PRESENTATION[node.categoryKey] ?? CATEGORY_PRESENTATION.resume;
            const Icon = presentation.icon;
            const selected = activeNode === node.category || activeNode === node.id;
            const reached = reduceMotion || scrollProgress >= index / Math.max(timelineSteps.length - 1, 1) - 0.08;
            const meterWidth = (node.weightedPoints / node.maxPoints) * 100;

            return (
              <div key={node.id} className="grid min-h-[18rem] grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-4 md:grid-cols-[minmax(0,1fr)_5rem_minmax(0,1fr)] md:gap-8">
                <motion.button
                  type="button"
                  onClick={() => setActiveNode(node.id)}
                  className="relative col-start-1 row-start-1 grid h-14 w-14 place-items-center self-center rounded-xl border bg-stone-950 outline-none transition-shadow hover:shadow-[0_0_15px_rgba(249,115,22,0.4)] focus-visible:ring-2 focus-visible:ring-red-600 md:col-start-2 md:justify-self-center"
                  style={{
                    borderColor: reached ? '#F97316' : 'rgba(255,255,255,0.16)',
                    boxShadow: reached ? '0 0 15px rgba(249,115,22,0.3)' : 'none',
                  }}
                  whileHover={reduceMotion ? undefined : { scale: 1.08, rotate: 2 }}
                  whileTap={reduceMotion ? undefined : { scale: 0.96 }}
                  aria-pressed={selected}
                  aria-label={`Focus ${node.title}`}
                >
                  {reached && !reduceMotion && (
                    <motion.span
                      className="absolute inset-[-4px] rounded-xl border border-orange-500 opacity-60"
                      animate={{ opacity: 0.6 }}
                      transition={{ duration: 0 }}
                    />
                  )}
                  <Icon className="h-6 w-6" style={{ color: reached ? '#F97316' : presentation.color }} aria-hidden="true" />
                  <span className="absolute -bottom-3 rounded-full bg-stone-800 px-2 py-0.5 text-xs font-bold text-stone-300">{node.id}</span>
                </motion.button>

                <motion.article
                  initial={reduceMotion ? false : { opacity: 0, y: 30, rotateY: node.side === 'left' ? -5 : 5 }}
                  whileInView={{ opacity: 1, y: 0, rotateY: 0 }}
                  viewport={{ once: true, amount: 0.25 }}
                  transition={{ type: 'spring', stiffness: 110, damping: 20 }}
                  className={`col-start-2 row-start-1 rounded-2xl border bg-stone-900 p-5 shadow-md shadow-black/40 transition hover:shadow-[0_0_15px_rgba(249,115,22,0.2)] sm:p-7 ${node.side === 'left' ? 'md:col-start-1' : 'md:col-start-3'} ${selected ? 'border-[#D93829]' : 'border-stone-800'}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold" style={{ color: presentation.color }}>{node.eyebrow}</p>
                      <h3 className="mt-1 font-display text-xl font-bold text-stone-100 sm:text-2xl">{node.title}</h3>
                    </div>
                    <div className="shrink-0 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-right">
                      <p className="text-lg font-bold text-stone-100">{formatPoints(node.weightedPoints)} <span className="text-xs text-stone-500">/ {node.maxPoints}</span></p>
                      <p className="text-xs text-stone-500">Weighted points</p>
                    </div>
                  </div>

                  <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/[0.07]" aria-label={`${node.title} weighted progress`}>
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-orange-500 to-red-600"
                      initial={reduceMotion ? false : { width: 0 }}
                      whileInView={{ width: `${meterWidth}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                    />
                  </div>

                  <div className="mt-4 grid gap-2 text-xs text-white/60 sm:grid-cols-2">
                    <p className="rounded-xl border border-white/[0.06] bg-black/10 px-3 py-2">Category score: <strong className="text-white">{Math.round(node.rawScore)}/100</strong></p>
                    <p className="rounded-xl border border-white/[0.06] bg-black/10 px-3 py-2">Contribution: <strong className="text-white">{formatPoints(node.weightedPoints)} points</strong></p>
                  </div>

                  <footer className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
                    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                      node.status === 'In progress'
                        ? 'text-orange-400 border border-orange-500/30 bg-orange-500/10'
                        : node.status === 'Ready'
                          ? 'text-emerald-400 border border-emerald-500/30 bg-emerald-500/10'
                          : node.status === 'Action required'
                            ? 'text-rose-400 border border-rose-500/30 bg-rose-500/10'
                            : 'text-stone-400 border border-stone-800 bg-stone-900'
                    }`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${
                        node.status === 'In progress'
                          ? 'bg-orange-400'
                          : node.status === 'Ready'
                            ? 'bg-emerald-400'
                            : node.status === 'Action required'
                              ? 'bg-rose-400'
                              : 'bg-stone-500'
                      }`} />
                      {node.status}
                    </span>
                    <Link href={node.actionHref} className="group inline-flex items-center gap-1.5 text-xs font-bold text-stone-200 hover:text-[#D93829] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600">
                      {node.actionLabel}<ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                    </Link>
                  </footer>
                </motion.article>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

interface RoadPathProps {
  id: 'mobile' | 'desktop';
  path: string;
  progress: MotionValue<number>;
  reduceMotion: boolean;
  className: string;
  viewBox: string;
}

function RoadPath({ id, path, progress, reduceMotion, className, viewBox }: RoadPathProps) {
  return (
    <svg aria-hidden="true" className={className} viewBox={viewBox} fill="none" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`road-gradient-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#F97316" />
          <stop offset="1" stopColor="#DC2626" />
        </linearGradient>
      </defs>
      <path d={path} stroke="rgba(255,255,255,0.08)" strokeWidth="5" strokeDasharray="10 12" strokeLinecap="round" />
      <motion.path d={path} stroke={`url(#road-gradient-${id})`} strokeWidth="5" strokeLinecap="round" style={{ pathLength: reduceMotion ? 1 : progress }} />
    </svg>
  );
}
