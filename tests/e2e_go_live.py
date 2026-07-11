from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:3000"
ARTIFACTS = Path("/tmp/report-pulizie-e2e")
ARTIFACTS.mkdir(parents=True, exist_ok=True)


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(service_workers="allow")
    page = context.new_page()
    console_errors: list[str] = []
    page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)

    response = page.goto(f"{BASE}/login", wait_until="networkidle")
    require(response is not None, "Login did not return an HTTP response")
    login_status = response.status
    require(login_status == 200, f"Login page failed: {login_status}")
    require(page.get_by_role("heading", name="The Blondes Cleaning").count() == 1, "Login branding missing")
    marketing_link = page.get_by_role("link", name="Torna al sito The Blondes")
    require(marketing_link.count() == 1, "Marketing site link missing")
    marketing_href = marketing_link.get_attribute("href")
    require(marketing_href in ("/", f"{BASE}/"), f"Wrong marketing URL: {marketing_href}")
    page.screenshot(path=str(ARTIFACTS / "login.png"), full_page=True)

    landing_response = page.goto(f"{BASE}/", wait_until="networkidle")
    require(landing_response is not None, "Landing did not return an HTTP response")
    require(landing_response.status == 200, f"Landing page failed: {landing_response.status}")
    require(page.get_by_role("link", name="Area operatori").count() == 1, "Operator area CTA missing")
    require("The Blondes Cleaning" in page.content(), "Housekeeping landing content missing")

    manifest_response = context.request.get(f"{BASE}/manifest.webmanifest")
    require(manifest_response.ok, f"Manifest failed: {manifest_response.status}")
    manifest = manifest_response.json()
    require(manifest["short_name"] == "TBC Report", "Manifest branding mismatch")
    for icon in manifest["icons"]:
        icon_response = context.request.get(f"{BASE}{icon['src']}")
        require(icon_response.ok, f"Missing PWA icon: {icon['src']}")

    sw_response = context.request.get(f"{BASE}/sw.js")
    require(sw_response.ok, f"Service worker failed: {sw_response.status}")
    require("placeholder" not in sw_response.text(), "Service worker contains placeholder fallback")

    root_response = context.request.get(f"{BASE}/")
    require(root_response.ok, f"Root failed: {root_response.status}")
    headers = {key.lower(): value for key, value in root_response.headers.items()}
    require(headers.get("x-content-type-options") == "nosniff", "Missing nosniff header")
    require(headers.get("x-frame-options") == "DENY", "Missing frame protection")
    require("default-src 'self'" in headers.get("content-security-policy", ""), "Missing CSP")
    require("x-powered-by" not in headers, "Framework disclosure header is enabled")

    health_response = context.request.get(f"{BASE}/api/health")
    health = health_response.json()
    require(health_response.status in (200, 503), f"Unexpected health status: {health_response.status}")
    require("environment" in health.get("checks", {}), "Environment health check missing")
    require("storage" in health.get("checks", {}), "Storage health check missing")

    print(f"LOGIN_STATUS={login_status}")
    print(f"HEALTH_STATUS={health_response.status}")
    print(f"HEALTH_BODY={health}")
    print(f"CONSOLE_ERRORS={console_errors}")
    print(f"SCREENSHOT={ARTIFACTS / 'login.png'}")
    browser.close()
