import os
import time
import json
import logging
from playwright.sync_api import sync_playwright
from dom_parser import extract_interactive_elements, build_dom_snapshot
from markdown_generator import MarkdownGenerator

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

ORCHESTRATOR_URL = os.environ.get("ORCHESTRATOR_URL", "http://localhost:8000")

def push_log(site_id: int, message: str, level="info", payload=None):
    try:
        import requests
        requests.post(f"{ORCHESTRATOR_URL}/v1/logs", json={
            "site_id": site_id,
            "run_id": 1, # hardcoded for MVP
            "level": level,
            "message": message,
            "payload": payload
        }, timeout=2)
    except Exception as e:
        logger.warning(f"Failed to push log to orchestrator: {e}")

class SiteCrawler:
    def __init__(self, site_id: int, base_url: str):
        self.site_id = site_id
        self.base_url = base_url
        sites_dir = os.environ.get("SITES_DIR", "/app/sites")
        self.output_dir = f"{sites_dir}/Site_{site_id}"
        os.makedirs(self.output_dir, exist_ok=True)
        
    def run(self):
        msg = f"Starting crawl for Site {self.site_id} at {self.base_url}"
        logger.info(msg)
        push_log(self.site_id, msg)
        
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                viewport={'width': 1280, 'height': 800},
                record_video_dir=f"{self.output_dir}/sessions" if os.environ.get("RECORD_VIDEO") else None
            )
            
            page = context.new_page()
            
            try:
                # 1. Open Page
                push_log(self.site_id, f"Opening page: {self.base_url}")
                page.goto(self.base_url, wait_until="networkidle")
                
                # 2. Capture Screenshot and Snapshot
                push_log(self.site_id, "Capturing screenshot and DOM snapshot")
                os.makedirs(f"{self.output_dir}/screenshots", exist_ok=True)
                os.makedirs(f"{self.output_dir}/dom_dumps", exist_ok=True)
                
                screenshot_path = f"{self.output_dir}/screenshots/home.png"
                page.screenshot(path=screenshot_path)
                
                dump_path = f"{self.output_dir}/dom_dumps/home.html"
                with open(dump_path, "w", encoding="utf-8") as f:
                    f.write(build_dom_snapshot(page))
                
                # 3. Analyze DOM Interactive elements
                push_log(self.site_id, "Extracting interactive DOM elements")
                elements = extract_interactive_elements(page)
                push_log(self.site_id, f"Found {len(elements)} interactive elements", payload={"count": len(elements)})
                
                # 4. Generate Markdown Artifact
                push_log(self.site_id, "Writing features to site_crawling.md")
                md_gen = MarkdownGenerator(site_dir=self.output_dir, site_name=f"Site_{self.site_id}", base_url=self.base_url)
                md_gen.init_document_if_empty()
                
                md_gen.add_screen(
                    screen_id="Screen_001",
                    title=page.title() or "Homepage",
                    url=self.base_url,
                    screenshot="screenshots/home.png",
                    elements=elements
                )
                
                # Fake adding features for demonstration MVP
                for idx, el in enumerate(elements[:3]): # Just record first 3 elements found as features
                    md_gen.add_feature(
                        feature_id=f"{idx:03d}",
                        name=el["text"] or f"{el['tag']} element",
                        screen="Screen_001",
                        f_type="Interactive Element",
                        action=f"Clicking {el['tag']} with href {el['href']}"
                    )
                
                msg = f"Finished basic navigation. Saved {len(elements)} elements to site_crawling.md"
                logger.info(msg)
                push_log(self.site_id, msg)

                
            except Exception as e:
                logger.error(f"Crawler encountered an error: {e}")
                push_log(self.site_id, f"Crawler error: {e}", level="error")
            finally:
                context.close()
                browser.close()

if __name__ == "__main__":
    # For local standalone testing
    crawler = SiteCrawler(site_id=1, base_url="https://online-go.com")
    crawler.run()
