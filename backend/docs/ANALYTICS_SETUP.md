# Math2Visual Analytics Setup

This document describes how to set up and use the user action recording system in Math2Visual.

## 📊 Overview

The analytics system tracks user interactions and behaviors to provide insights into:
- Form usage and interaction patterns
- Cursor movements & screenhot for heat map analysis

## 🏗️ Architecture

### Backend Components
- **Database Models**: `UserSession`, `Action`, `Screenshot`, `CursorPosition`, `TutorSession`, `ChatGPTSession` in SQLAlchemy
- **API Endpoints**: RESTful endpoints for recording and retrieving analytics data, plus ChatGPT endpoints
- **Database**: PostgreSQL (recommended) or SQLite (development)
- **Storage**: File-based screenshot storage

### Frontend Components
- **Analytics Service**: Client-side service (`analyticsService`) for tracking user actions
- **useAnalytics Hook**: React hook providing analytics tracking functions
- **Automatic Tracking**: Batched action recording with debouncing

## 🚀 Quick Setup

### 1. PostgreSQL Database Configuration

```bash
sudo -u postgres psql
# Create database
CREATE DATABASE math2visual_analytics;

# Create user
CREATE USER math2visual_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE math2visual_analytics TO math2visual_user;
```

### 2. Environment Configuration

Copy the analytics template into `.env`:
```bash
config_templates/env_analytics_template
```

Edit `.env` with your database configuration (the main AI keys like `OPENAI_API_KEY` and `GEMINI_API_KEY` should already be configured as in the backend README):
```bash
# For PostgreSQL
DATABASE_URL=postgresql://math2visual_user:your_password@localhost:5432/math2visual_analytics

# Database Configuration
DATABASE_ECHO=false  # Set to true for SQL query logging (development only)
```

### 3. Database Initialization

The database is automatically initialized when the Flask app starts via `app/__init__.py`. The `init_database()` function creates all necessary tables:

```python
# In app/__init__.py
if test_database_connection():
    init_database()
    print("✅ Analytics database initialized")
```

Tables created:
- `user_sessions`: User session tracking
- `actions`: User action records
- `screenshots`: Screenshot metadata
- `cursor_positions`: Cursor tracking data
- `tutor_sessions`: AI tutor session data (also used in non-analytics mode)
- `chatgpt_sessions`: ChatGPT session data

### 4. Frontend Configuration

Analytics are controlled by the `VITE_ENABLE_ANALYTICS` environment variable in the frontend.

Edit `frontend/.env`:
```bash
# Enable or disable analytics
# When enabled, additional features become available:
# - ChatGPT chat interface
# - Extended session tracking
VITE_ENABLE_ANALYTICS=true
```

### 5. Start the Application

```bash
# Backend
python app.py

# Frontend
cd frontend
npm install
npm run dev
```

## 📈 What Gets Tracked

### User Sessions
- **Session Creation**: Unique session IDs stored in localStorage
- **Session Activity**: Last activity timestamp updates
- **User Agent**: Browser/device information

### ChatGPT Sessions (Analytics Mode Only)
- **ChatGPT Interface**: The ChatGPT chat interface is only available when analytics are enabled
- **Session Storage**: ChatGPT sessions are stored in the database with conversation history
- **Session Expiration**: Sessions never expire (preserved for research purposes since they're only used in analytics mode)

### User Actions (Tracked via `useAnalytics` hook)

#### Form Interactions
- `mwp_input_type`: Math word problem input typing
- `formula_input_type`: Formula input typing
- `hint_input_type`: Hint input typing
- `dsl_editor_type`: Visual language editor typing
- `math_problem_form_submit`: Math problem form submission
- `visual_language_form_change`: Visual language form changes

#### Navigation & Layout
- `initial_view_render`: Initial single-column view
- `two_column_layout_render`: Two-column editing view
- `dsl_editor_scroll_up/down`: DSL editor scrolling
- `math_problem_column_scroll_up/down`: Left column scrolling
- `visualization_column_scroll_up/down`: Right column scrolling

#### Popups & Modals
- `name_popup_open`: Name editor popup
- `entity_quantity_popup_open`: Quantity editor popup
- `name_popup_type`: Name popup typing
- `entity_quantity_popup_type`: Quantity popup typing
- `name_popup_button_submit`: Name popup button submit
- `name_popup_keyboard_submit`: Name popup keyboard submit

#### SVG Interactions
- `svg_element_hover`: SVG element hover
- `svg_element_click`: SVG element click
- `svg_search_popup_type`: SVG search typing
- `svg_upload_popup_type`: SVG upload popup typing

#### Downloads
- `download_svg_button_click`: SVG download
- `download_png_button_click`: PNG download
- `download_pdf_button_click`: PDF download

#### Generation
- `generation_start`: Generation initiation with MWP, formula, hint
- `generation_complete`: Generation completion with success/error status, DSL, missing entities

### Cursor Positions
- Mouse X/Y coordinates
- Element context (type, ID)
- Timestamp for heat map analysis

### Screenshots
- Full-page screenshots
- Timestamp and dimensions
- Stored in `backend/storage/analytics/`

### ChatGPT Interactions
- **User Messages**: Messages sent by users to ChatGPT are tracked via `chatgpt_message_submit` actions
- **Image Downloads**: Downloads of ChatGPT-generated images are tracked via `chatgpt_image_download_start` and `chatgpt_image_download_complete` actions
- **Session History**: Full conversation history (both user and assistant messages, including generated images) is stored in the database in the `chatgpt_sessions` table
- **Note**: Assistant messages and image generation events are not explicitly tracked as separate analytics actions, but are preserved in the session history for analysis

## 🔧 API Endpoints

### ChatGPT Endpoints (Analytics Mode Only)

**Note**: These endpoints are only available when analytics are enabled. The ChatGPT view in the frontend is automatically hidden when analytics is disabled.

```bash
# Start a ChatGPT session
POST /api/chatgpt/start
{
}

Response:
{
  "session_id": "9ad3c7a9-..."
}
```

```bash
# Send a message with streaming response
POST /api/chatgpt/message/stream
{
  "session_id": "9ad3c7a9-...",
  "message": "Please create an image which I can use for teaching for the math word problem \"Janet has nine oranges and Sharon has seven oranges. How many oranges do Janet and Sharon have together?\"."
}

Response: Server-Sent Events (SSE) stream
```

```bash
# Proxy image download (bypasses CORS)
GET /api/chatgpt/proxy-image?url=https://example.com/image.png

Response: Image blob
```

For detailed ChatGPT API documentation, see the [Backend README](../README.md#chatgpt-api-analytics-mode).

### Analytics Sessions
```bash
# Create/update session
POST /api/analytics/session
{
  "session_id": "session_123"
}

Response:
{
  "success": true,
  "session_id": "session_123",
  "created_at": "2024-01-01T12:00:00Z",
  "last_activity": "2024-01-01T12:00:00Z"
}
```

### Actions
```bash
# Record batch actions
POST /api/analytics/actions/batch
{
  "session_id": "session_123",
  "actions": [
    {
      "type": "form_submit",
      "data": "{\"value\": \"some data\"}",
      "timestamp": "2024-01-01T12:00:00Z"
    }
  ]
}

Response:
{
  "success": true,
  "actions_recorded": 1,
  "message": "Successfully recorded 1 actions"
}
```

### Cursor Positions
```bash
# Record cursor positions
POST /api/analytics/cursor-positions/batch
{
  "session_id": "session_123",
  "positions": [
    {
      "x": 100.5,
      "y": 200.3,
      "element_type": "button",
      "element_id": "submit-btn",
      "timestamp": "2024-01-01T12:00:00Z"
    }
  ]
}
```

### Screenshots
```bash
# Upload screenshot
POST /api/analytics/screenshot
{
  "session_id": "session_123",
  "image_data": "data:image/png;base64,...",
  "width": 1920,
  "height": 1080,
  "timestamp": "2024-01-01T12:00:00Z"
}

Response:
{
  "success": true,
  "screenshot_id": "screenshot_123",
  "filename": "session_123_20240101_120000_abc12345.png",
  "created_at": "2024-01-01T12:00:00Z"
}
```

## 🔒 Privacy and Security

### Data Collection
- **No Personal Information**: Only technical interaction data
- **Session-Based**: Actions linked to anonymous session IDs
- **User Agents**: For browser/device analytics
- **LocalStorage**: Session IDs stored client-side
- **Screenshots**: Screenshots collected/captured of app only

### Security Measures
- **Input Validation**: All data is validated before storage
- **SQL Injection Protection**: SQLAlchemy ORM prevents injection
- **Base64 Validation**: Screenshot data validated before decoding


## 📊 Analytics Insights

### User Behavior Patterns
- **Form Usage**: Which forms are used most frequently
- **Generation Success**: Success rates for different input types
- **Feature Adoption**: Which features are most/least used
- **Interaction Patterns**: Cursor heat maps and click patterns
- **Error Patterns**: Common failure points and error types

### Common Issues

#### Database Connection Failed
```bash
# Check database URL
echo $DATABASE_URL

# Test connection
python -c "from app.config.database import test_database_connection; test_database_connection()"
```

#### Tables Not Created
The database is automatically initialized when the Flask app starts. If tables are missing:

```python
# Manual initialization
from app.config.database import init_database
init_database()
```

#### Analytics Not Recording
1. Check `VITE_ENABLE_ANALYTICS=true` in frontend
2. Verify database connection
3. Check browser console for errors
4. Verify session ID is being generated

### Debug Mode
```bash
# Enable SQL query logging
DATABASE_ECHO=true

# Check analytics service status in browser console
analyticsService.getSessionId()
analyticsService.isAnalyticsEnabled()
analyticsService.getQueueSize()
```

### Viewing Stored Data

#### Using PostgreSQL
```bash
# Connect to database
psql math2visual_analytics

# View user sessions
SELECT * FROM user_sessions ORDER BY created_at DESC LIMIT 10;

# View actions
SELECT * FROM actions ORDER BY timestamp DESC LIMIT 10;

# View cursor positions
SELECT * FROM cursor_positions ORDER BY timestamp DESC LIMIT 10;

# View screenshots
SELECT * FROM screenshots ORDER BY created_at DESC LIMIT 10;
```

# View ChatGPT sessions
SELECT * FROM chatgpt_sessions ORDER BY created_at DESC LIMIT 10;
```

## 📚 Further Reading

- [SQLAlchemy Documentation](https://docs.sqlalchemy.org/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [React Hooks Documentation](https://react.dev/reference/react)
- [navigator.sendBeacon API](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/sendBeacon)
