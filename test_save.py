from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    page.goto('http://localhost:5173')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(1000)

    # Open settings, switch to custom
    page.locator('button[title="设置"]').click()
    page.wait_for_timeout(300)
    page.locator('button:has-text("自定义间隔")').click()
    page.wait_for_timeout(300)

    # Change firstReviewDays from 3 to 10 (draft only)
    inputs = page.locator('input[type="number"]')
    first_input = inputs.nth(0)
    first_input.fill('')
    first_input.type('10')
    page.wait_for_timeout(300)

    # DON'T save - close via backdrop instead
    page.locator('.fixed.inset-0.z-40').first.click()
    page.wait_for_timeout(500)

    # Create entry while settings panel is closed (should still use old 3-day setting)
    page.keyboard.press('Control+n')
    page.wait_for_timeout(500)
    editors = page.locator('[contenteditable="true"]')
    if editors.count() > 0:
        editors.first.fill("Test no-save")
    page.wait_for_timeout(300)
    page.keyboard.press('Control+s')
    page.wait_for_timeout(1000)

    # Check: should still be 3天后 since we didn't save
    html = page.content()
    if '3天后' in html:
        print("PASS: Without save, entry still shows '3天后' (old setting)")
    else:
        print(f"FAIL: Expected '3天后' but not found")

    # Now open settings again, change and SAVE
    page.locator('button[title="设置"]').click()
    page.wait_for_timeout(300)
    page.locator('button:has-text("自定义间隔")').click()
    page.wait_for_timeout(300)

    # Draft should reset to 3 (the stored value), change to 10
    inputs = page.locator('input[type="number"]')
    first_input = inputs.nth(0)
    first_input.fill('')
    first_input.type('10')
    page.wait_for_timeout(300)

    # Click save
    page.locator('button:has-text("保存复习设置")').click()
    page.wait_for_timeout(2000)  # Wait for recalc + debounce

    # Check entry again
    html2 = page.content()
    if '10天后' in html2:
        print("PASS: After save, entry updated to '10天后'!")
    elif '3天后' in html2:
        print("FAIL: Still shows '3天后' - save didn't trigger recalc")
    else:
        print("Checking...")

    browser.close()
