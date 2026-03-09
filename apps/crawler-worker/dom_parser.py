from typing import List, Dict, Any
from playwright.sync_api import Page

def extract_interactive_elements(page: Page) -> List[Dict[str, Any]]:
    """
    Extracts all visible interactive elements (links, buttons, inputs) from the given Playwright page.
    """
    elements = []
    
    # Simple JS snippet to gather elements
    js_extract = """
    () => {
        const interactives = Array.from(document.querySelectorAll('a, button, input, select, textarea, [role="button"], [tabindex]:not([tabindex="-1"])'));
        return interactives
            .filter(el => {
                const rect = el.getBoundingClientRect();
                return rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).visibility !== 'hidden';
            })
            .map((el, i) => {
                let tag = el.tagName.toLowerCase();
                let isGoBoard = false;
                
                // Extremely rudimentary check for a Go Board pattern
                if (el.className.includes('goban') || el.className.includes('board') || el.querySelector('canvas')) {
                    isGoBoard = true;
                }

                return {
                    id: `elem-${i}`,
                    tag: tag,
                    text: el.innerText ? el.innerText.trim().substring(0, 50) : el.value || '',
                    type: el.type || el.getAttribute('role') || 'unknown',
                    href: el.getAttribute('href') || null,
                    className: el.className || '',
                    isGoBoardPattern: isGoBoard
                };
            });
    }
    """
    
    try:
        raw_elements = page.evaluate(js_extract)
        elements = raw_elements
    except Exception as e:
        print(f"Error extracting DOM elements: {e}")
        
    return elements

def build_dom_snapshot(page: Page) -> str:
    """
    Captures a simplified dump of the DOM for logging or offline LLM parsing.
    """
    return page.content()
