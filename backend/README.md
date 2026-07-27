# Anime Recommender — Backend

One consolidated FastAPI server: auth, shows, ratings, hybrid recommendations, video streaming.

## Setup

```bash
python3 -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

Server runs at http://127.0.0.1:8000 — interactive docs at http://127.0.0.1:8000/docs

## To enable playback for a show

1. Drop an .mp4 file you have the rights to into `media/`
2. Set that show's `video_filename` in the database to match (e.g. via a quick script, or extend `/shows` with a PATCH endpoint later)

## Notes

- Database file (`data/app.db`) and any files under `media/` are gitignored — don't commit real user data or video files
- `SECRET_KEY` in main.py should move to an environment variable before this ever goes near a real deployment
