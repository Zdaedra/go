import os
import asyncio
from playwright.async_api import async_playwright

REMOTE_BROWSER_WS = os.environ.get("REMOTE_BROWSER_WS", "ws://chromium:3000")
TARGET_URL = "http://89.167.122.76:3005/tsumego/c6eddff5-8692-4233-9839-925d63f71a17"

async def test_tsumego_layout():
    print(f"Connecting to remote crawler browser at {REMOTE_BROWSER_WS}...")
    
    async with async_playwright() as p:
        try:
            browser = await p.chromium.connect_over_cdp(REMOTE_BROWSER_WS)
            context = await browser.new_context(viewport={'width': 500, 'height': 1200})
            page = await context.new_page()
            
            page.on("console", lambda msg: print(f"Browser Console: {msg.type} {msg.text}"))
            page.on("pageerror", lambda err: print(f"Browser Error: {err.message}"))
            
            print(f"Opening Tsumego Board: {TARGET_URL}")
            await page.goto(TARGET_URL, wait_until="networkidle")
            await asyncio.sleep(3) 
            
            # Use exact selector for the description
            desc_locator = page.locator("p.text-sm.text-gray-800")
            if await desc_locator.count() > 0:
                box = await desc_locator.bounding_box()
                print(f"Description Bounding Box: {box}")
                viewport_size = page.viewport_size
                print(f"Viewport Size: {viewport_size}")
                
                if box['x'] + box['width'] > viewport_size['width']:
                    print("FAIL: Text is overflowing the viewport width!")
                    return False
                else:
                    print("SUCCESS: Text is contained within the viewport width.")
            else:
                 print("WARNING: Could not find description text to check overflow.")

            print("Capturing screenshot of the Tsumego board...")
            await page.screenshot(path="/app/sites/tsumego_verify.png")
            
            await browser.close()
            return True

        except Exception as e:
            print(f"Bot encountered an error: {e}")
            return False

if __name__ == "__main__":
    result = asyncio.run(test_tsumego_layout())
    import sys
    sys.exit(0 if result else 1)
