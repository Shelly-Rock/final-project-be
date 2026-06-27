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
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto, UpdateDepartmentDto } from './dto/department.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { ExcelService } from '../excel/excel.service';

@ApiTags('Departments')
@Controller('departments')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class DepartmentsController {
  constructor(
    private departmentsService: DepartmentsService,
    private excelService: ExcelService,
  ) {}

  @Post()
  @Roles(Role.ADMIN, Role.SECRETARY)
  @ApiOperation({ summary: 'Create a new department' })
  async create(@Body() createDto: CreateDepartmentDto) {
    return this.departmentsService.create(createDto);
  }

  @Get()
  @Roles(Role.ADMIN, Role.SECRETARY, Role.TEACHER)
  @ApiOperation({ summary: 'Get all departments' })
  async findAll(
    @Query('skip', new DefaultValuePipe(0), ParseIntPipe) skip: number,
    @Query('take', new DefaultValuePipe(100), ParseIntPipe) take: number,
    @Query('search') search?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.departmentsService.findAll({
      skip,
      take,
      search,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    });
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.SECRETARY, Role.TEACHER)
  @ApiOperation({ summary: 'Get department by ID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.departmentsService.findOne(id);
  }

  @Put(':id')
  @Roles(Role.ADMIN, Role.SECRETARY)
  @ApiOperation({ summary: 'Update department' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateDepartmentDto,
  ) {
    return this.departmentsService.update(id, updateDto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Delete department' })
  async delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.departmentsService.delete(id);
  }

  @Post('import')
  @Roles(Role.ADMIN, Role.SECRETARY)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Import departments from Excel file' })
  async importFromExcel(@UploadedFile() file: any) {
    const data = await this.excelService.parseExcel(file.buffer);
    const departments = data.map((row: any) => ({
      code: row['code'] || row['ma'] || '',
      name: row['name'] || row['ten'] || '',
    }));
    return this.departmentsService.importDepartments(departments);
  }

  @Get('export/template')
  @Roles(Role.ADMIN, Role.SECRETARY)
  @ApiOperation({ summary: 'Download department import template' })
  async downloadTemplate() {
    const template = [
      { code: 'KHTN', name: 'Khoa Học Tự Nhiên' },
      { code: 'KHXH', name: 'Khoa Học Xã Hội' },
    ];
    return this.excelService.generateExcel(template, 'departments_template');
  }
}
