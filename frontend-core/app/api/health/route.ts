import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type ServiceName = "profile" | "interview" | "automation";

interface ServiceConfig {
  name: ServiceName;
  url: string;
}

interface ServiceHealth {
  status: "ok" | "error";
  httpStatus: number | null;
  detail: unknown;
}

const SERVICES: readonly ServiceConfig[] = [
  {
    name: "profile",
    url: process.env.PROFILE_REVIEW_API_URL ?? "http://127.0.0.1:8001/health",
  },
  {
    name: "interview",
    url: process.env.MOCK_INTERVIEW_API_URL ?? "http://127.0.0.1:8002/health",
  },
  {
    name: "automation",
    url: process.env.AUTOMATION_API_URL ?? "http://127.0.0.1:8003/",
  },
] as const;

async function checkService(service: ServiceConfig): Promise<[ServiceName, ServiceHealth]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);

  try {
    const response = await fetch(service.url, {
      cache: "no-store",
      signal: controller.signal,
    });
    const detail: unknown = await response.json().catch(() => null);
    return [
      service.name,
      {
        status: response.ok ? "ok" : "error",
        httpStatus: response.status,
        detail,
      },
    ];
  } catch (error: unknown) {
    return [
      service.name,
      {
        status: "error",
        httpStatus: null,
        detail: error instanceof Error ? error.message : "Unknown health-check error",
      },
    ];
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(): Promise<NextResponse> {
  const entries = await Promise.all(SERVICES.map(checkService));
  const services = Object.fromEntries(entries) as Record<ServiceName, ServiceHealth>;
  const ready = Object.values(services).every((service) => service.status === "ok");

  return NextResponse.json(
    {
      status: ready ? "ok" : "degraded",
      services,
    },
    { status: ready ? 200 : 503 },
  );
}
