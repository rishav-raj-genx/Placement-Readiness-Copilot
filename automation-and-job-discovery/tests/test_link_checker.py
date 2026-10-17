import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from src.link_checker.checker import LiveLinkChecker


def test_checker_initialization():
    checker = LiveLinkChecker(headless=True)
    assert checker.headless is True
    assert checker.screenshot_dir.exists()


def test_ssrf_protection_blocks_localhost():
    checker = LiveLinkChecker(headless=True)
    res = checker.check_project_url("http://localhost:8000", save_to_db=False)
    assert res["is_live"] is False
    assert res["status_code"] == 403
    assert "Security Violation" in res["page_errors"][0]


def test_ssrf_protection_blocks_loopback_ip():
    checker = LiveLinkChecker(headless=True)
    res = checker.check_project_url("http://127.0.0.1:3000", save_to_db=False)
    assert res["is_live"] is False
    assert res["status_code"] == 403
    assert "Security Violation" in res["page_errors"][0]


def test_ssrf_protection_blocks_cloud_metadata():
    checker = LiveLinkChecker(headless=True)
    res = checker.check_project_url("http://169.254.169.254/latest/meta-data/", save_to_db=False)
    assert res["is_live"] is False
    assert res["status_code"] == 403


def test_ssrf_protection_blocks_non_http_schemes():
    is_safe, msg = LiveLinkChecker.is_safe_public_url("file:///etc/passwd")
    assert is_safe is False
    assert "Prohibited scheme" in msg

    is_safe, msg = LiveLinkChecker.is_safe_public_url("ftp://server.com")
    assert is_safe is False


def test_checker_offline_url():
    checker = LiveLinkChecker(headless=True, timeout_ms=3000)
    res = checker.check_project_url(
        url="https://non-existent-domain-12345678.invalid",
        student_id="test_student",
        save_to_db=False,
    )
    assert res["is_live"] is False
    assert res["quality_score"] == 0.0
    assert len(res["recommendations"]) > 0


def test_quality_score_calculation():
    checker = LiveLinkChecker(headless=True)
    score = checker._compute_quality_score(
        is_live=True,
        status_code=200,
        is_blank=False,
        page_errors=[],
        console_errors=[],
        mobile_friendly=True,
        load_time_ms=1200,
    )
    assert score == 100.0


def test_real_browser_captures_mobile_screenshot_and_page_errors(tmp_path, monkeypatch):
    html = b"""<!doctype html>
    <html><head><meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Integration Fixture</title></head>
    <body><main>Placement readiness integration fixture with enough visible content.</main>
    <script>console.error('fixture console error'); fetch('/missing');</script></body></html>"""

    class FixtureHandler(BaseHTTPRequestHandler):
        def do_GET(self) -> None:
            if self.path == "/missing":
                self.send_response(404)
                self.end_headers()
                return
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(html)))
            self.end_headers()
            self.wfile.write(html)

        def log_message(self, format: str, *args: object) -> None:
            return

    server = ThreadingHTTPServer(("127.0.0.1", 0), FixtureHandler)
    server_thread = threading.Thread(target=server.serve_forever, daemon=True)
    server_thread.start()
    checker = LiveLinkChecker(headless=True, timeout_ms=5000)
    checker.screenshot_dir = tmp_path
    monkeypatch.setattr(
        LiveLinkChecker,
        "is_safe_public_url",
        staticmethod(lambda url: (True, "Allowed only by local integration fixture")),
    )

    try:
        result = checker.check_project_url(
            f"http://127.0.0.1:{server.server_port}",
            save_to_db=False,
        )
    finally:
        server.shutdown()
        server.server_close()
        server_thread.join(timeout=2)

    screenshot_path = Path(result["screenshot_local_path"])
    assert result["is_live"] is True
    assert result["mobile_friendly"] is True
    assert result["content_evaluation"]["viewport_width"] == 375
    assert result["content_evaluation"]["viewport_height"] == 812
    assert screenshot_path.exists()
    assert screenshot_path.stat().st_size > 0
    assert "fixture console error" in result["console_errors"]
    assert any(error["error"] == "HTTP 404" for error in result["network_errors"])
