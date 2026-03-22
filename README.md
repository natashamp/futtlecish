# futtlecish

an artist portfolio platform with invisible image watermarking, a pixel-art character builder, and a real-time social world. craigslist aesthetic throughout — always lowercase.

## what it does

**for artists:**
- build a freeform portfolio by dragging and dropping images, text, and links onto a full-screen canvas
- protect artwork with invisible DWT-DCT-SVD watermarking that embeds your identity into the pixel data
- optionally stamp a visible futtlecish logo watermark (repositionable and resizable)
- create a 16x16 pixel art character with a 2-frame walk cycle
- design a landscape business card that appears on the public discovery feed

**for everyone:**
- browse the discovery feed to find artists
- verify image ownership by uploading a suspect image — no login required
- visit artist portfolios

**wanderland:**
- a shared real-time space where logged-in artists' pixel characters wander around
- click to move your character, click another character to say "hi", double-click to visit their portfolio
- characters idle-wander when you're not directing them

## pages

| route | access | description |
|-------|--------|-------------|
| `/` | public | discovery feed — grid of artist business cards, infinite scroll, public image verify |
| `/register` | public | create an account |
| `/login` | public | log in |
| `/portfolio/<username>` | public/private | artist's freeform portfolio canvas |
| `/portfolio/<username>/protect` | owner | encode images with invisible watermark, verify suspect images, download protected versions |
| `/portfolio/<username>/character` | owner | 16x16 pixel art character builder with 2-frame walk cycle |
| `/portfolio/<username>/card` | owner | business card editor for the discovery feed |
| `/wanderland` | logged in | real-time shared world with pixel characters |

## tech stack

| layer | technology |
|-------|------------|
| backend | Flask + Flask-SocketIO |
| database | PostgreSQL |
| frontend | vanilla HTML/CSS/JS (no frameworks) |
| watermarking | invisible-watermark library (DWT-DCT-SVD) |
| image processing | Pillow, OpenCV, NumPy |
| auth | Flask-Login + Werkzeug password hashing |
| real-time | SocketIO (eventlet) |

## database schema

7 tables:

- **users** — accounts with username, email, display name, dark mode preference
- **portfolios** — one per user, public/private toggle, updated_at for feed ordering
- **portfolio_objects** — images, text blocks, and links positioned on the canvas
- **artworks** — uploaded images with original/protected URLs and watermark hash
- **characters** — two 16x16 JSON grids (frame A and frame B) for walk cycle animation
- **business_cards** — one per user, background image URL, show_character flag
- **business_card_objects** — text and link elements on the card

## watermarking

the invisible watermark system uses DWT-DCT-SVD encoding:

1. **encode:** a SHA-256 hash of `user_id:artwork_id:timestamp` is embedded as 256 bits into the image's frequency domain
2. **verify:** the hash is extracted and compared bit-by-bit against all stored hashes in the database
3. **results:**
   - **strong match** (≥90%): full info — username, artwork title, date protected, link to portfolio
   - **degraded match** (60-89%): certainty percentage + username
   - **no match** (<60%): "no watermark found"

the visible watermark (futtlecish logo) is optional and applied after the invisible watermark so it doesn't interfere with extraction.

## setup

### prerequisites

- Python 3.10+
- PostgreSQL

### install

```bash
# clone
git clone git@github.com:natashamp/futtlecish.git
cd futtlecish

# create virtual environment
python3 -m venv venv
source venv/bin/activate

# install dependencies
pip install -r requirements.txt

# create database
createdb futtlecish_dev

# run
python run.py
```

the app runs at `http://localhost:5001`.

### environment variables (optional)

create a `.env` file:

```
SECRET_KEY=your-secret-key
DATABASE_URL=postgresql://localhost/futtlecish_dev
```

## design

the entire UI follows the craigslist aesthetic:

- white background, system sans-serif fonts
- grey section headers with 1px borders
- no box-shadow, no border-radius, no gradients
- all links and buttons in purple (#7b2d8e) — the only brand color
- dark mode available (toggle in settings dropdown)
- mobile responsive with touch controls (tap, drag, pinch-to-zoom)

## features in detail

### portfolio editor
- full-screen canvas that fills the browser viewport
- edit mode: drag objects to reposition, resize with handles, control z-index layering
- upload images, add text blocks and hyperlinks
- scan ripple hover effect on artwork images (purple gradient sweep)
- pinch-to-zoom and swipe-to-pan on mobile

### character builder
- 16x16 pixel grid with 8-color palette (black, white, red, blue, yellow, green, skin tone, brown)
- two frames side-by-side for walk cycle animation
- copy frame A → B for quick tweaking
- live animated preview
- transparent background so characters float in wanderland

### business card
- landscape rectangle (16:9 aspect ratio)
- one background image, up to 4 text blocks, up to 5 links
- optional character display
- drag-and-drop positioning constrained to card bounds

### wanderland
- 2000x1200 world rendered on HTML canvas
- real-time via Flask-SocketIO
- characters idle-wander to random nearby spots with pixel-stepped movement
- click-to-move overrides idle with faster, purposeful movement
- click another character → "hi" speech bubble (2 seconds)
- double-click another character → navigate to their portfolio
- camera follows your character
- 100 user capacity

## project structure

```
futtlecish/
├── run.py                          # entry point
├── config.py                       # app configuration
├── requirements.txt                # python dependencies
├── futtlecish-logo.png             # brand logo (used for visible watermark)
├── app/
│   ├── __init__.py                 # app factory, extensions, upload route
│   ├── models.py                   # SQLAlchemy models (7 tables)
│   ├── auth/                       # register, login, logout
│   ├── feed/                       # discovery feed, public verify, business card editor
│   ├── portfolio/                  # portfolio view, editor API, settings
│   ├── protect/                    # watermark encode/decode, artwork management
│   │   └── watermark.py            # DWT-DCT-SVD watermarking engine
│   ├── character/                  # pixel art character builder
│   ├── wanderland/                 # real-time world (SocketIO events)
│   ├── static/
│   │   ├── css/style.css           # all styles (craigslist aesthetic + dark mode + responsive)
│   │   └── js/
│   │       ├── portfolio-editor.js # drag-and-drop portfolio editor
│   │       ├── character-builder.js# pixel art drawing tool
│   │       ├── business-card-editor.js
│   │       └── wanderland.js       # real-time character world
│   └── templates/
│       └── base.html               # shared layout (nav, settings dropdown, dark mode)
```
