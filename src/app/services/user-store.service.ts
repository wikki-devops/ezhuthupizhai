// src/app/shared/services/user-store.service.ts

import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
// Import User and UserAddress interfaces from your user.model.ts
import { User, UserAddress } from '../models/user.model'; // Adjust path if your models are elsewhere

@Injectable({
  providedIn: 'root' // This makes the service a singleton and available throughout the application
})
export class UserStoreService {
  // BehaviorSubject for the logged-in user's ID
  // It holds the current value and emits it to new subscribers.
  private _userId = new BehaviorSubject<number | null>(null);

  // BehaviorSubject for the user's saved addresses
  private _userAddresses = new BehaviorSubject<UserAddress[]>([]);

  // BehaviorSubject for the full user profile details (e.g., name, email, phone)
  private _customerDetails = new BehaviorSubject<User | null>(null);

  constructor() {
    // Attempt to load user data from localStorage when the service is initialized.
    // This helps persist login state and addresses across page refreshes.
    this.loadInitialStateFromLocalStorage();
  }

  // --- Public Observables for components to subscribe to ---

  /**
   * Observable stream of the current user's ID.
   * Components can subscribe to this to react to changes in user ID (login/logout).
   */
  get userId$(): Observable<number | null> {
    return this._userId.asObservable();
  }

  /**
   * Observable stream of the current user's saved addresses.
   * Components can subscribe to this to display or react to address changes.
   */
  get userAddresses$(): Observable<UserAddress[]> {
    return this._userAddresses.asObservable();
  }

  /**
   * Observable stream of the current user's full details.
   * Components can subscribe to this for user profile information.
   */
  get customerDetails$(): Observable<User | null> {
    return this._customerDetails.asObservable();
  }

  // --- Public Methods to Update State and Local Storage ---

  /**
   * Sets the user's data (ID, addresses, and optional customer details) in the store
   * and persists them to localStorage.
   * @param userId The ID of the logged-in user.
   * @param addresses An array of UserAddress objects associated with the user.
   * @param customerDetails Optional: The full User object with profile details.
   */
  setUserData(userId: number, addresses: UserAddress[], customerDetails?: User): void {
    // Update BehaviorSubjects
    this._userId.next(userId);
    this._userAddresses.next(addresses);

    // Persist to localStorage
    localStorage.setItem('userId', userId.toString());
    localStorage.setItem('userAddresses', JSON.stringify(addresses));

    if (customerDetails) {
      this._customerDetails.next(customerDetails);
      localStorage.setItem('customerDetails', JSON.stringify(customerDetails));
    }
  }

  /**
   * Clears all user-related data from the store and localStorage, effectively logging the user out.
   */
  clearUserData(): void {
    // Clear BehaviorSubjects
    this._userId.next(null);
    this._userAddresses.next([]);
    this._customerDetails.next(null);

    // Clear from localStorage
    localStorage.removeItem('userId');
    localStorage.removeItem('userAddresses');
    localStorage.removeItem('customerDetails');
  }

  // --- Synchronous Getters for immediate value access ---
  // Use these when you need the current value *synchronously* (e.g., in guards or direct checks),
  // but prefer subscribing to the Observables for reactive updates.

  /**
   * Gets the current user ID synchronously.
   * @returns The user ID (number) or null.
   */
  get currentUserId(): number | null {
    return this._userId.getValue();
  }

  /**
   * Gets the current array of user addresses synchronously.
   * @returns An array of UserAddress objects.
   */
  get currentUserAddresses(): UserAddress[] {
    return this._userAddresses.getValue();
  }

  /**
   * Gets the current full customer details synchronously.
   * @returns The User object or null.
   */
  get currentCustomerDetails(): User | null {
    return this._customerDetails.getValue();
  }

  // --- Private Helper Method ---

  /**
   * Loads initial user state from localStorage when the service is instantiated.
   */
  private loadInitialStateFromLocalStorage(): void {
    const storedUserId = localStorage.getItem('userId');
    if (storedUserId) {
      this._userId.next(parseInt(storedUserId, 10));
    }

    const storedAddresses = localStorage.getItem('userAddresses');
    if (storedAddresses) {
      try {
        this._userAddresses.next(JSON.parse(storedAddresses));
      } catch (e) {
        console.error('Error parsing stored user addresses from localStorage:', e);
        localStorage.removeItem('userAddresses'); // Clear corrupt data
      }
    }

    const storedCustomerDetails = localStorage.getItem('customerDetails');
    if (storedCustomerDetails) {
      try {
        this._customerDetails.next(JSON.parse(storedCustomerDetails));
      } catch (e) {
        console.error('Error parsing stored customer details from localStorage:', e);
        localStorage.removeItem('customerDetails'); // Clear corrupt data
      }
    }
  }
}
