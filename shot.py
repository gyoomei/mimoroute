"""MimoRoute screenshot pipeline — 7 shots at 1920x1080 native + 1 mobile."""
import time, hashlib
from pathlib import Path
from playwright.sync_api import sync_playwright

OUT = Path("/root/mimorouteshots")
OUT.mkdir(exist_ok=True)
URL_BASE = "https://gyoomei.github.io/mimoroute/"
CB = int(time.time())

def md5(p):
    return hashlib.md5(p.read_bytes()).hexdigest()[:8]

def wait_done(page, timeout_s=30):
    for _ in range(timeout_s * 2):
        page.wait_for_timeout(500)
        if page.evaluate("document.getElementById('result')?.classList.contains('on')"):
            return True
        if page.evaluate("document.getElementById('error')?.classList.contains('on')"):
            return False
    return False

def settle(page, ms=900):
    page.wait_for_timeout(ms)

def cap(page, name):
    p = OUT / name
    page.screenshot(path=str(p))
    print(f"  -> {name}  {p.stat().st_size:>7} B  md5={md5(p)}")

with sync_playwright() as pw:
    browser = pw.chromium.launch(headless=True, args=['--disable-gpu', '--no-sandbox'])
    ctx = browser.new_context(
        viewport={'width': 1920, 'height': 1080},
        device_scale_factor=1,
        locale='en-US',
    )
    page = ctx.new_page()

    print("[1/7] desktop dark — landing")
    page.goto(f"{URL_BASE}?cb={CB}", wait_until="networkidle")
    settle(page, 1500)
    cap(page, "01-landing-dark.png")

    print("[2/7] desktop light — landing")
    page.goto(f"{URL_BASE}?cb={CB+1}", wait_until="networkidle")
    page.evaluate("localStorage.setItem('mr-theme','light'); document.documentElement.dataset.theme='light';")
    page.evaluate("document.getElementById('theme-btn').textContent = 'sun'; void 0;")
    settle(page, 1500)
    cap(page, "02-landing-light.png")

    print("[3/7] desktop dark — Bali full result")
    page.goto(f"{URL_BASE}?city=Bali,%20Indonesia&h=6&b=mid&v=food,culture,nature&lang=en&cb={CB+2}", wait_until="domcontentloaded", timeout=60000)
    page.evaluate("localStorage.setItem('mr-theme','dark'); document.documentElement.dataset.theme='dark';")
    if not wait_done(page, 45):
        print("  WARN: result not ready, capturing anyway")
    settle(page, 4500)
    page.evaluate("window.scrollTo(0, 0)")
    settle(page, 700)
    cap(page, "03-bali-result-top.png")

    print("[4/7] desktop dark — Bali result mid (timeline)")
    y = page.evaluate("document.getElementById('timeline')?.getBoundingClientRect().top + window.scrollY")
    if y:
        page.evaluate(f"window.scrollTo(0, {y - 120})")
        settle(page, 800)
    cap(page, "04-bali-timeline.png")

    print("[5/7] desktop ID + light — Yogyakarta")
    page.goto(f"{URL_BASE}?city=Yogyakarta&h=6&b=mid&v=food,culture,history&lang=id&cb={CB+3}", wait_until="domcontentloaded", timeout=60000)
    page.evaluate("localStorage.setItem('mr-theme','light'); document.documentElement.dataset.theme='light';")
    if not wait_done(page, 45):
        print("  WARN: result not ready")
    settle(page, 4500)
    page.evaluate("window.scrollTo(0, 0)")
    settle(page, 700)
    # scroll to result section
    yres = page.evaluate("document.getElementById('result')?.getBoundingClientRect().top + window.scrollY")
    if yres:
        page.evaluate(f"window.scrollTo(0, {yres - 80})")
        settle(page, 800)
    cap(page, "05-yogya-id-light.png")

    print("[6/7] github repo")
    page.goto("https://github.com/gyoomei/mimoroute", wait_until="networkidle")
    settle(page, 2000)
    cap(page, "06-github.png")

    # mobile viewport
    print("[7/7] mobile dark — landing + 3-stop plan")
    ctx_m = browser.new_context(
        viewport={'width': 414, 'height': 896},
        device_scale_factor=2,
        is_mobile=True,
        has_touch=True,
        locale='en-US',
    )
    pm = ctx_m.new_page()
    pm.goto(f"{URL_BASE}?cb={CB+4}", wait_until="networkidle")
    settle(pm, 1500)
    pm.screenshot(path=str(OUT / "07-mobile-landing.png"), full_page=False)
    print(f"  -> 07-mobile-landing.png  {(OUT/'07-mobile-landing.png').stat().st_size} B")

    browser.close()

# verify all unique
print("\nfinal hashes:")
for p in sorted(OUT.glob("*.png")):
    print(f"  {md5(p)}  {p.name}  {p.stat().st_size:>8} B")
