# Dự toán chi phí API vận hành — P-043 / 043Nova

Ngày tra giá: 18/10/2026. Bảng ngân sách được lập theo cấu hình API hiện tại, đơn giá nhà cung cấp và định mức sử dụng của nhóm. Định mức chính: **10 phiên/nhân viên/tuần** (2 phiên/ngày làm việc); kịch bản sử dụng cao: **15 phiên/nhân viên/tuần** (3 phiên/ngày). Mỗi lượt nói 40 giây; giữ 10 lượt/phiên làm quy mô tính. Các định mức token và mức dùng Copilot là đầu vào dự toán, chưa được đối soát bằng usage production hoặc bản ghi khảo sát. Không tính phần cứng, hosting, database, nhân sự, benchmark/test, thuế và phí đổi ngoại tệ.

## 1. Model và đơn giá

Đã đọc Settings local bằng cách chỉ xuất các trường model, không xuất key: generator/Copilot `openai/gpt-6-luna`; judge `deepseek/deepseek-v3.2`; embedding `openai/text-embedding-3-small`; evidence selector `typesafe/jev-1.14`, qua OpenRouter. Đây là cấu hình local, chưa xác nhận cấu hình live. `.env.example` đang ghi judge khác (`google/gemini-3.8-flash`), Compose cũng có generator fallback khác; không trộn giá các cấu hình này vào dự toán.

| API/model | Giá dùng để tính (USD) | Nguồn chính thức |
|---|---|---|
| GPT-6 Luna | 0,10 / triệu input; 0,50 / triệu output | [OpenRouter](https://openrouter.ai/openai/gpt-6-luna) |
| DeepSeek V3.2 | 0,2088 / triệu input; 0,3096 / triệu output | [OpenRouter](https://openrouter.ai/deepseek/deepseek-v3.2) |
| Jev 1.14 | 0,042 / triệu input; output 0 | [OpenRouter](https://openrouter.ai/typesafe/jev-1.14) |
| Embedding 3 small | 0,02 / triệu input | [OpenRouter](https://openrouter.ai/openai/text-embedding-3-small) |
| Whisper Large v3 Turbo | 0,04 / giờ audio | [Groq](https://console.groq.com/docs/model/whisper-large-v3-turbo) |
| Google WaveNet | 4 / triệu ký tự | [Google Cloud](https://cloud.google.com/text-to-speech/pricing) |
| OpenRouter Standard | Phí mua credits 5,5%; phân bổ bằng hệ số 1,055 | [Pricing](https://openrouter.ai/pricing) |

Giá OpenRouter có thể thay đổi theo provider/routing/khuyến mãi. DeepSeek dùng giá hiển thị tại thời điểm tra, không phải cam kết đơn giá cố định. Không khấu trừ giảm giá cache. Phí 5,5% là phí mua credits, không phải phụ phí provider trên từng request; phân bổ vào ngân sách tiêu thụ để dễ so sánh. Không áp phí này cho Groq/Google vì code gọi trực tiếp hai bên.

Google hiện có free tier WaveNet 4 triệu ký tự/tháng theo trang giá; bảng chủ động không khấu trừ free tier để dự toán dài hạn. Repo vẫn có `VOICE_TTS_USD_PER_MILLION_CHARACTERS=16` trong cấu hình ước tính, cao hơn giá WaveNet vừa xác minh; tài liệu này không sửa runtime.

## 2. Đơn vị và công thức

- LLM: `(input_tokens × giá_input + output_tokens × giá_output) / 1.000.000`.
- STT: `max(10, giây_audio) / 3.600 × 0,04`; 40 giây = **0,000444 USD**. STT không tính theo token văn bản.
- TTS WaveNet: `ký_tự × 4 / 1.000.000`; 350 ký tự = **0,0014 USD**. Không tính theo audio token.
- Tháng trung bình = `52/12 = 4,3333 tuần`; tỷ giá minh họa **26.000 VND/USD**, là tỷ giá lập kế hoạch, không phải tỷ giá thị trường đã xác minh.

Trong phương án tính, 40 giây nói được quy đổi khoảng 80–120 đơn vị cách nhau bằng dấu cách tiếng Việt, dự toán 150–250 text tokens. AI Customer trung bình 250–450 ký tự, chọn 350 ký tự và 220 output tokens/call (gồm structured output). Đây không phải quy tắc từ → token; tokenizer, JSON, reasoning và cách diễn đạt làm thay đổi usage.

Chi phí input không chỉ có lời sales vừa nói: còn system prompt, scenario, state, schema, lịch sử được gửi lại và evidence. Vì vậy bảng tính trên token toàn request. Định mức token bao gồm ngân sách cho prompt/context/output và cần đối soát bằng trường usage của API; chưa có kết quả đếm tokenizer hoặc đo production cho bảng này.

## 3. Logic Roleplay và giới hạn

Nguồn: `src/integrations/practice_runtime.py`, `src/agents/roleplay/customer_agent.py`, `src/agents/roleplay/evaluator.py`, `src/services/voice.py`, `data/scenarios/scenarios.json`.

- Một lượt sales thường gọi analyzer rồi customer; một số nhánh trả lời deterministic/kết thúc có thể không gọi customer.
- Khi finish: evaluator chính; nếu thiếu factual findings thì có thêm batch tối đa 4 claims/lần. Có retry cấu trúc/validation và retry ở adapter/provider; dự toán thêm một batch, không coi đây là trần tuyệt đối.
- Scenario hiện giới hạn 8, 12 hoặc 15 lượt sales. Chọn 10 lượt/phiên làm trung bình hỗn hợp; riêng scenario giới hạn 8 không chạy 10 lượt.
- Voice giới hạn 90 giây mỗi bản ghi, không phải 90 giây cả phiên. Chọn trung bình 40 giây/lượt. Chưa thấy trần thời gian tổng phiên trong các đường code đã đọc.
- 10 lượt × (40 giây sales + khoảng 15–25 giây khách AI) = khoảng 9–11 phút audio thuần; thời gian chờ API/thao tác cộng thêm. Đây là thời lượng quy đổi cho ngân sách, chưa phải thời lượng ghi nhận từ phiên thật.
- 100% phiên dùng voice, đọc mỗi phản hồi AI một lần, không phát lại hoặc ghi âm lại. Phát lại có thể phát sinh TTS request mới; tính lại theo số request thực.

## 4. Một phiên Roleplay trung bình — 10 lượt

| Thành phần | Số lần | Định mức dự toán | USD/phiên trước phí credits |
|---|---:|---|---:|
| Turn Analyzer | 10 | 6.000 in + 600 out/lượt | 0.009000 |
| AI Customer | 10 | 6.000 in + 220 out/lượt | 0.007100 |
| Evaluator cuối phiên | 1 | 16.000 in + 2.000 out | 0.003960 |
| Dự phòng một batch factual findings | 1 | 6.000 in + 800 out | 0.001500 |
| Embedding truy vấn kiểm chứng | 1 | 2.000 input tokens tổng/phiên | 0.000040 |
| STT Groq | 10 | 40 giây/lượt, 400 giây/phiên | 0.004444 |
| TTS WaveNet | 10 | 350 ký tự/lượt, 3.500 ký tự/phiên | 0.014000 |

| Tổng hợp | USD |
|---|---:|
| LLM + embedding qua OpenRouter | 0.021600 |
| Phí credits phân bổ 5,5% | 0.001188 |
| STT + TTS trực tiếp | 0.018444 |
| **Tổng một phiên voice** | **0.041233** |
| **10 phiên/nhân viên/tuần** | **0.412330** |
| **Một nhân viên/tháng trung bình** | **1.786761** |

Phần evaluator trong bảng gộp một call chính và một batch factual dự phòng. Đây là chấm phiên thật trong sản phẩm, không phải LLM judge của benchmark/test.

## 5. Copilot — tính riêng theo tần suất sử dụng

Định mức Copilot dùng để tính ngân sách tổng: 5 ngày làm việc/tuần; mỗi ngày 10 lượt tra cứu, 20 lần phân tích+recap, 20 nháp, 5 hỏi lịch sử và 5 gợi ý việc. Không coi một tin nhắn thường đồng nghĩa một lời gọi AI; chỉ tính khi chạy hành động tương ứng.

Analyzer khách chia chunks tối đa 24 tin, tối đa 12 chunks rồi có call recap (`intelligence_engine.py`). Bảng lấy một chunk mới/lần; rebuild lịch sử dài cần nhân thêm số chunk. Sales draft là đường retrieval riêng, không mặc định đi qua toàn graph hoặc Jev. Hỏi lịch sử không mặc định gọi corpus embedding.

| Hành động | Lần/tuần | Token dự toán tổng một hành động | USD/lần | USD/tuần trước phí |
|---|---:|---|---:|---:|
| Tra cứu có nguồn | 50 | Tổng 15.000 in + 2.200 out qua 3–4 call; Jev 18.000 input tổng; embedding 300 | 0.003362 | 0.168100 |
| Phân tích + recap khách | 100 | Một chunk extraction + một recap: tổng 12.000 in + 1.600 out | 0.002000 | 0.200000 |
| Nháp trả lời khách | 100 | 6.000 in + 400 out; embedding 100 | 0.000802 | 0.080200 |
| Hỏi đáp lịch sử khách | 25 | 6.000 in + 400 out | 0.000800 | 0.020000 |
| Gợi ý công việc từ tin nhắn | 25 | 3.000 in + 350 out | 0.000475 | 0.011875 |

**Copilot:** 0.480175 USD/tuần trước phí; **0.506585 USD/tuần**, **2.195200 USD/tháng** sau phân bổ phí credits.

Định mức Jev được tính bằng 12 bundle × 1.500 input tokens = 18.000 tokens/lượt, gồm state và câu hỏi quyết định; không tính một decision là một token. Graph simple thường ba chat calls, complex thêm planner; corrective/repack/regeneration và thay đổi lịch sử làm tăng token. Tổng input/output trong bảng gộp tất cả calls, không nhân số calls thêm lần nữa.

BM25, RRF, SQL, mở trang/hồ sơ không có phí token API riêng. Dense query có phí embedding. Search hiện dùng corpus nội bộ, không gán phí web search online. Reindex corpus là chi phí riêng khi nạp/cập nhật: mỗi 100.000 embedding tokens tương ứng 0,002 USD trước phí; chưa có số token reindex đo để cộng vào chi phí định kỳ.

## 6. Quy mô đội — cùng workload Copilot trên mỗi người

### Định mức chính — 10 phiên/người/tuần

| Nhân viên | Roleplay USD/tháng | Copilot USD/tháng | Tổng USD/tháng | Ngân sách +30% | VND minh họa sau dự phòng |
|---:|---:|---:|---:|---:|---:|
| 1 | 1.79 | 2.20 | 3.98 | 5.18 | 134,590 |
| 10 | 17.87 | 21.95 | 39.82 | 51.77 | 1,345,903 |
| 50 | 89.34 | 109.76 | 199.10 | 258.83 | 6,729,515 |
| 100 | 178.68 | 219.52 | 398.20 | 517.65 | 13,459,029 |

### Sử dụng cao — 15 phiên/người/tuần

| Nhân viên | Roleplay USD/tháng | Copilot USD/tháng | Tổng USD/tháng | Ngân sách +30% | VND minh họa sau dự phòng |
|---:|---:|---:|---:|---:|---:|
| 1 | 2.68 | 2.20 | 4.88 | 6.34 | 164,787 |
| 10 | 26.80 | 21.95 | 48.75 | 63.38 | 1,647,866 |
| 50 | 134.01 | 109.76 | 243.77 | 316.90 | 8,239,328 |
| 100 | 268.01 | 219.52 | 487.53 | 633.79 | 16,478,655 |

30% là dự phòng kế hoạch cho lượt gọi bổ sung, độ dài và giá provider, không phải trần hoặc thống kê retry đã đo. Kịch bản sử dụng cao chỉ tăng số phiên Roleplay; workload Copilot giữ nguyên. Tần suất tuần là định mức ngân sách, không phải quota phần mềm đã triển khai. Manager tự đọc/duyệt không tự sinh call evaluator mới nếu không yêu cầu chấm lại.

## 7. Độ nhạy số lượt Roleplay

Giữ định mức mỗi lượt và phần evaluator cố định để minh họa; thực tế transcript/state dài làm input tăng thêm.

| Lượt/phiên | USD/phiên voice | USD/người/tháng: 10 phiên/tuần | USD/người/tháng: 15 phiên/tuần |
|---:|---:|---:|---:|
| 8 | 0.03415 | 1.480 | 2.220 |
| 10 | 0.04123 | 1.787 | 2.680 |
| 12 | 0.04832 | 2.094 | 3.141 |
| 15 | 0.05895 | 2.554 | 3.832 |

## 8. Cách biến dự toán thành chi phí đo

Đối soát usage/cost OpenRouter theo request và model; cộng mọi call analyzer/customer/evaluator/factual repair, chat/planner/checker/Jev/embedding, gồm output reasoning nếu provider tính phí. Dùng dữ liệu voice usage theo phiên để đối soát số giây/ký tự với hóa đơn Groq/Google. Báo cáo voice hiện dùng đơn giá cấu hình 16 nên cần phân biệt estimate trong app với hóa đơn giá mới. Chạy pilot vận hành riêng; không gộp test, benchmark hay chi phí phát triển vào chi phí phục vụ người dùng.
