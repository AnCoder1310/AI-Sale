/**
 * Dữ liệu Câu hỏi thường gặp FAQ VinFast
 * Lưu ý: Danh sách FAQ_QUESTIONS để trống theo yêu cầu để nạp dữ liệu thực tế từ các tệp PDF.
 */

// Danh sách FAQ để trống chờ dữ liệu thực tế được nạp vào
export const FAQ_QUESTIONS = [];

// Quick cheat-sheet để trống chờ dữ liệu chuẩn hóa từ tài liệu chính thức
export const CHEAT_SHEET_DATA = {
  title: 'QUICK CHEAT-SHEET 2026',
  subtitle: 'Bảo hành VinFast & Hạ tầng',
  items: [],
};

/**
 * Danh mục tệp PDF Câu hỏi thường gặp FAQ cần chuẩn bị và nạp vào hệ thống
 */
export const REQUIRED_FAQ_PDFS = [
  {
    id: 'req-faq-vf3',
    document_id: 'FAQ_VF3_20260922',
    document_type: 'faq',
    model: 'VF 3',
    category: 'FAQ VF 3',
    filename: 'FAQ_Giai_dap_thac_mac_VinFast_VF3.pdf',
    title: 'Bộ câu hỏi & Giải đáp thắc mắc khách hàng xe VinFast VF 3',
    status: 'Chờ nạp file PDF',
    target_format: 'PDF chuẩn tài liệu Q&A (.pdf)',
    recommended_pages: '4 - 8 trang',
    required_contents: [
      'Khả năng lội nước của VF 3 (tiêu chuẩn 300 mm) và an toàn khi đi mưa ngập tại đô thị',
      'Hướng dẫn sạc tại nhà bằng bộ sạc di động cắm ổ điện 220V dân dụng (công suất 2.2kW / 3.5kW)',
      'So sánh chi phí sạc điện hàng tháng của VF 3 so với chi phí xăng xe máy tay ga',
      'Danh mục phụ kiện chính hãng được phép gắn thêm và bảo hiểm cho xe cỡ nhỏ',
    ],
  },
  {
    id: 'req-faq-vf5',
    document_id: 'FAQ_VF5_20260922',
    document_type: 'faq',
    model: 'VF 5 Plus',
    category: 'FAQ VF 5',
    filename: 'FAQ_Giai_dap_thac_mac_VinFast_VF5.pdf',
    title: 'Bộ câu hỏi & Giải đáp thắc mắc xe VinFast VF 5 Plus',
    status: 'Chờ nạp file PDF',
    target_format: 'PDF chuẩn (.pdf)',
    recommended_pages: '6 - 10 trang',
    required_contents: [
      'Bài toán kinh tế khi chạy xe dịch vụ / taxi công nghệ so với xe xăng hạng A (i10, Morning)',
      'Tuổi thọ và độ bền chu kỳ nạp/xả của công nghệ pin LFP',
      'Quy trình và chi phí bảo dưỡng định kỳ mỗi 12.000 km so với xe xăng truyền thống',
      'Giải đáp chính sách ưu đãi cước sạc V-GREEN dành cho tài xế xe điện',
    ],
  },
  {
    id: 'req-faq-vf6',
    document_id: 'FAQ_VF6_20260922',
    document_type: 'faq',
    model: 'VF 6',
    category: 'FAQ VF 6',
    filename: 'FAQ_Giai_dap_thac_mac_VinFast_VF6.pdf',
    title: 'Bộ câu hỏi & Giải đáp thắc mắc xe VinFast VF 6',
    status: 'Chờ nạp file PDF',
    target_format: 'PDF chuẩn (.pdf)',
    recommended_pages: '6 - 12 trang',
    required_contents: [
      'So sánh chi tiết tính năng hỗ trợ lái ADAS Cấp độ 2 với các dòng xe B-SUV đối thủ xăng (Creta, Seltos)',
      'Độ rộng rãi hàng ghế thứ hai và khả năng lắp ghế trẻ em ISOFIX cho gia đình trẻ',
      'Giải pháp sạc qua đêm tại chung cư hoặc trạm sạc công cộng lân cận',
    ],
  },
  {
    id: 'req-faq-vf7',
    document_id: 'FAQ_VF7_20260922',
    document_type: 'faq',
    model: 'VF 7',
    category: 'FAQ VF 7',
    filename: 'FAQ_Giai_dap_thac_mac_VinFast_VF7.pdf',
    title: 'Bộ câu hỏi & Giải đáp thắc mắc xe VinFast VF 7',
    status: 'Chờ nạp file PDF',
    target_format: 'PDF chuẩn (.pdf)',
    recommended_pages: '8 - 14 trang',
    required_contents: [
      'Trải nghiệm công suất cực đại 349 mã lực và hệ dẫn động 2 mô-tơ AWD trên đường trường và đèo dốc',
      'So sánh chi phí "nuôi xe" và bảo dưỡng xe điện C-SUV so với xe máy xăng (CX-5, CR-V, Tucson)',
      'Hiệu quả chống nóng của trần kính toàn cảnh Panorama và khả năng làm mát điều hòa mùa hè',
    ],
  },
  {
    id: 'req-faq-vf8',
    document_id: 'FAQ_VF8_LEGACY',
    document_type: 'faq',
    model: 'VF 8',
    category: 'FAQ VF 8',
    filename: 'FAQ_Giai_dap_thac_mac_VinFast_VF8.pdf',
    title: 'Bộ câu hỏi & Giải đáp thắc mắc xe VinFast VF 8',
    status: 'Chờ nạp file PDF',
    target_format: 'PDF chuẩn (.pdf)',
    recommended_pages: '10 - 18 trang',
    required_contents: [
      'Phân tích chi tiết bài toán kinh tế: Thuê pin vs Mua đứt pin sau chu kỳ 3 - 5 năm sử dụng',
      'Trải nghiệm thực tế hệ thống trợ lái thông minh ADAS trên các tuyến đường cao tốc Việt Nam',
      'Tính năng Trợ lý ảo ViVi tương tác giọng nói tiếng Việt và cập nhật phần mềm từ xa FOTA',
    ],
  },
  {
    id: 'req-faq-vf9',
    document_id: 'FAQ_VF9_20260922',
    document_type: 'faq',
    model: 'VF 9',
    category: 'FAQ VF 9',
    filename: 'FAQ_Giai_dap_thac_mac_VinFast_VF9.pdf',
    title: 'Bộ câu hỏi & Giải đáp thắc mắc xe VinFast VF 9',
    status: 'Chờ nạp file PDF',
    target_format: 'PDF chuẩn (.pdf)',
    recommended_pages: '10 - 18 trang',
    required_contents: [
      'Tiện ích khoang thương gia Captain Seat 6 chỗ: Chế độ massage, sưởi/làm mát và điều hòa riêng biệt',
      'Khả năng vận hành và tầm di chuyển thực tế của bộ pin CATL 123 kWh khi chở đủ tải 7 người',
      'Dịch vụ đặc quyền hậu mãi dành riêng cho chủ nhân dòng xe cao cấp VF 9 (Cứu hộ 24/7, ưu tiên đặt lịch xưởng)',
    ],
  },
];
