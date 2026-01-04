# 📺 YT-Bot: YouTube Video Q&A App

![Project Status](https://img.shields.io/badge/status-active-success.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Built With Next.js](https://img.shields.io/badge/Built%20With-Next.js-000000.svg?logo=next.js)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwind-css&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-3982CE?style=for-the-badge&logo=Prisma&logoColor=white)
![NeonDB](https://img.shields.io/badge/NeonDB-00C8C8?style=for-the-badge&logo=postgresql&logoColor=white)
![JWT](https://img.shields.io/badge/Authentication-JWT-red.svg)
![Google Gemini](https://img.shields.io/badge/Google_Gemini-4285F4?style=for-the-badge&logo=google&logoColor=white)
![AssemblyAI](https://img.shields.io/badge/Speech_to_Text-AssemblyAI-green.svg)

## ✨ Overview

YT-Bot is a powerful Next.js 14 application that revolutionizes how you interact with YouTube video content. It allows users to submit YouTube video URLs and then leverage the cutting-edge Gemini 2.0 Flash API to ask intelligent questions about the video's content. Utilizing Retrieval Augmented Generation (RAG), the app extracts transcripts, generates embeddings, and performs vector similarity searches to provide accurate and context-aware answers.

## 🚀 Features

*   **Intelligent Q&A:** Ask natural language questions about any YouTube video and get precise answers powered by Gemini 2.0 Flash.
*   **Robust Transcript Generation:** Automatically fetches YouTube video transcripts. If no transcript is available, it uses AssemblyAI to convert the video's audio to text.
*   **Semantic Search:** Chunks and embeds transcripts, enabling vector similarity search for highly relevant content retrieval.
*   **User Authentication:** Secure user management powered by JWT (JSON Web Tokens) for seamless sign-up and sign-in.
*   **Video Management:** Easily add, view details, and delete your submitted YouTube videos.
*   **Question History:** Keep track of all your questions and their corresponding AI-generated answers for each video.
*   **Rate Limiting:** Implements rate limiting to ensure efficient API usage and stay within free tier limits.

## 🛠️ Tech Stack

*   **Frontend:** Next.js 14 (App Router), React, TypeScript, Tailwind CSS
*   **Backend:** Next.js API Routes
*   **Database:** NeonDB (PostgreSQL with `pg_vector` extension)
*   **ORM:** Prisma
*   **Authentication:** JWT (JSON Web Tokens)
*   **AI/LLM:** Google Gemini 2.0 Flash API
*   **Embeddings:** Google Gemini `text-embedding-001`
*   **Speech-to-Text:** AssemblyAI
*   **Video Processing:** `@langchain/community/document_loaders/web/youtube` for video metadata and transcript loading.

## ⚙️ Setup Instructions

Follow these steps to get your YT-Bot application up and running locally.

### Prerequisites

Before you begin, ensure you have the following installed:

*   [Node.js](https://nodejs.org/en/) (v18 or higher)
*   [npm](https://www.npmjs.com/) (comes with Node.js)
*   A [NeonDB](https://neon.tech/) account (or access to any PostgreSQL database with the `pg_vector` extension enabled).
*   A [Google AI Studio](https://aistudio.google.com/) account to obtain your Gemini API Key.
*   An [AssemblyAI](https://www.assemblyai.com/) account to obtain your AssemblyAI API Key.

### Environment Variables

Create a `.env` file in the root of your project directory and populate it with the following variables:

```env
# Database Connection String (from NeonDB or your PostgreSQL provider)
DATABASE_URL="postgresql://user:password@host:port/database?schema=public"

# Google Gemini API Key (from Google AI Studio)
GOOGLE_API_KEY="your-google-gemini-api-key"

# AssemblyAI API Key (from AssemblyAI dashboard)
ASSEMBLYAI_API_KEY="your-assemblyai-api-key"

# JWT Secret for token signing (generate a strong, random string)
JWT_SECRET="your-super-secret-jwt-key"
```

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/yourusername/yt-bot.git
    cd yt-bot
    ```
    *(Replace `yourusername/yt-bot.git` with your actual repository URL if you've forked it)*

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Set up the database:**
    Ensure your `DATABASE_URL` in `.env` is correct. Then, apply Prisma migrations to set up your database schema:
    ```bash
    npx prisma migrate dev --name create_initial_tables
    ```
    *(If you already have migrations, use `npx prisma migrate deploy`)*

4.  **Run the development server:**
    ```bash
    npm run dev
    ```

5.  **Access the application:**
    Open your web browser and navigate to [http://localhost:3000](http://localhost:3000).

## 💡 How to Use

1.  **Sign Up / Sign In:** Register for a new account or log in using your JWT-based authentication.
2.  **Add a YouTube Video:** On the dashboard, paste a YouTube video URL into the input field and submit it.
3.  **Processing:** The application will process the video, extracting its transcript (or generating one via AssemblyAI) and generating embeddings. This might take a moment depending on the video length.
4.  **Ask Questions:** Once processed, navigate to the video's detail page. You can now ask questions about the video content in the provided text area.
5.  **View Answers & History:** The AI's answer will appear, and your question will be added to the question history for easy reference.
## 📂 Project Structure

```text
.
├── prisma/                  # Prisma schema and migrations
├── public/                  # Static assets
├── src/
│   ├── app/                 # Next.js App Router (pages, layouts, API routes)
│   │   ├── (auth)/          # Authentication routes (sign-in, sign-up)
│   │   ├── (main)/          # Main application routes (dashboard, video details)
│   │   ├── api/             # Backend API routes
│   │   ├── favicon.ico
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/          # Reusable React components
│   │   └── AddVideoForm.tsx
│   ├── lib/                 # Utility functions and libraries
│   │   ├── auth.ts          # Authentication helpers (JWT related)
│   │   ├── db.ts            # Prisma database client
│   │   ├── gemini.ts        # Gemini API integration
│   │   └── youtube.ts       # YouTube video processing (including AssemblyAI integration)
│   ├── middleware.ts        # Next.js middleware
│   └── types/               # TypeScript custom types
├── .env                     # Environment variables (local)
├── .gitignore
├── next.config.ts
├── package.json
├── tsconfig.json
└── README.md                # This file
```

## 🤝 Contributing

Contributions are welcome! If you have suggestions for improvements or new features, please feel free to:

1.  Fork the repository.
2.  Create a new branch (`git checkout -b feature/your-feature-name`).
3.  Make your changes.
4.  Commit your changes (`git commit -m 'feat: Add new feature'`).
5.  Push to the branch (`git push origin feature/your-feature-name`).
6.  Open a Pull Request.
