import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { Product } from '../models/product.model';
import { map, catchError } from 'rxjs/operators';
import { Review } from '../models/review.model';
import { environment } from '../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ProductServiceTsService {

  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  getProducts(): Observable<Product[]> {
    return this.http.get<any>(`${this.apiUrl}api/products`).pipe(
      map(response => {
        if (response.status === 'success' && response.data) {
          return response.data.map((product: any) => ({
            ...product,
            mrp_price: product.mrp_price,
            special_price: product.special_price,
          })) as Product[];
        } else {
          return [];
        }
      })
    );
  }

  getProductDetail(productId: number): Observable<Product | null> {
    return this.http.get<any>(`${this.apiUrl}api/product_detail/${productId}`).pipe(
      map(response => {
        if (response.status === 'success' && response.data) {
          return response.data as Product;
        } else {
          return null;
        }
      })
    );
  }

  getCategories(): Observable<string[]> {
    return this.http.get<any>(`${this.apiUrl}api/categories`).pipe(
      map(response => {
        if (response.status === 'success' && response.data) {
          return response.data;
        } else {
          return [];
        }
      })
    );
  }

  getProductBySlug(slug: string): Observable<Product | null> {
    return this.http.get<Product>(`${this.apiUrl}api/slug/${slug}`);
  }

  submitProductReview(reviewData: { product_id: number; customer_name: string; rating: number; comment: string }): Observable<Review | null> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    });

    return this.http.post<any>(`${this.apiUrl}review/create`, reviewData, { headers: headers, observe: 'response' }).pipe(
      map(httpResponse => {
        const responseBody = httpResponse.body;

        if (httpResponse.status === 201) {
          if (responseBody && responseBody.data) {
            return responseBody.data as Review;
          } else {
            return null;
          }
        } else {
          return null;
        }
      }),
      catchError((error: HttpErrorResponse) => {
        return of(null);
      })
    );
  }
}