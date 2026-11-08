export const ROW_LIMIT_OPTIONS = [100, 500, 1000] as const;
export type RowLimit = (typeof ROW_LIMIT_OPTIONS)[number];