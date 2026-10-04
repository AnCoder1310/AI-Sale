/**
 * Dữ liệu Đội ngũ Tư vấn viên & Lịch sử Thực chiến Showroom VinFast Vinh
 */

export const SHOWROOM_MEMBERS = [
  {
    advisor_id: "truongan",
    advisor_name: "Võ Trường An",
    title: "Senior Sales Consultant",
    avatar_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=160&q=80",
    initials: "TA",
    status: "top",
    status_label: "Top Performer",
    score_100: 88.5,
    score_3: 2.7,
    completed_sessions: 28,
    approved_sessions: 26,
    latest_activity: "2026-10-04T08:30:00Z",
    strengths: ["Kỹ năng xử lý băn khoăn Pin Thuê vs Mua Đứt sắc sảo", "Am hiểu sâu kỹ thuật VF 8 & VF 9", "Tốc độ chốt deal nhanh"],
    attention_areas: [],
    competencies: [
      { id: "need_discovery", label: "Khám phá nhu cầu", score: 2.9, percentage: 97 },
      { id: "product_knowledge", label: "Kiến thức sản phẩm & Pin", score: 2.8, percentage: 93 },
      { id: "test_drive", label: "Kỹ năng trải nghiệm thực tế", score: 2.7, percentage: 90 },
      { id: "objection_handling", label: "Xử lý từ chối & đàm phán", score: 2.6, percentage: 87 },
      { id: "closing_deal", label: "Chốt deal & thủ tục ưu đãi", score: 2.6, percentage: 87 },
    ],
  },
  {
    advisor_id: "khang.nm",
    advisor_name: "Nguyễn Minh Khang",
    title: "Sales Consultant",
    avatar_url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=160&q=80",
    initials: "MK",
    status: "on_track",
    status_label: "On track",
    score_100: 82.0,
    score_3: 2.5,
    completed_sessions: 19,
    approved_sessions: 17,
    latest_activity: "2026-10-04T07:15:00Z",
    strengths: ["Nhiệt tình, lắng nghe khách hàng chu đáo", "Thành thạo chính sách trạm sạc V-GREEN"],
    attention_areas: ["Cần nâng cao kỹ năng so sánh thông số ADAS với xe xăng"],
    competencies: [
      { id: "need_discovery", label: "Khám phá nhu cầu", score: 2.6, percentage: 87 },
      { id: "product_knowledge", label: "Kiến thức sản phẩm & Pin", score: 2.5, percentage: 83 },
      { id: "test_drive", label: "Kỹ năng trải nghiệm thực tế", score: 2.5, percentage: 83 },
      { id: "objection_handling", label: "Xử lý từ chối & đàm phán", score: 2.4, percentage: 80 },
      { id: "closing_deal", label: "Chốt deal & thủ tục ưu đãi", score: 2.5, percentage: 83 },
    ],
  },
  {
    advisor_id: "maianh.tt",
    advisor_name: "Trần Thị Mai Anh",
    title: "Junior Consultant",
    avatar_url: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=160&q=80",
    initials: "MA",
    status: "needs_attention",
    status_label: "Attention",
    warning_tag: "Kỹ năng Chính sách yếu (58%)",
    score_100: 68.4,
    score_3: 2.1,
    completed_sessions: 12,
    approved_sessions: 9,
    latest_activity: "2026-10-03T16:20:00Z",
    strengths: ["Khai thác thông tin khách hàng khéo léo", "Giao tiếp lịch thiệp"],
    attention_areas: ["Chưa nắm vững chính sách cước thuê pin 2026", "Hay nhầm lẫn biểu phí sạc V-GREEN"],
    competencies: [
      { id: "need_discovery", label: "Khám phá nhu cầu", score: 2.5, percentage: 83 },
      { id: "product_knowledge", label: "Kiến thức sản phẩm & Pin", score: 2.0, percentage: 67 },
      { id: "test_drive", label: "Kỹ năng trải nghiệm thực tế", score: 2.2, percentage: 73 },
      { id: "objection_handling", label: "Xử lý từ chối & đàm phán", score: 1.9, percentage: 63 },
      { id: "closing_deal", label: "Chốt deal & thủ tục ưu đãi", score: 1.8, percentage: 60 },
    ],
  },
  {
    advisor_id: "trong.ld",
    advisor_name: "Lê Đức Trọng",
    title: "Sales Specialist",
    avatar_url: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=160&q=80",
    initials: "DT",
    status: "top",
    status_label: "Top Performer",
    score_100: 85.2,
    score_3: 2.6,
    completed_sessions: 24,
    approved_sessions: 22,
    latest_activity: "2026-10-04T09:10:00Z",
    strengths: ["Tư vấn kỹ thuật ADAS và khả năng tăng tốc vượt trội", "Thuyết phục khách hàng phân khúc cao cấp"],
    attention_areas: [],
    competencies: [
      { id: "need_discovery", label: "Khám phá nhu cầu", score: 2.8, percentage: 93 },
      { id: "product_knowledge", label: "Kiến thức sản phẩm & Pin", score: 2.7, percentage: 90 },
      { id: "test_drive", label: "Kỹ năng trải nghiệm thực tế", score: 2.6, percentage: 87 },
      { id: "objection_handling", label: "Xử lý từ chối & đàm phán", score: 2.5, percentage: 83 },
      { id: "closing_deal", label: "Chốt deal & thủ tục ưu đãi", score: 2.4, percentage: 80 },
    ],
  },
  {
    advisor_id: "yen.ph",
    advisor_name: "Phạm Hải Yến",
    title: "Junior Consultant",
    avatar_url: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=160&q=80",
    initials: "HY",
    status: "needs_attention",
    status_label: "Attention",
    warning_tag: "Kỹ năng Chính sách yếu (64%)",
    score_100: 71.0,
    score_3: 2.1,
    completed_sessions: 14,
    approved_sessions: 11,
    latest_activity: "2026-10-03T18:45:00Z",
    strengths: ["Thái độ cầu thị, tích cực luyện tập", "Giới thiệu nội thất VF 3 và VF 5 hấp dẫn"],
    attention_areas: ["Lúng túng khi khách hỏi so sánh chi phí vận hành km với xe Vios máy xăng"],
    competencies: [
      { id: "need_discovery", label: "Khám phá nhu cầu", score: 2.3, percentage: 77 },
      { id: "product_knowledge", label: "Kiến thức sản phẩm & Pin", score: 2.1, percentage: 70 },
      { id: "test_drive", label: "Kỹ năng trải nghiệm thực tế", score: 2.2, percentage: 73 },
      { id: "objection_handling", label: "Xử lý từ chối & đàm phán", score: 2.0, percentage: 67 },
      { id: "closing_deal", label: "Chốt deal & thủ tục ưu đãi", score: 1.9, percentage: 63 },
    ],
  },
  {
    advisor_id: "advisor-demo",
    advisor_name: "Tư vấn viên Demo",
    title: "Sales Consultant (Demo)",
    avatar_url: null,
    initials: "TV",
    status: "on_track",
    status_label: "On track",
    score_100: 76.0,
    score_3: 2.3,
    completed_sessions: 3,
    approved_sessions: 2,
    latest_activity: "2026-10-04T06:23:00Z",
    strengths: ["Nắm bắt quy trình bài bản", "Phản xạ nhanh trong các tình huống phản đối cơ bản"],
    attention_areas: ["Cần tra cứu kỹ hơn biểu giá sạc và chính sách đổi pin khi SOH < 70%"],
    competencies: [
      { id: "need_discovery", label: "Khám phá nhu cầu", score: 2.4, percentage: 80 },
      { id: "product_knowledge", label: "Kiến thức sản phẩm & Pin", score: 2.3, percentage: 77 },
      { id: "test_drive", label: "Kỹ năng trải nghiệm thực tế", score: 2.3, percentage: 77 },
      { id: "objection_handling", label: "Xử lý từ chối & đàm phán", score: 2.2, percentage: 73 },
      { id: "closing_deal", label: "Chốt deal & thủ tục ưu đãi", score: 2.2, percentage: 73 },
    ],
  },
];

export const MOCK_TEAM_ATTEMPTS = [
  // Võ Trường An
  {
    session_id: "sess-ta-01",
    advisor_id: "truongan",
    advisor_name: "Võ Trường An",
    scenario_id: "SCENARIO_02_VF8_FAMILY",
    scenario_title: "VF 8 — Xử lý băn khoăn Pin Thuê vs Mua Đứt & Tính toán kinh tế",
    model: "VF 8",
    model_badge: "VinFast VF 8 Plus",
    completed_at: "2026-10-04T08:30:00Z",
    status: "approved",
    ai_score: 2.8,
    approved_score: 3.0,
    score_100: 100,
    customer_name: "Anh Hoàng",
    transcript: [
      { role: "customer", text: "Chào em, anh đang tính lấy VF 8 nhưng phân vân quá. Thuê pin tháng mất 2 triệu 9, mua đứt thì thêm gần 200 triệu. Tính sao cho kinh tế em?" },
      { role: "advisor", text: "Dạ em chào anh Hoàng! Em rất hiểu sự băn khoăn của anh. Để tính toán chính xác nhất, anh cho em hỏi trung bình mỗi tháng gia đình mình di chuyển khoảng bao nhiêu km ạ?" },
      { role: "customer", text: "Anh đi làm hàng ngày và cuối tuần về quê, tầm 1.800 đến 2.200 km/tháng." },
      { role: "advisor", text: "Dạ tuyệt vời anh! Với quãng đường ~2.000 km/tháng, phương án Thuê pin VinFast là tối ưu kinh tế nhất: anh tiết kiệm ngay 200 triệu vốn đầu tư ban đầu, đồng thời toàn bộ rủi ro chai pin VinFast cam kết đổi mới miễn phí 100% khi dung lượng pin xuống dưới 70%!" },
      { role: "customer", text: "Nghe hợp lý đấy, còn chi phí sạc pin tại trạm thì sao em?" },
      { role: "advisor", text: "Dạ hiện tại VinFast đang áp dụng chính sách miễn phí sạc pin tại mạng lưới trạm V-GREEN toàn quốc đến hết năm 2026, nên tổng chi phí nhiên liệu hàng tháng của anh gần như chỉ bằng 1/3 so với xe xăng cùng phân khúc D!" },
    ],
  },
  {
    session_id: "sess-ta-02",
    advisor_id: "truongan",
    advisor_name: "Võ Trường An",
    scenario_id: "SCENARIO_01_VF5_TAXI",
    scenario_title: "VF 5 Plus — Tư vấn xe dịch vụ Taxi GSM & Tối ưu chi phí",
    model: "VF 5",
    model_badge: "VinFast VF 5 Plus",
    completed_at: "2026-10-03T15:10:00Z",
    status: "approved",
    ai_score: 2.9,
    approved_score: 2.9,
    score_100: 97,
    customer_name: "Anh Nam (Tài xế)",
    transcript: [
      { role: "customer", text: "VF 5 Plus lăn bánh bao nhiêu em? Anh đang chạy Vios dịch vụ tính đổi sang xe điện mà sợ không ăn thua." },
      { role: "advisor", text: "Em chào anh Nam! Bác tài chạy dịch vụ đổi sang VF 5 Plus là lựa chọn sáng suốt nhất hiện nay. Anh chạy mỗi ngày khoảng bao nhiêu km để em tính bài toán hoàn vốn cho anh?" },
    ],
  },

  // Lê Đức Trọng
  {
    session_id: "sess-dt-01",
    advisor_id: "trong.ld",
    advisor_name: "Lê Đức Trọng",
    scenario_id: "SCENARIO_04_VF7_TECH",
    scenario_title: "VF 7 Plus AWD — So sánh trực diện ADAS & Vận hành với C-SUV Máy Xăng",
    model: "VF 7",
    model_badge: "VinFast VF 7 Plus AWD",
    completed_at: "2026-10-04T09:10:00Z",
    status: "approved",
    ai_score: 2.7,
    approved_score: 2.8,
    score_100: 93,
    customer_name: "Chị Phương Lan",
    transcript: [
      { role: "customer", text: "Chị thấy VF 7 với CX-5 cũng như nhau, CX-5 nhìn quen mắt hơn mà sao VF 7 đắt hơn 50 triệu vậy em?" },
      { role: "advisor", text: "Dạ em chào chị Lan! Em rất hiểu góc nhìn của chị. Nhưng khi chị trực tiếp ngồi sau vô-lăng VF 7 Plus AWD với công suất 349 mã lực và hệ dẫn động 2 cầu toàn thời gian, cảm giác dính lưng và độ an toàn ADAS cấp 2 của VF 7 sẽ vượt trội hoàn toàn so với các xe xăng hút khí tự nhiên 2.0L cùng tầm giá ạ!" },
    ],
  },

  // Nguyễn Minh Khang
  {
    session_id: "sess-mk-01",
    advisor_id: "khang.nm",
    advisor_name: "Nguyễn Minh Khang",
    scenario_id: "SCENARIO_03_VF9_VIP",
    scenario_title: "VF 9 Plus 6 chỗ — Thuyết phục Doanh nhân lựa chọn Ghế Cơ trưởng VIP",
    model: "VF 9",
    model_badge: "VinFast VF 9 Plus",
    completed_at: "2026-10-04T07:15:00Z",
    status: "approved",
    ai_score: 2.5,
    approved_score: 2.6,
    score_100: 87,
    customer_name: "Anh Tuấn (CEO)",
    transcript: [
      { role: "customer", text: "Anh đang đi Carnival, VF 9 ghế cơ trưởng ngồi có thực sự êm và có tính năng massage riêng biệt không em?" },
      { role: "advisor", text: "Dạ em kính chào anh Tuấn! Ghế cơ trưởng hàng 2 trên VF 9 Plus được trang bị hệ thống massage đa điểm, sưởi và thông gió độc lập cùng màn hình cảm ứng điều khiển riêng, mang lại không gian làm việc tĩnh lặng tuyệt đối cho doanh nhân ạ." },
    ],
  },

  // Trần Thị Mai Anh
  {
    session_id: "sess-ma-01",
    advisor_id: "maianh.tt",
    advisor_name: "Trần Thị Mai Anh",
    scenario_id: "SCENARIO_01_VF5_TAXI",
    scenario_title: "VF 5 Plus — Tư vấn xe dịch vụ Taxi GSM & Tối ưu chi phí",
    model: "VF 5",
    model_badge: "VinFast VF 5 Plus",
    completed_at: "2026-10-03T16:20:00Z",
    status: "approved",
    ai_score: 2.0,
    approved_score: 2.1,
    score_100: 70,
    customer_name: "Bác Hùng",
    transcript: [
      { role: "customer", text: "Bác nghe nói pin VF 5 đi vài năm là chai phải bỏ cả trăm triệu mua lại đúng không cháu?" },
      { role: "advisor", text: "Dạ bác Hùng ơi không phải đâu ạ, pin VinFast được bảo hành tới 7-8 năm và nếu bác thuê pin thì VinFast sẽ chịu toàn bộ chi phí thay mới khi pin xuống cấp ạ." },
    ],
  },

  // Phạm Hải Yến
  {
    session_id: "sess-hy-01",
    advisor_id: "yen.ph",
    advisor_name: "Phạm Hải Yến",
    scenario_id: "SCENARIO_05_VF3_FIRST_CAR",
    scenario_title: "VF 3 — Mẫu xe đầu tiên cho giới trẻ đô thị",
    model: "VF 3",
    model_badge: "VinFast VF 3",
    completed_at: "2026-10-03T18:45:00Z",
    status: "approved",
    ai_score: 2.2,
    approved_score: 2.2,
    score_100: 73,
    customer_name: "Bạn Linh (25 tuổi)",
    transcript: [
      { role: "customer", text: "Em mới đi làm muốn mua chiếc VF 3 che mưa che nắng, trả trước khoảng bao nhiêu thì nhận xe được chị?" },
      { role: "advisor", text: "Chào Linh nhé! Với VF 3 em chỉ cần trả trước khoảng 50 - 70 triệu là nhận xe ngay, mỗi tháng trả góp chỉ từ 2 triệu đồng thôi em nhé!" },
    ],
  },

  // advisor-demo (Chờ duyệt - Pending review)
  {
    session_id: "23a50334-0f00-4533-9df2-0751a949a6c1",
    advisor_id: "advisor-demo",
    advisor_name: "advisor-demo",
    scenario_id: "SCENARIO_01_VF5_TAXI",
    scenario_title: "VF 5 Plus — Tư vấn xe dịch vụ Taxi GSM & Tối ưu chi phí",
    model: "VF 5",
    model_badge: "VinFast VF 5 Plus",
    completed_at: "2026-10-04T06:23:09Z",
    status: "pending",
    ai_score: 1.6,
    approved_score: null,
    score_100: 53,
    customer_name: "Anh Nam (Tài xế)",
    transcript: [
      { role: "customer", text: "VF 5 Plus lăn bánh bao nhiêu em? Anh đang chạy Vios dịch vụ tính đổi sang xe điện mà sợ không ăn thua." },
      { role: "advisor", text: "Dạ em chào anh Nam, VF 5 Plus lăn bánh khoảng 500 triệu anh nhé, xe điện chạy tiết kiệm lắm." },
      { role: "customer", text: "Tiết kiệm là bao nhiêu em? Anh chạy ngày 250km, sạc điện hết bao nhiêu tiền một ngày?" },
      { role: "advisor", text: "Dạ tiền điện rẻ hơn xăng nhiều anh ạ, anh cứ yên tâm mua đi." },
    ],
  },
  {
    session_id: "482e02ca-f17d-4228-adfd-fbc08e7537ab",
    advisor_id: "advisor-demo",
    advisor_name: "advisor-demo",
    scenario_id: "SCENARIO_01_VF5_TAXI",
    scenario_title: "VF 5 Plus — Tư vấn xe dịch vụ Taxi GSM & Tối ưu chi phí",
    model: "VF 5",
    model_badge: "VinFast VF 5 Plus",
    completed_at: "2026-10-04T05:03:10Z",
    status: "approved",
    ai_score: 2.2,
    approved_score: 2.2,
    score_100: 73,
    customer_name: "Anh Nam (Tài xế)",
    transcript: [
      { role: "customer", text: "Anh nghe nói sạc pin mất mấy tiếng, đang chạy khách mà hết pin thì đứng chờ à?" },
      { role: "advisor", text: "Dạ anh Nam an tâm, trạm sạc nhanh V-GREEN sạc từ 10% lên 70% chỉ mất khoảng 25-30 phút thôi ạ. Anh tranh thủ nghỉ trưa hoặc uống cà phê là đầy pin chạy tiếp được 200km rồi ạ!" },
    ],
  },
];

/**
 * Lấy lịch sử attempts theo advisor ID (kết hợp cả dữ liệu live và mock)
 */
export function getAdvisorAttempts(advisorId, liveAttempts = []) {
  const liveForAdv = liveAttempts.filter(
    (a) => a.advisor_id === advisorId || a.advisor_id === advisorId.toLowerCase()
  );
  const mockForAdv = MOCK_TEAM_ATTEMPTS.filter(
    (a) => a.advisor_id === advisorId || a.advisor_id === advisorId.toLowerCase()
  );

  const seen = new Set();
  const merged = [];

  for (const item of [...liveForAdv, ...mockForAdv]) {
    if (!seen.has(item.session_id)) {
      seen.add(item.session_id);
      merged.push(item);
    }
  }

  return merged;
}

/**
 * Lấy Bảng Xếp Hạng (Ranking Leaderboard) theo kịch bản xe
 */
export function getScenarioLeaderboard(scenarioId, liveAttempts = []) {
  // Lấy tất cả attempts liên quan đến kịch bản này
  const allAttempts = [...liveAttempts, ...MOCK_TEAM_ATTEMPTS].filter(
    (a) => a.scenario_id === scenarioId || (a.scenario_title && a.scenario_title.includes(scenarioId))
  );

  // Group theo advisor để tìm Best Attempt của từng người
  const advisorBest = new Map();

  for (const att of allAttempts) {
    const advId = att.advisor_id;
    const score = att.approved_score ?? att.ai_score ?? 0;
    const existing = advisorBest.get(advId);

    if (!existing || score > existing.best_score) {
      // Tìm profile đầy đủ của advisor
      const profile = SHOWROOM_MEMBERS.find((m) => m.advisor_id === advId) || {
        advisor_id: advId,
        advisor_name: att.advisor_name || advId,
        title: "Tư vấn viên",
        initials: advId.substring(0, 2).toUpperCase(),
        status: "on_track",
      };

      advisorBest.set(advId, {
        advisor_id: advId,
        advisor_name: profile.advisor_name,
        title: profile.title,
        avatar_url: profile.avatar_url,
        initials: profile.initials,
        best_score: score,
        score_100: Math.round((score / 3) * 100),
        best_session_id: att.session_id,
        latest_attempt_date: att.completed_at,
        attempt_count: (existing?.attempt_count || 0) + 1,
        best_attempt: att,
      });
    } else {
      existing.attempt_count += 1;
    }
  }

  // Sắp xếp giảm dần theo điểm số cao nhất
  return Array.from(advisorBest.values()).sort((a, b) => b.best_score - a.best_score);
}
