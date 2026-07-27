"""
Pulls Western animated TV shows (Rick and Morty, Avatar, etc.) from TMDB
and inserts them into your database, tagged source_type="western_animation".

Requires a free TMDB API key: https://www.themoviedb.org/settings/api
Set it as an environment variable before running:
    export TMDB_API_KEY=your_key_here      (Mac/Linux)
    set TMDB_API_KEY=your_key_here         (Windows cmd)
    $env:TMDB_API_KEY="your_key_here"      (Windows PowerShell)

Run from your backend folder (venv active):
    python ingest_tmdb.py
    python ingest_tmdb.py --count 100
"""
import argparse
import os
import time
import requests
from main import SessionLocal, Show

API_KEY = os.environ.get("TMDB_API_KEY")
ANIMATION_GENRE_ID = 16  # TMDB's fixed genre ID for "Animation"

# TMDB genre IDs -> plain names, so we store readable genres like your AniList data
TMDB_GENRE_NAMES = {
    16: "Animation", 35: "Comedy", 18: "Drama", 10759: "Action & Adventure",
    9648: "Mystery", 10765: "Sci-Fi & Fantasy", 80: "Crime", 10762: "Kids",
    10751: "Family", 99: "Documentary",
}


def request_with_retries(url, params, max_retries=3):
    """
    Network hiccups (connection resets, timeouts) happen -- especially when
    firing many requests in a row, which can look like rate-limiting to the
    server. Retry a few times with a short backoff before giving up.
    """
    last_error = None
    for attempt in range(1, max_retries + 1):
        try:
            response = requests.get(url, params=params, timeout=15)
            response.raise_for_status()
            return response.json()
        except (requests.exceptions.ConnectionError, requests.exceptions.Timeout) as e:
            last_error = e
            wait = attempt * 2  # 2s, 4s, 6s
            print(f"  Network hiccup ({e.__class__.__name__}), retrying in {wait}s... (attempt {attempt}/{max_retries})")
            time.sleep(wait)
    raise last_error


def fetch_page(page):
    data = request_with_retries(
        "https://api.themoviedb.org/3/discover/tv",
        params={
            "api_key": API_KEY,
            "with_genres": ANIMATION_GENRE_ID,
            "with_original_language": "en",  # excludes anime, which is ja
            "sort_by": "popularity.desc",
            "page": page,
        },
    )
    return data["results"]


def fetch_details(tv_id):
    """Second call per show -- gets synopsis, episode count, dates, status, trailer."""
    return request_with_retries(
        f"https://api.themoviedb.org/3/tv/{tv_id}",
        params={"api_key": API_KEY, "append_to_response": "videos"},
    )


def find_trailer_id(videos_response):
    for video in videos_response.get("videos", {}).get("results", []):
        if video.get("site") == "YouTube" and video.get("type") == "Trailer":
            return video["key"]
    return None


def ingest(count):
    if not API_KEY:
        print("ERROR: TMDB_API_KEY environment variable not set. See the top of this file for instructions.")
        return

    db = SessionLocal()
    inserted, updated, skipped = 0, 0, 0

    per_page = 20  # TMDB's discover endpoint returns 20 per page
    pages_needed = (count + per_page - 1) // per_page

    for page in range(1, pages_needed + 1):
        results = fetch_page(page)

        for show_summary in results:
            title = show_summary.get("name")
            if not title:
                skipped += 1
                continue

            try:
                details = fetch_details(show_summary["id"])
            except requests.exceptions.RequestException as e:
                print(f"  Skipping '{title}' after repeated failures: {e}")
                skipped += 1
                continue

            time.sleep(0.3)  # be a little gentle on TMDB's API between requests

            genre_names = [TMDB_GENRE_NAMES.get(g["id"], g["name"]) for g in details.get("genres", [])]
            score = details.get("vote_average")
            poster_path = details.get("poster_path")

            if not genre_names or not score or not poster_path:
                skipped += 1
                continue

            poster_url = f"https://image.tmdb.org/t/p/w500{poster_path}"
            synopsis = details.get("overview") or None
            total_episodes = details.get("number_of_episodes")
            start_date = details.get("first_air_date") or None
            status = details.get("status")  # "Ended", "Returning Series", etc.
            end_date = details.get("last_air_date") if status == "Ended" else None
            trailer_youtube_id = find_trailer_id(details)

            existing = db.query(Show).filter(Show.title == title).first()
            if existing:
                existing.genres = ",".join(genre_names)
                existing.rating = score
                existing.poster_url = poster_url
                existing.source_type = "western_animation"
                existing.synopsis = synopsis
                existing.total_episodes = total_episodes
                existing.start_date = start_date
                existing.end_date = end_date
                existing.status = status
                existing.trailer_youtube_id = trailer_youtube_id
                updated += 1
            else:
                db.add(Show(
                    title=title,
                    genres=",".join(genre_names),
                    rating=score,
                    poster_url=poster_url,
                    source_type="western_animation",
                    synopsis=synopsis,
                    total_episodes=total_episodes,
                    start_date=start_date,
                    end_date=end_date,
                    status=status,
                    trailer_youtube_id=trailer_youtube_id,
                ))
                inserted += 1

        db.commit()  # save progress after each page, so a later failure doesn't lose earlier work
        print(f"  Page {page}/{pages_needed} done. Inserted so far: {inserted}, Updated: {updated}")

    db.close()
    print(f"Done. Inserted: {inserted}, Updated: {updated}, Skipped (missing data): {skipped}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--count", type=int, default=40, help="How many shows to fetch")
    args = parser.parse_args()
    ingest(args.count)