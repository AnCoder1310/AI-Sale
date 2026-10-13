import { useState, useRef, useEffect } from 'react';
import {
  RefreshIcon,
  CopyIcon,
  SendIcon,
  ChevronRight,
  BookIcon,
  CheckIcon,
  LightbulbIcon,
  ArrowRight,
} from '../common/Icons';
import { CopilotLogo } from '../common/CopilotLogo';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';
import { copilotApi } from '../../api/copilotApi';
import { FAQ_QUESTIONS, CHEAT_SHEET_DATA } from '../../data/faqData';
import { createId, getCurrentTimeString } from '../../lib/id';

function formatInlineMarkdown(text) {
  if (!text) return "";
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[C\d+\])/g;
  const parts = text.split(regex);
  return parts.map((part, index) => {
    if (!part) return null;
    if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) {
      return (
        <strong key={index} style={{ fontWeight: 700 }}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length >= 2) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length >= 2) {
      return (
        <code
          key={index}
          style={{
            backgroundColor: "rgba(0, 0, 0, 0.06)",
            padding: "2px 5px",
            borderRadius: 4,
            fontSize: "0.85em",
            fontFamily: "monospace",
          }}
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (/^\[C\d+\]$/.test(part)) {
      return (
        <span
          key={index}
          style={{
            display: "inline-flex",
            alignItems: "center",
            fontSize: "0.72rem",
            fontWeight: 700,
            padding: "1px 5px",
            margin: "0 2px",
            borderRadius: 4,
            backgroundColor: "#E5E7EB",
            color: "#1F2937",
            verticalAlign: "baseline",
          }}
        >
          {part}
        </span>
      );
    }
    return part;
  });
}

function renderFormattedMarkdown(text) {
  if (!text) return null;
  const paragraphs = text.split(/\n\n+/);
  return paragraphs.map((para, pIdx) => {
    const lines = para.split("\n");
    const isBulletList = lines.length > 0 && lines.every((l) => l.trim().startsWith("- ") || l.trim().startsWith("* "));
    if (isBulletList) {
      return (
        <ul key={pIdx} style={{ margin: "8px 0", paddingLeft: 20, display: "flex", flexDirection: "column", gap: 4 }}>
          {lines.map((l, lIdx) => (
            <li key={lIdx}>{formatInlineMarkdown(l.trim().replace(/^[-*]\s+/, ""))}</li>
          ))}
        </ul>
      );
    }
    const isNumberedList = lines.length > 0 && lines.every((l) => /^\d+\.\s+/.test(l.trim()));
    if (isNumberedList) {
      return (
        <ol key={pIdx} style={{ margin: "8px 0", paddingLeft: 20, display: "flex", flexDirection: "column", gap: 4 }}>
          {lines.map((l, lIdx) => (
            <li key={lIdx}>{formatInlineMarkdown(l.trim().replace(/^\d+\.\s+/, ""))}</li>
          ))}
        </ol>
      );
    }
    return (
      <div key={pIdx} style={{ marginTop: pIdx === 0 ? 0 : 10 }}>
        {lines.map((line, lIdx) => (
          <span key={lIdx}>
            {lIdx > 0 && <br />}
            {formatInlineMarkdown(line)}
          </span>
        ))}
      </div>
    );
  });
}

const STORAGE_KEY_PREFIX = 'vinfast_copilot_chat_';

const WELCOME_MESSAGE = {
  id: 'msg-welcome',
  role: 'assistant',
  time: '10:00',
  content:
    'Chào bạn! Tôi là **AI Sales Copilot**. Tôi có thể hỗ trợ bạn tra cứu nhanh thông số kỹ thuật, giá bán, chính sách pin và kịch bản tư vấn xe VinFast 2026.\n\nBạn cần tra cứu thông tin gì hôm nay?',
  talking_points: [],
  citations: [],
};

export function CopilotView({ onOpenDocument, initialQuery = '', currentUser = null }) {
  const storageKey = `${STORAGE_KEY_PREFIX}${currentUser?.username || 'advisor'}`;
  const [inputMessage, setInputMessage] = useState(initialQuery || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [selectedCitationDoc, setSelectedCitationDoc] = useState(null);
  const [citationLoading, setCitationLoading] = useState(false);

  const handleOpenCitation = async (documentId) => {
    setCitationLoading(true);
    try {
      const doc = await copilotApi.getSource(documentId);
      setSelectedCitationDoc(doc);
    } catch {
      setSelectedCitationDoc({
        document_id: documentId,
        title: `Tài liệu: ${documentId}`,
        content: 'Không thể tải nội dung chi tiết của tài liệu này từ máy chủ.',
      });
    } finally {
      setCitationLoading(false);
    }
  };

  const [messages, setMessages] = useState(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return [WELCOME_MESSAGE];
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(messages));
    } catch {
      // ignore
    }
  }, [messages, storageKey]);

  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (textToSend) => {
    const queryText = (textToSend || inputMessage).trim();
    if (!queryText || loading) return;

    const userMsg = {
      id: createId('usr'),
      role: 'user',
      time: getCurrentTimeString(),
      content: queryText,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setLoading(true);
    setError('');

    try {
      const response = await copilotApi.query({ query: queryText });
      if (!response.answer) throw new Error('Copilot chưa trả lời được câu hỏi này.');
      const aiMsg = {
        id: createId('ai'),
        role: 'assistant',
        time: getCurrentTimeString(),
        content: response.answer,
        citations: response.citations || [],
        talking_points: response.talking_points || [],
        suggested_message: response.suggested_message || '',
        suggested_next_question: response.suggested_next_question || '',
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (requestError) {
      setError(requestError.message || 'Không thể kết nối Copilot. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (id, text) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleResetChat = () => {
    setError('');
    const resetMsg = [
      {
        id: createId('msg-reset'),
        role: 'assistant',
        time: getCurrentTimeString(),
        content:
          'Phiên làm việc mới đã được khởi tạo. Bạn cần tra cứu thông số kỹ thuật, giá bán hay chính sách xe VinFast nào?',
        talking_points: [],
        citations: [],
      },
    ];
    setMessages(resetMsg);
    try {
      localStorage.setItem(storageKey, JSON.stringify(resetMsg));
    } catch {
      // ignore
    }
  };

  return (
    <div className="copilot-grid-layout">
      {/* LEFT MAIN CHAT CARD */}
      <div className="card-white copilot-chat-card" style={{ display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
        {/* HEADER */}
        <div className="copilot-chat-header">
          <div className="copilot-chat-identity">
            <div className="copilot-chat-mark">
              <CopilotLogo style={{ width: 23, height: 23 }} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h2 className="copilot-chat-title">
                  VinFast AI Copilot
                </h2>
                <Badge variant="default" className="copilot-grounded-badge">
                  <span className="copilot-grounded-dot" />
                  RAG Grounded
                </Badge>
              </div>
              <p className="copilot-chat-subtitle">
                Truy vấn tài liệu chính thức, thông số kỹ thuật và chính sách 2026
              </p>
            </div>
          </div>

          <button
            onClick={handleResetChat}
            className="copilot-reset-button"
            title="Làm mới phiên chat"
          >
            <RefreshIcon style={{ width: 14, height: 14 }} />
            <span>Làm mới phiên chat</span>
          </button>
        </div>

        {/* CHAT MESSAGES AREA */}
        <div className="copilot-messages">
          {messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
                width: '100%',
              }}
            >
              {msg.role === 'user' ? (
                <div className="chat-bubble-user">
                  <div style={{ fontSize: '0.92rem', lineHeight: 1.5 }}>{msg.content}</div>
                  <div style={{ fontSize: '0.7rem', color: '#A3A3A3', marginTop: 4, textAlign: 'right' }}>
                    {msg.time}
                  </div>
                </div>
              ) : (
                <div className="chat-bubble-ai copilot-assistant-message" style={{ width: '100%' }}>
                  {/* AI header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <div className="copilot-message-mark">
                      <CopilotLogo style={{ width: 16, height: 16 }} />
                    </div>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#111111' }}>
                      VinFast Sales Copilot
                    </span>
                  </div>

                  {/* Body text */}
                  <div style={{ fontSize: '0.92rem', color: '#222222', lineHeight: 1.6 }}>
                    {renderFormattedMarkdown(msg.content)}
                  </div>

                  {/* Talking points recommendation box */}
                  {msg.talking_points && msg.talking_points.length > 0 && (
                    <div
                      style={{
                        marginTop: 16,
                        padding: '14px 18px',
                        backgroundColor: '#F9F9F7',
                        border: '1px solid #EAEAE6',
                        borderRadius: 10,
                      }}
                    >
                      <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#111111', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                        <LightbulbIcon style={{ width: 14, height: 14, color: "#0F172A" }} />
                        <span>Gợi ý luận điểm thuyết phục:</span>
                      </div>
                      <ul style={{ listStyle: 'none', paddingLeft: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {msg.talking_points.map((point, pIdx) => (
                          <li key={pIdx} style={{ fontSize: '0.82rem', color: '#444444', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                            <span style={{ color: '#111111', fontWeight: 700 }}>•</span>
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Citations / Evidence Sources */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #F0F0EE' }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#737373', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <BookIcon style={{ width: 12, height: 12 }} />
                        <span>Nguồn đối chiếu tài liệu chính thức:</span>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {msg.citations.map((cite, cIdx) => (
                          <button
                            key={cIdx}
                            onClick={() => handleOpenCitation(cite.document_id)}
                            disabled={citationLoading}
                            style={{
                              padding: '4px 10px',
                              borderRadius: 6,
                              backgroundColor: '#F4F4F2',
                              border: '1px solid #E0E0DD',
                              fontSize: '0.75rem',
                              color: '#111111',
                              fontWeight: 500,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                            }}
                          >
                            <span>{cite.title || cite.document_id}</span>
                            <ChevronRight style={{ width: 10, height: 10 }} />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Next question prompt */}
                  {msg.suggested_next_question && (
                    <div style={{ marginTop: 12 }}>
                      <button
                        onClick={() => handleSend(msg.suggested_next_question)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 9999,
                          border: '1px dashed #B0B0AC',
                          backgroundColor: '#FFFFFF',
                          fontSize: '0.78rem',
                          color: '#444444',
                          cursor: 'pointer',
                        }}
                      >
                        <ArrowRight style={{ width: 13, height: 13, color: "#0F172A", display: "inline", verticalAlign: "-2px", marginRight: 4 }} /> Gợi ý hỏi tiếp: <strong>{msg.suggested_next_question}</strong>
                      </button>
                    </div>
                  )}

                  {/* Footer actions */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, paddingTop: 10, borderTop: '1px solid #F4F4F2', fontSize: '0.75rem', color: '#888888' }}>
                    <span>{msg.time}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <button
                        onClick={() => handleCopy(msg.id, msg.content)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#666666', fontSize: '0.75rem' }}
                      >
                        {copiedId === msg.id ? (
                          <>
                            <CheckIcon style={{ width: 13, height: 13, color: '#111111' }} />
                            <span style={{ color: '#111111' }}>Đã sao chép</span>
                          </>
                        ) : (
                          <>
                            <CopyIcon style={{ width: 13, height: 13 }} />
                            <span>Sao chép</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="chat-bubble-ai copilot-assistant-message" style={{ width: '80%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div className="copilot-message-mark">
                  <CopilotLogo style={{ width: 15, height: 15 }} />
                </div>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#111111' }}>
                  Copilot đang truy vấn tài liệu chính thức...
                </span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#111111', animation: 'bounce 1s infinite 0.1s' }} />
                <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#111111', animation: 'bounce 1s infinite 0.2s' }} />
                <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#111111', animation: 'bounce 1s infinite 0.3s' }} />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* BOTTOM INPUT BAR */}
        <div className="copilot-composer">
          {error && <p role="alert" style={{ color: '#991B1B', fontSize: '0.82rem', marginBottom: 8 }}>{error}</p>}
          <form
            className="copilot-composer-form"
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
          >
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Hỏi về thông số xe, chính sách pin hoặc ưu đãi..."
              style={{
                flex: 1,
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontSize: '0.9rem',
                color: '#111111',
              }}
              disabled={loading}
            />

            <button
              className="copilot-send-button"
              type="submit"
              disabled={!inputMessage.trim() || loading}
              title="Gửi câu hỏi"
            >
              <SendIcon style={{ width: 16, height: 16 }} />
            </button>
          </form>
        </div>
      </div>

      {/* RIGHT SIDEBAR: FAQ + QUICK CHEAT-SHEET */}
      <div className="copilot-sidebar-column">
        {/* CARD: CÂU HỎI THƯỜNG GẶP */}
        <div className="card-white copilot-faq-card">
          <div className="copilot-sidebar-heading">
            <h3>
              Câu hỏi thường gặp
            </h3>
          </div>

          <div className="copilot-faq-list">
            {FAQ_QUESTIONS.length === 0 ? (
              <div style={{ padding: '12px 14px', borderRadius: 8, backgroundColor: '#F9FAFB', border: '1px dashed #D1D5DB', fontSize: '0.8rem', color: '#6B7280' }}>
                <span style={{ fontWeight: 600, color: '#374151', display: 'block', marginBottom: 2 }}>
                  Chờ nạp tài liệu FAQ thực tế
                </span>
                Cần 6 tệp PDF câu hỏi thường gặp theo dải xe (VF 3 – VF 9) từ thư mục <code>data/knowledge/</code>.
              </div>
            ) : (
              FAQ_QUESTIONS.slice(0, 6).map((item) => (
              <button
                type="button"
                className="copilot-faq-question"
                key={item.id}
                onClick={() => handleSend(item.query)}
                disabled={loading}
              >
                <span>
                  {item.question}
                </span>
                <ChevronRight aria-hidden="true" />
              </button>
            )))}
          </div>
        </div>

        {/* CARD: QUICK CHEAT-SHEET 2026 */}
        <div className="card-dark copilot-cheat-card" style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'inline-block', backgroundColor: 'rgba(255, 255, 255, 0.1)', padding: '3px 8px', borderRadius: 4, width: 'fit-content' }}>
            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#E0E0E0', letterSpacing: '0.05em' }}>
              {CHEAT_SHEET_DATA.title}
            </span>
          </div>

          <h4 style={{ fontSize: '0.98rem', fontWeight: 700, color: '#FFFFFF' }}>
            {CHEAT_SHEET_DATA.subtitle}
          </h4>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
            {CHEAT_SHEET_DATA.items.length === 0 ? (
              <div style={{ fontSize: '0.8rem', color: '#9CA3AF', lineHeight: 1.4 }}>
                Đang để trống — Sẽ tự động trích xuất thông số khi nạp các tệp PDF thông số xe & chính sách bảo hành.
              </div>
            ) : (
              CHEAT_SHEET_DATA.items.map((item, idx) => (
              <div key={idx} style={{ fontSize: '0.82rem', color: '#D4D4D4', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                <span style={{ color: '#FFFFFF' }}>•</span>
                <div>
                  <span style={{ color: '#999999' }}>{item.label}: </span>
                  <span style={{ fontWeight: 600, color: '#FFFFFF' }}>{item.value}</span>
                </div>
              </div>
            )))}
          </div>
        </div>
      </div>
      {/* SOURCE CITATION DOCUMENT MODAL */}
      <Modal
        isOpen={Boolean(selectedCitationDoc)}
        onClose={() => setSelectedCitationDoc(null)}
        title={selectedCitationDoc ? selectedCitationDoc.title : "Tài liệu nguồn trích dẫn"}
        maxWidth={780}
      >
        {selectedCitationDoc && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "0.78rem", color: "#737373", borderBottom: "1px solid #F0F0EE", paddingBottom: 10, flexWrap: "wrap" }}>
              <span>Mã văn bản: <strong>{selectedCitationDoc.document_id}</strong></span>
              {selectedCitationDoc.effective_date && (
                <>
                  <span>•</span>
                  <span>Ngày hiệu lực: <strong>{selectedCitationDoc.effective_date}</strong></span>
                </>
              )}
              {selectedCitationDoc.product_model && (
                <>
                  <span>•</span>
                  <span>Dòng xe: <strong>{selectedCitationDoc.product_model}</strong></span>
                </>
              )}
              {selectedCitationDoc.status && (
                <>
                  <span>•</span>
                  <span>Trạng thái: <strong>{selectedCitationDoc.status}</strong></span>
                </>
              )}
            </div>

            <div
              style={{
                fontSize: "0.88rem",
                lineHeight: 1.6,
                color: "#222222",
                whiteSpace: "pre-wrap",
                maxHeight: "60vh",
                overflowY: "auto",
                backgroundColor: "#FAFAFA",
                padding: "16px 20px",
                borderRadius: 8,
                border: "1px solid #ECECE8",
              }}
            >
              {selectedCitationDoc.content}
            </div>

            {onOpenDocument && (
              <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 10, borderTop: "1px solid #F0F0EE" }}>
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() => {
                    const docId = selectedCitationDoc.document_id;
                    setSelectedCitationDoc(null);
                    onOpenDocument(docId);
                  }}
                  style={{ fontSize: "0.82rem", padding: "8px 14px" }}
                >
                  Xem toàn văn trong mục Knowledge →
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
