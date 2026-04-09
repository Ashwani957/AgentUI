import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './index.css';

const App = () => {
  const [messages, setMessages] = useState([
    { id: 1, text: "Hello! I'm your Google ADK agent. How can I help you today?", sender: 'agent' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Updated to your Render deploy link
  // PRODUCTION: Railway deployment
  const AGENT_API_URL = 'https://agent-production-d5a1.up.railway.app/generate-content';
  
  // DEVELOPMENT: Uncomment the line below to test with local backend
  // const AGENT_API_URL = '/api/generate-content'; 

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Helper to find the deepest text in a nested object based on your screenshot
  const extractText = (data) => {
    if (typeof data === 'string') return data;
    if (!data || typeof data !== 'object') return null;
    
    // Look for common keys first
    const preferredKeys = ['raw_text', 'response', 'text', 'message'];
    for (const key of preferredKeys) {
      if (data[key]) {
        const result = extractText(data[key]);
        if (result) return result;
      }   
    }
    
    // Fallback: check all keys recursively
    for (const key in data) {
      const result = extractText(data[key]);
      if (typeof result === 'string') return result;
    }
    
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = { id: Date.now(), text: input, sender: 'user' };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch(AGENT_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: input }),
      });

      if (!response.ok) throw new Error('Failed to reach the agent');

      const data = await response.json();
      
      // We store the data object if it's structured, otherwise extract string
      const agentMessage = { 
        id: Date.now() + 1, 
        text: extractText(data), 
        data: data, // Keep full object for rich rendering
        sender: 'agent' 
      };
      setMessages(prev => [...prev, agentMessage]);
    } catch (error) {
      console.error('Error:', error);
      const errorMessage = { 
        id: Date.now() + 1, 
        text: "Error: Unable to connect to the agent.", 
        sender: 'agent' 
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="chat-container">
      <header className="chat-header">
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div className="status-dot"></div>
          <span className="header-title">Adk Agent</span>
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          Social Media Studio
        </div>
      </header>

      <main className="chat-messages">
        {messages.map((m) => (
          <div key={m.id} className={`message ${m.sender}`}>
            {m.sender === 'agent' ? (
              <FormattedResponse content={m.text} data={m.data} />
            ) : (
              m.text
            )}
          </div>
        ))}
        {isLoading && (
          <div className="loader">
            <div className="dot"></div>
            <div className="dot"></div>
            <div className="dot"></div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </main>

      <form className="chat-input-area" onSubmit={handleSubmit}>
        <div className="input-wrapper">
          <input
            type="text"
            className="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="What should we research today?..."
            disabled={isLoading}
            autoFocus
          />
        </div>
        <button type="submit" className="send-button" disabled={!input.trim() || isLoading}>
          {isLoading ? 'Thinking...' : 'Generate'}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
      </form>
    </div>
  );
};

const FormattedResponse = ({ content, data }) => {
  const [activeTab, setActiveTab] = useState('summary');
  const [copySuccess, setCopySuccess] = useState(null);

  // Parse structured data: 
  // 1. Try to find a JSON block in the 'content' string first (Stealth Parser)
  // 2. Fallback to the 'data' object passed from the API
  const findAndParseJSON = (text) => {
    try {
      // Regex to find content between the first { and the last }
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
         return {
           parsed: JSON.parse(jsonMatch[0]),
           cleanText: text.replace(jsonMatch[0], '').trim()
         };
      }
    } catch (e) {
      console.error("Failed to parse embedded JSON", e);
    }
    return { parsed: null, cleanText: text };
  };

  const { parsed, cleanText } = findAndParseJSON(content);
  
  // Resolve the best data source
  const rawData = parsed || data?.response?.response || data?.response || data;
  const platforms = rawData?.platforms || rawData;
  const metadata = rawData?.metadata || {};
  const summary = metadata.summary || rawData?.ResearchSummary;

  const handleCopy = (text, platform) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopySuccess(platform);
    setTimeout(() => setCopySuccess(null), 2000);
  };

  const hasStructuredResult = platforms && (
    platforms.linkedin || platforms.LinkedInPost || 
    platforms.instagram || platforms.InstagramScript
  );

  // If no JSON data found, just render markdown preamble
  if (!hasStructuredResult) {
    return <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>;
  }

  return (
    <div className="dashboard-container">
      {/* Show the clean natural language summary first */}
      <div className="narrative-summary">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{cleanText}</ReactMarkdown>
      </div>

      <div className="dashboard-tabs">
        <button 
          className={`tab-btn ${activeTab === 'summary' ? 'active' : ''}`}
          onClick={() => setActiveTab('summary')}
        >
          Detailed Summary
        </button>
        {(platforms.linkedin || platforms.LinkedInPost) && (
          <button 
            className={`tab-btn ${activeTab === 'linkedin' ? 'active' : ''}`}
            onClick={() => setActiveTab('linkedin')}
          >
            LinkedIn Post
          </button>
        )}
        {(platforms.instagram || platforms.InstagramScript) && (
          <button 
            className={`tab-btn ${activeTab === 'instagram' ? 'active' : ''}`}
            onClick={() => setActiveTab('instagram')}
          >
            Instagram Script
          </button>
        )}
      </div>

      <div className="tab-content">
        {activeTab === 'summary' && (
          <div className="research-section">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {summary || "No summary found in metadata. See narrative above."}
            </ReactMarkdown>
          </div>
        )}

        {activeTab === 'linkedin' && (
          <div className="platform-card">
            <div className="card-header">
              <div className="platform-info">
                <div className="platform-icon" style={{ background: '#0077b5' }}>
                  <svg width="14" height="14" fill="white" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
                </div>
                <span className="platform-name">LinkedIn Post</span>
              </div>
              <button 
                className={`copy-btn ${copySuccess === 'linkedin' ? 'success' : ''}`}
                onClick={() => handleCopy(platforms.linkedin?.post_body || platforms.LinkedInPost, 'linkedin')}
              >
                {copySuccess === 'linkedin' ? 'Copied!' : 'Copy Post'}
              </button>
            </div>
            <div className="post-content">
              {platforms.linkedin?.post_body || platforms.LinkedInPost}
            </div>
            {(platforms.linkedin?.hashtags || platforms.hashtags) && (
              <div className="hashtag-container">
                {(platforms.linkedin?.hashtags || platforms.hashtags).map((tag, i) => (
                  <span key={i} className="hashtag">{tag.startsWith('#') ? tag : `#${tag}`}</span>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'instagram' && (
          <div className="platform-card">
            <div className="card-header">
              <div className="platform-info">
                <div className="platform-icon" style={{ background: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2397 75%, #bc1888 100%)' }}>
                  <svg width="14" height="14" fill="white" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 1.17.054 1.805.249 2.227.412.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.012 3.584-.07 4.85c-.054 1.17-.249 1.805-.413 2.227-.217.562-.477.96-.896 1.382-.419.419-.818.679-1.381.896-.422.164-1.056.36-2.227.413-1.266.057-1.646.07-4.85.07s-3.584-.012-4.85-.07c-1.17-.054-1.805-.249-2.227-.412-.562-.217-.96-.477-1.382-.896-.419-.42-.679-.819-.896-1.381-.164-.422-.36-1.057-.413-2.227-.057-1.266-.07-1.646-.07-4.85s.012-3.584.07-4.85c.054-1.17.249-1.805.412-2.227.217-.562.477-.96.896-1.382.42-.419.819-.679 1.381-.896.422-.164 1.057-.36 2.227-.413 1.266-.057 1.646-.07 4.85-.07zm0-2.163c-3.259 0-3.667.014-4.947.072-1.277.057-2.148.258-2.911.553-.788.306-1.457.715-2.122 1.38s-1.074 1.334-1.38 2.122c-.295.763-.496 1.634-.553 2.911-.058 1.28-.072 1.688-.072 4.947s.014 3.667.072 4.947c.057 1.277.258 2.148.553 2.911.306.788.715 1.457 1.38 2.122s1.334 1.074 2.122 1.38c.763.295 1.634.496 2.911.553 1.28.058 1.688.072 4.947.072s3.667-.014 4.947-.072c1.277-.057 2.148-.258 2.911-.553.788-.306 1.457-.715 2.122-1.38s1.074-1.334 1.38-2.122c.295-.763.496-1.634.553-2.911.058-1.28.072-1.688.072-4.947s-.014-3.667-.072-4.947c-.057-1.277-.258-2.148-.553-2.911-.306-.788-.715-1.457-1.38-2.122s-1.334-1.074-2.122-1.38c-.763-.295-1.634-.496-2.911-.553-1.28-.058-1.688-.072-4.947-.072z"/><path d="M12 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.791-4-4s1.791-4 4-4 4 1.791 4 4-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                </div>
                <span className="platform-name">Instagram Script</span>
              </div>
              <button 
                className={`copy-btn ${copySuccess === 'instagram' ? 'success' : ''}`}
                onClick={() => handleCopy(platforms.instagram?.reel_script || platforms.InstagramScript, 'instagram')}
              >
                {copySuccess === 'instagram' ? 'Copied!' : 'Copy Script'}
              </button>
            </div>
            <div className="post-content">
              {platforms.instagram?.reel_script || platforms.InstagramScript}
            </div>
            {platforms.instagram?.caption && (
               <div className="research-section" style={{ marginTop: '16px', background: 'rgba(255,255,255,0.05)' }}>
                  <div style={{ fontSize: '0.7rem', opacity: 0.6, marginBottom: '4px' }}>POST CAPTION:</div>
                  <div style={{ fontSize: '0.85rem' }}>{platforms.instagram.caption}</div>
               </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
