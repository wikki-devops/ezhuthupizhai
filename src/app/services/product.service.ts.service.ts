import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Product } from '../models/product.model'; // Import your Product interface
import { map } from 'rxjs/operators'; // Import map operator


@Injectable({
  providedIn: 'root'
})
export class ProductServiceTsService {

  private apiUrl = 'http://localhost/ezhuthupizhai/backend/api/';

  constructor(private http: HttpClient) { }

  getProducts(): Observable<Product[]> {
    return this.http.get<any>(`${this.apiUrl}products`).pipe(
      map(response => {
        if (response.status === 'success' && response.data) {
          return response.data.map((product: any) => ({
            ...product,
            // CI3 is already formatting prices, just ensure types if needed
            mrp_price: product.mrp_price,
            special_price: product.special_price,
          })) as Product[];
        } else {
          console.error('API Error: Products not found or status not success', response);
          return [];
        }
      })
    );
  }

  // New method for fetching product details for quick view
  getProductDetail(productId: number): Observable<Product | null> {
    return this.http.get<any>(`${this.apiUrl}product_detail/${productId}`).pipe(
      map(response => {
        if (response.status === 'success' && response.data) {
          return response.data as Product;
        } else {
          console.error('API Error: Product detail not found or status not success', response);
          return null;
        }
      })
    );
  }

  getCategories(): Observable<string[]> {
    return this.http.get<any>(`${this.apiUrl}categories`).pipe(
      map(response => {
        if (response.status === 'success' && response.data) {
          return response.data;
        } else {
          console.error('API Error: Categories not found or status not success', response);
          return [];
        }
      })
    );
  }

  getProductBySlug(slug: string): Observable<Product | null> {
    return this.http.get<Product>(`${this.apiUrl}/slug/${slug}`);
  }
}
