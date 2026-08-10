@Get()
getStudentList(@Query() query: PaginationReqDTO) {
return this.getStudentListService.getStudentList(query);
}
