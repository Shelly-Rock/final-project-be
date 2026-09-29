export interface RubricCriteria {
  id: string;
  title: string;
  description: string;
}

export interface RubricCategory {
  id: string;
  title: string;
  weight: number;
  criteria: RubricCriteria[];
}

export interface RubricSection {
  id: string;
  title: string;
  weight: number;
  categories: RubricCategory[];
}

export interface RubricSchema {
  id: string;
  name: string;
  courseName: string;
  grandTotalFormula: {
    sectionAWeight: number;
    sectionBWeight: number;
  };
  sections: RubricSection[];
}

const SECTION_A: RubricSection = {
  id: "A",
  title: "A. ĐÁNH GIÁ KHÓA LUẬN",
  weight: 1, // Will be overridden by grandTotalFormula
  categories: [
    {
      id: "A1",
      title: "1. Đánh giá đề tài nghiên cứu (Trọng số 15%)",
      weight: 0.15,
      criteria: [
        {
          id: "1.1",
          title: "1.1 Chủ đề nghiên cứu, nhu cầu/tầm quan trọng",
          description: "Không đạt (<4): Chủ đề không có/không rõ... | Kém (4-5.4): Mơ hồ... | TB (5.5-6.9)... | Khá (7-8.4)... | Xuất sắc (8.5-10)...",
        },
        {
          id: "1.2",
          title: "1.2 Vấn đề nghiên cứu",
          description: "Không đạt (<4): Không xác định... | Kém (4-5.4)... | TB (5.5-6.9)... | Khá (7-8.4)... | Xuất sắc (8.5-10)...",
        },
        {
          id: "1.3",
          title: "1.3 Mục tiêu nghiên cứu",
          description: "Không đạt (<4): Không có mục tiêu cụ thể... | Kém (4-5.4)... | TB (5.5-6.9)... | Khá (7-8.4)... | Xuất sắc (8.5-10)...",
        },
        {
          id: "1.4",
          title: "1.4 Câu hỏi nghiên cứu/công việc/nhận định",
          description: "Không đạt (<4): Không rõ ràng... | Kém (4-5.4)... | TB (5.5-6.9)... | Khá (7-8.4)... | Xuất sắc (8.5-10)...",
        },
      ],
    },
    {
      id: "A2",
      title: "2. Nền tảng lý thuyết (Trọng số 25%)",
      weight: 0.25,
      criteria: [
        {
          id: "2.1",
          title: "2.1 Tổng quan lý thuyết",
          description: "Không đạt (<4)... | Xuất sắc (8.5-10)...",
        },
        {
          id: "2.2",
          title: "2.2 Tài liệu/nguồn",
          description: "Không đạt (<4)... | Xuất sắc (8.5-10)...",
        },
      ],
    },
    {
      id: "A3",
      title: "3. Phương pháp nghiên cứu (Trọng số 25%)",
      weight: 0.25,
      criteria: [
        {
          id: "3.1",
          title: "3.1 Phương pháp nghiên cứu",
          description: "Không đạt (<4)... | Xuất sắc (8.5-10)...",
        },
        {
          id: "3.2",
          title: "3.2 Dữ liệu và mẫu",
          description: "Không đạt (<4)... | Xuất sắc (8.5-10)...",
        },
      ],
    },
    {
      id: "A4",
      title: "4. Giải quyết vấn đề nghiên cứu/chất lượng phân tích và thảo luận kết quả (Trọng số 25%)",
      weight: 0.25,
      criteria: [
        {
          id: "4.1",
          title: "4.1 Trình bày kết quả",
          description: "Không đạt (<4)... | Xuất sắc (8.5-10)...",
        },
        {
          id: "4.2",
          title: "4.2 Phân tích và thảo luận",
          description: "Không đạt (<4)... | Xuất sắc (8.5-10)...",
        },
        {
          id: "4.3",
          title: "4.3 Kết luận và đề xuất",
          description: "Không đạt (<4)... | Xuất sắc (8.5-10)...",
        },
      ],
    },
    {
      id: "A5",
      title: "5. Trình bày (Trọng số 10%)",
      weight: 0.10,
      criteria: [
        {
          id: "5.1",
          title: "5.1 Cấu trúc",
          description: "Không đạt (<4)... | Xuất sắc (8.5-10)...",
        },
        {
          id: "5.2",
          title: "5.2 Ngôn ngữ và thuật ngữ chuyên môn",
          description: "Không đạt (<4)... | Xuất sắc (8.5-10)...",
        },
        {
          id: "5.3",
          title: "5.3 Trích dẫn nguồn",
          description: "Không đạt (<4)... | Xuất sắc (8.5-10)...",
        },
        {
          id: "5.4",
          title: "5.4 Định dạng",
          description: "Không đạt (<4)... | Xuất sắc (8.5-10)...",
        },
      ],
    },
  ],
};

export const RUBRIC_GVHD: RubricSchema = {
  id: "GVHD",
  name: "ĐÁNH GIÁ KHÓA LUẬN TỐT NGHIỆP DÀNH CHO GIẢNG VIÊN HƯỚNG DẪN",
  courseName: "Khóa luận tốt nghiệp",
  grandTotalFormula: { sectionAWeight: 0.8, sectionBWeight: 0.2 },
  sections: [
    SECTION_A,
    {
      id: "B",
      title: "B. THÁI ĐỘ VÀ TÍNH TỰ CHỦ CỦA SINH VIÊN",
      weight: 1,
      categories: [
        {
          id: "B1",
          title: "Thái độ và tính tự chủ của sinh viên trong quá trình thực hiện Khóa luận",
          weight: 1.0,
          criteria: [
            {
              id: "b.1",
              title: "Thái độ làm việc",
              description: "Không đạt (<4): Tiêu cực... | Kém (4-5.4)... | TB (5.5-6.9)... | Khá (7-8.4)... | Xuất sắc (8.5-10): Liên tục tích cực...",
            },
          ],
        },
      ],
    },
  ],
};

export const RUBRIC_GVPB: RubricSchema = {
  id: "GVPB",
  name: "ĐÁNH GIÁ KHÓA LUẬN TỐT NGHIỆP DÀNH CHO GIẢNG VIÊN PHẢN BIỆN",
  courseName: "Khóa luận tốt nghiệp",
  grandTotalFormula: { sectionAWeight: 1.0, sectionBWeight: 0.0 }, // No section B
  sections: [SECTION_A],
};

export const RUBRIC_COMMITTEE: RubricSchema = {
  id: "COMMITTEE",
  name: "ĐÁNH GIÁ KHÓA LUẬN TỐT NGHIỆP DÀNH CHO HỘI ĐỒNG CHẤM KHÓA LUẬN",
  courseName: "Khóa luận tốt nghiệp",
  grandTotalFormula: { sectionAWeight: 0.6, sectionBWeight: 0.4 },
  sections: [
    SECTION_A,
    {
      id: "B",
      title: "B. THUYẾT TRÌNH VÀ BẢO VỆ",
      weight: 1,
      categories: [
        {
          id: "B_HD_1",
          title: "1. Nội dung (Trọng số 20%)",
          weight: 0.20,
          criteria: [
            { id: "b.hd.1", title: "Nội dung", description: "Không đạt (<4) | Kém (4-5.4) | TB (5.5-6.9) | Khá (7-8.4) | Xuất sắc (8.5-10)" }
          ]
        },
        {
          id: "B_HD_2",
          title: "2. Cấu trúc và tính hấp dẫn trực quan (Trọng số 10%)",
          weight: 0.10,
          criteria: [
            { id: "b.hd.2", title: "Cấu trúc và tính hấp dẫn", description: "" }
          ]
        },
        {
          id: "B_HD_3",
          title: "3. Kỹ năng thuyết trình (Trọng số 20%)",
          weight: 0.20,
          criteria: [
            { id: "b.hd.3", title: "Kỹ năng thuyết trình", description: "" }
          ]
        },
        {
          id: "B_HD_4",
          title: "4. Quản lý thời gian (Trọng số 20%)",
          weight: 0.20,
          criteria: [
            { id: "b.hd.4", title: "Quản lý thời gian", description: "" }
          ]
        },
        {
          id: "B_HD_5",
          title: "5. Bảo vệ (Trọng số 30%)",
          weight: 0.30,
          criteria: [
            { id: "b.hd.5", title: "Bảo vệ", description: "" }
          ]
        },
      ],
    },
  ],
};

