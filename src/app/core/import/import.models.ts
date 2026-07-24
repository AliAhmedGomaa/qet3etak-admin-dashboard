export type ImportRowAction = 'create' | 'update' | 'reuse' | 'skip' | 'error';

export interface ImportEntitySummary {
  create: number;
  update: number;
  reuse: number;
  skip: number;
  error: number;
}

export interface ImportRowPlan {
  entity: 'brand' | 'category' | 'product';
  row: number;
  action: ImportRowAction;
  key: string;
  message?: string;
  existingId?: string;
}

export interface ImportResult {
  dryRun: boolean;
  summary: {
    brands: ImportEntitySummary;
    categories: ImportEntitySummary;
    products: ImportEntitySummary;
  };
  rows: ImportRowPlan[];
  errors: Array<{ entity: string; row: number; message: string }>;
}

export interface ImportTemplateDocs {
  formats: string[];
  maxFileBytes: number;
  upsertKeys: Record<string, string>;
  notes: string[];
  sample: unknown;
}
