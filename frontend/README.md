# Math2Visual Frontend

An interactive React application for teachers and students: **teacher mode** generates formal/intuitive SVG visualizations from MWPs or DSL, and **student mode** provides an AI tutor with guidance and scoped visuals. Built with React, TypeScript, Vite, Tailwind CSS, and ShadCN UI components.


## 🛠 Tech Stack

- **Framework**: React 19.1.0 with TypeScript
- **Build Tool**: Vite 7.0.4
- **Styling**: Tailwind CSS + ShadCN UI components
- **Forms/Validation**: React Hook Form + Zod
- **HTTP/Streaming**: Native Fetch API and EventSource (SSE) for tutor streaming
- **i18n**: i18next + react-i18next (en/de)
- **Notifications**: Sonner (toast-based global errors)
- **Icons**: Lucide React
- **Code Editor**: Monaco Editor for DSL syntax editing
- **PDF Generation**: jsPDF for exports
- **Text/number utils**: pluralize and n2words

## 📁 Project Structure

```
frontend/
├── src/                       # Source code
│   ├── api_services/          # Backend API integration
│   │   ├── analytics.ts       # Session/action/cursor tracking
│   │   ├── chatgpt.ts         # ChatGPT session/message + streaming SSE
│   │   ├── generation.ts      # Visualization generation API
│   │   ├── svgDataset.ts      # SVG search/upload + AI icon generation
│   │   └── tutor.ts           # Tutor session/message + streaming SSE
│   ├── components/            # React components
│   │   ├── common/            # Landing + prompt hero blocks
│   │   │   ├── HeroShell.tsx
│   │   │   └── MwpPromptView.tsx
│   │   ├── forms/
│   │   │   ├── RegenerateForm.tsx          # Regenerate from DSL/formula
│   │   │   └── VisualLanguageForm.tsx
│   │   ├── popups/                         # Entity + SVG management dialogs
│   │   │   ├── BasePopup.tsx
│   │   │   ├── EntityQuantityPopup.tsx
│   │   │   ├── NamePopup.tsx
│   │   │   ├── PopupManager.tsx
│   │   │   ├── SVGActionMenu.tsx
│   │   │   ├── SVGGeneratePopup.tsx
│   │   │   ├── SVGSearchPopup.tsx
│   │   │   └── SVGUploadPopup.tsx
│   │   ├── ui/                            # ShadCN primitives + custom UI
│   │   │   ├── badge.tsx
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dropdown-menu.tsx
│   │   │   ├── error-display.tsx
│   │   │   ├── flying-chatbot-icon.tsx
│   │   │   ├── form.tsx
│   │   │   ├── highlightable-input.tsx
│   │   │   ├── highlightable-textarea.tsx
│   │   │   ├── input.tsx
│   │   │   ├── label.tsx
│   │   │   ├── language-selector.tsx
│   │   │   ├── mwp-text-entry.tsx
│   │   │   ├── resizable.tsx
│   │   │   ├── ResponsiveLogo.tsx
│   │   │   ├── SessionAnalyticsDisplay.tsx
│   │   │   ├── sonner.tsx
│   │   │   ├── sparkles-loading.tsx
│   │   │   ├── syntax-editor.css
│   │   │   ├── syntax-editor.tsx
│   │   │   ├── tabs.tsx
│   │   │   ├── text-cancel-button.tsx
│   │   │   └── textarea.tsx
│   │   ├── views/                         # Page-level and layout views
│   │   │   ├── AppLayout.tsx
│   │   │   ├── ChatGPTView.tsx            # ChatGPT chat interface
│   │   │   ├── ChatView.tsx
│   │   │   ├── InitialView.tsx
│   │   │   ├── LandingPage.tsx
│   │   │   ├── TwoColumnView.tsx
│   │   │   └── chat/
│   │   │       ├── ChatHeader.tsx
│   │   │       ├── ChatInputBar.tsx
│   │   │       ├── ChatMessages.tsx
│   │   │       ├── ChatVisual.tsx
│   │   │       └── ChatVisualPreview.tsx
│   │   └── visualization/                 # Visualization display + actions
│   │       ├── DownloadButton.tsx
│   │       ├── MissingSVGSection.tsx
│   │       ├── ParseErrorSection.tsx
│   │       ├── VisualizationResults.tsx
│   │       └── VisualizationSection.tsx
│   ├── config/
│   │   └── api.ts                         # API configuration and endpoints
│   ├── contexts/
│   │   ├── DSLContext.tsx                 # DSL state and operations
│   │   ├── HighlightingContext.tsx        # Syntax highlighting state
│   │   ├── LanguageContext.tsx            # i18n selection
│   │   └── ThemeContext.tsx               # Theme (light/dark) state
│   ├── hooks/                             # Custom React hooks
│   │   ├── useAppState.ts
│   │   ├── useChatGPTSession.ts           # ChatGPT session management
│   │   ├── useElementInteractions.ts
│   │   ├── useEntityQuantityPopup.ts
│   │   ├── useHighlighting.ts
│   │   ├── useLoadingStates.ts
│   │   ├── useMathProblemForm.ts
│   │   ├── useNamePopup.ts
│   │   ├── usePopupManagement.ts
│   │   ├── useSVGMissingError.tsx
│   │   ├── useSVGResponsive.ts
│   │   ├── useSVGSelector.ts
│   │   ├── useTutorSession.ts
│   │   ├── useTutorSpeech.ts
│   │   ├── useVisualizationHandlers.ts
│   │   ├── useVisualLanguageForm.ts
│   │   └── useVoiceInput.ts
│   ├── i18n/
│   │   ├── config.ts
│   │   └── locales/ (en.json, de.json)
│   ├── lib/
│   │   ├── dsl-utils.ts
│   │   └── utils.ts
│   ├── schemas/
│   │   └── validation.ts
│   ├── services/
│   │   └── analyticsTracker.ts
│   ├── styles/
│   │   ├── responsive-text.css
│   │   └── responsive-toast.css
│   ├── types/
│   │   ├── index.ts
│   │   └── visualInteraction.ts
│   ├── utils/
│   │   ├── apiHelpers.ts
│   │   ├── download.ts
│   │   ├── dsl-cursor-mapping.ts
│   │   ├── dsl-formatter.ts
│   │   ├── dsl-parser.ts
│   │   ├── elementUtils.ts
│   │   ├── mwpUtils.ts
│   │   ├── numberUtils.ts
│   │   ├── pluralization.ts
│   │   └── validation.ts
│   ├── App.tsx
│   ├── App.css
│   ├── main.tsx
│   ├── index.css
│   └── vite-env.d.ts
├── public/                 # Static assets (copied to dist on build)
│   └── ...                # Logos, icons, manifest, etc.
├── dist/                   # Production build output (generated, gitignored)
├── docs/                   # Documentation (e.g., PRODUCTION_DEPLOYMENT.md)
├── node_modules/           # Dependencies (generated, gitignored)
├── .env                    # Environment variables (gitignored)
├── .env.example            # Environment variables template
├── package.json            # Dependencies and scripts
├── package-lock.json       # Locked dependency versions
├── tsconfig.json           # TypeScript configuration
├── tsconfig.app.json       # TypeScript app configuration
├── tsconfig.node.json      # TypeScript node configuration
├── vite.config.ts          # Vite build configuration
├── tailwind.config.js      # Tailwind CSS configuration
├── postcss.config.mjs      # PostCSS configuration
├── eslint.config.js        # ESLint configuration
└── components.json         # ShadCN components configuration
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm
- Math2Visual backend running (default: http://localhost:5000)

### Installation

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure backend URL** (optional)

   The frontend automatically connects to the backend URL configured in `vite.config.ts`:
   ```typescript
   proxy: {
     '/api': {
       target: process.env.BACKEND_URL || 'http://localhost:5000',
       changeOrigin: true,
       secure: false, // TODO: remove this when the backend is deployed
     }
   }
   ```

   **Important**: The `secure: false` setting disables SSL certificate validation for development. This allows the proxy to connect to backends with self-signed certificates or during local development. **Remove this setting when deploying to production** with proper SSL certificates, as it bypasses security validations.

   You can override the backend URL by setting the `BACKEND_URL` environment variable:
   ```bash
   BACKEND_URL=http://your-backend-url:port npm run dev
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```
   
   The application will be available at `http://localhost:5173`

### Production Build

```bash
# Build for production
npm run build

# Preview production build locally
npm run preview
```

The build process creates optimized static files in the `dist/` directory that can be served by any web server.

**For detailed production deployment instructions, see [Production Deployment Guide](docs/PRODUCTION_DEPLOYMENT.md).**

#### Quick Production Start

```bash
# Build the application
npm run build

# Serve with a static file server (install globally: npm install -g serve)
serve -s dist -l 3000

# Or using npx (no installation needed)
npx serve -s dist -l 3000
```

## 🎯 Usage

### Basic Workflow

1. **Choose your mode**
   - **Teacher mode (visual generation):** Generates formal/intuitive SVGs from MWPs or DSL. Entry via the main math problem form or regenerate/DSL forms; backed by `POST /api/generate` and SVG dataset endpoints.
   - **Student mode (AI tutor):** Conversational tutor that guides a learner, streams responses, and can render scoped visuals. Entry via `ChatView`; backed by `POST /api/tutor/start` and `POST /api/tutor/message/stream`.

2. **Teacher mode: Visual generation**
   - Enter a Math Word Problem in the main text area.
   - Optionally add a formula or DSL; click **Generate**.
   - Wait for processing, then review formal and intuitive SVGs.
   - Adjust entities/quantities/names via popups, and search/upload missing SVGs (or AI-generate them). Edit the Visual Language in the Monaco Editor.
   - Download results as SVG, PNG, or PDF.

3. **Student mode: AI tutor**
   - Start a tutor session from the tutor entry point with your MWP.
   - Chat with the tutor; replies are streamed stream.
   - When the tutor shows a scoped visual, it is rendered from the initially generated DSL fragment.
   - Continue the conversation until you found out the result.

### Error Handling

The application handles various error scenarios:
- **Network/proxy issues**: Backend unreachable or offline (toast surfaced).
- **Generation/parse errors**: Formal/intuitive generation or DSL parsing problems are shown in the results tabs (teacher mode).
- **Missing SVG entities**: Upload/AI-generate flow is offered when icons are absent.
- **Tutor session errors**: Missing session or streaming failures surface toasts in student mode; empty messages are ignored.
- **SVG validation**: Upload/AI-generated SVG failures return validation details and are surfaced via toast.

### Advanced Features

- **Request Cancellation**: Abort ongoing generation requests.
- **Visual Language Editing**: Modify and regenerate from custom VL using Monaco Editor.
- **Interactive SVG Management**: Search, upload, and AI-generate SVG icons.
- **AI-Powered SVG Generation**: Generate custom SVG icons using Google Gemini.
- **Tutor mode streaming**: Chat replies stream and can trigger scoped visual renders from DSL fragments.
- **Popup-based Interactions**: Entity quantity, name, and SVG adjustments via dialogs.
- **Language switching**: UI and backend error messages localized (en/de).
- **Multiple Download Formats**: Export in SVG, PNG, or PDF.

## 🔧 Configuration

### Environment Variables

The application uses these configuration options:

- **Development Backend URL**: Set via `BACKEND_URL` environment variable or `vite.config.ts` (default: `http://localhost:5000`)
- **Production Backend URL**: Set via `VITE_BACKEND_URL` environment variable **before building** (e.g., `VITE_BACKEND_URL=https://api.your-domain.com npm run build`)
- **API Endpoints**: Automatically configured based on backend URL

**Important**: `VITE_BACKEND_URL` must be set at build time. Changes require rebuilding the application.

### Customization

- **Styling**: Modify `tailwind.config.js` for theme customization
- **Components**: Extend ShadCN components in `src/components/ui/`
- **API**: Update `src/config/api.ts` for backend configuration changes


## 🐛 Troubleshooting

### Common Issues

1. **Backend Connection Failed**
   - Verify backend is running on configured port (default: 5000)
   - Check `vite.config.ts` proxy setting or `BACKEND_URL` environment variable
   - Ensure no firewall blocking the connection

2. **Build Errors**
   - Clear `node_modules` and reinstall dependencies
   - Check TypeScript errors with `npm run lint`
   - Verify all dependencies are up to date

3. **Styling Issues**
   - Ensure Tailwind CSS is properly configured
   - Check CSS variable definitions in `index.css`
   - Verify ShadCN components are correctly installed

## 🚀 Production Deployment

For comprehensive production deployment instructions, see the **[Production Deployment Guide](docs/PRODUCTION_DEPLOYMENT.md)**.

The guide covers:
- Building and optimizing the production bundle
- Deployment options (static servers, Nginx, Apache, cloud hosting)
- Environment variable configuration
- Security best practices
- Performance optimization
- Troubleshooting common issues
- CI/CD integration examples

### Quick Reference

```bash
# 1. Build for production
VITE_BACKEND_URL=https://your-backend-url.com npm run build

# 2. Serve with static file server
npx serve -s dist -l 3000

# Or use Nginx/Apache (see deployment guide)
```

## 📝 API Integration

The frontend communicates with the Flask backend via REST API endpoints. For detailed API documentation, request/response schemas, and endpoint specifications, see the [Backend README](../backend/README.md).

### Key Integration Points

All endpoints are relative to `BACKEND_API_URL` from `src/config/api.ts`.

- **Generation**: `POST /api/generate` — create visualizations from MWPs or DSL.
- **Tutor (Gemini)**:
  - `POST /api/tutor/start` — initialize a tutor session with DSL + first turn (non-streaming). Used for autostarting sessions (when `mwp` is `null`) and regular session starts. Accepts `{ "mwp": "..." }` or `{ "mwp": null }`. Returns JSON with `session_id`, `tutor_message`, `visual_language`, and optional `visual`.
  - `POST /api/tutor/start/stream` — initialize a tutor session with streaming tutor response (Server-Sent Events). Accepts `{ "mwp": "..." }`. Returns SSE stream with `chunk` and `done` events. The `done` event includes `session_id`, `tutor_message`, `visual_language`, and optional `visual`. **Note**: This streaming endpoint is NOT used for autostarting (when `mwp` is `null`); autostart uses the non-streaming `POST /api/tutor/start` endpoint instead. While the backend technically supports `null`/empty `mwp`, the frontend always provides an MWP string when calling this endpoint.
  - `POST /api/tutor/message/stream` — streaming tutor replies (SSE-style over POST) with JSON body `{ "session_id": "...", "message": "..." }`, returning `chunk` and `done` events.
- **SVG Dataset**:
  - `POST /api/svg-dataset/generate` — AI-generate a temporary SVG icon.
  - `POST /api/svg-dataset/confirm-generated` — move/rename generated SVG into the dataset.
  - `GET /api/svg-dataset/search?query=&limit=` — search existing SVG files.
  - `GET /api/svg-dataset/check-exists?name=` — check for filename collisions.
  - `POST /api/svg-dataset/upload` — upload a validated SVG file.
- **Analytics (optional)**:
  - `POST /api/analytics/session` — register a session.
  - `POST /api/analytics/actions/batch` — send batched user actions.
  - `POST /api/analytics/cursor-positions/batch` — send cursor positions for heatmaps.
  - `POST /api/analytics/screenshot` — upload anonymized screenshots.
- **ChatGPT (Analytics Mode)**:
  - `POST /api/chatgpt/start` — initialize a ChatGPT session. Request body: `{}`. Returns JSON with `session_id`. **Note**: The ChatGPT view is only available when analytics are enabled.
  - `POST /api/chatgpt/message/stream` — send a message to ChatGPT with streaming response (Server-Sent Events). Accepts `{ "session_id": "...", "message": "..." }`. Returns SSE stream with `chunk`, `done`, and `error` events. The `done` event includes `session_id`, `message`, and optional `images` (URLs of generated images). **Note**: ChatGPT can generate images using DALL-E 3, which are included in the response as URLs in the `images` field.
  - `GET /api/chatgpt/proxy-image?url=...` — proxy image downloads to bypass CORS restrictions. Fetches an image from an external URL and returns it as a blob. Timeout is set to 30 seconds.

## 📄 License

This project is part of the Math2Visual system. See the main project repository for license information.

## 🔗 Related

- [Math2Visual GitHub Repository](https://github.com/eth-lre/math2visual)
- [Math2Visual Paper](https://arxiv.org/pdf/2506.03735)
- [Backend Documentation](../backend/README.md)