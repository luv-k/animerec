"""
Real content ingestion: pulls anime directly from AniList and inserts them
into your database. Replaces hand-typed seed data entirely.

By default fetches currently TRENDING anime from the last 2 years, so you
get recent/currently-airing shows instead of decades-old all-time classics.

Run from your backend folder (venv active):
    python ingest_anime.py                    # trending, last 2 years, 50 shows
    python ingest_anime.py --count 100
    python ingest_anime.py --all-time          # switch back to all-time popularity ranking
    python ingest_anime.py --min-year 2023     # only shows from 2023 onward
"""
import argparse
import datetime
import requests
from main import SessionLocal, Show

QUERY = """
query ($page: Int, $perPage: Int, $sort: [MediaSort], $minDate: FuzzyDateInt) {
  Page(page: $page, perPage: $perPage) {
    media(sort: $sort, type: ANIME, startDate_greater: $minDate) {
      title { romaji }
      genres
      averageScore
      seasonYear
      coverImage { large }
      description(asHtml: false)
      episodes
      startDate { year month day }
      endDate { year month day }
      status
      trailer { id site }
    }
  }
}
"""


def fuzzy_date_to_string(fuzzy_date):
    """AniList gives {year, month, day} separately, possibly with nulls. Returns 'YYYY-MM-DD' or None."""
    if not fuzzy_date or not fuzzy_date.get("year"):
        return None
    y = fuzzy_date["year"]
    m = fuzzy_date.get("month") or 1
    d = fuzzy_date.get("day") or 1
    return f"{y:04d}-{m:02d}-{d:02d}"


def clean_description(raw):
    if not raw:
        return None
    # AniList descriptions often contain literal <br> tags even with asHtml: false
    return raw.replace("<br>", " ").replace("<br/>", " ").replace("<br />", " ").replace("\n", " ").strip()


def fetch_page(page, per_page, sort, min_year):
    variables = {"page": page, "perPage": per_page, "sort": [sort]}
    variables["minDate"] = (min_year * 10000 + 101) if min_year else None

    response = requests.post(
        "https://graphql.anilist.co",
        json={"query": QUERY, "variables": variables},
    )
    response.raise_for_status()
    return response.json()["data"]["Page"]["media"]


def ingest(count, sort, min_year):
    db = SessionLocal()
    inserted, updated, skipped = 0, 0, 0

    per_page = 50
    pages_needed = (count + per_page - 1) // per_page

    for page in range(1, pages_needed + 1):
        media_list = fetch_page(page, per_page, sort, min_year)

        for anime in media_list:
            title = anime["title"]["romaji"]
            genres = anime.get("genres") or []
            score = anime.get("averageScore")
            poster = anime["coverImage"]["large"]

            if not genres or score is None:
                skipped += 1
                continue

            synopsis = clean_description(anime.get("description"))
            total_episodes = anime.get("episodes")
            start_date = fuzzy_date_to_string(anime.get("startDate"))
            end_date = fuzzy_date_to_string(anime.get("endDate"))
            status = anime.get("status")
            trailer = anime.get("trailer")
            trailer_youtube_id = trailer["id"] if trailer and trailer.get("site") == "youtube" else None

            existing = db.query(Show).filter(Show.title == title).first()
            if existing:
                existing.genres = ",".join(genres)
                existing.rating = score / 10
                existing.poster_url = poster
                existing.source_type = "anime"
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
                    genres=",".join(genres),
                    rating=score / 10,
                    poster_url=poster,
                    source_type="anime",
                    synopsis=synopsis,
                    total_episodes=total_episodes,
                    start_date=start_date,
                    end_date=end_date,
                    status=status,
                    trailer_youtube_id=trailer_youtube_id,
                ))
                inserted += 1

    db.commit()
    db.close()
    print(f"Done. Inserted: {inserted}, Updated: {updated}, Skipped (missing data): {skipped}")


if __name__ == "__main__":
    current_year = datetime.date.today().year

    parser = argparse.ArgumentParser()
    parser.add_argument("--count", type=int, default=50, help="How many shows to fetch")
    parser.add_argument("--all-time", action="store_true",
                         help="Rank by all-time popularity instead of trending (surfaces old classics)")
    parser.add_argument("--min-year", type=int, default=current_year - 2,
                         help=f"Only include shows from this year onward (default: {current_year - 2})")
    args = parser.parse_args()

    sort_mode = "POPULARITY_DESC" if args.all_time else "TRENDING_DESC"
    min_year = None if args.all_time else args.min_year

    ingest(args.count, sort_mode, min_year)