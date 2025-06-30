import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, of, combineLatest, Subscription } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { delay, map, catchError, tap, take, filter, switchMap } from 'rxjs/operators';
import { Product } from '../models/product.model';
import { CartItem } from '../models/cart-item.model';
import { AppliedCoupon } from '../models/applied-coupon.model';

declare const bootstrap: any;

@Injectable({
  providedIn: 'root'
})
export class CartService implements OnDestroy {
  private apiUrl = 'http://localhost/ezhuthupizhai/backend/api/get_all_coupons';

  private cartItemsSubject = new BehaviorSubject<CartItem[]>([]);
  cartItems$: Observable<CartItem[]> = this.cartItemsSubject.asObservable();

  private appliedCouponsSubject = new BehaviorSubject<AppliedCoupon[]>([]);
  appliedCoupons$: Observable<AppliedCoupon[]> = this.appliedCouponsSubject.asObservable();

  private _allCouponsFromDatabase: AppliedCoupon[] = [];
  private couponsLoaded = new BehaviorSubject<boolean>(false);

  private _currentCustomerId: BehaviorSubject<number | null> = new BehaviorSubject<number | null>(101); // Default for testing
  currentCustomerId$: Observable<number | null> = this._currentCustomerId.asObservable();

  private _manualOverrideCouponCode = new BehaviorSubject<string | null>(null);
  manualOverrideCouponCode$: Observable<string | null> = this._manualOverrideCouponCode.asObservable();

  private _suppressAutoApply = new BehaviorSubject<boolean>(false);
  suppressAutoApply$: Observable<boolean> = this._suppressAutoApply.asObservable();


  public updateCurrentCustomerId(id: number | null): void {
    if (this._currentCustomerId.value !== id) {
      this._currentCustomerId.next(id);
      console.log(`[CartService] Customer ID updated to: ${id}`);
    }
  }

  // MODIFIED: Added console logs to itemsTotal$ calculation
  public readonly itemsTotal$: Observable<number> = this.cartItemsSubject.asObservable().pipe(
    map(items => {
      let total = 0;
      console.log('[CartService] Calculating itemsTotal$. Items provided to pipe:', items); // This log is correctly scoped

      total = items.reduce((sum, item) => { // 'item' is correctly scoped *within* the reduce callback
        const price = parseFloat(item.product.special_price as any) || 0;
        // This log is now correctly placed inside the reduce callback where 'item' and 'price' are defined
        console.log(`[CartService] Item: ${item.product.name} (ID: ${item.product.id}), Quantity: ${item.quantity}, Stored Price: "${item.product.special_price}", Parsed Price: ${price}`);
        return sum + (price * item.quantity);
      }, 0);

      console.log('[CartService] Calculated itemsTotal (before coupons):', total); // This log is correctly scoped
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
      // ... (your existing totalCouponDiscount$ logic) ...
      if (!loaded || appliedCoupons.length === 0) {
        return 0;
      }

      const applied = appliedCoupons[0];
      const couponDefinition = this._allCouponsFromDatabase.find(c => c.coupon_code === applied.coupon_code);

      if (!couponDefinition) {
        console.warn(`[Coupon Validation] Applied coupon '${applied.coupon_code}' not found in database. Setting discount to 0.`);
        return 0;
      }

      const isExpired = couponDefinition.expiry_date && new Date() > new Date(couponDefinition.expiry_date);
      if (isExpired) {
        console.warn(`[Coupon Validation] Applied coupon '${couponDefinition.coupon_code}' has expired. Setting discount to 0.`);
        return 0;
      }

      const meetsMinOrder = itemsTotal >= (couponDefinition.min_order_value || 0);
      if (!meetsMinOrder) {
        console.warn(`[Coupon Validation] Applied coupon '${couponDefinition.coupon_code}' no longer meets minimum order value (required: ${couponDefinition.min_order_value}, current: ${itemsTotal}). Setting discount to 0.`);
        return 0;
      }

      let isCustomerAllowed = true;
      if (couponDefinition.visibility === 'specific_customer') {
        const allowedIds: number[] = typeof couponDefinition.allowed_customer_ids === 'string'
          ? couponDefinition.allowed_customer_ids.split(',').map((id: string) => parseInt(id.trim(), 10)).filter((id: number) => !isNaN(id))
          : Array.isArray(couponDefinition.allowed_customer_ids) ? couponDefinition.allowed_customer_ids : [];

        if (currentCustomerId === null || !allowedIds.includes(currentCustomerId)) {
          isCustomerAllowed = false;
        }
      }
      if (!isCustomerAllowed) {
        console.warn(`[Coupon Validation] Applied coupon '${couponDefinition.coupon_code}' is not available for this customer. Setting discount to 0.`);
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
      console.error("[Coupon Validation] Error calculating totalCouponDiscount$", err);
      this.appliedCouponsSubject.next([]);
      this._manualOverrideCouponCode.next(null);
      this._suppressAutoApply.next(false); // Reset suppression on error
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
                : (Array.isArray(couponDef.allowed_customer_ids) ? couponDef.allowed_customer_ids.includes(currentCustomerId) : false))));

        if (isInvalidNow) {
          console.log(`[Coupon Auto-Removal - from totalCouponDiscount$ tap] Applied coupon '${currentAppliedCoupon.coupon_code}' became invalid. Removing.`);
          this.appliedCouponsSubject.next([]);
          this._manualOverrideCouponCode.next(null);
          this._suppressAutoApply.next(false); // Coupon became invalid, allow auto-apply to potentially find a new best one
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
      tap(() => this.loadCartFromLocalStorage()), // Cart loading after coupons are loaded
      tap(() => this.loadCouponsFromLocalStorage()), // MODIFIED: Logic within to handle _suppressAutoApply on load
      take(1)
    ).subscribe(
      () => {
        console.log('[CartService Init] Coupons and local storage loaded.');
        this.applyBestAvailableCoupon(); // Initial application (respecting suppression if loaded)
        this.setupAutoApplyListeners();
      },
      error => console.error('[CartService Init] Error during initial setup:', error)
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
      delay(0), // Debounce
      tap(() => {
        console.log(`[Auto-Apply Listener] State changed (Cart/Customer/Manual Override). Re-evaluating best coupon.`);
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
        console.log('[CartService] Coupons loaded from DB into Angular service:', this._allCouponsFromDatabase);
      }),
      catchError(error => {
        console.error('[CartService] Error fetching coupons from backend:', error);
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
            return allowedIds.includes(currentCustomerId);
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
          if (!allowedIds.includes(currentCustomerId)) return false;
        }
        return true;
      }),
      take(1)
    );
  }


  private saveCartToLocalStorage(): void {
    localStorage.setItem('shopping_cart', JSON.stringify(this.cartItemsSubject.value));
    console.log('[CartService] Cart saved to local storage:', this.cartItemsSubject.value); // NEW LOG
  }

  // MODIFIED: Added console logs to loadCartFromLocalStorage
  private loadCartFromLocalStorage(): void {
    const storedCart = localStorage.getItem('shopping_cart');
    console.log('[CartService] Raw cart data from localStorage:', storedCart); // This log is correctly scoped

    if (storedCart) {
      try {
        const cartItems: CartItem[] = JSON.parse(storedCart);
        // This log is correctly placed after 'cartItems' is defined
        console.log('[CartService] Parsed cart items before filtering (from localStorage):', cartItems);

        const validCartItems = cartItems.filter(item => { // 'item' is correctly scoped *within* the filter callback
          const isValid = item.product && item.product.id !== undefined && item.quantity !== undefined;
          if (!isValid) {
            // This log is correctly placed inside the filter callback where 'item' is defined
            console.warn('[CartService] Invalid cart item detected during load. Item:', item);
          }
          return isValid;
        });
        // This log is correctly placed after 'validCartItems' is defined
        console.log('[CartService] Valid cart items after filtering (from localStorage):', validCartItems);
        this.cartItemsSubject.next(validCartItems);
        console.log('[CartService] Cart loaded from local storage. Items:', validCartItems.length);
      } catch (e) {
        console.error('[CartService] Error parsing stored cart data from localStorage:', e);
        localStorage.removeItem('shopping_cart');
        this.cartItemsSubject.next([]);
      }
    } else {
      console.log('[CartService] No cart data found in local storage.'); // This log is correctly scoped
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
    console.log('[CartService] Coupons data saved to local storage:', dataToStore);
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
            ? coupon.allowed_customer_ids.split(',').map((id: string) => parseInt(id.trim(), 10)).filter((id: number) => !isNaN(id))
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
            console.log(`[CartService] Stored coupon '${storedCouponCode}' found and re-applied.`);
          } else {
            console.warn(`[CartService] Stored coupon '${storedCouponCode}' not found in current backend coupons. Clearing from local storage.`);
            this.appliedCouponsSubject.next([]);
            this.saveCouponsToLocalStorage();
            this._manualOverrideCouponCode.next(null);
            this._suppressAutoApply.next(false);
          }
        } else {
          this.appliedCouponsSubject.next([]);
        }
      } catch (e) {
        console.error('[CartService] Error parsing applied coupons data from local storage:', e);
        this.appliedCouponsSubject.next([]);
        this._manualOverrideCouponCode.next(null);
        this._suppressAutoApply.next(false);
      }
    } else {
      this.appliedCouponsSubject.next([]);
      this._manualOverrideCouponCode.next(null);
      this._suppressAutoApply.next(false);
    }
    console.log('[CartService] Coupons data loaded from local storage.');
  }

  // MODIFIED: addToCart, removeFromCart, updateQuantity to reset suppression
  addToCart(product: Product, quantity: number = 1): void {
    // Log the cart state *before* any changes
    const initialItems = this.cartItemsSubject.value;
    console.log('[CartService - addToCart] === START ADD TO CART PROCESS ===');
    console.log('[CartService - addToCart] Initial cart state (from BehaviorSubject.value):', JSON.stringify(initialItems));
    console.log('[CartService - addToCart] Product attempting to add:', JSON.stringify(product), 'with quantity:', quantity);

    const currentItems = [...initialItems]; // Create a shallow copy to modify safely
    const existingItem = currentItems.find(item => item.product.id === product.id);

    if (existingItem) {
      existingItem.quantity += quantity;
      console.log('[CartService - addToCart] Existing item found. New quantity:', existingItem.quantity);
    } else {
      currentItems.push({ product, quantity });
      console.log('[CartService - addToCart] New item added to *local* currentItems array.');
    }

    // Log the cart state *after* modifying 'currentItems' but *before* updating the BehaviorSubject
    console.log('[CartService - addToCart] Cart state *after* local modification:', JSON.stringify(currentItems));

    // Update the BehaviorSubject with the new array
    this.cartItemsSubject.next(currentItems); // Pass the modified copy

    // Log the cart state *after* updating the BehaviorSubject
    console.log('[CartService - addToCart] Cart state *after* updating BehaviorSubject:', JSON.stringify(this.cartItemsSubject.value));

    this._suppressAutoApply.next(false);
    this.saveCartToLocalStorage();
    this.openOffcanvasCart();
    console.log('[CartService - addToCart] === END ADD TO CART PROCESS ===');
  }

  removeFromCart(productId: number): void {
    let currentItems = this.cartItemsSubject.value.filter(item => item.product.id !== productId);
    this.cartItemsSubject.next([...currentItems]);
    this._suppressAutoApply.next(false);
    this.saveCartToLocalStorage();
    console.log('[CartService] Item removed from cart. Current cart items count:', this.cartItemsSubject.value.length); // NEW LOG
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
    console.log('[CartService] Item quantity updated. Current cart items count:', this.cartItemsSubject.value.length); // NEW LOG
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
    console.log('[Coupon Apply (Manual)] Attempting to apply coupon:', couponCode);
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
      if (!allowedIds.includes(currentCustomerId)) {
        return { success: false, message: `Coupon "${couponToApply.coupon_code}" is not available for your account.` };
      }
    }

    this.appliedCouponsSubject.next([couponToApply]);
    this._manualOverrideCouponCode.next(couponToApply.coupon_code);
    this._suppressAutoApply.next(false);
    this.saveCouponsToLocalStorage();
    console.log(`[Coupon Apply (Manual)] Successfully applied: ${couponToApply.coupon_code}. Set as manual override, auto-apply enabled.`);

    return { success: true, message: `Coupon "${couponToApply.coupon_code}" applied successfully!` };
  }

  public removeCoupon(couponCode: string): void {
    const currentApplied = this.appliedCouponsSubject.value;
    const isCurrentlyApplied = currentApplied.length > 0 && currentApplied[0].coupon_code.toUpperCase() === couponCode.toUpperCase();

    if (isCurrentlyApplied) {
      console.log(`[Coupon Remove] Initiating removal of coupon: ${couponCode}.`);
      this.appliedCouponsSubject.next([]);
      this._manualOverrideCouponCode.next(null);

      this._suppressAutoApply.next(true);
      console.log('[Coupon Remove] Auto-application suppressed.');

      this.saveCouponsToLocalStorage();
    } else {
      console.log(`[Coupon Remove] Coupon "${couponCode}" was requested to be removed, but it's not the currently applied coupon.`);
    }
  }

  public clearCart(): void {
    this.cartItemsSubject.next([]);
    this.appliedCouponsSubject.next([]);
    this._manualOverrideCouponCode.next(null);
    this._suppressAutoApply.next(false);
    this.saveCartToLocalStorage();
    this.saveCouponsToLocalStorage();
    console.log('[CartService] Cart and coupons cleared.');
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
      console.log('[applyBestAvailableCoupon] Auto-application is currently suppressed. Returning.');
      return;
    }

    this.couponsLoaded.pipe(
      filter(loaded => loaded),
      switchMap(() => combineLatest([this.itemsTotal$, this.allCouponsFromDatabase$, this.currentCustomerId$, this._manualOverrideCouponCode.asObservable()])),
      take(1)
    ).subscribe(([itemsTotal, allCoupons, currentCustomerId, manualOverrideCode]) => {
      console.log(`[applyBestAvailableCoupon] Evaluating... Current Total: ${itemsTotal}, Customer ID: ${currentCustomerId}, Manual Override: ${manualOverrideCode}`);

      const currentAppliedCoupon = this.appliedCouponsSubject.value.length > 0 ? this.appliedCouponsSubject.value[0] : null;

      if (itemsTotal === 0) {
        if (currentAppliedCoupon || manualOverrideCode) {
          console.log('[applyBestAvailableCoupon] Cart is empty, removing applied coupon and clearing manual override.');
          this.appliedCouponsSubject.next([]);
          this._manualOverrideCouponCode.next(null);
          this._suppressAutoApply.next(false);
          this.saveCouponsToLocalStorage();
        }
        return;
      }

      // --- 1. Handle Manual Override First ---
      if (manualOverrideCode) {
        const manuallyAppliedCoupon = allCoupons.find(c => c.coupon_code.toUpperCase() === manualOverrideCode.toUpperCase());

        if (manuallyAppliedCoupon) {
          const isExpired = manuallyAppliedCoupon.expiry_date && new Date() > new Date(manuallyAppliedCoupon.expiry_date);
          const meetsMinOrder = itemsTotal >= (manuallyAppliedCoupon.min_order_value || 0);
          let isCustomerAllowed = true;
          if (manuallyAppliedCoupon.visibility === 'specific_customer') {
            const allowedIds: number[] = typeof manuallyAppliedCoupon.allowed_customer_ids === 'string' // <-- CORRECTED
              ? manuallyAppliedCoupon.allowed_customer_ids.split(',').map((id: string) => parseInt(id.trim(), 10)).filter((id: number) => !isNaN(id))
              : Array.isArray(manuallyAppliedCoupon.allowed_customer_ids) ? manuallyAppliedCoupon.allowed_customer_ids : [];
            if (currentCustomerId === null || !allowedIds.includes(currentCustomerId)) {
              isCustomerAllowed = false;
            }
          }

          if (isExpired || !meetsMinOrder || !isCustomerAllowed) {
            console.warn(`[applyBestAvailableCoupon] Manually applied coupon '${manualOverrideCode}' became invalid. Clearing manual override and suppressing auto-apply.`);
            this.appliedCouponsSubject.next([]);
            this._manualOverrideCouponCode.next(null);
            this._suppressAutoApply.next(true);
            this.saveCouponsToLocalStorage();
          } else {
            if (!currentAppliedCoupon || currentAppliedCoupon.coupon_code !== manuallyAppliedCoupon.coupon_code) {
              console.log(`[applyBestAvailableCoupon] Re-applying valid manually selected coupon: ${manuallyAppliedCoupon.coupon_code}`);
              this.appliedCouponsSubject.next([manuallyAppliedCoupon]);
              this.saveCouponsToLocalStorage();
            } else {
              console.log(`[applyBestAvailableCoupon] Manually selected coupon '${manuallyAppliedCoupon.coupon_code}' is already applied and valid. Keeping it.`);
            }
            return;
          }
        } else {
          console.warn(`[applyBestAvailableCoupon] Manually applied coupon code '${manualOverrideCode}' not found in database. Clearing manual override and suppressing auto-apply.`);
          this.appliedCouponsSubject.next([]);
          this._manualOverrideCouponCode.next(null);
          this._suppressAutoApply.next(true);
          this.saveCouponsToLocalStorage();
        }
      }

      if (this._suppressAutoApply.value) {
        console.log('[applyBestAvailableCoupon] Auto-application is currently suppressed after manual override handling. Returning.');
        return;
      }

      // --- 2. Fallback to Best Available Logic ---
      let bestAutoCoupon: AppliedCoupon | null = null;
      let maxDiscount = 0;

      const applicableCoupons = allCoupons.filter(coupon => {
        const isExpired = coupon.expiry_date && new Date() > new Date(coupon.expiry_date);
        if (isExpired) return false;

        const meetsMinOrder = itemsTotal >= (coupon.min_order_value || 0);
        if (!meetsMinOrder) return false;

        if (coupon.visibility === 'specific_customer') {
          if (currentCustomerId === null) return false;
          const allowedIds: number[] = Array.isArray(coupon.allowed_customer_ids) ? coupon.allowed_customer_ids :
            (typeof coupon.allowed_customer_ids === 'string' ? coupon.allowed_customer_ids.split(',').map((id: string) => parseInt(id.trim(), 10)).filter((id: number) => !isNaN(id)) : []);
          if (!allowedIds.includes(currentCustomerId)) return false;
        }
        return true;
      });

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

      console.log(`[applyBestAvailableCoupon] Found best auto coupon: ${bestAutoCoupon ? bestAutoCoupon.coupon_code : 'None'} with discount: ${maxDiscount.toFixed(2)}`);

      if (bestAutoCoupon) {
        if (!currentAppliedCoupon || currentAppliedCoupon.coupon_code !== bestAutoCoupon.coupon_code) {
          console.log(`[applyBestAvailableCoupon] Applying best auto coupon: ${bestAutoCoupon.coupon_code}`);
          this.appliedCouponsSubject.next([bestAutoCoupon]);
          this.saveCouponsToLocalStorage();
        } else {
          console.log(`[applyBestAvailableCoupon] Current auto coupon (${currentAppliedCoupon.coupon_code}) is still the best. No change needed.`);
        }
      } else if (currentAppliedCoupon) {
        console.log('[applyBestAvailableCoupon] No applicable auto coupons found. Removing currently applied coupon.');
        this.appliedCouponsSubject.next([]);
        this.saveCouponsToLocalStorage();
      } else {
        console.log('[applyBestAvailableCoupon] No applicable auto coupons found, and none currently applied. State is clear.');
      }
    });
  }

  getOrderDetails(orderId: string): Observable<any> {
    const url = `http://localhost/ezhuthupizhai/backend/checkout/get_order_details/${orderId}`;
    console.log(`[CartService] Fetching order details for ID: ${orderId} from URL: ${url}`);
    return this.http.get<any>(url).pipe(
      tap(response => console.log('[CartService] Order details fetched:', response)),
      catchError(error => {
        console.error(`[CartService] Error fetching order details for ID ${orderId}:`, error);
        // You might want to return an Observable of an error object or rethrow
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