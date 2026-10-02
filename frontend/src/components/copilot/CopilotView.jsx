import { useState, useRef, useEffect } from 'react';
import {
  SparkleIcon,
  RefreshIcon,
  CopyIcon,
  ThumbsUpIcon,
  ThumbsDownIcon,
  MicIcon,
  SendIcon,
  ChevronRight,
  BookIcon,
  CheckIcon,
} from '../common/Icons';
import { Badge } from '../common/Badge';
import { copilotApi } from '../../api/copilotApi';
import { FAQ_QUESTIONS, CHEAT_SHEET_DATA } from '../../data/faqData';
import { createId, getCurrentTimeString } from '../../lib/id';

export function CopilotView({ onOpenDocument, initialQuery = '' }) {
  const [filterDomain, setFilterDomain] = useState('all');
  const [inputMessage, setInputMessage] = useState(initialQuery || '');
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [messages, setMessages] = useState([
    {
      id: 'msg-welcome',
      role: 'assistant',
      time: '10:00',
      content:
        'Chào bạn! Tôi là **AI Sales Copilot**. Tôi có thể hỗ trợ bạn tra cứu nhanh thông số kỹ thuật, giá bán, chính sách pin và kịch bản tư vấn xe VinFast 2026.\n\nBạn cần tra cứu thông tin gì hôm nay?',
      talking_points: [
        'Kiểm tra ưu đãi trước bạ 0% và sạc V-GREEN',
        'So sánh chi phí xe điện vs xe xăng cùng phân khúc',
        'Chính sách đổi pin khi SOH < 70%',
      ],
      citations: [],
    },
  ]);

  const messagesEndRef = useRef(null);

  const filterChips = [
    { id: 'all', label: 'Tất cả lĩnh vực' },
    { id: 'specs', label: 'Thông số & Công nghệ' },
    { id: 'policy', label: 'Chính sách & Ưu đãi' },
    { id: 'charging', label: 'Pin & Trạm sạc V-GREEN' },
    { id: 'competitor', label: 'So sánh đối thủ' },
    { id: 'calculator', label: 'Máy tính Trả góp' },
  ];

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

    try {
      const response = await copilotApi.query({ query: queryText });
      const aiMsg = {
        id: createId('ai'),
        role: 'assistant',
        time: getCurrentTimeString(),
        content: response.answer || response.response || 'Đã tìm thấy thông tin từ kho tài liệu.',
        citations: response.citations || [],
        talking_points: response.talking_points || [],
        suggested_message: response.suggested_message || '',
        suggested_next_question: response.suggested_next_question || '',
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch {
      const fallbackAiMsg = {
        id: createId('ai-err'),
        role: 'assistant',
        time: getCurrentTimeString(),
        content:
          'Xin lỗi bạn, kết nối đến dịch vụ Copilot đang bận hoặc gián đoạn. Dưới đây là thông tin tham khảo dựa trên quy chuẩn bán hàng 2026:\n\n• Chính sách pin: Khách thuê pin được bảo hành đổi mới khi dung lượng SOH < 70%.\n• Ưu đãi trước bạ: 0% theo quy định Nhà nước.\n• Mạng lưới V-GREEN: 150.000+ cổng sạc toàn quốc, hỗ trợ sạc nhanh DC 10-70% trong ~24-30 phút.',
        talking_points: [
          'Kiểm tra tình trạng SOH pin thực tế qua VinFast App',
          'Tư vấn gói thuê pin linh hoạt theo quãng đường',
        ],
        citations: [
          {
            document_id: 'POLICY_BATTERY_RENTAL_CONTRACT_20260801',
            title: 'HỢP ĐỒNG CHO THUÊ PIN XE ĐIỆN VINFAST 2026',
          },
        ],
      };
      setMessages((prev) => [...prev, fallbackAiMsg]);
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
    setMessages([
      {
        id: createId('msg-reset'),
        role: 'assistant',
        time: getCurrentTimeString(),
        content:
          'Phiên làm việc mới đã được khởi tạo. Bạn cần tra cứu thông số kỹ thuật, giá bán hay chính sách xe VinFast nào?',
        talking_points: [
          'So sánh chi phí thuê pin vs mua đứt VF 8',
          'Thời gian sạc nhanh DC và trạm V-GREEN Nghệ An',
          'Các tính năng ADAS trên VF 7 và VF 8',
        ],
        citations: [],
      },
    ]);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: 24, alignItems: 'start' }}>
      {/* LEFT MAIN CHAT CARD */}
      <div className="card-white" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 140px)', minHeight: 600, padding: 0, overflow: 'hidden' }}>
        {/* HEADER */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #E5E5E5', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFFFFF' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: '#111111', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <SparkleIcon style={{ width: 18, height: 18 }} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#111111' }}>
                  VinFast AI Copilot
                </h2>
                <Badge variant="default" style={{ backgroundColor: '#F4F4F2', border: '1px solid #E0E0DD' }}>
                  <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', backgroundColor: '#166534', marginRight: 4 }} />
                  RAG Grounded
                </Badge>
              </div>
              <p style={{ fontSize: '0.78rem', color: '#737373' }}>
                Truy vấn tài liệu chính thức, thông số kỹ thuật và chính sách 2026
              </p>
            </div>
          </div>

          <button
            onClick={handleResetChat}
            className="btn-ghost"
            style={{ fontSize: '0.8rem', color: '#737373' }}
            title="Làm mới phiên chat"
          >
            <RefreshIcon style={{ width: 14, height: 14 }} />
            <span>Làm mới phiên chat</span>
          </button>
        </div>

        {/* DOMAIN FILTER CHIPS */}
        <div style={{ padding: '10px 24px', borderBottom: '1px solid #F0F0EE', display: 'flex', gap: 8, overflowX: 'auto', backgroundColor: '#FAFAFA' }}>
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

        {/* CHAT MESSAGES AREA */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
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
                  {/* AI header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <div style={{ width: 24, height: 24, borderRadius: 6, backgroundColor: '#111111', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <SparkleIcon style={{ width: 13, height: 13 }} />
                    </div>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#111111' }}>
                      VinFast Sales Copilot
                    </span>
                  </div>

                  {/* Body text */}
                  <div style={{ fontSize: '0.92rem', color: '#222222', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                    {msg.content}
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
                      <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#737373', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <BookIcon style={{ width: 12, height: 12 }} />
                        <span>Nguồn đối chiếu tài liệu chính thức:</span>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {msg.citations.map((cite, cIdx) => (
                          <button
                            key={cIdx}
                            onClick={() => onOpenDocument && onOpenDocument(cite.document_id)}
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
                        👉 Gợi ý hỏi tiếp: <strong>{msg.suggested_next_question}</strong>
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
                      <button style={{ color: '#888888' }} title="Hữu ích">
                        <ThumbsUpIcon style={{ width: 13, height: 13 }} />
                      </button>
                      <button style={{ color: '#888888' }} title="Chưa chính xác">
                        <ThumbsDownIcon style={{ width: 13, height: 13 }} />
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
                <div style={{ width: 20, height: 20, borderRadius: 6, backgroundColor: '#111111', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <SparkleIcon style={{ width: 12, height: 12 }} />
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
        <div style={{ padding: '16px 24px', borderTop: '1px solid #E5E5E5', backgroundColor: '#FFFFFF' }}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              backgroundColor: '#F7F7F5',
              border: '1px solid #E5E5E5',
              borderRadius: 9999,
              padding: '6px 12px 6px 20px',
            }}
          >
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Hỏi về thông số xe, pin thuê vs mua, ưu đãi trước bạ (hoặc bấm Micro nói)..."
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
              type="button"
              onClick={() => alert('Đang kích hoạt Micro ghi âm giọng nói')}
              style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                backgroundColor: '#EAEAE7',
                color: '#555555',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Nhập bằng giọng nói"
            >
              <MicIcon style={{ width: 16, height: 16 }} />
            </button>

            <button
              type="submit"
              disabled={!inputMessage.trim() || loading}
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                backgroundColor: inputMessage.trim() ? '#111111' : '#D1D1CE',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
              }}
              title="Gửi câu hỏi"
            >
              <SendIcon style={{ width: 16, height: 16 }} />
            </button>
          </form>
        </div>
      </div>

      {/* RIGHT SIDEBAR: FAQ + QUICK CHEAT-SHEET */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* CARD: CÂU HỎI THƯỜNG GẶP */}
        <div className="card-white" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ borderBottom: '1px solid #F0F0EE', paddingBottom: 12 }}>
            <h3 style={{ fontSize: '0.85rem', fontWeight: 800, color: '#111111', letterSpacing: '0.04em' }}>
              ? CÂU HỎI THƯỜNG GẶP
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {FAQ_QUESTIONS.map((item) => (
              <div
                key={item.id}
                onClick={() => handleSend(item.query)}
                style={{
                  padding: '12px 14px',
                  borderRadius: 10,
                  border: '1px solid #EAEAE6',
                  backgroundColor: '#FFFFFF',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 10,
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#F7F7F5';
                  e.currentTarget.style.borderColor = '#D0D0CB';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#FFFFFF';
                  e.currentTarget.style.borderColor = '#EAEAE6';
                }}
              >
                <span style={{ fontSize: '0.82rem', fontWeight: 500, color: '#222222', lineHeight: 1.35 }}>
                  {item.question}
                </span>
                <ChevronRight style={{ width: 14, height: 14, color: '#888888', flexShrink: 0 }} />
              </div>
            ))}
          </div>
        </div>

        {/* CARD: QUICK CHEAT-SHEET 2026 */}
        <div className="card-dark" style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'inline-block', backgroundColor: 'rgba(255, 255, 255, 0.1)', padding: '3px 8px', borderRadius: 4, width: 'fit-content' }}>
            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#E0E0E0', letterSpacing: '0.05em' }}>
              {CHEAT_SHEET_DATA.title}
            </span>
          </div>

          <h4 style={{ fontSize: '0.98rem', fontWeight: 700, color: '#FFFFFF' }}>
            {CHEAT_SHEET_DATA.subtitle}
          </h4>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
            {CHEAT_SHEET_DATA.items.map((item, idx) => (
              <div key={idx} style={{ fontSize: '0.82rem', color: '#D4D4D4', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                <span style={{ color: '#FFFFFF' }}>•</span>
                <div>
                  <span style={{ color: '#999999' }}>{item.label}: </span>
                  <span style={{ fontWeight: 600, color: '#FFFFFF' }}>{item.value}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
