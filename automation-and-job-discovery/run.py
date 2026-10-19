import argparse
import json
import sys
from pathlib import Path

from rich.console import Console
from rich.panel import Panel
from rich.table import Table

from src.job_discovery.aggregator import JobAggregator
from src.link_checker.checker import LiveLinkChecker
from src.readiness_score.calculator import PlacementReadinessCalculator
from src.readiness_score.models import StudentProfileEvaluation

console = Console()


def cmd_check_link(args):
    """Executes live link check with Playwright."""
    url = args.url
    console.print(
        Panel(
            f"[bold cyan]Testing Live Project Link:[/bold cyan] {url}",
            title="Module: Live Link Checker",
        )
    )

    checker = LiveLinkChecker()
    with console.status("[bold green]Launching headless browser & emulating mobile device..."):
        result = checker.check_project_url(
            url=url,
            student_id=args.student_id,
            project_name=args.name,
            claimed_keywords=args.keywords.split(",") if args.keywords else None,
        )

    # Render summary table
    table = Table(
        title="Live Link Evaluation Report", show_header=True, header_style="bold magenta"
    )
    table.add_column("Metric", style="dim")
    table.add_column("Result")

    status_icon = "🟢" if result["is_live"] else "🔴"
    table.add_row(
        "Live Status",
        f"{status_icon} {'ONLINE' if result['is_live'] else 'OFFLINE'} (HTTP {result['status_code']})",
    )
    table.add_row("Page Load Time", f"{result['load_time_ms']} ms")
    table.add_row(
        "Mobile Friendly",
        "✅ Yes" if result["mobile_friendly"] else "❌ Horizontal Overflow / Missing Meta",
    )
    table.add_row("Quality Score", f"[bold yellow]{result['quality_score']}/100[/bold yellow]")
    table.add_row("Console Errors", str(len(result["console_errors"])))
    table.add_row(
        "Screenshot Saved", result.get("screenshot_local_path") or result.get("screenshot_url")
    )

    console.print(table)

    if result.get("recommendations"):
        console.print("\n[bold yellow]Actionable Recommendations:[/bold yellow]")
        for tip in result["recommendations"]:
            console.print(f" • {tip}")

    console.print(f"\n[green]Database sync status:[/green] Stored to {result.get('id')}")


def cmd_discover_jobs(args):
    """Executes compliant job discovery."""
    skills = [s.strip() for s in args.skills.split(",") if s.strip()]
    console.print(
        Panel(
            f"[bold cyan]Target Skills:[/bold cyan] {', '.join(skills)}\n"
            f"[bold cyan]Target Role:[/bold cyan] {args.role}",
            title="Module: Compliant Job Discovery",
        )
    )

    aggregator = JobAggregator()
    with console.status("[bold green]Querying Greenhouse ATS, Lever ATS & RSS Feeds..."):
        jobs = aggregator.discover_jobs(
            student_skills=skills,
            target_role=args.role,
            boolean_query=args.query,
            max_results=args.limit,
        )

    if not jobs:
        console.print("[yellow]No matching jobs found with current search filters.[/yellow]")
        return

    table = Table(
        title=f"Discovered Opportunities ({len(jobs)} matches)",
        show_header=True,
        header_style="bold blue",
    )
    table.add_column("Match %", style="bold green", justify="center")
    table.add_column("Role / Company", style="bold")
    table.add_column("Source", style="dim")
    table.add_column("Why Matched", style="cyan")
    table.add_column("Apply Link")

    for j in jobs:
        table.add_row(
            f"{j['relevance_score']}%",
            f"{j['title']}\n[dim]{j['company']} ({j['location']})[/dim]",
            j["source"],
            j["match_reason"][:120],
            j["url"][:40] + "...",
        )

    console.print(table)
    console.print(
        "\n[dim]Compliant search executed across ATS & RSS. Stored to Supabase / local DB.[/dim]"
    )


def cmd_seed_jobs(args):
    """Fetches real tech jobs across multiple roles, exports a SQL seed file, and syncs to DB."""
    console.print(
        Panel(
            "[bold cyan]Seeding Real Tech Jobs from Greenhouse ATS, Lever ATS & RSS Feeds[/bold cyan]",
            title="Module: Job Board Seeder",
        )
    )
    aggregator = JobAggregator()
    profiles = [
        {"skills": ["React", "TypeScript", "JavaScript", "Next.js"], "role": "Frontend Engineer"},
        {"skills": ["Python", "FastAPI", "Django", "SQL", "PostgreSQL"], "role": "Backend Engineer"},
        {"skills": ["React", "Node.js", "Python", "TypeScript"], "role": "Full Stack Engineer"},
        {"skills": ["Python", "Machine Learning", "Data", "SQL"], "role": "Software Engineer Intern"},
    ]
    all_seeded_jobs = []
    seen_urls = set()

    for p in profiles:
        with console.status(f"[bold green]Discovering {p['role']} roles..."):
            jobs = aggregator.discover_jobs(
                student_skills=p["skills"],
                target_role=p["role"],
                max_results=args.limit_per_role,
                save_to_db=True,
            )
            for j in jobs:
                if j["url"] not in seen_urls:
                    seen_urls.add(j["url"])
                    all_seeded_jobs.append(j)

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    sql_statements = [
        "-- Seed Real Tech Jobs from Greenhouse & Lever",
        "-- Generated automatically by placement automation pipeline",
        "",
    ]
    for j in all_seeded_jobs:
        def esc(val):
            return str(val or "").replace("'", "''")

        skills_json = json.dumps(j.get("matched_skills", [])).replace("'", "''")
        req_skills_json = json.dumps(j.get("required_skills", [])).replace("'", "''")
        is_remote_str = "true" if j.get("is_remote") else "false"
        posted_at_sql = f"'{esc(j.get('posted_at'))}'" if j.get("posted_at") else "now()"

        sql = f"""INSERT INTO public.discovered_jobs (
    id, title, company, location, url, source, description,
    required_skills, matched_skills, relevance_score, match_reason,
    is_remote, job_type, employment_type, publication_status, posted_at, updated_at
) VALUES (
    '{esc(j['id'])}', '{esc(j['title'])}', '{esc(j['company'])}', '{esc(j.get('location', 'Remote'))}',
    '{esc(j['url'])}', '{esc(j['source'])}', '{esc(j.get('description', ''))}',
    '{req_skills_json}'::jsonb, '{skills_json}'::jsonb, {j.get('relevance_score', 0)}, '{esc(j.get('match_reason', ''))}',
    {is_remote_str}, '{esc(j.get('job_type', 'full_time'))}', '{esc(j.get('employment_type', 'full_time'))}',
    'published', {posted_at_sql}, now()
) ON CONFLICT (url) DO UPDATE SET
    title = EXCLUDED.title,
    company = EXCLUDED.company,
    relevance_score = EXCLUDED.relevance_score,
    match_reason = EXCLUDED.match_reason,
    publication_status = 'published',
    updated_at = now();"""
        sql_statements.append(sql)

    output_path.write_text("\n\n".join(sql_statements) + "\n", encoding="utf-8")

    console.print(
        f"\n[bold green]Successfully collected {len(all_seeded_jobs)} real jobs![/bold green]"
    )
    console.print(f"[bold cyan]Exported SQL seed file to:[/bold cyan] {output_path}")
    console.print(
        "[dim]You can run this SQL directly in the Supabase SQL Editor to populate the live Job Board immediately.[/dim]"
    )


def cmd_calculate_score(args):
    """Executes Module 4 placement readiness score calculation."""
    input_file = Path(args.file)
    if not input_file.exists():
        console.print(f"[red]Error: File {input_file} does not exist.[/red]")
        sys.exit(1)

    with open(input_file, "r") as f:
        data = json.load(f)

    profile = StudentProfileEvaluation(**data)
    calculator = PlacementReadinessCalculator()
    report = calculator.calculate_readiness(profile)

    tier_color = (
        "green"
        if report.readiness_level == "Placement ready"
        else ("yellow" if report.readiness_level == "Almost ready" else "red")
    )

    console.print(
        Panel(
            f"[bold]Student ID:[/bold] {report.student_id}\n"
            f"[bold]Total Readiness Score:[/bold] [{tier_color}]{report.total_score}/100[/{tier_color}]\n"
            f"[bold]Readiness Level:[/bold] [{tier_color}]{report.readiness_level}[/{tier_color}]",
            title="Module 4: Placement Readiness Score",
        )
    )

    # Breakdown Table
    table = Table(
        title="Weighted Component Breakdown (100% Total)",
        show_header=True,
        header_style="bold cyan",
    )
    table.add_column("Component")
    table.add_column("Weight")
    table.add_column("Raw Score", justify="center")
    table.add_column("Weighted Points", justify="center")

    for cat, info in report.category_scores.items():
        table.add_row(
            cat.replace("_", " ").title(),
            f"{int(info['weight'] * 100)}%",
            f"{info['raw_score']}/100",
            f"{info['weighted_points']} pts",
        )
    console.print(table)

    # Top 5 actions
    console.print("\n[bold gold1]Top 5 Actions That Would Raise Your Score Most:[/bold gold1]")
    for act in report.top_actions:
        console.print(
            f" [bold]{act.rank}. [{act.category}][/bold] {act.action} "
            f"[bold green](+{act.potential_point_gain} pts)[/bold green]\n"
            f"    [dim]{act.description}[/dim]"
        )


def cmd_demo(args):
    """Runs a complete end-to-end demo of all 3 tasks."""
    console.rule("[bold magenta]🚀 Placement Readiness Automation Showcase[/bold magenta]")

    # 1. Live Link Check
    console.print("\n[bold cyan]TASK 1: Live Link Check with Headless Playwright[/bold cyan]")
    test_url = "https://example.com"
    checker = LiveLinkChecker()
    with console.status("Checking sample live project link..."):
        chk_res = checker.check_project_url(
            url=test_url, student_id="demo_student_rituraj", project_name="Portfolio Demo"
        )
    console.print(
        f" -> URL: {test_url} | Live: {chk_res['is_live']} | Quality Score: {chk_res['quality_score']}/100"
    )
    console.print(f" -> Mobile Screenshot captured: {chk_res['screenshot_local_path']}")

    # 2. Compliant Job Discovery
    console.print(
        "\n[bold cyan]TASK 2: Compliant Job Discovery (Greenhouse, Lever & RSS)[/bold cyan]"
    )
    aggregator = JobAggregator()
    with console.status("Aggregating live tech opportunities..."):
        jobs = aggregator.discover_jobs(
            student_skills=["React", "Python", "TypeScript"],
            target_role="Software Engineer Intern",
            max_results=5,
        )
    console.print(f" -> Discovered {len(jobs)} relevant opportunities matching student profile:")
    for j in jobs[:3]:
        console.print(
            f"    • [{j['source']}] [bold]{j['title']}[/bold] at {j['company']} ({j['relevance_score']}% match) - {j['match_reason']}"
        )

    # 3. Readiness Score Math
    console.print("\n[bold cyan]TASK 3: Readiness Score Math (Module 4 Table Weights)[/bold cyan]")
    sample_file = Path("data/sample_student_input.json")
    with open(sample_file, "r") as f:
        data = json.load(f)
    profile = StudentProfileEvaluation(**data)
    calculator = PlacementReadinessCalculator()
    report = calculator.calculate_readiness(profile)
    console.print(
        f" -> Total Score: [bold green]{report.total_score}/100[/bold green] | Level: [bold]{report.readiness_level}[/bold]"
    )
    console.print(
        f" -> Top Action Item: {report.top_actions[0].action} (+{report.top_actions[0].potential_point_gain} pts)"
    )

    console.rule("[bold green]✅ All 3 Automation Modules Executed Successfully[/bold green]")


def cmd_serve(args):
    """Starts the FastAPI development server."""
    import uvicorn

    console.print(
        f"[bold green]Starting Webhook/API Server on http://{args.host}:{args.port}[/bold green]"
    )
    uvicorn.run("src.api.server:app", host=args.host, port=args.port, reload=True)


def main():
    parser = argparse.ArgumentParser(
        description="Automation, Job Discovery & Live-Link Checking CLI"
    )
    subparsers = parser.add_subparsers(dest="command")

    # Command: check-link
    p_link = subparsers.add_parser(
        "check-link", help="Test a live project URL with mobile screenshot and error checks"
    )
    p_link.add_argument("url", help="Project web application URL")
    p_link.add_argument("--student-id", default="student_cli", help="Student ID")
    p_link.add_argument("--name", default="Project", help="Project name")
    p_link.add_argument(
        "--keywords", help="Comma-separated keywords to verify against page content"
    )

    # Command: discover-jobs
    p_jobs = subparsers.add_parser(
        "discover-jobs", help="Discover relevant jobs matching skills using boolean search"
    )
    p_jobs.add_argument(
        "--skills", default="React, TypeScript, Python", help="Comma-separated skills"
    )
    p_jobs.add_argument("--role", default="Software Engineer Intern", help="Target role")
    p_jobs.add_argument("--query", help="Custom boolean search query")
    p_jobs.add_argument("--limit", type=int, default=15, help="Max results to fetch")

    # Command: calculate-score
    p_score = subparsers.add_parser(
        "calculate-score", help="Calculate Module 4 placement readiness score"
    )
    p_score.add_argument(
        "--file", default="data/sample_student_input.json", help="Path to student profile JSON"
    )

    # Command: seed-jobs
    p_seed = subparsers.add_parser(
        "seed-jobs", help="Fetch real jobs across multiple profiles and export seed SQL"
    )
    p_seed.add_argument("--limit-per-role", type=int, default=15, help="Jobs per role")
    p_seed.add_argument(
        "--output", default="data/seed_discovered_jobs.sql", help="Path to output SQL seed file"
    )

    # Command: demo
    subparsers.add_parser("demo", help="Run end-to-end demonstration of all 3 tasks")

    # Command: serve
    p_serve = subparsers.add_parser(
        "serve", help="Run FastAPI server for webhook/serverless endpoints"
    )
    p_serve.add_argument("--host", default="0.0.0.0", help="Host address")
    p_serve.add_argument("--port", type=int, default=8000, help="Port number")

    args = parser.parse_args()

    if args.command == "check-link":
        cmd_check_link(args)
    elif args.command == "discover-jobs":
        cmd_discover_jobs(args)
    elif args.command == "seed-jobs":
        cmd_seed_jobs(args)
    elif args.command == "calculate-score":
        cmd_calculate_score(args)
    elif args.command == "demo":
        cmd_demo(args)
    elif args.command == "serve":
        cmd_serve(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
