# Math2Visual Backend

A Flask-based backend service that transforms math word problems (MWPs) into visual representations using the Math2Visual framework. The system generates both formal and intuitive visual representations as SVG images.

## 🏗️ Architecture

The backend consists of the following key components:

- **API Routes**: RESTful endpoints for generation, uploads, tutoring, analytics, and system management
- **Visual Generation**: Services for creating formal and intuitive SVG representations
- **Language Generation**: OpenAI-powered conversion of MWPs to visual language (DSL)
- **Tutor Service**: Gemini-powered interactive tutor with DSL-grounded guidance and streaming responses
- **Analytics**: Session, action, screenshot, and cursor tracking for UX insights
- **Storage Management**: Configurable storage backend (local/JuiceFS) for SVG datasets
- **Security**: Input validation, SVG sanitization, AI tutor message text sanitization, and optional ClamAV integration

## 📁 Project Structure

```
backend/
├── app/                                    # Main application package
│   ├── __init__.py                         # Flask application factory
│   ├── api/                                # API layer
│   │   ├── middleware/                     # Error handlers and middleware
│   │   │   ├── __init__.py
│   │   │   └── error_handlers.py
│   │   ├── routes/                         # API endpoints
│   │   │   ├── __init__.py
│   │   │   ├── analytics.py                # Analytics and usage tracking
│   │   │   ├── chatgpt.py                  # ChatGPT session endpoints (text + streaming)
│   │   │   ├── generation.py               # Core generation API
│   │   │   ├── svg_dataset.py              # SVG dataset management (upload, search, serve)
│   │   │   ├── tutor.py                    # AI tutor session endpoints (text + streaming)
│   │   │   └── system.py                   # System status endpoints
│   │   └── __init__.py
│   ├── config/                             # Configuration management
│   │   ├── __init__.py
│   │   ├── database.py                     # Database configuration
│   │   └── storage_config.py               # Storage backend configuration
│   ├── models/                             # Data models
│   │   ├── __init__.py
│   │   ├── chatgpt_session.py              # ChatGPT session database model
│   │   ├── user_actions.py                 # User action tracking models
│   │   └── tutor_session.py                # Tutor session database model
│   ├── services/                           # Business logic
│   │   ├── chatgpt/                        # ChatGPT session management
│   │   │   ├── __init__.py
│   │   │   └── session_storage.py          # ChatGPT session storage (database-backed, shared across workers)
│   │   ├── language_generation/            # GPT-based DSL generation
│   │   │   ├── __init__.py
│   │   │   ├── gpt_generator.py
│   │   │   └── model_generator.py
│   │   ├── svg_generation/                 # AI-powered SVG icon generation
│   │   │   ├── __init__.py
│   │   │   └── svg_generator.py            # Gemini-based SVG generation
│   │   ├── tutor/                          # Gemini-powered tutor orchestration
│   │   │   ├── dsl_container_types.py      # DSL container type utilities
│   │   │   ├── gemini_tutor.py             # Tutor session + streaming helpers
│   │   │   └── session_storage.py          # Tutor session storage (database-backed, shared across workers)
│   │   ├── validation/                     # Input/output validation
│   │   │   ├── __init__.py
│   │   │   ├── security_scanner.py         # ClamAV integration
│   │   │   ├── svg_validator.py
│   │   │   └── text_sanitizer.py           # HTML sanitization for AI messages
│   │   ├── visual_generation/              # SVG generation engines
│   │   │   ├── __init__.py
│   │   │   ├── container_type_utils.py     # Container type utilities
│   │   │   ├── dsl_parser.py
│   │   │   ├── formal_generator.py
│   │   │   └── intuitive_generator.py
│   │   └── __init__.py
│   ├── translations/                       # Flask-Babel translation catalogs
│   │   ├── en/                             # English translations (source language)
│   │   │   └── LC_MESSAGES/
│   │   │       ├── messages.mo
│   │   │       └── messages.po
│   │   └── de/                             # German translations
│   │       └── LC_MESSAGES/
│   │           ├── messages.mo
│   │           └── messages.po
│   └── utils/                              # Utility functions
│       ├── __init__.py
│       ├── cleanup.py                      # Temp/output cleanup helpers
│       ├── translations.py                 # Argos-based term translation for SVG search
│       └── validation_constants.py         # Shared validation constants
├── app.py                                  # Application entry point (development)
├── wsgi.py                                 # WSGI entry point (production, for Gunicorn)
├── gunicorn.conf.py                        # Gunicorn WSGI server configuration
├── math2visual.yml                         # Conda environment file
├── babel.cfg                               # Babel extraction configuration
├── messages.pot                            # Extracted message template (Babel)
├── requirements.txt                        # Python dependencies
├── storage/                                # Local storage directory
│   ├── datasets/svg_dataset/               # SVG entity library (1,549 files)
│   ├── models/                             # ML model checkpoints
│   │   ├── base_model/                     # Base language models
│   │   └── check-point/                    # Fine-tuned adapters
│   ├── output/                             # Generated visualizations
│   ├── temp_svgs/                          # Temporary AI-generated SVG icons
│   └── analytics/                          # Analytics data storage
│       ├── *.png                           # User session screenshots
│       └── heatmaps/                       # Generated heatmap visualizations
├── scripts/                                # Setup and management scripts
│   ├── cleanup_temp_files.py               # File cleanup utility
│   ├── format_juicefs.sh                   # JuiceFS formatting script
│   ├── generate_heatmap.py                 # Heatmap generation from cursor analytics
│   ├── install_juicefs.sh                  # JuiceFS installation
│   ├── install_systemd_service.sh          # Systemd service installation
│   ├── juicefs-math2visual.service.template # Systemd service template
│   ├── mount_juicefs.sh                    # JuiceFS mounting
│   ├── setup_translations.sh               # Flask-Babel translation setup
│   ├── start_production.sh                 # Production deployment script
│   ├── uninstall_systemd_service.sh        # Systemd service uninstallation
│   └── verify_juicefs.sh                   # JuiceFS verification
├── docs/                                   # Documentation
│   ├── ANALYTICS_SETUP.md                  # Analytics stack & API setup
│   ├── PRODUCTION_DEPLOYMENT.md            # Production deployment guide
│   ├── JUICEFS_SETUP.md                    # JuiceFS setup instructions
│   ├── CLAMAV_SETUP.md                     # ClamAV antivirus setup
│   ├── TRANSLATIONS.md                     # Backend translations with Flask-Babel
│   └── cleanup_setup.md                    # File cleanup documentation
├── config_templates/                       # Configuration templates
│   ├── env_analytics_template              # Example env for analytics DB
│   └── env_juicefs_template                # JuiceFS environment template
└── tests/                                  # Test suite
    └── test_svg_validator.py
```

## 🚀 Quick Start

### Prerequisites

- Python 3.12+
- PostgreSQL 13+ (for JuiceFS mode)
- OpenAI API key
- Optional: ClamAV for security scanning

### Installation

1. **Clone and setup environment:**
```bash
cd backend/

# Option 1: Using conda (recommended - requirements.txt is a conda environment file)
conda create --name math2visual --file requirements.txt

# Option 2: Using pip (install individual packages)
pip install flask flask-cors python-dotenv openai torch transformers peft accelerate bitsandbytes safetensors gunicorn nh3
```

2. **Configure environment variables:**
Update `.env` file with required environment variables.
```bash
# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key

# Gemini Configuration (SVG generation + tutor)
GEMINI_API_KEY=your_gemini_api_key
GEMINI_TUTOR_MODEL=gemini-pro-latest  # optional override

# Storage Configuration
SVG_STORAGE_MODE=local  # or 'juicefs'
SVG_DATASET_PATH=/path/to/svg/dataset
SVG_CACHE_SIZE=100

# Database Configuration (PostgreSQL for tutor sessions and analytics)
# Example (matches the default docker-compose configuration):
DATABASE_URL=postgresql://math2visual_user:math2visual_password@localhost:5432/math2visual_analytics
DATABASE_ECHO=false  # Set to true for SQL query logging (development only)

# Tutor Session Configuration
# Inactivity-based expiration for tutor sessions (in hours). Default: 2
TUTOR_SESSION_EXPIRATION_HOURS=2

# Flask Environment (affects CORS and other behaviors)
# Options: development, production, testing
# FLASK_ENV=production

# CORS Configuration (optional - defaults work for most deployments)
# Explicit list of allowed origins (comma-separated)
# Examples:
# CORS_ORIGINS=https://your-frontend-domain.com,https://www.your-frontend-domain.com
# CORS_ORIGINS=https://app.math2visual.com
CORS_ORIGINS=

# Frontend URL (automatically determines CORS origin in production)
# Example: FRONTEND_URL=https://app.math2visual.com
FRONTEND_URL=

# CORS Security Notes:
# - In development: Allows localhost origins on common ports (3000, 5173, 8080)
# - In production: Only allows explicitly configured origins (very restrictive by default)
# - Always configure CORS_ORIGINS or FRONTEND_URL in production
# - For multiple subdomains: List them explicitly in CORS_ORIGINS

# JuiceFS Configuration (only if using JuiceFS)
See [`docs/JUICEFS_SETUP.md`](docs/JUICEFS_SETUP.md)

3. **Run the application:**

**Development mode:**
```bash
python app.py
```

**Production mode:**
```bash
# Using the production script (recommended)
./scripts/start_production.sh

# Or directly with Gunicorn
gunicorn --config gunicorn.conf.py wsgi:app
```

The server will start on `http://localhost:5000` by default.

### Production Deployment

For production deployment, see the comprehensive guide: [`docs/PRODUCTION_DEPLOYMENT.md`](docs/PRODUCTION_DEPLOYMENT.md)

## 📡 API Endpoints

### Core Generation API

#### `POST /api/generate`
Generate visual representations from math word problems.

**Request Body:**
```json
{
  "mwp": "Janet has 9 oranges and Sharon has 7 oranges. How many oranges do they have together?",
  "formula": "9 + 7 = 16"  // optional
}
```

**Alternative - Direct DSL:**
```json
{
  "dsl": "visual_language: addition(container1[entity_name: orange, entity_type: orange, entity_quantity: 9, container_name: Janet, container_type: girl], container2[entity_name: orange, entity_type: orange, entity_quantity: 7, container_name: Sharon, container_type: girl], result_container[entity_name: orange, entity_type: orange, entity_quantity: 16, container_name: Janet and Sharon, container_type: ])"
}
```

**Response:**
```json
{
  "visual_language": "addition(...)",
  "svg_formal": "<svg>...</svg>",      // Base64 or SVG content
  "svg_intuitive": "<svg>...</svg>",   // Base64 or SVG content
  "formal_error": null,
  "intuitive_error": null,
  "missing_svg_entities": ["entity1", "entity2"]
}
```

#### `POST /api/generate/formal`
Generate only the formal visualization for a given Visual Language (DSL).

**Request Body:**
```json
{
  "dsl": "operation(...)"
}
```

**Response:**
```json
{
  "variant": "formal",
  "visual_language": "operation(...)",
  "svg": "<svg>...</svg>",
  "error": null,
  "missing_svg_entities": [],
  "is_parse_error": false
}
```

#### `POST /api/generate/intuitive`
Generate only the intuitive visualization for a given Visual Language (DSL).

**Request Body:** Same as `/api/generate/formal`

**Response:** Same shape as `/api/generate/formal` with `variant: "intuitive"`

### SVG Dataset Management API

#### `POST /api/svg-dataset/upload`
Upload SVG file to the svg_dataset directory with validation and security scanning.

**Request Body (multipart/form-data):**
```
file: SVG file (required)
expected_filename: string (required) - Expected filename for validation
```

**Example using curl:**
```bash
curl -X POST http://localhost:5000/api/svg-dataset/upload \
  -F "file=@apple.svg" \
  -F "expected_filename=apple.svg"
```

**Response (Success - New file):**
```json
{
  "success": true,
  "message": "SVG file 'apple.svg' uploaded successfully",
  "validation_details": {
    "filename_valid": true,
    "size_valid": true,
    "type_valid": true,
    "content_valid": true,
    "antivirus_scan": {
      "antivirus_available": true,
      "scan_performed": true,
      "scanner_error": null,
      "threat_found": null
    }
  }
}
```

**Response (Error - File already exists):**
```json
{
  "success": false,
  "error": "File 'apple.svg' already exists or has been added by another user in the meantime"
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "No file uploaded"
}
```

#### `GET /api/svg-dataset/search`
Search SVG files in the dataset by name.

**Query Parameters:**
- `query`: Search string to match against SVG filenames (optional)
- `limit`: Maximum number of results (default: 10, max: 50)

**Response:**
```json
{
  "files": [
    {
      "filename": "apple.svg",
      "name": "apple",
      "path": "/path/to/svg_dataset/apple.svg"
    }
  ],
  "query": "apple"
}
```

#### `GET /api/svg-dataset/check-exists`
Check if an SVG name already exists in the dataset.

**Query Parameters:**
- `name`: SVG name to check (without extension)

**Response:**
```json
{
  "exists": true,
  "name": "apple"
}
```

#### `GET /api/svg-dataset/files/<filename>`
Serve SVG files from the dataset.

**Parameters:**
- `filename`: The SVG filename to serve

**Response:** SVG file content with appropriate headers

#### `POST /api/svg-dataset/generate`
Generate an SVG icon using AI (Gemini) based on an entity type.

**Request Body:**
```json
{
  "entity_type": "apple"
}
```

**Example using curl:**
```bash
curl -X POST http://localhost:5000/api/svg-dataset/generate \
  -H "Content-Type: application/json" \
  -d '{"entity_type": "apple"}'
```

**Response (Success):**
```json
{
  "success": true,
  "svg_content": "<svg>...</svg>",
  "temp_filename": "temp_apple_1234567890.svg"
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "Entity type is required"
}
```

**Notes:**
- The generated SVG is stored temporarily in `storage/temp_svgs/`
- The `temp_filename` must be used with the confirm endpoint to save permanently
- Temporary SVGs are subject to automatic cleanup if not confirmed
- This endpoint uses the Gemini AI model configured via `GEMINI_API_KEY`

#### `POST /api/svg-dataset/confirm-generated`
Confirm and permanently save a previously generated SVG from the temporary storage to the dataset.

**Request Body:**
```json
{
  "temp_filename": "temp_apple_1234567890.svg"
}
```

**Example using curl:**
```bash
curl -X POST http://localhost:5000/api/svg-dataset/confirm-generated \
  -H "Content-Type: application/json" \
  -d '{"temp_filename": "temp_apple_1234567890.svg"}'
```

**Response (Success):**
```json
{
  "success": true,
  "filename": "apple.svg"
}
```

**Response (Error - File not found):**
```json
{
  "success": false,
  "error": "Temporary SVG file not found"
}
```

**Response (Error - File already exists):**
```json
{
  "success": false,
  "error": "SVG with name 'apple' already exists in the dataset"
}
```

**Notes:**
- This endpoint moves the SVG from `storage/temp_svgs/` to the permanent dataset
- The final filename is derived from the temporary filename (removes `temp_` prefix and timestamp)
- Once confirmed, the temporary file is deleted
- If a file with the same name already exists in the dataset, the operation fails

### Validation Error Responses

**Response (Content validation error - Malicious content detected):**
```json
{
  "success": false,
  "error": "Content validation failed: File contains potentially malicious content: <script[^>]*>",
  "validation_details": {
    "filename_valid": true,
    "size_valid": true,
    "type_valid": true,
    "content_valid": false,
    "antivirus_scan": null
  }
}
```

**Response (Filename validation error):**
```json
{
  "success": false,
  "error": "Filename validation failed: File must have .svg extension",
  "validation_details": {
    "filename_valid": false,
    "size_valid": false,
    "type_valid": false,
    "content_valid": false,
    "antivirus_scan": null
  }
}
```

**Response (File size validation error):**
```json
{
  "success": false,
  "error": "File too large (max 5MB)",
  "validation_details": {
    "filename_valid": true,
    "size_valid": false,
    "type_valid": false,
    "content_valid": false,
    "antivirus_scan": null
  }
}
```

#### Validation Details Fields

- **`filename_valid`**: Checks for `.svg` extension and safe filename characters
- **`size_valid`**: Verifies file size is under the 5MB limit
- **`type_valid`**: Validates SVG MIME type and basic structure  
- **`content_valid`**: Scans for malicious patterns (scripts, external references, etc.)
- **`antivirus_scan`**: ClamAV scanning results when antivirus is available:
  - `antivirus_available`: Whether ClamAV daemon is running
  - `scan_performed`: Whether the scan was successfully executed  
  - `scanner_error`: Any error message from the scanner
  - `threat_found`: Specific threat name if malware detected

#### Antivirus Scanning Scenarios

**ClamAV Available and Clean:**
```json
"antivirus_scan": {
  "antivirus_available": true,
  "scan_performed": true,
  "scanner_error": null,
  "threat_found": null
}
```

**ClamAV Not Available:**
```json
"antivirus_scan": {
  "antivirus_available": false,
  "scan_performed": false,
  "scanner_error": "ClamAV daemon not running",
  "threat_found": null
}
```

**Threat Detected:**
```json
"antivirus_scan": {
  "antivirus_available": true,
  "scan_performed": true,
  "scanner_error": null,
  "threat_found": "Trojan.SVG.Malware"
}
```

### Tutor Session API

Gemini-powered tutor that guides students through a math word problem using the generated Visual Language (DSL).

#### `POST /api/tutor/start`
Start a tutoring session (generates DSL first).

**Request Body:**
```json
{
  "mwp": "Janet has 9 oranges and Sharon has 7 oranges. How many oranges do they have together?"
}
```

**Response:**
```json
{
  "session_id": "9ad3c7a9-...",
  "tutor_message": "Hi! Let's work through this together...",
  "visual_language": "addition(...)",
  "visual": {
    "variant": "intuitive",
    "svg": "<svg>...</svg>",
    "error": null,
    "is_parse_error": false,
    "dsl_scope": "addition(...)"
  }
}
```

#### `POST /api/tutor/start/stream`
Start a tutoring session with a new math word problem using streaming tutor response (Server-Sent Events).
Generates visual language (DSL) from the MWP first, then streams the tutor's initial response.

**Request Body:**
```json
{
  "mwp": "Janet has 9 oranges and Sharon has 7 oranges. How many oranges do they have together?"
}
```

**Stream Payloads:**
- Chunk: `data: {"type":"chunk","delta":"..."}`
- Final: `data: {"type":"done","session_id":"...","tutor_message":"...","visual_language":"...","visual":{...}}`
- Error: `data: {"type":"error","error":"..."}`

**Response Format:**
Server-Sent Events (SSE) stream with `Content-Type: text/event-stream`

**Example Stream:**
```
data: {"type":"chunk","delta":"Hi! "}
data: {"type":"chunk","delta":"Let's "}
data: {"type":"chunk","delta":"work "}
data: {"type":"chunk","delta":"through "}
data: {"type":"chunk","delta":"this "}
data: {"type":"chunk","delta":"together..."}
data: {"type":"done","session_id":"9ad3c7a9-...","tutor_message":"Hi! Let's work through this together...","visual_language":"addition(...)","visual":{"variant":"intuitive","svg":"<svg>...</svg>","error":null,"is_parse_error":false,"dsl_scope":"addition(...)"}}
```

**Notes:**
- If MWP is provided, generates visual language first, then streams the tutor conversation
- The final `done` payload includes `visual_language` field (unlike `/api/tutor/message/stream`)
- The `visual` field in the done payload contains the rendered visualization if a visual request was generated

#### `POST /api/tutor/message/stream`
Stream a tutoring reply (Server-Sent Events over a POST request).

**Request Body (JSON):**
```json
{
  "session_id": "9ad3c7a9-...",
  "message": "I think we should add the oranges."
}
```

**Stream Payloads:**
- Chunk: `data: {"type":"chunk","delta":"..."}`
- Final: `data: {"type":"done","session_id":"...","tutor_message":"...","visual":{...}}`

### System Management (debug mode)

#### `GET /api/storage/status`
Get storage configuration and status information.

**Response (Success):**
```json
{
  "storage": {
    "cache_size": 100,
    "error": null,
    "is_juicefs_enabled": true,
    "is_valid": true,
    "juicefs_mounted": true,
    "sample_file_accessible": true,
    "storage_mode": "juicefs",
    "svg_dataset_path": "/mnt/juicefs/svg_dataset",
    "svg_file_count": 1550,
    "upload_path": "/mnt/juicefs/svg_dataset"
  },
  "success": true
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "Failed to get storage status: Permission denied"
}
```

#### `GET /api/antivirus/status`
Get antivirus scanner status and configuration information.

**Response (Success):**
```json
  {
    "antivirus": {
      "clamav_version": "ClamAV 1.0.7/27730/Tue Aug 12 10:33:28 2025",
      "connection_method": "socket",
      "connection_target": "/var/run/clamav/clamd.ctl",
      "pyclamd_installed": true,
      "scanner_available": true,
      "scanner_module_available": true
    },
    "success": true
  }
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "Failed to get antivirus status: ClamAV daemon not running"
}
```

### Analytics API

#### `POST /api/analytics/session`
Create or update a user session.

**Request Body:**
```json
{ "session_id": "client-session-id" }
```

**Response:**
```json
{
  "success": true,
  "session_id": "client-session-id",
  "created_at": "2025-08-20T12:34:56.000Z",
  "last_activity": "2025-08-20T12:34:56.000Z"
}
```

#### `POST /api/analytics/actions/batch`
Record multiple user actions.

**Request Body (example):**
```json
{
  "session_id": "client-session-id",
  "actions": [
    { "type": "click", "data": { "target": "generate" }, "timestamp": "2025-08-20T12:35:00Z" }
  ]
}
```

#### `POST /api/analytics/screenshot`
Upload a base64 PNG screenshot for a session.

**Request Body (fields):** `session_id`, `image_data`, `width`, `height`, optional `timestamp`

#### `POST /api/analytics/cursor-positions/batch`
Record multiple cursor positions.

**Request Body (example):**
```json
{
  "session_id": "client-session-id",
  "positions": [
    { "x": 120.5, "y": 340.2, "element_type": "button", "element_id": "generate-btn", "timestamp": "2025-08-20T12:35:05Z" }
  ]
}
```

### ChatGPT API (Analytics Mode)

OpenAI ChatGPT integration for analytics mode chat interface. Supports streaming text and images. **Note**: The ChatGPT view is only available when analytics are enabled.

#### `POST /api/chatgpt/start`
Start a new ChatGPT session.

**Request Body:**
```json
{}
```

**Response:**
```json
{
  "session_id": "9ad3c7a9-..."
}
```

#### `POST /api/chatgpt/message/stream`
Stream a ChatGPT response using Server-Sent Events. Supports text and images.

**Request Body:**
```json
{
  "session_id": "9ad3c7a9-...",
  "message": "Please create an image which I can use for teaching for the math word problem \"Janet has nine oranges and Sharon has seven oranges. How many oranges do Janet and Sharon have together?\"."
}
```

**Stream Payloads:**
- Chunk: `data: {"type":"chunk","delta":"..."}`
- Final: `data: {"type":"done","session_id":"...","message":"...","images":[...]}`
- Error: `data: {"type":"error","error":"..."}`

**Response Format:**
Server-Sent Events (SSE) stream with `Content-Type: text/event-stream`

**Notes:**
- The `images` field in the response contains URLs of generated images (if any)
- ChatGPT can generate images using DALL-E 3, which are included in the response

#### `GET /api/chatgpt/proxy-image`
Proxy image download to avoid CORS issues. Fetches an image from an external URL and returns it.

**Query Parameters:**
- `url`: The URL of the image to proxy

**Response:**
Returns the image file with appropriate content-type headers.

**Example:**
```bash
GET /api/chatgpt/proxy-image?url=https://example.com/image.png
```

**Notes:**
- Used to download images that may have CORS restrictions
- Timeout is set to 30 seconds

## 🎨 Visual Generation

The system generates two types of visual representations:

### 1. Formal Representation
- Mathematical precision with exact quantities
- Explicit mathematical operations
- Accentuates underlying relationships in a clear mathematical way
- Grid-based layouts for structured display

### 2. Intuitive Representation  
- Detailed, example-driven illustration of mathematical relationships to reflect authentic real-world situations and narrative contexts
- Contextual groupings / arrangements
- Designed to improve engagement & reduce the cognitive load

Both generators support:
- **Dynamic SVG composition** from 1,549+ entity library
- **Intelligent layout calculation** based on content
- **Missing entity tracking** for dataset expansion
- **Error handling** with detailed feedback

## 🧠 Language Generation

The system uses OpenAI's GPT models to convert natural language math word problems into structured visual language (DSL).

### Visual Language Format
```
operation(
  container1[entity_name: apple, entity_type: apple, entity_quantity: 3, 
             container_name: John, container_type: boy],
  container2[entity_name: apple, entity_type: apple, entity_quantity: 5,
             container_name: Mary, container_type: girl],
  result_container[entity_name: apple, entity_type: apple, entity_quantity: 8,
                   container_name: John and Mary, container_type: ]
)
```

### Supported Operations
- `addition` - Adding quantities
- `subtraction` - Subtracting quantities  
- `multiplication` - Repeated addition/scaling
- `division` - Splitting into groups
- `comparison` - Comparing quantities
- `surplus` - Remainder operations
- `area` - Area calculations
- `unittrans` - Unit conversions

## 💾 Storage Configuration

### Local Storage (Default)
Change mode to local in .env file:
```bash
SVG_STORAGE_MODE=local
```
- Uses `backend/storage/datasets/svg_dataset/` directory
- Simple filesystem access
- Suitable for development and single-node deployment

### JuiceFS Distributed Storage
**Setup JuiceFS:**
See [`docs/JUICEFS_SETUP.md`](docs/JUICEFS_SETUP.md) for setup instructions.

```bash
SVG_STORAGE_MODE=juicefs
SVG_DATASET_PATH=/mnt/juicefs/svg_dataset
JUICEFS_METADATA_URL=postgres://user:pass@host:port/database
```

**Benefits:**
- **Scalability**: Easy to add distributed storage later
- **Backup**: PostgreSQL metadata can be backed up normally

## 🔒 Security Features

### SVG Security
- SVG content validation and sanitization
- Removal of potentially malicious elements
- Size and complexity limits

### AI Tutor Message Sanitization
- HTML tag stripping from Gemini API responses
- XSS prevention for tutor chat messages
- Uses nh3 library for secure HTML cleaning
- Applied before messages reach frontend

### Optional ClamAV Integration
```bash
# Install ClamAV for virus scanning
sudo apt install clamav clamav-daemon
pip install pyclamd
```

See [`docs/CLAMAV_SETUP.md`](docs/CLAMAV_SETUP.md) for configuration details.

Additional documentation:
- [`docs/TRANSLATIONS.md`](docs/TRANSLATIONS.md) - Backend translations with Flask-Babel
- [`docs/cleanup_setup.md`](docs/cleanup_setup.md) - Cleanup and maintenance setup

## 📊 Analytics

The backend includes user analytics tracking.

For detailed setup instructions, API documentation, and usage examples, see:
**[`docs/ANALYTICS_SETUP.md`](docs/ANALYTICS_SETUP.md)**

## 🧪 Testing

```bash
# Run test suite
python -m pytest tests/

# Test specific component
python -m pytest tests/test_svg_validator.py

# Test with coverage
python -m pytest --cov=app tests/
```

## 🛠️ Development

### Adding New SVG Entities

**Option 1: Manual Upload**
1. Create SVG file following naming conventions
2. Check if name exists via `/api/svg-dataset/check-exists` endpoint
3. Upload via `/api/svg-dataset/upload` endpoint
4. SVG will be validated and added to dataset
5. Use `/api/svg-dataset/search` to find and manage existing entities

**Option 2: AI-Powered Generation**
1. Check if name exists via `/api/svg-dataset/check-exists` endpoint
2. Generate SVG via `/api/svg-dataset/generate` endpoint with entity name
3. Review the generated SVG content
4. Confirm and save via `/api/svg-dataset/confirm-generated` endpoint
5. Use `/api/svg-dataset/search` to find and manage existing entities

### Extending Visual Language
1. Update operation parsers in `services/visual_generation/`
2. Add new operation handlers
3. Update GPT prompts in `services/language_generation/`

### Custom Storage Backends
1. Extend `StorageConfig` class in `config/storage_config.py`
2. Implement new storage validation logic
3. Update environment configuration

## 📚 References

- [Math2Visual Paper](https://arxiv.org/pdf/2506.03735)
- [Math2Visual GitHub Repository](https://github.com/eth-lre/math2visual)
- [Flask Documentation](https://flask.palletsprojects.com/)
- [JuiceFS Documentation](https://juicefs.com/docs/)

## 📄 License

This project is part of the Math2Visual research framework. Please refer to the main repository for licensing information.

---

For questions or support, please refer to the main [Math2Visual repository](https://github.com/eth-lre/math2visual) or open an issue in this project.
