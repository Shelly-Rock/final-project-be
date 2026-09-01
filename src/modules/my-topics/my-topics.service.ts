import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma/prisma.service';
import { CreateTopicDto, UpdateTopicDto, ApproveRegistrationDto, RejectRegistrationDto, LockTopicDto } from './dto';
import { TopicMapper, RegistrationMapper } from './mapper';
import { TopicStatus, RegistrationPeriodStatus } from '@prisma/client';

@Injectable()
export class MyTopicsService {
  constructor(private readonly prisma: PrismaService) {}

  private async getTeacherIdFromUserId(userId: number): Promise<number> {
    const teacher = await this.prisma.teacher.findUnique({
      where: { user_id: userId }
    });

    if (!teacher) {
      throw new ForbiddenException('Tài khoản này không phải là giảng viên');
    }
    return teacher.id;
  }
  
  async getMyTopics(userId: number) {
    const teacherId = await this.getTeacherIdFromUserId(userId);

    return this.prisma.topic.findMany({
      where: { teacher_id: teacherId },
      include: {
        period: true,
        registrations: { include: { student: true } },
      },
      orderBy: { created_at: 'desc' }
    });
  }

  async createTopic(userId: number, dto: CreateTopicDto) {
    const teacherId = await this.getTeacherIdFromUserId(userId);
    const period = await this.prisma.registrationPeriod.findUnique({
      where: { id: dto.periodId }
    });

    if (!period) {
      throw new NotFoundException('Đợt đăng ký không tồn tại');
    }

    if (period.status !== RegistrationPeriodStatus.OPEN) {
      throw new BadRequestException('Không thể tạo đề tài: Đợt đăng ký này đã đóng hoặc chưa mở');
    }

    const initialStatus = dto.isException 
      ? TopicStatus.WAITING_FOR_SECRETARY 
      : TopicStatus.PENDING;


    const newTopic = await this.prisma.topic.create({
      data: {
        name: dto.name,
        english_name: dto.englishName,
        description: dto.description,
        objectives: dto.objectives,
        technologies: dto.technologies,
        max_students: dto.maxStudents,
        is_exception: dto.isException || false,
        department: dto.teacherDepartment,

        teacher_id: teacherId,
        period_id: dto.periodId,
        
        status: initialStatus,
        registration_status: 'OPEN',
      },
    });

    if (dto.preAssignedStudentIds && dto.preAssignedStudentIds.length > 0) {
      await this.handlePreAssignedStudents(newTopic.id, dto.preAssignedStudentIds);
    }

    return newTopic;
  }

async getPendingRequests(userId: number) {
    const teacherId = await this.getTeacherIdFromUserId(userId);

    const pendingData = await this.prisma.registeredStudent.findMany({
      where: {
        status: 'PENDING',
        topic: { teacher_id: teacherId },
      },
      include: {
        student: true,
        topic: true,
      },
      orderBy: { registered_at: 'desc' },
    });

    return pendingData.map(req => RegistrationMapper.toPendingRequest(req));
  }

 async getTopicDetail(userId: number, topicId: number) {
    const teacherId = await this.getTeacherIdFromUserId(userId);

    const topic = await this.prisma.topic.findFirst({
      where: { id: topicId, teacher_id: teacherId },
      include: {
        period: true,
        registrations: {
          include: { student: { include: { user: true } } },
        },
        pre_assignments: true,
      },
    });

    if (!topic) throw new NotFoundException('Không tìm thấy đề tài');

    return TopicMapper.toMyTopic(topic);
  }
  
  async updateTopic(topicId: number, userId: number, dto: UpdateTopicDto) {
    const teacherId = await this.getTeacherIdFromUserId(userId);

    const existingTopic = await this.prisma.topic.findUnique({
      where: { id: topicId }
    });

    if (!existingTopic) {
      throw new NotFoundException('Đề tài không tồn tại');
    }

    if (existingTopic.teacher_id !== teacherId) {
      throw new ForbiddenException('Bạn không có quyền chỉnh sửa đề tài này');
    }

    if (existingTopic.status === TopicStatus.APPROVED) {
      throw new BadRequestException('Không thể chỉnh sửa đề tài đã được duyệt');
    }

    return this.prisma.topic.update({
      where: { id: topicId },
      data: {
        name: dto.name,
        english_name: dto.englishName,
        description: dto.description,
        objectives: dto.objectives,
        technologies: dto.technologies,
        max_students: dto.maxStudents,
        is_exception: dto.isException,
        department: dto.teacherDepartment,
        status: dto.status, 
      },
    });
  }

  async getRegisteredStudents(userId: number, topicId: number) {
    const teacherId = await this.getTeacherIdFromUserId(userId);

    const topicExists = await this.prisma.topic.findFirst({
      where: { id: topicId, teacher_id: teacherId },
    });
    if (!topicExists) throw new ForbiddenException('Bạn không có quyền truy cập');

    const registrations = await this.prisma.registeredStudent.findMany({
      where: { topic_id: topicId },
      include: {
        student: { include: { user: true } },
      },
      orderBy: { registered_at: 'desc' },
    });

    return registrations.map(reg => RegistrationMapper.toRegisteredStudent(reg));
  }

  async approveRegistration(topicId: number, userId: number, dto: ApproveRegistrationDto) {
    const teacherId = await this.getTeacherIdFromUserId(userId);

    const topic = await this.prisma.topic.findUnique({ where: { id: topicId } });
    
    if (!topic) throw new NotFoundException('Đề tài không tồn tại');
    if (topic.teacher_id !== teacherId) throw new ForbiddenException('Bạn không có quyền thao tác trên đề tài này');
    if (topic.registration_status !== 'OPEN') throw new BadRequestException('Đề tài không ở trạng thái mở đăng ký');

    const registration = await this.prisma.registeredStudent.findUnique({
      where: {
        topic_id_student_id: { topic_id: topicId, student_id: dto.studentId }
      }
    });

    if (!registration) throw new NotFoundException('Không tìm thấy yêu cầu đăng ký của sinh viên này');
    if (registration.status !== 'PENDING') throw new BadRequestException('Yêu cầu đăng ký không ở trạng thái chờ duyệt');

    const approvedCount = await this.prisma.registeredStudent.count({
      where: { topic_id: topicId, status: 'APPROVED' }
    });

    if (approvedCount >= topic.max_students) {
      throw new BadRequestException('Đề tài đã đạt đủ số lượng sinh viên tối đa');
    }

    const isFullNow = approvedCount + 1 >= topic.max_students;

    const updatedRegistration = await this.prisma.registeredStudent.update({
      where: { id: registration.id },
      data: {
        status: 'APPROVED',
        approved_at: new Date(),
        approved_by_id: userId,
      }
    });

    await this.prisma.topic.update({
      where: { id: topicId },
      data: {
        registered_students: approvedCount + 1,
        registration_status: isFullNow ? 'FULL' : 'OPEN'
      }
    });

    return updatedRegistration;
  }

  async rejectRegistration(topicId: number, userId: number, dto: RejectRegistrationDto) {
    const teacherId = await this.getTeacherIdFromUserId(userId);

    const topic = await this.prisma.topic.findUnique({ where: { id: topicId } });
    
    if (!topic) throw new NotFoundException('Đề tài không tồn tại');
    if (topic.teacher_id !== teacherId) throw new ForbiddenException('Bạn không có quyền thao tác trên đề tài này');

    const registration = await this.prisma.registeredStudent.findUnique({
      where: {
        topic_id_student_id: { topic_id: topicId, student_id: dto.studentId }
      }
    });

    if (!registration) throw new NotFoundException('Không tìm thấy yêu cầu đăng ký của sinh viên này');
    if (registration.status !== 'PENDING') throw new BadRequestException('Yêu cầu đăng ký không ở trạng thái chờ duyệt');

    return this.prisma.registeredStudent.update({
      where: { id: registration.id },
      data: {
        status: 'REJECTED',
        rejected_at: new Date(),
        rejected_by_id: userId,
        rejection_reason: dto.reason
      }
    });
  }

  async lockTopic(topicId: number, userId: number, dto: LockTopicDto) {
    const teacherId = await this.getTeacherIdFromUserId(userId);

    const topic = await this.prisma.topic.findUnique({
      where: { id: topicId },
      include: { registrations: true }
    });

    if (!topic) throw new NotFoundException('Đề tài không tồn tại');
    if (topic.teacher_id !== teacherId) throw new ForbiddenException('Bạn không có quyền thao tác trên đề tài này');
    if (topic.registration_status === 'LOCKED') throw new BadRequestException('Đề tài đã bị khóa từ trước');

    const approvedStudentIds = topic.registrations
      .filter(reg => reg.status === 'APPROVED')
      .map(reg => reg.student_id);

    if (approvedStudentIds.length === 0) {
      throw new BadRequestException('Không thể khóa đề tài khi chưa có sinh viên nào được duyệt');
    }

    if (!dto.assignments || dto.assignments.length !== approvedStudentIds.length) {
      throw new BadRequestException('Bạn phải phân công nhiệm vụ cho TẤT CẢ sinh viên đã được duyệt trước khi khóa');
    }

    for (const assignment of dto.assignments) {
      if (!approvedStudentIds.includes(assignment.studentId)) {
        throw new BadRequestException(`Sinh viên ID ${assignment.studentId} chưa được duyệt vào đề tài này`);
      }
      if (!assignment.assignedTask || assignment.assignedTask.trim() === '') {
        throw new BadRequestException(`Nhiệm vụ phân công cho sinh viên ID ${assignment.studentId} không được để trống`);
      }
    }

    return this.prisma.$transaction(async (prisma) => {
      const updatedTopic = await prisma.topic.update({
        where: { id: topicId },
        data: { registration_status: 'LOCKED' }
      });

      for (const assignment of dto.assignments) {
        const registration = topic.registrations.find(r => r.student_id === assignment.studentId);

        if (registration) {
          await prisma.registeredStudent.update({
            where: { id: registration.id },
            data: {
              assigned_role: assignment.assignedRole,
              assigned_task: assignment.assignedTask,
            }
          });
        }
      }

      return updatedTopic;
    });
  }

  async updateAssignments(userId: number, topicId: number, dto: any) {
    const teacherId = await this.getTeacherIdFromUserId(userId);

    const topic = await this.prisma.topic.findFirst({
      where: { id: topicId, teacher_id: teacherId },
    });

    if (!topic) throw new ForbiddenException('Bạn không có quyền thao tác trên đề tài này');
    if (topic.registration_status !== 'LOCKED') {
      throw new BadRequestException('Chỉ có thể cập nhật phân công khi đề tài đã KHÓA');
    }

    const updatePromises = dto.assignments.map((assignment) => {
      if (!assignment.assignedTask) {
        throw new BadRequestException('Nhiệm vụ không được để trống');
      }

      return this.prisma.registeredStudent.update({
        where: {
          topic_id_student_id: {
            topic_id: topicId,
            student_id: assignment.studentId,
          },
        },
        data: {
          assigned_role: assignment.assignedRole,
          assigned_task: assignment.assignedTask,
        },
      });
    });

    await this.prisma.$transaction(updatePromises);
    return { message: 'Cập nhật phân công thành công' };
  }

  async unlockTopic(topicId: number, userId: number) {
    const teacherId = await this.getTeacherIdFromUserId(userId);

    const topic = await this.prisma.topic.findUnique({
      where: { id: topicId }
    });

    if (!topic) throw new NotFoundException('Đề tài không tồn tại');
    if (topic.teacher_id !== teacherId) throw new ForbiddenException('Bạn không có quyền thao tác trên đề tài này');
    if (topic.registration_status !== 'LOCKED') throw new BadRequestException('Đề tài hiện không bị khóa');

    const isFull = topic.registered_students >= topic.max_students;

    return this.prisma.topic.update({
      where: { id: topicId },
      data: {
        registration_status: isFull ? 'FULL' : 'OPEN'
      }
    });
  }

  private async handlePreAssignedStudents(topicId: number, studentIds: number[]) {
    const preAssignData = studentIds.map((studentId, index) => ({
      topic_id: topicId,
      student_id: studentId,
      assignment_order: index + 1,
    }));

    await this.prisma.preAssignedStudent.createMany({
      data: preAssignData,
      skipDuplicates: true,
    });
  }

  async deleteTopic(userId: number, topicId: number) {
    const teacherId = await this.getTeacherIdFromUserId(userId);

    const topic = await this.prisma.topic.findFirst({
      where: { id: topicId, teacher_id: teacherId },
      include: { registrations: true },
    });

    if (!topic) throw new NotFoundException('Không tìm thấy đề tài');

    const hasApprovedStudent = topic.registrations.some(
      (reg) => reg.status === 'APPROVED'
    );
    if (hasApprovedStudent) {
      throw new BadRequestException('Không thể xóa đề tài đã có sinh viên được duyệt');
    }

    await this.prisma.topic.delete({
      where: { id: topicId },
    });

    return { message: 'Xóa đề tài thành công' };
  }
}
