"""Avatar resolution regression tests; no network or session files are used."""
import importlib.util
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("instagram_session", Path(__file__).resolve().parents[1] / "scripts" / "instagram_session.py")
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)

SMALL = "https://scontent.cdninstagram.com/avatar.jpg?stp=dst-jpg_s100x100_tt6"
HD = "https://scontent.cdninstagram.com/avatar-hd.jpg"


class Profile:
    username = "artist"
    _node = {"username": "artist", "profile_pic_url_hd": SMALL, "profile_pic_url": SMALL}

    def __init__(self, mobile):
        self.mobile = mobile

    @property
    def _iphone_struct(self):
        if isinstance(self.mobile, Exception):
            raise self.mobile
        return self.mobile


class AvatarTests(unittest.TestCase):
    def resolve(self, mobile):
        context = SimpleNamespace()
        with patch.object(helper.instaloader.Profile, "from_username", return_value=Profile(mobile)) as lookup:
            result = helper.resolve_avatar(SimpleNamespace(context=context), "artist")
        lookup.assert_called_once_with(context, "artist")
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
        self.assertIn("feedback_required", result["notice"])
        self.assertNotIn("сессия", result["notice"])

    def test_restricted_profile_does_not_trigger_search_retries(self):
        context = SimpleNamespace()
        with patch.object(helper.instaloader.Profile, "from_username", side_effect=helper.instaloader.exceptions.QueryReturnedBadRequestException("feedback_required")) as lookup:
            with self.assertRaisesRegex(RuntimeError, "feedback_required"):
                helper.resolve_avatar(SimpleNamespace(context=context), "artist")
        self.assertEqual(lookup.call_count, 1)

    def test_login_required_has_distinct_message(self):
        message = helper.avatar_lookup_error(helper.instaloader.exceptions.LoginRequiredException("login_required"))
        self.assertIn("сессия истекла", message)
        self.assertNotIn("feedback_required", message)

    def test_unknown_size_is_not_guessed(self):
        candidate = helper.profile_avatar_candidates({"username": "artist", "profile_pic_url_hd": HD}, "artist")[0]
        self.assertEqual((candidate["width"], candidate["height"], candidate["hd"]), (0, 0, False))


if __name__ == "__main__":
    unittest.main()
