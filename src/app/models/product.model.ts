import { ProductImage } from './product-image.model';
import { Review } from './review.model';

export interface Product {
  id: number;
  name: string;
  short_description: string;
  description: string; // Added description
  mrp_price: string;
  special_price: string;
  thumbnail_image?: string; // For the main list view
  categories: string[];
  tag: string;
  created_at?: string;
  updated_at?: string;

  // These properties will be loaded only for the detailed view (quick view)
  images?: ProductImage[];
  reviews: Review[];
}
