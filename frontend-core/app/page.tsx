"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { IntroSequence } from "@/components/IntroSequence";

export default function Home() {
  const router = useRouter();
  const [showIntro, setShowIntro] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const hasSeen = localStorage.getItem("has_seen_intro");
    if (hasSeen) {
      router.push("/dashboard");
    } else {
      setShowIntro(true);
    }
  }, [router]);

  if (!mounted) return <div className="min-h-screen bg-[#0B0F17]" />;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0B0F17]">
      {showIntro && <IntroSequence />}
    </main>
  );
}
