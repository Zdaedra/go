import asyncio
from playwright.async_api import async_playwright

REMOTE_BROWSER_WS = "ws://chromium:3000"
TARGET_URL = "http://89.167.122.76:3005/"

async def audit_homepage():
    print(f"Connecting to remote crawler browser at {REMOTE_BROWSER_WS}...")
    
    report = ["# Homepage Live Audit Protocol\n"]
    
    async with async_playwright() as p:
        try:
            browser = await p.chromium.connect_over_cdp(REMOTE_BROWSER_WS)
            context = await browser.new_context(viewport={'width': 1280, 'height': 900})
            page = await context.new_page()
            api_request = context.request
            
            print(f"Navigating to {TARGET_URL}...")
            res = await page.goto(TARGET_URL, wait_until="networkidle")
            
            report.append(f"## Target: {TARGET_URL}")
            report.append(f"- **Main Page Load**: `[{'OK' if res.ok else 'FAIL'}]` (HTTP {res.status})\n")
            
            # 1. Test Links
            print("Gathering links...")
            locators = await page.locator("a").all()
            links_tested = 0
            working_links = []
            broken_links = []
            
            # Deduplicate hrefs to avoid spam
            tested_hrefs = {}
            
            for loc in locators:
                href = await loc.get_attribute("href")
                text = await loc.inner_text()
                text = text.strip().replace('\n', ' ')
                if not text:
                    text = "[Icon/Card Link]"
                    
                if not href:
                    broken_links.append(f"- `[FAIL]` **{text}** (No href attribute)")
                    continue
                    
                if href in tested_hrefs:
                    if tested_hrefs[href] == 200:
                        working_links.append(f"- `[OK]` **{text}** ({href})")
                    else:
                        broken_links.append(f"- `[404/FAIL]` **{text}** ({href})")
                    continue
                    
                if href.startswith("/"):
                    full_url = TARGET_URL.rstrip("/") + href
                elif href.startswith("http"):
                    full_url = href
                else:
                    broken_links.append(f"- `[FAIL]` **{text}** (Invalid href: '{href}')")
                    continue
                
                try:
                    r = await api_request.get(full_url)
                    tested_hrefs[href] = r.status
                    if r.ok:
                        working_links.append(f"- `[OK]` **{text}** ({href})")
                    else:
                        broken_links.append(f"- `[404/FAIL]` **{text}** ({href}) - Status: {r.status}")
                except Exception as e:
                    broken_links.append(f"- `[ERROR]` **{text}** ({href}) - {str(e)}")
                    
                links_tested += 1

            report.append("### Links & Routing Audit")
            report.append("**Working Elements:**")
            if working_links:
                for link in working_links: report.append(link)
            else:
                report.append("- None")
                
            report.append("\n**Not Working / Missing Pages (404s):**")
            if broken_links:
                for link in broken_links: report.append(link)
            else:
                report.append("- None")
            
            # 2. Test Buttons
            print("Gathering buttons...")
            report.append("\n### Interactive Buttons")
            buttons = await page.locator("button").all()
            for i, btn in enumerate(buttons):
                text = await btn.inner_text()
                text = text.strip().replace('\n', ' ')
                if not text:
                    text = f"[Icon Button {i}]"
                
                is_visible = await btn.is_visible()
                is_enabled = await btn.is_enabled()
                if is_visible and is_enabled:
                    report.append(f"- `[OK]` **{text}** (Visible & Clickable)")
                else:
                    report.append(f"- `[FAIL]` **{text}** (Visible: {is_visible}, Enabled: {is_enabled})")
                    
            # 3. Test Interactive Board in Hero
            print("Testing Hero Board...")
            report.append("\n### Hero Interactive Board Test")
            try:
                # Click the center of the board
                # The board is an SVG or set of divs. We know "Try making a move!" is near it.
                # Just click coordinates where the board renders on a 1280 screen
                await page.mouse.click(900, 450) 
                await asyncio.sleep(1) # wait for bot response
                
                # The play button should change to "CONTINUE GAME"
                play_btn = await page.locator("text=CONTINUE GAME").count()
                if play_btn > 0:
                    report.append("- `[OK]` Hero board is interactive. Clicking placed a stone and changed main CTA to 'CONTINUE GAME'.")
                else:
                    report.append("- `[FAIL]` Hero board interaction failed. CTA did not update.")
            except Exception as e:
                report.append(f"- `[ERROR]` Could not test hero board: {e}")

            await browser.close()
            
        except Exception as e:
            report.append(f"\n**CRITICAL SCRIPT ERROR**: {e}")
            
    output_path = "/app/sites/homepage_audit.md"
    with open(output_path, "w", encoding="utf-8") as f:
        f.write("\n".join(report))
    print(f"Audit saved to {output_path}")

if __name__ == "__main__":
    asyncio.run(audit_homepage())
