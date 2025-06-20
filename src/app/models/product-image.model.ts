export interface ProductImage {
  id: number;
  product_id: number;
  image_url: string;
  is_thumbnail: boolean; // tinyint(1) comes as boolean
  order_priority: number;
}
