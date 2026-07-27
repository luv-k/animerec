"""
Run this once (from the backend folder, venv active) to attach a video file
to a show so it becomes watchable.

Usage: python mark_watchable.py
"""
from main import Session, Show

db = Session()
show = db.query(Show).filter(Show.title == "Cowboy Bebop").first()

if not show:
    print("Show not found — check the title matches what's in your database.")
else:
    show.video_filename = "sample.mp4"  # must exist under backend/media/
    db.commit()
    print(f"Updated: {show.title} -> {show.video_filename}")
