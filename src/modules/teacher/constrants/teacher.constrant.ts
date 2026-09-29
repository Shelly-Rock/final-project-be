export const TEACHER_REQUIRED_HEADERS: string[] = [
  'code',
  'name',
  'email',
  'facultyId',
];

export const TEACHER_OPTIONAL_HEADERS: string[] = [
  'phone',
  'academicTitle',
  'position',
  'dateOfBirth',
  'gender',
  'address',
  'extraData',
];

export const TEACHER_HEADERS: string[] = [
  ...TEACHER_REQUIRED_HEADERS,
  ...TEACHER_OPTIONAL_HEADERS,
];

export const TEACHER_IMPORT_FIELDS = new Set(TEACHER_HEADERS);

export const TEACHER_HEADER_ALIASES: Record<string, string> = {
  magiangvien: 'code',
  'mã giảng viên': 'code',
  magv: 'code',
  'mã gv': 'code',
  teacherid: 'code',
  teacher_id: 'code',
  teachercode: 'code',
  teacher_code: 'code',

  hoten: 'name',
  'họ tên': 'name',
  hovaten: 'name',
  'họ và tên': 'name',
  tengiangvien: 'name',
  'tên giảng viên': 'name',
  fullname: 'name',
  full_name: 'name',

  gmail: 'email',
  mail: 'email',
  email: 'email',

  sodienthoai: 'phone',
  'số điện thoại': 'phone',
  dienthoai: 'phone',
  'điện thoại': 'phone',
  sdt: 'phone',
  sđt: 'phone',
  tel: 'phone',

  khoa: 'facultyId',
  makhoa: 'facultyId',
  'mã khoa': 'facultyId',
  faculty: 'facultyId',
  faculty_id: 'facultyId',
  facultyid: 'facultyId',

  hocham: 'academicTitle',
  'học hàm': 'academicTitle',
  hocvi: 'academicTitle',
  'học vị': 'academicTitle',
  'học hàm/học vị': 'academicTitle',
  academic_title: 'academicTitle',
  academictitle: 'academicTitle',

  chucvu: 'position',
  'chức vụ': 'position',
  title: 'position',

  ngaysinh: 'dateOfBirth',
  'ngày sinh': 'dateOfBirth',
  date_of_birth: 'dateOfBirth',
  dateofbirth: 'dateOfBirth',

  gioitinh: 'gender',
  'giới tính': 'gender',

  diachi: 'address',
  'địa chỉ': 'address',

  extradata: 'extraData',
  extra_data: 'extraData',
  extrajson: 'extraData',
  jsondata: 'extraData',
  json: 'extraData',
};
