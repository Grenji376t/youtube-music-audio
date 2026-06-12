# English Audio Package Generator for YouTube Music

This project is a premium utility to convert scanned English textbook images or text input into structured text, parse it into vocabulary lists or article segments, convert them to natural-sounding speech using neural TTS engines, merge the speech files with custom interval pauses, and output an MP3 ready for personal upload to YouTube Music.

---

## Technical Stack

1. **Backend**:
   - **Framework**: Python FastAPI (In-memory database for local execution simplicity, async architecture)
   - **OCR Engine**: Interface built for `EasyOCR` or `Pytesseract` with dynamic mock fallback for ease of offline run and development.
   - **Text Parser**: Regex-based parsing with built-in OCR character correction (e.g. `l.` -> `1.`, `i.` -> `4.`).
   - **TTS**: `edge-tts` (Uses Microsoft Edge's free Neural TTS service, supporting diverse high-quality localized voices and speed controls).
   - **Audio Merger**: `Pydub` (requires FFmpeg) for exact stitching and custom silence interval injections.

2. **Frontend**:
   - **Framework**: React + Vite (Vanilla CSS)
   - **Aesthetics**: Premium Dark Theme, glassmorphism cards, responsive sidebar layouts, interactive steps indicators, and a structured table editor for correction before audio generation.
   - **Deployment**: Configured to deploy instantly onto **Firebase Hosting**.

---

## Project Structure

```
youtube-music-audio/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── models.py
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── ocr_service.py
│   │   │   ├── parse_service.py
│   │   │   ├── tts_service.py
│   │   │   └── audio_service.py
│   │   └── utils/
│   ├── tests/
│   │   ├── __init__.py
│   │   └── test_services.py
│   ├── requirements.txt
│   ├── .env
│   └── run.py
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── JobDetails.jsx
│   │   │   ├── JobList.jsx
│   │   │   ├── NewJobForm.jsx
│   │   │   └── YTMInstruction.jsx
│   │   ├── App.jsx
│   │   ├── App.css
│   │   ├── index.css
│   │   └── main.jsx
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json
│   ├── firebase.json
│   └── .firebaserc
└── README.md
```

---

## Getting Started

### Prerequisites
- Python 3.10+
- Node.js 18+
- FFmpeg (required by `pydub` for audio merging)
  - *Mac*: `brew install ffmpeg`
  - *Windows*: Download from ffmpeg.org and add the `bin` directory to system Environment variables.

---

### Step 1: Run the Backend
Navigate to the `backend/` folder and setup:
```bash
cd backend
pip install -r requirements.txt
python run.py
```
The server will start on `http://127.0.0.1:8000`.

---

### Step 2: Run the Frontend (Development)
Navigate to the `frontend/` folder, install dependencies, and run:
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:3000` to interact with the GUI.

---

### Step 3: Run Tests
To run unit and parser validation tests:
```bash
cd backend
pytest
```

---

## Deployment to GitHub Pages

This project is configured with a GitHub Actions workflow to automatically build and deploy the React frontend to GitHub Pages.

### Automated Deployment (Recommended)
1. Push the project to a GitHub repository.
2. In your GitHub repository settings under **Settings** -> **Actions** -> **General** -> **Workflow permissions**, make sure **Read and write permissions** is selected (required for the action to publish to `gh-pages` branch).
3. Push changes to the `main` or `master` branch. The action will build the frontend and publish the output to the `gh-pages` branch.
4. Go to **Settings** -> **Pages** -> **Build and deployment** -> **Branch** and select `gh-pages` with `/ (root)` folder.

### Manual Deployment
If you wish to deploy manually:
1. Build the production assets:
   ```bash
   cd frontend
   npm run build
   ```
2. Deploy the `frontend/dist` directory to your hosting provider of choice.

