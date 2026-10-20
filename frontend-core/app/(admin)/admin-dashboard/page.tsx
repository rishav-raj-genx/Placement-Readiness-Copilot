import Link from 'next/link';
import { BriefcaseBusiness, Mic2, ArrowRight } from 'lucide-react';

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-stone-800 bg-[#28201E] p-6 sm:p-8">
        <p className="font-mono text-xs uppercase tracking-wider text-stone-400">Staff workspace</p>
        <h1 className="mt-2 font-[var(--font-display)] text-3xl font-bold tracking-tight text-stone-100 sm:text-4xl">
          MSOT command center
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-stone-400">
          Manage official placement opportunities and faculty-led viva reviews from one protected workspace.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/admin-jobs"
          className="group rounded-xl border border-stone-800 bg-[#28201E] p-5 transition-colors hover:border-stone-700 hover:bg-stone-900/80"
        >
          <div className="flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-stone-700 bg-stone-800 text-[#D93829]">
              <BriefcaseBusiness className="h-5 w-5" />
            </div>
            <ArrowRight className="h-4 w-4 text-stone-500 transition-transform group-hover:translate-x-1 group-hover:text-stone-300" />
          </div>
          <h2 className="mt-4 text-base font-semibold text-stone-100">Job board</h2>
          <p className="mt-1 text-xs text-stone-400">
            Publish verified partner roles directly to eligible students and track application activity.
          </p>
        </Link>

        <Link
          href="/admin-interviews"
          className="group rounded-xl border border-stone-800 bg-[#28201E] p-5 transition-colors hover:border-stone-700 hover:bg-stone-900/80"
        >
          <div className="flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-stone-700 bg-stone-800 text-[#D93829]">
              <Mic2 className="h-5 w-5" />
            </div>
            <ArrowRight className="h-4 w-4 text-stone-500 transition-transform group-hover:translate-x-1 group-hover:text-stone-300" />
          </div>
          <h2 className="mt-4 text-base font-semibold text-stone-100">Viva reviews</h2>
          <p className="mt-1 text-xs text-stone-400">
            Audit mock interviews, review timestamped audio transcripts, and submit faculty overrides.
          </p>
        </Link>
      </section>
    </div>
  );
}
