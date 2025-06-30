// src/app/shared/models/order.model.ts

/**
 * Interface for the shipping details section of the checkout form.
 * This maps directly to `checkoutForm` in `CheckoutComponent` and
 * the `shipping_details` object within the backend's `place_order` payload.
 */
export interface ShippingDetails {
  firstName: string;
  lastName?: string; // Optional
  email: string;
  phone: string;
  address1: string;
  address2?: string; // Optional
  city: string;
  state: string;
  zipCode: string; // IMPORTANT: Matches 'zip_code' in backend (camelCase here, snake_case in backend database)
  country: string;
  orderNotes?: string; // Optional
  createAccount?: boolean; // Indicates if a new user account should be created during checkout
  // shipToDifferentAddress?: boolean; // Removed, as it wasn't integrated into the backend logic provided. Re-add if needed.
}

/**
 * Interface for the order summary details.
 * This maps to the `order_summary` object within the backend's `place_order` payload.
 */
export interface OrderSummary {
  subtotal: number;
  coupon_discount: number;
  subtotal_after_discount: number;
  delivery_charge: number;
  final_total: number;
}

/**
 * Interface for a single cart item as it's specifically sent to the backend
 * for order creation (e.g., for `order_items` table).
 * This is a subset/transformation of your frontend's `CartItem` model to match backend expectations.
 */
export interface CheckoutCartItem {
  product_id: number;
  quantity: number;
  price_at_order: number; // The exact price of the product at the moment the order is placed
  product_name: string;   // The name of the product at the time of order
}

/**
 * The complete payload structure sent to the backend's `checkout/place_order` endpoint.
 * This interface defines the entire JSON body for placing an order.
 */
export interface PlaceOrderPayload {
  shipping_details: ShippingDetails;
  order_summary: OrderSummary;
  cart_items: CheckoutCartItem[];
  agreed_to_terms: boolean;
  payment_method: 'COD' | 'Razorpay'; // Allowed payment methods
  is_address_from_saved: boolean;     // Crucial flag for the backend to determine if it's a new address to save
}

/**
 * Expected response structure from the backend's `checkout/place_order` endpoint.
 */
export interface OrderResponse {
  success: boolean;
  message: string;
  order_id?: number; // The ID of the newly created order, typically returned on success
}


// --- Interfaces for fetching a full Order (e.g., for order confirmation or history) ---
// These are added to satisfy typical requirements for an Order Confirmation Component.
// You will need to ensure your backend's `get_order_details` endpoint returns data matching this structure.

/**
 * Interface for a full Order object, as might be fetched for an order confirmation or history page.
 * This should match the combined order and shipping details from your `orders` table.
 */
export interface Order {
  id: number;
  user_id?: number; // Nullable if guests can order
  first_name: string;
  last_name?: string;
  email: string;
  phone: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
  order_notes?: string;
  payment_method: string;
  subtotal: number;
  coupon_discount: number;
  subtotal_after_discount: number;
  delivery_charge: number;
  final_total: number;
  status: string; // e.g., 'pending', 'completed', 'cancelled'
  created_at: string;
  updated_at: string;
  order_items: OrderItem[]; // Array of associated order items
  // Add other order-level details if your backend returns them (e.g., transaction_id for Razorpay)
}

/**
 * Interface for a single item within a full Order object (e.g., from `order_items` table).
 */
export interface OrderItem {
  id: number;
  order_id: number;
  product_id?: number; // Can be null if product was deleted
  product_name: string;
  quantity: number;
  price_at_order: number; // The price it was sold for in this specific order
  total: number;          // quantity * price_at_order
  created_at: string;
  updated_at: string;
  // Add other item-specific details if needed (e.g., product_sku, product_image)
}
