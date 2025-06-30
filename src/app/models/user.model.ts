// src/app/shared/models/user.model.ts

/**
 * Interface for a User object.
 * Adjust properties to match the exact structure of user data returned by your backend.
 * For example, if your backend returns 'first_name' and 'last_name' from user profile fetches.
 */
export interface User {
  id: number; // Primary key for the user
  first_name: string; // From backend's user table
  last_name?: string; // Optional, from backend's user table
  email: string;
  phone: string;
  // If your backend register/login returns a token within the user object, you could add it here
  // token?: string;
  // Add any other user-specific properties you might store or retrieve
  // e.g., 'created_at', 'updated_at', 'status'
}

/**
 * Interface for a UserAddress object.
 * This should precisely match the structure of addresses returned by your backend's address endpoints
 * (e.g., from `Auth/verify_otp_and_get_addresses` or `Customer/addresses`).
 */
export interface UserAddress {
  id?: number; // Optional if it's a new address not yet saved, but usually present for fetched addresses
  user_id: number;
  first_name: string;
  last_name?: string; // Can be optional
  phone: string;
  email: string;
  address1: string;
  address2?: string; // Optional for apartment/suite
  city: string;
  state: string;
  zip_code: string; // Ensure this matches 'zip_code' from backend database column
  country: string;
  type?: 'billing' | 'shipping' | 'both'; // Type of address (as per your backend enum)
  is_default?: number; // 0 or 1, indicating if it's the default address (as per your backend tinyint)
  is_active?: number; // 0 or 1, if you have active/inactive addresses
  created_at?: string;
  updated_at?: string;
}
