import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  Sparkles, Send, Paperclip, PanelLeftClose, PanelLeft, Plus,
  FileText, Image as ImageIcon, Headphones, File, Trash2, Copy,
  Check, ChevronDown, ChevronRight, ExternalLink, RefreshCw,
  Search, Shield, Zap, Info, X, Layers, Cpu, Cloud, UploadCloud,
  Eye, FileCheck, ArrowRight
} from 'lucide-react';

const API_BASE = 'http://127.0.0.1:8000';

export default function App() {
  // Navigation & UI state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeSessionId, setActiveSessionId] = useState('default');
  const [sessions, setSessions] = useState(() => {
    const saved = localStorage.getItem('evidence_sessions');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { }
    }
    return [{
      id: 'default',
      title: 'New Investigation',
      createdAt: new Date().toISOString(),
      messages: []
    }];
  });

  // Chat input & query state
  const [inputQuery, setInputQuery] = useState('');
  const [stagedFile, setStagedFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  // Settings & Models
  const [backend, setBackend] = useState('online'); // 'online' (Groq Cloud) or 'offline' (Ollama Local)
  const [topK, setTopK] = useState(8);
  const [rerankTopK, setRerankTopK] = useState(4);
  const [healthData, setHealthData] = useState(null);

  // Vault & Documents
  const [sources, setSources] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccessMsg, setUploadSuccessMsg] = useState(null);

  // Chunks Inspector Modal
  const [inspectDoc, setInspectDoc] = useState(null);
  const [inspectChunks, setInspectChunks] = useState([]);
  const [loadingChunks, setLoadingChunks] = useState(false);
  const [chunkSearch, setChunkSearch] = useState('');
  const [selectedPageFilter, setSelectedPageFilter] = useState('all');

  // Selected Citation Inspector Modal
  const [activeCitationModal, setActiveCitationModal] = useState(null);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const vaultFileInputRef = useRef(null);
  const textareaRef = useRef(null);

  // Sync sessions with localStorage
  useEffect(() => {
    localStorage.setItem('evidence_sessions', JSON.stringify(sessions));
  }, [sessions]);

  // Load initial health & sources
  useEffect(() => {
    fetchHealth();
    fetchSources();
  }, [backend]);

  // Auto-scroll chat to bottom
  const currentSession = sessions.find(s => s.id === activeSessionId) || sessions[0];
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentSession?.messages, loading]);

  const fetchHealth = async () => {
    try {
      const res = await fetch(`${API_BASE}/health?backend=${backend}`);
      const data = await res.json();
      setHealthData(data);
    } catch (err) {
      console.error('Failed to fetch health status', err);
    }
  };

  const fetchSources = async () => {
    try {
      const res = await fetch(`${API_BASE}/sources`);
      const data = await res.json();
      setSources(data.sources || []);
    } catch (err) {
      console.error('Failed to fetch sources', err);
    }
  };

  const handleCreateNewChat = () => {
    const newSession = {
      id: 'session_' + Date.now(),
      title: 'New Investigation',
      createdAt: new Date().toISOString(),
      messages: []
    };
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    setInputQuery('');
    setStagedFile(null);
    if (textareaRef.current) textareaRef.current.focus();
  };

  const handleDeleteSession = (sessionId, e) => {
    e.stopPropagation();
    if (sessions.length <= 1) {
      handleCreateNewChat();
      return;
    }
    const filtered = sessions.filter(s => s.id !== sessionId);
    setSessions(filtered);
    if (activeSessionId === sessionId) {
      setActiveSessionId(filtered[0].id);
    }
  };

  // Open Document Chunks Inspector
  const handleInspectDocument = async (source) => {
    setInspectDoc(source);
    setLoadingChunks(true);
    setChunkSearch('');
    setSelectedPageFilter('all');
    try {
      const res = await fetch(`${API_BASE}/source/${source.source_id}/chunks`);
      if (res.ok) {
        const data = await res.json();
        setInspectChunks(data.chunks || []);
      } else {
        // Fallback to get_source
        const res2 = await fetch(`${API_BASE}/source/${source.source_id}`);
        const data2 = await res2.json();
        const formatted = (data2.items || []).map((it, idx) => ({
          chunk_id: it.item_id,
          chunk_index: it.metadata?.chunk_index || (idx + 1),
          page: it.location?.page_number || it.metadata?.page || 1,
          section: it.location?.section || '',
          text: it.content,
          char_count: it.content?.length || 0,
        }));
        setInspectChunks(formatted);
      }
    } catch (err) {
      console.error('Failed to load chunks', err);
    } finally {
      setLoadingChunks(false);
    }
  };

  // Delete source from vault
  const handleDeleteSource = async (sourceId, e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this file and all its indexed chunks from the database?')) return;
    try {
      await fetch(`${API_BASE}/source/${sourceId}`, { method: 'DELETE' });
      fetchSources();
      if (inspectDoc?.source_id === sourceId) {
        setInspectDoc(null);
      }
    } catch (err) {
      console.error('Failed to delete source', err);
    }
  };

  // Handle uploading files into vault
  const handleVaultUpload = async (files) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setUploadSuccessMsg(null);
    const formData = new FormData();
    Array.from(files).forEach(f => formData.append('files', f));

    try {
      const res = await fetch(`${API_BASE}/ingest`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      fetchSources();
      const count = data.indexed || 0;
      const totalChunks = (data.results || []).reduce((acc, r) => acc + (r.chunks_count || r.items_indexed || 0), 0);
      setUploadSuccessMsg(`Successfully indexed ${count} file(s) into ${totalChunks} chunks!`);
      setTimeout(() => setUploadSuccessMsg(null), 6000);
    } catch (err) {
      console.error('Upload failed', err);
      alert('Ingestion error: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  // Submit query
  const handleSendMessage = async (textToSend = inputQuery) => {
    const text = textToSend.trim();
    if (!text && !stagedFile) return;

    const userMessage = {
      id: 'msg_' + Date.now(),
      sender: 'user',
      text: text || `Analyze attached file: ${stagedFile?.name}`,
      attachedFile: stagedFile ? { name: stagedFile.name, size: stagedFile.size } : null,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    // Update session messages and set title if first message
    setSessions(prev => prev.map(s => {
      if (s.id === activeSessionId) {
        const isFirst = s.messages.length === 0;
        return {
          ...s,
          title: isFirst ? (text.slice(0, 30) || 'Document Query') : s.title,
          messages: [...s.messages, userMessage],
        };
      }
      return s;
    }));

    setInputQuery('');
    const fileToUpload = stagedFile;
    setStagedFile(null);
    setLoading(true);

    try {
      let data;
      if (fileToUpload) {
        // Query with file directly
        const formData = new FormData();
        formData.append('file', fileToUpload);
        formData.append('instruction', text || 'Summarize this file and list key insights.');
        formData.append('query_modality', fileToUpload.type.startsWith('image/') ? 'image' : fileToUpload.type.startsWith('audio/') ? 'audio' : 'document');
        formData.append('top_k', topK);
        formData.append('rerank_top_k', rerankTopK);
        formData.append('backend', backend);

        const res = await fetch(`${API_BASE}/query_file`, {
          method: 'POST',
          body: formData,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        data = await res.json();
      } else {
        // Text query
        const payload = {
          query: text,
          top_k: Number(topK),
          rerank_top_k: Number(rerankTopK),
          inference_mode: 'local',
          query_modality: 'text',
        };
        const res = await fetch(`${API_BASE}/query?backend=${backend}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        data = await res.json();
      }

      const assistantMessage = {
        id: 'msg_ai_' + Date.now(),
        sender: 'assistant',
        text: data.answer || 'No response generated.',
        citations: data.citations || [],
        retrieved_items: data.retrieved_items || [],
        confidence: data.confidence,
        latency_ms: data.latency_ms || {},
        abstained: data.abstained,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setSessions(prev => prev.map(s => {
        if (s.id === activeSessionId) {
          return {
            ...s,
            messages: [...s.messages, assistantMessage],
          };
        }
        return s;
      }));

      // Refresh sources if a file was ingested
      if (fileToUpload) fetchSources();
    } catch (err) {
      console.error('Query error:', err);
      const errorMessage = {
        id: 'msg_err_' + Date.now(),
        sender: 'assistant',
        text: `⚠️ **Processing Error**: Could not complete query. \n\n*Details*: ${err.message}`,
        isError: true,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setSessions(prev => prev.map(s => {
        if (s.id === activeSessionId) {
          return { ...s, messages: [...s.messages, errorMessage] };
        }
        return s;
      }));
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Get file type icon and color
  const getFileIcon = (filename) => {
    const ext = filename?.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return <FileText className="w-4 h-4 text-rose-400" />;
    if (['doc', 'docx'].includes(ext)) return <FileText className="w-4 h-4 text-blue-400" />;
    if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) return <ImageIcon className="w-4 h-4 text-emerald-400" />;
    if (['mp3', 'wav', 'ogg'].includes(ext)) return <Headphones className="w-4 h-4 text-purple-400" />;
    return <File className="w-4 h-4 text-slate-400" />;
  };

  // Filter chunks in inspector
  const filteredChunks = inspectChunks.filter(c => {
    const matchesSearch = !chunkSearch || c.text?.toLowerCase().includes(chunkSearch.toLowerCase());
    const matchesPage = selectedPageFilter === 'all' || String(c.page) === String(selectedPageFilter);
    return matchesSearch && matchesPage;
  });

  const availablePages = Array.from(new Set(inspectChunks.map(c => c.page))).sort((a, b) => a - b);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#080a11] text-slate-100 font-sans antialiased">
      {/* ------------------------------------------------------------- SIDEBAR */}
      <aside
        className={`flex flex-col border-r border-white/10 bg-[#06070c] transition-all duration-300 ease-in-out z-20 ${
          sidebarOpen ? 'w-80 min-w-[20rem]' : 'w-0 -translate-x-full overflow-hidden'
        }`}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="font-bold text-sm tracking-wide bg-gradient-to-r from-white via-slate-200 to-cyan-400 bg-clip-text text-transparent font-['Outfit']">
                Evidence AI
              </div>
              <div className="text-[10px] text-slate-400 flex items-center gap-1.5 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Grounded RAG v2.4
              </div>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-1.5 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition"
            title="Collapse Sidebar"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>

        {/* New Chat Button */}
        <div className="p-3">
          <button
            onClick={handleCreateNewChat}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500/15 via-blue-500/10 to-transparent hover:from-cyan-500/25 hover:via-blue-500/20 border border-cyan-500/30 hover:border-cyan-400/50 text-cyan-300 hover:text-white font-medium text-xs tracking-wide transition shadow-sm"
          >
            <Plus className="w-4 h-4 text-cyan-400" />
            <span>New Investigation</span>
          </button>
        </div>

        {/* Knowledge Vault / Uploaded Documents Section */}
        <div className="px-3 py-2 flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex items-center justify-between px-2 pb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
            <span className="flex items-center gap-1.5 font-['Outfit']">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              Attached Context ({sources.length})
            </span>
            <button
              onClick={() => vaultFileInputRef.current?.click()}
              className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 normal-case font-normal hover:underline"
              title="Add documents to knowledge vault"
            >
              <Plus className="w-3 h-3" /> Add Files
            </button>
            <input
              type="file"
              ref={vaultFileInputRef}
              multiple
              className="hidden"
              onChange={(e) => handleVaultUpload(e.target.files)}
            />
          </div>

          {/* Upload Success Alert */}
          {uploadSuccessMsg && (
            <div className="mb-2 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px] flex items-center gap-1.5 animate-fade-in">
              <FileCheck className="w-3.5 h-3.5 shrink-0" />
              <span>{uploadSuccessMsg}</span>
            </div>
          )}

          {/* Document List */}
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
            {sources.length === 0 ? (
              <div
                onClick={() => vaultFileInputRef.current?.click()}
                className="p-4 rounded-xl border border-dashed border-white/10 hover:border-cyan-500/40 bg-white/[0.02] hover:bg-cyan-500/[0.03] text-center cursor-pointer transition group"
              >
                <UploadCloud className="w-6 h-6 text-slate-500 group-hover:text-cyan-400 mx-auto mb-1.5 transition" />
                <div className="text-xs font-medium text-slate-300">No documents yet</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Click to upload PDF, Word or images</div>
              </div>
            ) : (
              sources.map((src) => (
                <div
                  key={src.source_id}
                  onClick={() => handleInspectDocument(src)}
                  className="group relative flex items-center justify-between p-2.5 rounded-xl border border-white/5 hover:border-cyan-500/30 bg-white/[0.02] hover:bg-white/[0.05] cursor-pointer transition"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="p-1.5 rounded-lg bg-white/5 shrink-0">
                      {getFileIcon(src.filename)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium text-slate-200 truncate group-hover:text-cyan-300 transition">
                        {src.filename}
                      </div>
                      <div className="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5">
                        <span className="text-cyan-400/90 font-mono">
                          {src.file_size ? `${(src.file_size / 1024).toFixed(0)} KB` : 'Indexed'}
                        </span>
                        <span>•</span>
                        <span className="text-slate-400">Click to view chunks</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleInspectDocument(src); }}
                      className="p-1 hover:bg-cyan-500/20 text-slate-400 hover:text-cyan-300 rounded"
                      title="Inspect Chunks & Pages"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => handleDeleteSource(src.source_id, e)}
                      className="p-1 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded"
                      title="Delete file from store"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Chat History Section */}
          <div className="pt-3 border-t border-white/10 mt-2">
            <div className="px-2 pb-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider font-['Outfit']">
              Recent Chats
            </div>
            <div className="max-h-36 overflow-y-auto space-y-1">
              {sessions.map((sess) => (
                <div
                  key={sess.id}
                  onClick={() => setActiveSessionId(sess.id)}
                  className={`group flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition ${
                    sess.id === activeSessionId
                      ? 'bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-medium'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                  }`}
                >
                  <span className="truncate flex-1">{sess.title}</span>
                  {sessions.length > 1 && (
                    <button
                      onClick={(e) => handleDeleteSession(sess.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:text-rose-400 transition"
                      title="Delete chat"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar Footer: Model Switcher & System Status */}
        <div className="p-3 border-t border-white/10 bg-[#040508]/80">
          <div className="text-[11px] font-semibold text-slate-400 mb-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-cyan-400" /> Model Provider
            </span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
              backend === 'online' ? 'bg-cyan-500/20 text-cyan-300' : 'bg-purple-500/20 text-purple-300'
            }`}>
              {backend === 'online' ? '⚡ 0.5s Fast' : '🔒 Offline'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-white/[0.03] border border-white/5">
            <button
              onClick={() => setBackend('online')}
              className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition ${
                backend === 'online'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-black shadow-md font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Fast Cloud</span>
            </button>
            <button
              onClick={() => setBackend('offline')}
              className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition ${
                backend === 'offline'
                  ? 'bg-purple-600 text-white shadow-md font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Ollama</span>
            </button>
          </div>

          <div className="mt-2.5 pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              FAISS Index: {healthData?.index?.vectors || 0} vectors
            </span>
            <span className="font-mono text-[10px] text-slate-400">
              {backend === 'online' ? 'Qwen-2.5' : 'qwen2.5vl'}
            </span>
          </div>
        </div>
      </aside>

      {/* ------------------------------------------------------------- MAIN CHAT VIEW */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative bg-[#080a11]">
        {/* Top Navbar */}
        <header className="h-14 border-b border-white/10 px-4 flex items-center justify-between shrink-0 bg-[#080a11]/90 backdrop-blur z-10">
          <div className="flex items-center gap-3">
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-1.5 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition"
                title="Expand Sidebar"
              >
                <PanelLeft className="w-5 h-5" />
              </button>
            )}
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-200 tracking-wide">
                {currentSession?.title || 'Investigation'}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 font-mono">
                {backend === 'online' ? '⚡ Groq Qwen-2.5 (Fast)' : '🔒 Ollama Local (Offline)'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => vaultFileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-slate-300 hover:text-white transition"
            >
              <Paperclip className="w-3.5 h-3.5 text-cyan-400" />
              <span>Attach Context</span>
            </button>
            <button
              onClick={() => {
                if (window.confirm('Clear conversation messages?')) {
                  setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, messages: [] } : s));
                }
              }}
              className="p-2 hover:bg-white/5 rounded-lg text-slate-400 hover:text-rose-400 transition"
              title="Clear Messages"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Message Stream Scroll Area */}
        <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8 space-y-6">
          {currentSession?.messages?.length === 0 ? (
            /* Welcome / Starter View (ChatGPT & Claude Style) */
            <div className="max-w-2xl mx-auto my-auto pt-8 pb-12 flex flex-col items-center text-center animate-fade-in">
              <div className="relative mb-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-xl shadow-cyan-500/20">
                  <Sparkles className="w-7 h-7 text-white" />
                </div>
                <div className="absolute -inset-1 rounded-2xl bg-cyan-500/20 blur-lg -z-10 animate-pulse"></div>
              </div>

              <h1 className="text-2xl font-bold text-white font-['Outfit'] tracking-tight mb-2">
                What would you like to investigate today?
              </h1>
              <p className="text-sm text-slate-400 max-w-lg mb-8 leading-relaxed">
                Evidence AI processes your documents into page-level chunks with deterministic citations.
                Upload reports, research, or PDFs and ask questions below.
              </p>

              {/* Starter Prompt Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full text-left">
                <div
                  onClick={() => handleSendMessage('Summarize the main objectives and findings of the uploaded document')}
                  className="p-3.5 rounded-xl border border-white/10 hover:border-cyan-500/40 bg-white/[0.02] hover:bg-cyan-500/[0.04] cursor-pointer transition group"
                >
                  <div className="text-xs font-semibold text-slate-200 group-hover:text-cyan-300 flex items-center gap-1.5 mb-1 font-['Outfit']">
                    <FileText className="w-3.5 h-3.5 text-cyan-400" />
                    Summarize Document
                  </div>
                  <div className="text-[11px] text-slate-400 leading-normal">
                    Provide a concise breakdown of objectives, methodology, and conclusions.
                  </div>
                </div>

                <div
                  onClick={() => handleSendMessage('What are the key technical steps or commands executed?')}
                  className="p-3.5 rounded-xl border border-white/10 hover:border-cyan-500/40 bg-white/[0.02] hover:bg-cyan-500/[0.04] cursor-pointer transition group"
                >
                  <div className="text-xs font-semibold text-slate-200 group-hover:text-cyan-300 flex items-center gap-1.5 mb-1 font-['Outfit']">
                    <Cpu className="w-3.5 h-3.5 text-blue-400" />
                    Technical Steps & Code
                  </div>
                  <div className="text-[11px] text-slate-400 leading-normal">
                    Extract all procedures, terminal commands, configurations, and scripts.
                  </div>
                </div>

                <div
                  onClick={() => handleSendMessage('Extract all numerical data, tables, and experimental results')}
                  className="p-3.5 rounded-xl border border-white/10 hover:border-cyan-500/40 bg-white/[0.02] hover:bg-cyan-500/[0.04] cursor-pointer transition group"
                >
                  <div className="text-xs font-semibold text-slate-200 group-hover:text-cyan-300 flex items-center gap-1.5 mb-1 font-['Outfit']">
                    <Layers className="w-3.5 h-3.5 text-emerald-400" />
                    Extract Tables & Metrics
                  </div>
                  <div className="text-[11px] text-slate-400 leading-normal">
                    Retrieve specific metrics, test pass/fail rates, and data values.
                  </div>
                </div>

                <div
                  onClick={() => handleSendMessage('Explain JUnit and test automation concepts from the document')}
                  className="p-3.5 rounded-xl border border-white/10 hover:border-cyan-500/40 bg-white/[0.02] hover:bg-cyan-500/[0.04] cursor-pointer transition group"
                >
                  <div className="text-xs font-semibold text-slate-200 group-hover:text-cyan-300 flex items-center gap-1.5 mb-1 font-['Outfit']">
                    <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                    Concept Deep-Dive
                  </div>
                  <div className="text-[11px] text-slate-400 leading-normal">
                    Explain key theory definitions and examples with exact source citations.
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Active Message List */
            currentSession.messages.map((msg) => (
              <div
                key={msg.id}
                className={`max-w-3xl mx-auto flex gap-3 animate-fade-in ${
                  msg.sender === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {/* Assistant Avatar */}
                {msg.sender === 'assistant' && (
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shrink-0 shadow-md shadow-cyan-500/10 mt-1">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                )}

                {/* Message Bubble Container */}
                <div className={`flex flex-col ${msg.sender === 'user' ? 'items-end max-w-xl' : 'items-start flex-1 min-w-0'}`}>
                  {/* User Attached File Badge */}
                  {msg.attachedFile && (
                    <div className="mb-1.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-mono">
                      <Paperclip className="w-3 h-3" />
                      <span>{msg.attachedFile.name}</span>
                    </div>
                  )}

                  {/* Message Bubble */}
                  <div
                    className={`rounded-2xl p-4 text-sm leading-relaxed ${
                      msg.sender === 'user'
                        ? 'bg-[#182136] text-white border border-cyan-500/20 shadow-md'
                        : 'bg-white/[0.03] text-slate-100 border border-white/10 w-full shadow-sm'
                    }`}
                  >
                    {msg.sender === 'assistant' ? (
                      <div className="prose">
                        <ReactMarkdown>{msg.text}</ReactMarkdown>
                      </div>
                    ) : (
                      <div className="whitespace-pre-wrap">{msg.text}</div>
                    )}

                    {/* Citations Accordion (if assistant response has citations) */}
                    {msg.citations && msg.citations.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-white/10">
                        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-cyan-400 font-['Outfit']">
                            <Layers className="w-3.5 h-3.5" />
                            Grounded Citations ({msg.citations.length})
                          </span>
                          <span className="text-[10px] text-slate-500">Click to view source excerpt</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {msg.citations.map((c) => (
                            <button
                              key={c.citation_id}
                              onClick={() => setActiveCitationModal(c)}
                              className="citation-chip"
                              title="Click to view exact chunk excerpt"
                            >
                              <FileText className="w-3 h-3 text-cyan-400" />
                              <span>[{c.citation_id}] {c.filename}</span>
                              {c.location?.page_number && (
                                <span className="text-white/60 font-sans">• Page {c.location.page_number}</span>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Footer bar for Assistant Message */}
                    {msg.sender === 'assistant' && !msg.isError && (
                      <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-500">
                        <div className="flex items-center gap-3">
                          {msg.latency_ms?.total_ms && (
                            <span className="text-cyan-400 font-mono">
                              ⚡ {(msg.latency_ms.total_ms / 1000).toFixed(2)}s
                            </span>
                          )}
                          {msg.confidence !== null && msg.confidence !== undefined && (
                            <span className="text-slate-400">
                              Confidence: {Math.round(msg.confidence * 100)}%
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => copyToClipboard(msg.text, msg.id)}
                            className="p-1 hover:text-cyan-300 text-slate-400 rounded flex items-center gap-1 transition"
                            title="Copy response"
                          >
                            {copiedId === msg.id ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                                <span className="text-[10px] text-emerald-400">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span className="text-[10px]">Copy</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* User Avatar */}
                {msg.sender === 'user' && (
                  <div className="w-8 h-8 rounded-xl bg-slate-700 border border-white/10 flex items-center justify-center shrink-0 mt-1 text-xs font-semibold text-white">
                    U
                  </div>
                )}
              </div>
            ))
          )}

          {/* Typing / Generating Indicator */}
          {loading && (
            <div className="max-w-3xl mx-auto flex gap-3 animate-fade-in">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shrink-0 shadow-md shadow-cyan-500/10">
                <Sparkles className="w-4 h-4 text-white animate-spin" />
              </div>
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 text-sm text-slate-300 flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
                <span>Retrieving chunks & generating grounded response...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* ------------------------------------------------------------- FLOATING INPUT BAR */}
        <div className="p-4 md:px-8 shrink-0 bg-gradient-to-t from-[#080a11] via-[#080a11]/90 to-transparent">
          <div className="max-w-3xl mx-auto">
            {/* Staged File Badge */}
            {stagedFile && (
              <div className="mb-2 flex items-center justify-between p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-xs text-cyan-300 animate-fade-in">
                <div className="flex items-center gap-2 truncate">
                  <Paperclip className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span className="font-medium truncate">{stagedFile.name}</span>
                  <span className="text-slate-400 font-mono">({(stagedFile.size / 1024).toFixed(0)} KB)</span>
                </div>
                <button
                  onClick={() => setStagedFile(null)}
                  className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white"
                  title="Remove attachment"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Input Capsule (ChatGPT / Claude Pill) */}
            <div className="chat-input-capsule p-2 flex items-center gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-2 text-slate-400 hover:text-cyan-400 hover:bg-white/5 rounded-xl transition shrink-0"
                title="Attach Document or Image to Query"
              >
                <Paperclip className="w-5 h-5" />
              </button>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) setStagedFile(e.target.files[0]);
                }}
              />

              <textarea
                ref={textareaRef}
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder={stagedFile ? `Ask a question about ${stagedFile.name}...` : "Ask anything about your documents... (Shift + Enter for newline)"}
                rows={1}
                className="flex-1 bg-transparent border-none outline-none text-sm text-white placeholder-slate-500 resize-none max-h-36 py-1.5 px-2"
                style={{ minHeight: '24px' }}
              />

              <button
                onClick={() => handleSendMessage()}
                disabled={(!inputQuery.trim() && !stagedFile) || loading}
                className="send-button"
                title="Send query"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 text-black animate-spin" />
                ) : (
                  <ArrowRight className="w-4 h-4 text-black font-bold" />
                )}
              </button>
            </div>

            <div className="mt-2 text-center text-[11px] text-slate-500">
              Evidence AI searches across verified chunks with page numbers and deterministic citations.
            </div>
          </div>
        </div>
      </main>

      {/* ------------------------------------------------------------- MODAL 1: CHUNKS INSPECTOR */}
      {inspectDoc && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#0c101d] border border-white/15 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
                  {getFileIcon(inspectDoc.filename)}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white font-['Outfit']">{inspectDoc.filename}</h3>
                  <p className="text-[11px] text-slate-400 font-mono">
                    {inspectChunks.length} chunks indexed • {inspectDoc.file_size ? `${(inspectDoc.file_size / 1024).toFixed(0)} KB` : ''}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setInspectDoc(null)}
                className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter Bar */}
            <div className="p-3 border-b border-white/10 bg-white/[0.01] flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search chunk text..."
                  value={chunkSearch}
                  onChange={(e) => setChunkSearch(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              {availablePages.length > 1 && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-400">Page:</span>
                  <select
                    value={selectedPageFilter}
                    onChange={(e) => setSelectedPageFilter(e.target.value)}
                    className="bg-white/5 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="all">All Pages ({availablePages.length})</option>
                    {availablePages.map(p => (
                      <option key={p} value={String(p)}>Page {p}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Chunks List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loadingChunks ? (
                <div className="py-16 text-center text-slate-400 text-xs">
                  <RefreshCw className="w-6 h-6 mx-auto animate-spin mb-2 text-cyan-400" />
                  Loading document chunks...
                </div>
              ) : filteredChunks.length === 0 ? (
                <div className="py-16 text-center text-slate-400 text-xs">
                  No chunks match the current search or page filter.
                </div>
              ) : (
                filteredChunks.map((chunk, idx) => (
                  <div
                    key={chunk.chunk_id || idx}
                    className="p-3.5 rounded-xl border border-white/10 bg-white/[0.02] hover:border-cyan-500/30 hover:bg-white/[0.03] transition space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-mono text-[11px] font-medium">
                          Page {chunk.page}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-slate-300 font-mono text-[11px]">
                          Chunk #{chunk.chunk_index}
                        </span>
                        {chunk.section && (
                          <span className="text-slate-400 text-[11px] truncate max-w-xs">
                            • {chunk.section}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => copyToClipboard(chunk.text, chunk.chunk_id || idx)}
                        className="text-[11px] text-slate-400 hover:text-cyan-300 flex items-center gap-1"
                      >
                        {copiedId === (chunk.chunk_id || idx) ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>Copy</span>
                      </button>
                    </div>
                    <div className="text-xs text-slate-200 leading-relaxed font-sans whitespace-pre-wrap bg-black/30 p-2.5 rounded-lg border border-white/5">
                      {chunk.text}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- MODAL 2: CITATION DETAILS */}
      {activeCitationModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#0c101d] border border-cyan-500/30 rounded-2xl w-full max-w-xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-cyan-400" />
                <h3 className="text-sm font-bold text-white font-['Outfit']">
                  Citation [{activeCitationModal.citation_id}] Ground-Truth Excerpt
                </h3>
              </div>
              <button
                onClick={() => setActiveCitationModal(null)}
                className="p-1 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400">File:</span>
                <span className="font-semibold text-slate-200">{activeCitationModal.filename}</span>
                {activeCitationModal.location?.page_number && (
                  <span className="px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-mono text-[11px]">
                    Page {activeCitationModal.location.page_number}
                  </span>
                )}
              </div>

              <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 text-xs text-slate-200 leading-relaxed font-sans">
                {activeCitationModal.excerpt}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setActiveCitationModal(null)}
                className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-semibold text-xs transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
