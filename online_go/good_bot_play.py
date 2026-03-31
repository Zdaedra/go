import os
import asyncio
from playwright.async_api import async_playwright

REMOTE_BROWSER_WS = os.environ.get("REMOTE_BROWSER_WS", "ws://chromium:3000")
TARGET_URL = "http://89.167.122.76:3005/play"

async def extract_board_state(page):
    """Counts stones on the board based on CSS classes, specifically scoped to the interactive board layer."""
    black_stones = await page.locator(".z-20 .bg-gradient-to-br.from-gray-700.to-black").count()
    white_stones = await page.locator(".z-20 .bg-gradient-to-br.from-white.to-gray-200").count()
    return black_stones, white_stones

async def test_game_loop():
    print(f"Connecting to remote crawler browser at {REMOTE_BROWSER_WS}...")
    
    async with async_playwright() as p:
        try:
            browser = await p.chromium.connect_over_cdp(REMOTE_BROWSER_WS)
            context = await browser.new_context()
            page = await context.new_page()
            
            page.on("console", lambda msg: print(f"Browser Console: {msg.type} {msg.text}"))
            page.on("pageerror", lambda err: print(f"Browser Error: {err.message}"))
            page.on("requestfailed", lambda req: print(f"Browser Fetch Failed: {req.url} - {req.failure}"))
            
            print(f"Opening Go Board: {TARGET_URL}")
            await page.goto(TARGET_URL, wait_until="networkidle")
            await asyncio.sleep(1) # Extra buffer for React hydration setup
            
            print("Clicking 'Play Now' through the Setup Overlay with Hydration Retry...")
            play_btn = page.locator("text='Play Now'")
            await play_btn.wait_for(state="visible", timeout=10000)
            
            for _ in range(5):
                await play_btn.click(force=True)
                await asyncio.sleep(0.5)
                if not await play_btn.is_visible():
                    print("Play Now clicked and Overlay unmounted successfully.")
                    break
                print("Retry click on Play Now...")
                
            print("Waiting for Board mount and Fetch API...")
            await asyncio.sleep(1.5)
            
            # Ensure the board is empty initially
            b1, w1 = await extract_board_state(page)
            print(f"Initial State -> Black: {b1}, White: {w1}")
            
            # The board is a CSS grid, let's just find all click targets
            # There should be 19*19 = 361 targets for default setup.
            intersections = await page.locator(".cursor-pointer").all()
            if len(intersections) != 361:
                print(f"FAIL: Expected 361 intersections, found {len(intersections)}")
                return False
                
            print("Playing First Move (Black) at index 60...")
            await intersections[60].click(force=True)
            
            b2, w2 = await extract_board_state(page)
            print(f"After Move 1 -> Black: {b2}, White: {w2}")
            if b2 != 1:
                print("FAIL: Black stone did not render!")
                return False
                
            print("Waiting for KataGo response...")
            # KataGo might take up to 2-3 seconds as configured
            for _ in range(15):
                await asyncio.sleep(1)
                b3, w3 = await extract_board_state(page)
                if w3 > 0:
                    break
                    
            if w3 == 0:
                print("FAIL: KataGo bot did not respond with a white stone!")
                return False
                
            print(f"Bot Responded! -> Black: {b3}, White: {w3}")
            
            # Play a second move just to be sure rule interactions don't hard crash
            print("Playing Second Move (Black) at index 61...")
            await intersections[61].click(force=True)
            
            print("Waiting for KataGo response 2...")
            for _ in range(15):
                await asyncio.sleep(1)
                b4, w4 = await extract_board_state(page)
                if w4 > w3:
                    break
                    
            print(f"Final State -> Black: {b4}, White: {w4}")
            
            if b4 >= 2 and w4 >= 2:
                print("SUCCESS: Full cycle playing loop verified. Stones are placed and bot is responding!")
                await browser.close()
                return True
            else:
                print("FAIL: Final stone count mismatch")
                return False

        except Exception as e:
            print(f"Bot encountered an error during play loop: {e}")
            return False

if __name__ == "__main__":
    result = asyncio.run(test_game_loop())
    import sys
    sys.exit(0 if result else 1)
