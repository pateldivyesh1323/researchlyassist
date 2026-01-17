# Researchly Assist

Your AI-Powered Research Companion - A MERN stack application to help you read and understand research papers.

![Researchly Assist](https://img.shields.io/badge/Researchly-Assist-blue)

## Features

- **Firebase Authentication** - Sign in with Google or Email/Password
- **Paper Library** - Upload, view, and manage your research papers
- **PDF Viewer** - Read papers directly in the browser with zoom controls
- **AI-Generated Summaries** - Get instant AI-powered summaries of your papers
- **Smart Chatbot** - Ask questions about your papers with context-aware AI
- **Notes Panel** - Take and save notes while reading, with auto-save

## Tech Stack

### Frontend
- React 19 with TypeScript
- TanStack Router for routing
- Tailwind CSS v4 for styling
- shadcn/ui for UI components
- Axios for API calls
- react-pdf for PDF viewing
- Firebase Auth for authentication

### Backend
- Node.js with Express v5
- MongoDB with Mongoose
- Firebase Admin SDK
- OpenAI API for AI features
- pdf-parse for text extraction

## Prerequisites

- Node.js 18+
- pnpm package manager
- MongoDB (local or Atlas)
- Firebase project
- OpenAI API key

## Setup

### 1. Clone and Install

```bash
cd researchlyassist
pnpm install
```

### 2. Firebase Setup

1. Create a new Firebase project at [Firebase Console](https://console.firebase.google.com)
2. Enable Authentication with Google and Email/Password providers
3. Create a Cloud Storage bucket
4. Download the service account key (Project Settings > Service Accounts > Generate New Private Key)

### 3. Environment Variables

Create `server/.env`:

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/researchly-assist
OPENAI_API_KEY=your_openai_api_key

# Firebase Admin SDK
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your_project_id.iam.gserviceaccount.com
FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
```

Create `client/.env`:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

### 4. Configure Firebase Storage CORS

Create a `cors.json` file:

```json
[
  {
    "origin": ["http://localhost:3000"],
    "method": ["GET"],
    "maxAgeSeconds": 3600
  }
]
```

Apply it using gsutil:

```bash
gsutil cors set cors.json gs://your_project_id.appspot.com
```

### 5. Run the Application

```bash
# Run both frontend and backend
pnpm dev

# Or run separately
pnpm dev:server  # Backend on port 5000
pnpm dev:client  # Frontend on port 3000
```

## Project Structure

```
researchlyassist/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/    # UI components
│   │   ├── contexts/      # React contexts
│   │   ├── lib/           # Utilities and API
│   │   └── routes/        # TanStack Router pages
│   └── package.json
├── server/                 # Express backend
│   ├── src/
│   │   ├── config/        # Firebase config
│   │   ├── middleware/    # Auth middleware
│   │   ├── models/        # Mongoose models
│   │   └── routes/        # API routes
│   └── package.json
├── package.json           # Workspace root
└── pnpm-workspace.yaml
```

## API Endpoints

### Papers
- `GET /api/papers` - Get all papers for authenticated user
- `GET /api/papers/:id` - Get a specific paper
- `POST /api/papers/upload` - Upload a new paper
- `DELETE /api/papers/:id` - Delete a paper

### AI
- `POST /api/ai/summary/:paperId` - Generate AI summary
- `POST /api/ai/chat/:paperId` - Chat about a paper

### Notes
- `GET /api/notes/:paperId` - Get notes for a paper
- `PUT /api/notes/:paperId` - Update notes

## License

MIT
