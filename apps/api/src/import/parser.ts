import { Decimal } from "decimal.js";
import { readSheet, type CellValue, type Row } from "read-excel-file/node";

type Cell = CellValue | null;

type Field =
  | "spuId"
  | "linkName"
  | "shop"
  | "platform"
  | "operatorName"
  | "launchDate"
  | "netSales"
  | "profitRate"
  | "returnCount7d"
  | "soldCount7d"
  | "warehouseInventory"
  | "inTransitInventory"
  | "soldCount14d";

const aliases: Record<Field, string[]> = {
  spuId: ["链接", "链接id", "商品链接", "spuid", "spu id"],
  linkName: ["链接名称", "商品名称", "spu名称"],
  shop: ["店铺", "店铺名称"],
  platform: ["平台", "销售平台"],
  operatorName: ["运营", "责任运营", "运营负责人"],
  launchDate: ["上架时间", "上架日期"],
  netSales: ["销售收入", "净销售额", "上月净销售额"],
  profitRate: ["经营准利润率", "上一周经营准利润率", "上月经营准利润率"],
  returnCount7d: ["最近7天品退件数", "近7天品退件数", "7天品退件数"],
  soldCount7d: ["最近7天已销售件数", "最近7天销量", "近7天销量", "7天销量"],
  warehouseInventory: ["仓内库存", "仓内库存数量", "现货库存"],
  inTransitInventory: ["在途库存", "在途库存数量"],
  soldCount14d: ["最近14天销量", "近14天销量", "14天销量"],
};

function normalizeHeader(value: Cell): string {
  return typeof value === "string"
    ? value.trim().toLowerCase().replace(/[\s_（）()]+/g, "")
    : "";
}

function findHeader(rows: Row[]): { rowIndex: number; indexes: Partial<Record<Field, number>> } {
  for (let rowIndex = 0; rowIndex < Math.min(rows.length, 10); rowIndex += 1) {
    const row = rows[rowIndex]!;
    const indexes: Partial<Record<Field, number>> = {};
    for (const field of Object.keys(aliases) as Field[]) {
      const normalizedAliases = aliases[field].map(normalizeHeader);
      const matches = row
        .map((cell, index) => normalizedAliases.includes(normalizeHeader(cell)) ? index : -1)
        .filter((index) => index >= 0);
      if (matches.length > 1) {
        throw new Error(`字段 ${field} 的表头无法唯一映射`);
      }
      if (matches[0] !== undefined) indexes[field] = matches[0];
    }
    if (indexes.spuId !== undefined && indexes.linkName !== undefined) {
      return { rowIndex, indexes };
    }
  }
  throw new Error("无法识别包含链接与链接名称的明细表头");
}

function text(cell: Cell | undefined): string | null {
  if (cell === null || cell === undefined) return null;
  const value = String(cell).trim();
  return value.length > 0 ? value : null;
}

function decimal(cell: Cell | undefined, options: { min?: number; max?: number } = {}): string | null {
  if (typeof cell !== "number" && typeof cell !== "string") return null;
  const normalized = typeof cell === "string" ? cell.trim().replace(/,/g, "") : cell;
  if (normalized === "") return null;
  try {
    const value = new Decimal(normalized);
    if (!value.isFinite()) return null;
    if (options.min !== undefined && value.lessThan(options.min)) return null;
    if (options.max !== undefined && value.greaterThan(options.max)) return null;
    return value.toString();
  } catch {
    return null;
  }
}

function rate(cell: Cell | undefined): string | null {
  if (typeof cell === "string" && cell.trim().endsWith("%")) {
    const parsed = decimal(cell.trim().slice(0, -1));
    return parsed === null ? null : new Decimal(parsed).dividedBy(100).toString();
  }
  return decimal(cell, { min: -1, max: 1 });
}

function date(cell: Cell | undefined): string | null {
  if (cell instanceof Date && !Number.isNaN(cell.getTime())) {
    return [cell.getFullYear(), cell.getMonth() + 1, cell.getDate()]
      .map((part, index) => index === 0 ? String(part).padStart(4, "0") : String(part).padStart(2, "0"))
      .join("-");
  }
  if (typeof cell !== "string") return null;
  const match = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(cell.trim());
  if (!match) return null;
  const value = `${match[1]}-${match[2]!.padStart(2, "0")}-${match[3]!.padStart(2, "0")}`;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value ? null : value;
}

export interface ParsedRow {
  worksheetName: string;
  rowNumber: number;
  spuId: string | null;
  linkName: string | null;
  shop: string | null;
  platform: string | null;
  operatorName: string | null;
  launchDate: string | null;
  netSales: string | null;
  profitRate: string | null;
  returnCount7d: string | null;
  soldCount7d: string | null;
  returnPeriodVerified: boolean;
  warehouseInventory: string | null;
  inTransitInventory: string | null;
  soldCount14d: string | null;
  rawValues: Record<string, string | number | boolean | null>;
  aggregate: boolean;
}

function jsonCell(cell: Cell): string | number | boolean | null {
  if (cell instanceof Date) return date(cell);
  if (["string", "number", "boolean"].includes(typeof cell)) return cell as string | number | boolean;
  return null;
}

export async function parseWorkbook(buffer: Buffer): Promise<{ worksheetName: string; rows: ParsedRow[] }> {
  const rows = await readSheet(buffer);
  const header = findHeader(rows);
  const headerRow = rows[header.rowIndex]!;
  const worksheetName = "第一个工作表";
  const parsedRows: ParsedRow[] = [];
  for (let index = header.rowIndex + 1; index < rows.length; index += 1) {
    const row = rows[index]!;
    if (row.every((cell) => cell === null || String(cell).trim() === "")) continue;
    const get = (field: Field): Cell | undefined => {
      const cellIndex = header.indexes[field];
      return cellIndex === undefined ? undefined : row[cellIndex];
    };
    const rawValues = Object.fromEntries(
      headerRow.map((cell, cellIndex) => [text(cell) ?? `列${cellIndex + 1}`, jsonCell(row[cellIndex] ?? null)]),
    );
    const firstCells = row.slice(0, 8).map(text).filter(Boolean);
    const spuId = text(get("spuId"));
    parsedRows.push({
      worksheetName,
      rowNumber: index + 1,
      spuId,
      linkName: text(get("linkName")),
      shop: text(get("shop")),
      platform: text(get("platform")),
      operatorName: text(get("operatorName")),
      launchDate: date(get("launchDate")),
      netSales: decimal(get("netSales"), { min: 0 }),
      profitRate: rate(get("profitRate")),
      returnCount7d: decimal(get("returnCount7d"), { min: 0 }),
      soldCount7d: decimal(get("soldCount7d"), { min: 0 }),
      returnPeriodVerified:
        header.indexes.returnCount7d !== undefined && header.indexes.soldCount7d !== undefined,
      warehouseInventory: decimal(get("warehouseInventory"), { min: 0 }),
      inTransitInventory: decimal(get("inTransitInventory"), { min: 0 }),
      soldCount14d: decimal(get("soldCount14d"), { min: 0 }),
      rawValues,
      aggregate: firstCells.some((value) => value === "合计" || value === "总计") || spuId === "合计" || spuId === "总计",
    });
  }
  return { worksheetName, rows: parsedRows };
}
