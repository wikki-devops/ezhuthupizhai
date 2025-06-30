import { Component, OnInit, OnDestroy } from '@angular/core';
import { CartService } from 'src/app/services/cart.service.ts.service';
import { CartItem } from 'src/app/models/cart-item.model';
import { AppliedCoupon } from 'src/app/models/applied-coupon.model';
import { Observable, Subscription, of, combineLatest } from 'rxjs';
import { map, take, switchMap, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { UserService, User } from '../../services/user.service';
import { Router } from '@angular/router'; // IMPORT Router

@Component({
  selector: 'app-cart-page',
  templateUrl: './cart.component.html',
  styleUrls: ['./cart.component.css']
})
export class CartComponent implements OnInit, OnDestroy {
  cartItems$: Observable<CartItem[]>;
  cartTotal$: Observable<number>; // This is now 'Items Total'
  isEpspecialCouponApplied$: Observable<boolean>;
  visibleCouponsWithEligibility$: Observable<({ coupon: AppliedCoupon, isEligible: boolean })[]>;
  currentlyAppliedCoupon$: Observable<AppliedCoupon | null>;

  public totalCouponDiscount$: Observable<number>;
  public deliveryCharge$: Observable<number>;
  public subTotalAfterDiscount$: Observable<number>;
  public finalTotal$: Observable<number>;

  public cartService: CartService;

  public showAlert: boolean = false;
  public alertMessage: string = '';
  public alertType: 'success' | 'danger' | 'info' | 'warning' = 'danger';

  public manualCouponCode: string = '';

  private subscriptions: Subscription = new Subscription();

  public currentUser: User | null = null;

  constructor(
    cartService: CartService,
    // REMOVED: private http: HttpClient,
    // REMOVED: private razorpayService: RazorpayService,
    private userService: UserService,
    private router: Router // INJECT Router
  ) {
    this.cartService = cartService;

    this.cartItems$ = this.cartService.cartItems$;
    this.cartTotal$ = this.cartService.cartTotal$;

    this.totalCouponDiscount$ = this.cartService.totalCouponDiscount$;
    this.deliveryCharge$ = this.cartService.deliveryCharge$;
    this.subTotalAfterDiscount$ = this.cartService.subTotalAfterDiscount$;
    this.finalTotal$ = this.cartService.finalTotal$;

    this.isEpspecialCouponApplied$ = this.cartService.appliedCoupons$.pipe(
      map(coupons => coupons.some(c => c.coupon_code.toUpperCase() === 'EPSPECIAL'))
    );

    this.currentlyAppliedCoupon$ = this.cartService.getCurrentlyAppliedCoupon();

    this.visibleCouponsWithEligibility$ = of([]); // Will be properly assigned in ngOnInit
  }

  ngOnInit(): void {
    this.resetAlert();
    this.subscriptions.add(
      this.userService.currentUser$.subscribe((user: User | null) => {
        this.currentUser = user;
        this.cartService.updateCurrentCustomerId(user ? user.id : null);
        console.log('Current User Data in CartComponent:', this.currentUser);
      })
    );

    this.visibleCouponsWithEligibility$ = combineLatest([
      this.cartService.getVisibleCoupons(),
      this.cartService.cartTotal$.pipe(debounceTime(100), distinctUntilChanged()),
      this.cartService.appliedCoupons$.pipe(distinctUntilChanged((prev, curr) => prev.length === curr.length && prev[0]?.coupon_code === curr[0]?.coupon_code))
    ]).pipe(
      switchMap(([coupons, cartTotal, appliedCoupons]) => {
        if (coupons.length === 0) {
          return of([]);
        }
        const eligibilityChecks = coupons.map(coupon =>
          this.cartService.isCouponEligible(coupon, cartTotal).pipe(
            map(isEligible => ({ coupon, isEligible }))
          )
        );
        return combineLatest(eligibilityChecks);
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  public parseFloat(value: string | number | null | undefined): number {
    return Number.parseFloat(String(value ?? 0));
  }

  onRemoveItem(productId: number): void {
    this.cartService.removeFromCart(productId);
    this.setAlert('Item removed from cart.', 'info');
  }

  onUpdateQuantity(productId: number, event: Event): void {
    const inputElement = event.target as HTMLInputElement;
    const newQuantity = Number(inputElement.value);
    if (!isNaN(newQuantity) && newQuantity >= 0) {
      this.cartService.updateQuantity(productId, newQuantity);
      this.setAlert('Cart quantity updated.', 'info');
    } else {
      this.setAlert('Invalid quantity entered. Quantity must be a number greater than or equal to 0.', 'danger');
    }
  }

  incrementQuantity(productId: number, currentQuantity: number): void {
    this.cartService.updateQuantity(productId, currentQuantity + 1);
    this.setAlert('Quantity increased.', 'info');
  }

  decrementQuantity(productId: number, currentQuantity: number): void {
    if (currentQuantity > 1) {
      this.cartService.updateQuantity(productId, currentQuantity - 1);
      this.setAlert('Item quantity decreased.', 'info');
    } else {
      this.cartService.removeFromCart(productId);
      this.setAlert('Item removed from cart.', 'info');
    }
  }

  // New method to handle clicks on the coupon cards
  async onCouponCardClick(couponCode: string, isEligible: boolean): Promise<void> {
    this.resetAlert();

    const isCurrentlyApplied = this.cartService.isCouponActive(couponCode);

    if (isCurrentlyApplied) {
      // If the clicked coupon is already applied, remove it
      this.cartService.removeCoupon(couponCode);
      this.setAlert(`Coupon "${couponCode}" has been removed.`, 'warning');
    } else if (isEligible) {
      // If eligible and not applied, first copy, then attempt to apply
      try {
        const inputElement = document.getElementById('couponCode_' + couponCode) as HTMLInputElement;
        if (inputElement) {
            await navigator.clipboard.writeText(inputElement.value);
            this.setAlert(`Coupon "${couponCode}" copied to clipboard!`, 'success');
        } else {
            // Fallback for older browsers or if element not found
            this.setAlert(`Coupon code "${couponCode}" copied (manual copy may be required).`, 'info');
        }

        // Now, attempt to apply the coupon
        // Use a short delay if needed, but direct application is usually fine
        const result = this.cartService.applyCouponByCode(couponCode);
        if (result.success) {
            this.setAlert(result.message, 'success');
        } else {
            this.setAlert(result.message, 'danger');
        }

      } catch (err) {
        console.error('Failed to copy text: ', err);
        this.setAlert('Failed to copy coupon code. Please copy manually.', 'danger');
      }
    } else {
      // If not eligible and not applied, do nothing but show alert (though title provides tooltip)
      this.setAlert('This coupon is not eligible for your current cart.', 'info');
    }
  }

  applyManualCoupon(): void {
    this.resetAlert();
    if (!this.manualCouponCode || this.manualCouponCode.trim() === '') {
      this.setAlert('Please enter a coupon code.', 'danger');
      return;
    }

    this.currentlyAppliedCoupon$.pipe(take(1)).subscribe(currentCoupon => {
        const newCouponCode = this.manualCouponCode.trim().toUpperCase();
        const isAlreadyApplied = currentCoupon && currentCoupon.coupon_code && currentCoupon.coupon_code.toUpperCase() === newCouponCode;

        if (isAlreadyApplied) {
            this.setAlert(`Coupon "${currentCoupon.coupon_code}" is already applied.`, 'info');
            return;
        }

        if (currentCoupon) {
            this.setAlert(`"${currentCoupon.coupon_code}" is currently applied. Attempting to apply "${newCouponCode}" instead.`, 'info');
        }

        const result = this.cartService.applyCouponByCode(this.manualCouponCode.trim());
        if (result.success) {
            this.setAlert(result.message, 'success');
            this.manualCouponCode = '';
        } else {
            this.setAlert(result.message, 'danger');
        }
    });
  }

  setAlert(message: string, type: 'success' | 'danger' | 'info' | 'warning'): void {
    this.alertMessage = message;
    this.alertType = type;
    this.showAlert = true;

    setTimeout(() => {
      this.resetAlert();
    }, 5000);
  }

  resetAlert(): void {
    this.showAlert = false;
    this.alertMessage = '';
    this.alertType = 'danger';
  }

}