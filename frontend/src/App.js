import { useState, useEffect, useCallback, useRef } from "react";
import "@/App.css";
import axios from "axios";

const getApi = () => `${process.env.REACT_APP_BACKEND_URL || window.location.origin}/api`;
const LOGO_URL = "/file_00000000bda8720ca0c882cfd8b505ab.png";


// ═══════════════════════════════════════════════════════════════════
// WELCOME PAGE
// ═══════════════════════════════════════════════════════════════════
function WelcomePage({ onEnter }) {
  const API = getApi();
  const [hasVideo, setHasVideo] = useState(false);
  const [videoSrc, setVideoSrc] = useState("");
  useEffect(() => {
    let cancelled = false;
    axios.head(`${API}/welcome-video`).then(() => {
      if (!cancelled) { setHasVideo(true); setVideoSrc(`${API}/welcome-video`); }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [API]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4" style={{ backgroundColor: "#0A0A0A" }}
         data-testid="welcome-page">

      {/* Logo */}
      <img src={LOGO_URL} alt="Naughty Dawgz" className="w-full max-w-lg mb-6" data-testid="welcome-logo" />

     
      {/* Video */}
{hasVideo && <div className="w-full max-w-lg mb-8">
  <video
    src={videoSrc}
    autoPlay
    muted
    controls
    playsInline
    loop
    className="w-full border-2 border-yellow-500 shadow-lg"
    style={{ boxShadow: "0 0 30px rgba(255,215,0,0.3)" }}
    data-testid="welcome-video"
  />
</div>}

      {/* Enter Button */}
      <button onClick={onEnter}
              className="neo-button px-12 py-4 text-xl font-black uppercase tracking-widest border-2 pulse-glow"
              style={{ backgroundColor: "#FFD700", color: "#0A0A0A", borderColor: "#FFD700" }}
              data-testid="enter-button">
        ENTER
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════
function MainApp() {
  const [subjectFiles, setSubjectFiles] = useState([]);
  const [audioFile, setAudioFile] = useState(null);
  const [subject, setSubject] = useState("");
  const [clothing, setClothing] = useState("");
  const [actions, setActions] = useState("");
  const [mood, setMood] = useState("Party");
  const [dance, setDance] = useState("Cabbage patch");
  const [audioPreview, setAudioPreview] = useState("");
  const [audioStart, setAudioStart] = useState(0);
  const [audioLength, setAudioLength] = useState(0);
  const audioPlayer = useRef(null);
  useEffect(() => () => { if (audioPreview) URL.revokeObjectURL(audioPreview); }, [audioPreview]);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [videos, setVideos] = useState([]);
  const [currentVideo, setCurrentVideo] = useState(null);
  const [statusMsg, setStatusMsg] = useState("");

  const API = getApi();
  const pollTimer = useRef(null);
  const duration = 3;
  const [aspectRatio, setAspectRatio] = useState("16:9");
  useEffect(() => () => clearTimeout(pollTimer.current), []);

  const loadVideos = useCallback(async () => {
    try { const r = await axios.get(`${API}/videos`); setVideos(Array.isArray(r.data) ? r.data : []); } catch (e) { console.error(e); }
  }, [API]);

  useEffect(() => { loadVideos(); }, [loadVideos]);

  const handleSubjectUpload = async (e) => {
    const files = Array.from(e.target.files).slice(0, 1);
    if (!files.length) return;
    setUploading(true); setStatusMsg("Uploading...");
    try {
      const uploaded = [];
      for (const file of files) {
        const fd = new FormData(); fd.append("file", file);
        const mt = "image";
        const r = await axios.post(`${API}/upload-media?media_type=${mt}`, fd);
        uploaded.push(r.data);
      }
      setSubjectFiles(uploaded); setStatusMsg("");
    } catch (e) { setStatusMsg(e.response?.data?.detail || "Upload failed. Please try again."); } finally { setUploading(false); }
  };

  const handleAudioUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) { setStatusMsg("Choose a song under 50 MB."); return; }
    setUploading(true); setStatusMsg("Uploading audio...");
    try {
      const fd = new FormData(); fd.append("file", file);
      const r = await axios.post(`${API}/upload-media?media_type=audio`, fd, { timeout: 120000 });
      setAudioFile(r.data); setAudioPreview(URL.createObjectURL(file)); setAudioStart(0); setAudioLength(0); setStatusMsg("");
    } catch (e) { setStatusMsg(e.response?.data?.detail || "Audio upload failed. Please try again."); } finally { setUploading(false); }
  };

  const buildPrompt = () => {
    let p = subject.trim() || "The subject";
    if (clothing.trim()) p += `. Wearing ${clothing.trim()}`;
    p += `. Mood: ${mood}. Perform the ${dance === "Custom" ? actions.trim() : dance} dance`;
    if (dance !== "Custom" && actions.trim()) p += `. ${actions.trim()}`;
    p += ". Preserve the subject’s recognizable features. Show the whole subject dancing with expressive movement.";
    return p;
  };

  const handleGenerate = async () => {
    if (subjectFiles.length === 0) { alert("Upload at least one subject image"); return; }
    if (!audioFile) { setStatusMsg("Choose a song saved on your phone first."); return; }
    setGenerating(true); setCurrentVideo(null);
    try {
      const r = await axios.post(`${API}/generate-video`, {
        subject_media_ids: subjectFiles.map(f => f.id),
        audio_file_id: audioFile?.id || null,
        prompt: buildPrompt(), duration, aspect_ratio: aspectRatio, audio_start_seconds: audioStart
      });
      setCurrentVideo(r.data); pollStatus(r.data.id);
    } catch (e) { alert(e.response?.data?.detail || "Generation failed"); setGenerating(false); }
  };

  const pollStatus = (id) => {
    clearTimeout(pollTimer.current);
    const poll = async () => {
      try {
        const r = await axios.get(`${API}/videos/${id}`);
        setCurrentVideo(r.data);
        if (["completed", "failed"].includes(r.data.status)) {
          setGenerating(false); loadVideos(); return;
        }
        pollTimer.current = setTimeout(poll, 5000);
      } catch (e) {
        setGenerating(false);
        setStatusMsg("Connection interrupted. Select your video in Previous Generations to check it again.");
        loadVideos();
      }
    };
    pollTimer.current = setTimeout(poll, 5000);
  };

  const removeFile = (id) => setSubjectFiles(prev => prev.filter(f => f.id !== id));
  const canGenerate = !generating && !uploading && subjectFiles.length > 0 && audioFile && (dance !== "Custom" || actions.trim());

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0A0A0A" }}>
      {/* Header */}
      <div className="p-4 md:p-8 text-center">
        <h1 className="text-4xl md:text-6xl font-black gold-text mb-2" data-testid="app-logo">Naughty Dawgs</h1>
        <p className="text-sm md:text-base max-w-xl mx-auto" style={{ color: "#999" }}>
          Upload anything. Add music. Describe the drip. Watch AI make it dance.
        </p>
      </div>

      <div className="px-4 md:px-8 pb-16 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* LEFT COLUMN */}
          <div className="space-y-4">

            {/* Subject Upload */}
            <div className="neo-card p-4 md:p-5" data-testid="subject-upload-section">
              <h3 className="text-lg md:text-xl font-bold tracking-tight mb-2 gold-text">1. DROP YOUR SUBJECT</h3>
              <label className="upload-zone block p-6 text-center cursor-pointer">
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleSubjectUpload}
                       className="hidden" disabled={uploading || generating} data-testid="subject-file-input" />
                <div className="text-sm font-bold uppercase gold-text">{uploading ? "UPLOADING..." : "TAP TO UPLOAD"}</div>
                <div className="text-xs mt-1" style={{ color: "#888" }}>Dogs, humans, aliens, washing machines</div>
              </label>
              {subjectFiles.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2" data-testid="uploaded-subjects">
                  {subjectFiles.map(f => (
                    <div key={f.id} className="relative">
                      <img src={`${API}/files/${f.id}`} alt="" className="media-preview" />
                      <button onClick={() => removeFile(f.id)}
                              className="absolute -top-1 -right-1 bg-red-600 text-white w-5 h-5 flex items-center justify-center border border-red-800 text-xs font-bold rounded-full"
                              data-testid={`remove-subject-${f.id}`}>x</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Music */}
            <div className="neo-card p-4 md:p-5" data-testid="audio-upload-section">
              <h3 className="text-lg md:text-xl font-bold tracking-tight mb-2 gold-text">2. PICK YOUR MUSIC</h3>

              {/* Primary: Upload audio file */}
              <label className="upload-zone block p-6 text-center cursor-pointer mb-3">
                <input type="file" accept="audio/*" onChange={handleAudioUpload} className="hidden" disabled={uploading || generating}
                       data-testid="audio-file-input" />
                <div className="text-sm font-bold uppercase gold-text">{audioFile ? audioFile.original_filename : "CHOOSE A SONG FROM YOUR PHONE"}</div>
                <div className="text-xs mt-1" style={{ color: "#888" }}>MP3, M4A, WAV, or other audio from your phone</div>
              </label>

               {/* Secondary: Mobiles24 ringtone downloads */}
<div className="text-center mt-4">
  <div
    className="text-center text-xs font-bold mb-2"
    style={{ color: "#666" }}
  >
    OR FIND A RINGTONE
  </div>

  <a
    href="https://www.mobiles24.co/"
    target="_blank"
    rel="noopener noreferrer"
    className="inline-block w-full px-4 py-3 text-sm font-black uppercase border-2 border-yellow-500"
    style={{
      backgroundColor: "#FFD700",
      color: "#0A0A0A",
      textDecoration: "none"
    }}
  >
    BROWSE MOBILES24 RINGTONES
  </a>

  <div
    className="text-center text-xs mt-2"
    style={{ color: "#666" }}
  >
    Download a ringtone to your phone, then return here and upload it above.
  </div>
</div> 

              {audioPreview && <div className="mt-3">
                <audio ref={audioPlayer} controls src={audioPreview} className="w-full"
                  onLoadedMetadata={e => setAudioLength(Number.isFinite(e.target.duration) ? e.target.duration : 0)} />
                <label className="block gold-text text-sm mt-3" htmlFor="song-start">Start song at {audioStart.toFixed(1)} seconds</label>
                <input id="song-start" type="range" min="0" max={Math.max(0, audioLength - 3)} step="0.1" value={audioStart}
                  disabled={generating} className="w-full" onChange={e => { const t = Number(e.target.value); setAudioStart(t); if (audioPlayer.current) audioPlayer.current.currentTime = t; }} />
                <p className="text-xs text-gray-400">Pick a 3-second section. Choose an audio file saved on your device; offline downloads inside streaming apps may not appear here.</p>
              </div>}
              {audioFile && (
                <div className="mt-2 p-2 border border-green-700 text-xs font-bold" style={{ backgroundColor: "rgba(0,128,0,0.15)", color: "#4ADE80" }}
                     data-testid="audio-loaded">
                  LOADED: {audioFile.original_filename}
                </div>
              )}
            </div>

            {/* Prompt Builder */}
            <div className="neo-card p-4 md:p-5" data-testid="prompt-section">
              <h3 className="text-lg md:text-xl font-bold tracking-tight mb-2 gold-text">3. DESCRIBE THE VIBE</h3>

              <label htmlFor="subject" className="block text-xs font-bold uppercase mb-1 gold-text">Who / What?</label>
              <input id="subject" type="text" maxLength={500} value={subject} onChange={e => setSubject(e.target.value)}
                     placeholder="Three pit bulls, a washing machine, two aliens..."
                     className="w-full px-3 py-2 text-sm border-2 border-gray-600 focus:border-yellow-500 focus:outline-none mb-3 bg-black text-white"
                     disabled={generating} data-testid="subject-input" />

              <label htmlFor="clothing" className="block text-xs font-bold uppercase mb-1 gold-text">Clothing / Jewelry / Grills</label>
              <input id="clothing" type="text" maxLength={500} value={clothing} onChange={e => setClothing(e.target.value)}
                     placeholder="Baggy jeans, Alabama jerseys, iced out chains, platinum grills..."
                     className="w-full px-3 py-2 text-sm border-2 border-gray-600 focus:border-yellow-500 focus:outline-none mb-3 bg-black text-white"
                     disabled={generating} data-testid="clothing-input" />

              <label className="block gold-text text-sm mb-3">Mood / Vibe
                <select aria-label="Mood" value={mood} disabled={generating} onChange={e => setMood(e.target.value)} className="block w-full p-2 bg-black text-white border border-gray-600">
                  {["Party", "Funny", "Confident", "Chill", "Energetic", "Dramatic"].map(v => <option key={v}>{v}</option>)}
                </select>
              </label>
              <label className="block gold-text text-sm mb-3">Choose your dance
                <select aria-label="Dance" value={dance} disabled={generating} onChange={e => setDance(e.target.value)} className="block w-full p-2 bg-black text-white border border-gray-600">
                  {["Cabbage patch", "Dougie", "Crip walk", "Moonwalk", "Freestyle", "Custom"].map(v => <option key={v}>{v}</option>)}
                </select>
              </label>
              <label htmlFor="dance-details" className="block text-xs font-bold uppercase mb-1 gold-text">Extra dance details {dance === "Custom" ? "(required)" : "(optional)"}</label>
              <textarea id="dance-details" maxLength={1000} value={actions} onChange={e => setActions(e.target.value)}
                        placeholder="Grunge dancing with beer in one hand and blunt in the other..."
                        className="w-full px-3 py-2 text-sm border-2 border-gray-600 focus:border-yellow-500 focus:outline-none bg-black text-white"
                        style={{ minHeight: "70px" }} disabled={generating} data-testid="actions-input" />
            </div>

            <div className="neo-card p-4 flex flex-wrap gap-4">
              <p className="gold-text text-sm">3-second dance video</p>
              <p className="text-xs text-gray-400">Video follows your photo’s shape. Shared AI has daily limits and queues.</p>
            </div>
            {/* Generate */}
            <button onClick={handleGenerate} disabled={!canGenerate}
                    className="neo-button w-full px-6 py-4 text-lg font-black uppercase tracking-wide border-2"
                    style={{ backgroundColor: canGenerate ? "#FFD700" : "#333", color: "#0A0A0A",
                             borderColor: "#FFD700", boxShadow: "4px 4px 0 #333",
                             cursor: canGenerate ? "pointer" : "not-allowed" }}
                    data-testid="generate-button">
              {generating ? "GENERATING..." : "GENERATE 3-SECOND VIDEO"}
            </button>
            {statusMsg && <p className="text-center text-xs font-bold gold-text" role="status" data-testid="status-msg">{statusMsg}</p>}
          </div>

          {/* RIGHT COLUMN */}
          <div>
            <div className="neo-card p-4 md:p-5" data-testid="video-preview-section">
              <h3 className="text-lg md:text-xl font-bold tracking-tight mb-3 gold-text">VIDEO PREVIEW</h3>

              {!currentVideo && (
                <div className="p-8 border-2 border-dashed border-gray-600 text-center" data-testid="empty-preview">
                  <p className="text-sm font-bold uppercase" style={{ color: "#666" }}>YOUR VIDEO WILL APPEAR HERE</p>
                </div>
              )}

              {currentVideo && ["uploading_to_1min", "generating", "adding_music", "saving"].includes(currentVideo.status) && (
                <div className="p-8 border-2 border-yellow-500 text-center" style={{ backgroundColor: "rgba(255,215,0,0.08)" }}
                     data-testid="generating-status">
                  <div className="overflow-hidden">
                    <div className="marquee text-base font-bold uppercase gold-text">
                      {currentVideo.status === "generating" ? "Animating your dance" : currentVideo.status.replaceAll("_", " ")}
                    </div>
                  </div>
                  <p className="mt-3 text-xs" style={{ color: "#999" }}>Your dance is being animated, then combined with your song. This may take several minutes.</p>
                </div>
              )}

              {currentVideo && currentVideo.status === "pending" && (
                <div className="p-8 border-2 border-yellow-500 text-center" data-testid="pending-status">
                  <p className="text-base font-bold uppercase gold-text">QUEUED...</p>
                </div>
              )}

              {currentVideo && currentVideo.status === "completed" && (
                <div data-testid="completed-video">
                  <video controls className="video-player" src={`${API}/videos/${currentVideo.id}/content`} data-testid="video-player" />
                  <a className="inline-block mt-3 gold-text underline" href={`${API}/videos/${currentVideo.id}/content`} target="_blank" rel="noopener noreferrer">Open video to save ↗</a>
                  <div className="mt-3 p-3 border border-green-700" style={{ backgroundColor: "rgba(0,128,0,0.15)" }}>
                    <p className="font-bold text-sm" style={{ color: "#4ADE80" }}>VIDEO COMPLETE!</p>
                    <p className="text-xs mt-1" style={{ color: "#999" }}>{currentVideo.prompt}</p>
                  </div>
                </div>
              )}

              {currentVideo && currentVideo.status === "failed" && (
                <div className="p-6 border-2 border-red-600 text-center" style={{ backgroundColor: "rgba(255,0,0,0.08)" }}
                     data-testid="failed-status">
                  <p className="font-bold text-base text-red-400">GENERATION FAILED</p>
                  <p className="text-xs mt-2" style={{ color: "#999" }}>{currentVideo.error_message || "Something went wrong"}</p>
                </div>
              )}
            </div>

            {/* History */}
            {videos.length > 0 && (
              <div className="mt-4 neo-card p-4" data-testid="previous-videos">
                <h4 className="text-base font-bold mb-3 gold-text">PREVIOUS GENERATIONS</h4>
                <div className="space-y-2">
                  {videos.slice(0, 8).map(v => (
                    <div key={v.id} className="p-2 border border-gray-700 cursor-pointer hover:border-yellow-500 transition-colors"
                         onClick={() => { clearTimeout(pollTimer.current); setCurrentVideo(v); const active = !["completed", "failed"].includes(v.status); setGenerating(active); if (active) pollStatus(v.id); }} data-testid={`video-history-${v.id}`}>
                      <div className="flex justify-between items-start">
                        <p className="text-xs flex-1" style={{ color: "#CCC" }}>{v.prompt.substring(0, 50)}...</p>
                        <span className="px-2 py-0.5 text-xs font-bold ml-2"
                              style={{ backgroundColor: v.status === "completed" ? "rgba(0,128,0,0.3)" : v.status === "failed" ? "rgba(255,0,0,0.3)" : "rgba(255,215,0,0.3)",
                                       color: v.status === "completed" ? "#4ADE80" : v.status === "failed" ? "#F87171" : "#FFD700" }}>
                          {v.status.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// APP (Router)
// ═══════════════════════════════════════════════════════════════════
function App() {
  const [entered, setEntered] = useState(false);

  if (!entered) {
    return <WelcomePage onEnter={() => setEntered(true)} />;
  }

  return <MainApp />;
}

export default App;
