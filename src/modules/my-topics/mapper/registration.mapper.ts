export class RegistrationMapper {
  static toRegisteredStudent(entity: any) {
    if (!entity) return null;
    
    const student = entity.student || {};
    const fullName = [student.first_name, student.middle_name, student.last_name]
      .filter(Boolean)
      .join(' ');

    return {
      id: entity.id,
      studentId: entity.student_id,
      studentName: fullName,
      studentCode: student.student_id,
      email: student.user?.email,
      status: entity.status,
      registeredAt: entity.registered_at,
      approvedAt: entity.approved_at,
      approvedBy: entity.approved_by_id,
      rejectedAt: entity.rejected_at,
      rejectedBy: entity.rejected_by_id,
      rejectionReason: entity.rejection_reason,
      assignedRole: entity.assigned_role,
      assignedTask: entity.assigned_task,
    };
  }

  static toPendingRequest(entity: any) {
    if (!entity) return null;

    const student = entity.student || {};
    const fullName = [student.first_name, student.middle_name, student.last_name]
      .filter(Boolean)
      .join(' ');

    return {
      id: entity.id,
      studentId: entity.student_id,
      studentName: fullName,
      studentCode: student.student_id,
      topicId: entity.topic?.id,
      topicName: entity.topic?.name,
      requestedAt: entity.registered_at,
      status: entity.status,
    };
  }
}