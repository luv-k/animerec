"""
Fetches real, current poster URLs from AniList for your seeded shows and
updates them directly in the database -- no need to delete/reseed.

Run this once from your backend folder (venv active):
    python fix_posters.py
"""
import requests
from main import SessionLocal, Show

QUERY = """
query ($search: String) {
  Media(search: $search, type: ANIME) {
    title { romaji }
    coverImage { large }
  }
}
"""

TITLES_TO_SEARCH = {
    "Cowboy Bebop": "Cowboy Bebop",
    "Samurai Champloo": "Samurai Champloo",
    "Attack on Titan": "Shingeki no Kyojin",
    "K-On!": "K-On!",
    "One Punch Man": "One Punch Man",
    "Mob Psycho 100": "Mob Psycho 100",
}

db = SessionLocal()

for db_title, search_term in TITLES_TO_SEARCH.items():
    response = requests.post(
        "https://graphql.anilist.co",
        json={"query": QUERY, "variables": {"search": search_term}},
    )
    data = response.json()

    media = data.get("data", {}).get("Media")
    if not media:
        print(f"NOT FOUND: {db_title} (searched '{search_term}')")
        continue

    poster_url = media["coverImage"]["large"]
    show = db.query(Show).filter(Show.title == db_title).first()

    if show:
        show.poster_url = poster_url
        print(f"Updated: {db_title} -> {poster_url}")
    else:
        print(f"WARNING: '{db_title}' not found in your database, skipped")

db.commit()
db.close()
print("\nDone. Refresh your frontend to see the corrected posters.")