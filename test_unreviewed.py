from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    page.goto('http://localhost:5173')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(1000)

    html = page.content()

    # Check mastery filter chips in sidebar
    if '未复习' in html:
        print("PASS: '未复习' filter chip visible")
    else:
        print("FAIL: '未复习' filter chip not found")

    if '未掌握' in html:
        print("PASS: '未掌握' filter chip visible")
    else:
        print("FAIL: '未掌握' filter chip not found")

    browser.close()
