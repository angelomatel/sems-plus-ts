import { type JsonRecord, asRecords, isRecord, toInteger } from './json.js';

export const PAGE_SIZE = 100;

/**
 * Collect every row of a `{dataList, total}` paged endpoint.
 *
 * `map` returns null for rows to skip. Stops at `total` or the first empty page.
 */
export async function collectPages<T>(
  fetchPage: (page: number) => Promise<unknown>,
  map: (row: JsonRecord) => T | null,
): Promise<T[]> {
  const items: T[] = [];
  for (let page = 1; ; page++) {
    const data = await fetchPage(page);
    const rows = isRecord(data) ? asRecords(data.dataList) : [];
    for (const row of rows) {
      const item = map(row);
      if (item !== null) items.push(item);
    }
    const total = isRecord(data) ? (toInteger(data.total) ?? 0) : 0;
    if (rows.length === 0 || items.length >= total) return items;
  }
}
