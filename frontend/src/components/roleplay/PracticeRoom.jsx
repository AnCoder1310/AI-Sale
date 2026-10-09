import { useState, useRef, useEffect } from 'react';
import { ChevronLeft, SendIcon } from '../common/Icons';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import { practiceApi } from '../../api/practiceApi';
import { createId } from '../../lib/id';
import { usePushToTalk } from '../../hooks/usePushToTalk';

export function PracticeRoom({
  scenario,
  session,
  onFinish,
  onExit,
}) {
  const [messages, setMessages] = useState(session?.messages || []);

  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [turnCount, setTurnCount] = useState(session?.turn_count || 0);
  const [stage, setStage] = useState(session?.conversation_stage || 'opening');
  const [terminationStatus, setTerminationStatus] = useState(session?.termination_status || 'active');
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState('text');
  const [voiceGender, setVoiceGender] = useState('female');
  const [transcribing, setTranscribing] = useState(false);
  const [voiceUsage, setVoiceUsage] = useState(null);
  const [voiceError, setVoiceError] = useState('');
  const [speakingId, setSpeakingId] = useState(null);

  const chatEndRef = useRef(null);
  const audioRef = useRef(null);
  const audioUrlsRef = useRef(new Map());

  const refreshVoiceUsage = async () => {
    try {
      setVoiceUsage(await practiceApi.voiceUsage(session.session_id));
    } catch {
      // Speech itself succeeded; usage remains available after a later refresh.
    }
  };

  const onRecorded = async (blob, durationSeconds) => {
    if (blob.size > 4_000_000) {
      setVoiceError('Ghi âm quá lớn. Hãy nói ngắn hơn rồi thử lại.');
      return;
    }
    setVoiceError('');
    setTranscribing(true);
    try {
      const result = await practiceApi.transcribeVoice(session.session_id, blob, durationSeconds);
      setInputMessage(result.transcript);
      await refreshVoiceUsage();
    } catch (requestError) {
      setVoiceError(requestError.message || 'Không nhận dạng được giọng nói. Hãy thử ghi lại.');
      await refreshVoiceUsage();
    } finally {
      setTranscribing(false);
    }
  };

  const recorder = usePushToTalk(onRecorded);

  const playCustomer = async (message) => {
    if (!message || message.role !== 'customer') return;
    const cacheKey = `${message.message_id}:${voiceGender}`;
    setVoiceError('');
    setSpeakingId(message.message_id);
    try {
      let url = audioUrlsRef.current.get(cacheKey);
      if (!url) {
        const blob = await practiceApi.customerSpeech(session.session_id, message.message_id, voiceGender);
        url = URL.createObjectURL(blob);
        audioUrlsRef.current.set(cacheKey, url);
        await refreshVoiceUsage();
      }
      audioRef.current?.pause();
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => setSpeakingId(null);
      await audio.play();
    } catch (requestError) {
      setVoiceError(requestError.name === 'NotAllowedError'
        ? 'Trình duyệt chặn tự phát âm thanh. Nhấn “Phát giọng khách” để nghe.'
        : requestError.message || 'Không phát được giọng khách. Hãy thử lại.');
      setSpeakingId(null);
    }
  };

  const stageLabels = {
    opening: 'Giai đoạn: Chào hỏi & Mở đầu',
    discovery: 'Giai đoạn: Khai thác nhu cầu',
    presentation: 'Giai đoạn: Giới thiệu giải pháp',
    objection_handling: 'Giai đoạn: Xử lý băn khoăn',
    closing: 'Giai đoạn: Chốt & Hướng dẫn',
    completed: 'Giai đoạn: Hoàn thành',
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => () => {
    audioRef.current?.pause();
    audioUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const handleSendMessage = async () => {
    const text = inputMessage.trim();
    if (!text || loading || finishing || transcribing || recorder.recordingState !== 'idle' || terminationStatus !== 'active') return;

    const advisorMsg = {
      message_id: createId('adv'),
      role: 'advisor',
      content: text,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, advisorMsg]);
    setInputMessage('');
    setLoading(true);
    setError('');

    try {
      const updated = await practiceApi.sendMessage(session.session_id, text);
      setMessages(updated.messages);
      setStage(updated.conversation_stage);
      setTurnCount(updated.turn_count);
      setTerminationStatus(updated.termination_status);
      if (mode === 'voice') {
        const customerReply = updated.messages.at(-1);
        if (customerReply?.role === 'customer') playCustomer(customerReply);
      }
    } catch (requestError) {
      setError(requestError.message || 'AI Customer chưa phản hồi. Phiên đã được lưu; vui lòng thử tải lại.');
      try {
        const saved = await practiceApi.getSession(session.session_id);
        setMessages(saved.messages);
        setStage(saved.conversation_stage);
        setTurnCount(saved.turn_count);
        setTerminationStatus(saved.termination_status);
      } catch {
        // Keep the advisor's visible draft; do not fabricate a customer reply.
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFinishSession = async () => {
    if (loading || finishing || transcribing || recorder.recordingState !== 'idle') return;
    setFinishing(true);
    setError('');
    try {
      const resultView = await practiceApi.finishSession(session.session_id);
      onFinish(resultView);
    } catch (requestError) {
      setError(requestError.message || 'Không thể chấm điểm lúc này. Phiên đã được lưu; hãy thử lại.');
    } finally {
      setFinishing(false);
      setShowFinishConfirm(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)', minHeight: 650, backgroundColor: '#FFFFFF', borderRadius: 16, border: '1px solid #E5E5E5', overflow: 'hidden' }}>
      {/* ROOM HEADER */}
      <div style={{ padding: '14px 20px', borderBottom: '1px solid #E5E5E5', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FAFAFA', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={onExit}
            className="btn-ghost"
            style={{ padding: '6px 10px', fontSize: '0.85rem' }}
          >
            <ChevronLeft style={{ width: 16, height: 16 }} />
            <span>Rời phòng</span>
          </button>

          <div style={{ height: 20, width: 1, backgroundColor: '#E5E5E5' }} />

          <div>
            <h2 style={{ fontSize: '0.98rem', fontWeight: 700, color: '#111111' }}>
              {scenario?.title}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
              <Badge variant="highlight">{scenario?.model_badge || scenario?.model}</Badge>
              <span style={{ fontSize: '0.75rem', color: '#666666' }}>
                {stageLabels[stage] || stage}
              </span>
              <span style={{ fontSize: '0.75rem', color: '#888888' }}>
                • Lượt trao đổi: {turnCount}/{session?.max_turns || scenario?.max_turns}
              </span>
            </div>
          </div>
        </div>

        <button
          className="btn-primary"
          style={{ backgroundColor: '#111111', fontSize: '0.82rem', padding: '8px 16px' }}
          onClick={() => setShowFinishConfirm(true)}
          disabled={loading || finishing || transcribing || recorder.recordingState !== 'idle'}
        >
          🏁 Kết thúc & Chấm điểm
        </button>
      </div>

      {/* CUSTOMER CONTEXT BANNER */}
      <div style={{ padding: '12px 20px', backgroundColor: '#F8F8F6', borderBottom: '1px solid #EDEDEA', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#111111' }}>
              Khách hàng • {scenario?.sales_channel || 'Kênh tư vấn'}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#737373' }}>
              {session?.visible_context}
            </div>
          </div>
        </div>
        <div style={{ fontSize: '0.78rem', color: '#555555', textAlign: 'right' }}>
          🎯 <strong>Mục tiêu:</strong> {scenario?.training_objective}
        </div>
      </div>

      {/* CHAT THREAD */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: 18, backgroundColor: '#FFFFFF' }}>
        {messages.map((m, idx) => (
          <div
            key={m.message_id || idx}
            style={{
              display: 'flex',
              gap: 12,
              alignItems: 'flex-start',
              alignSelf: m.role === 'advisor' ? 'flex-end' : 'flex-start',
              maxWidth: '85%',
            }}
          >

            <div
              style={{
                padding: '14px 18px',
                borderRadius: 14,
                backgroundColor: m.role === 'advisor' ? '#111111' : '#F4F4F2',
                color: m.role === 'advisor' ? '#FFFFFF' : '#111111',
                fontSize: '0.92rem',
                lineHeight: 1.5,
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}
            >
              <div style={{ fontSize: '0.72rem', fontWeight: 700, marginBottom: 4, opacity: 0.7 }}>
                {m.role === 'advisor' ? 'Bạn (Tư vấn viên)' : 'Khách hàng'}
              </div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>
              {mode === 'voice' && m.role === 'customer' && (
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => playCustomer(m)}
                  disabled={speakingId === m.message_id}
                  style={{ marginTop: 8, fontSize: '0.78rem' }}
                >
                  {speakingId === m.message_id ? 'Đang phát...' : '🔊 Phát giọng khách'}
                </button>
              )}
            </div>

            {m.role === 'advisor' && (
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  backgroundColor: '#111111',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                An
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ padding: '12px 18px', borderRadius: 14, backgroundColor: '#F4F4F2', fontSize: '0.85rem', color: '#666666' }}>
              Khách hàng đang soạn câu trả lời...
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* INPUT BAR */}
      <div style={{ padding: '16px 20px', borderTop: '1px solid #E5E5E5', backgroundColor: '#FAFAFA' }}>
        {error && <p role="alert" style={{ color: '#991B1B', fontSize: '0.82rem', marginBottom: 8 }}>{error}</p>}
        {(voiceError || recorder.recordingError) && <p role="alert" style={{ color: '#991B1B', fontSize: '0.82rem', marginBottom: 8 }}>{voiceError || recorder.recordingError}</p>}
        {terminationStatus !== 'active' && <p style={{ fontSize: '0.82rem', marginBottom: 8 }}>Đã đạt giới hạn lượt. Hãy kết thúc để xem đánh giá.</p>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
          <button type="button" className={mode === 'text' ? 'btn-primary' : 'btn-ghost'} onClick={() => setMode('text')} disabled={recorder.recordingState !== 'idle'}>Chế độ chữ</button>
          <button type="button" className={mode === 'voice' ? 'btn-primary' : 'btn-ghost'} onClick={() => { setMode('voice'); refreshVoiceUsage(); }} disabled={recorder.recordingState !== 'idle'}>Chế độ nói</button>
          {mode === 'voice' && (
            <>
              <label style={{ fontSize: '0.82rem' }} htmlFor="customer-voice">Giọng khách:</label>
              <select id="customer-voice" value={voiceGender} onChange={(event) => setVoiceGender(event.target.value)}>
                <option value="female">Nữ</option>
                <option value="male">Nam</option>
              </select>
              {voiceUsage && <span style={{ fontSize: '0.75rem', color: '#666666' }}>Giọng nói: {voiceUsage.stt_requests} lượt nhận dạng, {voiceUsage.tts_requests} lượt phát • ước tính ${voiceUsage.estimated_usd.toFixed(4)}</span>}
            </>
          )}
        </div>
        {mode === 'voice' && terminationStatus === 'active' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <button
              type="button"
              className="btn-primary"
              style={{ touchAction: 'none', backgroundColor: recorder.recordingState === 'recording' ? '#991B1B' : '#111111' }}
              onPointerDown={(event) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); recorder.start(); }}
              onPointerUp={recorder.stop}
              onPointerCancel={recorder.stop}
              onKeyDown={(event) => { if (!event.repeat && [' ', 'Enter'].includes(event.key)) { event.preventDefault(); recorder.start(); } }}
              onKeyUp={(event) => { if ([' ', 'Enter'].includes(event.key)) { event.preventDefault(); recorder.stop(); } }}
              disabled={loading || finishing || transcribing}
              aria-label="Giữ để nói tiếng Việt, thả để nhận dạng"
            >
              🎙️ {recorder.recordingState === 'requesting' ? 'Đang xin quyền micro...' : recorder.recordingState === 'recording' ? 'Thả để nhận dạng' : 'Giữ để nói'}
            </button>
            <span style={{ fontSize: '0.78rem', color: '#666666' }}>{transcribing ? 'Đang nhận dạng tiếng Việt...' : 'Giữ nút để nói tối đa 60 giây; sửa bản chép trước khi gửi.'}</span>
          </div>
        )}
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <textarea
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder={mode === 'voice' ? 'Bản chép giọng nói sẽ hiện ở đây. Bạn có thể sửa trước khi gửi.' : 'Nhập nội dung tư vấn khách hàng... (Nhấn Enter để gửi, Shift+Enter xuống dòng)'}
            rows={2}
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: 10,
              border: '1px solid #D1D1CE',
              outline: 'none',
              resize: 'none',
              fontSize: '0.9rem',
              lineHeight: 1.4,
              backgroundColor: '#FFFFFF',
            }}
            disabled={loading || finishing || transcribing || recorder.recordingState !== 'idle' || terminationStatus !== 'active'}
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() || loading || finishing || transcribing || recorder.recordingState !== 'idle' || terminationStatus !== 'active'}
            className="btn-primary"
            style={{ height: 46, padding: '0 20px' }}
          >
            <SendIcon style={{ width: 16, height: 16 }} />
            <span>Gửi</span>
          </button>
        </div>
      </div>

      {/* FINISH MODAL */}
      <Modal
        isOpen={showFinishConfirm}
        onClose={() => setShowFinishConfirm(false)}
        title="Xác nhận hoàn tất phiên thực chiến"
        maxWidth={500}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ fontSize: '0.92rem', color: '#333333', lineHeight: 1.5 }}>
            Bạn có chắc chắn muốn kết thúc phiên và gửi tới Hệ thống Chấm điểm AI không?
          </p>
          <div style={{ backgroundColor: '#F7F7F5', padding: '12px 16px', borderRadius: 8, fontSize: '0.82rem', color: '#555555' }}>
            Hội thoại sẽ được đóng băng và đánh giá tự động dựa trên <strong>5 tiêu chí Rubric chuẩn</strong> cùng kiểm chứng thông số sản phẩm.
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
            <Button variant="outline" onClick={() => setShowFinishConfirm(false)}>
              Tiếp tục luyện tập
            </Button>
            <Button variant="primary" loading={finishing} onClick={handleFinishSession}>
              Hoàn tất & Chấm điểm
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
