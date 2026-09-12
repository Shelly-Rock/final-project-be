export type ChatRole = 'ADMIN' | 'SECRETARY' | 'TEACHER' | 'STUDENT';

export interface DeepLink {
  label: string;
  path: string;
}

const LINKS: Record<ChatRole, DeepLink[]> = {
  STUDENT: [
    { label: 'Đăng ký đề tài', path: '/topic-registration' },
    { label: 'Theo dõi tiến trình', path: '/progress-tracking/student' },
    { label: 'Nộp bài cuối kỳ', path: '/submission/student' },
  ],
  TEACHER: [
    { label: 'Đề tài của tôi', path: '/my-topics' },
    { label: 'Theo dõi tiến trình', path: '/progress-tracking/teacher' },
    { label: 'Phiếu chấm điểm', path: '/scoring/teacher' },
  ],
  SECRETARY: [
    { label: 'Quản lý sinh viên', path: '/students' },
    { label: 'Quản lý giảng viên', path: '/teachers' },
    { label: 'Đợt đăng ký', path: '/registration-periods' },
    { label: 'Cấu hình & Duyệt đề tài', path: '/project-config' },
    { label: 'Dashboard Thư ký', path: '/dashboard' },
    { label: 'Nộp bài cuối kỳ', path: '/submission/admin' },
    { label: 'Hội đồng bảo vệ', path: '/committee' },
    { label: 'Lịch bảo vệ', path: '/defense-schedule' },
    { label: 'Quản lý chấm điểm', path: '/scoring/admin' },
    { label: 'Nhật ký Audit', path: '/audit' },
  ],
  ADMIN: [
    { label: 'Quản lý sinh viên', path: '/students' },
    { label: 'Quản lý giảng viên', path: '/teachers' },
    { label: 'Đợt đăng ký', path: '/registration-periods' },
    { label: 'Cấu hình & Duyệt đề tài', path: '/project-config' },
    { label: 'Theo dõi tiến trình', path: '/progress-tracking/admin' },
    { label: 'Phân quyền', path: '/role' },
    { label: 'Nhật ký Audit', path: '/audit' },
    { label: 'Dashboard Thư ký', path: '/dashboard' },
    { label: 'Nộp bài cuối kỳ', path: '/submission/admin' },
    { label: 'Hội đồng bảo vệ', path: '/committee' },
    { label: 'Lịch bảo vệ', path: '/defense-schedule' },
    { label: 'Quản lý chấm điểm', path: '/scoring/admin' },
    { label: 'Đăng ký đề tài', path: '/topic-registration' },
  ],
};

export function linksForRole(role: ChatRole): DeepLink[] {
  return LINKS[role] ?? LINKS.STUDENT;
}

export function formatLinksForPrompt(role: ChatRole): string {
  return linksForRole(role)
    .map((link) => `- ${link.label}: ${link.path}`)
    .join('\n');
}
