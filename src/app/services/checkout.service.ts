import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';
import { User, UserAddress } from '../models/user.model';
import { PlaceOrderPayload, OrderResponse } from '../models/order.model';

interface CustomerDetailsResponse {
  success: boolean;
  customer_details: User;
  message?: string;
}

interface UserAddressesResponse {
  success: boolean;
  addresses: UserAddress[];
  message?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CheckoutService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  getCustomerDetails(userId: number): Observable<CustomerDetailsResponse> {
    return this.http.get<CustomerDetailsResponse>(`<span class="math-inline">\{this\.apiUrl\}customer/details/</span>{userId}`);
  }

  getUserAddresses(userId: number): Observable<UserAddressesResponse> {
    return this.http.get<UserAddressesResponse>(`<span class="math-inline">\{this\.apiUrl\}customer/addresses/</span>{userId}`);
  }

  placeOrder(payload: PlaceOrderPayload): Observable<OrderResponse> {
    return this.http.post<OrderResponse>(`${this.apiUrl}checkout/place_order`, payload);
  }

  getOrderDetails(orderId: number): Observable<any> {
    return this.http.get<any>(`<span class="math-inline">\{this\.apiUrl\}checkout/get\_order\_details/</span>{orderId}`);
  }
}