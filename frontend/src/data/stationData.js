/**
 * Dữ liệu Mạng lưới Trạm sạc V-GREEN
 * Lưu ý: Danh sách CHARGING_STATIONS để trống theo yêu cầu để nạp dữ liệu thực tế từ các tệp PDF/API.
 */

// Danh sách trạm sạc để trống chờ dữ liệu thực tế được nạp vào
export const CHARGING_STATIONS = [];

export const NETWORK_STATS = {
  total_ports: 'Đang nạp…',
  provinces_covered: '63/63',
  highway_coverage: '100%',
  supercharger_ports: 'Đang nạp…',
  uptime: '99.2%',
};

export const REQUIRED_STATION_PDFS = [
  {
    id: 'req-station-policy',
    document_id: 'POLICY_CHARGING_VINFAST_20260919',
    document_type: 'policy',
    filename: 'Bieu_phi_va_chinh_sach_sac_dien_VGREEN.pdf',
    title: 'Thông báo Chính sách Ưu đãi & Biểu phí Mạng lưới Trạm sạc V-GREEN',
    status: 'Chờ nạp file PDF',
    target_format: 'PDF chuẩn (.pdf)',
    required_contents: [
      'Đơn giá sạc pin tiêu chuẩn 3.858 VNĐ/kWh tại toàn bộ trạm sạc V-GREEN',
      'Phí đỗ quá giờ tại trụ sạc 1.000 VNĐ/phút kể từ phút thứ 31 sau khi pin đạt 100%',
      'Quy chuẩn các loại cổng sạc (AC 11kW, DC 30kW, DC 60kW, Supercharge DC 250kW+)',
      'Thời hạn và điều kiện miễn phí sạc cho chủ sở hữu ô tô điện VinFast',
    ],
  },
];
