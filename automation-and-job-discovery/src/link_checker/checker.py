import ipaddress
import os
import re
import threading
import time
import urllib.parse
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from playwright.sync_api import (
    Error as PlaywrightError,
)
from playwright.sync_api import (
    Page,
    sync_playwright,
)
from playwright.sync_api import (
    TimeoutError as PlaywrightTimeoutError,
)

from src import config
from src.db.supabase_client import db_client

# Bounded global concurrency pool for Chromium browser instances
MAX_CONCURRENT_BROWSERS = int(os.environ.get("MAX_CONCURRENT_BROWSERS", "3"))
_BROWSER_SEMAPHORE = threading.Semaphore(MAX_CONCURRENT_BROWSERS)


class LiveLinkChecker:
    """
    Automated Headless Browser Link Checker using Playwright.
    Emulates mobile devices, captures screenshots, tracks console/network errors,
    and validates if the web application renders cleanly without white-screens.
    """

    def __init__(
        self, headless: bool = config.HEADLESS_BROWSER, timeout_ms: int = config.BROWSER_TIMEOUT_MS
    ):
        self.headless = headless
        self.timeout_ms = timeout_ms
        self.screenshot_dir = config.SCREENSHOT_DIR
        self.screenshot_dir.mkdir(parents=True, exist_ok=True)

    def _sanitize_filename(self, url: str) -> str:
        clean = re.sub(r"https?://", "", url)
        clean = re.sub(r"[^a-zA-Z0-9_\-\.]", "_", clean)
        return clean[:60]

    @staticmethod
    def is_safe_public_url(url_str: str) -> Tuple[bool, str]:
        """
        SSRF Protection: Validates URL scheme and ensures host does not resolve
        to private, loopback, or cloud-metadata IP ranges.
        """
        import ipaddress
        import socket

        try:
            parsed = urllib.parse.urlparse(url_str)
            if parsed.scheme not in ("http", "https"):
                return (
                    False,
                    f"Prohibited scheme: '{parsed.scheme}'. Only HTTP and HTTPS are allowed.",
                )

            hostname = parsed.hostname
            if not hostname:
                return False, "Invalid URL: missing hostname."

            # Block common loopback hostnames
            if hostname.lower() in ("localhost", "127.0.0.1", "::1", "metadata.google.internal"):
                return False, f"Prohibited host: '{hostname}' is not a public routable address."

            # Resolve DNS
            try:
                addr_info = socket.getaddrinfo(hostname, None)
                for entry in addr_info:
                    ip_str = entry[4][0]
                    ip = ipaddress.ip_address(ip_str)
                    if (
                        ip.is_private
                        or ip.is_loopback
                        or ip.is_link_local
                        or ip.is_reserved
                        or ip.is_multicast
                    ):
                        return (
                            False,
                            f"Prohibited destination: '{hostname}' resolves to private/internal IP {ip_str}.",
                        )
            except socket.gaierror:
                return False, f"DNS resolution failed for hostname '{hostname}'."

            return True, "URL is safe."
        except Exception as e:
            return False, f"URL validation error: {str(e)}"

    def check_project_url(
        self,
        url: str,
        student_id: str = "student_demo",
        project_name: str = "Student Project",
        claimed_keywords: Optional[List[str]] = None,
        save_to_db: bool = True,
    ) -> Dict[str, Any]:
        """
        Runs full verification of a student's deployed live link with SSRF protection.
        """
        if not url.startswith("http://") and not url.startswith("https://"):
            url = "https://" + url

        # 1. SSRF Protection check
        is_safe, ssrf_reason = self.is_safe_public_url(url)
        if not is_safe:
            return {
                "id": f"chk_blocked_{int(time.time())}",
                "student_id": student_id,
                "project_name": project_name,
                "project_url": url,
                "is_live": False,
                "status_code": 403,
                "load_time_ms": 0,
                "mobile_friendly": False,
                "screenshot_url": "",
                "screenshot_local_path": "",
                "console_errors": [],
                "console_warnings": [],
                "network_errors": [],
                "page_errors": [f"Security Violation: {ssrf_reason}"],
                "content_evaluation": {"is_blank_page": True},
                "quality_score": 0.0,
                "recommendations": [f"Deploy to a public internet URL. {ssrf_reason}"],
                "passed": False,
            }

        start_time = time.time()
        console_errors: List[str] = []
        console_warnings: List[str] = []
        network_errors: List[Dict[str, str]] = []
        page_errors: List[str] = []

        is_live = False
        status_code = None
        screenshot_local_path: Optional[Path] = None
        mobile_friendly = False
        is_blank_page = True
        page_title = ""
        body_text_length = 0
        horizontal_overflow = False
        matched_keywords: List[str] = []

        # Playwright mobile device emulation (iPhone 13 style)
        mobile_device = {
            "viewport": {
                "width": config.DEFAULT_VIEWPORT_WIDTH,
                "height": config.DEFAULT_VIEWPORT_HEIGHT,
            },
            "user_agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1",
            "is_mobile": True,
            "has_touch": True,
            "device_scale_factor": 2,
        }

        acquired = _BROWSER_SEMAPHORE.acquire(timeout=25.0)
        if not acquired:
            return {
                "id": f"chk_busy_{int(time.time())}",
                "student_id": student_id,
                "project_name": project_name,
                "project_url": url,
                "status_code": 429,
                "is_live": False,
                "load_time_ms": 0,
                "mobile_friendly": False,
                "screenshot_url": "",
                "console_errors": [],
                "network_errors": [{"url": url, "error": "Browser capacity reached. Concurrency limit enforced."}],
                "content_evaluation": {"is_blank_page": True, "error": "CONCURRENCY_LIMIT"},
                "quality_score": 0.0,
                "recommendations": ["Server browser capacity busy. Please retry in a few moments."],
                "passed": False,
            }

        try:
            with sync_playwright() as p:
                browser = None
                context = None
                try:
                    launch_args = ["--disable-dev-shm-usage"]
                    if os.environ.get("PLAYWRIGHT_NO_SANDBOX", "0") == "1":
                        launch_args.extend(["--no-sandbox", "--disable-setuid-sandbox"])

                    browser = p.chromium.launch(
                        headless=self.headless,
                        args=launch_args,
                    )
                    context = browser.new_context(**mobile_device, ignore_https_errors=False)
                    page: Page = context.new_page()
                    safe_destination_cache: Dict[str, Tuple[bool, str]] = {}

                    # Revalidate every redirect and subresource to prevent DNS rebinding
                    # or a public page from pivoting the browser into an internal network.
                    def route_public_requests(route):
                        request_url = route.request.url
                        parsed_request = urllib.parse.urlparse(request_url)
                        cache_key = f"{parsed_request.scheme}://{parsed_request.hostname}"
                        safety = safe_destination_cache.get(cache_key)
                        if safety is None:
                            safety = self.is_safe_public_url(request_url)
                            safe_destination_cache[cache_key] = safety

                        if safety[0]:
                            route.continue_()
                            return

                        network_errors.append(
                            {
                                "url": request_url,
                                "error": f"Blocked unsafe destination: {safety[1]}",
                            }
                        )
                        route.abort("blockedbyclient")

                    context.route("**/*", route_public_requests)

                    # Event listeners for error tracking
                    def on_console(msg):
                        if msg.type == "error":
                            console_errors.append(msg.text)
                        elif msg.type == "warning":
                            console_warnings.append(msg.text)

                    def on_page_error(exc):
                        page_errors.append(str(exc))

                    def on_request_failed(request):
                        failure = request.failure
                        error_text = failure if failure else "Failed to load resource"
                        if not any(
                            track in request.url
                            for track in ["google-analytics", "doubleclick", "hotjar"]
                        ):
                            network_errors.append({"url": request.url, "error": str(error_text)})

                    def on_response(response):
                        # DNS Rebinding check: verify the server IP that was actually connected to
                        try:
                            server_addr = response.server_addr()
                            if server_addr and "ipAddress" in server_addr:
                                ip_safe, ip_reason = self.is_safe_public_url(f"http://{server_addr['ipAddress']}")
                                if not ip_safe:
                                    network_errors.append(
                                        {
                                            "url": response.url,
                                            "error": f"DNS rebinding blocked: connected to unsafe destination ({ip_reason})",
                                        }
                                    )
                                    page.close()
                                    return
                        except Exception:
                            pass

                        if response.status >= 400 and not any(
                            track in response.url
                            for track in ["google-analytics", "doubleclick", "hotjar"]
                        ):
                            network_errors.append(
                                {
                                    "url": response.url,
                                    "error": f"HTTP {response.status}",
                                }
                            )

                    page.on("console", on_console)
                    page.on("pageerror", on_page_error)
                    page.on("requestfailed", on_request_failed)
                    page.on("response", on_response)

                    # Navigate to the target live link
                    response = page.goto(
                        url, wait_until="domcontentloaded", timeout=self.timeout_ms
                    )

                    # Wait briefly for client-side single-page apps (React/Vue/Next) to mount.
                    try:
                        page.wait_for_load_state("networkidle", timeout=6000)
                    except PlaywrightTimeoutError:
                        page_errors.append("Network did not become idle within 6000ms")

                    if response:
                        status_code = response.status
                        is_live = 200 <= status_code < 400
                    else:
                        is_live = False

                    page_title = page.title() or ""

                    # Check DOM text & white-screen / blank-app detection
                    body_text = page.evaluate("() => document.body ? document.body.innerText : ''")
                    body_text_length = len(body_text.strip()) if body_text else 0
                    is_blank_page = body_text_length < 25

                    # Check mobile horizontal overflow & responsiveness
                    horizontal_overflow = page.evaluate("""
                        () => {
                            const doc = document.documentElement;
                            return doc.scrollWidth > (window.innerWidth + 2);
                        }
                    """)

                    has_viewport_meta = page.evaluate("""
                        () => !!document.querySelector('meta[name="viewport"]')
                    """)
                    mobile_friendly = has_viewport_meta and not horizontal_overflow

                    # Keyword verification (if student claimed specific tech/features in README)
                    if claimed_keywords and body_text:
                        lower_body = body_text.lower() + " " + page_title.lower()
                        matched_keywords = [
                            kw for kw in claimed_keywords if kw.lower() in lower_body
                        ]

                    # Capture mobile screenshot
                    timestamp = int(time.time())
                    sanitized_name = self._sanitize_filename(url)
                    screenshot_filename = f"{sanitized_name}_{timestamp}.png"
                    screenshot_local_path = self.screenshot_dir / screenshot_filename

                    page.screenshot(
                        path=str(screenshot_local_path),
                        full_page=False,  # Captures mobile above-the-fold viewport
                    )
                finally:
                    if context is not None:
                        context.close()
                    if browser is not None:
                        browser.close()

        except PlaywrightError as pe:
            is_live = False
            page_errors.append(f"Playwright navigation failed: {str(pe)}")
        except Exception as e:
            is_live = False
            page_errors.append(f"Unexpected error checking URL: {str(e)}")
        finally:
            _BROWSER_SEMAPHORE.release()

        load_time_ms = int((time.time() - start_time) * 1000)

        # Calculate link quality score (0 - 100)
        quality_score = self._compute_quality_score(
            is_live=is_live,
            status_code=status_code,
            is_blank=is_blank_page,
            page_errors=page_errors,
            console_errors=console_errors,
            mobile_friendly=mobile_friendly,
            load_time_ms=load_time_ms,
        )

        # Upload screenshot to Supabase Storage if available
        remote_screenshot_url = ""
        if screenshot_local_path and screenshot_local_path.exists():
            remote_screenshot_url = db_client.upload_screenshot(screenshot_local_path)

        # Generate actionable advice
        recommendations = self._generate_recommendations(
            is_live=is_live,
            status_code=status_code,
            is_blank=is_blank_page,
            console_errors=console_errors,
            page_errors=page_errors,
            mobile_friendly=mobile_friendly,
            load_time_ms=load_time_ms,
            horizontal_overflow=horizontal_overflow,
        )

        result_payload = {
            "id": f"chk_{int(time.time())}_{self._sanitize_filename(url)[:15]}",
            "student_id": student_id,
            "project_name": project_name,
            "project_url": url,
            "is_live": is_live,
            "status_code": status_code,
            "load_time_ms": load_time_ms,
            "mobile_friendly": mobile_friendly,
            "screenshot_url": remote_screenshot_url
            or (str(screenshot_local_path) if screenshot_local_path else ""),
            "screenshot_local_path": str(screenshot_local_path) if screenshot_local_path else "",
            "console_errors": console_errors,
            "console_warnings": console_warnings[:5],
            "network_errors": network_errors[:5],
            "page_errors": page_errors,
            "content_evaluation": {
                "page_title": page_title,
                "body_characters": body_text_length,
                "is_blank_page": is_blank_page,
                "horizontal_overflow": horizontal_overflow,
                "viewport_width": config.DEFAULT_VIEWPORT_WIDTH,
                "viewport_height": config.DEFAULT_VIEWPORT_HEIGHT,
                "claimed_keywords_checked": claimed_keywords or [],
                "matched_keywords": matched_keywords,
            },
            "quality_score": quality_score,
            "recommendations": recommendations,
            "passed": is_live and not is_blank_page and quality_score >= 60.0,
        }

        # Sync to Supabase / Local DB
        if save_to_db:
            db_client.save_live_link_check(result_payload)

        return result_payload

    def _compute_quality_score(
        self,
        is_live: bool,
        status_code: Optional[int],
        is_blank: bool,
        page_errors: List[str],
        console_errors: List[str],
        mobile_friendly: bool,
        load_time_ms: int,
    ) -> float:
        if not is_live:
            return 0.0

        score = 0.0

        # HTTP status ok (30 pts)
        if status_code == 200:
            score += 30.0
        elif status_code and 200 <= status_code < 400:
            score += 20.0

        # Content rendered without white screen (25 pts)
        if not is_blank:
            score += 25.0

        # JavaScript execution integrity (20 pts)
        if len(page_errors) == 0:
            score += 15.0
        if len(console_errors) == 0:
            score += 5.0
        elif len(console_errors) <= 2:
            score += 2.0

        # Mobile responsiveness (15 pts)
        if mobile_friendly:
            score += 15.0

        # Performance / Fast load (10 pts)
        if load_time_ms < 2000:
            score += 10.0
        elif load_time_ms < 4500:
            score += 6.0
        elif load_time_ms < 8000:
            score += 3.0

        return round(min(100.0, score), 1)

    def _generate_recommendations(
        self,
        is_live: bool,
        status_code: Optional[int],
        is_blank: bool,
        console_errors: List[str],
        page_errors: List[str],
        mobile_friendly: bool,
        load_time_ms: int,
        horizontal_overflow: bool,
    ) -> List[str]:
        tips = []
        if not is_live:
            tips.append(
                f"Deploy the project on Vercel, Netlify, or Render. Link failed with HTTP {status_code or 'Timeout'}."
            )
            return tips

        if is_blank:
            tips.append(
                "Detected a blank page / white-screen. Check client-side bundle hydration and console errors."
            )

        if page_errors:
            tips.append(f"Fix uncaught JavaScript exceptions: {page_errors[0][:100]}")

        if len(console_errors) > 0:
            tips.append(
                f"Resolve {len(console_errors)} browser console error(s) to ensure recruiter's DevTools show clean code."
            )

        if horizontal_overflow:
            tips.append(
                "Mobile layout has horizontal overflow (content spills past width). Fix CSS container padding and max-width: 100%."
            )

        if not mobile_friendly and not horizontal_overflow:
            tips.append(
                "Add `<meta name='viewport' content='width=device-width, initial-scale=1.0'>` in your HTML header."
            )

        if load_time_ms > 4500:
            tips.append(
                f"Load time was {load_time_ms / 1000:.1f}s. Optimize large images and bundle sizes for faster initial paint."
            )

        if not tips:
            tips.append(
                "Excellent deployment! Site loads swiftly, passes mobile checks, and runs without console errors."
            )

        return tips
