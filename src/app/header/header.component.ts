// src/app/header/header.component.ts

import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, Subscription } from 'rxjs';

import { CartService } from '../services/cart.service.ts.service';
import { UserService, User } from '../services/user.service';

import { CartItem } from 'src/app/models/cart-item.model';
import { AppliedCoupon } from 'src/app/models/applied-coupon.model';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css']
})
export class HeaderComponent implements OnInit, OnDestroy {
  cartItemCount: number = 0;
  cartItems: CartItem[] = [];
  cartTotal: number = 0;
  freeShippingThreshold: number = 500;

  currentlyAppliedCoupon$: Observable<AppliedCoupon | null>;

  isLoggedIn: boolean = false;
  private userSubscription: Subscription = new Subscription();

  private cartSubscription: Subscription | undefined;
  private totalSubscription: Subscription | undefined;

  constructor(
    private cartService: CartService,
    private userService: UserService,
    private router: Router
  ) {
    this.currentlyAppliedCoupon$ = this.cartService.getCurrentlyAppliedCoupon();
  }

  ngOnInit(): void {
    this.cartSubscription = this.cartService.cartItems$.subscribe(items => {
      this.cartItems = items;
      this.cartItemCount = items.reduce((totalCount, item) => totalCount + item.quantity, 0);
    });

    this.totalSubscription = this.cartService.cartTotal$.subscribe(total => {
      this.cartTotal = total;
    });

    this.userSubscription.add(
      this.userService.currentUser$.subscribe(user => {
        this.isLoggedIn = user !== null;
      })
    );
  }

  removeFromCart(productId: number): void {
    this.cartService.removeFromCart(productId);
  }

  updateQuantity(productId: number, event: Event): void {
    const inputElement = event.target as HTMLInputElement;
    const newQuantity = Number(inputElement.value);
    if (!isNaN(newQuantity) && newQuantity >= 0) {
      this.cartService.updateQuantity(productId, newQuantity);
    }
  }

  incrementQuantity(productId: number, currentQuantity: number): void {
    this.cartService.updateQuantity(productId, currentQuantity + 1);
  }

  decrementQuantity(productId: number, currentQuantity: number): void {
    if (currentQuantity > 1) {
      this.cartService.updateQuantity(productId, currentQuantity - 1);
    } else {
      this.cartService.removeFromCart(productId);
    }
  }

  getShippingProgress(): number {
    if (this.freeShippingThreshold === 0) return 100;
    return Math.min((this.cartTotal / this.freeShippingThreshold) * 100, 100);
  }

  onRemoveCoupon(couponCode: string): void {
    this.cartService.removeCoupon(couponCode);
  }

  onLogout(): void {
    this.userService.clearUser();
    this.router.navigate(['/']);
  }

  onLoginRegister(): void {
    this.router.navigate(['/login']);
  }

  ngOnDestroy(): void {
    if (this.cartSubscription) {
      this.cartSubscription.unsubscribe();
    }
    if (this.totalSubscription) {
      this.totalSubscription.unsubscribe();
    }
    if (this.userSubscription) {
      this.userSubscription.unsubscribe();
    }
  }
}