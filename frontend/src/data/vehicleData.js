/**
 * Dữ liệu Thông số xe VinFast
 * Lưu ý: Danh sách VEHICLES để trống theo yêu cầu để nạp dữ liệu thực tế từ các tệp PDF.
 */

// Danh sách xe thương mại chính thức để trống chờ dữ liệu thực tế được nạp vào
export const VEHICLES = [];

export const MODEL_IMAGE_MAP = {
  vf3: '/vehicles/vf-3.jpg',
  vf5: '/vehicles/vf-5.jpg',
  vf6: '/vehicles/vf-6.jpg',
  vf7: '/vehicles/vf-7.jpg',
  vf8: '/vehicles/vf-8.jpg',
  vf9: '/vehicles/vf-9.jpg',
  vfwild: '/vehicles/vf-wild.jpg',
};

export const MODEL_SVG_MAP = {
  vf3: '/vehicles/vf-3.svg',
  vf5: '/vehicles/vf-5.svg',
  vf6: '/vehicles/vf-6.svg',
  vf7: '/vehicles/vf-7.svg',
  vf8: '/vehicles/vf-8.svg',
  vf9: '/vehicles/vf-9.svg',
  vfwild: '/vehicles/vf-wild.svg',
};

/**
 * Danh mục tệp PDF Thông số xe cần chuẩn bị và nạp vào hệ thống
 */
export const REQUIRED_VEHICLE_PDFS = [
  {
    id: 'req-vf3',
    model: 'VF 3',
    segment: 'Mini Electric SUV Đô thị',
    filename: 'Thong_so_ky_thuat_VinFast_VF3.pdf',
    document_id: 'PRODUCT_VF3_20260922',
    document_type: 'product_specs',
    title: 'VinFast VF 3: Thông số kỹ thuật, Trang bị & Khả năng vận hành',
    status: 'Chờ nạp file PDF',
    target_format: 'PDF chuẩn (.pdf, text-searchable, OCR vector)',
    recommended_pages: '4 - 8 trang',
    image: '/vehicles/vf-3.jpg',
    required_contents: [
      'Kích thước tổng thể (D x R x C: 3.190 x 1.679 x 1.652 mm), chiều dài cơ sở, khoảng sáng gầm xe 175 mm',
      'Động cơ điện: Công suất tối đa 30 kW (40.2 HP), mô-men xoắn cực đại 110 Nm, hệ dẫn động cầu sau (RWD)',
      'Pin & Quãng đường: Dung lượng pin khả dụng 18.64 kWh (LFP), quãng đường di chuyển 215 km (NEDC)',
      'Thời gian sạc: Sạc nhanh DC 10% - 70% trong 36 phút, sạc chậm AC tại nhà',
      'Trang bị an toàn: Phanh tái sinh, túi khí, camera/cảm biến lùi, hệ thống phanh ABS/EBD/BA',
    ],
  },
  {
    id: 'req-vf5',
    model: 'VF 5 Plus',
    segment: 'A-SUV Đô thị Thông minh',
    filename: 'Thong_so_ky_thuat_VinFast_VF5_Plus.pdf',
    document_id: 'SPECS_VF5_PLUS_2026',
    document_type: 'product_specs',
    title: 'Thông số kỹ thuật & Trang bị VinFast VF 5 Plus',
    status: 'Chờ nạp file PDF',
    target_format: 'PDF chuẩn (.pdf, text-searchable, OCR vector)',
    recommended_pages: '6 - 12 trang',
    image: '/vehicles/vf-5.jpg',
    required_contents: [
      'Kích thước: 3.967 x 1.723 x 1.578 mm, chiều dài cơ sở 2.514 mm, khoảng sáng gầm 168 mm',
      'Động cơ điện: 100 kW (134 HP), mô-men xoắn 135 Nm, hệ dẫn động cầu trước (FWD)',
      'Pin: 37.23 kWh, quãng đường di chuyển chuẩn hóa 326 km (NEDC)',
      'Thời gian sạc DC 60kW: 10% - 70% trong 30 phút',
      'Gói an toàn ADAS cơ bản: Giám sát điểm mù (BSD), cảnh báo luồng giao thông mở cửa (DOW), 6 túi khí',
    ],
  },
  {
    id: 'req-vf6',
    model: 'VF 6',
    segment: 'B-SUV Gia đình Hiện đại (Base & Plus)',
    filename: 'Thong_so_ky_thuat_VinFast_VF6.pdf',
    document_id: 'PRODUCT_VF6_20260922',
    document_type: 'product_specs',
    title: 'VinFast VF 6: Thông số kỹ thuật, Giá bán & Trang bị chi tiết',
    status: 'Chờ nạp file PDF',
    target_format: 'PDF chuẩn (.pdf, text-searchable, OCR vector)',
    recommended_pages: '8 - 14 trang',
    image: '/vehicles/vf-6.jpg',
    required_contents: [
      'Kích thước: 4.238 x 1.820 x 1.594 mm, chiều dài cơ sở 2.730 mm, la-zăng hợp kim 17/19 inch',
      'Động cơ: Bản Base 130 kW (174 HP) / Bản Plus 150 kW (201 HP), mô-men xoắn 250 - 310 Nm',
      'Pin LFP 59.6 kWh, phạm vi di chuyển 399 km (Base) và 381 km (Plus) theo chu trình WLTP',
      'Hệ thống trợ lái nâng cao ADAS Cấp độ 2: Hỗ trợ di chuyển khi ùn tắc, giữ làn khẩn cấp, phanh tự động AEB',
    ],
  },
  {
    id: 'req-vf7',
    model: 'VF 7',
    segment: 'C-SUV Thể thao Tương lai (Base & Plus AWD)',
    filename: 'Thong_so_ky_thuat_VinFast_VF7.pdf',
    document_id: 'PRODUCT_VF7_20260922',
    document_type: 'product_specs',
    title: 'VinFast VF 7 Chính hãng: Thông số kỹ thuật & Trang bị Thể thao',
    status: 'Chờ nạp file PDF',
    target_format: 'PDF chuẩn (.pdf, text-searchable, OCR vector)',
    recommended_pages: '10 - 16 trang',
    image: '/vehicles/vf-7.jpg',
    required_contents: [
      'Bản Plus 2 Mô-tơ AWD: Công suất cực đại 260 kW (349 HP), mô-men xoắn 500 Nm, tăng tốc 0-100 km/h trong 5.8 giây',
      'Pin dung lượng 75.3 kWh, quãng đường di chuyển 431 km (WLTP)',
      'Kích thước: 4.545 x 1.890 x 1.636 mm, trục cơ sở 2.840 mm, trần kính toàn cảnh Panorama',
      'Màn hình cảm ứng 12.9 inch, hệ thống hiển thị thông tin kính lái HUD, 8 túi khí bảo vệ toàn diện',
    ],
  },
  {
    id: 'req-vf8',
    model: 'VF 8',
    segment: 'D-SUV Công nghệ Thông minh Toàn cầu (Eco & Plus)',
    filename: 'Thong_so_ky_thuat_VinFast_VF8.pdf',
    document_id: 'PRODUCT_VF8_20260922',
    document_type: 'product_specs',
    title: 'VinFast VF 8 Thế Hệ Mới: Thông số, Pin CATL & Công nghệ ADAS',
    status: 'Chờ nạp file PDF',
    target_format: 'PDF chuẩn (.pdf, text-searchable, OCR vector)',
    recommended_pages: '12 - 20 trang',
    image: '/vehicles/vf-8.jpg',
    required_contents: [
      'Động cơ 2 mô-tơ AWD điện tử: Công suất 300 kW (402 HP), mô-men xoắn 620 Nm (Plus)',
      'Pin CATL cao cấp 87.7 kWh, phạm vi di chuyển 471 km (Eco) / 457 km (Plus) (WLTP)',
      'Kích thước: 4.750 x 1.934 x 1.667 mm, chiều dài cơ sở 2.950 mm',
      '11 túi khí, trợ lý ảo VinFast AI tương tác bằng giọng nói tiếng Việt đa vùng miền',
    ],
  },
  {
    id: 'req-vf9',
    model: 'VF 9',
    segment: 'E-SUV Full-size Hạng sang (6 chỗ / 7 chỗ)',
    filename: 'Thong_so_ky_thuat_VinFast_VF9.pdf',
    document_id: 'PRODUCT_VF9_20260922',
    document_type: 'product_specs',
    title: 'VinFast VF 9: Thông số Đẳng cấp Chủ tịch, Pin CATL 123 kWh',
    status: 'Chờ nạp file PDF',
    target_format: 'PDF chuẩn (.pdf, text-searchable, OCR vector)',
    recommended_pages: '14 - 24 trang',
    image: '/vehicles/vf-9.jpg',
    required_contents: [
      'Pin khủng CATL 123 kWh, tầm hoạt động vượt trội lên đến 626 km (WLTP)',
      'Kích thước Full-size: 5.118 x 2.254 x 1.696 mm, chiều dài cơ sở 3.150 mm',
      'Hàng ghế thương gia Captain Seat độc lập có tích hợp massage sưởi/thông gió đa điểm',
      'Cửa hít tự động, trần kính điện tử toàn cảnh, hệ thống điều hòa tự động 3 vùng lọc bụi PM2.5',
    ],
  },
  {
    id: 'req-vfwild',
    model: 'VF Wild',
    segment: 'Bán tải Điện Thể thao Đột phá (Concept)',
    filename: 'Thong_tin_VinFast_VF_Wild_Concept.pdf',
    document_id: 'PRODUCT_VFWILD_20260922',
    document_type: 'product_specs',
    title: 'VinFast VF Wild: Bản thiết kế Ý tưởng Bán tải Điện Đột phá',
    status: 'Chờ nạp file PDF',
    target_format: 'PDF chuẩn (.pdf, text-searchable, OCR vector)',
    recommended_pages: '4 - 10 trang',
    image: '/vehicles/vf-wild.jpg',
    required_contents: [
      'Thiết kế kích thước bán tải cỡ trung: Dài 5.324 mm, rộng 1.997 mm, thùng hàng mở rộng linh hoạt đến 2.44 m',
      'Hệ dẫn động 4 bánh toàn thời gian AWD 2 mô-tơ, tầm hoạt động dự kiến 450+ km',
      'Hệ thống trợ lái off-road chuyên dụng và camera 360 độ góc nhìn đa hướng xuyên gầm',
    ],
  },
];

export function getVehicleById(id) {
  if (!id) return null;
  return VEHICLES.find((v) => v.id.toLowerCase() === id.toLowerCase()) || null;
}

export function getVehicleByModel(modelName) {
  if (!modelName) return null;
  const normalized = modelName.toLowerCase().replace(/[^a-z0-9]/g, '');
  return (
    VEHICLES.find((v) => {
      const vId = v.id.toLowerCase();
      const vModel = v.model.toLowerCase().replace(/[^a-z0-9]/g, '');
      return normalized.includes(vId) || normalized.includes(vModel) || vId.includes(normalized);
    }) || null
  );
}

export function getVehicleImage(modelOrId, fallback = '/vehicles/vf-7.jpg') {
  if (!modelOrId) return fallback;
  const v = getVehicleById(modelOrId) || getVehicleByModel(modelOrId);
  if (v?.image) return v.image;

  // Fallback to static synchronized image map
  const normalized = String(modelOrId).toLowerCase().replace(/[^a-z0-9]/g, '');
  if (normalized.includes('wild')) return MODEL_IMAGE_MAP.vfwild;
  if (normalized.includes('9')) return MODEL_IMAGE_MAP.vf9;
  if (normalized.includes('8')) return MODEL_IMAGE_MAP.vf8;
  if (normalized.includes('7')) return MODEL_IMAGE_MAP.vf7;
  if (normalized.includes('6')) return MODEL_IMAGE_MAP.vf6;
  if (normalized.includes('5')) return MODEL_IMAGE_MAP.vf5;
  if (normalized.includes('3')) return MODEL_IMAGE_MAP.vf3;

  return fallback;
}
