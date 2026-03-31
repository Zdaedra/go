import asyncio
from playwright.async_api import async_playwright

REMOTE_BROWSER_WS = "ws://chromium:3000"
TARGET_URL = "http://89.167.122.76:3005/"

async def capture_index():
    print(f"Connecting to remote crawler browser at {REMOTE_BROWSER_WS}...")
    async with async_playwright() as p:
        try:
            browser = await p.chromium.connect_over_cdp(REMOTE_BROWSER_WS)
            context = await browser.new_context(viewport={'width': 1280, 'height': 1600})
            page = await context.new_page()
            
            print(f"Opening Home Page: {TARGET_URL}")
            await page.goto(TARGET_URL, wait_until="networkidle")
            await asyncio.sleep(2) # Buffer for React hydration setup
            
            print("Capturing full page screenshot...")
            await page.screenshot(path="/app/sites/index_verify.png", full_page=True)
            print("Success! Screenshot saved.")
            
            await browser.close()
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(capture_index())
