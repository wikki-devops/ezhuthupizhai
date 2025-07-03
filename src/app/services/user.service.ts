// src/app/services/user.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { environment } from '../environments/environment';

export interface Address {
  id?: number;
  user_id?: number;
  first_name: string;
  last_name?: string | null;
  phone: string;
  email: string;
  address1: string;
  address2?: string | null;
  city: string;
  state: string;
  zip_code: string;
  country: string;
  type?: string;
  is_default_billing?: number;
  is_default_shipping?: number;
  is_active?: number;
  created_at?: string;
  updated_at?: string;
}

export interface User {
  id: number;
  first_name: string;
  last_name?: string | null;
  email: string;
  phone: string;
  address1?: string | null;
  address2?: string | null;
  city?: string;
  state?: string;
  zip_code?: string;
  country?: string;
  token?: string;
}

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  currentUser$: Observable<User | null> = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient) {
    this.loadUserFromLocalStorage();
  }

  setUser(user: User): void {
    this.currentUserSubject.next(user);
    localStorage.setItem('currentUser', JSON.stringify(user));
  }

  clearUser(): void {
    this.currentUserSubject.next(null);
    localStorage.removeItem('currentUser');
  }

  private loadUserFromLocalStorage(): void {
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
      try {
        const user: User = JSON.parse(storedUser);
        this.currentUserSubject.next(user);
      } catch (e) {
        localStorage.removeItem('currentUser');
      }
    }
  }

  sendOtp(email: string): Observable<any> {
    return this.http.post(`${environment.apiUrl}auth/send_otp`, { email });
  }

  verifyOtp(email: string, otp: string): Observable<any> {
    return this.http.post(`${environment.apiUrl}auth/verify_otp_and_get_addresses`, { email, otp });
  }

  getCustomerDetails(userId: string): Observable<any> {
    return this.http.get(`${environment.apiUrl}customer/details/${userId}`);
  }

  getUserAddresses(userId: number): Observable<{ success: boolean, addresses: Address[], message?: string }> {
    return this.http.post<{ success: boolean, addresses: Address[], message?: string }>(`${environment.apiUrl}auth/get_addresses_by_user_id`, { user_id: userId });
  }
}