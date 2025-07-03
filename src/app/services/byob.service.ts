import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { environment } from '../environments/environment';

interface LocalByobBox {
  id: string;
  items: { product_id: number; quantity: number }[];
}

@Injectable({
  providedIn: 'root'
})
export class ByobService {
  private productsApiUrl = environment.apiUrl + 'byob';
  private localStorageKey = 'byob_current_box';
  
  constructor(private http: HttpClient) { }

  private generateUniqueId(): string {
    return 'byob-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
  }

  private loadByobBoxFromLocalStorage(): LocalByobBox | null {
    const storedBox = localStorage.getItem(this.localStorageKey);
    if (storedBox) {
      try {
        return JSON.parse(storedBox);
      } catch (e) {
        localStorage.removeItem(this.localStorageKey);
        return null;
      }
    }
    return null;
  }

  private saveByobBoxToLocalStorage(box: LocalByobBox): void {
    localStorage.setItem(this.localStorageKey, JSON.stringify(box));
  }

  getAvailableItems(): Observable<any> {
    return this.http.get(`${this.productsApiUrl}/items`);
  }

  createByobBox(): Observable<any> {
    let currentBox = this.loadByobBoxFromLocalStorage();

    if (!currentBox) {
      const newBox: LocalByobBox = {
        id: this.generateUniqueId(),
        items: []
      };
      this.saveByobBoxToLocalStorage(newBox);
      currentBox = newBox;
    }

    return of({
      status: true,
      message: 'BYOB box created/loaded.',
      data: {
        id: currentBox.id,
        items: currentBox.items,
        box_name: 'Custom Gift Box',
        total_mrp_price: 0,
        total_special_price: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
    });
  }

  getByobBox(boxId: number | string): Observable<any> {
    const currentBox = this.loadByobBoxFromLocalStorage();

    if (currentBox && currentBox.id === String(boxId)) {
      return of({
        status: true,
        message: 'BYOB box loaded.',
        data: {
          id: currentBox.id,
          items: currentBox.items,
          box_name: 'Custom Gift Box',
          total_mrp_price: 0,
          total_special_price: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
      });
    } else {
      return of({
        status: false,
        message: 'BYOB box not found.',
        data: null
      });
    }
  }

  addItemToBox(boxId: number | string, productId: number, quantity: number = 1): Observable<any> {
    const currentBox = this.loadByobBoxFromLocalStorage();

    if (!currentBox || currentBox.id !== String(boxId)) {
      return of({ status: false, message: 'BYOB box not found or ID mismatch.' });
    }

    const existingItemIndex = currentBox.items.findIndex(item => item.product_id === productId);

    if (existingItemIndex > -1) {
      currentBox.items[existingItemIndex].quantity += quantity;
    } else {
      currentBox.items.push({ product_id: productId, quantity });
    }

    this.saveByobBoxToLocalStorage(currentBox);
    return of({ status: true, message: 'Item added to BYOB box.' });
  }

  updateItemQuantity(boxId: number | string, productId: number, quantity: number): Observable<any> {
    const currentBox = this.loadByobBoxFromLocalStorage();

    if (!currentBox || currentBox.id !== String(boxId)) {
      return of({ status: false, message: 'BYOB box not found or ID mismatch.' });
    }

    const existingItemIndex = currentBox.items.findIndex(item => item.product_id === productId);

    if (existingItemIndex > -1) {
      if (quantity > 0) {
        currentBox.items[existingItemIndex].quantity = quantity;
      } else {
        currentBox.items.splice(existingItemIndex, 1);
      }
      this.saveByobBoxToLocalStorage(currentBox);
      return of({ status: true, message: 'Item quantity updated.' });
    } else {
      return of({ status: false, message: 'Item not found in BYOB box.' });
    }
  }

  removeItemFromBox(boxId: number | string, productId: number): Observable<any> {
    const currentBox = this.loadByobBoxFromLocalStorage();

    if (!currentBox || currentBox.id !== String(boxId)) {
      return of({ status: false, message: 'BYOB box not found or ID mismatch.' });
    }

    const initialLength = currentBox.items.length;
    currentBox.items = currentBox.items.filter(item => item.product_id !== productId);

    if (currentBox.items.length < initialLength) {
      this.saveByobBoxToLocalStorage(currentBox);
      return of({ status: true, message: 'Item removed from BYOB box.' });
    } else {
      return of({ status: false, message: 'Item not found in BYOB box.' });
    }
  }
}