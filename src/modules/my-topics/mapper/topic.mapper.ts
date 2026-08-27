import { RegistrationMapper } from './registration.mapper';

export class TopicMapper {
  static toMyTopic(entity: any) {
    if (!entity) return null;

    return {
      id: entity.id,
      periodId: entity.period_id,
      periodName: entity.period?.name,
      name: entity.name,
      englishName: entity.english_name,
      description: entity.description,
      objectives: entity.objectives,
      technologies: entity.technologies,
      maxStudents: entity.max_students,
      status: entity.status,
      isException: entity.is_exception,
      department: entity.department,
      rejectionReason: entity.rejection_reason,
      registrationStatus: entity.registration_status,
      createdAt: entity.created_at,
      updatedAt: entity.updated_at,

      registeredStudents: Array.isArray(entity.registrations) 
        ? entity.registrations.map((reg: any) => RegistrationMapper.toRegisteredStudent(reg))
        : [],
        
      preAssignedStudents: Array.isArray(entity.pre_assignments)
        ? entity.pre_assignments
        : [],
    };
  }
}