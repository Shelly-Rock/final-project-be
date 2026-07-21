import { BadRequestException, Injectable } from '@nestjs/common';
import {EXCEL} from "./excel.constant";

import {
  Worksheet,
  Cell,
  CellFormulaValue,
  CellRichTextValue,
  Workbook,
  CellValue,
} from 'exceljs';
@Injectable()
export class ExcelService {
  // Hàm đọc workbook
  async readWorkbook(buffer: Buffer): Promise<Workbook> {
    const wb = new Workbook();
    await wb.xlsx.load(buffer as any);
    return wb;
  }

  //  Hàm đoc sheet
   getWorksheet(wb: Workbook) : Worksheet{
    const wsh = wb.getWorksheet(EXCEL.DEFAULT_SHEET_INDEX);
    if(!wsh){
      throw new BadRequestException("File rỗng");
    }
    return wsh;
   }

   // Hàm lấy tên header
   getHeaders(worksheet: Worksheet): string[] {
    const headerRow = worksheet.getRow(EXCEL.HEADER_ROW);
  
    const headers: string[] = [];
  
    headerRow.eachCell((cell) => {
      headers.push(String(this.getCellValue(cell)).trim());
    });
  
    return headers;
  }

  //Hàm validate dữ liệu
  validateHeaders(
    actualHeaders: string[],
    expectedHeaders: string[],
    allowMissingHeaders = false,
  ): void {
    const headers = actualHeaders.map((h) => h.trim());

    if (!headers.length) {
      throw new BadRequestException('File Excel rỗng!');
    }

    const duplicateHeaders = headers.filter(
      (header, index) => headers.indexOf(header) !== index,
    );

    if (duplicateHeaders.length) {
      throw new BadRequestException(
        `Header trùng: ${[...new Set(duplicateHeaders)].join(', ')}`,
      );
    }

    if (!allowMissingHeaders) {
      const headerSet = new Set(headers);

      const missingHeaders = expectedHeaders.filter(
        (header) => !headerSet.has(header),
      );

      if (missingHeaders.length) {
        throw new BadRequestException(
          `Thiếu header: ${missingHeaders.join(', ')}`,
        );
      }
    }
  }

  //Hàm chuẩn hóa ô excel thành kiểu dữ liệu
  getCellValue(cell: Cell): unknown {
    const value = cell.value;

    if (value === null || value === undefined) {
      return null;
    }
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      return value;
    }
    if (value instanceof Date) {
      return value.toISOString();
    }
    if ('result' in value) {
      return (value as CellFormulaValue).result;
    }
    if ('richText' in value) {
      return (value as CellRichTextValue).richText
        .map((item) => item.text)
        .join('');
    }
    if ('text' in value) {
      return value.text;
    }
    return String(value);
  }

  //Hàm chuyển dữ liệu excel thành obj
  parseRows<T>(worksheet: Worksheet, headers: string[]): T[] {
    const rows: T[] = [];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === EXCEL.FIRST_DATA_ROW) {
        return;
      }

      const values = row.values as CellValue[];
      const isEmpty = values.every((v) => v == null);
      if (isEmpty) {
        return;
      }

      const data = {} as Record<string, unknown>;
      headers.forEach((header, index) => {
        data[header] = this.getCellValue(row.getCell(index + 1));
      });
      rows.push(data as T);
    });

    return rows;
  }
}
