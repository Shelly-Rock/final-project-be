import type { ChatRole } from './deep-links';

export interface FaqEntry {
  id: string;
  q: string;
  a: string;
  href?: string;
  roles: ChatRole[];
}

export const FAQ_ENTRIES: FaqEntry[] = [
  {
    id: 'sv-register',
    q: 'Làm sao để đăng ký đề tài?',
    a: 'Vào Đăng ký đề tài, chọn đề tài còn chỗ (OPEN), gửi yêu cầu. Trạng thái sẽ là Pending cho đến khi giảng viên/thư ký duyệt.',
    href: '/topic-registration',
    roles: ['STUDENT'],
  },
  {
    id: 'sv-deadline',
    q: 'Hạn đăng ký đề tài là khi nào?',
    a: 'Hạn nằm trong đợt đăng ký đang mở. Hỏi bot để tra cứu đợt hiện tại, hoặc mở trang Đăng ký đề tài.',
    href: '/topic-registration',
    roles: ['STUDENT'],
  },
  {
    id: 'sv-status',
    q: 'Đăng ký của tôi đang ở trạng thái nào?',
    a: 'Pending: chờ duyệt. Approved: đã nhận đề tài. Rejected: bị từ chối (xem lý do trên trang đăng ký).',
    href: '/topic-registration',
    roles: ['STUDENT'],
  },
  {
    id: 'sv-full',
    q: 'Vì sao đề tài bị FULL hoặc LOCKED?',
    a: 'FULL: đủ số sinh viên. LOCKED: giảng viên khóa nhận thêm. Chỉ đăng ký được đề tài OPEN còn chỗ.',
    href: '/topic-registration',
    roles: ['STUDENT'],
  },
  {
    id: 'sv-report',
    q: 'Cách nộp báo cáo tiến trình?',
    a: 'Vào Theo dõi tiến trình, tải mẫu (nếu có), nộp báo cáo tháng. Cần nộp ít nhất 1 báo cáo/tháng để tránh bị cấm bảo vệ.',
    href: '/progress-tracking/student',
    roles: ['STUDENT'],
  },
  {
    id: 'sv-ban',
    q: 'Bị cấm bảo vệ thì sao?',
    a: 'Hệ thống cấm nếu không đủ báo cáo tháng. Xem lý do trên trang tiến trình và liên hệ GVHD/thư ký để xem xét gỡ.',
    href: '/progress-tracking/student',
    roles: ['STUDENT'],
  },
  {
    id: 'sv-submit',
    q: 'Nộp bài cuối kỳ ở đâu?',
    a: 'Vào Nộp bài cuối kỳ, tải file Word/PDF/PowerPoint theo yêu cầu đợt.',
    href: '/submission/student',
    roles: ['STUDENT'],
  },
  {
    id: 'gv-topic',
    q: 'Cách tạo và nộp đề tài?',
    a: 'Vào Đề tài của tôi, tạo đề tài, gửi duyệt. Thư ký có thể yêu cầu chỉnh hoặc từ chối kèm lý do.',
    href: '/my-topics',
    roles: ['TEACHER'],
  },
  {
    id: 'gv-approve',
    q: 'Duyệt sinh viên đăng ký thế nào?',
    a: 'Tab yêu cầu chờ duyệt trên Đề tài của tôi: duyệt hoặc từ chối từng sinh viên.',
    href: '/my-topics',
    roles: ['TEACHER'],
  },
  {
    id: 'gv-report',
    q: 'Cách chấm báo cáo tiến trình?',
    a: 'Theo dõi tiến trình → báo cáo chờ duyệt: duyệt/từ chối, điểm 1–10, nhận xét.',
    href: '/progress-tracking/teacher',
    roles: ['TEACHER'],
  },
  {
    id: 'gv-score',
    q: 'Phiếu chấm điểm ở đâu?',
    a: 'Vào Phiếu chấm điểm: lưu nháp rồi nộp. Tiêu chí gồm nội dung, phương pháp, kết quả, trình bày, tài liệu.',
    href: '/scoring/teacher',
    roles: ['TEACHER'],
  },
  {
    id: 'ad-period',
    q: 'Cách mở đợt đăng ký?',
    a: 'Đợt đăng ký: tạo đợt, hạn GV nộp đề tài, hạn SV đăng ký, quota mặc định, rồi mở đợt.',
    href: '/registration-periods',
    roles: ['ADMIN', 'SECRETARY'],
  },
  {
    id: 'ad-moderate',
    q: 'Duyệt đề tài giảng viên ở đâu?',
    a: 'Cấu hình & Duyệt đề tài: phê duyệt hoặc từ chối kèm ghi chú.',
    href: '/project-config',
    roles: ['ADMIN', 'SECRETARY'],
  },
  {
    id: 'ad-committee',
    q: 'Lập hội đồng bảo vệ thế nào?',
    a: 'Hội đồng bảo vệ: tạo hội đồng, gán chủ tịch, thư ký, phản biện trong/ngoài.',
    href: '/committee',
    roles: ['ADMIN', 'SECRETARY'],
  },
  {
    id: 'ad-defense',
    q: 'Xếp lịch bảo vệ ở đâu?',
    a: 'Lịch bảo vệ: tạo ca (ngày, giờ, phòng, hội đồng), gán đồ án theo thứ tự.',
    href: '/defense-schedule',
    roles: ['ADMIN', 'SECRETARY'],
  },
];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

export function searchFaq(role: ChatRole, query: string): FaqEntry[] {
  const q = normalize(query);
  const tokens = q.split(/\s+/).filter((t) => t.length >= 2);
  return FAQ_ENTRIES.filter((entry) => entry.roles.includes(role))
    .map((entry) => {
      const hay = normalize(`${entry.q} ${entry.a}`);
      const score = tokens.reduce(
        (sum, token) => sum + (hay.includes(token) ? 1 : 0),
        0,
      );
      return { entry, score };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((row) => row.entry);
}

export function faqForRole(role: ChatRole): FaqEntry[] {
  return FAQ_ENTRIES.filter((entry) => entry.roles.includes(role));
}
