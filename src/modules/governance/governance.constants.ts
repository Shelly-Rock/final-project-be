import { DeadlineType } from '@prisma/client';

// ============================================================
// Nhãn tiếng Việt của 5 giai đoạn deadline — dùng chung cho
// message lỗi, email alert và API governance-state.
// ============================================================

export const DEADLINE_TYPE_LABELS: Record<DeadlineType, string> = {
  TOPIC_CREATION: 'Tạo / chỉnh sửa đề tài',
  STUDENT_REGISTRATION: 'Sinh viên đăng ký đề tài',
  TEACHER_APPROVAL: 'Giảng viên duyệt đăng ký',
  PERIODIC_REPORT: 'Báo cáo tiến độ định kỳ',
  FINAL_SUBMISSION: 'Nộp đồ án cuối kỳ',
};

/** Hành động còn thiếu, mô tả trong email alert. */
export const DEADLINE_PENDING_ACTIONS: Record<DeadlineType, string> = {
  TOPIC_CREATION: 'tạo hoặc cập nhật đề tài hướng dẫn',
  STUDENT_REGISTRATION: 'đăng ký đề tài đồ án',
  TEACHER_APPROVAL: 'duyệt các yêu cầu đăng ký đang chờ',
  PERIODIC_REPORT: 'nộp báo cáo tiến độ định kỳ',
  FINAL_SUBMISSION: 'nộp file đồ án cuối kỳ',
};

/** Đường dẫn FE gợi ý cho nút CTA trong email. */
export const DEADLINE_CTA_PATHS: Record<DeadlineType, string> = {
  TOPIC_CREATION: '/my-topic',
  STUDENT_REGISTRATION: '/student-topic',
  TEACHER_APPROVAL: '/my-topic',
  PERIODIC_REPORT: '/progress-tracking',
  FINAL_SUBMISSION: '/submission',
};

/** Thứ tự nghiệp vụ bắt buộc giữa các giai đoạn một-mốc. */
export const DEADLINE_ORDERING: DeadlineType[] = [
  DeadlineType.TOPIC_CREATION,
  DeadlineType.STUDENT_REGISTRATION,
  DeadlineType.TEACHER_APPROVAL,
  DeadlineType.FINAL_SUBMISSION,
];

/** Offset alert được phép (ngày trước hạn; 0 = đúng lúc hết hạn). */
export const ALLOWED_ALERT_OFFSETS = [0, 1, 3] as const;

export const MAX_TOPIC_LIMIT_CEILING = 10;
export const MAX_STUDENTS_PER_TOPIC_CEILING = 3;

export type DeadlineStageState =
  | 'UPCOMING'
  | 'OPEN'
  | 'CLOSED'
  | 'DISABLED'
  | 'NOT_CONFIGURED';

export interface GovernanceStage {
  type: DeadlineType;
  seq: number;
  id: number | null;
  label: string;
  deadlineAt: string | null;
  enabled: boolean;
  state: DeadlineStageState;
  /** ms còn lại tới hạn; âm nếu đã quá hạn, null nếu chưa cấu hình. */
  remainingMs: number | null;
}

export interface GovernanceView {
  periodId: number;
  config: {
    defaultTopicLimit: number;
    maxTopicLimit: number;
    maxStudentsPerTopic: number;
    alertsEnabled: boolean;
    alertOffsetsDays: number[];
    lastAlertRunAt: string | null;
  };
  /** Deadline đang "chốt" (mốc cuối cùng còn hiệu lực) theo từng loại. */
  stages: GovernanceStage[];
  /** Trạng thái đóng/mở tổng hợp để FE disable nút. */
  locks: {
    topicWritable: boolean;
    registrationOpen: boolean;
    approvalOpen: boolean;
    reportOpen: boolean;
    finalSubmissionOpen: boolean;
  };
  serverTime: string;
}

export interface EffectiveQuota {
  teacherId: number;
  assignedQuota: number;
  maxStudentsPerTopic: number;
  usedTopics: number;
  remainingTopics: number;
  isOverride: boolean;
}

/** Định dạng ngày giờ kiểu Việt Nam cho message lỗi/email. */
export function formatViDateTime(
  value: Date | string | null | undefined,
): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

/** Chuẩn hoá `alert_offsets_days` (Json) về mảng số hợp lệ, không trùng. */
export function parseAlertOffsets(raw: unknown): number[] {
  let list: unknown = raw;
  if (typeof raw === 'string') {
    try {
      list = JSON.parse(raw);
    } catch {
      list = [];
    }
  }
  if (!Array.isArray(list))
    return [...ALLOWED_ALERT_OFFSETS].sort((a, b) => b - a);

  const parsed = list
    .map((item) => Number(item))
    .filter(
      (item) =>
        Number.isInteger(item) &&
        (ALLOWED_ALERT_OFFSETS as readonly number[]).includes(item),
    );

  const unique = [...new Set(parsed)].sort((a, b) => b - a);
  return unique.length > 0
    ? unique
    : [...ALLOWED_ALERT_OFFSETS].sort((a, b) => b - a);
}

/** Map AlertEvent từ offset ngày. */
export function eventForOffset(
  offsetDays: number,
): 'DUE_IN_3_DAYS' | 'DUE_IN_1_DAY' | 'EXPIRED' {
  if (offsetDays >= 3) return 'DUE_IN_3_DAYS';
  if (offsetDays >= 1) return 'DUE_IN_1_DAY';
  return 'EXPIRED';
}
