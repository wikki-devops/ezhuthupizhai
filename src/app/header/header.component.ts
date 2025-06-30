// src/app/header/header.component.ts

import { Component, OnInit, OnDestroy } from '@angular/core';
import { CartService } from '../services/cart.service.ts.service'; // Correct path assumed
import { CartItem } from 'src/app/models/cart-item.model';
import { AppliedCoupon } from 'src/app/models/applied-coupon.model'; // IMPORT AppliedCoupon model
import { Observable, Subscription } from 'rxjs'; // Import Observable

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html', // This template contains the offcanvas cart
  styleUrls: ['./header.component.css']
})
export class HeaderComponent implements OnInit, OnDestroy {
  cartItemCount: number = 0;
  cartItems: CartItem[] = []; // This array will populate the offcanvas cart list
  cartTotal: number = 0; // This will show the total price in the offcanvas
  freeShippingThreshold: number = 500; // Define your free shipping threshold here

  // Add this property to hold the currently applied coupon Observable
  currentlyAppliedCoupon$: Observable<AppliedCoupon | null>;

  private cartSubscription: Subscription | undefined;
  private totalSubscription: Subscription | undefined;
  // No need for a separate subscription for currentlyAppliedCoupon$ since we're using async pipe

  constructor(private cartService: CartService) {
    // Initialize the observable for the currently applied coupon
    this.currentlyAppliedCoupon$ = this.cartService.getCurrentlyAppliedCoupon();
  }

  ngOnInit(): void {
    // Combined subscription for cart items and count
    this.cartSubscription = this.cartService.cartItems$.subscribe(items => {
      this.cartItems = items; // Update the list of items for the offcanvas display
      this.cartItemCount = items.reduce((totalCount, item) => totalCount + item.quantity, 0); // Update the header badge count
    });

    // Subscription for the cart total
    this.totalSubscription = this.cartService.cartTotal$.subscribe(total => {
      this.cartTotal = total;
    });
  }

  // --- Cart Interaction Methods ---

  removeFromCart(productId: number): void {
    this.cartService.removeFromCart(productId);
  }

  // Handles direct input changes (if input is not readonly)
  updateQuantity(productId: number, event: Event): void {
    const inputElement = event.target as HTMLInputElement;
    const newQuantity = Number(inputElement.value);
    if (!isNaN(newQuantity) && newQuantity >= 0) {
      this.cartService.updateQuantity(productId, newQuantity);
    }
  }

  // Method for incrementing quantity via plus button
  incrementQuantity(productId: number, currentQuantity: number): void {
    this.cartService.updateQuantity(productId, currentQuantity + 1);
  }

  // Method for decrementing quantity via minus button
  decrementQuantity(productId: number, currentQuantity: number): void {
    console.log('Decrement button clicked for Product ID:', productId, 'Current Quantity:', currentQuantity);

    if (currentQuantity > 1) {
      console.log('Decreasing quantity to:', currentQuantity - 1);
      this.cartService.updateQuantity(productId, currentQuantity - 1);
    } else {
      console.log('Removing item for Product ID:', productId, 'as quantity is 1.');
      this.cartService.removeFromCart(productId);
    }
  }

  getShippingProgress(): number {
    if (this.freeShippingThreshold === 0) return 100; // Avoid division by zero
    return Math.min((this.cartTotal / this.freeShippingThreshold) * 100, 100);
  }

  // NEW METHOD: Handle removal of coupon from the offcanvas
  onRemoveCoupon(couponCode: string): void {
    this.cartService.removeCoupon(couponCode);
  }

  // --- End Cart Interaction Methods ---

  ngOnDestroy(): void {
    if (this.cartSubscription) {
      this.cartSubscription.unsubscribe();
    }
    if (this.totalSubscription) {
      this.totalSubscription.unsubscribe();
    }
  }
}