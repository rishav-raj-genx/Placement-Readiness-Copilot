import pytest
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
        save_to_db=False
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
        load_time_ms=1200
    )
    assert score == 100.0
