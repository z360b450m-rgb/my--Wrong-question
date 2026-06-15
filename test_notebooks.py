from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    page.goto('http://localhost:5173')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(1500)

    html = page.content()

    # Should see the notebook menu
    if '选择要复习的错题本' in html:
        print("PASS: Notebook menu shown")
    else:
        print("FAIL: Notebook menu not found")

    # Should see create button
    if '新建错题本' in html:
        print("PASS: Create notebook button visible")
    else:
        print("FAIL: Create button not found")

    # Click create button (use .first to avoid strict-mode ambiguity with 2 buttons)
    page.locator('button:has-text("新建错题本")').first.click()
    page.wait_for_timeout(300)

    html2 = page.content()
    if '名称' in html2 and '简介' in html2:
        print("PASS: Create dialog with name & description fields")

    # Fill dialog fields by placeholder
    page.get_by_placeholder('例如：数学错题本').fill('Test Book')
    page.get_by_placeholder('简短描述').fill('A test notebook')
    page.wait_for_timeout(200)

    # Click create
    page.locator('button:has-text("创建")').click()
    page.wait_for_timeout(2000)

    html3 = page.content()
    if 'Test Book' in html3:
        print("PASS: Entered notebook, name shown in sidebar")
    else:
        print("FAIL: Not in notebook view")

    # Return to menu
    page.locator('button:has-text("返回")').first.click()
    page.wait_for_timeout(500)

    html4 = page.content()
    if 'Test Book' in html4:
        print("PASS: Notebook card visible in menu")
    else:
        print("FAIL: Notebook not in menu list")

    browser.close()
