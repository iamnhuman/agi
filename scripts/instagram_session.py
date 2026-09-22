#!/usr/bin/env python3
"""Keep an Instagram session local and return only profile avatar URLs."""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import sys
from pathlib import Path

import instaloader

ROOT = Path(__file__).resolve().parent.parent
STATE_DIR = ROOT / ".local" / "instagram"
SESSION_FILE = STATE_DIR / "session"
ACCOUNT_FILE = STATE_DIR / "account.json"


def make_loader() -> instaloader.Instaloader:
    return instaloader.Instaloader(
        download_pictures=False,
        download_videos=False,
        download_video_thumbnails=False,
        download_geotags=False,
        download_comments=False,
        save_metadata=False,
        compress_json=False,
        quiet=True,
        iphone_support=True,
    )


def save_account(username: str) -> None:
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    ACCOUNT_FILE.write_text(json.dumps({"username": username}) + "\n", encoding="utf-8")
    os.chmod(ACCOUNT_FILE, 0o600)
    if SESSION_FILE.exists():
        os.chmod(SESSION_FILE, 0o600)


def stored_username() -> str:
    try:
        value = json.loads(ACCOUNT_FILE.read_text(encoding="utf-8"))["username"]
    except (OSError, KeyError, TypeError, json.JSONDecodeError):
        raise RuntimeError("Instagram-сессия не подключена. Запустите npm run instagram:connect.")
    if not isinstance(value, str) or not re.fullmatch(r"[A-Za-z0-9._]+", value):
        raise RuntimeError("Файл Instagram-сессии повреждён. Подключите её заново.")
    return value


def connect_browser(browser: str) -> None:
    from instaloader.__main__ import import_session

    loader = make_loader()
    import_session(browser.lower(), loader, None)
    username = loader.context.username
    if not username:
        raise RuntimeError(f"В {browser} не найдена активная Instagram-сессия.")
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    loader.save_session_to_file(str(SESSION_FILE))
    save_account(username)
    print(f"Instagram подключён: @{username}")


def connect_terminal(username: str) -> None:
    if not re.fullmatch(r"[A-Za-z0-9._]+", username):
        raise RuntimeError("Некорректный Instagram-ник.")
    loader = make_loader()
    loader.interactive_login(username)
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    loader.save_session_to_file(str(SESSION_FILE))
    save_account(username)
    print(f"Instagram подключён: @{username}")


def load_session() -> tuple[instaloader.Instaloader, str]:
    username = stored_username()
    if not SESSION_FILE.is_file():
        raise RuntimeError("Instagram-сессия не найдена. Подключите её заново.")
    loader = make_loader()
    loader.load_session_from_file(username, str(SESSION_FILE))
    return loader, username


def status(check_online: bool) -> None:
    loader, username = load_session()
    valid = loader.test_login() == username if check_online else True
    if not valid:
        raise RuntimeError("Instagram-сессия истекла. Подключите её заново.")
    print(f"Instagram подключён: @{username}")


def avatar(username: str) -> None:
    if not re.fullmatch(r"[A-Za-z0-9._]+", username):
        raise RuntimeError("Некорректный Instagram-ник.")
    loader, _ = load_session()
    # Search is the least restricted authenticated endpoint and normally gives
    # us the exact profile id. It is incomplete for some accounts, so a direct
    # username lookup remains available as a fallback.
    profile = None
    try:
        search = loader.context.get_json("web/search/topsearch/", {"query": username})
        user = next(
            (
                row.get("user", {})
                for row in search.get("users", [])
                if row.get("user", {}).get("username", "").lower() == username.lower()
            ),
            None,
        )
    except instaloader.exceptions.InstaloaderException:
        user = None
    if user:
        profile = instaloader.Profile(loader.context, user)
    else:
        try:
            profile = instaloader.Profile.from_username(loader.context, username)
            if profile.username.lower() != username.lower():
                profile = None
            else:
                user = profile._node
        except instaloader.exceptions.InstaloaderException:
            profile = None
    if not user or profile is None:
        raise RuntimeError(f"Instagram не нашёл профиль @{username}.")
    best = None
    # Ask for the profile node first. Instaloader keeps the current profile
    # GraphQL document id and normalizes hd_profile_pic_url_info for us. The
    # old media/{profile_pic_id}/info endpoint is not reliable: Instagram now
    # returns "Media not found" for many perfectly normal profile pictures.
    try:
        hd_url = str(profile.profile_pic_url_no_iphone)
        if hd_url.startswith("https://"):
            best = {"url": hd_url, "width": 1080, "height": 1080, "hd": True}
    except instaloader.exceptions.InstaloaderException:
        pass

    media_id = user.get("profile_pic_id")
    try:
        media = loader.context.get_json(f"api/v1/media/{media_id}/info/", {}) if media_id and best is None else {}
        item = next(
            (
                value
                for value in media.get("items", [])
                if value.get("product_type") == "profile_pic"
                and value.get("user", {}).get("username", "").lower() == username.lower()
            ),
            None,
        )
        candidates = item.get("image_versions2", {}).get("candidates", []) if item else []
        valid = [
            value
            for value in candidates
            if isinstance(value.get("url"), str)
            and value["url"].startswith("https://")
            and isinstance(value.get("width"), int)
            and isinstance(value.get("height"), int)
        ]
        if valid and best is None:
            best = max(valid, key=lambda value: value["width"] * value["height"])
    except instaloader.exceptions.InstaloaderException:
        # Some normal profiles expose a current avatar in search but make the
        # corresponding profile_pic media record unavailable. This verified
        # profile URL is still safe; it is never a timeline publication.
        pass
    if best is None:
        fallback = user.get("profile_pic_url")
        if not isinstance(fallback, str) or not fallback.startswith("https://"):
            raise RuntimeError("Instagram не отдал изображение аватарки.")
        best = {"url": fallback, "width": 150, "height": 150}
    print(
        json.dumps(
            {
                "username": user["username"],
                "url": best["url"],
                "width": best["width"],
                "height": best["height"],
                "hd": best.get("hd", best["width"] >= 320 and best["height"] >= 320),
            }
        )
    )


def disconnect() -> None:
    if STATE_DIR.exists():
        shutil.rmtree(STATE_DIR)
    print("Instagram-сессия удалена.")


def main() -> None:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)
    connect = sub.add_parser("connect")
    connect.add_argument("browser", nargs="?", default="chrome")
    login = sub.add_parser("login")
    login.add_argument("username")
    check = sub.add_parser("status")
    check.add_argument("--online", action="store_true")
    get_avatar = sub.add_parser("avatar")
    get_avatar.add_argument("username")
    sub.add_parser("disconnect")
    args = parser.parse_args()
    if args.command == "connect":
        connect_browser(args.browser)
    elif args.command == "login":
        connect_terminal(args.username)
    elif args.command == "status":
        status(args.online)
    elif args.command == "avatar":
        avatar(args.username)
    else:
        disconnect()


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(str(error), file=sys.stderr)
        raise SystemExit(1)
