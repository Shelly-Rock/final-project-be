import { ProjectStatus, TopicStatus } from '@prisma/client';

/**
 * Trạng thái Project chiếm chỗ trong đề tài. REJECTED không chiếm chỗ để
 * sinh viên bị từ chối có thể đăng ký đề tài khác.
 */
export const SLOT_OCCUPYING_PROJECT_STATUSES: ProjectStatus[] = [
  ProjectStatus.PENDING,
  ProjectStatus.APPROVED,
  ProjectStatus.WAITING_SECRETARY,
  ProjectStatus.ASSIGNED,
];

/**
 * Trạng thái Project được đếm vào `topics.registered_students`
 * (counter suy biến, luôn được tính lại trong cùng transaction).
 */
export const COUNTED_PROJECT_STATUSES: ProjectStatus[] = [
  ProjectStatus.APPROVED,
  ProjectStatus.ASSIGNED,
];

export const TOPIC_STATUS_LABELS: Record<TopicStatus, string> = {
  [TopicStatus.PENDING]: 'Chờ duyệt',
  [TopicStatus.APPROVED]: 'Đã duyệt',
  [TopicStatus.REJECTED]: 'Bị từ chối',
};

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  [ProjectStatus.PENDING]: 'Chờ GV duyệt',
  [ProjectStatus.APPROVED]: 'Đã duyệt',
  [ProjectStatus.REJECTED]: 'Bị từ chối',
  [ProjectStatus.WAITING_SECRETARY]: 'Chờ Thư ký',
  [ProjectStatus.ASSIGNED]: 'Được gán',
};

export const DEFAULT_DEPARTMENT_CODE = 'GEN';

/**
 * Năm dùng trong mã đề tài. Với năm học dạng "2025-2026" lấy năm kết thúc
 * (2026) → DT2026_CNTT_001. Nếu không parse được thì fallback năm hiện tại.
 */
export function resolveCodeYear(schoolYear: string | null | undefined): string {
  const years = (schoolYear ?? '').match(/\d{4}/g);
  if (years && years.length > 0) {
    return years[years.length - 1];
  }
  return String(new Date().getFullYear());
}

/**
 * Bộ môn dùng trong mã đề tài: ưu tiên mã bộ môn, chuẩn hoá về chữ in hoa
 * không dấu cách. Không có bộ môn → 'GEN'.
 */
export function resolveDepartmentCode(
  departmentId: string | null | undefined,
): string {
  const normalized = (departmentId ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

  return normalized || DEFAULT_DEPARTMENT_CODE;
}

export function formatTopicCode(
  year: string,
  departmentCode: string,
  sequence: number,
): string {
  return `DT${year}_${departmentCode}_${String(sequence).padStart(3, '0')}`;
}

export interface StudentLike {
  first_name: string;
  middle_name?: string | null;
  last_name: string;
}

export function studentFullName(student: StudentLike): string {
  return [student.last_name, student.middle_name, student.first_name]
    .filter((part) => Boolean(part && String(part).trim()))
    .join(' ');
}

export interface RegistrationSummary {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  waitingSecretary: number;
  assigned: number;
}

export function summarizeRegistrations(
  statuses: ProjectStatus[],
): RegistrationSummary {
  const summary: RegistrationSummary = {
    total: statuses.length,
    pending: 0,
    approved: 0,
    rejected: 0,
    waitingSecretary: 0,
    assigned: 0,
  };

  for (const status of statuses) {
    switch (status) {
      case ProjectStatus.PENDING:
        summary.pending += 1;
        break;
      case ProjectStatus.APPROVED:
        summary.approved += 1;
        break;
      case ProjectStatus.REJECTED:
        summary.rejected += 1;
        break;
      case ProjectStatus.WAITING_SECRETARY:
        summary.waitingSecretary += 1;
        break;
      case ProjectStatus.ASSIGNED:
        summary.assigned += 1;
        break;
    }
  }

  return summary;
}

/** Tổng hợp trạng thái đăng ký thành một nhãn cho cột "Trạng thái đăng ký". */
export function registrationHeadline(summary: RegistrationSummary): string {
  if (summary.total === 0) return 'Chưa có đăng ký';
  if (summary.pending > 0) return `${summary.pending} chờ duyệt`;
  if (summary.waitingSecretary > 0) {
    return `${summary.waitingSecretary} chờ Thư ký`;
  }
  if (summary.rejected > 0 && summary.approved + summary.assigned === 0) {
    return `${summary.rejected} bị từ chối`;
  }
  return `${summary.approved + summary.assigned} đã nhận`;
}

export function paginate<T>(
  items: T[],
  total: number,
  page: number,
  limit: number,
) {
  return {
    items,
    total,
    page,
    limit,
    totalPages: limit > 0 ? Math.ceil(total / limit) : 0,
  };
}
