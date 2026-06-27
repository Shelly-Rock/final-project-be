import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';
import { ExcelService } from '../excel/excel.service';

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(
    private usersService: UsersService,
    private excelService: ExcelService,
  ) {}

  @Post()
  @Roles(Role.ADMIN, Role.SECRETARY)
  @ApiOperation({ summary: 'Create a new user' })
  async create(@Body() createDto: CreateUserDto) {
    return this.usersService.create(createDto);
  }

  @Get()
  @Roles(Role.ADMIN, Role.SECRETARY)
  @ApiOperation({ summary: 'Get all users with filters' })
  async findAll(@Query() query: any) {
    return this.usersService.findAll(query);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  async getProfile(@CurrentUser() user: any) {
    return this.usersService.findOne(user.id);
  }

  @Get('teachers')
  @Roles(Role.ADMIN, Role.SECRETARY, Role.TEACHER)
  @ApiOperation({ summary: 'Get all teachers' })
  async findTeachers() {
    return this.usersService.findTeachers();
  }

  @Get('students')
  @Roles(Role.ADMIN, Role.SECRETARY, Role.TEACHER)
  @ApiOperation({ summary: 'Get all students' })
  async findStudents(
    @Query('majorId') majorId?: string,
    @Query('classId') classId?: string,
  ) {
    return this.usersService.findStudents({ majorId, classId });
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.SECRETARY)
  @ApiOperation({ summary: 'Get user by ID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOne(id);
  }

  @Put(':id')
  @Roles(Role.ADMIN, Role.SECRETARY)
  @ApiOperation({ summary: 'Update user' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateUserDto,
  ) {
    return this.usersService.update(id, updateDto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Delete user' })
  async delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.delete(id);
  }

  @Post('import')
  @Roles(Role.ADMIN, Role.SECRETARY)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Import users from Excel file' })
  async importFromExcel(@UploadedFile() file: any) {
    const data = await this.excelService.parseExcel(file.buffer);
    return this.usersService.importUsersFromExcel(data);
  }

  @Get('export/template')
  @Roles(Role.ADMIN, Role.SECRETARY)
  @ApiOperation({ summary: 'Download user import template' })
  async downloadTemplate() {
    const template = [
      { email: 'student1@example.com', name: 'Nguyen Van A', mssv: '20210001', role: 'STUDENT' },
      { email: 'student2@example.com', name: 'Tran Thi B', mssv: '20210002', role: 'STUDENT' },
    ];
    return this.excelService.generateExcel(template, 'users_template');
  }
}
