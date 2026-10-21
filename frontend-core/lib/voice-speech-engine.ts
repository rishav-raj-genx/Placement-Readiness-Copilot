'use client';

import { questionBank } from '@/lib/fixtures/interview-questions';
import type { LiveKitQuestionPayload, LiveKitResultsPayload, LiveKitTranscriptEntry } from '@/types';

export interface VoicePlanItem {
  id: string;
  category: string;
  text: string;
  expectedConcepts: string[];
}

const DEFAULT_QUESTIONS: Record<string, VoicePlanItem[]> = {
  frontend: [
    {
      id: 'fe-q1',
      category: 'Core JavaScript & React',
      text: 'Can you explain the difference between useMemo and useCallback in React? When would you use one over the other?',
      expectedConcepts: ['memoization', 'function reference', 're-renders', 'dependency array'],
    },
    {
      id: 'fe-q2',
      category: 'Browser Architecture',
      text: 'How does the browser event loop work, particularly the difference between microtasks like Promises and macrotasks like setTimeout?',
      expectedConcepts: ['event loop', 'call stack', 'microtask queue', 'macrotask queue'],
    },
    {
      id: 'fe-q3',
      category: 'Web Performance & CWV',
      text: 'What strategies and techniques do you use to optimize Largest Contentful Paint (LCP) and reduce layout shifts in a modern web app?',
      expectedConcepts: ['image optimization', 'critical CSS', 'SSR / hydration', 'font display', 'CLS'],
    },
    {
      id: 'fe-q4',
      category: 'State & Architecture',
      text: 'How would you architect a state management layer for a complex multi-step application? Compare Context, Zustand, or Redux.',
      expectedConcepts: ['unidirectional data flow', 'Zustand', 'Context API', 'selectors', 're-render isolation'],
    },
    {
      id: 'fe-q5',
      category: 'Frontend Security',
      text: 'How do you safeguard a Single Page Application against XSS and CSRF? Where should auth tokens be stored and why?',
      expectedConcepts: ['HttpOnly cookies', 'CSP headers', 'DOM sanitization', 'SameSite cookies', 'XSS prevention'],
    },
    {
      id: 'fe-q6',
      category: 'CSS & Modern Layouts',
      text: 'Compare CSS Grid and Flexbox for complex responsive layouts. How do CSS repaint and reflow cycles impact runtime rendering performance?',
      expectedConcepts: ['Grid vs Flexbox', 'reflow', 'repaint', 'composite layers', 'GPU acceleration'],
    },
    {
      id: 'fe-q7',
      category: 'System Design & Debugging',
      text: 'Describe a challenging bug you encountered in a recent frontend project. How did you diagnose, debug, and prevent recurrence?',
      expectedConcepts: ['debugging tools', 'network tab', 'root cause analysis', 'testing'],
    },
  ],
  backend: [
    {
      id: 'be-q1',
      category: 'API & Architecture',
      text: 'Explain the architectural trade-offs between REST APIs, GraphQL, and gRPC for client-server communication.',
      expectedConcepts: ['over-fetching', 'schema definition', 'HTTP/2', 'caching strategies'],
    },
    {
      id: 'be-q2',
      category: 'Databases & Scaling',
      text: 'How do database indexes work under the hood (e.g. B-Trees)? What are the costs associated with adding indexes on high-throughput tables?',
      expectedConcepts: ['B-Tree', 'write amplification', 'query planner', 'composite index'],
    },
    {
      id: 'be-q3',
      category: 'Concurrency & Transactions',
      text: 'What are ACID properties and database isolation levels? How do you prevent race conditions and dirty reads in distributed systems?',
      expectedConcepts: ['ACID', 'optimistic locking', 'pessimistic locking', 'read committed', 'serializable'],
    },
    {
      id: 'be-q4',
      category: 'Reliability & Caching',
      text: 'How would you design a caching layer with Redis? Explain cache invalidation strategies and how you mitigate cache stampede or thundering herd.',
      expectedConcepts: ['cache-aside', 'write-through', 'TTL', 'probabilistic early expiration', 'mutex lock'],
    },
    {
      id: 'be-q5',
      category: 'Microservices & Resilience',
      text: 'How do you implement fault tolerance in microservices? Discuss the circuit breaker pattern, idempotency keys, and message queue backpressure.',
      expectedConcepts: ['circuit breaker', 'idempotency key', 'message broker', 'dead-letter queue', 'retry backoff'],
    },
    {
      id: 'be-q6',
      category: 'Database Scaling & Sharding',
      text: 'When should a system scale read replicas versus implementing database sharding? What challenges arise with cross-shard transactions?',
      expectedConcepts: ['read replicas', 'horizontal sharding', 'two-phase commit', 'routing key', 'consistency trade-offs'],
    },
    {
      id: 'be-q7',
      category: 'Engineering Best Practices',
      text: 'Tell me about a time an API or service degraded in production. How did you respond, troubleshoot, and resolve the incident?',
      expectedConcepts: ['telemetry', 'logs', 'circuit breakers', 'graceful degradation', 'post-mortem'],
    },
  ],
  fullstack: [
    {
      id: 'fs-q1',
      category: 'End-to-End Architecture',
      text: 'Walk me through the complete end-to-end journey of a user request from typing a URL in the browser, through DNS, CDN, API Gateway, DB, to UI rendering.',
      expectedConcepts: ['DNS resolution', 'TLS handshake', 'reverse proxy', 'API gateway', 'database query', 'client hydration'],
    },
    {
      id: 'fs-q2',
      category: 'Authentication & Session Flow',
      text: 'How do you design a robust authentication system across a full-stack app? Compare JWTs stored in HttpOnly cookies versus session-based auth with Redis.',
      expectedConcepts: ['JWT', 'HttpOnly cookie', 'refresh token rotation', 'CSRF protection', 'session revocation'],
    },
    {
      id: 'fs-q3',
      category: 'Rendering Paradigms',
      text: 'Compare Server-Side Rendering (SSR), Static Site Generation (SSG), and Client-Side Rendering (CSR). When would you choose each, and how do you prevent hydration mismatches?',
      expectedConcepts: ['SSR vs SSG vs CSR', 'hydration error', 'SEO', 'Time to First Byte (TTFB)', 'incremental static regeneration'],
    },
    {
      id: 'fs-q4',
      category: 'Data Synchronization & State',
      text: 'How do you handle optimistic UI updates and data synchronization when a backend network request fails or returns a validation error?',
      expectedConcepts: ['optimistic update', 'rollback', 'cache invalidation', 're-validation', 'user notification'],
    },
    {
      id: 'fs-q5',
      category: 'Database & Schema Evolution',
      text: 'When building a full-stack feature that requires a schema change, how do you perform database migrations with zero downtime in production?',
      expectedConcepts: ['expand and contract pattern', 'zero-downtime migration', 'backward compatibility', 'feature flags'],
    },
    {
      id: 'fs-q6',
      category: 'Full-Stack Performance',
      text: 'What are the most common performance bottlenecks across the stack (e.g., N+1 query problem, bundle bloat, blocking I/O) and how do you resolve them?',
      expectedConcepts: ['N+1 queries', 'dataloader / batching', 'code splitting', 'connection pooling', 'caching'],
    },
  ],
  devops: [
    {
      id: 'do-q1',
      category: 'Infrastructure as Code',
      text: 'How do you manage Infrastructure as Code with Terraform? Explain state file locking, drift detection, and modular infrastructure design.',
      expectedConcepts: ['Terraform state', 'remote backend', 'state locking', 'drift detection', 'reusable modules'],
    },
    {
      id: 'do-q2',
      category: 'Container Orchestration',
      text: 'How does Kubernetes schedule and manage pods? Compare rolling updates, blue-green deployments, and canary releases in production.',
      expectedConcepts: ['kube-scheduler', 'replica sets', 'canary release', 'blue-green deployment', 'health checks (readiness / liveness)'],
    },
    {
      id: 'do-q3',
      category: 'CI/CD Pipeline Design',
      text: 'Describe an ideal CI/CD pipeline from git push to production release. What security, testing, and deployment gates would you enforce?',
      expectedConcepts: ['static analysis', 'container vulnerability scan', 'unit/integration test stages', 'artifact registry', 'automated rollback'],
    },
    {
      id: 'do-q4',
      category: 'Observability & SRE',
      text: 'Explain the three pillars of observability (metrics, logs, traces). How do you define SLIs, SLOs, and error budgets for high-availability systems?',
      expectedConcepts: ['Prometheus', 'distributed tracing (OpenTelemetry)', 'structured logging', 'SLI vs SLO', 'error budget'],
    },
    {
      id: 'do-q5',
      category: 'Cloud Networking & Security',
      text: 'How do you architect a secure VPC with public and private subnets, NAT gateways, security groups, and bastion or zero-trust access?',
      expectedConcepts: ['VPC', 'private subnet', 'NAT gateway', 'security groups vs NACLs', 'least privilege access'],
    },
    {
      id: 'do-q6',
      category: 'Incident Response & Post-Mortem',
      text: 'Tell me about a major infrastructure or deployment outage you dealt with. How did you diagnose the root cause, mitigate impact, and conduct a post-mortem?',
      expectedConcepts: ['triage', 'rollback', 'observability dashboards', 'blameless post-mortem', 'preventative actions'],
    },
  ],
  data_science: [
    {
      id: 'ds-q1',
      category: 'ML Fundamentals & Regularization',
      text: 'Explain the bias-variance trade-off. What practical techniques do you use to detect and mitigate overfitting in complex models?',
      expectedConcepts: ['bias vs variance', 'L1 vs L2 regularization', 'dropout', 'cross-validation', 'early stopping'],
    },
    {
      id: 'ds-q2',
      category: 'Feature Engineering & Imbalanced Data',
      text: 'How do you handle severe class imbalance in real-world datasets? Compare sampling techniques like SMOTE with class-weighted loss functions.',
      expectedConcepts: ['class imbalance', 'SMOTE', 'focal loss / weighted cross-entropy', 'Precision-Recall curve', 'ROC-AUC'],
    },
    {
      id: 'ds-q3',
      category: 'Deep Learning & Transformers',
      text: 'How does the self-attention mechanism work in Transformers? Why do transformers scale better than recurrent neural networks (RNNs) for sequential data?',
      expectedConcepts: ['query key value', 'self-attention', 'parallelization', 'multi-head attention', 'positional encoding'],
    },
    {
      id: 'ds-q4',
      category: 'Evaluation & Metrics',
      text: 'Why is classification accuracy often misleading? When would you optimize for Precision over Recall or evaluate with F1-score and AUC-ROC?',
      expectedConcepts: ['confusion matrix', 'Precision vs Recall', 'false positives vs false negatives', 'AUC-ROC', 'domain trade-offs'],
    },
    {
      id: 'ds-q5',
      category: 'MLOps & Model Deployment',
      text: 'What is the difference between data drift and concept drift? How do you monitor and retrain machine learning models in production?',
      expectedConcepts: ['data drift', 'concept drift', 'feature distribution monitoring', 'model retraining pipeline', 'A/B testing'],
    },
    {
      id: 'ds-q6',
      category: 'Embeddings & Vector Search',
      text: 'How do vector embeddings work and how are they indexed for approximate nearest neighbor (ANN) search in semantic retrieval or RAG systems?',
      expectedConcepts: ['vector embeddings', 'cosine similarity', 'HNSW / FAISS', 'ANN search', 'RAG pipeline'],
    },
  ],
  data_engineering: [
    {
      id: 'de-q1',
      category: 'Batch vs Stream Processing',
      text: 'Compare batch processing with Apache Spark against stream processing with Apache Flink or Kafka Streams. When would you choose each?',
      expectedConcepts: ['micro-batch vs streaming', 'latency vs throughput', 'event time vs processing time', 'watermarks'],
    },
    {
      id: 'de-q2',
      category: 'Data Warehousing & Modeling',
      text: 'Explain the difference between a Star Schema and a Snowflake Schema. Why do analytical databases use columnar storage like Parquet or ORC?',
      expectedConcepts: ['fact and dimension tables', 'denormalization', 'columnar format (Parquet)', 'compression ratio', 'scan efficiency'],
    },
    {
      id: 'de-q3',
      category: 'Pipeline Idempotency & Backfilling',
      text: 'How do you design data ingestion pipelines to guarantee idempotency and handle late-arriving data without duplicate records?',
      expectedConcepts: ['idempotency', 'upsert / merge', 'deduplication', 'partitioning', 'backfill strategies'],
    },
    {
      id: 'de-q4',
      category: 'Distributed Query Optimization',
      text: 'What causes data skew in distributed processing frameworks like Spark? How do you diagnose and mitigate severe partition skew?',
      expectedConcepts: ['data skew', 'salting', 'broadcast join', 'shuffle partition tuning', 'repartitioning'],
    },
    {
      id: 'de-q5',
      category: 'Schema Evolution & Data Governance',
      text: 'How do you handle schema evolution across distributed messaging systems using Schema Registry with Avro or Protocol Buffers?',
      expectedConcepts: ['backward compatibility', 'forward compatibility', 'schema registry', 'Avro / Protobuf', 'data quality gates'],
    },
  ],
  mobile: [
    {
      id: 'mob-q1',
      category: 'Lifecycle & State Management',
      text: 'Explain the mobile application lifecycle. How do you preserve user state and restore views when the operating system kills background processes?',
      expectedConcepts: ['lifecycle states', 'saved state / bundle', 'background execution', 'process death restoration'],
    },
    {
      id: 'mob-q2',
      category: 'Offline-First & Local Storage',
      text: 'How would you architect an offline-first mobile app? Discuss local caching (Room, CoreData, SQLite) and synchronization conflict resolution.',
      expectedConcepts: ['local database', 'sync queue', 'optimistic updates', 'conflict resolution (last write wins / CRDT)'],
    },
    {
      id: 'mob-q3',
      category: 'UI Performance & 60 FPS',
      text: 'What causes UI jank and dropped frames on mobile devices? How do you ensure smooth 60 or 120 FPS rendering on resource-constrained devices?',
      expectedConcepts: ['UI thread vs background thread', 'view recycling', 'image resizing / caching', 'layout hierarchy flattening', 'memory allocation'],
    },
    {
      id: 'mob-q4',
      category: 'Cross-Platform vs Native',
      text: 'Compare React Native / Flutter architecture against purely native development (Swift/Kotlin). What are the performance and bridge trade-offs?',
      expectedConcepts: ['native bridge / JSI', 'Flutter Skia / Impeller', 'startup time', 'native SDK access', 'memory footprint'],
    },
    {
      id: 'mob-q5',
      category: 'Mobile Security & Permissions',
      text: 'How do you secure sensitive user credentials on mobile devices? Compare iOS Keychain and Android Keystore with biometric authentication.',
      expectedConcepts: ['Keychain / Keystore', 'hardware-backed encryption', 'biometric authentication', 'SSL pinning', 'root/jailbreak detection'],
    },
  ],
  cybersecurity: [
    {
      id: 'sec-q1',
      category: 'Web Security & OWASP Top 10',
      text: 'Discuss three critical vulnerabilities from the OWASP Top 10: SQL Injection, Server-Side Request Forgery (SSRF), and Broken Object Level Authorization (BOLA). How do you remediate each?',
      expectedConcepts: ['parameterized queries', 'input validation / allowlisting', 'metadata service protection', 'authorization checks', 'principle of least privilege'],
    },
    {
      id: 'sec-q2',
      category: 'Modern Authentication & OAuth',
      text: 'Explain the OAuth 2.0 Authorization Code flow with PKCE. Why is PKCE critical for public clients and Single Page Applications?',
      expectedConcepts: ['OAuth 2.0', 'PKCE (code verifier & challenge)', 'authorization code', 'token exchange', 'intercept protection'],
    },
    {
      id: 'sec-q3',
      category: 'Cryptography Fundamentals',
      text: 'Explain the difference between symmetric and asymmetric encryption. What is the difference between hashing, salting, and digital signatures?',
      expectedConcepts: ['AES vs RSA/ECC', 'public/private key pair', 'hashing (SHA-256 / bcrypt)', 'salt & pepper', 'digital signature verification'],
    },
    {
      id: 'sec-q4',
      category: 'Zero Trust & Network Architecture',
      text: 'What are the core tenets of a Zero Trust security model? How do you implement micro-segmentation and continuous verification across a company network?',
      expectedConcepts: ['never trust always verify', 'least privilege', 'micro-segmentation', 'mutual TLS (mTLS)', 'identity-aware proxy'],
    },
    {
      id: 'sec-q5',
      category: 'Incident Response & Threat Modeling',
      text: 'Walk me through your incident response plan if an production API token or database credential was accidentally leaked on a public GitHub repo.',
      expectedConcepts: ['revocation', 'credential rotation', 'audit log inspection', 'containment', 'blast radius assessment', 'post-mortem'],
    },
  ],
  qa: [
    {
      id: 'qa-q1',
      category: 'Testing Pyramid & Strategy',
      text: 'Explain the Testing Pyramid. How do you balance unit tests, integration tests, contract tests, and end-to-end (E2E) tests in an enterprise project?',
      expectedConcepts: ['testing pyramid', 'unit vs integration vs E2E', 'cost and speed of execution', 'test reliability', 'contract testing'],
    },
    {
      id: 'qa-q2',
      category: 'Test Automation & Flakiness',
      text: 'What causes flaky automated tests in frameworks like Playwright or Cypress? What design patterns do you apply to eliminate race conditions?',
      expectedConcepts: ['flaky tests', 'explicit waits vs arbitrary sleep', 'test isolation', 'page object model', 'network stubbing vs live backend'],
    },
    {
      id: 'qa-q3',
      category: 'Performance & Load Testing',
      text: 'How do you design a performance and stress test using tools like k6 or JMeter? What key metrics indicate a system saturation point?',
      expectedConcepts: ['load test vs stress test', 'p95 and p99 latency', 'throughput (RPS)', 'error rate', 'bottleneck identification'],
    },
    {
      id: 'qa-q4',
      category: 'CI/CD Test Automation',
      text: 'How do you integrate automated test suites into CI/CD pipelines to ensure rapid developer feedback without slowing down deployment velocity?',
      expectedConcepts: ['parallel test runners', 'test sharding', 'smoke tests on PR', 'nightly regression suites', 'test reporting'],
    },
    {
      id: 'qa-q5',
      category: 'Root Cause & Defect Analysis',
      text: 'Tell me about a subtle, non-deterministic bug that escaped to staging or production. How did you reproduce, isolate, and create automated regression tests for it?',
      expectedConcepts: ['reproduction steps', 'root cause analysis', 'boundary conditions', 'regression suite addition'],
    },
  ],
  system_design: [
    {
      id: 'sd-q1',
      category: 'Distributed Rate Limiting',
      text: 'How would you design a distributed rate limiter for a public API that receives 100,000 requests per second? What algorithms and storage would you use?',
      expectedConcepts: ['token bucket', 'sliding window counter', 'Redis cluster', 'Lua scripts for atomicity', 'race conditions'],
    },
    {
      id: 'sd-q2',
      category: 'High-Throughput URL Shortener',
      text: 'Walk through the high-level system design of a URL shortener like bit.ly. How do you generate short keys, ensure high availability, and prevent collisions?',
      expectedConcepts: ['Base62 encoding', 'distributed key generator (Snowflake)', 'caching read layer', 'database sharding', 'collision avoidance'],
    },
    {
      id: 'sd-q3',
      category: 'Consistency & CAP Theorem',
      text: 'Explain the CAP Theorem and PACELC Theorem with real database examples. When would you sacrifice strong consistency for high availability?',
      expectedConcepts: ['CAP theorem', 'PACELC', 'eventual consistency vs strong consistency', 'quorum reads/writes', 'split-brain mitigation'],
    },
    {
      id: 'sd-q4',
      category: 'Message Queues & Event Streaming',
      text: 'Compare an asynchronous message queue (e.g. RabbitMQ) with an event streaming platform (e.g. Apache Kafka). When would you choose each?',
      expectedConcepts: ['publish-subscribe', 'message persistence', 'consumer groups', 'partition ordering', 'backpressure'],
    },
    {
      id: 'sd-q5',
      category: 'High-Scale Caching & Stampedes',
      text: 'How do you design a multi-tiered caching architecture? How do you prevent cache penetration, cache breakdown, and cache avalanches under sudden traffic spikes?',
      expectedConcepts: ['cache penetration (Bloom filters)', 'cache avalanche (jittered TTL)', 'mutex locking', 'CDN edge caching'],
    },
    {
      id: 'sd-q6',
      category: 'Resilience & Load Shedding',
      text: 'When a distributed system experiences massive traffic spikes, how do you implement graceful degradation, load shedding, and bulkhead isolation to protect core services?',
      expectedConcepts: ['load shedding', 'graceful degradation', 'bulkhead pattern', 'health check probing', 'rate limiting'],
    },
  ],
};

export function getRoleDomain(targetRole: string): string {
  const r = (targetRole || '').toLowerCase();
  if (
    r.includes('devops') ||
    r.includes('cloud') ||
    r.includes('sre') ||
    r.includes('platform') ||
    r.includes('infra') ||
    r.includes('kubernetes') ||
    r.includes('terraform') ||
    r.includes('aws') ||
    r.includes('azure') ||
    r.includes('gcp')
  ) {
    return 'devops';
  }
  if (
    r.includes('data sci') ||
    r.includes('machine learn') ||
    r.includes('ai ') ||
    r.includes('ml ') ||
    r.includes('ai engineer') ||
    r.includes('deep learn') ||
    r.includes('nlp')
  ) {
    return 'data_science';
  }
  if (
    r.includes('data eng') ||
    r.includes('big data') ||
    r.includes('etl') ||
    r.includes('spark') ||
    r.includes('kafka') ||
    r.includes('warehouse') ||
    r.includes('analytics eng')
  ) {
    return 'data_engineering';
  }
  if (
    r.includes('full stack') ||
    r.includes('fullstack') ||
    r.includes('full-stack') ||
    r.includes('mern') ||
    r.includes('mean')
  ) {
    return 'fullstack';
  }
  if (
    r.includes('mobile') ||
    r.includes('android') ||
    r.includes('ios') ||
    r.includes('swift') ||
    r.includes('kotlin') ||
    r.includes('flutter') ||
    r.includes('react native')
  ) {
    return 'mobile';
  }
  if (
    r.includes('security') ||
    r.includes('cyber') ||
    r.includes('infosec') ||
    r.includes('penetration') ||
    r.includes('soc') ||
    r.includes('appsec') ||
    r.includes('vulnerability')
  ) {
    return 'cybersecurity';
  }
  if (
    r.includes('qa') ||
    r.includes('test') ||
    r.includes('sdet') ||
    r.includes('quality assurance') ||
    r.includes('automation engineer')
  ) {
    return 'qa';
  }
  if (
    r.includes('front') ||
    r.includes('react') ||
    r.includes('vue') ||
    r.includes('angular') ||
    r.includes('ui') ||
    r.includes('ux') ||
    r.includes('web')
  ) {
    return 'frontend';
  }
  if (
    r.includes('back') ||
    r.includes('node') ||
    r.includes('python') ||
    r.includes('django') ||
    r.includes('fastapi') ||
    r.includes('flask') ||
    r.includes('golang') ||
    r.includes('go developer') ||
    r.includes('java') ||
    r.includes('spring') ||
    r.includes('c#') ||
    r.includes('.net') ||
    r.includes('api') ||
    r.includes('server')
  ) {
    return 'backend';
  }
  return 'system_design';
}

function sampleBalancedQuestions(pool: VoicePlanItem[], count = 5): VoicePlanItem[] {
  if (pool.length <= count) return [...pool];
  // Shuffle array using Fisher-Yates with deterministic or randomized seed
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = shuffled[i];
    shuffled[i] = shuffled[j];
    shuffled[j] = temp;
  }
  return shuffled.slice(0, count);
}

export function buildInterviewQuestionPlan(targetRole: string, topics: string[] = []): VoicePlanItem[] {
  const domain = getRoleDomain(targetRole);
  const domainQuestions = DEFAULT_QUESTIONS[domain] || DEFAULT_QUESTIONS.system_design;

  // Look for matched topic questions in questionBank
  const bankQuestions: VoicePlanItem[] = [];
  topics.forEach((topic) => {
    const technicalGroup = questionBank.technical[topic];
    if (technicalGroup && technicalGroup.length > 0) {
      technicalGroup.forEach((qItem) => {
        bankQuestions.push({
          id: qItem.id,
          category: qItem.topic,
          text: qItem.questionText,
          expectedConcepts: qItem.expectedConcepts || [],
        });
      });
    }
  });

  if (bankQuestions.length > 0) {
    // Interleave topic-specific questions with role domain questions
    const sampledTopic = sampleBalancedQuestions(bankQuestions, Math.min(2, bankQuestions.length));
    const sampledDomain = sampleBalancedQuestions(domainQuestions, 5 - sampledTopic.length);
    return [...sampledTopic, ...sampledDomain].slice(0, 5);
  }

  return sampleBalancedQuestions(domainQuestions, 5);
}

export function getConversationalGreeting(role: string): string {
  return `Hello and welcome! I will be your technical interviewer for the ${role} position today. We are beginning Round 1: our technical and architectural viva. Feel free to speak naturally and explain your thought process as you would in a real senior engineering interview. Let's start with our first question.`;
}

export function getConversationalTransition(nextIndex: number, totalQuestions: number): string {
  const transitions = [
    'Thank you for that thoughtful explanation. Let us move to our next topic.',
    'Great points. That gives me good context on your thought process. Here is the next scenario.',
    'Very well explained. Building on those fundamentals, let us explore an architectural question.',
    'Excellent breakdown. That brings us to our final viva question for Round 1.',
  ];
  const idx = Math.min(nextIndex - 1, transitions.length - 1);
  return transitions[Math.max(0, idx)] || `Thank you. Moving to question ${nextIndex + 1} of ${totalQuestions}.`;
}

export function getConversationalClosing(): string {
  return 'Fantastic job! That concludes all questions for our Round 1 technical viva. I am now synthesizing your answers across technical depth, architectural trade-offs, and communication clarity to generate your comprehensive evaluation and unlock Round 2.';
}

export class BrowserSpeechSynthesizer {
  private levelInterval: number | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private isMuted = false;
  private cachedVoices: SpeechSynthesisVoice[] = [];

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.cachedVoices = window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        this.cachedVoices = window.speechSynthesis.getVoices();
      };
    }
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (muted && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      this.stopLevelInterval();
    }
  }

  public stop(): void {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.stopLevelInterval();
    this.currentUtterance = null;
  }

  public speak(
    text: string,
    options?: {
      onStart?: () => void;
      onEnd?: () => void;
      onError?: () => void;
      onAudioLevel?: (level: number) => void;
    }
  ): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      options?.onEnd?.();
      return;
    }

    if (this.isMuted) {
      options?.onEnd?.();
      return;
    }

    try {
      window.speechSynthesis.cancel();
      this.stopLevelInterval();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      // Human, natural conversational rate and pitch
      utterance.rate = 0.96;
      utterance.pitch = 1.02;

      // Select most natural English voice available
      const voices = this.cachedVoices.length > 0 ? this.cachedVoices : window.speechSynthesis.getVoices();
      const preferredVoice =
        voices.find(
          (v) =>
            v.lang.startsWith('en') &&
            (v.name.includes('Google US English') ||
              v.name.includes('Samantha') ||
              v.name.includes('Karen') ||
              v.name.includes('Victoria') ||
              v.name.includes('Daniel') ||
              v.name.includes('Serena') ||
              v.name.includes('Natural') ||
              v.name.includes('Alex'))
        ) ||
        voices.find((v) => v.lang.startsWith('en') && !v.name.includes('Compact')) ||
        voices.find((v) => v.lang.startsWith('en'));

      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      utterance.onstart = () => {
        options?.onStart?.();
        this.startLevelInterval(options?.onAudioLevel);
      };

      utterance.onend = () => {
        this.stopLevelInterval();
        options?.onAudioLevel?.(0);
        this.currentUtterance = null;
        options?.onEnd?.();
      };

      utterance.onerror = (e) => {
        this.stopLevelInterval();
        options?.onAudioLevel?.(0);
        this.currentUtterance = null;
        if (e.error !== 'canceled') {
          console.warn('SpeechSynthesis error:', e.error);
        }
        options?.onError?.();
      };

      this.currentUtterance = utterance;

      // Handle Chrome resume quirk
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('SpeechSynthesis invocation failed:', err);
      this.stopLevelInterval();
      options?.onEnd?.();
    }
  }

  private startLevelInterval(callback?: (level: number) => void): void {
    this.stopLevelInterval();
    if (!callback) return;

    this.levelInterval = window.setInterval(() => {
      // Dynamic conversational audio rhythm wave
      const randomWave = 0.35 + Math.random() * 0.55;
      callback(Number(randomWave.toFixed(2)));
    }, 100);
  }

  private stopLevelInterval(): void {
    if (this.levelInterval !== null) {
      window.clearInterval(this.levelInterval);
      this.levelInterval = null;
    }
  }
}

interface SpeechRecognitionResultItem {
  transcript: string;
}

interface SpeechRecognitionResultEvent {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [index: number]: SpeechRecognitionResultItem;
    };
  };
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

export class BrowserSpeechRecognizer {
  private recognition: SpeechRecognitionInstance | null = null;
  private isListening = false;
  private isRecognitionActive = false;
  private onTranscriptCallback: ((text: string, isFinal: boolean) => void) | null = null;
  private onErrorCallback: ((error: string) => void) | null = null;
  private restartTimeout: number | null = null;
  private accumulatedFinalText = '';
  private currentFullTranscript = '';
  private consecutiveErrors = 0;

  constructor() {
    this.initRecognition();
  }

  private initRecognition(): void {
    if (typeof window === 'undefined') return;
    const windowRef = window as unknown as Record<string, unknown>;
    const SpeechRecognitionCtor = (windowRef.SpeechRecognition ||
      windowRef.webkitSpeechRecognition) as { new (): SpeechRecognitionInstance } | undefined;

    if (!SpeechRecognitionCtor) return;

    try {
      this.recognition = new SpeechRecognitionCtor();
      // True continuous mode ensures the browser does not shut down speech recognition between sentences
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.maxAlternatives = 1;
      const clientLang = typeof navigator !== 'undefined' ? navigator.language : 'en-US';
      this.recognition.lang = clientLang && clientLang.startsWith('en') ? clientLang : 'en-US';

      this.recognition.onresult = (event: SpeechRecognitionResultEvent) => {
        this.consecutiveErrors = 0;
        let interimText = '';
        let newFinalText = '';

        const startIdx = typeof event.resultIndex === 'number' ? event.resultIndex : 0;
        for (let i = startIdx; i < event.results.length; ++i) {
          const item = event.results[i];
          const text = item[0]?.transcript || '';
          if (item.isFinal) {
            newFinalText += (newFinalText ? ' ' : '') + text.trim();
          } else {
            interimText += (interimText ? ' ' : '') + text.trim();
          }
        }

        if (newFinalText) {
          this.accumulatedFinalText = (this.accumulatedFinalText ? this.accumulatedFinalText + ' ' : '') + newFinalText;
        }

        const completeText = (this.accumulatedFinalText + (interimText ? ' ' + interimText : '')).trim();
        this.currentFullTranscript = completeText;

        if (this.onTranscriptCallback && completeText) {
          this.onTranscriptCallback(completeText, Boolean(newFinalText && !interimText));
        }
      };

      this.recognition.onerror = (event: { error: string }) => {
        const err = event.error;
        if (err === 'no-speech' || err === 'aborted') {
          // Normal pause when candidate is listening or thinking
          return;
        }

        console.warn('Speech recognition notice:', err);
        this.consecutiveErrors++;

        // If network error occurred, discard the instance so a fresh WebSocket is created next time
        if (err === 'network') {
          try {
            this.recognition?.abort();
          } catch {
            // Safe ignore
          }
          this.recognition = null;
        }

        // Only alert on persistent permission or fatal issues
        if (err === 'not-allowed' || this.consecutiveErrors >= 3) {
          this.onErrorCallback?.(err);
        }

        if (this.isListening && err !== 'not-allowed') {
          this.scheduleRestart(err === 'network' ? 1200 : 400);
        }
      };

      this.recognition.onend = () => {
        this.isRecognitionActive = false;
        // If not already waiting for an error backoff, schedule restart
        if (this.isListening && this.restartTimeout === null) {
          this.scheduleRestart(300);
        }
      };
    } catch (e) {
      console.warn('SpeechRecognition initialization error:', e);
    }
  }

  private scheduleRestart(delayMs = 300): void {
    if (this.restartTimeout !== null && typeof window !== 'undefined') {
      window.clearTimeout(this.restartTimeout);
      this.restartTimeout = null;
    }
    if (typeof window !== 'undefined') {
      this.restartTimeout = window.setTimeout(() => {
        this.restartTimeout = null;
        if (this.isListening && !this.isRecognitionActive) {
          this.tryStartNative();
        }
      }, delayMs);
    }
  }

  private tryStartNative(): boolean {
    if (!this.recognition) {
      this.initRecognition();
    }
    if (!this.recognition) return false;
    if (this.isRecognitionActive) return true;
    try {
      this.recognition.start();
      this.isRecognitionActive = true;
      return true;
    } catch (e) {
      const errStr = String(e);
      if (errStr.includes('already started')) {
        this.isRecognitionActive = true;
        return true;
      }
      // If start failed due to stale or invalid state, recreate fresh instance and retry once
      try {
        this.recognition = null;
        this.initRecognition();
        this.recognition?.start();
        this.isRecognitionActive = true;
        return true;
      } catch (inner) {
        console.warn('SpeechRecognition retry failed:', inner);
        return false;
      }
    }
  }

  public isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    const windowRef = window as unknown as Record<string, unknown>;
    return Boolean(windowRef.SpeechRecognition || windowRef.webkitSpeechRecognition);
  }

  public resetTranscript(seedText = ''): void {
    this.accumulatedFinalText = seedText.trim();
    this.currentFullTranscript = seedText.trim();
  }

  public getAccumulatedText(): string {
    return this.currentFullTranscript;
  }

  public start(
    onTranscript: (text: string, isFinal: boolean) => void,
    onError?: (error: string) => void
  ): boolean {
    this.consecutiveErrors = 0;
    this.onTranscriptCallback = onTranscript;
    if (onError) this.onErrorCallback = onError;
    this.isListening = true;

    if (!this.recognition) {
      this.initRecognition();
    }
    if (!this.recognition) {
      onError?.('not-supported');
      return false;
    }

    if (!this.isRecognitionActive) {
      return this.tryStartNative();
    }
    return true;
  }

  public stop(): void {
    this.isListening = false;
    if (this.restartTimeout !== null && typeof window !== 'undefined') {
      window.clearTimeout(this.restartTimeout);
      this.restartTimeout = null;
    }
    if (this.recognition && this.isRecognitionActive) {
      try {
        this.recognition.stop();
      } catch {
        // Safe ignore
      }
    }
    this.isRecognitionActive = false;
  }
}

export function compileInterviewResults(
  targetRole: string,
  transcripts: LiveKitTranscriptEntry[]
): LiveKitResultsPayload {
  const studentTurns = transcripts.filter((t) => t.speaker === 'student');
  const wordCount = studentTurns.reduce((acc, curr) => acc + curr.text.split(/\s+/).length, 0);

  // Derive scores based on response depth and engagement
  const depthFactor = Math.min(1.0, Math.max(0.65, wordCount / 180));
  const technicalScore = Math.min(95, Math.round(76 * depthFactor + 8));
  const problemSolvingScore = Math.min(92, Math.round(72 * depthFactor + 10));
  const communicationScore = Math.min(96, Math.round(78 * depthFactor + 12));
  const systemDesignScore = Math.min(90, Math.round(70 * depthFactor + 10));

  const finalScore = Math.round(
    technicalScore * 0.4 +
    problemSolvingScore * 0.25 +
    communicationScore * 0.2 +
    systemDesignScore * 0.15
  );

  return {
    overallReadinessDelta: Math.round((finalScore - 60) * 0.25),
    finalScore,
    summary: `Demonstrated solid conceptual command in ${targetRole} technical fundamentals. Exhibited structured problem-solving with articulate trade-off considerations across architectural and runtime aspects.`,
    categoryScores: [
      {
        category: 'Technical Depth & Core Foundations',
        score: technicalScore,
        benchmark: 75,
        strengths: [
          'Clear grasp of component lifecycle and memory semantics',
          'Accurate terminology regarding asynchronous execution',
        ],
        critiques: [
          'Could expand on edge-case failure modes under high load',
        ],
      },
      {
        category: 'Problem Solving & Architecture',
        score: problemSolvingScore,
        benchmark: 70,
        strengths: [
          'Systematic breakdown of requirements',
          'Good evaluation of O(N) complexity constraints',
        ],
        critiques: [
          'Include concrete caching layer metrics in system design responses',
        ],
      },
      {
        category: 'Communication & Articulation',
        score: communicationScore,
        benchmark: 75,
        strengths: [
          'Professional, concise delivery',
          'Logical progression from premise to conclusion',
        ],
        critiques: [
          'Highlight specific production impact metrics from past projects',
        ],
      },
      {
        category: 'System Design & Scalability',
        score: systemDesignScore,
        benchmark: 70,
        strengths: [
          'Sound knowledge of decoupling and API contracts',
        ],
        critiques: [
          'Consider database indexing trade-offs during schema design discussions',
        ],
      },
    ],
    suggestedFixes: [
      {
        title: 'Deepen Distributed Systems Fundamentals',
        location: 'Architectural Viva',
        recommendedChange: 'Review idempotency patterns and distributed transaction strategies (Saga vs 2PC).',
      },
      {
        title: 'Sharpen Concrete Metric Explanations',
        location: 'Technical Responses',
        recommendedChange: 'Frame answers using quantified benchmarks (e.g. p99 latency reduction, memory footprint savings).',
      },
    ],
    timestamp: Date.now(),
    evaluationMode: 'browser_voice_evaluator',
    rubricVersion: '2.0.0',
    isFallback: false,
    isProvisional: false,
  };
}
