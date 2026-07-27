"""
Consolidated backend for the anime recommender.
Everything you've built across all lessons, merged into one running server:
  - Auth (register / login / logout via httpOnly cookies)
  - Shows (browse, backed by the database)
  - Ratings (rate a show, feeds the recommendation engine)
  - Hybrid recommendations (content-based + collaborative filtering)
  - Video streaming (range-request support for seeking)

FIX APPLIED: every endpoint now uses Depends(get_db) instead of manually
calling Session(). Previously, every request opened a database connection
and never closed it -- after ~15 requests, SQLAlchemy's connection pool
(size 5 + overflow 10) was exhausted, and every further request failed
with a 500 error. This included /me, which made the frontend think you'd
been logged out. get_db() below is a generator dependency: FastAPI calls
it, hands your endpoint the yielded session, and -- critically -- always
runs the code after `yield` (closing the session) once the request is
done, even if the endpoint raised an exception.
"""
import difflib
import os
import re
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import requests
from fastapi import FastAPI, HTTPException, Depends, Response, Cookie, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from passlib.context import CryptContext
from jose import jwt
from sqlalchemy import Column, Integer, String, Float, ForeignKey, create_engine
from sqlalchemy.orm import declarative_base, sessionmaker, relationship, Session as SASession

# ---------- Paths & setup ----------

ROOT_DIR = Path(__file__).resolve().parent
DB_PATH = ROOT_DIR / "data" / "app.db"
MEDIA_DIR = ROOT_DIR / "media"
DB_PATH.parent.mkdir(parents=True, exist_ok=True)
MEDIA_DIR.mkdir(parents=True, exist_ok=True)

Base = declarative_base()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
SECRET_KEY = "some-long-random-string-only-your-server-knows"  # move to an env var before deploying anywhere


# ---------- Models ----------

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    username = Column(String, unique=True)
    hashed_password = Column(String)
    ratings = relationship("Rating", back_populates="user")


class Show(Base):
    __tablename__ = "shows"
    id = Column(Integer, primary_key=True)
    title = Column(String)
    genres = Column(String)  # comma-separated, e.g. "Action,SciFi"
    rating = Column(Float)
    poster_url = Column(String)
    source_type = Column(String, default="anime")  # "anime" or "western_animation"
    synopsis = Column(String, nullable=True)
    total_episodes = Column(Integer, nullable=True)
    start_date = Column(String, nullable=True)   # "2026-01-15"
    end_date = Column(String, nullable=True)     # null if still airing
    status = Column(String, nullable=True)        # FINISHED, RELEASING, NOT_YET_RELEASED, CANCELLED, HIATUS
    trailer_youtube_id = Column(String, nullable=True)
    ratings = relationship("Rating", back_populates="show")
    episodes = relationship("Episode", back_populates="show")

    def genre_list(self):
        return [g.strip() for g in self.genres.split(",") if g.strip()]


class Episode(Base):
    __tablename__ = "episodes"
    id = Column(Integer, primary_key=True)
    show_id = Column(Integer, ForeignKey("shows.id"))
    episode_number = Column(Integer)
    title = Column(String, nullable=True)
    video_filename = Column(String, nullable=True)  # file under media/, if watchable
    show = relationship("Show", back_populates="episodes")


class Watchlist(Base):
    __tablename__ = "watchlist"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    show_id = Column(Integer, ForeignKey("shows.id"))
    added_at = Column(String)


class Comment(Base):
    __tablename__ = "comments"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    show_id = Column(Integer, ForeignKey("shows.id"))
    body = Column(String)
    created_at = Column(String)


class Rating(Base):
    __tablename__ = "ratings"
    id = Column(Integer, primary_key=True)
    score = Column(Float)
    user_id = Column(Integer, ForeignKey("users.id"))
    show_id = Column(Integer, ForeignKey("shows.id"))
    user = relationship("User", back_populates="ratings")
    show = relationship("Show", back_populates="ratings")


class WatchProgress(Base):
    __tablename__ = "watch_progress"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    episode_id = Column(Integer, ForeignKey("episodes.id"))
    position_seconds = Column(Float, default=0)
    duration_seconds = Column(Float, nullable=True)
    completed = Column(Integer, default=0)  # 0/1, sqlite has no real boolean
    last_watched_at = Column(String)  # ISO timestamp string, simplest for sqlite


engine = create_engine(f"sqlite:///{DB_PATH}")
Base.metadata.create_all(engine)
SessionLocal = sessionmaker(bind=engine)


def get_db():
    """
    Dependency that yields a database session and always closes it afterward.
    Use as: db: SASession = Depends(get_db)
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Seed a few shows with varied genres so similarity has something to work with
with SessionLocal() as _db:
    if _db.query(Show).count() == 0:
        shows_to_seed = [
            Show(title="Cowboy Bebop", genres="Action,SciFi,SpaceWestern", rating=8.9,
                 poster_url="https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx1.jpg",
                 synopsis="In 2071, bounty hunters aboard the spaceship Bebop chase down criminals across the solar system.",
                 total_episodes=26, start_date="1998-04-03", end_date="1999-04-24", status="FINISHED",
                 trailer_youtube_id="qig4KOK2R2g"),
            Show(title="Samurai Champloo", genres="Action,Historical,Comedy", rating=8.5,
                 poster_url="https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx205-jMBFCC7bPFmS.jpg",
                 synopsis="Two skilled swordsmen and a girl travel Edo-period Japan searching for a mysterious samurai.",
                 total_episodes=26, start_date="2004-05-20", end_date="2005-03-19", status="FINISHED"),
            Show(title="Attack on Titan", genres="Action,Drama,Fantasy,Mystery", rating=8.5,
                 poster_url="https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx16498-C6FPmWm59CyP.jpg",
                 synopsis="Humanity fights for survival against giant humanoid Titans behind massive walls.",
                 total_episodes=25, start_date="2013-04-07", end_date="2013-09-29", status="FINISHED"),
            Show(title="K-On!", genres="Comedy,SliceOfLife,Music", rating=7.8,
                 poster_url="https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx5680-Yq2gClsZOMdF.jpg",
                 synopsis="Four high school girls join the light music club and form a band together.",
                 total_episodes=13, start_date="2009-04-03", end_date="2009-06-26", status="FINISHED"),
            Show(title="One Punch Man", genres="Action,Comedy,SciFi,Supernatural", rating=8.3,
                 poster_url="https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx21087-DsK2NlNhrxWr.jpg",
                 synopsis="A hero who can defeat any opponent with a single punch struggles with the boredom of being unbeatable.",
                 total_episodes=12, start_date="2015-10-05", end_date="2015-12-21", status="FINISHED"),
            Show(title="Mob Psycho 100", genres="Action,Comedy,Supernatural,SliceOfLife", rating=8.4,
                 poster_url="https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx21507-XyaSSNemD1SI.jpg",
                 synopsis="A psychic middle schooler tries to live a normal life while keeping his immense powers in check.",
                 total_episodes=12, start_date="2016-07-11", end_date="2016-09-28", status="FINISHED"),
        ]
        _db.add_all(shows_to_seed)
        _db.flush()  # assigns IDs without committing yet, so episodes can reference show.id

        # give every show 3 placeholder episodes -- attach real video files with
        # mark_watchable.py once you have content you have the rights to serve
        for show in shows_to_seed:
            for ep_num in range(1, 4):
                _db.add(Episode(show_id=show.id, episode_number=ep_num, title=f"Episode {ep_num}"))

        _db.commit()

app = FastAPI(title="Anime Recommender")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- Auth ----------

class RegisterRequest(BaseModel):
    username: str
    password: str


class LoginRequest(BaseModel):
    username: str
    password: str


@app.post("/register")
def register(payload: RegisterRequest, db: SASession = Depends(get_db)):
    existing = db.query(User).filter(User.username == payload.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already taken")
    user = User(username=payload.username, hashed_password=pwd_context.hash(payload.password))
    db.add(user)
    db.commit()
    return {"message": "User created", "username": user.username}


@app.post("/login")
def login(payload: LoginRequest, response: Response, db: SASession = Depends(get_db)):
    user = db.query(User).filter(User.username == payload.username).first()
    if not user or not pwd_context.verify(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect username or password")
    token = jwt.encode({"sub": user.username, "user_id": user.id}, SECRET_KEY, algorithm="HS256")
    response.set_cookie(key="access_token", value=token, httponly=True, samesite="lax",
                         secure=False, max_age=60 * 60 * 24)
    return {"message": "Logged in", "username": user.username}


@app.post("/logout")
def logout(response: Response):
    response.delete_cookie("access_token")
    return {"message": "Logged out"}


def get_current_user(access_token: str | None = Cookie(default=None), db: SASession = Depends(get_db)):
    if access_token is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(access_token, SECRET_KEY, algorithms=["HS256"])
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    username = payload.get("sub")
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


@app.get("/me")
def read_me(current_user: User = Depends(get_current_user)):
    return {"id": current_user.id, "username": current_user.username}


# ---------- Search matching ----------
#
# Plain `title LIKE '%query%'` only matches when the query appears as one
# contiguous substring in the exact same word order. That's why "attack
# titan" used to fail against "Attack on Titan" (the missing "on" breaks the
# substring) and "k on" failed against "K-On!" (punctuation gets in the way).
# normalize() strips punctuation/casing/extra whitespace, and
# title_match_score() scores word-order-independent + typo-tolerant matches
# so search feels like a real search engine instead of Ctrl+F.

def normalize(text):
    text = (text or "").lower()
    text = re.sub(r"[^a-z0-9\s]", " ", text)  # drop punctuation like "K-On!" -> "k on"
    text = re.sub(r"\s+", " ", text).strip()
    return text


def title_match_score(query_norm, title_norm):
    if not query_norm or not title_norm:
        return 0.0

    if query_norm == title_norm:
        return 100.0

    score = 85.0 if query_norm in title_norm else 0.0

    # Word-order-independent match: "attack titan" should still find
    # "Attack on Titan" even though "on" sits in between.
    q_tokens = query_norm.split()
    t_tokens = title_norm.split()
    if len(query_norm) >= 2 and q_tokens:
        matched = sum(1 for qt in q_tokens if any(qt in tt or tt in qt for tt in t_tokens))
        score = max(score, (matched / len(q_tokens)) * 70)

    # Typo tolerance as a fallback/tie-breaker (e.g. "Cowbebop" vs "Cowboy Bebop")
    fuzzy = difflib.SequenceMatcher(None, query_norm, title_norm).ratio()
    score = max(score, fuzzy * 60)

    return score


MATCH_THRESHOLD = 30.0


# ---------- Live AniList fallback ----------
#
# Only used when a search on the search-results page comes up empty in our
# own database. Mirrors the ingestion logic in ingest_anime.py but scoped to
# a single on-demand search instead of a bulk import. Intentionally NOT
# wired into the navbar's live-suggestion dropdown (SearchBar.jsx) -- that
# fires on every keystroke, and hitting AniList's API on every partial
# keystroke ("c", "co", "cow"...) would be wasteful and slow. It's only
# triggered from the full results page, once the user has committed to a
# search.

ANILIST_SEARCH_QUERY = """
query ($search: String, $perPage: Int) {
  Page(page: 1, perPage: $perPage) {
    media(search: $search, type: ANIME) {
      title { romaji }
      genres
      averageScore
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


def anilist_fuzzy_date_to_string(fuzzy_date):
    if not fuzzy_date or not fuzzy_date.get("year"):
        return None
    y = fuzzy_date["year"]
    m = fuzzy_date.get("month") or 1
    d = fuzzy_date.get("day") or 1
    return f"{y:04d}-{m:02d}-{d:02d}"


def anilist_clean_description(raw):
    if not raw:
        return None
    return raw.replace("<br>", " ").replace("<br/>", " ").replace("<br />", " ").replace("\n", " ").strip()


def fetch_and_ingest_from_anilist(search_term, db, max_results=5):
    """Looks up `search_term` on AniList and inserts any new matches into the
    database (with placeholder episodes, same as the initial seed data), so
    they immediately show up as normal Show rows. Returns the list of Show
    objects (existing or newly created). Fails quietly (returns []) on any
    network problem so a flaky connection just means "no live results",
    not a 500 error for the user."""
    try:
        response = requests.post(
            "https://graphql.anilist.co",
            json={"query": ANILIST_SEARCH_QUERY, "variables": {"search": search_term, "perPage": max_results}},
            timeout=8,
        )
        response.raise_for_status()
        media_list = response.json().get("data", {}).get("Page", {}).get("media", []) or []
    except requests.exceptions.RequestException:
        return []

    found = []
    for anime in media_list:
        title = anime.get("title", {}).get("romaji")
        genres = anime.get("genres") or []
        score = anime.get("averageScore")
        if not title or not genres or score is None:
            continue  # same "not enough data to show properly" guard as ingest_anime.py

        existing = db.query(Show).filter(Show.title == title).first()
        if existing:
            found.append((existing, False))
            continue

        trailer = anime.get("trailer")
        show = Show(
            title=title,
            genres=",".join(genres),
            rating=score / 10,
            poster_url=anime["coverImage"]["large"],
            source_type="anime",
            synopsis=anilist_clean_description(anime.get("description")),
            total_episodes=anime.get("episodes"),
            start_date=anilist_fuzzy_date_to_string(anime.get("startDate")),
            end_date=anilist_fuzzy_date_to_string(anime.get("endDate")),
            status=anime.get("status"),
            trailer_youtube_id=(trailer["id"] if trailer and trailer.get("site") == "youtube" else None),
        )
        db.add(show)
        db.flush()  # assigns show.id without committing yet, so episodes can reference it
        for ep_num in range(1, 4):
            db.add(Episode(show_id=show.id, episode_number=ep_num, title=f"Episode {ep_num}"))
        found.append((show, True))

    if found:
        db.commit()
    return found


# ---------- Shows ----------

SORT_KEYS = {
    "rating_desc": (lambda s: s.rating or 0, True),
    "rating_asc": (lambda s: s.rating or 0, False),
    "title_asc": (lambda s: (s.title or "").lower(), False),
    "newest": (lambda s: s.start_date or "", True),
    "oldest": (lambda s: s.start_date or "", False),
}


@app.get("/shows")
def get_shows(
    search: str | None = None,
    source_type: str | None = None,
    genre: str | None = None,
    min_rating: float | None = None,
    status: str | None = None,
    sort: str | None = None,
    live_fetch: bool = False,
    db: SASession = Depends(get_db),
):
    query = db.query(Show)
    if source_type:
        query = query.filter(Show.source_type == source_type)
    if genre:
        query = query.filter(Show.genres.ilike(f"%{genre}%"))
    if status:
        query = query.filter(Show.status == status)
    if min_rating is not None:
        query = query.filter(Show.rating >= min_rating)
    shows = query.all()

    new_show_ids = set()
    no_other_filters = not source_type and not genre and not status and min_rating is None

    if search:
        query_norm = normalize(search)
        scored = [(title_match_score(query_norm, normalize(s.title)), s) for s in shows]
        scored = [(score, s) for score, s in scored if score >= MATCH_THRESHOLD]
        scored.sort(key=lambda pair: pair[0], reverse=True)
        shows = [s for _, s in scored]

        # Nothing in our own database even loosely matches -- try AniList,
        # but only if this came from the results page (live_fetch=True) and
        # there weren't other filters narrowing things down (a genre/rating
        # filter returning nothing isn't "this show doesn't exist anywhere",
        # it's "this show doesn't match your filters").
        if not shows and live_fetch and no_other_filters and len(query_norm) >= 2:
            fetched = fetch_and_ingest_from_anilist(search, db)
            shows = [s for s, _is_new in fetched]
            new_show_ids = {s.id for s, is_new in fetched if is_new}
    elif sort in SORT_KEYS:
        key_fn, reverse = SORT_KEYS[sort]
        shows = sorted(shows, key=key_fn, reverse=reverse)

    if search and sort in SORT_KEYS and sort != "relevance":
        # explicit sort chosen on the results page overrides relevance order
        key_fn, reverse = SORT_KEYS[sort]
        shows = sorted(shows, key=key_fn, reverse=reverse)

    result = []
    for s in shows:
        has_video = db.query(Episode).filter(Episode.show_id == s.id, Episode.video_filename.isnot(None)).first() is not None
        result.append({
            "id": s.id, "title": s.title, "genres": s.genre_list(),
            "avg_rating": s.rating, "poster_url": s.poster_url,
            "source_type": s.source_type, "status": s.status,
            "watchable": has_video,
            "is_new": s.id in new_show_ids,
        })
    return result


@app.get("/genres")
def get_genres(db: SASession = Depends(get_db)):
    shows = db.query(Show).all()
    return sorted({g for s in shows for g in s.genre_list()})


@app.get("/shows/{show_id}")
def get_show(show_id: int, db: SASession = Depends(get_db)):
    show = db.query(Show).filter(Show.id == show_id).first()
    if not show:
        raise HTTPException(status_code=404, detail="Show not found")
    episodes = db.query(Episode).filter(Episode.show_id == show_id).order_by(Episode.episode_number).all()
    return {
        "id": show.id, "title": show.title, "genres": show.genre_list(),
        "avg_rating": show.rating, "poster_url": show.poster_url,
        "source_type": show.source_type,
        "synopsis": show.synopsis, "total_episodes": show.total_episodes,
        "start_date": show.start_date, "end_date": show.end_date,
        "status": show.status, "trailer_youtube_id": show.trailer_youtube_id,
        "episodes": [
            {"id": e.id, "episode_number": e.episode_number, "title": e.title,
             "watchable": bool(e.video_filename)}
            for e in episodes
        ],
    }


@app.get("/episodes/{episode_id}")
def get_episode(episode_id: int, db: SASession = Depends(get_db)):
    episode = db.query(Episode).filter(Episode.id == episode_id).first()
    if not episode:
        raise HTTPException(status_code=404, detail="Episode not found")
    show = db.query(Show).filter(Show.id == episode.show_id).first()
    return {
        "id": episode.id, "episode_number": episode.episode_number, "title": episode.title,
        "watchable": bool(episode.video_filename),
        "show_id": show.id, "show_title": show.title,
    }


@app.get("/shows/{show_id}/similar")
def get_similar_shows(show_id: int, db: SASession = Depends(get_db)):
    target = db.query(Show).filter(Show.id == show_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Show not found")

    all_shows = db.query(Show).all()
    scores = content_based_scores({show_id}, all_shows)
    ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)[:8]
    show_by_id = {s.id: s for s in all_shows}

    return [
        {
            "id": sid, "title": show_by_id[sid].title, "genres": show_by_id[sid].genre_list(),
            "avg_rating": show_by_id[sid].rating, "poster_url": show_by_id[sid].poster_url,
        }
        for sid, score in ranked
    ]


class RatingIn(BaseModel):
    show_id: int
    score: float


@app.post("/ratings")
def rate_show(payload: RatingIn, current_user: User = Depends(get_current_user), db: SASession = Depends(get_db)):
    show = db.query(Show).filter(Show.id == payload.show_id).first()
    if not show:
        raise HTTPException(status_code=404, detail="Show not found")

    existing = db.query(Rating).filter(Rating.user_id == current_user.id, Rating.show_id == payload.show_id).first()
    if existing:
        existing.score = payload.score
    else:
        db.add(Rating(user_id=current_user.id, show_id=payload.show_id, score=payload.score))
    db.commit()
    return {"message": "Rating saved", "show_id": payload.show_id, "score": payload.score}


@app.delete("/ratings/{show_id}")
def delete_rating(show_id: int, current_user: User = Depends(get_current_user), db: SASession = Depends(get_db)):
    rating = db.query(Rating).filter(
        Rating.user_id == current_user.id, Rating.show_id == show_id
    ).first()
    if not rating:
        raise HTTPException(status_code=404, detail="No rating found for this show")
    db.delete(rating)
    db.commit()
    return {"message": "Rating removed", "show_id": show_id}


@app.get("/profile")
def get_profile(current_user: User = Depends(get_current_user), db: SASession = Depends(get_db)):
    ratings = db.query(Rating).filter(Rating.user_id == current_user.id).all()
    rated_shows = []
    for r in ratings:
        show = db.query(Show).filter(Show.id == r.show_id).first()
        if show:
            rated_shows.append({
                "show_id": show.id, "title": show.title,
                "poster_url": show.poster_url, "score": r.score,
            })

    completed_count = db.query(WatchProgress).filter(
        WatchProgress.user_id == current_user.id, WatchProgress.completed == 1
    ).count()
    in_progress_count = db.query(WatchProgress).filter(
        WatchProgress.user_id == current_user.id, WatchProgress.completed == 0
    ).count()

    return {
        "username": current_user.username,
        "rated_shows": rated_shows,
        "shows_completed": completed_count,
        "shows_in_progress": in_progress_count,
    }


# ---------- Watchlist ----------

@app.post("/watchlist/{show_id}")
def add_to_watchlist(show_id: int, current_user: User = Depends(get_current_user), db: SASession = Depends(get_db)):
    show = db.query(Show).filter(Show.id == show_id).first()
    if not show:
        raise HTTPException(status_code=404, detail="Show not found")

    existing = db.query(Watchlist).filter(
        Watchlist.user_id == current_user.id, Watchlist.show_id == show_id
    ).first()
    if existing:
        return {"message": "Already in watchlist"}

    db.add(Watchlist(user_id=current_user.id, show_id=show_id,
                      added_at=datetime.now(timezone.utc).isoformat()))
    db.commit()
    return {"message": "Added to watchlist"}


@app.delete("/watchlist/{show_id}")
def remove_from_watchlist(show_id: int, current_user: User = Depends(get_current_user), db: SASession = Depends(get_db)):
    item = db.query(Watchlist).filter(
        Watchlist.user_id == current_user.id, Watchlist.show_id == show_id
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Not in watchlist")
    db.delete(item)
    db.commit()
    return {"message": "Removed from watchlist"}


@app.get("/watchlist")
def get_watchlist(current_user: User = Depends(get_current_user), db: SASession = Depends(get_db)):
    items = (
        db.query(Watchlist)
        .filter(Watchlist.user_id == current_user.id)
        .order_by(Watchlist.added_at.desc())
        .all()
    )
    result = []
    for item in items:
        show = db.query(Show).filter(Show.id == item.show_id).first()
        if show:
            result.append({
                "show_id": show.id, "title": show.title,
                "poster_url": show.poster_url, "avg_rating": show.rating,
            })
    return result


# ---------- Comments ----------

class CommentIn(BaseModel):
    body: str


@app.post("/shows/{show_id}/comments")
def add_comment(show_id: int, payload: CommentIn, current_user: User = Depends(get_current_user), db: SASession = Depends(get_db)):
    show = db.query(Show).filter(Show.id == show_id).first()
    if not show:
        raise HTTPException(status_code=404, detail="Show not found")
    if not payload.body.strip():
        raise HTTPException(status_code=400, detail="Comment cannot be empty")

    comment = Comment(
        user_id=current_user.id, show_id=show_id, body=payload.body.strip(),
        created_at=datetime.now(timezone.utc).isoformat(),
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return {"id": comment.id, "username": current_user.username, "body": comment.body, "created_at": comment.created_at}


@app.get("/shows/{show_id}/comments")
def get_comments(show_id: int, db: SASession = Depends(get_db)):
    comments = (
        db.query(Comment)
        .filter(Comment.show_id == show_id)
        .order_by(Comment.created_at.desc())
        .all()
    )
    result = []
    for c in comments:
        user = db.query(User).filter(User.id == c.user_id).first()
        result.append({
            "id": c.id, "username": user.username if user else "unknown",
            "body": c.body, "created_at": c.created_at,
        })
    return result


# ---------- Watch progress / history ----------

class ProgressIn(BaseModel):
    episode_id: int
    position_seconds: float
    duration_seconds: float | None = None


@app.put("/progress")
def update_progress(payload: ProgressIn, current_user: User = Depends(get_current_user), db: SASession = Depends(get_db)):
    existing = db.query(WatchProgress).filter(
        WatchProgress.user_id == current_user.id,
        WatchProgress.episode_id == payload.episode_id,
    ).first()

    completed = 0
    if payload.duration_seconds and payload.position_seconds >= payload.duration_seconds * 0.95:
        completed = 1

    now_iso = datetime.now(timezone.utc).isoformat()

    if existing:
        existing.position_seconds = payload.position_seconds
        existing.duration_seconds = payload.duration_seconds
        existing.completed = completed
        existing.last_watched_at = now_iso
    else:
        db.add(WatchProgress(
            user_id=current_user.id, episode_id=payload.episode_id,
            position_seconds=payload.position_seconds, duration_seconds=payload.duration_seconds,
            completed=completed, last_watched_at=now_iso,
        ))
    db.commit()
    return {"message": "Progress saved"}


@app.get("/watch-history")
def get_watch_history(current_user: User = Depends(get_current_user), db: SASession = Depends(get_db)):
    rows = (
        db.query(WatchProgress)
        .filter(WatchProgress.user_id == current_user.id, WatchProgress.completed == 0)
        .order_by(WatchProgress.last_watched_at.desc())
        .limit(20)
        .all()
    )
    result = []
    for row in rows:
        episode = db.query(Episode).filter(Episode.id == row.episode_id).first()
        if not episode:
            continue
        show = db.query(Show).filter(Show.id == episode.show_id).first()
        if not show:
            continue
        pct = 0
        if row.duration_seconds:
            pct = min(100, round(100 * row.position_seconds / row.duration_seconds))
        result.append({
            "episode_id": episode.id, "show_id": show.id, "title": show.title,
            "episode_number": episode.episode_number, "poster_url": show.poster_url,
            "position_seconds": row.position_seconds, "duration_seconds": row.duration_seconds,
            "progress_pct": pct,
        })
    return result


# ---------- Recommendation engine ----------

def cosine_similarity(vec1, vec2):
    a, b = np.array(vec1), np.array(vec2)
    norm_a, norm_b = np.linalg.norm(a), np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0
    return float(np.dot(a, b) / (norm_a * norm_b))


def content_based_scores(target_show_ids, all_shows):
    all_genres = sorted(set(g for s in all_shows for g in s.genre_list()))

    def vectorize(show):
        genres = set(show.genre_list())
        return [1 if g in genres else 0 for g in all_genres]

    target_vectors = [vectorize(s) for s in all_shows if s.id in target_show_ids]
    if not target_vectors:
        return {}

    scores = {}
    for show in all_shows:
        if show.id in target_show_ids:
            continue
        show_vec = vectorize(show)
        sims = [cosine_similarity(show_vec, tv) for tv in target_vectors]
        scores[show.id] = sum(sims) / len(sims)
    return scores


def collaborative_scores(target_user_id, all_ratings, already_seen_ids):
    matrix = {}
    for r in all_ratings:
        matrix.setdefault(r.user_id, {})[r.show_id] = r.score

    if target_user_id not in matrix:
        return {}

    target_vec_map = matrix[target_user_id]
    similarities = {}
    for other_id, other_ratings in matrix.items():
        if other_id == target_user_id:
            continue
        shared = set(target_vec_map.keys()) & set(other_ratings.keys())
        if not shared:
            continue
        vec_a = [target_vec_map[s] for s in shared]
        vec_b = [other_ratings[s] for s in shared]
        similarities[other_id] = cosine_similarity(vec_a, vec_b)

    scores = {}
    for other_id, sim in similarities.items():
        if sim <= 0:
            continue
        for show_id, score in matrix[other_id].items():
            if show_id in already_seen_ids:
                continue
            scores[show_id] = scores.get(show_id, 0) + score * sim
    return scores


@app.get("/recommendations")
def get_recommendations(current_user: User = Depends(get_current_user), db: SASession = Depends(get_db)):
    all_shows = db.query(Show).all()
    all_ratings = db.query(Rating).all()

    user_ratings = [r for r in all_ratings if r.user_id == current_user.id]
    already_seen_ids = {r.show_id for r in user_ratings}

    if not user_ratings:
        top = sorted(all_shows, key=lambda s: s.rating or 0, reverse=True)[:5]
        return [
            {"id": s.id, "title": s.title, "genres": s.genre_list(),
             "poster_url": s.poster_url, "score": s.rating, "reason": "popular"}
            for s in top
        ]

    liked_show_ids = {r.show_id for r in user_ratings if r.score >= 7}
    content_scores = content_based_scores(liked_show_ids, all_shows) if liked_show_ids else {}
    collab_scores = collaborative_scores(current_user.id, all_ratings, already_seen_ids)

    combined = {}
    show_by_id = {s.id: s for s in all_shows}

    for show_id, score in content_scores.items():
        if show_id in already_seen_ids:
            continue
        combined[show_id] = combined.get(show_id, 0) + 0.5 * score

    if collab_scores:
        max_collab = max(collab_scores.values())
        for show_id, score in collab_scores.items():
            normalized = score / max_collab if max_collab > 0 else 0
            combined[show_id] = combined.get(show_id, 0) + 0.5 * normalized

    ranked = sorted(combined.items(), key=lambda x: x[1], reverse=True)[:5]
    return [
        {
            "id": show_id, "title": show_by_id[show_id].title,
            "genres": show_by_id[show_id].genre_list(),
            "poster_url": show_by_id[show_id].poster_url,
            "score": round(score, 3), "reason": "hybrid",
        }
        for show_id, score in ranked
    ]


# ---------- Video streaming ----------

CHUNK_SIZE = 1024 * 1024  # 1MB


@app.get("/stream/{episode_id}")
def stream_episode(episode_id: int, request: Request, db: SASession = Depends(get_db)):
    episode = db.query(Episode).filter(Episode.id == episode_id).first()
    if not episode or not episode.video_filename:
        raise HTTPException(status_code=404, detail="No video available for this episode")

    file_path = MEDIA_DIR / episode.video_filename
    if not file_path.is_file():
        raise HTTPException(status_code=404, detail="Video file missing on server")

    file_size = os.path.getsize(file_path)
    range_header = request.headers.get("range")

    if range_header is None:
        def iterfile():
            with open(file_path, "rb") as f:
                yield from f
        return StreamingResponse(iterfile(), media_type="video/mp4")

    match = re.match(r"bytes=(\d+)-(\d*)", range_header)
    start = int(match.group(1))
    end = int(match.group(2)) if match.group(2) else file_size - 1
    end = min(end, file_size - 1)

    def iter_range():
        with open(file_path, "rb") as f:
            f.seek(start)
            remaining = end - start + 1
            while remaining > 0:
                chunk = f.read(min(CHUNK_SIZE, remaining))
                if not chunk:
                    break
                remaining -= len(chunk)
                yield chunk

    headers = {
        "Content-Range": f"bytes {start}-{end}/{file_size}",
        "Accept-Ranges": "bytes",
        "Content-Length": str(end - start + 1),
    }
    return StreamingResponse(iter_range(), status_code=206, media_type="video/mp4", headers=headers)


@app.get("/health")
def health():
    return {"status": "ok"}