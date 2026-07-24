export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export type PageParams = {
  page?: number;
  limit?: number;
  q?: string;
};
