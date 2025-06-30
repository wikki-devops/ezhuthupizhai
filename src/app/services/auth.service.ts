import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { tap, catchError, switchMap } from 'rxjs/operators';
import { environment } from '../environments/environment';

// Define the User interface explicitly (adjust properties to match your backend's user object)
export interface User { // Exported for use in other components/services
  user_id: number; // Or 'id' depending on your backend's primary key name for users
  name: string;
  email: string;
  phone: string;
  // Add any other user properties returned by your backend (e.g., address, token)
}

// Add these interfaces for OTP responses if they are not already in models/user.model.ts
export interface UserAddress {
  id?: number;
  user_id: number;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
  is_default: number; // 0 or 1
}

interface SendOtpResponse {
  success: boolean;
  message: string;
}

interface VerifyOtpResponse {
  success: boolean;
  message: string;
  user_id: number;
  addresses: UserAddress[]; // Assuming your backend returns addresses on successful OTP verification
  token?: string; // If your backend issues a token on OTP login
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = environment.apiUrl;

  // BehaviorSubject for user login status (derived from token existence)
  private _isLoggedIn = new BehaviorSubject<boolean>(this.hasToken());
  public isLoggedIn$: Observable<boolean> = this._isLoggedIn.asObservable(); // Publicly accessible Observable

  // BehaviorSubject for the current user's ID
  private currentUserIdSubject: BehaviorSubject<number | null>;
  public currentUserId$: Observable<number | null>; // Publicly accessible Observable

  // BehaviorSubject for the full user object
  private currentUserSubject: BehaviorSubject<User | null>;
  public currentUser$: Observable<User | null>; // Publicly accessible Observable

  constructor(private http: HttpClient) {
    // Initialize user state from local storage on service load
    const storedUserId = localStorage.getItem('user_id');
    this.currentUserIdSubject = new BehaviorSubject<number | null>(storedUserId ? parseInt(storedUserId, 10) : null);
    this.currentUserId$ = this.currentUserIdSubject.asObservable();

    const storedUser = localStorage.getItem('current_user');
    this.currentUserSubject = new BehaviorSubject<User | null>(storedUser ? JSON.parse(storedUser) : null);
    this.currentUser$ = this.currentUserSubject.asObservable();
  }

  private hasToken(): boolean {
    return !!localStorage.getItem('auth_token');
  }

  // --- Public methods to manage authentication state ---

  /**
   * Sets the authentication token in local storage and updates login status.
   * @param token The JWT token received from the backend.
   */
  public setToken(token: string): void {
    localStorage.setItem('auth_token', token);
    this._isLoggedIn.next(true); // User is logged in when a token exists
  }

  /**
   * Retrieves the authentication token from local storage.
   * @returns The token string or null if not found.
   */
  public getToken(): string | null {
    return localStorage.getItem('auth_token');
  }

  /**
   * Sets the current user's ID in the service state and local storage.
   * @param userId The ID of the logged-in user, or null if logged out.
   */
  public setUserId(userId: number | null): void { // Made public
    if (userId) {
      localStorage.setItem('user_id', userId.toString());
    } else {
      localStorage.removeItem('user_id');
    }
    this.currentUserIdSubject.next(userId);
  }

  /**
   * Sets the current full user object in the service state and local storage.
   * @param user The User object, or null if logged out.
   */
  public setUser(user: User | null): void { // Made public
    if (user) {
      localStorage.setItem('current_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('current_user');
    }
    this.currentUserSubject.next(user);
  }

  /**
   * Gets the current user's ID synchronously from the BehaviorSubject's last value.
   * Use currentUserId$ for reactive updates.
   * @returns The user ID (number) or null.
   */
  public getUserId(): number | null { // Made public to directly get ID
    return this.currentUserIdSubject.value;
  }

  /**
   * Registers a new user with the backend.
   * On success, logs the user in and updates local storage.
   * @param name User's name.
   * @param email User's email.
   * @param phone User's phone number.
   * @param password User's chosen password.
   * @returns Observable of the backend response (success/error, user_id, message).
   */
  register(name: string, email: string, phone: string, password: string): Observable<any> {
    return this.http.post(`${this.apiUrl}register`, { name, email, phone, password }).pipe( // Removed '/' before register
      tap((response: any) => {
        if (response.status === 'success' && response.user_id && response.token) { // Assuming token is returned
          this.setUserId(response.user_id);
          this.setToken(response.token);
          // Assuming backend register response might not return full user details,
          // so construct a basic User object. Adjust if your backend sends full details.
          this.setUser({ user_id: response.user_id, name, email, phone });
        }
      }),
      catchError(this.handleError<any>('register'))
    );
  }

  /**
   * Logs an existing user in with the backend.
   * On success, updates local storage with user ID and details.
   * @param email User's email.
   * @param password User's password.
   * @returns Observable of the backend response (success/error, user_id, user_details, message, token).
   */
  login(email: string, password: string): Observable<any> {
    return this.http.post(`${this.apiUrl}login`, { email, password }).pipe( // Removed '/' before login
      tap((response: any) => {
        if (response.status === 'success' && response.user_id && response.user_details && response.token) { // Assuming token is returned
          this.setUserId(response.user_id);
          this.setToken(response.token);
          this.setUser(response.user_details); // Store full user details
        }
      }),
      catchError(this.handleError<any>('login'))
    );
  }

  /**
   * Sends an OTP to the given email or phone number.
   * @param identifier An object containing either 'email' or 'phone'.
   * @returns Observable with success status and message.
   */
  sendOtp(identifier: { email?: string; phone?: string }): Observable<SendOtpResponse> {
    return this.http.post<SendOtpResponse>(`${this.apiUrl}auth/send_otp`, identifier).pipe(
      catchError(this.handleError<SendOtpResponse>('sendOtp'))
    );
  }

  /**
   * Verifies the OTP sent to the user.
   * @param identifier An object containing either 'email' or 'phone'.
   * @param otp The OTP received.
   * @returns Observable with success status, user data, and potentially addresses.
   */
  verifyOtp(identifier: { email?: string; phone?: string }, otp: string): Observable<VerifyOtpResponse> {
    const payload = { ...identifier, otp };
    return this.http.post<VerifyOtpResponse>(`${this.apiUrl}auth/verify_otp_and_get_addresses`, payload).pipe(
      tap(response => {
        if (response.success && response.user_id && response.token) {
          this.setUserId(response.user_id);
          this.setToken(response.token);
          // Assuming you want to set the basic user data here after OTP login
          // You might need to fetch full user details if backend doesn't return them directly
          this.setUser({ user_id: response.user_id, name: '', email: identifier.email || '', phone: identifier.phone || '' });
        }
      }),
      catchError(this.handleError<VerifyOtpResponse>('verifyOtp'))
    );
  }

  /**
   * Logs out the current user by clearing local storage and service state.
   * Now returns an Observable to allow component to subscribe and react.
   */
  logout(): Observable<any> {
    // If you have a backend logout endpoint (e.g., to invalidate sessions/tokens), call it here.
    // For simplicity, this example just clears local storage.
    // Replace with an actual HTTP call if needed:
    // return this.http.post(`${this.apiUrl}auth/logout`, {}).pipe(
    //   tap(() => this.clearAuthState()),
    //   catchError(this.handleError<any>('logout'))
    // );
    
    // For now, returning an Observable that immediately completes after clearing state
    return of(null).pipe(
      tap(() => this.clearAuthState())
    );
  }

  private clearAuthState(): void {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_id');
    localStorage.removeItem('current_user');
    this._isLoggedIn.next(false);
    this.currentUserIdSubject.next(null);
    this.currentUserSubject.next(null);
    console.log('User logged out. State cleared.');
  }

  // --- Error Handling ---
  private handleError<T>(operation = 'operation', result?: T) {
    return (error: HttpErrorResponse): Observable<T> => {
      console.error(`${operation} failed:`, error);
      // It's good practice to throw the error again so components can handle it
      return throwError(() => error);
    };
  }
}