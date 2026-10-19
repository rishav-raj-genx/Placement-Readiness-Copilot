-- Seed Real Tech Jobs from Greenhouse & Lever

-- Generated automatically by placement automation pipeline



INSERT INTO public.discovered_jobs (
    id, title, company, location, url, source, description,
    required_skills, matched_skills, relevance_score, match_reason,
    is_remote, job_type, employment_type, publication_status, posted_at, updated_at
) VALUES (
    'rss_ffb596e15a15', 'Fullstack Web3 Engineer (Solidity / Rust / Typescript)', 'bondex', 'Remote / Worldwide',
    'https://weworkremotely.com/remote-jobs/bondex-fullstack-web3-engineer-solidity-rust-typescript', 'weworkremotely_rss', 'Headquarters: Remote - Americas, El Salvador URL: http://bondex.app We''re recruiting a Web 3 Fullstack Developer (Solidity / Rust / Typescript) who is looking for a new challenge and ready to join an exciting new chapter to expand our clients product value proposition in the DeFi Web3 realm.&nbsp; &nbsp; The client is is revoluzionezing financial interoperability and the requirements for the role are:&nbsp; &nbsp; Minimum 4 years of professional experience in WEB development; preferably with Typescript Experience as Fullstack Web3 developer at least 2 years in the following programming languages: Web3: High level of Solidity (demonstrated experience) / Rust FRONTEND: Typescript / Javascript / React / NodeJS BACKEND: NodeJS; nice to have Golang &amp; Python FLUENT proficient English , passable and/or with strong accent will not do. Ability to work with clients. Desirable experience in Smart contracts and DeFi protocols (curve, uniswap, AAVE etc); &nbsp; 100% Remote but ONLY residents of countries with US time zones (EST-PST) &nbsp; As a Web 3 Full stack developer , you''re main responsibilities will be:&nbsp; &nbsp; Participate in the entire software development lifecycle; Collaborate closely with developers and CTO to deliver high-quality software solutions; Troubleshoot and debug issues, providing timely resolutions; About the client:&nbsp; &nbsp; Remote first We prioritise an optimal work-life balance, ensuring ample time for relaxation and personal pursuits. Competitive salary according to experience and contributions Hiring process:&nbsp; &nbsp; Questionare application HR introduction call Technical interview + technical assesment Offer &nbsp; If you''re an experience web3 full stack developer eager to make a meaningful contribution to a cutting-edge project in the DeFi space, we would love to hear from you! &nbsp; &nbsp; &nbsp; To apply: https://weworkremotely.com/remote-jobs/bondex-fullstack-web3-engineer-solidity-rust-typescript',
    '["React", "TypeScript", "JavaScript"]'::jsonb, '["React", "TypeScript", "JavaScript"]'::jsonb, 77.5, 'Matches 3 core skill(s): React, TypeScript, JavaScript | Job title aligns directly with ''engineer'' | Remote / flexible work permitted',
    true, 'full_time', 'full_time',
    'published', 'Tue, 29 Sep 2026 19:13:52 +0000', now()
) ON CONFLICT (url) DO UPDATE SET
    title = EXCLUDED.title,
    company = EXCLUDED.company,
    relevance_score = EXCLUDED.relevance_score,
    match_reason = EXCLUDED.match_reason,
    publication_status = 'published',
    updated_at = now();

INSERT INTO public.discovered_jobs (
    id, title, company, location, url, source, description,
    required_skills, matched_skills, relevance_score, match_reason,
    is_remote, job_type, employment_type, publication_status, posted_at, updated_at
) VALUES (
    'rss_493e520837bb', 'Founding Forward Deployed Engineer', 'Alloy', 'Remote / Worldwide',
    'https://weworkremotely.com/remote-jobs/alloy-founding-forward-deployed-engineer', 'weworkremotely_rss', 'Headquarters: New York City, Remote Alloy is where you belong! Alloy is the AI-powered identity and fraud prevention platform that accelerates onboarding, stops fraud, and scales compliance across the customer lifecycle so financial organizations can grow without limits. More than 900 of the world''s leading financial institutions and fintechs trust Alloy for smarter risk management that drives growth. Through our values: Be Bold, Go Fast, Collaborate, and Celebrate Our Differences, we are creating a workplace where you can grow, thrive, and belong. See how we’ve been continuously recognized and named one of Inc. Magazine’s Best Workplaces , Forbes America’s Best Startup Employers , Best Fintech to Work for by American Banker , year after year. Check out our investors and read more about us here . About the team We''re standing up a new function at Alloy: Forward Deployed Engineering. Our largest enterprise customers need a trusted technical partner with a strong point of view on how Alloy fits into their tech stack and fraud strategy. As a Forward Deployed Engineer, you''ll be that partner - embedded with our most strategic accounts and owning the technical outcome end-to-end, with each deployment becoming the foundation for the next. You''ll be one of the first two engineers on this founding team. This is a software engineering role through and through - based within our Engineering org, with a scope that spans software, product, and solutions engineering. You won''t just join this function - you''ll define how it works. Alloy operates in a hybrid-work environment. We look to foster collaboration and community by having our local employees onsite three days a week. What you''ll be doing Architect and tune customer and channel-partner deployments end-to-end — API integrations, third-party data integrations, SDKs, and latency constraints. Write production code across our stack: TypeScript, JavaScript (ES6/React), Python (Django), Node.js, PostgreSQL, OpenSearch, and AWS. S',
    '["React", "TypeScript", "JavaScript"]'::jsonb, '["React", "TypeScript", "JavaScript"]'::jsonb, 77.5, 'Matches 3 core skill(s): React, TypeScript, JavaScript | Job title aligns directly with ''engineer'' | Remote / flexible work permitted',
    true, 'full_time', 'full_time',
    'published', 'Sun, 18 Oct 2026 07:31:05 +0000', now()
) ON CONFLICT (url) DO UPDATE SET
    title = EXCLUDED.title,
    company = EXCLUDED.company,
    relevance_score = EXCLUDED.relevance_score,
    match_reason = EXCLUDED.match_reason,
    publication_status = 'published',
    updated_at = now();

INSERT INTO public.discovered_jobs (
    id, title, company, location, url, source, description,
    required_skills, matched_skills, relevance_score, match_reason,
    is_remote, job_type, employment_type, publication_status, posted_at, updated_at
) VALUES (
    'rss_b9fe76be0a4b', 'FULL TIME: Software Engineer Position - React and Rest', 'Yooli', 'Remote / Worldwide',
    'https://weworkremotely.com/remote-jobs/yooli-full-time-software-engineer-position-react-and-rest-1', 'weworkremotely_rss', 'Headquarters: Australia URL: http://yooli.co Job description We are seeking a highly skilled Senior Software Engineer to join our team and contribute to the transformative tech evolution in healthcare.&nbsp; This critical role involves developing, integrating, and optimising our backend and database systems.&nbsp; You will work closely with our Chief Engineer and CTO to build and refine our software solutions, ensuring they remain at the cutting edge of innovation. &nbsp; Your Role: Develop and maintain robust backend services using NestJS and Node.js , ensuring top-tier performance and security. Design and manage efficient REST API endpoints to optimise interactions with our SQL database. Collaborate with cross-functional teams to define, design, and deploy new features, focusing on backend logic and database performance. Ensure the scalability, security, and responsiveness of backend services. Uphold rigorous data protection standards and implement industry-leading security measures. Participate in code reviews to uphold high coding standards and foster continuous improvement within the development team. &nbsp; What Youll Bring: Essential Skills &amp; Experience: At least 7 years of experience with: React React Vite REST API development Strong knowledge and hands-on experience with SQL . Proficiency in Prisma for database management. A minimum of 5 years of experience in REST API development using the NestJS framework . Expertise in backend development, specifically with NestJS , Node.js , REST APIs , and PostgreSQL . Experience in developing single-page applications using ReactJS . Strong understanding of TypeScript and Object-Oriented Programming (OOP) principles. Solid grasp of commonly used data structures . Proven experience with cloud hosting services (preferably AWS) and integrating them into development workflows. Exceptional problem-solving skills and meticulous attention to detail. A proven ability to thrive in collaborative, remote work environments, sh',
    '["React", "TypeScript"]'::jsonb, '["React", "TypeScript"]'::jsonb, 65.0, 'Matches 2 core skill(s): React, TypeScript | Job title aligns directly with ''engineer'' | Remote / flexible work permitted',
    true, 'full_time', 'full_time',
    'published', 'Wed, 05 Aug 2026 05:52:46 +0000', now()
) ON CONFLICT (url) DO UPDATE SET
    title = EXCLUDED.title,
    company = EXCLUDED.company,
    relevance_score = EXCLUDED.relevance_score,
    match_reason = EXCLUDED.match_reason,
    publication_status = 'published',
    updated_at = now();

INSERT INTO public.discovered_jobs (
    id, title, company, location, url, source, description,
    required_skills, matched_skills, relevance_score, match_reason,
    is_remote, job_type, employment_type, publication_status, posted_at, updated_at
) VALUES (
    'rss_196704085168', 'Software Engineer, AI Coding Tasks (Contract)', 'Askable', 'Remote / Worldwide',
    'https://weworkremotely.com/remote-jobs/askable-software-engineer-ai-coding-tasks-contract', 'weworkremotely_rss', 'Headquarters: Australia URL: https://www.askablelabs.com/ We''re looking for experienced software engineers to build AI coding tasks from a codebase they know well. US$1,000 per task, and you can do as many tasks as you want. You turn a real change from a repository you know into a task that today''s best AI coding models struggle with: hard for the models, but fair for a skilled engineer. Your tasks are used to measure and train AI coding models. Remote, any location. US$1,000 per task that passes review. Minimum of one task a week, about 10 hours a week. How it works Apply. Complete a short screener interview and upload your resume. Propose. Once you''re selected, pick a change from a repository you know and submit a short proposal. We approve it or suggest a better candidate. Build. In our platform, set up the repository as it was before the change, then write the brief, the correct solution and the grading checks. Stress-test. Try lazy, incorrect and shortcut solutions and make sure your checks catch them. Model testing. Run your task against leading AI models until strong models often fail but a skilled engineer can clearly solve it. Review. A reviewer checks your task and you revise it. Most tasks take more than one round. Next task. Once your task is accepted, start another. Requirements 2+ years of professional software engineering Code merged into a public open-source repository, ideally one you know well. A private codebase you own may also qualify (not employer or client code) Strong in at least one of Python, TypeScript, Go, Rust, Java or C++ Solid with Docker, Linux, Git and automated testing Regular use of an AI coding tool Experience writing tests, rubrics or evaluation criteria, ideally for AI models You can explain a change clearly and concisely, in your own words At least 10 hours a week, starting now A secure personal or work computer (no public or shared machines) Nice to have Deep expertise in one area, such as databases, compilers, distributed sys',
    '["TypeScript"]'::jsonb, '["TypeScript"]'::jsonb, 52.5, 'Matches 1 core skill(s): TypeScript | Job title aligns directly with ''engineer'' | Remote / flexible work permitted',
    true, 'full_time', 'full_time',
    'published', 'Fri, 16 Oct 2026 00:50:53 +0000', now()
) ON CONFLICT (url) DO UPDATE SET
    title = EXCLUDED.title,
    company = EXCLUDED.company,
    relevance_score = EXCLUDED.relevance_score,
    match_reason = EXCLUDED.match_reason,
    publication_status = 'published',
    updated_at = now();

INSERT INTO public.discovered_jobs (
    id, title, company, location, url, source, description,
    required_skills, matched_skills, relevance_score, match_reason,
    is_remote, job_type, employment_type, publication_status, posted_at, updated_at
) VALUES (
    'gh_reddit_7792848', 'Ads Conversion Modeling, Machine Learning Engineering Manager', 'Reddit', 'Remote - United States',
    'https://job-boards.greenhouse.io/reddit/jobs/7792848', 'greenhouse_ats', '&lt;div class=&quot;content-intro&quot;&gt;&lt;div class=&quot;c-message_kit__blocks c-message_kit__blocks--rich_text&quot;&gt; &lt;div class=&quot;c-message__message_blocks c-message__message_blocks--rich_text&quot; data-qa=&quot;message-text&quot;&gt; &lt;div class=&quot;p-block_kit_renderer&quot; data-qa=&quot;block-kit-renderer&quot;&gt; &lt;div class=&quot;p-block_kit_renderer__block_wrapper p-block_kit_renderer__block_wrapper--first&quot;&gt; &lt;div class=&quot;p-rich_text_block&quot;&gt; &lt;div class=&quot;p-rich_text_section&quot;&gt;Reddit is a community of communities. It’s built on shared interests, passion, and trust, and is home to the most open and authentic conversations on the internet. Every day, Reddit users submit, vote, and comment on the topics they care most about. With 100,000+ active communities and approximately 130 million daily active unique visitors, Reddit is one of the internet’s largest sources of information. For more information, visit &lt;a class=&quot;c-link&quot; href=&quot;http://www.redditinc.com/&quot; target=&quot;_blank&quot; data-stringify-link=&quot;http://redditinc.com&quot; data-sk=&quot;tooltip_parent&quot;&gt;www.redditinc.com&lt;/a&gt;.&lt;/div&gt; &lt;/div&gt; &lt;/div&gt; &lt;/div&gt; &lt;/div&gt; &lt;/div&gt;&lt;/div&gt;&lt;p&gt;Reddit’s lower funnel business is rapidly growing and pushing the heavy ranking web conversion models towards state-of-the-art is critical for continued growth. The Conversion modeling Team plays a pivotal role in developing and maintaining machine learning models that drive user conversions from Reddit Ads, with a special focus on predictive modeling around interactions like purchase, signup, add to cart, and other lower funnel user actions.&amp;nbsp;&lt;/p&gt; &lt;p&gt;As we expand our machine learning infrastructure and incorporate new engagement signals, we are looking for a skilled Engineering Manager who can lead this critical team. This role is well-suited for a leader with deep mac',
    '["React", "TypeScript", "JavaScript", "Next.js"]'::jsonb, '[]'::jsonb, 50.0, 'Job title aligns directly with ''engineer'' | Student-friendly role (intern) | Remote / flexible work permitted',
    true, 'internship/entry-level', 'internship',
    'published', '2026-10-18T20:30:59-04:00', now()
) ON CONFLICT (url) DO UPDATE SET
    title = EXCLUDED.title,
    company = EXCLUDED.company,
    relevance_score = EXCLUDED.relevance_score,
    match_reason = EXCLUDED.match_reason,
    publication_status = 'published',
    updated_at = now();

INSERT INTO public.discovered_jobs (
    id, title, company, location, url, source, description,
    required_skills, matched_skills, relevance_score, match_reason,
    is_remote, job_type, employment_type, publication_status, posted_at, updated_at
) VALUES (
    'gh_gitlab_8704363002', 'Backend Engineer (Python),AI Engineering: Agent Foundations', 'Gitlab', 'Remote, Canada; Remote, Poland; Remote, United Kingdom',
    'https://job-boards.greenhouse.io/gitlab/jobs/8704363002', 'greenhouse_ats', '&lt;div class=&quot;content-intro&quot;&gt;&lt;p&gt;GitLab is the intelligent orchestration platform for DevSecOps. GitLab enables organizations to increase developer productivity, improve operational efficiency, reduce security and compliance risk, and accelerate digital transformation. More than 50 million registered users and more than 50% of the Fortune 100* trust GitLab to ship better, more secure software faster.&lt;/p&gt; &lt;p&gt;The same principles built into our products are reflected in how our team works: we embrace AI as a core productivity multiplier, with all team members expected to incorporate AI into their daily workflows to drive efficiency, innovation, and impact. GitLab is where careers accelerate, innovation flourishes, and every voice is valued. Our high-performance culture is driven by our values&amp;nbsp;and continuous knowledge exchange, enabling our team members to reach their full potential while collaborating with industry leaders to solve complex problems. &lt;a href=&quot;https://www.youtube.com/watch?v=OuZIb5zszQI&quot;&gt;Co-create the future with us&lt;/a&gt; as we build technology that transforms how the world develops software.&lt;/p&gt; &lt;p&gt;*&lt;em&gt;Fortune 500® is a registered trademark of Fortune Media IP Limited, used under license. Claim based on GitLab data. Fortune 100 refers to the top 20% ranked companies in the 2025 Fortune 500 list, published in June 2025. Fortune and Fortune Media IP Limited are not affiliated with, and do not endorse products or services of GitLab.&lt;/em&gt;&lt;/p&gt;&lt;/div&gt;&lt;h2&gt;&lt;strong&gt;An overview of this role&lt;/strong&gt;&lt;/h2&gt; &lt;p&gt;As an Intermediate Backend Engineer (Python) in GitLab&#39;s Agent Foundations stage, you&#39;ll go beyond using AI tools. You&#39;ll help build the foundations for GitLab&#39;s agentic AI experiences: the platform that lets AI agents work across the whole software delivery lifecycle, not just write code. That covers the reusable buildi',
    '["Python"]'::jsonb, '["Python"]'::jsonb, 50.0, 'Matches 1 core skill(s): Python | Job title aligns directly with ''backend engineer'' | Remote / flexible work permitted',
    true, 'full_time', 'full_time',
    'published', '2026-10-15T15:24:46-04:00', now()
) ON CONFLICT (url) DO UPDATE SET
    title = EXCLUDED.title,
    company = EXCLUDED.company,
    relevance_score = EXCLUDED.relevance_score,
    match_reason = EXCLUDED.match_reason,
    publication_status = 'published',
    updated_at = now();

INSERT INTO public.discovered_jobs (
    id, title, company, location, url, source, description,
    required_skills, matched_skills, relevance_score, match_reason,
    is_remote, job_type, employment_type, publication_status, posted_at, updated_at
) VALUES (
    'gh_reddit_8282760', 'Analytics Engineer', 'Reddit', 'Remote - United States',
    'https://job-boards.greenhouse.io/reddit/jobs/8282760', 'greenhouse_ats', '&lt;div class=&quot;content-intro&quot;&gt;&lt;div class=&quot;c-message_kit__blocks c-message_kit__blocks--rich_text&quot;&gt; &lt;div class=&quot;c-message__message_blocks c-message__message_blocks--rich_text&quot; data-qa=&quot;message-text&quot;&gt; &lt;div class=&quot;p-block_kit_renderer&quot; data-qa=&quot;block-kit-renderer&quot;&gt; &lt;div class=&quot;p-block_kit_renderer__block_wrapper p-block_kit_renderer__block_wrapper--first&quot;&gt; &lt;div class=&quot;p-rich_text_block&quot;&gt; &lt;div class=&quot;p-rich_text_section&quot;&gt;Reddit is a community of communities. It’s built on shared interests, passion, and trust, and is home to the most open and authentic conversations on the internet. Every day, Reddit users submit, vote, and comment on the topics they care most about. With 100,000+ active communities and approximately 130 million daily active unique visitors, Reddit is one of the internet’s largest sources of information. For more information, visit &lt;a class=&quot;c-link&quot; href=&quot;http://www.redditinc.com/&quot; target=&quot;_blank&quot; data-stringify-link=&quot;http://redditinc.com&quot; data-sk=&quot;tooltip_parent&quot;&gt;www.redditinc.com&lt;/a&gt;.&lt;/div&gt; &lt;/div&gt; &lt;/div&gt; &lt;/div&gt; &lt;/div&gt; &lt;/div&gt;&lt;/div&gt;&lt;p&gt;We are looking for a talented and driven individual to be a key part of our Analytics Engineering team within the Data Science organization. We are looking for someone who can work closely with Data Scientists and Engineers across diverse areas of the organization (Consumer, Ads, and Marketing) to curate, develop, and deploy the right data and analytic tooling to drive Reddit’s product forward and provide a data and tooling foundation that will last decades. Your work will empower thousands of your colleagues to improve the user experience and grow our consumer base.&lt;/p&gt; &lt;p&gt;Successful candidates have a strong track record of understanding and deeply caring about the purpose of ',
    '["Python", "FastAPI", "Django", "SQL", "PostgreSQL"]'::jsonb, '[]'::jsonb, 50.0, 'Job title aligns directly with ''engineer'' | Student-friendly role (intern) | Remote / flexible work permitted',
    true, 'internship/entry-level', 'internship',
    'published', '2026-10-18T20:31:00-04:00', now()
) ON CONFLICT (url) DO UPDATE SET
    title = EXCLUDED.title,
    company = EXCLUDED.company,
    relevance_score = EXCLUDED.relevance_score,
    match_reason = EXCLUDED.match_reason,
    publication_status = 'published',
    updated_at = now();

INSERT INTO public.discovered_jobs (
    id, title, company, location, url, source, description,
    required_skills, matched_skills, relevance_score, match_reason,
    is_remote, job_type, employment_type, publication_status, posted_at, updated_at
) VALUES (
    'rss_19161b2842bf', 'Analytics Engineer, Data', 'Tailscale', 'Remote / Worldwide',
    'https://weworkremotely.com/remote-jobs/tailscale-analytics-engineer-data', 'weworkremotely_rss', 'Headquarters: Remote (Canada) Thank you for considering Tailscale. If this job description resonates with you, please apply.&nbsp; Frequently cited statistics show that people who identify with historically marginalized groups are likely to apply to jobs only if they meet 100% of the qualifications. We encourage you to help us break that statistic! About Tailscale&nbsp; Tailscale is making safe connection effortless by delivering software that makes it easy to securely interconnect people and their devices, no matter where they are. From hobbyists to multinational corporations, teams of every size use Tailscale each day to protect their networks, share access to internal tools, and more. We''re building a future for the Internet that''s easy, sensible, and safe, like it used to be. Founded in 2019 and fully distributed, we''re backed by Accel, CRV, Insight, Heavybit, and Uncork Capital. About the Role We are looking for an Analytics Engineer who thrives in high-complexity environments—someone excited to bring clarity to chaos, untangle complex models, and lay down the foundation for scalable solutions. This is a hands-on, high-impact role for someone who isn’t afraid to address manual processes, viewing them as opportunities to build scalable solutions that drive meaningful impact. You’ll work closely with stakeholders across the company to build reliable, trusted data models that support reporting, analysis, and decision-making. Key Responsibilities Dive into complex systems and manual workflows to develop an understanding of our tools and constraints. Thoughtfully design and maintain clean, scalable, production-grade dbt models (e.g., ARR, revenue recognition). Work across the full data pipeline, from ingestion to transformation to visualization. Take a pragmatic approach to system challenges, balancing quick fixes with thoughtful long-term design. Collaborate with Finance, Engineering, Sales, and other teams across the company to understand data needs and deliver ti',
    '["Data"]'::jsonb, '["Data"]'::jsonb, 67.5, 'Matches 1 core skill(s): Data | Job title aligns directly with ''engineer'' | Student-friendly role (intern) | Remote / flexible work permitted',
    true, 'internship/entry-level', 'internship',
    'published', 'Wed, 30 Sep 2026 07:31:24 +0000', now()
) ON CONFLICT (url) DO UPDATE SET
    title = EXCLUDED.title,
    company = EXCLUDED.company,
    relevance_score = EXCLUDED.relevance_score,
    match_reason = EXCLUDED.match_reason,
    publication_status = 'published',
    updated_at = now();

INSERT INTO public.discovered_jobs (
    id, title, company, location, url, source, description,
    required_skills, matched_skills, relevance_score, match_reason,
    is_remote, job_type, employment_type, publication_status, posted_at, updated_at
) VALUES (
    'gh_datadog_8181440', 'Applied Science Intern', 'Datadog', 'Paris, France',
    'https://careers.datadoghq.com/detail/8181440/?gh_jid=8181440', 'greenhouse_ats', '&lt;p&gt;As an Applied Science Intern, you will join a cross-functional team of engineers and applied scientists building AI-powered features within the Datadog platform. You will contribute to both existing and new products by improving machine learning models, developing new AI capabilities, and helping bring research into production. Working closely with engineering and product partners, you&#39;ll gain hands-on experience deploying AI systems at scale while strengthening your product mindset, collaboration, and communication skills. You&#39;ll also have opportunities to contribute to cutting-edge research that directly powers customer-facing features.&lt;/p&gt; &lt;p&gt;At Datadog, we place value in our office culture - the relationships and collaboration it builds and the creativity it brings to the table. We operate as a hybrid workplace to ensure our Datadogs can create a work-life harmony that best fits them.&lt;/p&gt; &lt;p&gt;&amp;nbsp;&lt;/p&gt; &lt;p&gt;&lt;strong&gt;What You’ll Do:&lt;/strong&gt;&lt;/p&gt; &lt;ul&gt; &lt;li&gt;Design solutions for AI use cases by researching and benchmarking state-of-the-art models to identify the best approach&lt;/li&gt; &lt;li&gt;Build highly scalable product features using generative AI, machine learning algorithms, and statistical techniques&lt;/li&gt; &lt;li&gt;Contribute to the development, deployment, monitoring, and maintenance of production AI models, services, and infrastructure&lt;/li&gt; &lt;li&gt;Explore, analyze, and derive insights from the large-scale observability data flowing through Datadog systems&lt;/li&gt; &lt;li&gt;Participate in technical knowledge sharing by presenting recent academic research and investigating emerging model architectures to improve existing and future products&lt;/li&gt; &lt;li&gt;Collaborate with engineering and product teams to productionize AI solutions and deliver customer-facing features&lt;/li&gt; &lt;/ul&gt; &lt;p&gt;&amp;nbsp;&lt;/p&gt; &lt;p&gt;&lt;strong&gt;Who You A',
    '["Machine Learning", "Data"]'::jsonb, '["Machine Learning", "Data"]'::jsonb, 65.0, 'Matches 2 core skill(s): Machine Learning, Data | Job title aligns directly with ''intern'' | Student-friendly role (intern)',
    false, 'internship/entry-level', 'internship',
    'published', '2026-09-29T13:18:57-04:00', now()
) ON CONFLICT (url) DO UPDATE SET
    title = EXCLUDED.title,
    company = EXCLUDED.company,
    relevance_score = EXCLUDED.relevance_score,
    match_reason = EXCLUDED.match_reason,
    publication_status = 'published',
    updated_at = now();
