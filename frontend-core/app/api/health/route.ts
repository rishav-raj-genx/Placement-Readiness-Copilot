import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type ServiceName = 'profile' | 'interview' | 'automation';

interface ServiceConfig {
  name: ServiceName;
  url?: string;
  environmentVariable: string;
  healthPath: '/' | '/health';
}

interface ServiceHealth {
  status: 'ok' | 'error';
  httpStatus: number | null;
  detail: unknown;
}

function configuredServices(): readonly ServiceConfig[] {
  return [
    {
      name: 'profile',
      url: process.env.PROFILE_REVIEW_API_URL?.trim() || process.env.PROFILE_ENGINE_URL?.trim(),
      environmentVariable: 'PROFILE_REVIEW_API_URL or PROFILE_ENGINE_URL',
      healthPath: '/health',
    },
    {
      name: 'interview',
      url: process.env.INTERVIEW_SERVICE_URL?.trim(),
      environmentVariable: 'INTERVIEW_SERVICE_URL',
      healthPath: '/health',
    },
    {
      name: 'automation',
      url: process.env.AUTOMATION_API_URL?.trim()
        || process.env.AUTOMATION_SERVICE_URL?.trim()
        || process.env.NEXT_PUBLIC_AUTOMATION_URL?.trim(),
      environmentVariable: 'AUTOMATION_API_URL',
      healthPath: '/',
    },
  ];
}

async function checkService(service: ServiceConfig): Promise<[ServiceName, ServiceHealth]> {
  if (!service.url) {
    return [
      service.name,
      {
        status: 'error',
        httpStatus: null,
        detail: `${service.environmentVariable} is not configured.`,
      },
    ];
  }

  let serviceUrl: URL;
  try {
    serviceUrl = new URL(service.url);
    if (service.healthPath === '/health' && !serviceUrl.pathname.replace(/\/$/, '').endsWith('/health')) {
      serviceUrl.pathname = `${serviceUrl.pathname.replace(/\/$/, '')}/health`;
    }
    serviceUrl.search = '';
    serviceUrl.hash = '';
  } catch {
    return [
      service.name,
      {
        status: 'error',
        httpStatus: null,
        detail: `${service.environmentVariable} is not a valid URL.`,
      },
    ];
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);

  try {
    const response = await fetch(serviceUrl, {
      cache: 'no-store',
      signal: controller.signal,
    });
    const detail: unknown = await response.json().catch(() => null);
    return [
      service.name,
      {
        status: response.ok ? 'ok' : 'error',
        httpStatus: response.status,
        detail,
      },
    ];
  } catch (error: unknown) {
    return [
      service.name,
      {
        status: 'error',
        httpStatus: null,
        detail: error instanceof Error ? error.message : 'Unknown health-check error',
      },
    ];
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(): Promise<NextResponse> {
  const entries = await Promise.all(configuredServices().map(checkService));
  const services = Object.fromEntries(entries) as Record<ServiceName, ServiceHealth>;
  const ready = Object.values(services).every((service) => service.status === 'ok');

  return NextResponse.json(
    {
      status: ready ? 'ok' : 'degraded',
      services,
    },
    { status: ready ? 200 : 503 },
  );
}
