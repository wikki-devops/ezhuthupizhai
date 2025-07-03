// src/app/models/byob.model.ts

export interface ByobBook {
  id: string; // Assuming 'id' comes as string from DB, adjust if number
  name: string;
  short_description: string;
  mrp_price: number;
  special_price: number;
  slug: string;
  thumbnail_image?: string; // Add this line for the image URL
  selected?: boolean; // Optional property for UI selection state
}

export interface ByobItem {
  id: string; // Assuming 'id' comes as string from DB, adjust if number
  name: string;
  description: string;
  price: number;
  image_url?: string; // If BYOB items also have images
  selected?: boolean; // Optional property for UI selection state
}

export interface ByobRequest {
  book_ids: string[];
  item_ids: string[];
}

export interface ByobBox {
  id: string;
  created_at: string;
  books: ByobBook[];
  items: ByobItem[];
}

// Backend response structure for fetching multiple books/items
export interface ByobListResponse {
  status: number;
  message: string;
  data: any[]; // Use 'any[]' or define more specific types if needed,
              // but it will be ByobBook[] or ByobItem[] based on endpoint
}

// Backend response structure for creating a box
export interface ByobCreateResponse {
  status: number;
  message: string;
  data: ByobBox; // The created box details
}