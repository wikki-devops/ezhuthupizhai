import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { tap, catchError } from 'rxjs/operators';

interface VerifyOtpResponse {
  success: boolean;
  user_id?: number;
  token?: string;
  message?: string;
}


// Add Address interface
export interface Address {
  id?: number;
  user_id?: number;
  first_name: string; // <-- Note: snake_case
  last_name?: string; // <-- Note: snake_case
  phone: string;
  email: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  zip_code: string; // <-- Note: snake_case
  country: string;
  type?: string;
  is_default_billing?: number;
  is_default_shipping?: number;
}


// Define the User interface (ensure it's updated as per previous steps)
export interface User {
  id: number;
  first_name: string;
  last_name?: string;
  email: string;
  phone: string;
  address1?: string;
  address2?: string;
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
  private apiUrl = 'http://localhost/ezhuthupizhai/backend/';

  private currentUserSubject = new BehaviorSubject<User | null>(null);
  currentUser$: Observable<User | null> = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient) {
    this.loadUserFromLocalStorage();
  }

  // --- EXISTING USER SERVICE METHODS (setUser, clearUser, loadUserFromLocalStorage, sendOtp, verifyOtp, getCustomerDetails) ---
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
        console.error('Error parsing stored user data from localStorage:', e);
        localStorage.removeItem('currentUser');
      }
    }
  }

  sendOtp(identifier: string): Observable<any> {
    console.log('[UserService] Sending OTP for:', identifier);
    return this.http.post(`${this.apiUrl}auth/send_otp`, { identifier }).pipe(
      tap(response => console.log('[UserService] Send OTP Response:', response)),
      catchError(error => {
        console.error('[UserService] Send OTP Error:', error);
        throw error;
      })
    );
  }

  verifyOtp(identifier: string, otp: string): Observable<any> {
    console.log('[UserService] Verifying OTP for:', identifier, 'with OTP:', otp);
    return this.http.post(`${this.apiUrl}auth/verify_otp`, { identifier, otp }).pipe(
      tap(response => console.log('[UserService] Verify OTP Response:', response)),
      catchError(error => {
        console.error('[UserService] Verify OTP Error:', error);
        throw error;
      })
    );
  }

  getCustomerDetails(userId: string): Observable<any> {
    console.log('[UserService] Fetching customer details for User ID:', userId);
    return this.http.get(`${this.apiUrl}customer/details/${userId}`).pipe(
      tap(response => console.log('[UserService] Get Customer Details Response:', response)),
      catchError(error => {
        console.error('[UserService] Get Customer Details Error:', error);
        throw error;
      })
    );
  }

  // --- NEW METHOD TO GET USER ADDRESSES ---
  getUserAddresses(userId: number): Observable<{ success: boolean, addresses: Address[], message?: string }> {
    console.log('[UserService] Fetching user addresses for User ID:', userId);
    return this.http.get<{ success: boolean, addresses: Address[], message?: string }>(`${this.apiUrl}customer/addresses/${userId}`).pipe(
      tap(response => console.log('[UserService] Get User Addresses Response:', response)),
      catchError(error => {
        console.error('[UserService] Get User Addresses Error:', error);
        throw error;
      })
    );
  }
}