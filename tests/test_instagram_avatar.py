"""Avatar resolution regression tests; no network or session files are used."""
import importlib.util
import json
import os
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
        lookup = Mock(side_effect=user) if isinstance(user, Exception) else Mock(return_value={"data": {"user": {"pk": "123", **user}}})
        context = SimpleNamespace(doc_id_graphql_query=lookup)
        small = helper.profile_avatar_candidates({"username": "artist", "profile_pic_url": SMALL}, "artist")
        with patch.object(helper, "public_profile_avatar", return_value=("123", small)) as public, \
                patch.object(helper, "avatar_api_cooling_down", return_value=False), \
                patch.object(helper, "pause_avatar_api"):
            result = helper.resolve_avatar(SimpleNamespace(context=context), "artist")
        public.assert_called_once_with(context, "artist")
        self.assertEqual(lookup.call_count, 1)
        self.assertEqual(lookup.call_args.args[0], helper.PROFILE_QUERY_ID)
        self.assertEqual(lookup.call_args.args[1]["id"], "123")
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

    def test_profile_query_abort_keeps_public_thumbnail(self):
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

    def test_public_hd_skips_authenticated_api(self):
        candidates = helper.profile_avatar_candidates({"username": "artist", "hd_profile_pic_url_info": {"url": HD, "width": 1080, "height": 1080}}, "artist")
        context = SimpleNamespace(doc_id_graphql_query=Mock())
        with patch.object(helper, "public_profile_avatar", return_value=("123", candidates)):
            result = helper.resolve_avatar(SimpleNamespace(context=context), "artist")
        self.assertTrue(result["hd"])
        context.doc_id_graphql_query.assert_not_called()

    def test_api_pause_survives_helper_restart_and_expires(self):
        with tempfile.TemporaryDirectory() as directory, \
                patch.object(helper, "STATE_DIR", Path(directory)), \
                patch.object(helper, "AVATAR_LIMIT_FILE", Path(directory) / "limits.json"), \
                patch.object(helper, "SESSION_FILE", Path(directory) / "session"), \
                patch.object(helper.time, "time", return_value=1000):
            helper.pause_avatar_api()
            self.assertTrue(helper.avatar_api_cooling_down())
            with patch.object(helper.time, "time", return_value=1601):
                self.assertFalse(helper.avatar_api_cooling_down())

    def test_paused_api_is_not_called_again(self):
        candidates = helper.profile_avatar_candidates({"username": "artist", "profile_pic_url": SMALL}, "artist")
        context = SimpleNamespace(doc_id_graphql_query=Mock())
        with patch.object(helper, "public_profile_avatar", return_value=("123", candidates)), \
                patch.object(helper, "avatar_api_cooling_down", return_value=True):
            result = helper.resolve_avatar(SimpleNamespace(context=context), "artist")
        self.assertFalse(result["hd"])
        self.assertIn("ограничил", result["notice"])
        context.doc_id_graphql_query.assert_not_called()

    def test_429_connection_error_also_pauses_api(self):
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
            helper.pause_avatar_api()
            helper.save_account("artist")
            self.assertFalse(helper.AVATAR_LIMIT_FILE.exists())

    def test_newer_session_and_old_mobile_pause_do_not_block_profile_query(self):
        with tempfile.TemporaryDirectory() as directory, \
                patch.object(helper, "STATE_DIR", Path(directory)), \
                patch.object(helper, "AVATAR_LIMIT_FILE", Path(directory) / "limits.json"), \
                patch.object(helper, "SESSION_FILE", Path(directory) / "session"):
            helper.AVATAR_LIMIT_FILE.write_text(json.dumps({"retryAfter": helper.time.time()+600}))
            self.assertFalse(helper.avatar_api_cooling_down())
            helper.pause_avatar_api()
            helper.SESSION_FILE.write_text("test-session")
            os.utime(helper.AVATAR_LIMIT_FILE, (1000, 1000))
            self.assertFalse(helper.avatar_api_cooling_down())


if __name__ == "__main__":
    unittest.main()
