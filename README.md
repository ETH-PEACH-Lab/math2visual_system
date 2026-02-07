---

# <img src="./images/icon.png" width="30" height="30"> Math2Visual Interactive System

An interactive educational platform that transforms math word problems (MWPs) into pedagogically meaningful visual representations for enhanced learning and teaching.

## 🎯 Overview

The Math2Visual Interactive System targets educators. It allows to automatically create engaging visuals from textual math problems, supporting diverse learning styles and improving mathematical comprehension.
The tool generates two different types of visualizations for an MWP given:

- **Formal Representation**: Exact quantities and explicit mathematical operations
- **Intuitive Representation**: Natural visual groupings / arrangements that emphasize real-world context

## 🔬 Research Foundation

This interactive system builds upon the Math2Visual research framework:

- **Research Paper**: [Math2Visual: Automatic Pedagogically Meaningful Visual Representations for Math Word Problems](https://arxiv.org/pdf/2506.03735)
- **Original Repository**: [Math2Visual on GitHub](https://github.com/eth-lre/math2visual)
- **ETH AI Center**: [ETH AI Center](https://ai.ethz.ch/)
- **PEACH Lab**: [PEACH Lab (ETH)](https://peach.ethz.ch/)
- **LRE Lab**: [ETH Learning Research & Education Lab](https://lre.ethz.ch/)

### Key Innovations

- **Framework for automated visual generation from MWPs**:
   1. Scalable for diverse narrative structures found in MWPs.
   2. Automation of time-consuming manual process.
- **Pedagogically Meaningful Design**: Design of visuals validated with teachers.

## ✨ Key Capabilities

- **Teacher mode**: Generate formal and intuitive SVGs from MWPs and Visual Language (DSL), then edit interactively and regenerate.
- **Student mode (AI tutor)**: Gemini-powered tutor with streaming replies that can surface scoped visuals grounded in DSL fragments.
- **1,549+ SVG entity library**: Search existing icons, upload your own, or AI-generate new SVGs.
- **Exports & sharing**: Download visuals as SVG, PNG, or PDF.
- **Localization & UX**: English and German UI.

## 🧮 User Interface

![Landing Page](./images/app1.png)

![Teacher Mode](./images/app2.png)

![Teacher Mode - Visual Language Editing](./images/app3.png)

![Student Mode](./images/app4.png)

## 📚 Usage Workflow

### Teacher mode (visual generation)
1. **Enter Problem**: Provide a math word problem in the main text area.
2. **Optional context**: Add a formula or hints to describe the relationships between elements in the visuals.
3. **Generate**: Click **Generate** and wait for AI processing.
4. **Review**: Inspect both formal and intuitive visual representations.
5. **Refine**: Adjust entities/quantities/names via popups (including search/upload/AI-generate for missing SVGs), then regenerate. Tweak the DSL in the Monaco editor.
6. **Export**: Download visuals as SVG, PNG, or PDF.

### Student mode (AI tutor)
1. **Start tutoring** with an MWP to create a session.
2. **Chat with the tutor**; replies stream and surface scoped visuals grounded in the DSL when relevant.
3. **Iterate** until the learner reaches the answer; regenerate visuals parts if needed.

## 🏛️ System Overview

```mermaid
graph TB
    %% User Layer
    User["Users<br/>(Teachers & Students)"]
    
    %% Frontend
    Frontend["React Frontend<br/>(TypeScript + Vite)"]
    
    %% Backend
    Backend["Flask Backend<br/>(Python)"]
    
    %% AI Services
    OpenAI["OpenAI GPT<br/>(DSL Generation)"]
    Gemini["Gemini API<br/>(Tutor + SVG Gen)"]
    
    %% Storage
    PostgreSQL["PostgreSQL<br/>(Sessions & Analytics)"]
    Storage["File Storage<br/>(SVG Dataset + Outputs)"]
    
    %% Security
    ClamAV["ClamAV<br/>(Virus Scanning)"]
    
    %% Cleanup
    Cleanup["Periodic Cleanup<br/>(Cron Job)"]
    
    %% Flows
    User -->|"Teacher Mode:<br/>MWP Input"| Frontend
    User -->|"Student Mode:<br/>Tutor Chat"| Frontend
    Frontend -->|"API Requests"| Backend
    
    Backend -->|"Math Word Problem<br/>+ Formula/Hint"| OpenAI
    Backend -->|"Conversation + DSL<br/>& Entity Types"| Gemini
    Backend -->|"Uploaded SVG Files"| ClamAV
    
    OpenAI -->|"Visual Language DSL"| Backend
    Gemini -->|"Responses + DSL"| Backend
    ClamAV -->|"Scan Results"| Backend
    
    Backend -->|"Read/Write"| PostgreSQL
    Backend -->|"SVG Assets & Outputs"| Storage
    Cleanup -.->|"removes expired<br/>sessions"| PostgreSQL
    Cleanup -.->|"removes temp<br/>files"| Storage
    
    Backend -->|"SVG Visualization /<br/>Tutor message"| Frontend
    Frontend -->|"Display Results"| User
    
    %% Styling
    classDef frontend fill:#E2EBFF,stroke:#374D7C,stroke-width:2px
    classDef backend fill:#EEEEEE,stroke:#999999,stroke-width:2px
    classDef external fill:#FFEFDB,stroke:#FBB35A,stroke-width:2px
    classDef storage fill:#FFF9C4,stroke:#F57F17,stroke-width:2px
    classDef security fill:#FFDFE5,stroke:#FF5978,stroke-width:2px
    classDef user fill:#F3E5F5,stroke:#9C27B0,stroke-width:2px
    classDef cleanup fill:#F5F5F5,stroke:#999999,stroke-width:2px,stroke-dasharray:5 5
    
    class Frontend frontend
    class Backend backend
    class OpenAI,Gemini external
    class PostgreSQL,Storage storage
    class ClamAV security
    class User user
    class Cleanup cleanup
```

### Frontend (React + TypeScript)
- **Technologies**: React 19, Vite, ShadCN and Tailwind CSS
- **Visual Generation from MWP**: Generating two types of visualization (intuitive, formal) representing MWP
- **Visual Language Editing**: Direct modification and regeneration capabilities
- **Interactive SVG Management**: Search, upload, and manage SVG entities with popup-based interactions
- **Multi-format Export**: Download visualizations as SVG, PNG or PDF

### Backend (Flask + Python)
- **AI-Powered Processing**: OpenAI GPT integration for natural language to visual language conversion
- **Dual Generation Engines**: Separate formal and intuitive visualization algorithms
- **Scalable Storage**: Local filesystem or distributed JuiceFS with PostgreSQL metadata
- **SVG Uploading Security & Validation**: SVG content validation, and optional ClamAV integration
- **Extensive SVG Entity Library**: 1,549 SVG assets for comprehensive visual coverage


## 🚀 Quick Start

### Prerequisites

- **Python 3.12+**
- **Node.js 18+** with npm
- **OpenAI API Key** (GPT for DSL generation)
- **Gemini API Key** (AI SVG generation + tutor)
- **PostgreSQL 13+** (only when using JuiceFS or analytics)
- Optional: **ClamAV** for antivirus scanning

### 1) Clone the repository

```bash
git clone https://github.com/7i6ht/math2visual.git
cd math2visual
```

### 2) Backend setup

```bash
cd backend/

# Recommended: create the environment via conda
conda create --name math2visual --file requirements.txt
conda activate math2visual

# Or with pip using the conda export (may need platform-specific wheels)
pip install -r requirements.txt

# Or with pip installing the core deps explicitly
pip install flask flask-cors python-dotenv openai torch transformers peft accelerate bitsandbytes safetensors gunicorn
```

Create `backend/.env` (or export env vars):

```bash
# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key

# Gemini Configuration (SVG generation + tutor)
GEMINI_API_KEY=your_gemini_api_key
GEMINI_TUTOR_MODEL=gemini-pro-latest  # optional override

# Storage
SVG_STORAGE_MODE=local         # or 'juicefs'
SVG_DATASET_PATH=./storage/datasets/svg_dataset
SVG_CACHE_SIZE=100

# Database (PostgreSQL) for tutor sessions and analytics
# Example (matches the default docker-compose configuration):
DATABASE_URL=postgresql://math2visual_user:math2visual_password@localhost:5432/math2visual_analytics
DATABASE_ECHO=false  # Set to true for SQL query logging (development only)

# Tutor session configuration
# Inactivity-based expiration for tutor sessions (in hours). Default: 2
TUTOR_SESSION_EXPIRATION_HOURS=2

# Optional distributed storage (JuiceFS + Postgres)
JUICEFS_METADATA_URL=postgres://user:pass@host:port/database
```

Start the backend:

```bash
python app.py  # http://localhost:5000
```

### 3) Frontend setup

```bash
cd frontend/
npm install

# Dev server; proxies /api to BACKEND_URL/VITE_BACKEND_URL (default http://localhost:5000)
export BACKEND_URL=http://localhost:5000
npm run dev
```

For production builds, set `VITE_BACKEND_URL` before `npm run build`.

### 4) Access the application

Open `http://localhost:5173` and start generating visualizations.

### Configuration quick reference

- **Backend**: Flask dev server on `http://localhost:5000`.
- **Frontend**: Vite dev server on `http://localhost:5173`; `/api` proxy targets `VITE_BACKEND_URL` or `BACKEND_URL` (fallback `http://localhost:5000`).
- **SVG dataset**: 1,549 SVGs in `backend/storage/datasets/svg_dataset`. Use JuiceFS + Postgres via `backend/docs/JUICEFS_SETUP.md`.
- **Security & analytics**: Optional ClamAV scanning and analytics stack (see backend docs).

## 🧪 Development & Testing

- **Backend tests**: `python -m pytest tests/`
- **Frontend lint**: `npm run lint`
- **Frontend build/preview**: `npm run build` then `npm run preview`

## 📖 Documentation

- **[Frontend Documentation](frontend/README.md)**: React application structure, component usage, and development workflows
- **[Backend Documentation](backend/README.md)**: Comprehensive Flask API reference, storage configuration, and deployment guides
- **[JuiceFS Setup Guide](backend/docs/JUICEFS_SETUP.md)**: Distributed storage configuration
- **[Security Setup Guide](backend/docs/CLAMAV_SETUP.md)**: ClamAV antivirus integration


## 📄 License

This project builds upon the Math2Visual research framework. Please refer to the [original repository](https://github.com/eth-lre/math2visual) for licensing information and academic use guidelines.

## 🙏 Credits

This code base was developed with the assistance of:

- **[Cursor AI](https://cursor.sh/)**: AI-powered code editor that enhanced development productivity and code quality (using various available models)
- **[Claude (Anthropic)](https://www.anthropic.com/claude)**: AI assistant that provided intelligent code generation, debugging support, architectural guidance, in addition to generation of documentation

---

*Transform mathematical learning through the power of AI-generated visualizations.* ✨

---

---

## 🐳 Docker Deployment

The application can be deployed using Docker Compose with the provided `docker-compose.yml` configuration.

### Docker Container Architecture

```mermaid
flowchart TB
    %% User Layer
    User[("Students & Teachers")]

    subgraph Storage["Local Storage"]
        FileStorage[("File Storage<br/>SVG Dataset<br/>Output files")]
    end

    %% Docker Container Services
    subgraph Containers["Docker Containers"]
        direction TB

        subgraph App["App Container"]
            Nginx["Nginx :443<br/>SSL/TLS<br/>Static files<br/>Reverse proxy"]
            Gunicorn["Gunicorn :5000<br/>4+ workers<br/>Flask WSGI"]
            Flask["Flask Backend<br/>DSL generation<br/>SVG processing<br/>AI tutor"]
            Static["React Frontend<br/>(built assets)"]
        end

        subgraph Database["DB Container"]
            Postgres[("PostgreSQL<br/>Sessions & Analytics")]
        end

        subgraph Security["Security Container"]
            ClamAV[("ClamAV<br/>Antivirus")]
        end

        subgraph Certs["Cert Management"]
            CertbotInit["Certbot Init<br/>Manual setup"]
            CertbotRenew["Certbot Renew<br/>Auto-renewal"]
        end

        subgraph Cleanup["Cleanup Container<br/>Service: cleanup"]
            CleanupSvc["Cleanup Cron<br/>Temp files"]
        end
    end

    %% External Services
    subgraph External["External APIs"]
        OpenAI["OpenAI GPT-4"]
        Gemini["Gemini"]
    end



    %% Connections
    User <-->|HTTPS| Nginx
    Nginx --> Static
    Nginx --> Gunicorn
    Gunicorn <--> Flask

    Flask <--> Postgres
    Flask <--> ClamAV
    Flask --> OpenAI
    Flask --> Gemini

    Flask <--> FileStorage
    CleanupSvc <--> FileStorage
    CleanupSvc <--> Postgres

    CertbotInit -.-> Nginx
    CertbotRenew -.-> Nginx

    %% Styling
    classDef container fill:#E3F2FD,stroke:#1976D2,stroke-width:3px
    classDef external fill:#FFF3E0,stroke:#F57C00,stroke-width:2px
    classDef storage fill:#EFEBE9,stroke:#5D4037,stroke-width:2px

    class Containers,App,Database,Security,Certs,Cleanup container
    class External,OpenAI,Gemini external
    class Storage,FileStorage storage
```

### Quick Docker Deployment

1. **Set up environment variables**:

   Create a project-level `.env` file (read by Docker Compose):
   ```bash
   # Create project .env file (read by docker-compose for build args and defaults)
   cat > .env << EOF
   # Frontend build configuration
   VITE_ENABLE_ANALYTICS=false

   # Docker Compose environment variable defaults
   POSTGRES_PASSWORD=your_secure_password
   CORS_ORIGINS=https://your-domain.com,https://www.your-domain.com
   FRONTEND_URL=https://your-domain.com
   EOF
   ```

   Then create a backend `.env` file (for Flask runtime):
   ```bash
   # Create backend .env file (used by Flask backend at runtime)
   cat > backend/.env << EOF
   # OpenAI Configuration
   OPENAI_API_KEY=your_openai_api_key

   # Gemini Configuration (SVG generation + tutor)
   GEMINI_API_KEY=your_gemini_api_key
   GEMINI_TUTOR_MODEL=gemini-pro-latest  # optional override

   # Storage Configuration
   SVG_STORAGE_MODE=local  # or 'juicefs'
   SVG_DATASET_PATH=./storage/datasets/svg_dataset
   SVG_CACHE_SIZE=100

   # Database Configuration (PostgreSQL for tutor sessions and analytics)
   DATABASE_URL=postgresql://math2visual_user:\${POSTGRES_PASSWORD}@postgres:5432/math2visual_analytics
   DATABASE_ECHO=false  # Set to true for SQL query logging (development only)

   # Tutor Session Configuration
   TUTOR_SESSION_EXPIRATION_HOURS=2

   # Flask Configuration
   FLASK_ENV=production

   # ClamAV Configuration (antivirus scanning)
   CLAMAV_HOST=clamav
   CLAMAV_PORT=3310
   EOF
   ```

   **Important**: Docker Compose reads the project-level `.env` file automatically. The backend `.env` file is mounted into the container and read by the Flask application at runtime.

2. **Start the application**:
   ```bash
   docker compose up -d
   ```

3. **Check logs**:
   ```bash
   docker compose logs -f app
   ```

4. **Access the application**:
   - **Before SSL setup**: HTTP only at `http://localhost`
   - **After SSL setup**: HTTPS at `https://your-domain.com` (HTTP redirects to HTTPS)

### Docker Compose Commands

```bash
# Start with cleanup service (analytics disabled)
docker compose --profile cleanup up -d

# Start without cleanup (analytics enabled - preserves tutor sessions)
docker compose up -d

# View logs
docker compose logs -f

# View specific service logs
docker compose logs -f app
docker compose logs -f postgres
docker compose logs -f clamav

# Stop all services
docker compose down

# Rebuild and restart
docker compose up -d --build

# Clean up volumes (WARNING: deletes data)
docker compose down -v
```

### Services Overview

- **app**: Main application (Flask backend + React frontend via Nginx)
- **postgres**: Database for tutor sessions and analytics
- **clamav**: Antivirus scanning for uploaded files
- **certbot-init**: Manual SSL certificate setup (run on-demand)
- **certbot-renew**: Automatic SSL certificate renewal (runs every 12 hours)
- **cleanup**: Periodic cleanup of temporary files (optional profile)

### SSL Certificate Setup

The application is configured for HTTPS with automatic SSL certificate management using Let's Encrypt.

#### Prerequisites

Before setting up SSL certificates, ensure:

1. **Domain Configuration**: Your domain (e.g., `your-domain.com`) points to your server's IP address via DNS A record
2. **Port Accessibility**: Ports 80 (HTTP) and 443 (HTTPS) are open and accessible from the internet
3. **Firewall Rules**: Configure your firewall to allow traffic on ports 80 and 443
4. **Application Running**: The Docker containers are running and accessible via HTTP

**Note**: The application requires SSL certificates to function properly. Without certificates, HTTPS requests will fail. The nginx configuration expects certificates to be present at `/etc/letsencrypt/live/your-domain.com/`.

**Important**: Before deploying with SSL certificates, ensure the `secure: false` setting in `frontend/vite.config.ts` is removed. This setting disables SSL certificate validation for the development proxy and should not be used in production:

```typescript
// frontend/vite.config.ts - REMOVE THIS LINE IN PRODUCTION
secure: false, // TODO: remove this when the backend is deployed
```

#### Certificate Setup Steps (AI generated documentation, not checked and tested yet)

The `certbot-init` container provides a Dockerized Certbot environment for obtaining SSL certificates from Let's Encrypt.

##### How certbot-init Works

- **Container**: Uses the official `certbot/certbot` Docker image
- **Volume Mounts**:
  - `./certbot/conf:/etc/letsencrypt` - stores certificates and configuration
  - `./certbot/www:/var/www/certbot` - webroot directory for HTTP-01 challenges
- **Method**: Uses webroot authentication (places challenge files in `/var/www/certbot`)
- **Execution**: Manual, one-time setup (not automatically started)

##### Certificate Setup Process

1. **Initial Certificate Setup** (run once):
   ```bash
   # Basic setup for a single domain
   docker compose run --rm certbot-init certbot certonly --webroot -w /var/www/certbot -d your-domain.com --email your-email@example.com

   # With additional options
   docker compose run --rm certbot-init certbot certonly --webroot -w /var/www/certbot -d your-domain.com --email your-email@example.com --agree-tos --no-eff-email
   ```

2. **What happens during setup**:
   - Certbot creates challenge files in `./certbot/www/.well-known/acme-challenge/`
   - Nginx serves these files at `http://your-domain.com/.well-known/acme-challenge/`
   - Let's Encrypt validates domain ownership
   - Certificates are saved to `./certbot/conf/live/your-domain.com/`

3. **Update environment variables** for production:
   ```bash
   # Add to backend/.env file
   CORS_ORIGINS=https://your-domain.com,https://www.your-domain.com
   FRONTEND_URL=https://your-domain.com
   ```

4. **Certificate renewal** happens automatically every 12 hours via the `certbot-renew` service.

##### Troubleshooting Certificate Setup

- **Port 80 blocked**: Ensure port 80 is accessible from the internet
- **Domain not pointing to server**: Verify DNS A record points to your server's IP
- **Challenge files not accessible**: Check that Nginx is running and serving from `./certbot/www`
- **Certificate files location**: Certificates are stored in `./certbot/conf/live/your-domain.com/`

##### Certificate File Locations

After successful setup, certificates are available at:
- **Full certificate chain**: `./certbot/conf/live/your-domain.com/fullchain.pem`
- **Private key**: `./certbot/conf/live/your-domain.com/privkey.pem`
- **Certificate only**: `./certbot/conf/live/your-domain.com/cert.pem`

These files are automatically mounted into the Nginx container for HTTPS serving.


### Deployment troubleshooting

- **Nginx welcome page issue**:
  - Symptom: When accessing the app on EC2 (e.g., `http://<EC2_IP>`), you only see the generic **"Welcome to nginx!"** page instead of the Math2Visual UI.
  - Root cause: Some base images ship with a default Nginx site in `sites-enabled` that serves the welcome page and can override the custom `conf.d/default.conf`.
  - Prevention: The `docker-entrypoint.sh` script now disables the default site and removes any `sites-enabled` include from `nginx.conf` at container startup so only the Math2Visual configuration is used.
  - Quick sanity check after deployment:
    ```bash
    # On the EC2 instance, from the math2visual directory
    curl -k https://localhost | head
    ```
    This should return the Math2Visual/Vite HTML (an `<html>` document with `<div id="root"></div>`), **not** the "Welcome to nginx!" text.

