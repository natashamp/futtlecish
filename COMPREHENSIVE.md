# LockArk — Comprehensive Project Overview

## What Is LockArk?

LockArk is a free web application that protects digital artwork through invisible watermarking and blockchain proof of ownership. It gives artists a way to embed invisible identity signatures into their images, verify ownership of found images, and showcase their work through a fully customizable portfolio page.

The system has two main surfaces: a **dashboard app** for managing artwork protection, and a **portfolio page** that serves as the artist's public-facing creative workspace.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      Browser                            │
│                                                         │
│   index.html (Dashboard SPA)    /portfolio/<username>   │
│   ┌───────────────────────┐     ┌─────────────────────┐ │
│   │ Auth / Encode / Decode│     │ Portfolio Canvas SPA │ │
│   │ Artwork Table         │     │ (View + Edit modes)  │ │
│   └──────────┬────────────┘     └──────────┬──────────┘ │
│              │                              │            │
└──────────────┼──────────────────────────────┼────────────┘
               │         REST API             │
               ▼                              ▼
┌─────────────────────────────────────────────────────────┐
│                    app.py (Flask)                        │
│                                                         │
│  /api/register     /api/login      /api/logout          │
│  /api/me           /api/encode     /api/decode           │
│  /api/my-artworks  /api/portfolio  /api/portfolio/upload │
│  /portfolio/<user> /api/health     /  (serves index.html)│
│                                                         │
│  ┌────────────────┐  ┌─────────────┐  ┌──────────────┐ │
│  │  Watermark     │  │  Blockchain  │  │  Image       │ │
│  │  Engine        │  │  Timestamp   │  │  Processing  │ │
│  │  (DWT/DCT/SVD) │  │  Simulator   │  │  (PIL/CV2)   │ │
│  └────────────────┘  └─────────────┘  └──────────────┘ │
│                                                         │
│                    SQLite (lockark.db)                   │
│                    ┌───────────────┐                     │
│                    │ User          │                     │
│                    │ Artwork       │                     │
│                    │ Portfolio     │                     │
│                    └───────────────┘                     │
└─────────────────────────────────────────────────────────┘
```

### Tech Stack

| Layer        | Technology                                                       |
| ------------ | ---------------------------------------------------------------- |
| Backend      | Python 3.10, Flask 2.3, Flask-SQLAlchemy, Flask-CORS             |
| Database     | SQLite (`lockark.db`) — zero-config, file-based                  |
| Watermarking | `invisible-watermark` library (DWT/DCT/SVD method)              |
| Image        | Pillow (PIL), OpenCV (`cv2`), NumPy                              |
| Auth         | Flask sessions with Werkzeug password hashing                    |
| Frontend     | Vanilla HTML/CSS/JS (no frameworks), served as static + Jinja2   |

### File Structure

```
LockArk/
├── app.py                 # Flask backend — all routes, models, watermark engine, portfolio template
├── index.html             # Main dashboard SPA (auth, encode, decode, artwork table)
├── lockark.db             # SQLite database (auto-created)
├── requirements.txt       # Python dependencies
├── setup_database.sh      # Legacy PostgreSQL setup script (app now uses SQLite)
├── .env                   # Environment variables (SECRET_KEY)
├── images/                # Uploaded portfolio images (server-side storage)
└── venv/                  # Python virtual environment
```

---

## Database Models

### User

| Column          | Type         | Notes                              |
| --------------- | ------------ | ---------------------------------- |
| `id`            | Integer (PK) | Auto-increment                     |
| `username`      | String(80)   | Unique, used in portfolio URL      |
| `email`         | String(120)  | Unique                             |
| `password_hash` | String(256)  | Werkzeug bcrypt hash               |
| `display_name`  | String(100)  | Shown in UI and portfolio header   |
| `created_at`    | DateTime     | UTC timestamp                      |

Relationships: `artworks` (one-to-many), `portfolio` (one-to-one).

### Artwork

| Column              | Type         | Notes                                       |
| ------------------- | ------------ | ------------------------------------------- |
| `id`                | Integer (PK) |                                              |
| `uuid`              | String(36)   | Unique, embedded as watermark payload        |
| `user_id`           | Integer (FK) | References `User.id`                         |
| `original_filename` | String(255)  | Original uploaded filename                   |
| `image_hash`        | String(64)   | SHA-256 of original image bytes              |
| `blockchain_tx_id`  | String(64)   | Simulated OpenTimestamps transaction ID      |
| `created_at`        | DateTime     |                                              |
| `width`             | Integer      | Original image width in pixels               |
| `height`            | Integer      | Original image height in pixels              |

### Portfolio

| Column          | Type         | Notes                                               |
| --------------- | ------------ | --------------------------------------------------- |
| `id`            | Integer (PK) |                                                      |
| `user_id`       | Integer (FK) | Unique — one portfolio per user                      |
| `canvas_data`   | Text         | Base64 data URL of the paint/vibe layer (PNG)        |
| `objects_json`  | Text         | JSON array of positioned objects (artworks, text, links) |
| `canvas_width`  | Integer      | World width in pixels (default 6000)                 |
| `canvas_height` | Integer      | World height in pixels (default 4000)                |
| `updated_at`    | DateTime     |                                                      |

---

## API Routes

### Authentication

| Method | Route            | Auth     | Description                                      |
| ------ | ---------------- | -------- | ------------------------------------------------ |
| POST   | `/api/register`  | Public   | Create account (username, email, password, display_name) |
| POST   | `/api/login`     | Public   | Log in with username/email + password             |
| POST   | `/api/logout`    | Public   | Clear session                                    |
| GET    | `/api/me`        | Required | Return current user profile                      |

### Artwork Protection

| Method | Route              | Auth     | Description                                         |
| ------ | ------------------ | -------- | --------------------------------------------------- |
| POST   | `/api/encode`      | Required | Upload image, embed watermark, return protected JPEG |
| POST   | `/api/decode`      | Public   | Upload suspect image, extract watermark, find owner  |
| GET    | `/api/my-artworks` | Required | List all artworks owned by current user              |

### Portfolio

| Method | Route                        | Auth     | Description                         |
| ------ | ---------------------------- | -------- | ----------------------------------- |
| GET    | `/api/portfolio`             | Required | Get current user's portfolio data   |
| POST   | `/api/portfolio`             | Required | Save portfolio (canvas + objects)   |
| POST   | `/api/portfolio/upload-image`| Required | Upload an image, returns data URL   |

### Pages

| Method | Route                  | Description                                         |
| ------ | ---------------------- | --------------------------------------------------- |
| GET    | `/`                    | Serves `index.html` (dashboard SPA)                 |
| GET    | `/portfolio/<username>`| Serves the portfolio page (view or edit for owner)   |
| GET    | `/api/health`          | Health check endpoint                               |

---

## Watermarking Engine

The core protection mechanism uses a **DWT/DCT/SVD** (Discrete Wavelet Transform / Discrete Cosine Transform / Singular Value Decomposition) watermarking pipeline from the `invisible-watermark` library.

### Encode Flow

```
Original Image
      │
      ▼
┌─────────────────┐
│ Ensure min 256px │  ← Upscale if too small for frequency-domain embedding
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Generate UUID    │  ← 36-char UUID, truncated to 32 chars (256 bits)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ PIL → OpenCV     │  ← RGB to BGR conversion
│ Embed watermark  │  ← DWT/DCT/SVD in frequency domain
│ OpenCV → PIL     │  ← BGR back to RGB
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ SHA-256 hash     │  ← Hash original image bytes
│ Blockchain TX    │  ← Simulated OpenTimestamps (SHA-256 of hash + time)
│ Save to DB       │  ← Artwork record with UUID, hash, TX ID
└────────┬────────┘
         │
         ▼
Protected JPEG (base64) + metadata returned to client
```

### Decode Flow

```
Suspect Image
      │
      ▼
┌──────────────────┐
│ Extract raw bytes │  ← DWT/DCT/SVD decode (256 bits)
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Compare against   │  ← Bit-by-bit comparison against ALL artworks in DB
│ every artwork     │     using bit_accuracy() function
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Confidence calc   │  ← Raw: 50% = random chance
│                   │     Display: (raw - 50) * 2, clamped to [0, 100]
│                   │     >20% display = possible match
│                   │     >99% display = exact match (verified)
└────────┬─────────┘
         │
         ▼
Owner info + confidence returned to client
```

---

## Visual UI — Screen by Screen

### Screen 1: Landing Page (Logged Out)

```
┌──────────────────────────────────────────────────────────────┐
│  ┌─ site-banner ──────────────────────────────────────────┐  │
│  │  lockark                                               │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│                         lockark                              │
│          free invisible watermarking & blockchain            │
│                    proof for artists                         │
│  ────────────────────────────────────────────────────────    │
│                                                              │
│   ┌─ auth-tabs ────────────────────┐                        │
│   │ [log in]  [create account]     │                        │
│   ├────────────────────────────────┤                        │
│   │  username / email: [________]  │                        │
│   │         password:  [________]  │                        │
│   │                                │                        │
│   │              [Log In]          │                        │
│   └────────────────────────────────┘                        │
│                                                              │
│  ┌─ what is lockark? ─────────────────────────────────────┐ │
│  │  - invisible DWT/DCT/SVD watermarking                  │ │
│  │  - blockchain proof of ownership                       │ │
│  │  - SHA-256 image hashing                               │ │
│  │  - ownership verification / decode                     │ │
│  │  - artwork tracking dashboard                          │ │
│  │  - 100% free for artists                               │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ──── lockark - free invisible watermarking for artists ──── │
└──────────────────────────────────────────────────────────────┘
```

**Visual style:** Minimalist, craigslist-inspired. White background, grey section headers (`#eee` with `1px solid #ccc` borders), purple accent color (`#800080`) for the title, blue hyperlinks (`#00e`), monospace data cells. No images, no icons — pure functional typography.

---

### Screen 2: Dashboard (Logged In — Unified Page)

```
┌──────────────────────────────────────────────────────────────┐
│  ┌─ site-banner ──────────────────────────────────────────┐  │
│  │  lockark        Jane Doe [ my artworks | portfolio |  │  │
│  │                                           log out ]    │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│                         lockark                              │
│          free invisible watermarking & blockchain            │
│                    proof for artists                         │
│  ────────────────────────────────────────────────────────    │
│                                                              │
│  ┌─ lockark menu ─────────────────────────────────────────┐ │
│  │  - my artworks                                         │ │
│  │  - view my portfolio                                   │ │
│  └────────────────────────────────────────────────────────┘ │
│  ────────────────────────────────────────────────────────    │
│                                                              │
│  ┌─ my protected artworks ────────────────────────────────┐ │
│  │ # │ filename     │ UUID          │ hash    │ TX  │ date│ │
│  │───┼──────────────┼───────────────┼─────────┼─────┼─────│ │
│  │ 1 │ painting.jpg │ a1b2c3d4-...  │ 8f2a... │ btc │ 3/1│ │
│  │ 2 │ sketch.png   │ e5f6g7h8-...  │ 3c7d... │ btc │ 3/5│ │
│  └────────────────────────────────────────────────────────┘ │
│  ────────────────────────────────────────────────────────    │
│                                                              │
│  ┌─ protect new artwork ──────────────────────────────────┐ │
│  │  Upload your original artwork to embed an invisible    │ │
│  │  DWT/DCT/SVD watermark and create blockchain proof...  │ │
│  │                                                        │ │
│  │  ┌──────────────────────────────────────────────────┐  │ │
│  │  │          click to upload your artwork             │  │ │
│  │  │        or drag and drop an image here             │  │ │
│  │  └──────────────────────────────────────────────────┘  │ │
│  │                                                        │ │
│  │  (after upload:)                                       │ │
│  │  ┌─ Original ──────┐  ┌─ Protected ──────┐            │ │
│  │  │                  │  │                  │            │ │
│  │  │    [image]       │  │    [image]       │            │ │
│  │  │                  │  │                  │            │ │
│  │  └──────────────────┘  └──────────────────┘            │ │
│  │                                                        │ │
│  │  [Protect My Artwork]  [Download Protected Image]      │ │
│  │                                                        │ │
│  │  ┌─ status-success ─────────────────────────────────┐  │ │
│  │  │  artwork protected!                              │  │ │
│  │  │  UUID: a1b2c3d4-e5f6-...                         │  │ │
│  │  │  blockchain TX: btc_tx_8f2a3c...                  │  │ │
│  │  │  SHA-256: 8f2a3c7d...                             │  │ │
│  │  └──────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────┘ │
│  ────────────────────────────────────────────────────────    │
│                                                              │
│  ┌─ verify / decode image ────────────────────────────────┐ │
│  │  Found an uncredited image? Upload it to extract the   │ │
│  │  hidden watermark and identify the original artist.    │ │
│  │                                                        │ │
│  │  ┌──────────────────────────────────────────────────┐  │ │
│  │  │        click to check image ownership             │  │ │
│  │  │      upload suspect image for verification        │  │ │
│  │  └──────────────────────────────────────────────────┘  │ │
│  │                                                        │ │
│  │  [Check Ownership]                                     │ │
│  │                                                        │ │
│  │  ┌─ status (success/warning/error) ─────────────────┐  │ │
│  │  │  ownership verified!                             │  │ │
│  │  │  artist: Jane Doe Art (@janedoe)                  │  │ │
│  │  │  confidence: 99.8%                                │  │ │
│  │  │  UUID: a1b2c3d4-e5f6-...                          │  │ │
│  │  └──────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ──── lockark - free invisible watermarking for artists ──── │
└──────────────────────────────────────────────────────────────┘
```

All three functions (view artworks, protect, verify) live on **one unified page** — no navigation between separate sections. The user scrolls down through them.

**Key UI elements:**
- **Artwork table:** Row-hover highlights yellow (`#ffffcc`), monospace UUIDs in blue, truncated hashes with ellipsis and title tooltip
- **Upload areas:** Click or drag-and-drop, hover turns yellow, border darkens during dragover
- **Processing spinner:** Purple-topped (`#800080`) spinning border animation
- **Status messages:** Green for success, yellow for partial match, red for errors — all with `pre-line` whitespace for multi-line data

---

### Screen 3: Portfolio Page — View Mode (`/portfolio/<username>`)

```
┌──────────────────────────────────────────────────────────────────────┐
│ ┌─ topBar (fixed, translucent dark) ─────────────────────────────┐  │
│ │  Jane Doe Art   artist portfolio                 lockark home  │  │
│ └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌─ viewport (full screen, pannable) ─────────────────────────────┐ │
│  │                                                                 │ │
│  │   ┌─ world (6000 x 4000, CSS transformed) ──────────────────┐  │ │
│  │   │                                                          │  │ │
│  │   │  ┌─ substrate ────────────────────────────────────────┐  │  │ │
│  │   │  │  ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·  │  │  │ │
│  │   │  │  ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·  │  │  │ │
│  │   │  │          (blueprint graph paper grid)               │  │  │ │
│  │   │  │  20px minor grid lines (very subtle)               │  │  │ │
│  │   │  │  100px major grid lines (slightly visible)         │  │  │ │
│  │   │  └────────────────────────────────────────────────────┘  │  │ │
│  │   │                                                          │  │ │
│  │   │  ┌─ vibeCanvas (paint layer, behind objects) ─────────┐  │  │ │
│  │   │  │  (watercolor-like paint strokes)                   │  │  │ │
│  │   │  │  ~~~  yellow + blue = green blending  ~~~          │  │  │ │
│  │   │  └────────────────────────────────────────────────────┘  │  │ │
│  │   │                                                          │  │ │
│  │   │  ┌─ objectLayer ─────────────────────────────────────┐   │  │ │
│  │   │  │                                                    │   │  │ │
│  │   │  │   ┌─ obj-artwork ──────┐    ┌─ obj-text ────────┐ │   │  │ │
│  │   │  │   │ ┌──────────────┐   │    │                    │ │   │  │ │
│  │   │  │   │ │              │   │    │  "My Latest       │ │   │  │ │
│  │   │  │   │ │   artwork    │   │    │   Collection"     │ │   │  │ │
│  │   │  │   │ │   image      │   │    │                    │ │   │  │ │
│  │   │  │   │ │              │   │    └────────────────────┘ │   │  │ │
│  │   │  │   │ │    ~~~~~ ◄── scan ripple on hover           │   │  │ │
│  │   │  │   │ │              │   │                           │   │  │ │
│  │   │  │   │ └──────────────┘   │    ┌─ obj-social ──────┐ │   │  │ │
│  │   │  │   │              [🛡]   │    │ Instagram: @jane  │ │   │  │ │
│  │   │  │   └────────────────────┘    └────────────────────┘ │   │  │ │
│  │   │  │                                                    │   │  │ │
│  │   │  └────────────────────────────────────────────────────┘   │  │ │
│  │   │                                                          │  │ │
│  │   └──────────────────────────────────────────────────────────┘  │ │
│  │                                                                 │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│                                          ┌────────────────────┐      │
│                                          │  edit portfolio     │ ◄── │
│                                          └────────────────────┘      │
│                                     (bottom-right, owner only)       │
└──────────────────────────────────────────────────────────────────────┘
```

**Visual style:** Dark theme (`#1a1a1a` background). The world itself has a warm off-white substrate (`#f5f5f0`) with a subtle dual-density grid pattern. The top bar uses translucent dark glass (`rgba(20,20,20,0.92)` with `backdrop-filter: blur(6px)`). Purple accent (`#c084fc`) for the artist name.

**Interactions in view mode:**
- **Pan:** Click and drag on empty space, or scroll with mouse wheel
- **Scan ripple:** Hovering over any artwork image triggers a diagonal light streak animation (`scanRipple` keyframe) — a white gradient sweeps left to right over 1.2 seconds, indicating watermark verification
- **Shield badge:** Small purple shield icon (SVG) in the bottom-right corner of each artwork, pulses to full opacity on hover
- **Social links:** Clickable, open in new tab

---

### Screen 4: Portfolio Page — Edit Mode

```
┌──────────────────────────────────────────────────────────────────────┐
│ ┌─ topBar ───────────────────────────────────────────────────────┐  │
│ │  Jane Doe Art   artist portfolio                 lockark home  │  │
│ └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌─ viewport (cursor: crosshair when brush tool) ─────────────────┐ │
│  │                                                                 │ │
│  │  Selected artwork object:                                       │ │
│  │   ┌─ obj-controls ─────┐                                       │ │
│  │   │  [↑] [↓] [×]       │  ◄── z-index up, z-index down, delete│ │
│  │   ├─────────────────────┤                                       │ │
│  │   │ ┌───────────────┐   │                                       │ │
│  │   │ │   artwork      │   │  ◄── purple glow border when selected│ │
│  │   │ │   image        │   │      (box-shadow: 0 0 0 2px #a855f7) │ │
│  │   │ └───────────────┘   │                                       │ │
│  │   │              [🛡]   │                                       │ │
│  │   └─────────────────────┘                                       │ │
│  │                                                                 │ │
│  │  Paint strokes on vibe canvas (crosshair cursor)                │ │
│  │  ┌────────────────────────────────────┐                         │ │
│  │  │  ~~~ red strokes ~~~               │                         │ │
│  │  │  ~~~ blue over yellow = GREEN ~~~  │  ◄── multiply blending  │ │
│  │  │  ~~~ repeated red = DARKER RED ~~~ │  ◄── pigment buildup    │ │
│  │  └────────────────────────────────────┘                         │ │
│  │                                                                 │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  ┌─ minimap (bottom-left, edit mode only) ┐                         │
│  │  ┌──┐                                  │                         │
│  │  │██│ ◄── viewport position indicator  │                         │
│  │  └──┘                                  │                         │
│  └────────────────────────────────────────┘                         │
│                                                                      │
│  ┌─ HUD (fixed, bottom-center, glassmorphic) ────────────────────┐  │
│  │                                                                │  │
│  │  tool           pigment        size    opacity   add    save   │  │
│  │ [select]       (●)(●)(●)(○)(●) [====]  [====]  [art]  [save]  │  │
│  │ [brush ]        R  B  Y  W  K  12      8%      [txt]  [done]  │  │
│  │ [eraser]                                       [link]          │  │
│  │                                                                │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│                                          ┌────────────────────┐      │
│                                          │  viewing mode       │     │
│                                          └────────────────────┘      │
└──────────────────────────────────────────────────────────────────────┘
```

**HUD breakdown:**

| Group   | Controls                                               |
| ------- | ------------------------------------------------------ |
| Tool    | `select` (move/resize objects), `brush` (paint), `eraser` (remove paint) |
| Pigment | 5 color swatches — Red `#dc2626`, Blue `#2563eb`, Yellow `#eab308`, White `#f5f5f5`, Black `#1a1a1a` |
| Size    | Range slider 2–60px, displays current value            |
| Opacity | Range slider 1–40%, controls pigment density per stroke |
| Add     | `artwork` (from protected artworks or file upload), `text`, `link` |
| Save    | `save` (persists to database), `done` (exits edit mode) |

**HUD visual:** Dark translucent panel (`rgba(20,20,20,0.94)`) with `backdrop-filter: blur(8px)`, rounded corners (`10px`), 1px `#444` border. Color swatches are circular (`border-radius: 50%`) with scale-up on hover. Active tool/color gets a white border and subtle glow.

---

### Screen 5: Add Content Panel (Modal)

```
┌─ overlay (semi-transparent black) ──────────────────────┐
│                                                          │
│        ┌─ addPanel (dark card, centered) ─────────┐     │
│        │                                           │     │
│        │  add artwork                              │     │
│        │                                           │     │
│        │  your protected artworks:                 │     │
│        │  ┌─────────────────────────────────────┐  │     │
│        │  │ [painting.jpg] [sketch.png] [...]   │  │     │
│        │  └─────────────────────────────────────┘  │     │
│        │                                           │     │
│        │  or upload a new image:                   │     │
│        │  [Choose File]                            │     │
│        │                                           │     │
│        │                  [cancel]  [add]           │     │
│        └───────────────────────────────────────────┘     │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

Three modes: **artwork** (pick from protected artworks or upload), **text** (content + font size + color picker), **social link** (platform dropdown + URL input).

---

## Layer Architecture (Portfolio Canvas)

The portfolio uses a three-layer compositing system rendered in a 6000x4000 pixel world:

```
  Z-Order (top to bottom)
  ═══════════════════════

  ┌───────────────────────────────────┐
  │        Object Layer               │  ◄── z-index: per-object (1+)
  │   Draggable containers:           │      pointer-events: auto
  │   - Artwork images + shield       │
  │   - Text blocks (editable)        │
  │   - Social link badges            │
  │   Controls appear on selection    │
  ├───────────────────────────────────┤
  │        Vibe Layer (Canvas)        │  ◄── <canvas> element
  │   Paint strokes with:             │      6000x4000 px
  │   - multiply blend (subtractive)  │      pointer-events: only in
  │   - source-over (buildup)         │      brush/eraser tool mode
  │   - destination-out (eraser)      │
  ├───────────────────────────────────┤
  │        Substrate                  │  ◄── CSS background-image
  │   Off-white (#f5f5f0) with:       │      (repeating-linear-gradient)
  │   - 20px fine grid (8% opacity)   │      Always visible
  │   - 100px major grid (18% opacity)│
  └───────────────────────────────────┘
```

### Paint System — Subtractive Color Mixing

Each brush stroke is rendered as a series of circles along the mouse path. Two compositing passes per stroke point:

1. **`globalCompositeOperation: 'multiply'`** — Simulates subtractive pigment mixing. When colors overlap, their RGB values multiply (darker result). This makes yellow over blue produce green, red over yellow produce orange.

2. **`globalCompositeOperation: 'source-over'`** at 60% of brush opacity — Ensures paint shows up on blank (white) areas where multiply would have no visible effect.

**Pigment buildup:** Because opacity is low (1–40%), repeated strokes in the same area gradually darken and saturate, simulating real ink/paint accumulation.

**Eraser:** Uses `destination-out` compositing to remove paint from the canvas.

The five colors are specifically tuned for pleasing subtractive results:

| Name   | RGB          | Mixing behavior                                         |
| ------ | ------------ | ------------------------------------------------------- |
| Red    | (220, 38, 38)| + Yellow = warm orange, + Blue = dark purple             |
| Blue   | (50, 130, 255)| Cyan-leaning so + Yellow = green (not black)            |
| Yellow | (255, 220, 30)| Warm yellow, + Blue = green, + Red = orange             |
| White  | (245, 245, 245)| Lightens with multiply (near-identity)                 |
| Black  | (26, 26, 26) | Darkens everything with multiply                        |

---

## Interaction Reference

### Navigation & Panning

| Action                    | Behavior                                              |
| ------------------------- | ----------------------------------------------------- |
| Scroll wheel              | Pan the viewport (deltaX/deltaY applied to offset)    |
| Left-click drag on space  | Pan the viewport (grab cursor)                        |
| Middle-click drag          | Always pans, regardless of mode                       |

### Object Manipulation (Edit Mode, Select Tool)

| Action                          | Behavior                                        |
| ------------------------------- | ----------------------------------------------- |
| Click object                    | Select it (purple glow border)                  |
| Drag object                     | Move to new (x, y) position                     |
| Click empty space               | Deselect all                                    |
| Click [up arrow] on selected    | Increase z-index (bring forward)                |
| Click [down arrow] on selected  | Decrease z-index (send backward)                |
| Click [x] on selected           | Delete object                                   |
| Double-click text object        | Enter inline text editing (contentEditable)     |
| Delete/Backspace key            | Delete selected object                          |

### Drawing (Edit Mode, Brush Tool)

| Action                      | Behavior                                          |
| --------------------------- | ------------------------------------------------- |
| Left-click drag             | Paint with current color, size, opacity           |
| Select eraser tool + drag   | Remove paint (destination-out compositing)        |
| Repeated strokes same area  | Pigment builds up (darkens/saturates)             |
| Different colors overlap    | Subtractive mix (multiply blend)                  |

### Security — Scan Ripple

| Action                  | Behavior                                              |
| ----------------------- | ----------------------------------------------------- |
| Hover over artwork image| White diagonal light gradient sweeps left→right (1.2s) |
|                         | Shield badge fades to full opacity                     |

This is a CSS-only effect using a `::after` pseudo-element with `@keyframes scanRipple`.

---

## Session & Security

- **Auth:** Flask server-side sessions. Password hashing via Werkzeug (`generate_password_hash` / `check_password_hash`).
- **Session cookie:** Standard Flask session cookie, credentials included in all fetch calls (`credentials: 'include'`).
- **`@login_required` decorator:** Returns 401 JSON if `user_id` not in session.
- **Portfolio ownership:** `view_portfolio` route checks `session['user_id']` against the portfolio owner's `user_id` to determine if the "edit portfolio" button is shown and if edit-mode API calls (save) will succeed.
- **Upload limit:** 16MB max (`MAX_CONTENT_LENGTH`).
- **Portfolio images:** Thumbnailed to max 400px dimension server-side before base64 encoding.

---

## Running the Project

```bash
# 1. Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Set environment variables (optional — defaults exist)
echo "SECRET_KEY=your-secret-key" > .env

# 4. Run the server
python3 app.py
# → Starts Flask on http://localhost:5001
# → SQLite database auto-created on first run
```

The app is fully self-contained — no external database server, no build step, no node_modules. One Python file (`app.py`) serves both the API and all HTML pages.
