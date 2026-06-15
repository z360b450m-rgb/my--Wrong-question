from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    page.goto('http://localhost:5173')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(1000)

    # Open settings via the sidebar button
    page.locator('button:has-text("设置")').click()
    page.wait_for_timeout(500)

    html = page.content()

    # Should NOT see SM-2 mode toggle
    if 'SM-2' in html:
        print("FAIL: SM-2 still visible")
    else:
        print("PASS: SM-2 mode toggle removed")

    # Should see the Ebbinghaus description
    if '艾宾浩斯' in html:
        print("PASS: Ebbinghaus description visible")
    else:
        print("FAIL: Ebbinghaus description not found")

    # Should see all custom settings inputs directly (no v-if)
    if '首次复习' in html:
        print("PASS: Settings inputs always visible")
    else:
        print("FAIL: Settings inputs not found")

    # Check default values
    if '建议 1 天' in html:
        print("PASS: Default firstReviewDays = 1")
    if '建议 3 天' in html:
        print("PASS: Default masteredDays = 3")

    # Verify save button is visible
    if '保存复习设置' in html:
        print("PASS: Save button visible")
    else:
        print("FAIL: Save button not found")

    browser.close()
