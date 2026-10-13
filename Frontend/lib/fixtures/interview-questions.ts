import type { InterviewQuestion, InterviewType } from '@/types';

const q = (
  id: string,
  topic: string,
  questionText: string,
  questionType: InterviewQuestion['questionType'] = 'open_ended',
  expectedConcepts: string[] = []
): InterviewQuestion => ({ id, topic, questionText, questionType, expectedConcepts });

export const questionBank: Record<InterviewType, Record<string, InterviewQuestion[]>> = {
  technical: {
    React: [
      q('tech-react-1', 'React', 'Explain the difference between useMemo and useCallback. When would you use each?', 'open_ended', ['memoization', 'performance', 'referential equality']),
      q('tech-react-2', 'React', 'What happens during the React reconciliation process? How does the virtual DOM work?', 'open_ended', ['virtual DOM', 'reconciliation', 'diffing algorithm']),
      q('tech-react-3', 'React', 'Explain the component lifecycle in React hooks. How do useEffect cleanup functions work?', 'open_ended', ['useEffect', 'lifecycle', 'cleanup']),
      q('tech-react-4', 'React', 'How does React handle state batching? What implications does this have for multiple setState calls?', 'open_ended', ['state batching', 're-render', 'performance']),
    ],
    JavaScript: [
      q('tech-js-1', 'JavaScript', 'Explain closures in JavaScript. Provide a practical example where closures are useful.', 'open_ended', ['closures', 'scope', 'lexical environment']),
      q('tech-js-2', 'JavaScript', 'What is the event loop? How do microtasks differ from macrotasks?', 'open_ended', ['event loop', 'microtask', 'macrotask', 'concurrency']),
      q('tech-js-3', 'JavaScript', 'Explain the difference between call, apply, and bind. When would you use each?', 'open_ended', ['this binding', 'call', 'apply', 'bind']),
    ],
    'Node.js': [
      q('tech-node-1', 'Node.js', 'How does the Node.js event loop handle I/O operations? What are the implications for CPU-intensive tasks?', 'open_ended', ['event loop', 'libuv', 'non-blocking I/O']),
      q('tech-node-2', 'Node.js', 'Explain streams in Node.js. What are the different types of streams and when would you use them?', 'open_ended', ['streams', 'Readable', 'Writable', 'backpressure']),
    ],
    'State Management': [
      q('tech-state-1', 'State Management', 'Compare Redux, Zustand, and React Context for state management. When would you choose each?', 'open_ended', ['Redux', 'Zustand', 'Context', 'global state']),
      q('tech-state-2', 'State Management', 'What is the Flux pattern? How does unidirectional data flow help with debugging?', 'open_ended', ['Flux', 'unidirectional data flow', 'debugging']),
    ],
    Performance: [
      q('tech-perf-1', 'Performance', 'How would you identify and fix a performance bottleneck in a React application?', 'open_ended', ['React DevTools', 'profiling', 'memoization', 'code splitting']),
      q('tech-perf-2', 'Performance', 'Explain debouncing and throttling. When would you use each in a frontend application?', 'open_ended', ['debounce', 'throttle', 'event handling']),
    ],
    TypeScript: [
      q('tech-ts-1', 'TypeScript', 'Explain the difference between interface and type in TypeScript. When would you prefer one over the other?', 'open_ended', ['interface', 'type', 'structural typing']),
      q('tech-ts-2', 'TypeScript', 'What are generics in TypeScript? Provide an example of a generic utility type you have used.', 'open_ended', ['generics', 'utility types', 'type constraints']),
    ],
    CSS: [
      q('tech-css-1', 'CSS', 'Explain the CSS box model. How does box-sizing affect layout calculations?', 'open_ended', ['box model', 'box-sizing', 'content-box']),
      q('tech-css-2', 'CSS', 'Compare Flexbox and CSS Grid. When would you use each for layout?', 'open_ended', ['Flexbox', 'Grid', 'layout', 'responsive']),
    ],
  },
  coding: {
    'Data Structures': [
      q('code-ds-1', 'Data Structures', 'Implement a function that reverses a linked list. Explain your approach and time complexity.', 'coding', ['linked list', 'pointers', 'O(n)']),
      q('code-ds-2', 'Data Structures', 'Write a function to detect a cycle in a linked list. What data structure would you use?', 'coding', ['cycle detection', 'Floyd algorithm', 'hash set']),
      q('code-ds-3', 'Data Structures', 'Implement a basic LRU cache with get and put operations. What is the time complexity?', 'coding', ['LRU cache', 'hashmap', 'doubly linked list']),
    ],
    Algorithms: [
      q('code-algo-1', 'Algorithms', 'Implement binary search on a sorted array. Handle the edge case where the target is not found.', 'coding', ['binary search', 'O(log n)', 'sorted array']),
      q('code-algo-2', 'Algorithms', 'Write a function to find the longest common prefix among an array of strings.', 'coding', ['string manipulation', 'edge cases']),
    ],
    'Dynamic Programming': [
      q('code-dp-1', 'Dynamic Programming', 'Solve the climbing stairs problem: given n steps, how many distinct ways can you climb to the top taking 1 or 2 steps at a time?', 'coding', ['dynamic programming', 'Fibonacci', 'memoization']),
      q('code-dp-2', 'Dynamic Programming', 'Implement a function to find the longest increasing subsequence in an array of integers.', 'coding', ['LIS', 'dynamic programming', 'O(n log n)']),
    ],
  },
  hr: {
    General: [
      q('hr-1', 'General', 'Tell me about yourself and why you are interested in this role.', 'behavioral', ['self introduction', 'motivation', 'role alignment']),
      q('hr-2', 'General', 'What are your greatest strengths and how do they apply to this position?', 'behavioral', ['strengths', 'self-awareness', 'role fit']),
      q('hr-3', 'General', 'Where do you see yourself in five years? How does this role fit into your career plan?', 'behavioral', ['career planning', 'ambition', 'alignment']),
      q('hr-4', 'General', 'Why do you want to leave your current position?', 'behavioral', ['professional growth', 'positive framing']),
    ],
  },
  behavioral: {
    General: [
      q('behav-1', 'General', 'Describe a time when you faced a significant challenge at work. How did you handle it?', 'behavioral', ['STAR method', 'problem solving', 'resilience']),
      q('behav-2', 'General', 'Tell me about a time you had a conflict with a team member. How did you resolve it?', 'behavioral', ['conflict resolution', 'communication', 'teamwork']),
      q('behav-3', 'General', 'Describe a situation where you had to meet a tight deadline. How did you prioritize your work?', 'behavioral', ['time management', 'prioritization', 'stress']),
      q('behav-4', 'General', 'Give an example of a time you failed at something. What did you learn from it?', 'behavioral', ['failure', 'learning', 'growth mindset']),
      q('behav-5', 'General', 'Tell me about a time you had to persuade someone to see things your way.', 'behavioral', ['persuasion', 'communication', 'influence']),
    ],
  },
  system_design: {
    General: [
      q('sys-1', 'General', 'Design a URL shortening service like bit.ly. How would you handle high traffic and unique key generation?', 'system_design', ['scaling', 'hashing', 'database design', 'caching']),
      q('sys-2', 'General', 'Design a chat application that supports real-time messaging. What technologies and architecture would you use?', 'system_design', ['WebSocket', 'pub/sub', 'message queue', 'scaling']),
      q('sys-3', 'General', 'Design a rate limiter for an API. What algorithms would you consider and why?', 'system_design', ['token bucket', 'sliding window', 'Redis', 'distributed']),
      q('sys-4', 'General', 'How would you design a notification system that delivers emails, SMS, and push notifications?', 'system_design', ['message queue', 'fan-out', 'retry', 'idempotency']),
    ],
  },
  role_specific: {
    'Frontend Developer': [
      q('role-fe-1', 'Frontend Developer', 'How would you architect a large-scale frontend application to ensure maintainability and scalability?', 'open_ended', ['architecture', 'module organization', 'design patterns']),
      q('role-fe-2', 'Frontend Developer', 'What strategies would you use to optimize the initial load time of a single-page application?', 'open_ended', ['code splitting', 'lazy loading', 'SSR', 'critical CSS']),
    ],
    'Backend Developer': [
      q('role-be-1', 'Backend Developer', 'How would you design an API that supports both REST and GraphQL? What are the trade-offs?', 'open_ended', ['REST', 'GraphQL', 'API design', 'trade-offs']),
      q('role-be-2', 'Backend Developer', 'Explain how you would implement authentication and authorization in a microservices architecture.', 'open_ended', ['JWT', 'OAuth', 'API gateway', 'service-to-service auth']),
    ],
    'Full Stack Developer': [
      q('role-fs-1', 'Full Stack Developer', 'Describe how you would build a feature end-to-end, from database schema to user interface.', 'open_ended', ['full stack', 'database design', 'API', 'UI']),
    ],
  },
  custom: {
    General: [
      q('custom-1', 'General', 'Tell me about your experience with the technologies listed in your application.', 'open_ended', ['experience', 'technical depth']),
      q('custom-2', 'General', 'Describe a project you are particularly proud of. What was your role and what challenges did you overcome?', 'open_ended', ['project experience', 'problem solving', 'ownership']),
    ],
  },
};

export const generalQuestions: InterviewQuestion[] = [
  q('general-1', 'General', 'Walk me through your background and what makes you a good fit for this role.', 'behavioral', ['background', 'role fit']),
  q('general-2', 'General', 'What project are you most proud of and why?', 'behavioral', ['project pride', 'technical depth']),
];
