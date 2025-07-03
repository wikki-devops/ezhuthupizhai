export interface Review {
  id?: number;
  product_id: number;
  customer_name: string; // Matches 'customer_name' in your DB table
  rating: number;      // Matches 'rating' in your DB table
  comment: string;     // Matches 'comment' in your DB table
  created_at?: string; // Matches 'created_at' in your DB table
}
