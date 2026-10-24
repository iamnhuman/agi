#!/usr/bin/env python3
"""Keep an Instagram session local and resolve public profile and post media."""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import sys
import time
from http.cookiejar import LoadError, MozillaCookieJar
from pathlib import Path
from urllib.parse import unquote, urlparse

import instaloader
from requests.exceptions import RequestException

ROOT = Path(__file__).resolve().parent.parent
STATE_DIR = ROOT / ".local" / "instagram"
SESSION_FILE = STATE_DIR / "session"
ACCOUNT_FILE = STATE_DIR / "account.json"
COOKIE_FILE = ROOT / "cookies.txt"
AVATAR_LIMIT_FILE = STATE_DIR / "avatar-api-limit.json"
LOOKUP_ERRORS = (instaloader.exceptions.InstaloaderException, instaloader.exceptions.AbortDownloadException)
AVATAR_LIMIT_NOTICE = "Instagram временно ограничил загрузку HD-аватарок. Доступна только уменьшенная версия; повторите позже."
PROFILE_QUERY_ID = "27937681195819736"  # PolarisProfilePageContentQuery in Instaloader 4.15.3.


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
        max_connection_attempts=1,
        request_timeout=12,
    )


def save_account(username: str) -> None:
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    ACCOUNT_FILE.write_text(json.dumps({"username": username}) + "\n", encoding="utf-8")
    os.chmod(ACCOUNT_FILE, 0o600)
    if SESSION_FILE.exists():
        os.chmod(SESSION_FILE, 0o600)
    AVATAR_LIMIT_FILE.unlink(missing_ok=True)


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
    # Read the file for every lookup, so replacing cookies.txt takes effect
    # without restarting the site or importing anything from a browser.
    if COOKIE_FILE.exists():
        jar = MozillaCookieJar(str(COOKIE_FILE))
        try:
            jar.load(ignore_discard=True, ignore_expires=False)
        except (OSError, LoadError, ValueError):
            raise RuntimeError("Не удалось прочитать cookies.txt. Нужен экспорт cookies Instagram в формате Netscape.") from None
        cookies = {cookie.name: cookie.value for cookie in jar
                   if cookie.domain.lstrip(".").lower() == "instagram.com"}
        if not all(cookies.get(name) for name in ("sessionid", "csrftoken", "ds_user_id")):
            raise RuntimeError("В cookies.txt нет действующих cookies Instagram: sessionid, csrftoken и ds_user_id. Замените файл свежим экспортом.")
        loader = make_loader()
        loader.load_session(cookies["ds_user_id"], cookies)
        return loader, cookies["ds_user_id"]
    username = stored_username()
    if not SESSION_FILE.is_file():
        raise RuntimeError("Instagram-сессия не найдена. Подключите её заново.")
    loader = make_loader()
    loader.load_session_from_file(username, str(SESSION_FILE))
    return loader, username


def status(check_online: bool) -> None:
    loader, username = load_session()
    if check_online:
        current_username = loader.test_login()
        if not current_username or (not COOKIE_FILE.exists() and current_username != username):
            raise RuntimeError("Instagram не подтвердил вход. Замените cookies.txt свежим экспортом и повторите проверку.")
        print(f"Instagram подключён: @{current_username}")
    elif COOKIE_FILE.exists():
        print("Готовый cookies.txt подключён. Сайт читает его при каждом запросе Instagram.")
    else:
        print(f"Instagram подключён: @{username}")


def profile_avatar_candidates(user: dict, username: str) -> list[dict]:
    if str(user.get("username", "")).lower() != username.lower():
        return []
    versions = user.get("hd_profile_pic_versions")
    hd_info = user.get("hd_profile_pic_url_info")
    values = [{**hd_info, "preferred": True} if isinstance(hd_info, dict) else None, *(versions if isinstance(versions, list) else []),
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
    if avatar_api_restricted(error):
        return AVATAR_LIMIT_NOTICE
    if "checkpoint_required" in message or "challenge_required" in message:
        return "Instagram просит подтвердить вход в аккаунт. После подтверждения повторите загрузку."
    if isinstance(error, instaloader.exceptions.LoginRequiredException) or "login_required" in message:
        return "Instagram-сессия истекла. Замените cookies.txt свежим экспортом."
    return "Instagram не отдал данные профиля. Повторите загрузку позже."


def avatar_api_restricted(error: Exception) -> bool:
    return ("feedback_required" in str(error) or "429" in str(error)
            or isinstance(error, instaloader.exceptions.TooManyRequestsException))


def avatar_api_cooling_down() -> bool:
    try:
        limit = json.loads(AVATAR_LIMIT_FILE.read_text())
        # An earlier pause applied to the failing mobile API, not this query.
        if limit.get("source") != "profile-query":
            return False
        if any(path.exists() and path.stat().st_mtime > AVATAR_LIMIT_FILE.stat().st_mtime
               for path in (COOKIE_FILE, SESSION_FILE)):
            return False
        return float(limit["retryAfter"]) > time.time()
    except (OSError, ValueError, KeyError, TypeError):
        return False


def pause_avatar_api() -> None:
    # Persist the pause across helper processes; repeated button clicks must not
    # keep sending requests to an endpoint that has already refused them.
    try:
        STATE_DIR.mkdir(parents=True, exist_ok=True)
        AVATAR_LIMIT_FILE.write_text(json.dumps({"source": "profile-query", "retryAfter": time.time() + 600}) + "\n")
        os.chmod(AVATAR_LIMIT_FILE, 0o600)
    except OSError:
        pass


def public_avatar_data(html: str, username: str) -> tuple[str, list[dict]]:
    pks, ids, candidates = set(), set(), []

    def visit(value):
        if isinstance(value, dict):
            if isinstance(value.get("username"), str) and value["username"].lower() == username.lower():
                # Relay references repeat the same username with a different,
                # also numeric GraphQL id. A profile's pk takes precedence over
                # every such reference, not just over id in the same object.
                identifier = str(value.get("pk") or value.get("id") or "")
                if identifier.isascii() and identifier.isdigit():
                    (pks if value.get("pk") else ids).add(identifier)
                    candidates.extend(profile_avatar_candidates(value, username))
            for child in value.values():
                if isinstance(child, (dict, list)):
                    visit(child)
        elif isinstance(value, list):
            for child in value:
                visit(child)

    for script in re.finditer(r'<script\b[^>]*type=["\']application/json["\'][^>]*>(.*?)</script>', html, re.DOTALL | re.IGNORECASE):
        try:
            visit(json.loads(script[1]))
        except (ValueError, RecursionError):
            continue
    identifiers = pks or ids
    if len(identifiers) != 1:
        raise RuntimeError("Instagram не отдал данные нужного профиля. Повторите загрузку позже.")
    return identifiers.pop(), candidates


def public_profile_avatar(context, username: str) -> tuple[str, list[dict]]:
    # Browser-navigation headers are necessary for Instagram to embed profile
    # data. This request is anonymous and does not use or change login cookies.
    with context.get_anonymous_session() as session:
        with session.get(f"https://www.instagram.com/{username}/", allow_redirects=False, stream=True,
                         headers={"Accept": "text/html", "Sec-Fetch-Dest": "document",
                                  "Sec-Fetch-Mode": "navigate", "Sec-Fetch-Site": "none"}) as response:
            if response.status_code == 404:
                raise RuntimeError(f"Instagram не нашёл профиль @{username}.")
            if response.status_code != 200:
                raise RuntimeError("Instagram не отдал публичную страницу профиля. Повторите позже.")
            body = bytearray()
            for chunk in response.iter_content(65536):
                body.extend(chunk)
                if len(body) > 5 * 1024 * 1024:
                    raise RuntimeError("Instagram вернул слишком большую страницу профиля.")
    return public_avatar_data(body.decode("utf-8", errors="replace"), username)


def resolve_avatar(loader: instaloader.Instaloader, username: str) -> dict:
    # A failed endpoint must not consume all 30 seconds in automatic retries.
    loader.context.max_connection_attempts = 1
    loader.context.request_timeout = 12
    try:
        profile_id, candidates = public_profile_avatar(loader.context, username)
    except (*LOOKUP_ERRORS, RequestException) as error:
        raise RuntimeError(avatar_lookup_error(error)) from error
    notice = None
    if not any(candidate["hd"] for candidate in candidates):
        if avatar_api_cooling_down():
            notice = AVATAR_LIMIT_NOTICE
        else:
            try:
                # Keep the working web profile query. The mobile users/info API
                # can refuse the same valid browser session that this accepts.
                # Call the query directly to avoid Instaloader's obsolete search
                # fallback when a profile field is unavailable.
                data = loader.context.doc_id_graphql_query(PROFILE_QUERY_ID, {
                    "id": profile_id, "render_surface": "PROFILE",
                    "__relay_internal__pv__PolarisCannesGuardianExperienceEnabledrelayprovider": True,
                    "__relay_internal__pv__PolarisCASB976ProfileEnabledrelayprovider": False,
                    "__relay_internal__pv__PolarisRepostsConsumptionEnabledrelayprovider": False,
                    "__relay_internal__pv__PolarisWebSchoolsEnabledrelayprovider": False,
                    "enable_integrity_filters": True,
                })
                user = (data.get("data") or {}).get("user") or {}
                if str(user.get("pk") or user.get("id")) != profile_id:
                    raise KeyError("profile id mismatch")
                candidates.extend(profile_avatar_candidates(user, username))
            except (*LOOKUP_ERRORS, KeyError) as error:
                notice = avatar_lookup_error(error)
                if avatar_api_restricted(error):
                    pause_avatar_api()
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
        print(avatar_lookup_error(error) if isinstance(error, LOOKUP_ERRORS) else str(error), file=sys.stderr)
        raise SystemExit(1)
