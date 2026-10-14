import { useState, useRef, useEffect, useCallback } from 'react';
import {
  SparkleIcon,
  RefreshIcon,
  CopyIcon,
  SendIcon,
  ChevronRight,
  BookIcon,
  CheckIcon,
  ChatIcon,
  TrashIcon,
} from '../common/Icons';
import { Badge } from '../common/Badge';
import { copilotApi } from '../../api/copilotApi';
import { ProductContextPanel } from './ProductContextPanel';
import { createId, getCurrentTimeString } from '../../lib/id';
import { copilotReason } from '../../lib/copilotStatus';
import { SourceViewerModal } from './SourceViewerModal';

function renderInlineWithCitations(text, citations = [], onCitationClick) {
  if (!text) return null;
  const parts = text.split(/(\[C\d+\])/g);
  return parts.map((part, index) => {
    const match = part.match(/^\[(C\d+)\]$/);
    if (match) {
      const cid = match[1];
      const cite = citations.find((c) => c.citation_id === cid);
      const title = cite?.title || cite?.document_id || cid;
      const displayTitle = title.length > 26 ? title.slice(0, 26) + '…' : title;
      return (
        <button
          key={`cite-${index}`}
          type="button"
          onClick={() => onCitationClick(cite || { citation_id: cid, title })}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '1px 6px',
            margin: '0 3px',
            borderRadius: 5,
            backgroundColor: '#EFF6FF',
            border: '1px solid #BFDBFE',
            color: '#1D4ED8',
            fontSize: '0.76rem',
            fontWeight: 600,
            cursor: 'pointer',
            verticalAlign: 'baseline',
            transition: 'all 0.15s ease',
          }}
          title={cite ? `${cite.title || cite.document_id} (${cite.version || ''})` : cid}
        >
          <span>📄 {displayTitle}</span>
        </button>
      );
    }
    return renderFormattedText(part, index);
  });
}

function renderFormattedText(text, keyPrefix) {
  const boldParts = text.split(/(\*\*[^*]+\*\*)/g);
  return boldParts.map((bPart, bIdx) => {
    if (bPart.startsWith('**') && bPart.endsWith('**')) {
      return <strong key={`${keyPrefix}-b-${bIdx}`}>{bPart.slice(2, -2)}</strong>;
    }
    const codeParts = bPart.split(/(`[^`]+`)/g);
    return codeParts.map((cPart, cIdx) => {
      if (cPart.startsWith('`') && cPart.endsWith('`')) {
        return (
          <code
            key={`${keyPrefix}-c-${cIdx}`}
            style={{
              backgroundColor: '#F3F4F6',
              padding: '1px 5px',
              borderRadius: 4,
              fontSize: '0.85em',
              fontFamily: 'monospace',
            }}
          >
            {cPart.slice(1, -1)}
          </code>
        );
      }
      return cPart;
    });
  });
}

function renderMarkdownWithCitations(content, citations = [], onCitationClick) {
  if (!content) return null;
  const lines = content.split('\n');
  const elements = [];
  let tableRows = [];
  let listItems = [];
  let listType = null;

  const flushTable = () => {
    if (tableRows.length > 0) {
      const headerRow = tableRows[0];
      const hasSeparator = tableRows.length > 1 && /^\|?(\s*:?-+:?\s*\|?)+$/.test(tableRows[1].trim());
      const bodyRows = hasSeparator ? tableRows.slice(2) : tableRows.slice(1);

      const parseCells = (row) =>
        row
          .replace(/^\|/, '')
          .replace(/\|$/, '')
          .split('|')
          .map((c) => c.trim());

      const headers = parseCells(headerRow);

      elements.push(
        <div key={`table-${elements.length}`} style={{ overflowX: 'auto', margin: '12px 0' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '0.84rem',
              border: '1px solid #E5E7EB',
            }}
          >
            <thead>
              <tr style={{ backgroundColor: '#F9FAFB' }}>
                {headers.map((h, i) => (
                  <th
                    key={i}
                    style={{
                      padding: '8px 12px',
                      border: '1px solid #E5E7EB',
                      textAlign: 'left',
                      fontWeight: 700,
                      color: '#111827',
                    }}
                  >
                    {renderInlineWithCitations(h, citations, onCitationClick)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bodyRows.map((r, rIdx) => {
                const cells = parseCells(r);
                return (
                  <tr key={rIdx} style={{ backgroundColor: rIdx % 2 === 1 ? '#FAFAFA' : '#FFFFFF' }}>
                    {cells.map((cell, cIdx) => (
                      <td
                        key={cIdx}
                        style={{
                          padding: '8px 12px',
                          border: '1px solid #E5E7EB',
                          color: '#374151',
                        }}
                      >
                        {renderInlineWithCitations(cell, citations, onCitationClick)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );
      tableRows = [];
    }
  };

  const flushList = () => {
    if (listItems.length > 0) {
      if (listType === 'ol') {
        elements.push(
          <ol key={`ol-${elements.length}`} style={{ paddingLeft: 22, margin: '8px 0', fontSize: '0.9rem' }}>
            {listItems.map((item, i) => (
              <li key={i} style={{ marginBottom: 4 }}>
                {renderInlineWithCitations(item, citations, onCitationClick)}
              </li>
            ))}
          </ol>
        );
      } else {
        elements.push(
          <ul key={`ul-${elements.length}`} style={{ paddingLeft: 20, margin: '8px 0', fontSize: '0.9rem' }}>
            {listItems.map((item, i) => (
              <li key={i} style={{ marginBottom: 4 }}>
                {renderInlineWithCitations(item, citations, onCitationClick)}
              </li>
            ))}
          </ul>
        );
      }
      listItems = [];
      listType = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.length > 2) {
      flushList();
      tableRows.push(trimmed);
      continue;
    } else {
      flushTable();
    }

    if (/^[-*]\s+/.test(trimmed)) {
      if (listType === 'ol') flushList();
      listType = 'ul';
      listItems.push(trimmed.replace(/^[-*]\s+/, ''));
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      if (listType === 'ul') flushList();
      listType = 'ol';
      listItems.push(trimmed.replace(/^\d+\.\s+/, ''));
      continue;
    }

    flushList();

    if (!trimmed) {
      continue;
    }

    if (trimmed.startsWith('### ')) {
      elements.push(
        <h4 key={`h4-${elements.length}`} style={{ fontSize: '0.95rem', fontWeight: 700, margin: '14px 0 6px 0', color: '#111827' }}>
          {renderInlineWithCitations(trimmed.slice(4), citations, onCitationClick)}
        </h4>
      );
      continue;
    }
    if (trimmed.startsWith('## ')) {
      elements.push(
        <h3 key={`h3-${elements.length}`} style={{ fontSize: '1.02rem', fontWeight: 800, margin: '16px 0 8px 0', color: '#111827' }}>
          {renderInlineWithCitations(trimmed.slice(3), citations, onCitationClick)}
        </h3>
      );
      continue;
    }
    if (trimmed.startsWith('# ')) {
      elements.push(
        <h2 key={`h2-${elements.length}`} style={{ fontSize: '1.12rem', fontWeight: 800, margin: '18px 0 10px 0', color: '#111827' }}>
          {renderInlineWithCitations(trimmed.slice(2), citations, onCitationClick)}
        </h2>
      );
      continue;
    }

    elements.push(
      <p key={`p-${elements.length}`} style={{ margin: '6px 0', lineHeight: 1.6 }}>
        {renderInlineWithCitations(line, citations, onCitationClick)}
      </p>
    );
  }

  flushTable();
  flushList();

  return <>{elements}</>;
}

export function CopilotView({ onOpenDocument, initialQuery = '' }) {
  const [filterDomain, setFilterDomain] = useState('all');
  const [inputDraft, setInputDraft] = useState({ initialQuery, value: initialQuery || '' });
  const inputMessage = inputDraft.initialQuery === initialQuery ? inputDraft.value : initialQuery || '';
  const setInputMessage = (value) => setInputDraft({ initialQuery, value });

  const [loading, setLoading] = useState(false);
  const [streamStatus, setStreamStatus] = useState('');
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [customerContext, setCustomerContext] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [activeCitation, setActiveCitation] = useState(null);

  // Model browsing vs Resolved consultation context
  const [browseModel, setBrowseModel] = useState(null);
  const [resolvedContext, setResolvedContext] = useState({
    model: null,
    date: null,
    originMessageId: null,
    insights: [],
  });

  const sessionIdRef = useRef(localStorage.getItem('copilot_active_session_id') || null);
  const [currentSessionId, setCurrentSessionId] = useState(() => localStorage.getItem('copilot_active_session_id') || null);
  const [sessions, setSessions] = useState([]);
  const [showSidebar, setShowSidebar] = useState(true);

  const [messages, setMessages] = useState([
    {
      id: 'msg-welcome',
      role: 'assistant',
      time: getCurrentTimeString(),
      content:
        'Chào bạn! Tôi có thể giúp chuẩn bị cuộc gọi, so sánh xe và xử lý những băn khoăn của khách dựa trên tài liệu. Bạn có thể thêm ghi chú về nhu cầu khách hoặc chọn dòng xe bên phải để tôi đề xuất nội dung tư vấn phù hợp.',
      talking_points: [],
      citations: [],
    },
  ]);

  const messagesEndRef = useRef(null);
  const chatScrollContainerRef = useRef(null);
  const isNearBottomRef = useRef(true);
  const textareaRef = useRef(null);

  const filterChips = [
    { id: 'all', label: 'Tất cả lĩnh vực' },
    { id: 'specs', label: 'Thông số & Công nghệ' },
    { id: 'policy', label: 'Chính sách & Ưu đãi' },
    { id: 'charging', label: 'Pin & Trạm sạc V-GREEN' },
    { id: 'competitor', label: 'So sánh đối thủ' },
  ];

  const handleScroll = useCallback(() => {
    const el = chatScrollContainerRef.current;
    if (!el) return;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isNearBottomRef.current = distanceToBottom < 140;
  }, []);

  const scrollToBottomIfNeeded = useCallback(() => {
    if (isNearBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    scrollToBottomIfNeeded();
  }, [messages, loading, scrollToBottomIfNeeded]);

  const fetchSessions = async () => {
    try {
      const data = await copilotApi.getSessions();
      setSessions(Array.isArray(data) ? data : []);
    } catch (e) {
      console.warn('Failed to fetch sessions', e);
    }
  };

  const loadSession = async (sessionId) => {
    if (!sessionId || loading) return;
    setLoading(true);
    setError('');
    try {
      const data = await copilotApi.getSessionDetail(sessionId);
      if (data && data.messages && data.messages.length > 0) {
        setMessages(data.messages);
        setCustomerContext(data.customer_context || '');
        sessionIdRef.current = sessionId;
        setCurrentSessionId(sessionId);
        localStorage.setItem('copilot_active_session_id', sessionId);

        const lastWithInsights = [...data.messages].reverse().find(
          (m) => m.product_insights && m.product_insights.length > 0
        );
        if (lastWithInsights) {
          const detectedModel = lastWithInsights.product_insights[0]?.product_model;
          setResolvedContext({
            model: detectedModel === 'ALL' ? 'VinFast' : detectedModel,
            date: targetDate || '2026',
            originMessageId: lastWithInsights.id,
            insights: lastWithInsights.product_insights,
          });
        } else {
          setResolvedContext({
            model: null,
            date: null,
            originMessageId: null,
            insights: [],
          });
        }
      }
    } catch (err) {
      console.warn('Failed to load session', err);
      if (err.status === 404) {
        localStorage.removeItem('copilot_active_session_id');
        sessionIdRef.current = null;
        setCurrentSessionId(null);
        setResolvedContext({ model: null, date: null, originMessageId: null, insights: [] });
      }
    } finally {
      setLoading(false);
    }
  };

  // New Chat: Resets active conversation in UI without deleting historical session on server
  const handleNewChat = () => {
    sessionIdRef.current = null;
    setCurrentSessionId(null);
    localStorage.removeItem('copilot_active_session_id');
    setCustomerContext('');
    setTargetDate('');
    setInputMessage('');
    setError('');
    setBrowseModel(null);
    setResolvedContext({ model: null, date: null, originMessageId: null, insights: [] });
    setMessages([
      {
        id: createId('msg-welcome'),
        role: 'assistant',
        time: getCurrentTimeString(),
        content:
          'Chào bạn! Tôi có thể giúp chuẩn bị cuộc gọi, so sánh xe và xử lý những băn khoăn của khách dựa trên tài liệu. Bạn có thể thêm ghi chú về nhu cầu khách hoặc chọn dòng xe bên phải để tôi đề xuất nội dung tư vấn phù hợp.',
        talking_points: [],
        citations: [],
      },
    ]);
  };

  // Explicit session deletion on server via trash icon
  const handleDeleteSession = async (sessionId, e) => {
    e.stopPropagation();
    try {
      await copilotApi.deleteSession(sessionId);
      if (currentSessionId === sessionId) {
        handleNewChat();
      }
      fetchSessions();
    } catch (err) {
      console.warn('Failed to delete session', err);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const initSessions = async () => {
      try {
        const data = await copilotApi.getSessions();
        if (isMounted) {
          setSessions(Array.isArray(data) ? data : []);
        }
      } catch (e) {
        console.warn('Failed to fetch sessions', e);
      }
      const savedSessionId = localStorage.getItem('copilot_active_session_id');
      if (savedSessionId) {
        try {
          const detail = await copilotApi.getSessionDetail(savedSessionId);
          if (isMounted && detail && detail.messages && detail.messages.length > 0) {
            setMessages(detail.messages);
            setCustomerContext(detail.customer_context || '');
            sessionIdRef.current = savedSessionId;
            setCurrentSessionId(savedSessionId);
          }
        } catch (err) {
          if (err.status === 404) {
            localStorage.removeItem('copilot_active_session_id');
          }
        }
      }
    };
    initSessions();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleCopy = async (id, text) => {
    try {
      await navigator.clipboard?.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.warn('Clipboard write failed', err);
    }
  };

  const handleFillDraft = (text) => {
    setInputMessage(text);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleSend = async (textToSend) => {
    const queryText = (textToSend || inputMessage).trim();
    if (!queryText || loading) return;

    const draftBackup = queryText;
    const userMsg = {
      id: createId('usr'),
      role: 'user',
      time: getCurrentTimeString(),
      content: queryText,
    };

    const tempAiId = createId('ai');
    let accumulatedText = '';

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setLoading(true);
    setStreamStatus('Đang phân tích câu hỏi & đối chiếu ngữ cảnh...');
    setError('');
    isNearBottomRef.current = true;

    try {
      await copilotApi.queryStream(
        {
          query: queryText,
          session_id: sessionIdRef.current,
          customer_context: customerContext,
          domain: filterDomain,
          target_date: targetDate || undefined,
        },
        {
          onStatus: (data) => {
            if (data?.text) setStreamStatus(data.text);
          },
          onDelta: (data) => {
            if (data?.text) {
              accumulatedText += data.text;
              setMessages((prev) => {
                const existing = prev.find((m) => m.id === tempAiId);
                if (existing) {
                  return prev.map((m) => (m.id === tempAiId ? { ...m, content: accumulatedText } : m));
                }
                return [
                  ...prev,
                  {
                    id: tempAiId,
                    role: 'assistant',
                    time: getCurrentTimeString(),
                    content: accumulatedText,
                    citations: [],
                    product_insights: [],
                    talking_points: [],
                    status: 'streaming',
                  },
                ];
              });
            }
          },
          onInsights: (data) => {
            if (data?.product_insights && data.product_insights.length > 0) {
              const detected = data.product_insights[0]?.product_model;
              setResolvedContext({
                model: detected === 'ALL' ? 'VinFast' : detected,
                date: targetDate || '2026',
                originMessageId: tempAiId,
                insights: data.product_insights,
              });
            }
          },
          onFinal: (response) => {
            if (!response.answer && !accumulatedText) {
              throw new Error('Copilot chưa trả lời được câu hỏi này.');
            }
            if (response.session_id) {
              sessionIdRef.current = response.session_id;
              setCurrentSessionId(response.session_id);
              localStorage.setItem('copilot_active_session_id', response.session_id);
              fetchSessions();
            }

            if (response.product_insights && response.product_insights.length > 0) {
              const detected = response.product_insights[0]?.product_model;
              setResolvedContext({
                model: detected === 'ALL' ? 'VinFast' : detected,
                date: targetDate || '2026',
                originMessageId: tempAiId,
                insights: response.product_insights,
              });
            }

            const finalAiMsg = {
              id: tempAiId,
              role: 'assistant',
              time: getCurrentTimeString(),
              content: response.answer || accumulatedText,
              citations: response.citations || [],
              product_insights: response.product_insights || [],
              talking_points: response.talking_points || [],
              status: response.status || 'answered',
              reason_code: response.reason_code,
              missing_information: response.missing_information || [],
              sales_actions: response.sales_actions || [],
            };

            setMessages((prev) => {
              const hasPlaceholder = prev.some((m) => m.id === tempAiId);
              if (hasPlaceholder) {
                return prev.map((m) => (m.id === tempAiId ? finalAiMsg : m));
              }
              return [...prev, finalAiMsg];
            });
          },
          onError: (streamErr) => {
            console.warn('Stream error occurred:', streamErr);
          },
        }
      );
    } catch (requestError) {
      console.warn('Copilot query error:', requestError);
      const errText = requestError.message || 'Dịch vụ tra cứu tạm thời không khả dụng. Vui lòng thử lại sau.';
      setError(errText);
      setInputMessage(draftBackup); // Retain user's draft on failure so they can retry without losing input!

      setMessages((prev) => {
        const hasPlaceholder = prev.some((m) => m.id === tempAiId);
        const errMsg = {
          id: tempAiId,
          role: 'assistant',
          time: getCurrentTimeString(),
          content: `⚠️ **Không thể hoàn tất câu trả lời:**\n\n${errText}`,
          status: 'refused',
          citations: [],
          talking_points: [],
        };
        if (hasPlaceholder) {
          return prev.map((m) => (m.id === tempAiId ? errMsg : m));
        }
        return [...prev, errMsg];
      });
    } finally {
      setLoading(false);
      setStreamStatus('');
    }
  };

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: showSidebar ? '260px minmax(0, 1fr) 340px' : 'minmax(0, 1fr) 360px',
        gap: 20,
        alignItems: 'start',
      }}
    >
      {/* SESSIONS SIDEBAR */}
      {showSidebar && (
        <div
          className="card-white"
          style={{
            display: 'flex',
            flexDirection: 'column',
            height: 'calc(100vh - 140px)',
            minHeight: 600,
            padding: 0,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '16px 18px',
              borderBottom: '1px solid #E5E5E5',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#FFFFFF',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: '0.92rem', color: '#111827' }}>
              <ChatIcon style={{ width: 16, height: 16, color: '#2563EB' }} />
              <span>Lịch sử tư vấn</span>
            </div>
            <span
              style={{
                fontSize: '0.72rem',
                color: '#6B7280',
                backgroundColor: '#F3F4F6',
                padding: '2px 7px',
                borderRadius: 10,
                fontWeight: 600,
              }}
            >
              {sessions.length}
            </span>
          </div>

          <div style={{ padding: '12px 14px', borderBottom: '1px solid #F3F4F6' }}>
            <button
              type="button"
              onClick={handleNewChat}
              disabled={loading}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '9px 12px',
                backgroundColor: '#1D4ED8',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 8,
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background-color 0.15s ease',
              }}
            >
              <span>＋ Cuộc trò chuyện mới</span>
            </button>
          </div>

          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '8px 10px',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            {sessions.length === 0 ? (
              <div style={{ padding: '32px 12px', textAlign: 'center', color: '#9CA3AF', fontSize: '0.8rem' }}>
                Chưa có cuộc trò chuyện nào được lưu.
              </div>
            ) : (
              sessions.map((sess) => {
                const isActive = sess.session_id === currentSessionId;
                return (
                  <div
                    key={sess.session_id}
                    onClick={() => loadSession(sess.session_id)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 8,
                      cursor: 'pointer',
                      border: isActive ? '1px solid #3B82F6' : '1px solid #E5E7EB',
                      backgroundColor: isActive ? '#EFF6FF' : '#FAFAFA',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                      <span
                        style={{
                          fontSize: '0.82rem',
                          fontWeight: isActive ? 700 : 500,
                          color: isActive ? '#1D4ED8' : '#1F2937',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          flex: 1,
                        }}
                        title={sess.title}
                      >
                        {sess.title || 'Cuộc trò chuyện'}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteSession(sess.session_id, e)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#9CA3AF',
                          cursor: 'pointer',
                          padding: 2,
                          display: 'flex',
                          alignItems: 'center',
                        }}
                        title="Xóa phiên này"
                      >
                        <TrashIcon style={{ width: 13, height: 13 }} />
                      </button>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '0.72rem',
                        color: '#9CA3AF',
                      }}
                    >
                      <span>{sess.message_count ? `${sess.message_count} tin nhắn` : ''}</span>
                      <span>{sess.updated_at ? new Date(sess.updated_at).toLocaleDateString('vi-VN') : ''}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* LEFT MAIN CHAT CARD */}
      <div
        className="card-white"
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: 'calc(100vh - 140px)',
          minHeight: 600,
          padding: 0,
          overflow: 'hidden',
        }}
      >
        {/* HEADER */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid #E5E5E5',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#FFFFFF',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              type="button"
              onClick={() => setShowSidebar((prev) => !prev)}
              className="btn-ghost"
              style={{
                padding: '6px 8px',
                fontSize: '0.78rem',
                color: '#4B5563',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                borderRadius: 6,
              }}
              title={showSidebar ? 'Thu gọn lịch sử' : 'Hiện lịch sử'}
            >
              <ChatIcon style={{ width: 15, height: 15 }} />
              <span>{showSidebar ? 'Ẩn lịch sử' : 'Lịch sử'}</span>
            </button>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                backgroundColor: '#111111',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <SparkleIcon style={{ width: 18, height: 18 }} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#111111' }}>
                  VinFast AI Copilot
                </h2>
                <Badge variant="default" style={{ backgroundColor: '#F4F4F2', border: '1px solid #E0E0DD' }}>
                  <span
                    style={{
                      display: 'inline-block',
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      backgroundColor: '#166534',
                      marginRight: 4,
                    }}
                  />
                  Trợ lý sales
                </Badge>
              </div>
              <p style={{ fontSize: '0.78rem', color: '#737373', margin: 0 }}>
                Chuẩn bị tư vấn và đối chiếu thông tin với tài liệu
              </p>
            </div>
          </div>

          <button
            onClick={handleNewChat}
            disabled={loading}
            className="btn-ghost"
            style={{ fontSize: '0.8rem', color: '#737373' }}
            title="Bắt đầu cuộc trò chuyện mới"
          >
            <RefreshIcon style={{ width: 14, height: 14 }} />
            <span>Làm mới phiên chat</span>
          </button>
        </div>

        {/* DOMAIN FILTER CHIPS */}
        <div
          style={{
            padding: '10px 24px',
            borderBottom: '1px solid #F0F0EE',
            display: 'flex',
            gap: 8,
            overflowX: 'auto',
            backgroundColor: '#FAFAFA',
          }}
        >
          {filterChips.map((chip) => (
            <button
              key={chip.id}
              className={`chip ${filterDomain === chip.id ? 'active' : ''}`}
              onClick={() => setFilterDomain(chip.id)}
            >
              {chip.label}
            </button>
          ))}
        </div>

        <details style={{ padding: '10px 24px', borderBottom: '1px solid #F0F0EE' }}>
          <summary style={{ cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, color: '#374151' }}>
            Nhu cầu khách và ngày đối chiếu
          </summary>
          <textarea
            aria-label="Ghi chú nhu cầu khách"
            value={customerContext}
            onChange={(event) => setCustomerContext(event.target.value)}
            maxLength={6000}
            disabled={loading}
            placeholder="Ví dụ: Khách cân nhắc VF 5 và VF 6, có chỗ đỗ riêng, còn lo chi phí sử dụng pin."
            style={{
              width: '100%',
              minHeight: 70,
              marginTop: 8,
              padding: 10,
              border: '1px solid #E5E5E5',
              borderRadius: 8,
              fontSize: '0.85rem',
            }}
          />
          <label style={{ display: 'block', marginTop: 8, fontSize: '0.8rem', color: '#4B5563' }}>
            Ngày đối chiếu tài liệu (để trống để dùng ngày hiện tại):
            <input
              type="date"
              value={targetDate}
              onChange={(event) => setTargetDate(event.target.value)}
              disabled={loading}
              style={{ display: 'block', marginTop: 6, padding: '4px 8px', borderRadius: 6, border: '1px solid #D1D5DB' }}
            />
          </label>
        </details>

        {/* CHAT MESSAGES AREA */}
        <div
          ref={chatScrollContainerRef}
          onScroll={handleScroll}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
          }}
        >
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
                <div className="chat-bubble-ai" style={{ width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <div
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 6,
                        backgroundColor: '#111111',
                        color: '#FFFFFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <SparkleIcon style={{ width: 13, height: 13 }} />
                    </div>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#111111' }}>
                      VinFast Sales Copilot
                    </span>
                  </div>

                  {msg.status === 'needs_clarification' && (
                    <p style={{ marginBottom: 8, fontSize: '0.8rem', color: '#92400E', fontWeight: 600 }}>
                      ⚠️ Cần bạn bổ sung thông tin
                    </p>
                  )}
                  {msg.status === 'partial' && (
                    <p style={{ marginBottom: 8, fontSize: '0.8rem', color: '#92400E', fontWeight: 600 }}>
                      ℹ️ Đã xác minh được một phần
                    </p>
                  )}
                  {copilotReason(msg.reason_code) && (
                    <p role="status" style={{ fontSize: '0.8rem', color: '#92400E', marginBottom: 8 }}>
                      {copilotReason(msg.reason_code)}
                    </p>
                  )}

                  {/* Formatted body with Markdown & citations */}
                  <div style={{ fontSize: '0.92rem', color: '#222222', lineHeight: 1.6 }}>
                    {renderMarkdownWithCitations(msg.content, msg.citations, setActiveCitation)}
                  </div>

                  {msg.missing_information?.length > 0 && (
                    <div style={{ marginTop: 10, fontSize: '0.82rem', color: '#737373' }}>
                      <strong>Thông tin còn thiếu:</strong>
                      <ul style={{ paddingLeft: 20 }}>
                        {msg.missing_information.map((item, index) => (
                          <li key={index}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

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
                      <div
                        style={{
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          color: '#111111',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          marginBottom: 8,
                        }}
                      >
                        <span>💡 Gợi ý luận điểm thuyết phục khách hàng:</span>
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
                      <div
                        style={{
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          color: '#737373',
                          marginBottom: 6,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <BookIcon style={{ width: 12, height: 12 }} />
                        <span>Nguồn đối chiếu tài liệu chính thức:</span>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {msg.citations
                          .filter(
                            (cite, idx, self) =>
                              idx ===
                              self.findIndex(
                                (c) =>
                                  (c.document_id && c.document_id === cite.document_id) ||
                                  (c.title && c.title === cite.title)
                              )
                          )
                          .map((cite, cIdx) => (
                            <button
                              key={cIdx}
                              type="button"
                              onClick={() => setActiveCitation(cite)}
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
                                cursor: 'pointer',
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
                  {msg.sales_actions?.length > 0 && (
                    <div style={{ marginTop: 12, fontSize: '0.82rem' }}>
                      <strong>Bước trao đổi tiếp theo:</strong>
                      <ol style={{ paddingLeft: 20 }}>
                        {msg.sales_actions.map((action, index) => (
                          <li key={index}>{action}</li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {/* Footer actions */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginTop: 14,
                      paddingTop: 10,
                      borderTop: '1px solid #F4F4F2',
                      fontSize: '0.75rem',
                      color: '#888888',
                    }}
                  >
                    <span>{msg.time}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <button
                        onClick={() => handleCopy(msg.id, msg.content)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          color: '#666666',
                          fontSize: '0.75rem',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        {copiedId === msg.id ? (
                          <>
                            <CheckIcon style={{ width: 13, height: 13, color: '#166534' }} />
                            <span style={{ color: '#166534' }}>Đã sao chép</span>
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
            <div className="chat-bubble-ai" style={{ width: '80%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 6,
                    backgroundColor: '#111111',
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <SparkleIcon style={{ width: 12, height: 12 }} />
                </div>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#111111' }}>
                  {streamStatus || 'Copilot đang chuẩn bị nội dung tư vấn...'}
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

        {/* BOTTOM INPUT BAR (MULTILINE COMPOSER) */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid #E5E5E5', backgroundColor: '#FFFFFF' }}>
          {error && (
            <div
              role="alert"
              style={{
                color: '#991B1B',
                backgroundColor: '#FEF2F2',
                padding: '8px 12px',
                borderRadius: 6,
                fontSize: '0.82rem',
                marginBottom: 8,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span>{error}</span>
              <button
                type="button"
                onClick={() => handleSend()}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#B91C1C',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontSize: '0.78rem',
                }}
              >
                Thử lại
              </button>
            </div>
          )}

          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: 10,
              backgroundColor: '#F7F7F5',
              border: '1px solid #E5E5E5',
              borderRadius: 16,
              padding: '8px 12px 8px 16px',
            }}
          >
            <textarea
              ref={textareaRef}
              rows={1}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Nhập câu hỏi tư vấn... (Enter để gửi, Shift+Enter xuống dòng)"
              style={{
                flex: 1,
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontSize: '0.9rem',
                color: '#111111',
                resize: 'none',
                maxHeight: 140,
                minHeight: 24,
                lineHeight: 1.4,
                fontFamily: 'inherit',
              }}
              disabled={loading}
            />

            <button
              type="button"
              onClick={() => handleSend()}
              disabled={!inputMessage.trim() || loading}
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                backgroundColor: inputMessage.trim() ? '#111111' : '#D1D1CE',
                color: '#FFFFFF',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: inputMessage.trim() && !loading ? 'pointer' : 'default',
                transition: 'all 0.2s',
                flexShrink: 0,
              }}
              title="Gửi câu hỏi"
            >
              <SendIcon style={{ width: 16, height: 16 }} />
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT SIDEBAR: CONTEXT / COMPLEMENTARY INSIGHTS PANEL */}
      <ProductContextPanel
        browseModel={browseModel}
        resolvedModel={resolvedContext.model}
        resolvedDate={resolvedContext.date}
        originMessageId={resolvedContext.originMessageId}
        insights={resolvedContext.insights}
        loading={loading}
        onSelectBrowseModel={(model) => setBrowseModel(model)}
        onFillDraft={handleFillDraft}
        onSwitchModel={() => {
          setResolvedContext({ model: null, date: null, originMessageId: null, insights: [] });
        }}
        onCitationClick={(citation) => setActiveCitation(citation)}
        onCopy={handleCopy}
        copiedId={copiedId}
        onComposeMessage={(draft) => handleFillDraft(draft)}
      />

      <SourceViewerModal
        isOpen={!!activeCitation}
        onClose={() => setActiveCitation(null)}
        citation={activeCitation}
        onOpenDocument={onOpenDocument}
      />
    </div>
  );
}
