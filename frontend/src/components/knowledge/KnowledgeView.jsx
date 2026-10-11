import { useEffect, useState } from 'react';
import {
  SearchIcon,
  BookIcon,
  ChevronRight,
  SparkleIcon,
  FileTextIcon,
  CopyIcon,
  CheckIcon,
  AlertCircleIcon,
  UploadIcon,
  CheckCircleIcon,
} from '../common/Icons';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';
import { VEHICLES, REQUIRED_VEHICLE_PDFS } from '../../data/vehicleData';
import { POLICIES, REQUIRED_POLICY_PDFS } from '../../data/policyData';
import { PRICING_TARIFFS, REQUIRED_FEE_PDFS } from '../../data/feeData';
import { FAQ_QUESTIONS, REQUIRED_FAQ_PDFS } from '../../data/faqData';
import {
  REQUIRED_DOC_CATEGORIES,
  TOTAL_REQUIRED_PDFS,
  INGESTION_GUIDE,
} from '../../data/requiredDocsData';
import { copilotApi } from '../../api/copilotApi';

export function KnowledgeView({ onOpenCopilotQuery, sourceDocumentId }) {
  const [subTab, setSubTab] = useState('policies'); // 'policies' | 'fees' | 'vehicles' | 'faq' | 'checklist'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [viewingPdf, setViewingPdf] = useState(null); // { title, url, filename }
  const [sourceError, setSourceError] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    if (!sourceDocumentId) return;
    let active = true;
    copilotApi.getSource(sourceDocumentId)
      .then((document) => { if (active) setSelectedDocument(document); })
      .catch(() => { if (active) setSourceError('Không mở được tài liệu gốc. Vui lòng thử lại.'); });
    return () => { active = false; };
  }, [sourceDocumentId]);

  const handleCopyText = (text, id) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleOpenDocument = async (docId, fallbackTitle = '') => {
    setSourceError('');
    try {
      const doc = await copilotApi.getSource(docId);
      setSelectedDocument(doc);
    } catch {
      setSourceError(`Chưa tìm thấy tệp dữ liệu text cho "${fallbackTitle || docId}". Hãy mở xem trực tiếp file PDF bên dưới.`);
    }
  };

  // Filter real data arrays (derived from real PDF files in frontend/src/data)
  const filteredPolicies = POLICIES.filter(
    (p) =>
      p.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.filename?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.summary?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredFees = PRICING_TARIFFS.filter(
    (f) =>
      f.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.filename?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.summary?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredVehicles = VEHICLES.filter(
    (v) =>
      v.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.segment?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredFaqs = FAQ_QUESTIONS.filter(
    (f) =>
      f.question?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Filter required PDF checklist arrays
  const filterPdfList = (list) => {
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (item) =>
        item.title?.toLowerCase().includes(q) ||
        item.filename?.toLowerCase().includes(q) ||
        item.document_id?.toLowerCase().includes(q) ||
        item.category?.toLowerCase().includes(q) ||
        item.model?.toLowerCase().includes(q) ||
        item.required_contents?.some((c) => c.toLowerCase().includes(q))
    );
  };

  const filteredVehiclePdfs = filterPdfList(REQUIRED_VEHICLE_PDFS);
  const filteredPolicyPdfs = filterPdfList(REQUIRED_POLICY_PDFS);
  const filteredFeePdfs = filterPdfList(REQUIRED_FEE_PDFS);
  const filteredFaqPdfs = filterPdfList(REQUIRED_FAQ_PDFS);

  // Render card for a Real PDF Document
  const renderRealDocCard = (doc) => {
    const isCopied = copiedId === doc.id || copiedId === doc.filename;
    return (
      <div
        key={doc.id}
        className="card-white"
        style={{
          padding: '20px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          border: '1px solid #E2E8F0',
          borderLeft: '4px solid #111111',
          borderRadius: 10,
          backgroundColor: '#FFFFFF',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Badge variant="highlight">{doc.category}</Badge>
            <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
              Hiệu lực: {doc.effective_date}
            </span>
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                color: '#18181B',
                backgroundColor: '#F4F4F5',
                padding: '3px 8px',
                borderRadius: 4,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <CheckCircleIcon style={{ width: 12, height: 12 }} />
              {doc.status}
            </span>
            {doc.file_size && (
              <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
                Dung lượng: <strong>{doc.file_size}</strong>
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              className="btn-primary"
              onClick={() => setViewingPdf({ title: doc.title, url: doc.file_url, filename: doc.filename })}
              style={{ fontSize: '0.78rem', padding: '6px 14px' }}
            >
              <span>Xem trực tiếp PDF</span>
              <ChevronRight style={{ width: 12, height: 12 }} />
            </button>
            <a
              href={doc.file_url}
              download={doc.filename}
              className="btn-outline"
              style={{ fontSize: '0.78rem', padding: '6px 12px', textDecoration: 'none' }}
              title="Tải tệp PDF về máy"
            >
              <span>Tải file</span>
            </a>
          </div>
        </div>

        <div>
          <h3 style={{ fontSize: '1.08rem', fontWeight: 700, color: '#0F172A' }}>
            {doc.title}
          </h3>
          <p style={{ fontSize: '0.86rem', color: '#475569', marginTop: 4, lineHeight: 1.5 }}>
            {doc.summary}
          </p>
        </div>

        {/* Key Points Box */}
        {doc.key_points && doc.key_points.length > 0 && (
          <div style={{ backgroundColor: '#F8FAFC', padding: '12px 16px', borderRadius: 8, border: '1px solid #E2E8F0' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1E293B', display: 'block', marginBottom: 6, letterSpacing: '0.04em' }}>
              ĐIỀU KHOẢN CỐT LÕI TƯ VẤN VIÊN CẦN NẮM:
            </span>
            <ul style={{ listStyle: 'none', paddingLeft: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {doc.key_points.map((pt, idx) => (
                <li key={idx} style={{ fontSize: '0.82rem', color: '#334155', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                  <span style={{ color: '#18181B', fontWeight: 700 }}>✓</span>
                  <span>{pt}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Footer specs & actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, paddingTop: 10, borderTop: '1px solid #F1F5F9', fontSize: '0.75rem', color: '#64748B' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <FileTextIcon style={{ width: 14, height: 14, color: '#52525B' }} />
            <span style={{ color: '#334155' }}>Tên file PDF nguồn: <code>{doc.filename}</code></span>
            <button
              onClick={() => handleCopyText(doc.filename, doc.filename)}
              title="Sao chép tên file"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                fontSize: '0.72rem',
                color: isCopied ? '#111111' : '#64748B',
                padding: '2px 6px',
                borderRadius: 4,
                backgroundColor: '#F1F5F9',
              }}
            >
              {isCopied ? <CheckIcon style={{ width: 11, height: 11 }} /> : <CopyIcon style={{ width: 11, height: 11 }} />}
              <span>{isCopied ? 'Đã sao chép' : 'Chép tên'}</span>
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              className="btn-outline"
              onClick={() => onOpenCopilotQuery && onOpenCopilotQuery(`Tra cứu tóm tắt điều khoản trong tài liệu "${doc.title}"`)}
              style={{ fontSize: '0.75rem', padding: '4px 10px' }}
            >
              <span>Hỏi Copilot</span>
              <SparkleIcon style={{ width: 12, height: 12 }} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Component rendering a Required PDF Card
  const renderPdfItemCard = (pdf) => {
    const isCopied = copiedId === pdf.id || copiedId === pdf.filename;
    return (
      <div
        key={pdf.id}
        className="card-white"
        style={{
          padding: '20px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          border: '1px solid #ECECE8',
          borderLeft: '4px solid #71717A',
          borderRadius: 10,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {pdf.model && <Badge variant="highlight">{pdf.model}</Badge>}
            {pdf.category && <Badge variant="default">{pdf.category}</Badge>}
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                color: '#52525B',
                backgroundColor: '#F4F4F5',
                padding: '3px 8px',
                borderRadius: 4,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              ⏳ {pdf.status}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '0.75rem', color: '#737373' }}>
              Mã tài liệu: <code style={{ backgroundColor: '#F3F4F6', padding: '2px 6px', borderRadius: 4, fontWeight: 700, color: '#111827' }}>{pdf.document_id}</code>
            </span>
          </div>
        </div>

        <div>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#111111' }}>
            {pdf.title}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
            <FileTextIcon style={{ width: 14, height: 14, color: '#52525B' }} />
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1F2937' }}>
              Tên file chuẩn: <code>{pdf.filename}</code>
            </span>
            <button
              onClick={() => handleCopyText(pdf.filename, pdf.filename)}
              title="Sao chép tên file PDF"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                fontSize: '0.75rem',
                color: isCopied ? '#111111' : '#6B7280',
                padding: '2px 6px',
                borderRadius: 4,
                backgroundColor: '#F3F4F6',
              }}
            >
              {isCopied ? <CheckIcon style={{ width: 12, height: 12 }} /> : <CopyIcon style={{ width: 12, height: 12 }} />}
              <span>{isCopied ? 'Đã sao chép tên file' : 'Sao chép'}</span>
            </button>
          </div>
        </div>

        {/* Required Contents Box */}
        <div style={{ backgroundColor: '#F9FAFB', padding: '12px 16px', borderRadius: 8, border: '1px solid #E5E7EB' }}>
          <div style={{ fontSize: '0.76rem', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
            📌 CÁC MỤC NỘI DUNG CẦN CÓ TRONG TỆP PDF:
          </div>
          <ul style={{ listStyle: 'none', paddingLeft: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
            {pdf.required_contents?.map((item, idx) => (
              <li key={idx} style={{ fontSize: '0.82rem', color: '#4B5563', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                <span style={{ color: '#71717A', fontWeight: 700 }}>•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer specs & actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, paddingTop: 10, borderTop: '1px solid #F3F4F6', fontSize: '0.75rem', color: '#6B7280' }}>
          <div>
            <span>Định dạng: <strong>{pdf.target_format || 'PDF (.pdf)'}</strong></span>
            {pdf.recommended_pages && <span> • Khuyến nghị: <strong>{pdf.recommended_pages}</strong></span>}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              className="btn-outline"
              onClick={() => handleOpenDocument(pdf.document_id, pdf.title)}
              style={{ fontSize: '0.78rem', padding: '6px 12px' }}
            >
              <span>Kiểm tra tệp mẫu</span>
              <ChevronRight style={{ width: 12, height: 12 }} />
            </button>
            <button
              className="btn-primary"
              onClick={() => onOpenCopilotQuery && onOpenCopilotQuery(`Tra cứu thông tin về ${pdf.title} theo mã ${pdf.document_id}`)}
              style={{ fontSize: '0.78rem', padding: '6px 12px' }}
            >
              <span>Hỏi Copilot</span>
              <SparkleIcon style={{ width: 12, height: 12 }} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Component for section header when data is empty
  const renderEmptySectionNotice = (title, count, docType) => (
    <div
      style={{
        padding: '24px 28px',
        borderRadius: 12,
        backgroundColor: '#FFFFFF',
        border: '1px solid #E5E7EB',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: '#F4F4F5', color: '#18181B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <AlertCircleIcon style={{ width: 20, height: 20 }} />
        </div>
        <div>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#111827' }}>
            {title} — Dữ liệu đang để trống
          </h2>
          <p style={{ fontSize: '0.85rem', color: '#6B7280', marginTop: 2 }}>
            Hệ thống không sử dụng dữ liệu tự tạo. Danh sách hiện đang để trống theo yêu cầu và sẵn sàng tiếp nhận {count} tệp PDF tài liệu chính thức từ quản trị viên.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', backgroundColor: '#F9FAFB', padding: '10px 16px', borderRadius: 8, fontSize: '0.8rem', color: '#4B5563' }}>
        <span>📂 Thư mục tiếp nhận: <code style={{ fontWeight: 700, color: '#111827' }}>data/knowledge/</code></span>
        <span>•</span>
        <span>📁 Số lượng tệp cần nạp: <strong style={{ color: '#18181B' }}>{count} tệp PDF</strong></span>
        <span>•</span>
        <span>📑 Định dạng: <code>{docType}</code></span>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {sourceError && (
        <div
          role="alert"
          style={{
            padding: '12px 16px',
            borderRadius: 8,
            backgroundColor: '#FEF2F2',
            border: '1px solid #FCA5A5',
            color: '#991B1B',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
          }}
        >
          <span>{sourceError}</span>
          <button
            onClick={() => setSourceError('')}
            style={{ background: 'none', border: 'none', color: '#991B1B', cursor: 'pointer', fontWeight: 700 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* TOP HEADER & SEARCH */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, backgroundColor: '#FFFFFF', border: '1px solid #E5E5E5', padding: '4px 10px', borderRadius: 9999, marginBottom: 8 }}>
            <BookIcon style={{ width: 13, height: 13, color: '#111111' }} />
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#111111' }}>
              Kho Kiến thức & Cẩm nang Chuẩn hóa 2026
            </span>
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#111111', letterSpacing: '-0.02em' }}>
            Cẩm nang Sản phẩm, Chính sách & Biểu phí Bán hàng
          </h1>
          <p style={{ fontSize: '0.88rem', color: '#737373', marginTop: 4 }}>
            Tra cứu các tệp văn bản PDF hợp đồng mua bán, chính sách pin, biểu phí bán xe và hạ tầng trạm sạc VinFast.
          </p>
        </div>

        {/* SEARCH BAR */}
        <div style={{ position: 'relative', width: 280 }}>
          <SearchIcon style={{ position: 'absolute', left: 12, top: 12, width: 16, height: 16, color: '#888888' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo tên file, dòng xe, mã số..."
            style={{
              width: '100%',
              padding: '9px 12px 9px 36px',
              borderRadius: 9999,
              border: '1px solid #E5E5E5',
              backgroundColor: '#FFFFFF',
              outline: 'none',
              fontSize: '0.85rem',
            }}
          />
        </div>
      </div>

      {/* STATUS OVERVIEW BANNER */}
      <div
        className="card-white"
        style={{
          padding: '16px 20px',
          borderLeft: '4px solid #111111',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          backgroundColor: '#F8FAFC',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ display: 'inline-flex', width: 8, height: 8, borderRadius: '50%', backgroundColor: '#18181B' }} />
            <strong style={{ fontSize: '0.88rem', color: '#1E293B' }}>
              Dữ liệu lấy từ các tệp PDF thực tế trong frontend/src/data (Đã nạp {POLICIES.length + PRICING_TARIFFS.length} tệp văn bản)
            </strong>
          </div>
          <button
            className="btn-outline"
            onClick={() => setSubTab('checklist')}
            style={{ fontSize: '0.78rem', padding: '5px 12px', backgroundColor: '#FFFFFF' }}
          >
            <span>Xem toàn bộ {TOTAL_REQUIRED_PDFS} tệp PDF danh mục</span>
            <ChevronRight style={{ width: 12, height: 12 }} />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <div style={{ padding: '8px 12px', backgroundColor: '#FFFFFF', borderRadius: 8, border: '1px solid #E2E8F0' }}>
            <span style={{ fontSize: '0.72rem', color: '#64748B' }}>📜 Chính sách & Hợp đồng</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
              <strong style={{ fontSize: '1.1rem', color: '#18181B' }}>{POLICIES.length} tệp PDF</strong>
              <span style={{ fontSize: '0.72rem', color: '#18181B' }}>✓ Đã nạp</span>
            </div>
          </div>
          <div style={{ padding: '8px 12px', backgroundColor: '#FFFFFF', borderRadius: 8, border: '1px solid #E2E8F0' }}>
            <span style={{ fontSize: '0.72rem', color: '#64748B' }}>💰 Biểu phí & Bảng giá</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
              <strong style={{ fontSize: '1.1rem', color: '#18181B' }}>{PRICING_TARIFFS.length} tệp PDF</strong>
              <span style={{ fontSize: '0.72rem', color: '#18181B' }}>✓ Đã nạp</span>
            </div>
          </div>
          <div style={{ padding: '8px 12px', backgroundColor: '#FFFFFF', borderRadius: 8, border: '1px solid #E2E8F0' }}>
            <span style={{ fontSize: '0.72rem', color: '#64748B' }}>🚗 Thông số xe</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
              <strong style={{ fontSize: '1.1rem', color: '#0F172A' }}>0 / 7 tệp</strong>
              <span style={{ fontSize: '0.72rem', color: '#18181B' }}>Chờ PDF xe</span>
            </div>
          </div>
          <div style={{ padding: '8px 12px', backgroundColor: '#FFFFFF', borderRadius: 8, border: '1px solid #E2E8F0' }}>
            <span style={{ fontSize: '0.72rem', color: '#64748B' }}>❓ Câu hỏi thường gặp FAQ</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
              <strong style={{ fontSize: '1.1rem', color: '#0F172A' }}>0 / 6 tệp</strong>
              <span style={{ fontSize: '0.72rem', color: '#18181B' }}>Chờ PDF FAQ</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4 CATEGORY TABS + SUMMARY CHECKLIST TAB */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid #E5E5E5', paddingBottom: 10, flexWrap: 'wrap' }}>
        <button
          className={`chip ${subTab === 'policies' ? 'active' : ''}`}
          onClick={() => setSubTab('policies')}
        >
          📜 Chính sách & Hợp đồng ({POLICIES.length} tệp PDF thực tế)
        </button>
        <button
          className={`chip ${subTab === 'fees' ? 'active' : ''}`}
          onClick={() => setSubTab('fees')}
        >
          💰 Biểu phí & Bảng giá ({PRICING_TARIFFS.length} tệp PDF thực tế)
        </button>
        <button
          className={`chip ${subTab === 'vehicles' ? 'active' : ''}`}
          onClick={() => setSubTab('vehicles')}
        >
          🚗 Thông số xe (0 - Cần {REQUIRED_VEHICLE_PDFS.length} PDF)
        </button>
        <button
          className={`chip ${subTab === 'faq' ? 'active' : ''}`}
          onClick={() => setSubTab('faq')}
        >
          ❓ Câu hỏi thường gặp FAQ (0 - Cần {REQUIRED_FAQ_PDFS.length} PDF)
        </button>
        <button
          className={`chip ${subTab === 'checklist' ? 'active' : ''}`}
          onClick={() => setSubTab('checklist')}
          style={{ marginLeft: 'auto' }}
        >
          📋 Tổng hợp ({TOTAL_REQUIRED_PDFS} tệp PDF)
        </button>
      </div>

      {/* 1. POLICIES TAB: HIỂN THỊ CÁC TỆP PDF CHÍNH SÁCH THỰC TẾ */}
      {subTab === 'policies' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div
            style={{
              padding: '16px 20px',
              borderRadius: 10,
              backgroundColor: '#FAFAFA',
              border: '1px solid #E4E4E7',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 10,
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircleIcon style={{ width: 18, height: 18, color: '#18181B' }} />
                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#18181B' }}>
                  Danh sách {POLICIES.length} tệp PDF Chính sách & Hợp đồng thực tế trong frontend/src/data
                </h3>
              </div>
              <p style={{ fontSize: '0.82rem', color: '#52525B', marginTop: 2 }}>
                Dữ liệu lấy trực tiếp từ các file PDF văn bản pháp lý chính thức. Bấm nút "Xem trực tiếp PDF" để xem tài liệu.
              </p>
            </div>
            <span style={{ fontSize: '0.78rem', color: '#18181B', fontWeight: 600 }}>
              Hiển thị: {filteredPolicies.length} / {POLICIES.length} tệp
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {filteredPolicies.map((p) => renderRealDocCard(p))}
          </div>

          {/* CHECKLIST ĐỐI CHIẾU NẾU CẦN BỔ SUNG */}
          {REQUIRED_POLICY_PDFS.length > 0 && (
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px dashed #E2E8F0' }}>
              <details style={{ cursor: 'pointer' }}>
                <summary style={{ fontSize: '0.85rem', fontWeight: 700, color: '#475569' }}>
                  📁 Xem danh mục văn bản có thể bổ sung thêm ({REQUIRED_POLICY_PDFS.length} tệp)
                </summary>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
                  {filteredPolicyPdfs.map((pdf) => renderPdfItemCard(pdf))}
                </div>
              </details>
            </div>
          )}
        </div>
      )}

      {/* 2. FEES TAB: HIỂN THỊ CÁC TỆP PDF BIỂU PHÍ & BẢNG GIÁ THỰC TẾ */}
      {subTab === 'fees' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div
            style={{
              padding: '16px 20px',
              borderRadius: 10,
              backgroundColor: '#FAFAFA',
              border: '1px solid #E4E4E7',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 10,
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircleIcon style={{ width: 18, height: 18, color: '#18181B' }} />
                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#18181B' }}>
                  Danh sách {PRICING_TARIFFS.length} tệp PDF Biểu phí & Bảng giá bán thực tế trong frontend/src/data
                </h3>
              </div>
              <p style={{ fontSize: '0.82rem', color: '#52525B', marginTop: 2 }}>
                Dữ liệu lấy từ các văn bản bảng giá xe niêm yết, tùy chọn trang bị và biểu phí dịch vụ sạc V-GREEN.
              </p>
            </div>
            <span style={{ fontSize: '0.78rem', color: '#18181B', fontWeight: 600 }}>
              Hiển thị: {filteredFees.length} / {PRICING_TARIFFS.length} tệp
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {filteredFees.map((f) => renderRealDocCard(f))}
          </div>

          {/* CHECKLIST ĐỐI CHIẾU */}
          {REQUIRED_FEE_PDFS.length > 0 && (
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px dashed #E2E8F0' }}>
              <details style={{ cursor: 'pointer' }}>
                <summary style={{ fontSize: '0.85rem', fontWeight: 700, color: '#475569' }}>
                  📁 Xem danh mục văn bản biểu phí có thể bổ sung thêm ({REQUIRED_FEE_PDFS.length} tệp)
                </summary>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
                  {filteredFeePdfs.map((pdf) => renderPdfItemCard(pdf))}
                </div>
              </details>
            </div>
          )}
        </div>
      )}

      {/* 3. VEHICLES TAB: ĐANG ĐỂ TRỐNG CHỜ PDF THÔNG SỐ XE */}
      {subTab === 'vehicles' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {VEHICLES.length === 0 ? (
            <>
              {renderEmptySectionNotice('Thông số xe & Trang bị kỹ thuật', REQUIRED_VEHICLE_PDFS.length, 'product_specs')}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#111827' }}>
                  Danh mục 7 tệp PDF thông số kỹ thuật xe VinFast cần chuẩn bị:
                </h3>
                <span style={{ fontSize: '0.78rem', color: '#6B7280' }}>
                  Hiển thị: {filteredVehiclePdfs.length} / {REQUIRED_VEHICLE_PDFS.length} tệp
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {filteredVehiclePdfs.map((pdf) => renderPdfItemCard(pdf))}
              </div>
            </>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20 }}>
              {filteredVehicles.map((v) => (
                <div key={v.id} className="card-white" style={{ padding: 20 }}>
                  <h3>{v.name}</h3>
                  <button className="btn-outline" onClick={() => setSelectedVehicle(v)}>Chi tiết</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 4. FAQ TAB: ĐANG ĐỂ TRỐNG CHỜ PDF FAQ */}
      {subTab === 'faq' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {FAQ_QUESTIONS.length === 0 ? (
            <>
              {renderEmptySectionNotice('Câu hỏi thường gặp FAQ', REQUIRED_FAQ_PDFS.length, 'faq')}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#111827' }}>
                  Danh mục 6 tệp PDF câu hỏi thường gặp theo dòng xe cần chuẩn bị:
                </h3>
                <span style={{ fontSize: '0.78rem', color: '#6B7280' }}>
                  Hiển thị: {filteredFaqPdfs.length} / {REQUIRED_FAQ_PDFS.length} tệp
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {filteredFaqPdfs.map((pdf) => renderPdfItemCard(pdf))}
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {filteredFaqs.map((f) => (
                <div key={f.id} className="card-white" style={{ padding: 18 }}>
                  <h3>{f.question}</h3>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 5. CHECKLIST TAB: TỔNG HỢP TOÀN BỘ CÁC TỆP PDF */}
      {subTab === 'checklist' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* TECHNICAL INGESTION GUIDE BOX */}
          <div
            className="card-white"
            style={{
              padding: '24px 28px',
              backgroundColor: '#0F172A',
              color: '#FFFFFF',
              borderRadius: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: '#1E293B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <UploadIcon style={{ width: 20, height: 20, color: '#E4E4E7' }} />
              </div>
              <div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#FFFFFF' }}>
                  Thư mục Nạp Tệp PDF Dữ liệu Thực tế
                </h2>
                <p style={{ fontSize: '0.85rem', color: '#94A3B8', marginTop: 2 }}>
                  Tất cả các tệp PDF đặt trong <code>frontend/src/data/</code> tự động đồng bộ sang <code>frontend/public/docs/</code> để xem trực tiếp.
                </p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, paddingTop: 14, borderTop: '1px solid #1E293B' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#94A3B8', display: 'block' }}>1. Thư mục data PDF hiện tại:</span>
                <code style={{ fontSize: '0.85rem', color: '#E4E4E7', backgroundColor: '#1E293B', padding: '3px 8px', borderRadius: 4, display: 'inline-block', marginTop: 4 }}>
                  frontend/src/data/
                </code>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#94A3B8', display: 'block' }}>2. Thư mục web docs:</span>
                <code style={{ fontSize: '0.85rem', color: '#E4E4E7', backgroundColor: '#1E293B', padding: '3px 8px', borderRadius: 4, display: 'inline-block', marginTop: 4 }}>
                  frontend/public/docs/
                </code>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#94A3B8', display: 'block' }}>3. Thư mục RAG Knowledge:</span>
                <code style={{ fontSize: '0.85rem', color: '#FFFFFF', backgroundColor: '#1E293B', padding: '3px 8px', borderRadius: 4, display: 'inline-block', marginTop: 4 }}>
                  {INGESTION_GUIDE.storage_directory}
                </code>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#94A3B8', display: 'block' }}>4. File corpus xuất ra:</span>
                <code style={{ fontSize: '0.85rem', color: '#CBD5E1', backgroundColor: '#1E293B', padding: '3px 8px', borderRadius: 4, display: 'inline-block', marginTop: 4 }}>
                  {INGESTION_GUIDE.corpus_file}
                </code>
              </div>
            </div>
          </div>

          {/* CATEGORIES BREAKDOWN */}
          {REQUIRED_DOC_CATEGORIES.map((cat) => {
            const filteredItems = filterPdfList(cat.items);
            return (
              <div key={cat.key} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #E5E7EB', paddingBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '1.25rem' }}>{cat.icon}</span>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#111827' }}>
                      {cat.name} ({cat.count} tệp PDF)
                    </h3>
                  </div>
                  <span style={{ fontSize: '0.78rem', color: '#6B7280' }}>
                    {cat.description}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {filteredItems.map((pdf) => renderPdfItemCard(pdf))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: XEM TRỰC TIẾP TỆP PDF */}
      <Modal
        isOpen={Boolean(viewingPdf)}
        onClose={() => setViewingPdf(null)}
        title={viewingPdf ? viewingPdf.title : ''}
        maxWidth={960}
      >
        {viewingPdf && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, paddingBottom: 10, borderBottom: '1px solid #E2E8F0', fontSize: '0.82rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileTextIcon style={{ width: 16, height: 16, color: '#52525B' }} />
                <span>Tên file: <strong>{viewingPdf.filename}</strong></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <a
                  href={viewingPdf.url}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-outline"
                  style={{ fontSize: '0.75rem', padding: '4px 10px', textDecoration: 'none' }}
                >
                  <span>Mở tab mới</span>
                  <ChevronRight style={{ width: 12, height: 12 }} />
                </a>
                <a
                  href={viewingPdf.url}
                  download={viewingPdf.filename}
                  className="btn-primary"
                  style={{ fontSize: '0.75rem', padding: '4px 12px', textDecoration: 'none' }}
                >
                  <span>Tải tệp PDF</span>
                </a>
              </div>
            </div>

            <div style={{ height: '70vh', width: '100%', borderRadius: 8, overflow: 'hidden', border: '1px solid #CBD5E1', backgroundColor: '#525659' }}>
              <iframe
                src={viewingPdf.url}
                title={viewingPdf.title}
                style={{ width: '100%', height: '100%', border: 'none' }}
              />
            </div>
          </div>
        )}
      </Modal>

      {/* VEHICLE DETAIL MODAL */}
      <Modal
        isOpen={Boolean(selectedVehicle)}
        onClose={() => setSelectedVehicle(null)}
        title={selectedVehicle ? `${selectedVehicle.name} — Thông số chi tiết` : ''}
        maxWidth={720}
      >
        {selectedVehicle && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {selectedVehicle.image && (
              <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', backgroundColor: '#0F1117' }}>
                <img
                  src={selectedVehicle.image}
                  alt={selectedVehicle.name}
                  style={{ width: '100%', maxHeight: 280, objectFit: 'cover', display: 'block' }}
                />
              </div>
            )}
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{selectedVehicle.name}</h3>
              <p style={{ fontSize: '0.85rem', color: '#666' }}>{selectedVehicle.segment}</p>
            </div>
          </div>
        )}
      </Modal>

      {/* DOCUMENT VIEWER MODAL (TEXT/JSON) */}
      <Modal
        isOpen={Boolean(selectedDocument)}
        onClose={() => setSelectedDocument(null)}
        title={selectedDocument ? selectedDocument.title : ''}
        maxWidth={780}
      >
        {selectedDocument && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.78rem', color: '#737373', borderBottom: '1px solid #F0F0EE', paddingBottom: 10, flexWrap: 'wrap' }}>
              <span>Mã văn bản: <strong>{selectedDocument.document_id}</strong></span>
              <span>•</span>
              <span>Ngày hiệu lực: <strong>{selectedDocument.effective_date}</strong></span>
              <span>•</span>
              <span>Dòng xe: <strong>{selectedDocument.product_model || 'ALL'}</strong></span>
              <span>•</span>
              <span>Trạng thái: <strong>{selectedDocument.status || 'Chưa xác định'}</strong></span>
            </div>

            <div
              style={{
                fontSize: '0.88rem',
                lineHeight: 1.6,
                color: '#222222',
                whiteSpace: 'pre-wrap',
                maxHeight: '60vh',
                overflowY: 'auto',
                backgroundColor: '#FAFAFA',
                padding: '16px 20px',
                borderRadius: 8,
                border: '1px solid #ECECE8',
              }}
            >
              {selectedDocument.content}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 10, borderTop: '1px solid #F0F0EE' }}>
              <button
                className="btn-primary"
                onClick={() => {
                  const docTitle = selectedDocument.title;
                  const docId = selectedDocument.document_id;
                  setSelectedDocument(null);
                  onOpenCopilotQuery && onOpenCopilotQuery(`Tư vấn và giải thích chi tiết nội dung tài liệu ${docTitle} (${docId})`);
                }}
                style={{ fontSize: '0.82rem', padding: '8px 16px' }}
              >
                <span>Hỏi Copilot về tài liệu này</span>
                <SparkleIcon style={{ width: 14, height: 14 }} />
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
