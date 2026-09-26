import React, { useState, useEffect } from 'react';
import {
  Search, FileText, Image as ImageIcon, Headphones, File, Upload,
  Cpu, Cloud, Shield, CheckCircle2, AlertCircle, Sparkles, ChevronDown,
  ChevronRight, ExternalLink, RefreshCw, Layers, Database, BarChart3,
  Sliders, Clock, ArrowRight, Zap, Info, X
} from 'lucide-react';

const API_BASE = 'http://127.0.0.1:8000';

export default function App() {
  const [activeTab, setActiveTab] = useState('ask'); // ask, ingest, sources, system
  const [queryModality, setQueryModality] = useState('TEXT'); // TEXT, IMAGE, AUDIO, DOCUMENT
  const [queryText, setQueryText] = useState('');
  const [queryFile, setQueryFile] = useState(null);
  const [topK, setTopK] = useState(10);
  const [rerankTopK, setRerankTopK] = useState(5);
  const [backend, setBackend] = useState('offline'); // offline or online
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState(null);
  const [error, setError] = useState(null);

  // System & Vault state
  const [healthData, setHealthData] = useState(null);
  const [sourcesList, setSourcesList] = useState([]);
  const [ingestFiles, setIngestFiles] = useState([]);
  const [ingestResults, setIngestResults] = useState(null);
  const [ingesting, setIngesting] = useState(false);
  const [selectedCitation, setSelectedCitation] = useState(null);

  // Load health & sources on mount
  useEffect(() => {
    fetchHealth();
    fetchSources();
  }, [backend]);

  const fetchHealth = async () => {
    try {
      const res = await fetch(`${API_BASE}/health?backend=${backend}`);
      const data = await res.json();
      setHealthData(data);
    } catch (err) {
      console.error('Failed to fetch health', err);
    }
  };

  const fetchSources = async () => {
    try {
      const res = await fetch(`${API_BASE}/sources`);
      const data = await res.json();
      setSourcesList(data.sources || []);
    } catch (err) {
      console.error('Failed to fetch sources', err);
    }
  };

  const handleQuery = async (e) => {
    if (e) e.preventDefault();
    if (!queryText.trim() && queryModality === 'TEXT') return;

    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      if (queryModality === 'TEXT') {
        const payload = {
          query: queryText.trim(),
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
        const data = await res.json();
        setResponse(data);
      } else {
        // Query with file
        if (!queryFile) {
          setError('Please select a file to query with.');
          setLoading(false);
          return;
        }
        const formData = new FormData();
        formData.append('file', queryFile);
        formData.append('instruction', queryText.trim());
        formData.append('query_modality', queryModality.toLowerCase());
        formData.append('top_k', topK);
        formData.append('rerank_top_k', rerankTopK);
        formData.append('backend', backend);

        const res = await fetch(`${API_BASE}/query_file`, {
          method: 'POST',
          body: formData,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        const data = await res.json();
        setResponse(data);
      }
    } catch (err) {
      setError(err.message || 'Failed to execute query.');
    } finally {
      setLoading(false);
    }
  };

  const handleIngest = async (e) => {
    e.preventDefault();
    if (!ingestFiles.length) return;

    setIngesting(true);
    setIngestResults(null);

    try {
      const formData = new FormData();
      for (const file of ingestFiles) {
        formData.append('files', file);
      }
      const res = await fetch(`${API_BASE}/ingest`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      setIngestResults(data);
      setIngestFiles([]);
      fetchHealth();
      fetchSources();
    } catch (err) {
      alert(`Ingestion failed: ${err.message}`);
    } finally {
      setIngesting(false);
    }
  };

  const suggestions = [
    "What is Test Automation according to the pdf?",
    "Who is the student in the docx?",
    "Who is Prof. Sujata Oak?",
    "What is the company name in the annual report?",
    "What are the Linux basic rules in the image?",
    "Summarize DevOps Experiment 6"
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Obsidian Glass Navigation */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(7, 8, 12, 0.85)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border-obsidian)',
        padding: '14px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '38px', height: '38px', borderRadius: '10px',
            background: 'linear-gradient(135deg, #00f2fe 0%, #9d4edd 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 15px rgba(0, 242, 254, 0.4)'
          }}>
            <Sparkles size={20} color="#050811" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
                Evidence AI
              </h1>
              <span className="obsidian-badge badge-cyan" style={{ fontSize: '0.68rem', padding: '2px 8px' }}>
                OBSIDIAN RAG
              </span>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Multimodal Grounded Retrieval & Citation Engine
            </p>
          </div>
        </div>

        {/* Status Pills & Backend Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Quick Metrics */}
          {healthData?.index && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginRight: '8px' }}>
              <span className="obsidian-badge badge-violet">
                <Database size={12} /> {healthData.index.sources} Sources
              </span>
              <span className="obsidian-badge badge-emerald">
                <Layers size={12} /> {healthData.index.items} Items
              </span>
            </div>
          )}

          {/* Backend Switcher Toggle */}
          <div style={{
            display: 'flex', background: 'rgba(255,255,255,0.05)',
            borderRadius: '10px', border: '1px solid var(--border-obsidian)',
            padding: '3px'
          }}>
            <button
              onClick={() => setBackend('offline')}
              style={{
                padding: '6px 14px', borderRadius: '8px',
                background: backend === 'offline' ? 'linear-gradient(135deg, rgba(0,242,254,0.2), rgba(157,78,221,0.2))' : 'transparent',
                color: backend === 'offline' ? 'var(--cyan)' : 'var(--text-muted)',
                fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '6px',
                border: backend === 'offline' ? '1px solid rgba(0,242,254,0.4)' : '1px solid transparent',
                transition: 'all 0.2s ease'
              }}
            >
              <Cpu size={14} />
              <span>Ollama Offline</span>
            </button>
            <button
              onClick={() => setBackend('online')}
              style={{
                padding: '6px 14px', borderRadius: '8px',
                background: backend === 'online' ? 'linear-gradient(135deg, rgba(0,242,254,0.2), rgba(157,78,221,0.2))' : 'transparent',
                color: backend === 'online' ? 'var(--cyan)' : 'var(--text-muted)',
                fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '6px',
                border: backend === 'online' ? '1px solid rgba(0,242,254,0.4)' : '1px solid transparent',
                transition: 'all 0.2s ease'
              }}
            >
              <Cloud size={14} />
              <span>Cloud Groq</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main style={{ maxWidth: '1280px', margin: '0 auto', width: '100%', padding: '24px', flex: 1 }}>
        {/* Navigation Tabs Bar */}
        <div style={{
          display: 'flex', gap: '10px', marginBottom: '28px',
          borderBottom: '1px solid var(--border-obsidian)', paddingBottom: '12px'
        }}>
          {[
            { id: 'ask', label: 'Ask Intelligence', icon: Search },
            { id: 'ingest', label: 'Vault Ingest', icon: Upload },
            { id: 'sources', label: 'Knowledge Sources', icon: Database },
            { id: 'system', label: 'System & Telemetry', icon: Sliders },
          ].map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  background: active ? 'rgba(0, 242, 254, 0.1)' : 'transparent',
                  color: active ? 'var(--cyan)' : 'var(--text-sub)',
                  border: active ? '1px solid rgba(0, 242, 254, 0.35)' : '1px solid transparent',
                  padding: '10px 20px', borderRadius: '10px',
                  fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: '0.9rem',
                  display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* TAB 1: ASK INTELLIGENCE */}
        {activeTab === 'ask' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Input Box Card */}
            <div className="obsidian-card glow-border" style={{ padding: '24px' }}>
              {/* Modality Selector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Ask Mode:
                </span>
                {[
                  { id: 'TEXT', label: 'Text Question', icon: FileText, desc: 'Search all ingested documents' },
                  { id: 'DOCUMENT', label: 'Document Query', icon: File, desc: 'Query by PDF/DOCX file' },
                  { id: 'IMAGE', label: 'Image Query', icon: ImageIcon, desc: 'Query by Screenshot' },
                  { id: 'AUDIO', label: 'Audio Query', icon: Headphones, desc: 'Query by Voice' },
                ].map(m => {
                  const Icon = m.icon;
                  const selected = queryModality === m.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => setQueryModality(m.id)}
                      style={{
                        padding: '6px 14px', borderRadius: '8px',
                        background: selected ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                        border: selected ? '1px solid var(--border-highlight)' : '1px solid var(--border-obsidian)',
                        color: selected ? 'var(--cyan)' : 'var(--text-sub)',
                        fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '6px'
                      }}
                    >
                      <Icon size={14} />
                      {m.label}
                    </button>
                  );
                })}
              </div>

              {/* Notice for File Query */}
              {queryModality !== 'TEXT' && (
                <div style={{
                  padding: '12px 16px', background: 'rgba(0, 242, 254, 0.05)',
                  border: '1px solid rgba(0, 242, 254, 0.2)', borderRadius: '10px',
                  marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px'
                }}>
                  <Info size={18} color="var(--cyan)" />
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-sub)' }}>
                    Upload a {queryModality.toLowerCase()} below to extract its evidence representation and search across the index.
                  </div>
                  <input
                    type="file"
                    onChange={(e) => setQueryFile(e.target.files[0])}
                    style={{ fontSize: '0.8rem', color: 'var(--text-main)' }}
                  />
                </div>
              )}

              {/* Question Textarea */}
              <div style={{ position: 'relative' }}>
                <textarea
                  className="obsidian-input"
                  rows={3}
                  placeholder={
                    queryModality === 'TEXT'
                      ? "Ask any question about your PDF, DOCX, images, or audio (e.g. 'What is Test Automation?')"
                      : `Enter instruction or question about this ${queryModality.toLowerCase()} (optional)`
                  }
                  value={queryText}
                  onChange={(e) => setQueryText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleQuery();
                    }
                  }}
                  style={{ resize: 'none', paddingRight: '120px' }}
                />
                <button
                  className="rare-btn-primary"
                  onClick={handleQuery}
                  disabled={loading || (queryModality === 'TEXT' && !queryText.trim())}
                  style={{ position: 'absolute', right: '12px', bottom: '14px' }}
                >
                  {loading ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      <span>Thinking...</span>
                    </>
                  ) : (
                    <>
                      <span>Ask AI</span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </div>

              {/* Suggestion Pills */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '14px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Suggestions:</span>
                {suggestions.map((s, idx) => (
                  <button
                    key={idx}
                    onClick={() => { setQueryText(s); setQueryModality('TEXT'); }}
                    style={{
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid var(--border-obsidian)',
                      borderRadius: '9999px', padding: '4px 12px',
                      color: 'var(--text-sub)', fontSize: '0.75rem', cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => e.target.style.borderColor = 'rgba(0, 242, 254, 0.4)'}
                    onMouseLeave={(e) => e.target.style.borderColor = 'var(--border-obsidian)'}
                  >
                    {s}
                  </button>
                ))}
              </div>

              {/* Hyperparameters Drawer */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '24px', marginTop: '18px',
                paddingTop: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                fontSize: '0.8rem', color: 'var(--text-muted)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span>Retrieve top_k: <strong>{topK}</strong></span>
                  <input
                    type="range" min="1" max="25" value={topK}
                    onChange={(e) => setTopK(e.target.value)}
                    style={{ accentColor: 'var(--cyan)', width: '80px' }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span>Rerank top_k: <strong>{rerankTopK}</strong></span>
                  <input
                    type="range" min="1" max="15" value={rerankTopK}
                    onChange={(e) => setRerankTopK(e.target.value)}
                    style={{ accentColor: 'var(--cyan)', width: '80px' }}
                  />
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Shield size={14} color="var(--emerald)" />
                  <span>Grounding Strict Mode: <strong>Active</strong></span>
                </div>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div style={{
                padding: '16px', borderRadius: '12px', background: 'rgba(244, 63, 94, 0.1)',
                border: '1px solid rgba(244, 63, 94, 0.3)', color: '#fda4af',
                display: 'flex', alignItems: 'center', gap: '10px'
              }}>
                <AlertCircle size={20} color="var(--rose)" />
                <span>{error}</span>
              </div>
            )}

            {/* GROUNDED ANSWER CARD */}
            {response && (
              <div className="obsidian-card glow-border" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Header status */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-obsidian)', paddingBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {response.abstained ? (
                      <span className="obsidian-badge badge-amber" style={{ padding: '6px 12px', fontSize: '0.85rem' }}>
                        <AlertCircle size={16} /> Abstained (Insufficient Evidence)
                      </span>
                    ) : (
                      <span className="obsidian-badge badge-emerald" style={{ padding: '6px 12px', fontSize: '0.85rem' }}>
                        <CheckCircle2 size={16} /> Grounded Answer Verified
                      </span>
                    )}
                    {response.confidence !== null && (
                      <span className="obsidian-badge badge-cyan">
                        Confidence: {(response.confidence * 100).toFixed(1)}%
                      </span>
                    )}
                  </div>

                  {/* Timing Latency */}
                  {response.latency_ms?.total_ms && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      <Clock size={14} />
                      <span>Total: {(response.latency_ms.total_ms / 1000).toFixed(2)}s</span>
                      <span>(Gen: {(response.latency_ms.generation_ms || 0).toFixed(0)}ms)</span>
                    </div>
                  )}
                </div>

                {/* Answer Content */}
                <div style={{ fontSize: '1.05rem', lineHeight: '1.7', color: 'var(--text-main)' }}>
                  {response.answer}
                </div>

                {/* Citations Bar */}
                {response.citations && response.citations.length > 0 && (
                  <div style={{ marginTop: '10px' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '10px' }}>
                      Programmatic Citations ({response.citations.length})
                    </div>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      {response.citations.map((c, i) => (
                        <div
                          key={i}
                          onClick={() => setSelectedCitation(c)}
                          style={{
                            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(0, 242, 254, 0.25)',
                            borderRadius: '10px', padding: '10px 14px', cursor: 'pointer',
                            display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: '320px',
                            transition: 'all 0.2s ease'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--cyan)'}
                          onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(0, 242, 254, 0.25)'}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--cyan)' }}>
                            <FileText size={14} />
                            <span>{c.filename}</span>
                            {c.location?.page_number && <span style={{ color: 'var(--text-muted)' }}>p.{c.location.page_number}</span>}
                          </div>
                          {c.excerpt && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-sub)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              "{c.excerpt}"
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Retrieved Evidence Pool (Expandable) */}
                {response.retrieved_items && response.retrieved_items.length > 0 && (
                  <div style={{ marginTop: '10px' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '10px' }}>
                      Retrieved Evidence Pool ({response.retrieved_items.length} Chunks)
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {response.retrieved_items.map((r, i) => (
                        <details
                          key={i}
                          style={{
                            background: 'rgba(11, 14, 22, 0.8)', border: '1px solid var(--border-obsidian)',
                            borderRadius: '10px', padding: '10px 14px', fontSize: '0.85rem'
                          }}
                        >
                          <summary style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-sub)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ color: 'var(--cyan)', fontWeight: 600 }}>#{r.rank}</span>
                              <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>{r.item.location?.page_number ? `Page ${r.item.location.page_number}` : r.item.modality}</span>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>({r.item.item_id?.slice(0, 8)})</span>
                            </div>
                            <div style={{ display: 'flex', gap: '10px', fontSize: '0.75rem' }}>
                              <span>Sim: {r.retrieval_score?.toFixed(3)}</span>
                              <span style={{ color: 'var(--emerald)' }}>Rerank: {r.rerank_score?.toFixed(2)}</span>
                            </div>
                          </summary>
                          <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.05)', color: 'var(--text-main)', lineHeight: '1.6', fontSize: '0.82rem', fontFamily: 'var(--font-mono)' }}>
                            {r.item.content}
                          </div>
                        </details>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: INGEST SOURCES */}
        {activeTab === 'ingest' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className="obsidian-card" style={{ padding: '28px' }}>
              <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', marginBottom: '8px', fontWeight: 600 }}>
                Vault Ingestion Hub
              </h2>
              <p style={{ color: 'var(--text-sub)', fontSize: '0.85rem', marginBottom: '20px' }}>
                Upload files once to convert, OCR, transcribe, and index into FAISS + SQLite.
                Files persist across restarts and are immediately searchable.
              </p>

              {/* Upload Drop Zone */}
              <div style={{
                border: '2px dashed var(--border-obsidian)', borderRadius: '16px',
                padding: '40px 20px', textAlign: 'center', background: 'rgba(255,255,255,0.02)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px'
              }}>
                <div style={{
                  width: '54px', height: '54px', borderRadius: '50%',
                  background: 'rgba(0, 242, 254, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <Upload size={24} color="var(--cyan)" />
                </div>
                <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                  Select documents, images, or audio files
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  Supported formats: PDF, DOCX, DOC, TXT, CSV, PNG, JPG, MP3, WAV
                </div>
                <input
                  type="file"
                  multiple
                  onChange={(e) => setIngestFiles(Array.from(e.target.files))}
                  style={{ marginTop: '12px', fontSize: '0.85rem' }}
                />
              </div>

              {/* Ingest Action Button */}
              {ingestFiles.length > 0 && (
                <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    className="rare-btn-primary"
                    onClick={handleIngest}
                    disabled={ingesting}
                  >
                    {ingesting ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" />
                        <span>Processing & Indexing...</span>
                      </>
                    ) : (
                      <>
                        <span>Ingest {ingestFiles.length} File(s)</span>
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Ingestion Results Feedback */}
              {ingestResults && (
                <div style={{ marginTop: '24px', padding: '18px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, color: 'var(--emerald)', marginBottom: '8px' }}>
                    <CheckCircle2 size={18} />
                    <span>Successfully Ingested ({ingestResults.indexed} Indexed, {ingestResults.failed} Failed)</span>
                  </div>
                  {ingestResults.results?.map((r, i) => (
                    <div key={i} style={{ fontSize: '0.82rem', color: 'var(--text-sub)', marginTop: '4px' }}>
                      • <strong>{r.filename}</strong> — {r.items_indexed} chunks, {r.relationships} graph edges
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: KNOWLEDGE VAULT */}
        {activeTab === 'sources' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', fontWeight: 600 }}>
                  Indexed Knowledge Sources
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  All persistent assets stored in SQLite and vector space
                </p>
              </div>
              <button className="rare-btn-secondary" onClick={fetchSources}>
                <RefreshCw size={14} /> Refresh
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '16px' }}>
              {sourcesList.map((s, idx) => (
                <div key={idx} className="obsidian-card glow-hover" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="obsidian-badge badge-cyan" style={{ textTransform: 'uppercase' }}>
                        {s.source_type}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {(s.file_size / 1024).toFixed(0)} KB
                    </span>
                  </div>

                  <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)', wordBreak: 'break-all' }}>
                    {s.filename}
                  </h3>

                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    ID: {s.source_id}
                  </div>

                  <div style={{
                    marginTop: 'auto', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                  }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--emerald)' }}>
                      ● Active in Index
                    </span>
                    <a
                      href={`${API_BASE}/source/${s.source_id}/file`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: 'var(--cyan)', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}
                    >
                      <span>Download</span>
                      <ExternalLink size={12} />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: SYSTEM & TELEMETRY */}
        {activeTab === 'system' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            {/* Ollama Card */}
            <div className="obsidian-card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <Cpu size={22} color="var(--cyan)" />
                <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', fontWeight: 600 }}>
                  Ollama Offline Runtime
                </h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Status:</span>
                  <span style={{ color: 'var(--emerald)', fontWeight: 600 }}>qwen2.5vl:3b Installed & Ready</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Context Budget:</span>
                  <span style={{ color: 'var(--cyan)' }}>3072 Tokens (Min Power Mode)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Idle Unload:</span>
                  <span>5 Minutes (RAM preservation)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Host Endpoint:</span>
                  <span>http://localhost:11434</span>
                </div>
              </div>
            </div>

            {/* Cloud API Card */}
            <div className="obsidian-card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <Cloud size={22} color="var(--violet)" />
                <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', fontWeight: 600 }}>
                  Cloud Groq Inference
                </h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Model:</span>
                  <span style={{ color: 'var(--violet)', fontWeight: 600 }}>qwen/qwen3.8-27b</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Endpoint:</span>
                  <span>api.groq.com/openai/v1</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>User-Agent:</span>
                  <span>EvidenceAI/1.0 (CF Bypass)</span>
                </div>
              </div>
            </div>

            {/* Local Models & Vector DB */}
            <div className="obsidian-card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <BarChart3 size={22} color="var(--emerald)" />
                <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', fontWeight: 600 }}>
                  Vector Engine & Reranker
                </h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Embedding:</span>
                  <span>all-MiniLM-L6-v2 (384d)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Cross-Encoder:</span>
                  <span>ms-marco-MiniLM-L-6-v2</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Abstention Gate:</span>
                  <span>Dynamic Grounded Floor</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Citation Modal / Detail Drawer */}
      {selectedCitation && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
          <div className="obsidian-card" style={{ maxWidth: '600px', width: '100%', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={18} color="var(--cyan)" />
                <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>{selectedCitation.filename}</h3>
              </div>
              <button
                onClick={() => setSelectedCitation(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-sub)' }}>
              Modality: <strong>{selectedCitation.modality}</strong> {selectedCitation.location?.page_number ? `· Page ${selectedCitation.location.page_number}` : ''}
            </div>
            <div style={{
              background: 'rgba(11, 14, 22, 0.9)', padding: '16px', borderRadius: '10px',
              border: '1px solid var(--border-obsidian)', fontSize: '0.85rem', lineHeight: '1.6',
              fontFamily: 'var(--font-mono)', color: 'var(--text-main)', maxHeight: '250px', overflowY: 'auto'
            }}>
              "{selectedCitation.excerpt}"
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
