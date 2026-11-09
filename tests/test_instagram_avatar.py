"""Avatar resolution regression tests; no network or session files are used."""
from base64 import b64decode
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

spec = importlib.util.spec_from_file_location("instagram_session", Path(__file__).resolve().parents[1] / "scripts" / "instagram_session.py")
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)

SMALL = "https://scontent.cdninstagram.com/avatar.jpg?stp=dst-jpg_s100x100_tt6"
HD = "https://scontent.cdninstagram.com/avatar-hd.jpg"


class AvatarTests(unittest.TestCase):
    def resolve(self, user):
        lookup = Mock(side_effect=user) if isinstance(user, Exception) else Mock(return_value={"user": {"pk": "123", **user}})
        context = SimpleNamespace(get_iphone_json=lookup)
        small = helper.profile_avatar_candidates({"username": "artist", "profile_pic_url": SMALL}, "artist")
        with patch.object(helper, "public_profile_avatar", return_value=("123", small)) as public:
            result = helper.resolve_avatar(SimpleNamespace(context=context), "artist")
        public.assert_called_once_with(context, "artist")
        self.assertEqual(lookup.call_count, 1)
        self.assertEqual(lookup.call_args.args, ("api/v1/users/123/info/", {}))
        self.assertEqual(context.max_connection_attempts, 1)
        return result

    def test_authenticated_hd_beats_web_thumbnail(self):
        result = self.resolve({"username": "artist", "hd_profile_pic_url_info": {"url": HD, "width": 1080, "height": 1080}})
        self.assertEqual((result["url"], result["width"], result["height"], result["hd"]), (HD, 1080, 1080, True))

    def test_largest_verified_version_wins(self):
        result = self.resolve({"username": "artist", "hd_profile_pic_versions": [
            {"url": HD + "?size=320", "width": 320, "height": 320},
            {"url": HD, "width": 1080, "height": 1080}]})
        self.assertEqual(result["url"], HD)

    def test_thumbnail_is_never_labelled_1080(self):
        result = self.resolve({"username": "artist", "profile_pic_url_hd": SMALL})
        self.assertEqual((result["width"], result["height"], result["hd"]), (100, 100, False))

    def test_url_crop_overrides_incorrect_hd_metadata(self):
        candidate = helper.profile_avatar_candidates({"username": "artist", "hd_profile_pic_url_info": {"url": SMALL, "width": 1080, "height": 1080}}, "artist")[0]
        self.assertEqual((candidate["width"], candidate["hd"]), (100, False))

    def test_other_profile_and_timeline_photos_are_ignored(self):
        result = self.resolve({"username": "other", "hd_profile_pic_url_info": {"url": HD, "width": 1080, "height": 1080}})
        self.assertEqual(result["url"], SMALL)
        self.assertEqual(helper.profile_avatar_candidates({"username": "artist", "image_versions2": {"candidates": [{"url": HD, "width": 2000, "height": 2000}]}}, "artist"), [])

    def test_restriction_retains_small_avatar_without_false_hd(self):
        result = self.resolve(helper.instaloader.exceptions.QueryReturnedBadRequestException("feedback_required"))
        self.assertEqual(result["url"], SMALL)
        self.assertFalse(result["hd"])
        self.assertIn("ограничил", result["notice"])
        self.assertNotIn("сессия", result["notice"])

    def test_actual_abort_exception_is_handled_without_search_retries(self):
        context = SimpleNamespace()
        with patch.object(helper, "public_profile_avatar", side_effect=helper.instaloader.exceptions.AbortDownloadException("feedback_required")) as lookup:
            with self.assertRaisesRegex(RuntimeError, "ограничил"):
                helper.resolve_avatar(SimpleNamespace(context=context), "artist")
        self.assertEqual(lookup.call_count, 1)

    def test_login_required_has_distinct_message(self):
        message = helper.avatar_lookup_error(helper.instaloader.exceptions.LoginRequiredException("login_required"))
        self.assertIn("сессия истекла", message)
        self.assertNotIn("feedback_required", message)

    def test_unknown_size_is_not_guessed(self):
        candidate = helper.profile_avatar_candidates({"username": "artist", "profile_pic_url_hd": HD}, "artist")[0]
        self.assertEqual((candidate["width"], candidate["height"], candidate["hd"]), (0, 0, False))

    def test_mobile_api_abort_keeps_public_thumbnail(self):
        result = self.resolve(helper.instaloader.exceptions.AbortDownloadException("400 Bad Request feedback_required"))
        self.assertEqual(result["url"], SMALL)
        self.assertIn("HD-аватарок", result["notice"])

    def test_public_profile_uses_pk_and_ignores_other_profiles_and_posts(self):
        data = {"data": {"xig_user_by_username": {"pk": "123", "id": "opaque-graphql-id", "username": "ArTiSt", "profile_pic_url": SMALL},
                         "other": {"pk": "456", "username": "other", "profile_pic_url_hd": HD},
                         "post": {"username": "artist", "image_versions2": {"candidates": [{"url": HD, "width": 2000}]}}}}
        profile_id, candidates = helper.public_avatar_data('<script type="application/json">' + json.dumps(data) + '</script>', "artist")
        self.assertEqual(profile_id, "123")
        self.assertEqual([candidate["url"] for candidate in candidates], [SMALL])

    def test_public_page_without_matching_profile_is_rejected(self):
        with self.assertRaisesRegex(RuntimeError, "нужного профиля"):
            helper.public_avatar_data('<script type="application/json">{"username":"other","pk":"123"}</script>', "artist")

    def test_numeric_relay_references_do_not_conflict_with_profile_pk(self):
        data = {"profile": {"pk": "255545193", "id": "17841401715793992", "username": "artist", "profile_pic_url": SMALL},
                "references": [{"username": "artist", "id": "17841401715793992"}] * 3}
        profile_id, candidates = helper.public_avatar_data('<script type="application/json">' + json.dumps(data) + '</script>', "artist")
        self.assertEqual(profile_id, "255545193")
        self.assertEqual([candidate["url"] for candidate in candidates], [SMALL])

    def test_conflicting_profile_pks_are_still_rejected(self):
        data = [{"pk": "123", "username": "artist", "profile_pic_url": SMALL},
                {"pk": "456", "username": "artist", "profile_pic_url_hd": HD}]
        with self.assertRaisesRegex(RuntimeError, "нужного профиля"):
            helper.public_avatar_data('<script type="application/json">' + json.dumps(data) + '</script>', "artist")

    def test_public_hd_skips_authenticated_api(self):
        candidates = helper.profile_avatar_candidates({"username": "artist", "hd_profile_pic_url_info": {"url": HD, "width": 1080, "height": 1080}}, "artist")
        context = SimpleNamespace(get_iphone_json=Mock())
        with patch.object(helper, "public_profile_avatar", return_value=("123", candidates)):
            result = helper.resolve_avatar(SimpleNamespace(context=context), "artist")
        self.assertTrue(result["hd"])
        context.get_iphone_json.assert_not_called()

    def test_previous_pause_does_not_block_explicit_retries(self):
        candidates = helper.profile_avatar_candidates({"username": "artist", "profile_pic_url": SMALL}, "artist")
        context = SimpleNamespace(get_iphone_json=Mock(side_effect=helper.instaloader.exceptions.AbortDownloadException("feedback_required")))
        with tempfile.TemporaryDirectory() as directory, \
                patch.object(helper, "AVATAR_LIMIT_FILE", Path(directory) / "limits.json"), \
                patch.object(helper, "public_profile_avatar", return_value=("123", candidates)):
            helper.AVATAR_LIMIT_FILE.write_text(json.dumps({"source": "profile-query", "retryAfter": 4102444800}))
            for _ in range(2):
                result = helper.resolve_avatar(SimpleNamespace(context=context), "artist")
                self.assertFalse(result["hd"])
                self.assertIn("ограничил", result["notice"])
        self.assertEqual(context.get_iphone_json.call_count, 2)

    def test_429_connection_error_has_restriction_message(self):
        error = helper.instaloader.exceptions.ConnectionException("JSON Query: 429 Too Many Requests")
        self.assertTrue(helper.avatar_api_restricted(error))
        self.assertIn("ограничил", helper.avatar_lookup_error(error))

    def test_explicit_hd_url_without_dimensions_is_selected_for_measurement(self):
        result = self.resolve({"username": "artist", "hd_profile_pic_url_info": {"url": HD}, "profile_pic_url": SMALL})
        self.assertEqual(result["url"], HD)
        self.assertEqual((result["width"], result["height"], result["hd"]), (0, 0, False))

    def test_wrong_profile_id_is_rejected(self):
        result = self.resolve({"pk": "456", "username": "artist", "hd_profile_pic_url_info": {"url": HD, "width": 1080, "height": 1080}})
        self.assertEqual(result["url"], SMALL)

    def test_reconnecting_clears_previous_pause(self):
        with tempfile.TemporaryDirectory() as directory, \
                patch.object(helper, "STATE_DIR", Path(directory)), \
                patch.object(helper, "AVATAR_LIMIT_FILE", Path(directory) / "limits.json"), \
                patch.object(helper, "ACCOUNT_FILE", Path(directory) / "account.json"), \
                patch.object(helper, "SESSION_FILE", Path(directory) / "session"):
            helper.AVATAR_LIMIT_FILE.write_text("old pause")
            helper.save_account("artist")
            self.assertFalse(helper.AVATAR_LIMIT_FILE.exists())
class CookieFileTests(unittest.TestCase):
    def write_cookies(self, path, account="123", token="test-session", expiry="4102444800"):
        values = {"sessionid": token, "csrftoken": "test-csrf", "ds_user_id": account}
        path.write_text("# Netscape HTTP Cookie File\n" + "".join(
            f".instagram.com\tTRUE\t/\tTRUE\t{expiry}\t{name}\t{value}\n" for name, value in values.items())
            + ".example.com\tTRUE\t/\tTRUE\t4102444800\tother\tignored\n")

    def test_ready_cookie_file_overrides_saved_account_and_is_reread(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "cookies.txt"
            self.write_cookies(path)
            loader = Mock()
            with patch.object(helper, "COOKIE_FILE", path), patch.object(helper, "make_loader", return_value=loader), \
                    patch.object(helper, "stored_username", side_effect=AssertionError("Old account must not be read")):
                self.assertEqual(helper.load_session(), (loader, "123"))
                loader.load_session.assert_called_with("123", {"sessionid": "test-session", "csrftoken": "test-csrf", "ds_user_id": "123"})
                self.write_cookies(path, account="456", token="replacement-session")
                self.assertEqual(helper.load_session(), (loader, "456"))
                self.assertEqual(loader.load_session.call_args.args[1]["sessionid"], "replacement-session")

    def test_expired_or_malformed_file_does_not_silently_use_old_account(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "cookies.txt"
            with patch.object(helper, "COOKIE_FILE", path), patch.object(helper, "stored_username") as old:
                self.write_cookies(path, expiry="1")
                with self.assertRaisesRegex(RuntimeError, "свежим экспортом"):
                    helper.load_session()
                path.write_text("invalid cookie file")
                with self.assertRaisesRegex(RuntimeError, "формате Netscape"):
                    helper.load_session()
                old.assert_not_called()

    def test_mobile_request_authenticates_cookie_session(self):
        loader = helper.make_loader()
        self.addCleanup(loader.close)
        loader.load_session("123", {"ds_user_id": "123", "sessionid": "test-session", "csrftoken": "test-csrf"})
        with patch.object(loader.context, "get_json", return_value={"user": {"pk": "456"}}) as request:
            loader.context.get_iphone_json("api/v1/users/456/info/", {})
        session = request.call_args.args[3]
        authorization = session.headers.get("authorization", "")
        self.assertTrue(authorization.startswith("Bearer IGT:2:"), "The mobile API requires bearer auth, not cookies alone")
        token = json.loads(b64decode(authorization.removeprefix("Bearer IGT:2:")))
        self.assertEqual(token, {"ds_user_id": "123", "sessionid": "test-session"})
        self.assertFalse(session.cookies)

    def test_online_status_checks_the_authenticated_profile_api(self):
        context = SimpleNamespace(user_id="123", get_iphone_json=Mock(return_value={"user": {"pk": "123", "username": "account"}}))
        loader = SimpleNamespace(context=context)
        with patch.object(helper, "load_session", return_value=(loader, "123")), patch("builtins.print") as output:
            helper.status(True)
        context.get_iphone_json.assert_called_once_with("api/v1/users/123/info/", {})
        self.assertIn("@account", output.call_args.args[0])


class AvatarCommandTests(unittest.TestCase):
    def test_command_uses_hd_api_without_legacy_search(self):
        small = helper.profile_avatar_candidates({"username": "artist", "profile_pic_url": SMALL}, "artist")
        context = SimpleNamespace(get_iphone_json=Mock(return_value={"user": {
            "pk": "123", "username": "artist", "hd_profile_pic_url_info": {"url": HD, "width": 1080, "height": 1080}}}))
        loader = SimpleNamespace(context=context)
        with patch.object(helper, "load_session", return_value=(loader, "account")), \
                patch.object(helper, "public_profile_avatar", return_value=("123", small)), \
                patch.object(helper.instaloader.Profile, "from_username", side_effect=AssertionError("Legacy lookup must not run")), \
                patch("builtins.print") as output:
            helper.avatar("artist")
        result = json.loads(output.call_args.args[0])
        self.assertEqual((result["username"], result["url"], result["width"], result["height"], result["hd"]), ("artist", HD, 1080, 1080, True))
        context.get_iphone_json.assert_called_once_with("api/v1/users/123/info/", {})


if __name__ == "__main__":
    unittest.main()
