/**
 * Dữ liệu Biểu phí & Bảng giá bán xe VinFast
 * Dữ liệu lấy trực tiếp từ các tệp PDF chính thức trong frontend/src/data/
 */

export const PRICING_TARIFFS = [
  {
    id: 'price-list-20260919',
    document_id: 'PRICE_LIST_VINFAST_20260919',
    category: 'Bảng giá Xe niêm yết',
    title: 'Thông báo Chính sách Giá bán các Dòng xe VinFast (Tháng 09.2026)',
    filename: '20260919_thong-bao-chinh-sach-gia-ban-cac-dong-xe-vinfast-thang-09.2026.pdf',
    effective_date: '2026-09-19',
    status: 'Đang áp dụng',
    file_url: '/docs/20260919_thong-bao-chinh-sach-gia-ban-cac-dong-xe-vinfast-thang-09.2026.pdf',
    file_size: '412 KB',
    summary: 'Bảng giá bán lẻ niêm yết chính thức kèm pin và thuê pin các phiên bản Base, Plus của dải ô tô điện VinFast tháng 09.2026.',
    key_points: [
      'Bảng giá bán lẻ niêm yết tiêu chuẩn (đã bao gồm thuế GTGT 10%) cho từng phiên bản xe.',
      'Mức giá xe kèm pin và giá xe thuê pin, chính sách cọc và lịch phân bổ xe.',
      'Quy định về thời hạn áp dụng bảng giá trên toàn bộ mạng lưới showroom và đại lý VinFast.',
    ],
  },
  {
    id: 'price-list-options-20250213',
    document_id: 'PRICE_LIST_OPTIONS_20250213',
    category: 'Bảng giá & Tùy chọn xe',
    title: 'Thông báo Chính sách Giá bán, Thuê Pin & Các tùy chọn xe VinFast',
    filename: '20250213_Thông báo CS Giá bán, thuê pin và các tùy chọn xe VinFast Tháng 02.2025.pdf',
    effective_date: '2025-02-13',
    status: 'Văn bản đối chiếu giá & tùy chọn',
    file_url: encodeURI('/docs/20250213_Thông báo CS Giá bán, thuê pin và các tùy chọn xe VinFast Tháng 02.2025.pdf'),
    file_size: '301 KB',
    summary: 'Bảng giá chi tiết các gói tùy chọn nâng cấp: màu sơn ngoại thất 2 tông màu, la-zăng thể thao và gói thuê pin.',
    key_points: [
      'Đơn giá các tùy chọn nâng cấp mâm xe, màu sơn cao cấp và nội thất da đặc biệt.',
      'Khung biểu phí gói thuê pin theo hạn mức số km hàng tháng.',
    ],
  },
  {
    id: 'charging-policy-20260919',
    document_id: 'POLICY_CHARGING_VINFAST_20260919',
    category: 'Biểu phí Trạm sạc V-GREEN',
    title: 'Thông báo Chính sách Ưu đãi & Biểu phí Sạc Pin Ô tô điện VinFast (Tháng 09.2026)',
    filename: '20260919_thong-bao-chinh-sach-uu-dai-sac-pin-cac-dong-xe-o-to-dien-vinfast-thang-09.2026.pdf',
    effective_date: '2026-09-19',
    status: 'Đang áp dụng',
    file_url: '/docs/20260919_thong-bao-chinh-sach-uu-dai-sac-pin-cac-dong-xe-o-to-dien-vinfast-thang-09.2026.pdf',
    file_size: '334 KB',
    summary: 'Biểu phí dịch vụ sạc điện tiêu chuẩn 3.858 VNĐ/kWh, phí quá giờ và chính sách miễn phí sạc cho chủ xe VinFast.',
    key_points: [
      'Đơn giá sạc điện tiêu chuẩn: 3.858 VNĐ/kWh (đã gồm VAT) thanh toán qua VinFast App.',
      'Phí quá giờ đỗ tại trụ sạc: 1.000 VNĐ/phút kể từ phút thứ 31 sau khi xe đã sạc đầy 100%.',
      'Thời hạn và điều kiện áp dụng chính sách miễn phí sạc pin tại mạng lưới trạm sạc V-GREEN toàn quốc.',
    ],
  },
];

export const REQUIRED_FEE_PDFS = [
  {
    id: 'req-fee-battery',
    document_id: 'FEE_BATTERY_RENTAL_2026',
    document_type: 'price_list',
    category: 'Biểu phí Thuê Pin',
    filename: 'Bieu_phi_thue_pin_o_to_dien_VinFast_2026.pdf',
    title: 'Biểu phí Gói cước Thuê Pin xe ô tô điện VinFast 2026',
    status: 'Chờ nạp file PDF',
    target_format: 'PDF chuẩn biểu phí (.pdf)',
    recommended_pages: '4 - 8 trang',
    required_contents: [
      'Bảng giá cước thuê pin hàng tháng theo dải xe và hạn mức số km di chuyển',
      'Đơn giá tính phụ trội mỗi km khi người dùng chạy vượt quá hạn mức gói đã đăng ký',
    ],
  },
];
