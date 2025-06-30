import { Product } from './product.model'; // Make sure this path is correct

export interface CartItem {
  product: Product;
  quantity: number;
}