#!/usr/bin/env python3
"""Keep an Instagram session local and resolve public profile and post media."""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import sys
from pathlib import Path
from urllib.parse import unquote, urlparse

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


def profile_avatar_candidates(user: dict, username: str) -> list[dict]:
    if str(user.get("username", "")).lower() != username.lower():
        return []
    versions = user.get("hd_profile_pic_versions")
    values = [user.get("hd_profile_pic_url_info"), *(versions if isinstance(versions, list) else []),
              {"url": user.get("profile_pic_url_hd"), "preferred": True},
              {"url": user.get("profile_pic_url")}]
    candidates = []
    for value in values:
        if not isinstance(value, dict) or not isinstance(value.get("url"), str):
            continue
        parsed = urlparse(value["url"])
        if parsed.scheme != "https" or not re.search(r"(^|\.)(cdninstagram\.com|fbcdn\.net)$", parsed.hostname or ""):
            continue
        width = value.get("width") if isinstance(value.get("width"), int) else 0
        height = value.get("height") if isinstance(value.get("height"), int) else 0
        crop = re.search(r"(?:^|[_/])s(\d+)x(\d+)(?:[_/&]|$)", unquote(parsed.path + "?" + parsed.query), re.IGNORECASE)
        if crop:
            width, height = int(crop[1]), int(crop[2])
        candidates.append({"url": value["url"], "width": max(0, width), "height": max(0, height),
                           "hd": width >= 320 and height >= 320,
                           "preferred": value.get("preferred", False)})
    return candidates


def avatar_lookup_error(error: Exception) -> str:
    message = str(error)
    if "feedback_required" in message or isinstance(error, instaloader.exceptions.TooManyRequestsException):
        return "Instagram ограничил автоматические запросы (feedback_required). Повторите загрузку позже."
    if isinstance(error, instaloader.exceptions.LoginRequiredException) or "login_required" in message:
        return "Instagram-сессия истекла. Подключите её заново."
    return "Instagram не отдал данные профиля. Повторите загрузку позже."


def resolve_avatar(loader: instaloader.Instaloader, username: str) -> dict:
    # A failed endpoint must not consume all 30 seconds in automatic retries.
    loader.context.max_connection_attempts = 1
    loader.context.request_timeout = 12
    try:
        profile = instaloader.Profile.from_username(loader.context, username)
        resolved_username = profile.username
    except instaloader.exceptions.ProfileNotExistsException as error:
        raise RuntimeError(f"Instagram не нашёл профиль @{username}.") from error
    except instaloader.exceptions.InstaloaderException as error:
        raise RuntimeError(avatar_lookup_error(error)) from error
    if resolved_username.lower() != username.lower():
        raise RuntimeError("Instagram вернул другой профиль.")
    candidates = profile_avatar_candidates(profile._node, username)
    notice = None
    # The authenticated profile-info response contains actual HD avatar sizes.
    # The no_iphone property is explicitly the lower-quality web version.
    try:
        candidates.extend(profile_avatar_candidates(profile._iphone_struct, username))
    except (instaloader.exceptions.InstaloaderException, KeyError) as error:
        notice = avatar_lookup_error(error)
    if not candidates:
        raise RuntimeError(notice or "Instagram не отдал изображение аватарки.")
    best = max(candidates, key=lambda value: (value["hd"], value["preferred"] and not value["width"], value["width"] * value["height"]))
    result = {"username": username, **{key: best[key] for key in ("url", "width", "height", "hd")}}
    if notice and not best["hd"]:
        result["notice"] = notice
    return result


def avatar(username: str) -> None:
    if not re.fullmatch(r"[A-Za-z0-9._]+", username):
        raise RuntimeError("Некорректный Instagram-ник.")
    loader, _ = load_session()
    print(json.dumps(resolve_avatar(loader, username)))


def post(shortcode: str) -> None:
    if not re.fullmatch(r"[A-Za-z0-9_-]{5,30}", shortcode):
        raise RuntimeError("Некорректный код публикации Instagram.")
    loader, _ = load_session()
    media = instaloader.Post.from_shortcode(loader.context, shortcode)
    image = str(media.url)
    if not image.startswith("https://"):
        raise RuntimeError("Instagram не отдал обложку публикации.")
    print(json.dumps({
        "shortcode": shortcode,
        "url": image,
        "publishedAt": media.date_utc.date().isoformat(),
        "name": media.owner_username,
        "isVideo": bool(media.is_video),
        "videoUrl": media.video_url if media.is_video else None,
    }))


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
    get_post = sub.add_parser("post")
    get_post.add_argument("shortcode")
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
    elif args.command == "post":
        post(args.shortcode)
    else:
        disconnect()


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(str(error), file=sys.stderr)
        raise SystemExit(1)
