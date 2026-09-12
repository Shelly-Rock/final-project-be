import { Injectable } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma/prisma.service';
import type { JwtUser } from '@core/auth/interfaces/currentUser.interface';
import { TopicService } from '@modules/topic/topic.service';
import { ProgressTrackingService } from '@modules/progress-tracking/progress-tracking.service';
import { SubmissionService } from '@modules/submission/submission.service';
import { DefenseService } from '@modules/defense/defense.service';
import { ScoringService } from '@modules/scoring/scoring.service';
import type { ChatRole } from './knowledge/deep-links';
import { searchFaq } from './knowledge/faq';

const EMPTY = { ok: false as const, reason: 'không có dữ liệu' };
const MAX_LIST = 15;
const MAX_TEXT = 240;

const EMPTY_SCHEMA = { type: 'object', properties: {} } as const;

export type ChatToolDef = {
  name: string;
  description: string;
  parametersJsonSchema: Record<string, unknown>;
  run: (args: Record<string, unknown>) => Promise<string>;
};

function truncateValue(value: unknown): unknown {
  if (typeof value === 'string' && value.length > MAX_TEXT) {
    return `${value.slice(0, MAX_TEXT)}…`;
  }
  if (Array.isArray(value)) {
    return value.slice(0, MAX_LIST).map(truncateValue);
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      out[key] = truncateValue(nested);
    }
    return out;
  }
  return value;
}

async function wrapSafe(fn: () => Promise<unknown>): Promise<string> {
  try {
    const data = await fn();
    if (data == null) return JSON.stringify(EMPTY);
    return JSON.stringify({ ok: true, data: truncateValue(data) });
  } catch {
    return JSON.stringify(EMPTY);
  }
}

function normalizeRole(role: string): ChatRole {
  const upper = (role || '').toUpperCase();
  if (
    upper === 'ADMIN' ||
    upper === 'SECRETARY' ||
    upper === 'TEACHER' ||
    upper === 'STUDENT'
  ) {
    return upper;
  }
  return 'STUDENT';
}

function str(args: Record<string, unknown>, key: string): string | undefined {
  const value = args[key];
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function num(args: Record<string, unknown>, key: string): number | undefined {
  const value = args[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return undefined;
}

@Injectable()
export class ChatToolsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly topics: TopicService,
    private readonly progress: ProgressTrackingService,
    private readonly submissions: SubmissionService,
    private readonly defense: DefenseService,
    private readonly scoring: ScoringService,
  ) {}

  private async resolveStudentId(userId: number): Promise<number | null> {
    const student = await this.prisma.student.findFirst({
      where: { user_id: userId, deleted_at: null },
      select: { id: true },
    });
    return student?.id ?? null;
  }

  private async resolveTeacherId(userId: number): Promise<number | null> {
    const teacher = await this.prisma.teacher.findFirst({
      where: { user_id: userId, deleted_at: null },
      select: { id: true },
    });
    return teacher?.id ?? null;
  }

  createTools(user: JwtUser): ChatToolDef[] {
    const role = normalizeRole(user.role);
    const actorUserId = user.sub;

    const searchFaqTool: ChatToolDef = {
      name: 'search_faq',
      description:
        'Tìm FAQ hướng dẫn dùng hệ thống theo vai trò hiện tại. Dùng cho câu how-to.',
      parametersJsonSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Câu hỏi hoặc từ khóa' },
        },
        required: ['query'],
      },
      run: async (args) =>
        JSON.stringify({
          ok: true,
          hits: searchFaq(role, str(args, 'query') ?? '').map((item) => ({
            q: item.q,
            a: item.a,
            href: item.href,
          })),
        }),
    };

    const studentTools: ChatToolDef[] = [
      {
        name: 'get_registration_window',
        description: 'Lấy đợt đăng ký hiện tại: hạn, đang mở hay đã hết.',
        parametersJsonSchema: EMPTY_SCHEMA,
        run: async () => wrapSafe(() => this.topics.getGovernanceState()),
      },
      {
        name: 'list_available_topics',
        description: 'Danh sách đề tài sinh viên có thể đăng ký (tối đa 15).',
        parametersJsonSchema: {
          type: 'object',
          properties: {
            search: {
              type: 'string',
              description: 'Từ khóa tên đề tài hoặc GV',
            },
          },
        },
        run: async (args) =>
          wrapSafe(() =>
            this.topics.listAvailableTopics(
              { search: str(args, 'search'), limit: 15, page: 1 },
              actorUserId,
            ),
          ),
      },
      {
        name: 'get_my_registration',
        description: 'Đăng ký đề tài của sinh viên đang đăng nhập.',
        parametersJsonSchema: EMPTY_SCHEMA,
        run: async () => wrapSafe(() => this.topics.getMyRegistration(actorUserId)),
      },
      {
        name: 'get_my_progress',
        description: 'Tiến trình đồ án của sinh viên đang đăng nhập.',
        parametersJsonSchema: EMPTY_SCHEMA,
        run: async () =>
          wrapSafe(async () => {
            const studentId = await this.resolveStudentId(actorUserId);
            if (!studentId) throw new Error('no student');
            return this.progress.getStudentProgressById(studentId);
          }),
      },
      {
        name: 'get_my_reports',
        description: 'Báo cáo tiến trình của sinh viên đang đăng nhập.',
        parametersJsonSchema: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              description: 'PENDING | APPROVED | REJECTED',
            },
          },
        },
        run: async (args) =>
          wrapSafe(async () => {
            const studentId = await this.resolveStudentId(actorUserId);
            if (!studentId) throw new Error('no student');
            return this.progress.getReports({
              student_id: studentId,
              status: str(args, 'status') as never,
              limit: 15,
              page: 1,
            });
          }),
      },
      {
        name: 'get_my_submissions',
        description: 'Bài nộp cuối kỳ của sinh viên đang đăng nhập.',
        parametersJsonSchema: EMPTY_SCHEMA,
        run: async () =>
          wrapSafe(async () => {
            const studentId = await this.resolveStudentId(actorUserId);
            if (!studentId) throw new Error('no student');
            return this.submissions.getSubmissions({
              student_id: studentId,
              limit: 15,
              page: 1,
            });
          }),
      },
      {
        name: 'get_my_defense',
        description: 'Lịch bảo vệ liên quan sinh viên đang đăng nhập.',
        parametersJsonSchema: EMPTY_SCHEMA,
        run: async () =>
          wrapSafe(async () => {
            const studentId = await this.resolveStudentId(actorUserId);
            if (!studentId) throw new Error('no student');
            const project = await this.prisma.project.findFirst({
              where: { student_id: studentId, deleted_at: null },
              select: { id: true, project_id: true, project_name: true },
            });
            if (!project) return null;
            const links = await this.prisma.defense_session_projects.findMany({
              where: { project_id: project.id },
              take: MAX_LIST,
              orderBy: { order_index: 'asc' },
            });
            if (links.length === 0) return { project, sessions: [] };
            const sessionIds = links.map((row) => row.session_id);
            const sessions = await this.prisma.defense_sessions.findMany({
              where: { id: { in: sessionIds }, deleted_at: null },
              select: {
                id: true,
                defense_date: true,
                start_time: true,
                room: true,
                status: true,
              },
            });
            return { project, sessions, slots: links };
          }),
      },
      {
        name: 'get_my_score_results',
        description: 'Kết quả điểm của sinh viên đang đăng nhập.',
        parametersJsonSchema: EMPTY_SCHEMA,
        run: async () =>
          wrapSafe(async () => {
            const studentId = await this.resolveStudentId(actorUserId);
            if (!studentId) throw new Error('no student');
            const result = await this.prisma.scoring_results.findFirst({
              where: { student_id: studentId },
            });
            const scores = await this.prisma.independent_scores.findMany({
              where: { student_id: studentId },
              take: MAX_LIST,
              select: {
                id: true,
                scoring_type: true,
                status: true,
                score: true,
                max_score: true,
                role: true,
              },
            });
            if (!result && scores.length === 0) return null;
            return { result, scores };
          }),
      },
    ];

    const teacherTools: ChatToolDef[] = [
      {
        name: 'get_reports',
        description: 'Báo cáo tiến trình thuộc phạm vi giảng viên đang đăng nhập.',
        parametersJsonSchema: {
          type: 'object',
          properties: { status: { type: 'string' } },
        },
        run: async (args) =>
          wrapSafe(async () => {
            const teacherId = await this.resolveTeacherId(actorUserId);
            if (!teacherId) throw new Error('no teacher');
            return this.progress.getReports({
              teacher_id: teacherId,
              status: str(args, 'status') as never,
              limit: 15,
              page: 1,
            });
          }),
      },
      {
        name: 'get_supervised_progress',
        description: 'Tiến trình sinh viên do giảng viên hướng dẫn.',
        parametersJsonSchema: EMPTY_SCHEMA,
        run: async () =>
          wrapSafe(async () => {
            const teacherId = await this.resolveTeacherId(actorUserId);
            if (!teacherId) throw new Error('no teacher');
            return this.progress.getStudentProgress({
              teacher_id: teacherId,
              limit: 15,
              page: 1,
            });
          }),
      },
      {
        name: 'get_my_score_sheets',
        description: 'Phiếu chấm của giảng viên đang đăng nhập.',
        parametersJsonSchema: {
          type: 'object',
          properties: { status: { type: 'string' } },
        },
        run: async (args) =>
          wrapSafe(async () => {
            const teacherId = await this.resolveTeacherId(actorUserId);
            if (!teacherId) throw new Error('no teacher');
            return this.scoring.getMyScores(teacherId, {
              status: str(args, 'status') as never,
              limit: 15,
              page: 1,
            });
          }),
      },
      {
        name: 'get_submissions',
        description: 'Danh sách bài nộp cuối kỳ trong phạm vi quyền hiện tại.',
        parametersJsonSchema: EMPTY_SCHEMA,
        run: async () =>
          wrapSafe(() => this.submissions.getSubmissions({ limit: 15, page: 1 })),
      },
      {
        name: 'get_defense_sessions',
        description: 'Lịch bảo vệ trong phạm vi quyền hiện tại.',
        parametersJsonSchema: EMPTY_SCHEMA,
        run: async () =>
          wrapSafe(() => this.defense.getDefenseSessions({ limit: 15, page: 1 })),
      },
    ];

    const staffTools: ChatToolDef[] = [
      {
        name: 'get_reports',
        description: 'Báo cáo tiến trình (lọc tùy chọn theo sinh viên).',
        parametersJsonSchema: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            studentId: { type: 'integer', description: 'ID sinh viên' },
          },
        },
        run: async (args) =>
          wrapSafe(() =>
            this.progress.getReports({
              status: str(args, 'status') as never,
              student_id: num(args, 'studentId'),
              limit: 15,
              page: 1,
            }),
          ),
      },
      {
        name: 'get_student_progress',
        description: 'Tiến trình một sinh viên. Chỉ admin/thư ký.',
        parametersJsonSchema: {
          type: 'object',
          properties: {
            studentId: { type: 'integer', description: 'ID sinh viên trên hệ thống' },
          },
          required: ['studentId'],
        },
        run: async (args) => {
          if (role !== 'ADMIN' && role !== 'SECRETARY') {
            return JSON.stringify(EMPTY);
          }
          const studentId = num(args, 'studentId');
          if (!studentId) return JSON.stringify(EMPTY);
          return wrapSafe(() => this.progress.getStudentProgressById(studentId));
        },
      },
      {
        name: 'get_submissions',
        description: 'Danh sách bài nộp cuối kỳ.',
        parametersJsonSchema: {
          type: 'object',
          properties: { status: { type: 'string' } },
        },
        run: async (args) =>
          wrapSafe(() =>
            this.submissions.getSubmissions({
              status: str(args, 'status') as never,
              limit: 15,
              page: 1,
            }),
          ),
      },
      {
        name: 'get_defense_sessions',
        description: 'Danh sách ca bảo vệ.',
        parametersJsonSchema: {
          type: 'object',
          properties: { status: { type: 'string' } },
        },
        run: async (args) =>
          wrapSafe(() =>
            this.defense.getDefenseSessions({
              status: str(args, 'status') as never,
              limit: 15,
              page: 1,
            }),
          ),
      },
      {
        name: 'get_score_results',
        description: 'Kết quả điểm tổng hợp.',
        parametersJsonSchema: EMPTY_SCHEMA,
        run: async () =>
          wrapSafe(() => this.scoring.getAllScoringResults({ limit: 15, page: 1 })),
      },
      {
        name: 'get_all_scores',
        description: 'Danh sách phiếu chấm.',
        parametersJsonSchema: {
          type: 'object',
          properties: { status: { type: 'string' } },
        },
        run: async (args) =>
          wrapSafe(() =>
            this.scoring.getScores({
              status: str(args, 'status') as never,
              limit: 15,
              page: 1,
            }),
          ),
      },
    ];

    if (role === 'STUDENT') return [searchFaqTool, ...studentTools];
    if (role === 'TEACHER') return [searchFaqTool, ...teacherTools];
    return [searchFaqTool, ...staffTools];
  }
}
