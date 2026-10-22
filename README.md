# Naughty Dawgs

Turn one photo into a 15-second dance video. Choose clothing, mood, dance style,
video format, and the starting point of a song uploaded from your device.

## Run

The Dockerfile builds the React frontend and serves it through FastAPI. Configure
these environment variables on the server, keeping credentials out of Git:

| Variable | Purpose |
| --- | --- |
| `MONGO_URL` | MongoDB connection URL |
| `DB_NAME` | Database name (default `dogs_music_parody`) |
| `CLOUDINARY_URL` | Cloudinary credentials for uploads and generated videos |
| `ONE_MIN_AI_API_KEY` | 1min.AI key for Kling 3.0 image-to-video generation |
| `CORS_ORIGINS` | Comma-separated frontend origins if hosted separately |
| `PORT` | Server port (default `8000`) |

Existing deployments can alternatively keep `CLOUDINARY_CLOUD_NAME`,
`CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` instead of `CLOUDINARY_URL`.

For the combined Docker deployment on Railway, set Root Directory to `/` (the
repository root), rather than `backend`, so the build can include the frontend.
Confirm the build uses the root Dockerfile before deploying. Replace credentials
covered by the Railway security notice through the respective services, then
update the server's variables. Do not commit or share their values.

Use one server worker for this prototype. Generation runs in an in-process task;
a server restart can interrupt a job. A durable queue, access controls, and
per-user media/history isolation are needed before opening paid generation to
the public. The current history is shared across visitors.

## Verify

- Frontend: `cd frontend && npm ci --legacy-peer-deps && npm run build`
- Backend: install `backend/requirements.txt`, then run
  `python -m pytest backend/test_generation.py -q` (FFmpeg required for media test).

Offline tests cover duration validation, provider requests, playback routes, and
music merging. A live image-to-video generation still requires configured
services and provider credits; offline tests do not verify animation quality or
exact choreography.

## Music

Upload an actual audio file stored on your device, then choose its starting point.
Streaming-app offline downloads may not be available as files. Direct YouTube
import is not implemented in this version. Short songs are padded with silence
so the dance video retains its length.
