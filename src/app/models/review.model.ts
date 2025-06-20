export interface Review {
  id: number;
  product_id: number;
  customer_name: string;
  rating: number; // 1 to 5
  comment: string;
  created_at: string;
}
