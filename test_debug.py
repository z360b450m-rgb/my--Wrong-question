from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    page.goto('http://localhost:5173')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(2000)

    page.screenshot(path='debug.png', full_page=True)
    print("Screenshot saved")

    buttons = page.locator('button').all()
    for b in buttons:
        title = b.get_attribute('title')
        if title:
            print(f"Button title: {repr(title)}")

    browser.close()
