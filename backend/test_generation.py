"""Offline regression checks: pytest backend/test_generation.py."""
import asyncio
import json
import shutil
import subprocess
from types import SimpleNamespace
from unittest.mock import AsyncMock

import httpx
import pytest

import server


def test_api_rejects_unsupported_duration_and_missing_configuration(monkeypatch):
    monkeypatch.setattr(server, "ONE_MIN_AI_API_KEY", "")

    async def check():
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=server.app), base_url="http://test"
        ) as client:
            request = {"subject_media_ids": ["pet"], "prompt": "Do the Dougie"}
            response = await client.post("/api/generate-video", json={**request, "duration": 30})
            assert response.status_code == 422
            response = await client.post("/api/generate-video", json={**request, "duration": 15})
            assert response.status_code == 503

    asyncio.run(check())


def test_provider_receives_single_fifteen_second_job(monkeypatch):
    post = AsyncMock(return_value=httpx.Response(
        200, json={"aiRecord": {"uuid": "provider-job"}}
    ))

    class Client:
        def __init__(self, **kwargs):
            self.post = post

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            pass

    monkeypatch.setattr(server.httpx, "AsyncClient", Client)
    assert asyncio.run(server.start_1min_video_job("pet.png", "Dougie", 15, "9:16")) == "provider-job"
    payload = post.call_args.kwargs["json"]["promptObject"]
    assert payload["version"] == "3.0"
    assert payload["duration"] == 15
    assert payload["aspect_ratio"] == "9:16"


def test_playback_redirect_and_legacy_route(monkeypatch):
    collection = SimpleNamespace(find_one=AsyncMock(return_value={
        "id": "finished", "status": "completed", "video_path": "https://media.example/dance.mp4"
    }))
    monkeypatch.setattr(server, "db", SimpleNamespace(video_generations=collection))

    async def check():
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=server.app), base_url="http://test"
        ) as client:
            for path in ["/api/videos/finished/content", "/api/video-file/finished"]:
                response = await client.get(path)
                assert response.status_code == 307
                assert response.headers["location"] == "https://media.example/dance.mp4"

    asyncio.run(check())


@pytest.mark.skipif(not shutil.which("ffmpeg"), reason="FFmpeg is required")
def test_music_offset_and_short_song_keep_fifteen_second_video(tmp_path):
    video = tmp_path / "video.mp4"
    audio = tmp_path / "audio.wav"
    output = tmp_path / "finished.mp4"
    subprocess.run([
        "ffmpeg", "-y", "-f", "lavfi", "-i", "color=black:s=160x90:r=10:d=15",
        "-c:v", "libx264", "-pix_fmt", "yuv420p", str(video)
    ], check=True, capture_output=True)
    subprocess.run([
        "ffmpeg", "-y", "-f", "lavfi", "-i", "sine=frequency=440:duration=2", str(audio)
    ], check=True, capture_output=True)
    output.write_bytes(asyncio.run(server.merge_music(
        video.read_bytes(), audio.read_bytes(), "wav", start_seconds=1
    )))
    metadata = json.loads(subprocess.check_output([
        "ffprobe", "-v", "quiet", "-show_format", "-show_streams", "-of", "json", str(output)
    ]))
    assert abs(float(metadata["format"]["duration"]) - 15) < 0.3
    assert {s["codec_type"] for s in metadata["streams"]} == {"video", "audio"}
