from __future__ import annotations

import json
import os
import pathlib
import time
import traceback

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait

URL = os.environ["E2E_URL"]
OUT = pathlib.Path("/tmp/phase16-evidence")
OUT.mkdir(parents=True, exist_ok=True)

REMOVE_FILE = OUT / "phase16-remove.txt"
TEXT_FILE = OUT / "phase16-text.txt"
JSON_FILE = OUT / "phase16-only.json"
REMOVE_FILE.write_text("LOTBI PHASE 16 remove test", encoding="utf-8")
TEXT_FILE.write_text("LOTBI PHASE 16 text attachment. The key phrase is BLUE-MOON-716.", encoding="utf-8")
JSON_FILE.write_text('{"lotbi_phase16":"attachment_only_test","marker":"GREEN-ONLY-816"}', encoding="utf-8")

result = {
    "url": URL,
    "viewport_checks": [],
    "menu_items": [],
    "remove_flow": {},
    "text_attachment_flow": {},
    "attachment_only_flow": {},
    "calendar": {},
    "final_scroll": {},
}

options = webdriver.ChromeOptions()
options.add_argument("--headless=new")
options.add_argument("--no-sandbox")
options.add_argument("--disable-dev-shm-usage")
options.add_argument("--disable-gpu")
options.add_argument("--lang=ko-KR")
options.add_argument("--window-size=1280,900")
options.set_capability("goog:loggingPrefs", {"browser": "ALL"})

driver = webdriver.Chrome(options=options)
wait = WebDriverWait(driver, 90)

def save_evidence(name: str) -> None:
    try:
        driver.save_screenshot(str(OUT / f"{name}.png"))
    except Exception:
        pass
    try:
        (OUT / f"{name}.html").write_text(driver.page_source, encoding="utf-8")
    except Exception:
        pass

def status_text() -> str:
    try:
        return driver.find_element(By.ID, "chat-status").get_attribute("textContent").strip()
    except Exception:
        return ""

def wait_mounted() -> None:
    wait.until(lambda d: d.execute_script("return document.readyState") == "complete")
    wait.until(lambda d: d.execute_script(
        "return document.querySelector('.send-button')?.dataset.conversationMounted === 'true'"
    ))

def viewport_probe(width: int, height: int) -> dict:
    driver.execute_cdp_cmd(
        "Emulation.setDeviceMetricsOverride",
        {"width": width, "height": height, "deviceScaleFactor": 1, "mobile": False},
    )
    time.sleep(0.35)
    value = driver.execute_script("""
        const composer = document.querySelector('.chat-composer-stack');
        const avatar = document.querySelector('[data-lotbi-avatar-container]');
        const thread = document.querySelector('.conversation-thread');
        const main = document.querySelector('.chat-home-shell');
        const cr = composer?.getBoundingClientRect();
        const ar = avatar?.getBoundingClientRect();
        return {
          width: innerWidth,
          height: innerHeight,
          horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
          composerVisible: Boolean(cr && cr.width > 0 && cr.height > 0 && cr.bottom <= innerHeight + 2 && cr.top < innerHeight),
          avatarVisible: Boolean(ar && ar.width > 0 && ar.height > 0 && getComputedStyle(avatar).display !== 'none' && getComputedStyle(avatar).visibility !== 'hidden'),
          transcriptOverflowY: thread ? getComputedStyle(thread).overflowY : '',
          mainOverflowY: main ? getComputedStyle(main).overflowY : '',
        };
    """)
    assert value["width"] == width, value
    assert value["height"] == height, value
    assert value["horizontalOverflow"] is False, value
    assert value["composerVisible"] is True, value
    assert value["avatarVisible"] is True, value
    return value

def open_attachment_menu_and_get_items() -> list[str]:
    trigger = wait.until(lambda d: d.find_element(By.CSS_SELECTOR, "[data-attachment-trigger]"))
    driver.execute_script("arguments[0].click()", trigger)
    menu = wait.until(lambda d: d.find_element(By.CSS_SELECTOR, "[data-attachment-menu]"))
    wait.until(lambda d: menu.is_displayed())
    items = [
        el.text.strip()
        for el in menu.find_elements(By.CSS_SELECTOR, '[role="menuitem"]')
        if el.is_displayed()
    ]
    driver.execute_script("arguments[0].click()", trigger)
    wait.until(lambda d: not menu.is_displayed())
    return items

def file_input():
    return driver.find_element(By.CSS_SELECTOR, 'input[data-attachment-input="files"]')

def chips():
    return driver.find_elements(By.CSS_SELECTOR, ".attachment-chip")

def upload(path: pathlib.Path, expected_name: str):
    before = len(chips())
    file_input().send_keys(str(path))
    wait.until(lambda d: len(chips()) > before)
    matched = wait.until(lambda d: next(
        (c for c in chips() if expected_name in c.get_attribute("textContent")),
        False,
    ))
    assert matched, f"chip missing for {expected_name}; status={status_text()}"
    return matched

def assistant_nodes():
    return driver.find_elements(
        By.CSS_SELECTOR,
        ".chat-message-assistant:not(.chat-message-loading)",
    )

def wait_assistant_after(before: int) -> str:
    def done(d):
        errors = d.find_elements(By.CSS_SELECTOR, ".chat-message-error")
        if errors:
            return ("ERROR", errors[-1].get_attribute("textContent").strip())
        nodes = assistant_nodes()
        if len(nodes) > before:
            return ("OK", nodes[-1].get_attribute("textContent").strip())
        return False
    state, text = wait.until(done)
    if state == "ERROR":
        raise AssertionError(f"visible conversation error: {text}")
    assert text, "assistant response was empty"
    return text

try:
    driver.get(URL)
    wait_mounted()

    source = driver.page_source
    assert 'data-attachment-action="camera"' in source
    assert 'data-attachment-action="photos"' in source
    assert 'data-attachment-action="files"' in source
    assert "PDF·DOCX·TXT·CSV·JSON" in source

    for width, height in [(390, 844), (412, 915), (768, 900), (1280, 900)]:
        result["viewport_checks"].append(viewport_probe(width, height))
        items = open_attachment_menu_and_get_items()
        assert items == ["카메라", "사진·스크린샷", "파일"], (width, items)
        if not result["menu_items"]:
            result["menu_items"] = items

    driver.execute_cdp_cmd(
        "Emulation.setDeviceMetricsOverride",
        {"width": 1280, "height": 900, "deviceScaleFactor": 1, "mobile": False},
    )
    time.sleep(0.3)

    # A. Upload then explicit remove.
    chip = upload(REMOVE_FILE, "phase16-remove.txt")
    result["remove_flow"]["uploaded"] = True
    remove = chip.find_element(By.CSS_SELECTOR, ".attachment-chip-remove")
    driver.execute_script("arguments[0].click()", remove)
    wait.until(lambda d: all(
        "phase16-remove.txt" not in c.get_attribute("textContent") for c in chips()
    ))
    result["remove_flow"] = {
        "uploaded": True,
        "removed": True,
        "status": status_text(),
    }

    # B. Text + attachment.
    upload(TEXT_FILE, "phase16-text.txt")
    prompt = driver.find_element(By.ID, "lotbi-prompt")
    prompt.clear()
    prompt.send_keys("이 첨부 파일의 핵심 문구를 알려줘.")
    send = driver.find_element(By.CSS_SELECTOR, ".send-button")
    wait.until(lambda d: send.is_enabled())
    before = len(assistant_nodes())
    driver.execute_script("arguments[0].click()", send)
    text_reply = wait_assistant_after(before)
    wait.until(lambda d: all(
        "phase16-text.txt" not in c.get_attribute("textContent") for c in chips()
    ))
    result["text_attachment_flow"] = {
        "uploaded": True,
        "sent": True,
        "assistant_received": True,
        "assistant_text": text_reply,
        "status": status_text(),
    }

    # The transcript owns scrolling only after a real conversation becomes active.
    active_layout = []
    for width, height in [(390, 844), (412, 915), (768, 900), (1280, 900)]:
        driver.execute_cdp_cmd(
            "Emulation.setDeviceMetricsOverride",
            {"width": width, "height": height, "deviceScaleFactor": 1, "mobile": False},
        )
        time.sleep(0.3)
        probe = driver.execute_script("""
            const thread = document.querySelector('.conversation-thread');
            const main = document.querySelector('.chat-home-shell');
            const composer = document.querySelector('.chat-composer-stack');
            const avatar = document.querySelector('[data-lotbi-avatar-container]');
            const cr = composer.getBoundingClientRect();
            const ar = avatar.getBoundingClientRect();
            return {
              width: innerWidth,
              height: innerHeight,
              conversationActive: document.body.classList.contains('conversation-active'),
              threadHidden: thread.hidden,
              transcriptOverflowY: getComputedStyle(thread).overflowY,
              mainOverflowY: getComputedStyle(main).overflowY,
              horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
              composerVisible: cr.width > 0 && cr.height > 0 && cr.bottom <= innerHeight + 2 && cr.top < innerHeight,
              avatarVisible: ar.width > 0 && ar.height > 0 && getComputedStyle(avatar).display !== 'none',
            };
        """)
        assert probe["width"] == width, probe
        assert probe["height"] == height, probe
        assert probe["conversationActive"] is True, probe
        assert probe["threadHidden"] is False, probe
        assert probe["transcriptOverflowY"] == "auto", probe
        assert probe["mainOverflowY"] == "hidden", probe
        assert probe["horizontalOverflow"] is False, probe
        assert probe["composerVisible"] is True, probe
        assert probe["avatarVisible"] is True, probe
        active_layout.append(probe)
    result["active_conversation_layout"] = active_layout

    driver.execute_cdp_cmd(
        "Emulation.setDeviceMetricsOverride",
        {"width": 1280, "height": 900, "deviceScaleFactor": 1, "mobile": False},
    )
    time.sleep(0.3)

    # C. Attachment only.
    upload(JSON_FILE, "phase16-only.json")
    prompt = driver.find_element(By.ID, "lotbi-prompt")
    driver.execute_script(
        "arguments[0].value=''; arguments[0].dispatchEvent(new Event('input',{bubbles:true}));",
        prompt,
    )
    send = driver.find_element(By.CSS_SELECTOR, ".send-button")
    wait.until(lambda d: send.is_enabled())
    before = len(assistant_nodes())
    driver.execute_script("arguments[0].click()", send)
    only_reply = wait_assistant_after(before)
    wait.until(lambda d: all(
        "phase16-only.json" not in c.get_attribute("textContent") for c in chips()
    ))
    result["attachment_only_flow"] = {
        "uploaded": True,
        "sent": True,
        "assistant_received": True,
        "assistant_text": only_reply,
        "status": status_text(),
    }

    # D. Guest Calendar.
    calendar_buttons = [
        el for el in driver.find_elements(By.CSS_SELECTOR, 'button[data-calendar-view="all"]')
        if el.is_displayed()
    ]
    assert calendar_buttons, "visible Calendar button missing"
    driver.execute_script("arguments[0].click()", calendar_buttons[0])
    panel = wait.until(lambda d: d.find_element(By.CSS_SELECTOR, ".site-calendar-modal"))
    wait.until(lambda d: panel.is_displayed())
    result["calendar"] = {
        "opened": True,
        "text": panel.get_attribute("textContent").strip()[:1000],
    }
    close = panel.find_element(By.CSS_SELECTOR, ".site-modal-close")
    driver.execute_script("arguments[0].click()", close)
    wait.until(lambda d: not d.find_elements(By.CSS_SELECTOR, ".site-calendar-modal"))

    # E. Final transcript-only scroll ownership.
    final_probe = driver.execute_script("""
        const thread = document.querySelector('.conversation-thread');
        const main = document.querySelector('.chat-home-shell');
        const composer = document.querySelector('.chat-composer-stack');
        const avatar = document.querySelector('[data-lotbi-avatar-container]');
        return {
          threadOverflowY: getComputedStyle(thread).overflowY,
          mainOverflowY: getComputedStyle(main).overflowY,
          horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
          composerVisible: composer.getBoundingClientRect().bottom <= innerHeight + 2,
          avatarVisible: avatar.getBoundingClientRect().width > 0 && avatar.getBoundingClientRect().height > 0,
          sendExists: Boolean(document.querySelector('.send-button')),
        };
    """)
    assert final_probe["threadOverflowY"] == "auto", final_probe
    assert final_probe["mainOverflowY"] == "hidden", final_probe
    assert final_probe["horizontalOverflow"] is False, final_probe
    assert final_probe["composerVisible"] is True, final_probe
    assert final_probe["avatarVisible"] is True, final_probe
    assert final_probe["sendExists"] is True, final_probe
    result["final_scroll"] = final_probe
    result["overall"] = "GREEN"

    save_evidence("phase16-final-green")
    print("PHASE16_E2E_RESULT=" + json.dumps(result, ensure_ascii=False, sort_keys=True))
except Exception as exc:
    result["overall"] = "RED"
    result["error"] = f"{type(exc).__name__}: {exc}"
    result["status_text"] = status_text()
    try:
        result["browser_logs"] = driver.get_log("browser")[-50:]
    except Exception:
        result["browser_logs"] = []
    save_evidence("phase16-final-red")
    print("PHASE16_E2E_RESULT=" + json.dumps(result, ensure_ascii=False, sort_keys=True))
    traceback.print_exc()
    raise
finally:
    driver.quit()
