import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, of, combineLatest, Subscription } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { delay, map, catchError, tap, take, filter, switchMap } from 'rxjs/operators';
import { Product } from '../models/product.model';
import { CartItem } from '../models/cart-item.model';
import { AppliedCoupon } from '../models/applied-coupon.model';
import { environment } from '../environments/environment';

declare const bootstrap: any;

@Injectable({
  providedIn: 'root'
})
export class CartService implements OnDestroy {
  private apiUrl = environment.apiUrl + 'api/get_all_coupons';
  private checkoutApiUrl = environment.apiUrl + 'checkout/';

  private cartItemsSubject = new BehaviorSubject<CartItem[]>([]);
  cartItems$: Observable<CartItem[]> = this.cartItemsSubject.asObservable();

  private appliedCouponsSubject = new BehaviorSubject<AppliedCoupon[]>([]);
  appliedCoupons$: Observable<AppliedCoupon[]> = this.appliedCouponsSubject.asObservable();

  private _allCouponsFromDatabase: AppliedCoupon[] = [];
  private couponsLoaded = new BehaviorSubject<boolean>(false);

  private _currentCustomerId: BehaviorSubject<number | null> = new BehaviorSubject<number | null>(101);
  currentCustomerId$: Observable<number | null> = this._currentCustomerId.asObservable();

  private _manualOverrideCouponCode = new BehaviorSubject<string | null>(null);
  manualOverrideCouponCode$: Observable<string | null> = this._manualOverrideCouponCode.asObservable();

  private _suppressAutoApply = new BehaviorSubject<boolean>(false);
  suppressAutoApply$: Observable<boolean> = this._suppressAutoApply.asObservable();

  public updateCurrentCustomerId(id: number | null): void {
    if (this._currentCustomerId.value !== id) {
      this._currentCustomerId.next(id);
    }
  }

  public readonly itemsTotal$: Observable<number> = this.cartItemsSubject.asObservable().pipe(
    map(items => {
      let total = 0;
      total = items.reduce((sum, item) => {
        const price = parseFloat(item.product.special_price as any) || 0;
        return sum + (price * item.quantity);
      }, 0);
      return total;
    })
  );

  public readonly cartTotal$: Observable<number> = this.itemsTotal$;

  public readonly totalCouponDiscount$: Observable<number> = combineLatest([
    this.itemsTotal$,
    this.appliedCouponsSubject.asObservable(),
    this.couponsLoaded.asObservable(),
    this._currentCustomerId.asObservable()
  ]).pipe(
    map(([itemsTotal, appliedCoupons, loaded, currentCustomerId]) => {
      if (!loaded || appliedCoupons.length === 0) {
        return 0;
      }

      const applied = appliedCoupons[0];
      const couponDefinition = this._allCouponsFromDatabase.find(c => c.coupon_code === applied.coupon_code);

      if (!couponDefinition) {
        return 0;
      }

      const isExpired = couponDefinition.expiry_date && new Date() > new Date(couponDefinition.expiry_date);
      if (isExpired) {
        return 0;
      }

      const meetsMinOrder = itemsTotal >= (couponDefinition.min_order_value || 0);
      if (!meetsMinOrder) {
        return 0;
      }

      let isCustomerAllowed = true;
      if (couponDefinition.visibility === 'specific_customer') {
        const allowedIds: number[] = typeof couponDefinition.allowed_customer_ids === 'string'
          ? couponDefinition.allowed_customer_ids.split(',').map((id: string) => parseInt(id.trim(), 10)).filter((id: number) => !isNaN(id))
          : Array.isArray(couponDefinition.allowed_customer_ids) ? couponDefinition.allowed_customer_ids : [];

        if (currentCustomerId === null || !allowedIds.includes(currentCustomerId as number)) { // Type assertion here
          isCustomerAllowed = false;
        }
      }
      if (!isCustomerAllowed) {
        return 0;
      }

      let discount = 0;
      if (couponDefinition.discount_type === 'fixed') {
        discount = couponDefinition.discount_value;
      } else if (couponDefinition.discount_type === 'percentage') {
        discount = itemsTotal * (couponDefinition.discount_value / 100);
      }
      return Math.min(discount, itemsTotal);
    }),
    catchError(err => {
      this.appliedCouponsSubject.next([]);
      this._manualOverrideCouponCode.next(null);
      this._suppressAutoApply.next(false);
      this.saveCouponsToLocalStorage();
      return of(0);
    }),
    tap(calculatedDiscount => {
      const currentAppliedCoupon = this.appliedCouponsSubject.value.length > 0 ? this.appliedCouponsSubject.value[0] : null;

      if (calculatedDiscount === 0 && currentAppliedCoupon) {
        const couponDef = this._allCouponsFromDatabase.find(c => c.coupon_code === currentAppliedCoupon.coupon_code);

        const itemsTotal = this.getCartTotalBeforeCoupons();
        const currentCustomerId = this._currentCustomerId.value;

        const isInvalidNow = !couponDef ||
          (couponDef.expiry_date && new Date() > new Date(couponDef.expiry_date)) ||
          (itemsTotal < (couponDef.min_order_value || 0)) ||
          (couponDef.visibility === 'specific_customer' &&
            (currentCustomerId === null ||
              !(typeof couponDef.allowed_customer_ids === 'string'
                ? couponDef.allowed_customer_ids.split(',').map((id: string) => parseInt(id.trim(), 10)).filter((id: number) => !isNaN(id))
                : (Array.isArray(couponDef.allowed_customer_ids) ? couponDef.allowed_customer_ids.includes(currentCustomerId as number) : false)))); // Type assertion here

        if (isInvalidNow) {
          this.appliedCouponsSubject.next([]);
          this._manualOverrideCouponCode.next(null);
          this._suppressAutoApply.next(false);
          this.saveCouponsToLocalStorage();
        }
      }
    })
  );

  public readonly subTotalAfterDiscount$: Observable<number> = combineLatest([
    this.itemsTotal$,
    this.totalCouponDiscount$
  ]).pipe(
    map(([itemsTotal, discount]) => Math.max(0, itemsTotal - discount))
  );

  private readonly fixedDeliveryCharge = 50;
  public readonly deliveryCharge$: Observable<number> = this.subTotalAfterDiscount$.pipe(
    map(subTotal => {
      if (subTotal >= 500) {
        return 0;
      }
      return this.fixedDeliveryCharge;
    })
  );

  public readonly finalTotal$: Observable<number> = combineLatest([
    this.subTotalAfterDiscount$,
    this.deliveryCharge$
  ]).pipe(
    map(([subTotal, delivery]) => subTotal + delivery)
  );

  private _autoApplySubscription: Subscription | null = null;
  private _initSubscription: Subscription | null = null;

  constructor(private http: HttpClient) {
    this._initSubscription = this.fetchCouponsFromBackend().pipe(
      tap(() => this.couponsLoaded.next(true)),
      tap(() => this.loadCartFromLocalStorage()),
      tap(() => this.loadCouponsFromLocalStorage()),
      take(1)
    ).subscribe(
      () => {
        this.applyBestAvailableCoupon();
        this.setupAutoApplyListeners();
      },
      error => console.error(error)
    );
  }

  ngOnDestroy(): void {
    if (this._autoApplySubscription) {
      this._autoApplySubscription.unsubscribe();
    }
    if (this._initSubscription) {
      this._initSubscription.unsubscribe();
    }
  }

  private setupAutoApplyListeners(): void {
    if (this._autoApplySubscription) {
      this._autoApplySubscription.unsubscribe();
    }

    this._autoApplySubscription = combineLatest([
      this.cartItems$,
      this._currentCustomerId.asObservable(),
      this._manualOverrideCouponCode.asObservable(),
    ]).pipe(
      filter(() => this.couponsLoaded.value),
      delay(0),
      tap(() => {
        this.applyBestAvailableCoupon();
      })
    ).subscribe();
  }

  private fetchCouponsFromBackend(): Observable<AppliedCoupon[]> {
    return this.http.get<AppliedCoupon[]>(this.apiUrl).pipe(
      map(coupons => {
        return coupons.map(coupon => ({
          ...coupon,
          expiry_date: coupon.expiry_date ? new Date(coupon.expiry_date) : undefined,
          allowed_customer_ids: typeof coupon.allowed_customer_ids === 'string'
            ? coupon.allowed_customer_ids.split(',').map((id: string) => parseInt(id.trim(), 10)).filter((id: number) => !isNaN(id))
            : (Array.isArray(coupon.allowed_customer_ids) ? coupon.allowed_customer_ids : null)
        }));
      }),
      tap(processedCoupons => {
        this._allCouponsFromDatabase = processedCoupons;
      }),
      catchError(error => {
        this._allCouponsFromDatabase = [];
        return of([]);
      })
    );
  }

  public getVisibleCoupons(): Observable<AppliedCoupon[]> {
    return this.couponsLoaded.pipe(
      filter(loaded => loaded),
      switchMap(() => this.currentCustomerId$),
      map((currentCustomerId) => {
        return this._allCouponsFromDatabase.filter(coupon => {
          const isExpired = coupon.expiry_date && new Date() > new Date(coupon.expiry_date);
          if (isExpired) return false;

          if (coupon.visibility === 'public') {
            return true;
          }
          if (coupon.visibility === 'specific_customer') {
            if (currentCustomerId === null) return false;

            const allowedIds: number[] = Array.isArray(coupon.allowed_customer_ids) ? coupon.allowed_customer_ids :
              (typeof coupon.allowed_customer_ids === 'string' ? coupon.allowed_customer_ids.split(',').map((id: string) => parseInt(id.trim(), 10)).filter((id: number) => !isNaN(id)) : []);
            return allowedIds.includes(currentCustomerId as number); // Type assertion here
          }
          return false;
        });
      })
    );
  }

  public isCouponEligible(coupon: AppliedCoupon, currentCartTotal: number): Observable<boolean> {
    return this.currentCustomerId$.pipe(
      map(currentCustomerId => {
        const isExpired = coupon.expiry_date && new Date() > new Date(coupon.expiry_date);
        if (isExpired) return false;

        const meetsMinOrder = currentCartTotal >= (coupon.min_order_value || 0);
        if (!meetsMinOrder) return false;

        if (coupon.visibility === 'specific_customer') {
          if (currentCustomerId === null) return false;
          const allowedIds: number[] = typeof coupon.allowed_customer_ids === 'string'
            ? coupon.allowed_customer_ids.split(',').map((id: string) => parseInt(id.trim(), 10)).filter((id: number) => !isNaN(id))
            : Array.isArray(coupon.allowed_customer_ids) ? coupon.allowed_customer_ids : [];
          if (!allowedIds.includes(currentCustomerId as number)) return false; // Type assertion here
        }
        return true;
      }),
      take(1)
    );
  }

  private saveCartToLocalStorage(): void {
    localStorage.setItem('shopping_cart', JSON.stringify(this.cartItemsSubject.value));
  }

  private loadCartFromLocalStorage(): void {
    const storedCart = localStorage.getItem('shopping_cart');
    if (storedCart) {
      try {
        const cartItems: CartItem[] = JSON.parse(storedCart);
        const validCartItems = cartItems.filter(item => {
          const isValid = item.product && item.product.id !== undefined && item.quantity !== undefined;
          return isValid;
        });
        this.cartItemsSubject.next(validCartItems);
      } catch (e) {
        localStorage.removeItem('shopping_cart');
        this.cartItemsSubject.next([]);
      }
    }
  }

  private saveCouponsToLocalStorage(): void {
    const dataToStore = {
      applied: this.appliedCouponsSubject.value.map(coupon => ({
        ...coupon,
        expiry_date: coupon.expiry_date instanceof Date ? coupon.expiry_date.toISOString() : undefined,
        allowed_customer_ids: Array.isArray(coupon.allowed_customer_ids) ? coupon.allowed_customer_ids : (coupon.allowed_customer_ids || null)
      })),
      manualOverride: this._manualOverrideCouponCode.value,
      suppressAutoApply: this._suppressAutoApply.value
    };
    localStorage.setItem('applied_coupons_data', JSON.stringify(dataToStore));
  }

  private loadCouponsFromLocalStorage(): void {
    const storedData = localStorage.getItem('applied_coupons_data');
    if (storedData) {
      try {
        const parsedData = JSON.parse(storedData);
        const parsedCoupons: AppliedCoupon[] = parsedData.applied.map((coupon: any) => ({
          ...coupon,
          expiry_date: coupon.expiry_date ? new Date(coupon.expiry_date) : undefined,
          allowed_customer_ids: typeof coupon.allowed_customer_ids === 'string'
            ? coupon.allowed_customer_ids.split(',').map((id: number) => parseInt(id as any, 10)).filter((id: number) => !isNaN(id))
            : (Array.isArray(coupon.allowed_customer_ids) ? coupon.allowed_customer_ids : null)
        }));

        this._manualOverrideCouponCode.next(parsedData.manualOverride || null);

        if (parsedData.manualOverride) {
          this._suppressAutoApply.next(false);
        } else {
          this._suppressAutoApply.next(false);
        }

        if (parsedCoupons.length > 0) {
          const storedCouponCode = parsedCoupons[0].coupon_code;
          const couponDefinition = this._allCouponsFromDatabase.find(c => c.coupon_code === storedCouponCode);

          if (couponDefinition) {
            this.appliedCouponsSubject.next([couponDefinition]);
          } else {
            this.appliedCouponsSubject.next([]);
            this.saveCouponsToLocalStorage();
            this._manualOverrideCouponCode.next(null);
            this._suppressAutoApply.next(false);
          }
        } else {
          this.appliedCouponsSubject.next([]);
        }
      } catch (e) {
        this.appliedCouponsSubject.next([]);
        this._manualOverrideCouponCode.next(null);
        this._suppressAutoApply.next(false);
      }
    } else {
      this.appliedCouponsSubject.next([]);
      this._manualOverrideCouponCode.next(null);
      this._suppressAutoApply.next(false);
    }
  }

  addToCart(product: Product, quantity: number = 1): void {
    const currentItems = [...this.cartItemsSubject.value];
    const existingItem = currentItems.find(item => item.product.id === product.id);

    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      currentItems.push({ product, quantity });
    }

    this.cartItemsSubject.next(currentItems);
    this._suppressAutoApply.next(false);
    this.saveCartToLocalStorage();
    this.openOffcanvasCart();
  }

  removeFromCart(productId: number): void {
    let currentItems = this.cartItemsSubject.value.filter(item => item.product.id !== productId);
    this.cartItemsSubject.next([...currentItems]);
    this._suppressAutoApply.next(false);
    this.saveCartToLocalStorage();
  }

  updateQuantity(productId: number, newQuantity: number): void {
    const currentItems = this.cartItemsSubject.value;
    const itemToUpdate = currentItems.find(item => item.product.id === productId);
    if (itemToUpdate) {
      if (newQuantity > 0) {
        itemToUpdate.quantity = newQuantity;
      } else {
        this.removeFromCart(productId);
        return;
      }
    }
    this.cartItemsSubject.next([...currentItems]);
    this._suppressAutoApply.next(false);
    this.saveCartToLocalStorage();
  }

  public getCartTotalBeforeCoupons(): number {
    return this.cartItemsSubject.value.reduce((sum, item) => {
      const price = parseFloat(item.product.special_price as any) || 0;
      return sum + (price * item.quantity);
    }, 0);
  }

  public isCouponActive(couponCode: string): boolean {
    const applied = this.appliedCouponsSubject.value;
    return applied.length > 0 && applied[0].coupon_code.toUpperCase() === couponCode.toUpperCase();
  }

  public applyCouponByCode(couponCode: string): { success: boolean, message: string } {
    const couponToApply = this._allCouponsFromDatabase.find(c => c.coupon_code.toUpperCase() === couponCode.toUpperCase());

    if (!couponToApply) {
      this.appliedCouponsSubject.next([]);
      this._manualOverrideCouponCode.next(null);
      this._suppressAutoApply.next(false);
      this.saveCouponsToLocalStorage();
      return { success: false, message: `Coupon code "${couponCode}" is invalid.` };
    }

    const baseTotal = this.getCartTotalBeforeCoupons();
    const currentCustomerId = this._currentCustomerId.value;

    if (couponToApply.expiry_date && new Date() > new Date(couponToApply.expiry_date)) {
      return { success: false, message: `Coupon "${couponToApply.coupon_code}" has expired.` };
    }
    if (baseTotal < (couponToApply.min_order_value || 0)) {
      return { success: false, message: `Coupon "${couponToApply.coupon_code}" requires a minimum order of ₹${(couponToApply.min_order_value || 0).toFixed(2)}. Your current total is ₹${baseTotal.toFixed(2)}.` };
    }
    if (couponToApply.visibility === 'specific_customer') {
      if (currentCustomerId === null) {
        return { success: false, message: `Coupon "${couponToApply.coupon_code}" requires a logged-in account.` };
      }
      const allowedIds: number[] = Array.isArray(couponToApply.allowed_customer_ids) ? couponToApply.allowed_customer_ids :
        (typeof couponToApply.allowed_customer_ids === 'string' ? couponToApply.allowed_customer_ids.split(',').map((id: string) => parseInt(id.trim(), 10)).filter((id: number) => !isNaN(id)) : []);
      if (!allowedIds.includes(currentCustomerId as number)) { // Type assertion here
        return { success: false, message: `Coupon "${couponToApply.coupon_code}" is not available for your account.` };
      }
    }

    this.appliedCouponsSubject.next([couponToApply]);
    this._manualOverrideCouponCode.next(couponToApply.coupon_code);
    this._suppressAutoApply.next(false);
    this.saveCouponsToLocalStorage();

    return { success: true, message: `Coupon "${couponToApply.coupon_code}" applied successfully!` };
  }

  public removeCoupon(couponCode: string): void {
    const currentApplied = this.appliedCouponsSubject.value;
    const isCurrentlyApplied = currentApplied.length > 0 && currentApplied[0].coupon_code.toUpperCase() === couponCode.toUpperCase();

    if (isCurrentlyApplied) {
      this.appliedCouponsSubject.next([]);
      this._manualOverrideCouponCode.next(null);
      this._suppressAutoApply.next(true);
      this.saveCouponsToLocalStorage();
    }
  }

  public clearCart(): void {
    this.cartItemsSubject.next([]);
    this.appliedCouponsSubject.next([]);
    this._manualOverrideCouponCode.next(null);
    this._suppressAutoApply.next(false);
    this.saveCartToLocalStorage();
    this.saveCouponsToLocalStorage();
  }

  private openOffcanvasCart(): void {
    const offcanvasElement = document.getElementById('offcanvasRight');
    if (offcanvasElement) {
      const bsOffcanvas = new bootstrap.Offcanvas(offcanvasElement);
      bsOffcanvas.show();
    }
  }

  public applyBestAvailableCoupon(): void {
    if (this._suppressAutoApply.value) {
      return;
    }

    this.couponsLoaded.pipe(
      filter(loaded => loaded),
      // Explicitly type the combineLatest output to resolve TS2493 errors
      switchMap(() => combineLatest([this.itemsTotal$, this.allCouponsFromDatabase$, this.currentCustomerId$, this._manualOverrideCouponCode.asObservable()])),
      take(1)
    ).subscribe(([itemsTotal, allCoupons, currentCustomerId, manualOverrideCode]) => {

      const currentAppliedCoupon = this.appliedCouponsSubject.value.length > 0 ? this.appliedCouponsSubject.value[0] : null;

      if (itemsTotal === 0) {
        if (currentAppliedCoupon || manualOverrideCode) {
          this.appliedCouponsSubject.next([]);
          this._manualOverrideCouponCode.next(null);
          this._suppressAutoApply.next(false);
          this.saveCouponsToLocalStorage();
        }
        return;
      }

      if (manualOverrideCode) {
        // Ensure allCoupons is not undefined before calling find
        const manuallyAppliedCoupon = allCoupons?.find((c: AppliedCoupon) => c.coupon_code?.toUpperCase() === manualOverrideCode.toUpperCase());

        if (manuallyAppliedCoupon) {
          const isExpired = manuallyAppliedCoupon.expiry_date && new Date() > new Date(manuallyAppliedCoupon.expiry_date);
          const meetsMinOrder = itemsTotal >= (manuallyAppliedCoupon.min_order_value || 0);
          let isCustomerAllowed = true;
          if (manuallyAppliedCoupon.visibility === 'specific_customer') {
            const allowedIds: number[] = typeof manuallyAppliedCoupon.allowed_customer_ids === 'string'
              ? manuallyAppliedCoupon.allowed_customer_ids.split(',').map((id: string) => parseInt(id.trim(), 10)).filter((id: number) => !isNaN(id))
              : Array.isArray(manuallyAppliedCoupon.allowed_customer_ids) ? manuallyAppliedCoupon.allowed_customer_ids : [];
            if (currentCustomerId === null || !allowedIds.includes(currentCustomerId as number)) { // Type assertion here
              isCustomerAllowed = false;
            }
          }

          if (isExpired || !meetsMinOrder || !isCustomerAllowed) {
            this.appliedCouponsSubject.next([]);
            this._manualOverrideCouponCode.next(null);
            this._suppressAutoApply.next(true);
            this.saveCouponsToLocalStorage();
          } else {
            if (!currentAppliedCoupon || currentAppliedCoupon.coupon_code !== manuallyAppliedCoupon.coupon_code) {
              this.appliedCouponsSubject.next([manuallyAppliedCoupon]);
              this.saveCouponsToLocalStorage();
            }
            return;
          }
        } else {
          this.appliedCouponsSubject.next([]);
          this._manualOverrideCouponCode.next(null);
          this._suppressAutoApply.next(true);
          this.saveCouponsToLocalStorage();
        }
      }

      if (this._suppressAutoApply.value) {
        return;
      }

      let bestAutoCoupon: AppliedCoupon | null = null;
      let maxDiscount = 0;

      // Ensure allCoupons is not undefined before calling filter
      const applicableCoupons = allCoupons?.filter((coupon: AppliedCoupon) => {
        const isExpired = coupon.expiry_date && new Date() > new Date(coupon.expiry_date);
        if (isExpired) return false;

        const meetsMinOrder = itemsTotal >= (coupon.min_order_value || 0);
        if (!meetsMinOrder) return false;

        if (coupon.visibility === 'specific_customer') {
          if (currentCustomerId === null) return false;
          const allowedIds: number[] = Array.isArray(coupon.allowed_customer_ids) ? coupon.allowed_customer_ids :
            (typeof coupon.allowed_customer_ids === 'string' ? coupon.allowed_customer_ids.split(',').map((id: string) => parseInt(id.trim(), 10)).filter((id: number) => !isNaN(id)) : []);
          if (!allowedIds.includes(currentCustomerId as number)) return false; // Type assertion here
        }
        return true;
      }) || []; // Provide a default empty array if allCoupons is undefined

      for (const coupon of applicableCoupons) {
        let currentCouponDiscount = 0;
        if (coupon.discount_type === 'fixed') {
          currentCouponDiscount = coupon.discount_value;
        } else if (coupon.discount_type === 'percentage') {
          currentCouponDiscount = (itemsTotal * coupon.discount_value) / 100;
        }
        currentCouponDiscount = Math.min(currentCouponDiscount, itemsTotal);

        if (currentCouponDiscount > maxDiscount) {
          maxDiscount = currentCouponDiscount;
          bestAutoCoupon = coupon;
        }
      }

      if (bestAutoCoupon) {
        if (!currentAppliedCoupon || currentAppliedCoupon.coupon_code !== bestAutoCoupon.coupon_code) {
          this.appliedCouponsSubject.next([bestAutoCoupon]);
          this.saveCouponsToLocalStorage();
        }
      } else if (currentAppliedCoupon) {
        this.appliedCouponsSubject.next([]);
        this.saveCouponsToLocalStorage();
      }
    });
  }

  getOrderDetails(orderId: string): Observable<any> {
    const url = `${this.checkoutApiUrl}get_order_details/${orderId}`;
    return this.http.get<any>(url).pipe(
      catchError(error => {
        return of({ success: false, message: 'Failed to load order details.', error: error });
      })
    );
  }

  public getCurrentlyAppliedCoupon(): Observable<AppliedCoupon | null> {
    return this.appliedCoupons$.pipe(
      map(coupons => coupons.length > 0 ? coupons[0] : null)
    );
  }

  public get allCouponsFromDatabase$(): Observable<AppliedCoupon[]> {
    return this.couponsLoaded.pipe(
      filter(loaded => loaded),
      map(() => this._allCouponsFromDatabase)
    );
  }
}