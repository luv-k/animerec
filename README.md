# Anime & Animation Recommender

A full-stack streaming/recommendation platform for anime and Western animated shows — auth, a hybrid recommendation engine (content-based + collaborative filtering), video playback with resume support, watchlists, comments, and a real content pipeline pulling from AniList and TMDB.

Built as a learning project: FastAPI + SQLAlchemy backend, React (Vite) frontend.

---

## Features

- **Auth** — register/login/logout via httpOnly cookies (JWT under the hood)
- **Catalog** — anime (via AniList) and Western animation (via TMDB), with genres, synopsis, episode count, air dates, status, and trailers
- **Recommendations** — hybrid engine blending:
  - *Content-based filtering*: cosine similarity over genre vectors
  - *Collaborative filtering*: finds users with similar rating patterns, surfaces what they liked
  - Falls back to "popular shows" for new users with no ratings yet (cold start)
- **Video playback** — HTTP range-request streaming (supports seeking/scrubbing), resume-from-last-position, multi-episode support per show
- **Ratings** — rate/re-rate/remove ratings on any show
- **Watchlist** — save shows to watch later
- **Comments** — per-show comment threads
- **Search** — live autocomplete dropdown + dedicated results page with "similar shows"
- **Watch History** — "Continue Watching" row showing in-progress episodes with a progress bar
- **Profile page** — stats (shows rated / completed / in progress) and full rating history

---

## Tech Stack

**Backend:** Python, FastAPI, SQLAlchemy, SQLite, passlib (bcrypt), python-jose (JWT), numpy (similarity math)
**Frontend:** React (Vite), React Router
**Data sources:** [AniList GraphQL API](https://anilist.co/graphql) (anime, no key required), [TMDB API](https://www.themoviedb.org/documentation/api) (Western animation, free API key required)

---

## Project Structure

```
backend/
  main.py              # the entire API: auth, shows, ratings, recommendations, streaming, watchlist, comments
  ingest_anime.py       # pulls anime from AniList into the database
  ingest_tmdb.py        # pulls Western animated shows from TMDB into the database
  mark_watchable.py     # attaches a local video file to an episode
  fix_posters.py        # one-off script to repair broken poster URLs
  requirements.txt
  data/                 # SQLite database lives here (gitignored)
  media/                # video files you have the rights to serve (gitignored)

frontend/
  src/
    App.jsx              # auth check + router
    HomePage.jsx          # hero carousel, search, genre pills, show grid, sidebar
    ShowDetail.jsx         # synopsis, metadata, rating widget, watchlist button, episode list, trailer, comments
    Player.jsx             # full watch page: video + episode/show info + episode list + recommendations
    ProfilePage.jsx
    WatchlistPage.jsx
    SearchResultsPage.jsx
    HeroBanner.jsx          # auto-rotating carousel
    ShowCard.jsx / ShowCardSkeleton.jsx
    GenrePills.jsx
    SearchBar.jsx            # autocomplete dropdown
    RecommendedRow.jsx
    WatchHistoryRow.jsx
    TopAiringSidebar.jsx
    CommentsSection.jsx
    AuthForm.jsx              # login + register, toggle between modes
```

---

## Getting Started

### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

Runs at `http://localhost:8000`. Interactive API docs at `http://localhost:8000/docs`.

On first run, it seeds 6 example shows automatically so the app isn't empty.

### Frontend

```bash
cd frontend
npm install
npm install react-router-dom
npm run dev
```

Runs at `http://localhost:5173`. **Use this exact address** (not `127.0.0.1:5173`) — cookies and CORS are configured around `localhost` and will behave inconsistently if you mix the two.

### Populating a real catalog

```bash
cd backend
python ingest_anime.py --count 300          # trending anime, last 2 years by default
python ingest_anime.py --all-time            # switch to all-time-popular anime instead

export TMDB_API_KEY=your_key_here            # get one free at themoviedb.org/settings/api
python ingest_tmdb.py --count 60             # Western animated shows
```

Both scripts are safe to rerun — they update existing rows (matched by title) rather than duplicating them.

### Attaching a video to an episode

You need a video file you actually have the rights to serve (your own footage, something licensed, a royalty-free clip for testing).

```bash
cd backend
cp /path/to/your/video.mp4 media/sample.mp4
python mark_watchable.py     # attaches media/sample.mp4 to Cowboy Bebop, episode 1
```

Edit `mark_watchable.py` directly to attach different files to different episodes.

---

## Environment Variables

| Variable | Required for | Notes |
|---|---|---|
| `TMDB_API_KEY` | `ingest_tmdb.py` | Free key from themoviedb.org |

`SECRET_KEY` (JWT signing) is currently hardcoded at the top of `main.py` — move it to an environment variable before this ever goes near a real deployment.

---

## Database Schema

| Table | Purpose |
|---|---|
| `users` | id, username, hashed_password |
| `shows` | title, genres, rating, poster, synopsis, episode count, air dates, status, trailer, source_type (anime / western_animation) |
| `episodes` | belongs to a show; episode_number, title, video_filename |
| `ratings` | user's 1-10 score for a show |
| `watch_progress` | per-user, per-episode resume position and completion flag |
| `watchlist` | user's saved-for-later shows |
| `comments` | per-show comment thread |

Whenever the schema changes during development, delete `backend/data/app.db` and restart the server to rebuild it — SQLAlchemy's `create_all()` only creates *new* tables, it doesn't migrate existing ones.

---

## API Reference

**Auth**
- `POST /register` — create account
- `POST /login` — sets httpOnly cookie
- `POST /logout` — clears cookie
- `GET /me` — current user (requires cookie)

**Shows**
- `GET /shows?search=&source_type=` — list/search/filter
- `GET /shows/{id}` — full detail including episodes
- `GET /shows/{id}/similar` — content-based similar shows
- `GET /episodes/{id}` — episode + parent show info

**Ratings & Watchlist**
- `POST /ratings` — rate a show
- `DELETE /ratings/{show_id}` — remove your rating
- `POST /watchlist/{show_id}` / `DELETE /watchlist/{show_id}` / `GET /watchlist`

**Comments**
- `POST /shows/{id}/comments` / `GET /shows/{id}/comments`

**Playback**
- `GET /stream/{episode_id}` — video streaming with HTTP range support
- `PUT /progress` — save resume position
- `GET /watch-history` — in-progress episodes

**Recommendations**
- `GET /recommendations` — hybrid, personalized (requires login)

**Profile**
- `GET /profile` — stats + rating history

---

## How the Recommendation Engine Works

1. **Cold start** (no ratings yet): returns the highest-rated shows overall
2. **Content-based**: for shows you rated ≥7, builds a genre vector per show and finds others with high cosine similarity
3. **Collaborative**: builds a user × show rating matrix, finds other users with similar taste (cosine similarity on shared ratings), weights their other high ratings by how similar they are to you
4. **Hybrid blend**: both scores normalized and combined 50/50

The more people rate shows, the better the collaborative half gets — this is genuinely "evolving," not static.

---

## Known Limitations

- No episode-level thumbnails/descriptions (AniList/TMDB don't reliably provide these per-episode)
- `SECRET_KEY` should be moved to an environment variable before any real deployment
- No admin UI for attaching videos to episodes — currently done via editing `mark_watchable.py` directly
- Search matches title only, not genre/synopsis text
- No password reset flow
