'use client';

import { useState, useCallback } from 'react';
import axios from 'axios';
import { UploadCloud, Loader2 } from 'lucide-react';
import LessonPlayer from '@/components/LessonPlayer';
import { LessonData } from '@/types/lesson';

// Ensure API_URL falls back gracefully, or matches exactly what docker sets
const API_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [gameId, setGameId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [storyboard, setStoryboard] = useState<LessonData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const f = e.dataTransfer.files[0];
      if (f.name.endsWith('.sgf')) {
        setFile(f);
      } else {
        setError("Only .sgf files are supported.");
      }
    }
  }, []);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await axios.post(`${API_URL}/v1/games`, formData);
      setGameId(res.data.game_id);
      setJobId(res.data.job_id);
      pollJob(res.data.job_id, res.data.game_id);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Upload failed");
      setUploading(false);
    }
  };

  const pollJob = (jId: string, gId: string) => {
    const interval = setInterval(async () => {
      try {
        const res = await axios.get(`${API_URL}/v1/jobs/${jId}`);
        setProgress(res.data.progress);
        setMessage(res.data.message);

        if (res.data.status === 'done') {
          clearInterval(interval);
          setUploading(false);
          fetchLesson(gId);
        } else if (res.data.status === 'error') {
          clearInterval(interval);
          setUploading(false);
          setError(res.data.message);
        }
      } catch (err) {
        // keep polling or handle error
        console.error("Polling error", err);
      }
    }, 2000);
  };

  const fetchLesson = async (gId: string) => {
    try {
      const res = await axios.get(`${API_URL}/v1/games/${gId}/lesson`);
      // res.data.storyboard_url points to JSON in MinIO (public)
      // fetch the actual JSON
      const sbRes = await axios.get(res.data.storyboard_url);
      setStoryboard(sbRes.data);
    } catch (err) {
      setError("Failed to load lesson storyboard.");
    }
  };

  if (storyboard && gameId) {
    return (
      <main className="min-h-screen bg-slate-100 p-4 md:p-8">
        <header className="max-w-5xl mx-auto mb-8 flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight text-slate-800">Atmos <span className="text-blue-600 font-light">Go Lessons</span></h1>
          <button
            onClick={() => { setStoryboard(null); setFile(null); }}
            className="text-sm border border-slate-300 px-4 py-2 rounded-lg hover:bg-slate-200 transition"
          >
            New Upload
          </button>
        </header>

        <LessonPlayer storyboard={storyboard} gameId={gameId} />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100">
        <div className="bg-slate-800 p-8 text-center text-white">
          <h1 className="text-2xl font-bold mb-2 tracking-tight">Atmos Go Lesson</h1>
          <p className="text-slate-300 font-light text-sm">Upload a 9x9 SGF to generate an interactive voiced review.</p>
        </div>

        <div className="p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm">
              {error}
            </div>
          )}

          {!uploading && !jobId && (
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className="border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50 transition-colors p-10 rounded-xl flex flex-col items-center justify-center cursor-pointer text-slate-500"
              onClick={() => document.getElementById('file-upload')?.click()}
            >
              <UploadCloud size={48} className="mb-4 text-blue-400" />
              <p className="font-medium text-slate-700">Drag & Drop SGF here</p>
              <p className="text-sm mt-1">or click to browse</p>
              <input
                id="file-upload"
                type="file"
                accept=".sgf"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.length) setFile(e.target.files[0]);
                }}
              />
            </div>
          )}

          {file && !uploading && !jobId && (
            <div className="mt-6 flex justify-between items-center bg-slate-50 p-4 rounded-lg border border-slate-100">
              <span className="text-sm font-medium text-slate-700 truncate mr-4">{file.name}</span>
              <button
                onClick={handleUpload}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition"
              >
                Analyze
              </button>
            </div>
          )}

          {(uploading || jobId) && (
            <div className="mt-4 text-center">
              <div className="flex justify-center mb-6">
                <Loader2 className="animate-spin text-blue-600" size={40} />
              </div>
              <p className="text-lg font-medium text-slate-800 mb-2">{progress}%</p>
              <p className="text-sm text-slate-500 animate-pulse">{message || 'Uploading...'}</p>

              <div className="w-full bg-slate-100 rounded-full h-2.5 mt-6 overflow-hidden">
                <div
                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${Math.max(progress, 5)}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
