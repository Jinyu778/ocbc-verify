"""STATIC check of the Android plugin source (Kotlin can't be compiled or run in this environment).

This only proves the VoIP detection code and its 'untested on a device' warning are present.
It does NOT prove the plugin works on a phone: that must be tested on real hardware.
"""

from pathlib import Path

KT = (Path(__file__).resolve().parents[2] / "android-plugin" / "android" / "src" / "main" / "java" / "sg"
      / "safebank" / "callstate" / "CallStatePlugin.kt").read_text(encoding="utf-8")


def test_voip_mode_counts_as_in_a_call():
    assert "AudioManager.MODE_IN_COMMUNICATION" in KT
    snapshot = KT[KT.index("private fun snapshot()"):]
    assert 'put("onCall", onCall || voipActive || isVoipCallNow())' in snapshot


def test_voip_listener_removed_on_destroy():
    assert "addOnModeChangedListener" in KT and "removeOnModeChangedListener" in KT


def test_untested_on_device_comment_present():
    assert "UNTESTED ON A REAL DEVICE" in KT


def test_still_never_reads_numbers_or_audio():
    assert "phoneNumber is deliberately ignored" in KT
    for forbidden in ("AudioRecord", "MediaRecorder", "READ_CALL_LOG", "READ_CONTACTS", "getLine1Number"):
        assert forbidden not in KT
