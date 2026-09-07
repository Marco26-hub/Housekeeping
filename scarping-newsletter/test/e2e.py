from pathlib import Path
from playwright.sync_api import sync_playwright


BASE_URL = "http://127.0.0.1:8098"


def main():
    console_errors = []
    print("[1/6] Avvio browser", flush=True)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 1000})
        page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)

        print("[2/6] Caricamento dashboard", flush=True)
        response = page.goto(BASE_URL, wait_until="domcontentloaded", timeout=15_000)
        assert response and response.ok, "La dashboard non risponde"
        page.wait_for_load_state("networkidle", timeout=15_000)
        assert page.get_by_role("heading", name="Buongiorno 👋").is_visible()
        assert page.locator("#stat-total").inner_text() == "0"

        print("[3/6] Creazione campagna via API", flush=True)
        campaign = page.request.post(
            f"{BASE_URL}/api/campaigns",
            data={"name": "Campagna E2E", "sector": "ristoranti", "location": "Milano"},
        )
        assert campaign.ok

        print("[4/6] Inserimento lead dalla UI", flush=True)
        page.get_by_role("button", name="＋ Aggiungi lead").click()
        page.locator("#lead-form input[name=company]").fill("Ristorante Test E2E")
        page.locator("#lead-form input[name=category]").fill("Ristorante")
        page.locator("#lead-form input[name=city]").fill("Milano")
        page.locator("#lead-form input[name=email]").fill("test@example.it")
        page.locator("#lead-form input[name=phone]").fill("0212345678")
        page.locator("#lead-form button[type=submit]").click()
        page.get_by_text("Lead salvato", exact=True).wait_for(state="visible")
        page.locator("#stat-total").wait_for(state="visible")
        assert page.locator("#stat-total").inner_text() == "1"

        print("[5/6] Aggiornamento pipeline", flush=True)
        page.locator('[data-view="leads"]').click()
        page.locator("#leads-table").get_by_text("Ristorante Test E2E", exact=True).wait_for(state="visible")
        status = page.locator("select.status-select")
        status.select_option("contacted")
        page.get_by_text("Stato aggiornato", exact=True).wait_for(state="visible")

        leads = page.request.get(f"{BASE_URL}/api/leads?status=contacted")
        assert leads.ok and len(leads.json()) == 1
        assert leads.json()[0]["score"] == 70

        print("[6/6] Screenshot e controllo console", flush=True)
        screenshot = Path("/tmp/leadforge-e2e.png")
        page.screenshot(path=str(screenshot), full_page=True)
        assert not console_errors, f"Errori console: {console_errors}"
        browser.close()

    print("E2E OK: dashboard, API, creazione lead, pipeline, score e console browser")


if __name__ == "__main__":
    main()
