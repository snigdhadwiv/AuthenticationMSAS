# Multimodal Step-Up Authentication System (MSAS)

A zero-trust FinTech security architecture that dynamically triggers multimodal biometric challenges for high-risk transactions. This system fuses **Active Liveness Detection**, **Voice Biometrics**, and **Speech Recognition** to prevent unauthorized access and deepfake spoofing.

## 🚀 Key Features

* **Dynamic Risk Engine:** Evaluates transactions based on 5 signals (Amount, Time, Payee, Device Velocity, Location) to determine if a biometric challenge is required.
* **Active 3D Liveness Detection:** Uses MediaPipe FaceMesh to calculate dynamic head poses (Yaw/Pitch) to ensure the user is physically present, thwarting passive photo/video playback attacks.
* **True Voice Biometrics (Speaker Verification):** Extracts Mel-Frequency Cepstral Coefficients (MFCCs) using `librosa` to generate a mathematical voiceprint, ensuring the speaker matches the enrolled profile via Cosine Similarity.
* **Speech-to-Text Validation:** Uses a hybrid approach of Real-Time Web Speech API (for karaoke-style UI feedback) and backend OpenAI Whisper ASR to verify the spoken One-Time Code.
* **AI Decision Fusion Engine:** Google Gemini evaluates the biometric signals. Features a graceful degradation architecture that falls back to local deterministic rules if the LLM API is unavailable.
* **Admin Dashboard & Audit Trail:** Complete review queue for escalated transactions and tamper-evident audit logs.

## 🛠️ Technology Stack

* **Frontend:** Next.js 16 (App Router), React, Tailwind CSS v4, MediaPipe FaceMesh, Web Speech API.
* **Backend:** Django, Django REST Framework, SimpleJWT.
* **Machine Learning / AI:** OpenAI Whisper, Google Gemini, Librosa, SciPy.
* **Database:** SQLite (dev fallback) / PostgreSQL (production).

## ⚙️ Local Setup & Installation

### 1. Backend (Django + ML)
```bash
# Navigate to the backend directory
cd backend

# Create and activate a virtual environment
python -m venv venv
.\venv\Scripts\activate   # Windows

# Install dependencies
pip install django djangorestframework djangorestframework-simplejwt django-cors-headers
pip install torch openai-whisper imageio-ffmpeg google-genai librosa scipy python-dotenv

# Run database migrations
python manage.py migrate

# Create default users (Optional)
python setup_users.py

# Start the server (runs on port 8000)
python manage.py runserver
```

### 2. Frontend (Next.js)
```bash
# Navigate to the frontend directory
cd frontend

# Install Node modules
npm install

# Start the development server (runs on port 3000)
npm run dev
```

## 🔐 Demo Credentials

If you ran `python setup_users.py`, you can log in with:
* **Admin Account:** Username: `admin` | Password: `admin`
* **User Account:** Username: `user` | Password: `user`

## 📖 How to Demo
1. Log in as **User** and navigate to the Dashboard.
2. You will be prompted to **Enroll Voice Biometrics**. Click Enroll and read the phrase.
3. Initiate a **New Transaction** with a large amount (e.g., ₹85,000) to trigger a high risk score.
4. Complete the Biometric Challenge by turning your head as instructed and speaking the One-Time Code.
5. Log in as **Admin** to view the Audit Trail and approve/reject escalated transactions.

---
*Developed as a Final Year Major Project.*
