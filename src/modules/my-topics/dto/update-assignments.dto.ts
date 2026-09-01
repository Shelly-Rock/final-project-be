import { ApiProperty } from '@nestjs/swagger';

class AssignmentItem {
  @ApiProperty({ description: 'ID của sinh viên', example: 101 })
  studentId: number;

  @ApiProperty({ description: 'Vai trò trong nhóm (tùy chọn)', required: false, example: 'Nhóm trưởng' })
  assignedRole?: string;

  @ApiProperty({ description: 'Nhiệm vụ được giao', example: 'Làm giao diện đăng nhập' })
  assignedTask: string;
}

export class UpdateAssignmentsDto {
  @ApiProperty({ type: [AssignmentItem], description: 'Danh sách phân công nhiệm vụ' })
  assignments: AssignmentItem[];
}