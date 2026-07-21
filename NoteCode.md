


export class StudentController {
  constructor(
    private readonly studentService: StudentService,
  ) {}

  @Post('import')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Import danh sách sinh viên từ file Excel',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'File Excel chứa danh sách sinh viên',
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Import danh sách sinh viên thành công',
  })
  @UseInterceptors(FileInterceptor('file'))
  async importStudents(
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Vui lòng chọn file Excel.');
    }

    return this.studentService.importStudents(file);
  }
}