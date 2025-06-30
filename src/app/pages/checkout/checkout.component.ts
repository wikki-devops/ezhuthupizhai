import {
    Component,
    OnInit,
    OnDestroy,
    HostListener // Import HostListener
} from '@angular/core';
import {
    FormBuilder,
    FormGroup,
    Validators
} from '@angular/forms';
import {
    Router
} from '@angular/router';
import {
    Observable,
    Subscription,
    combineLatest,
    BehaviorSubject
} from 'rxjs';
import {
    HttpClient
} from '@angular/common/http';
import {
    take,
    map
} from 'rxjs/operators';
import {
    CartService
} from '../../services/cart.service.ts.service'; // Adjust path if necessary
import {
    CartItem
} from '../../models/cart-item.model'; // Adjust path if necessary
import {
    AppliedCoupon
} from '../../models/applied-coupon.model'; // Adjust path if necessary

// Define the UserAddress interface (ensure it matches your backend structure)
export interface UserAddress {
    id: number;
    user_id: number;
    first_name: string;
    last_name: string | null; // Use null for optional string fields
    phone: string;
    email: string;
    address1: string;
    address2: string | null; // Use null for optional string fields
    city: string;
    state: string;
    zip_code: string;
    country: string;
    type: 'billing' | 'shipping' | 'both' | string; // Use string for flexibility
    is_default_billing: number; // Use 0 or 1 for boolean from PHP/DB
    is_default_shipping: number; // Use 0 or 1 for boolean from PHP/DB
    is_active: number;
    created_at: string;
    updated_at: string;
}

@Component({
    selector: 'app-checkout',
    templateUrl: './checkout.component.html',
    styleUrls: ['./checkout.component.css']
})
export class CheckoutComponent implements OnInit, OnDestroy {
    checkoutForm!: FormGroup;
    loginForm!: FormGroup;

    private cartItemsSubject = new BehaviorSubject<CartItem[]>([]);
    cartItems$: Observable<CartItem[]> = this.cartItemsSubject.asObservable();
    cartItems: CartItem[] = [];

    totalCouponDiscount$: Observable<number>;
    deliveryCharge$: Observable<number>;
    subTotalAfterDiscount$: Observable<number>;
    finalTotal$: Observable<number>;
    currentlyAppliedCoupon$: Observable<AppliedCoupon | null>;

    loggedInUserId: number | null = null;
    loginEmail: string = '';
    loginOtp: string = '';
    otpSent: boolean = false;
    otpVerified: boolean = false; // Initial state: not verified

    userAddresses: UserAddress[] = [];
    selectedAddressId: number | null = null;
    activeAddressMode: 'new' | 'saved' = 'new';

    selectedPaymentMethod: string = 'COD';
    agreedToTerms: boolean = false;
    private subscriptions: Subscription = new Subscription();

    showErrorMessage: boolean = false;
    errorMessage: string = '';
    messageType: 'success' | 'error' | 'warning' | 'info' = 'info';

    constructor(
        private router: Router,
        public cartService: CartService,
        private http: HttpClient,
        private fb: FormBuilder
    ) {
        this.cartItems$ = this.cartService.cartItems$;
        this.totalCouponDiscount$ = this.cartService.totalCouponDiscount$;
        this.deliveryCharge$ = this.cartService.deliveryCharge$;
        this.subTotalAfterDiscount$ = this.cartService.subTotalAfterDiscount$;
        this.finalTotal$ = this.cartService.finalTotal$;
        this.currentlyAppliedCoupon$ = this.cartService.getCurrentlyAppliedCoupon();

        this.initForms();
    }

    ngOnInit(): void {
        this.subscriptions.add(this.cartItems$.subscribe(items => {
            this.cartItems = items;
            if (items.length === 0) {
                this.displayMessage('Your cart is empty. Please add items before proceeding to checkout.', 'warning');
            } else {
                this.showErrorMessage = false;
                this.errorMessage = '';
            }
        }));

        // --- Check for stored login state on initialization ---
        this.checkStoredLoginState();
    }

    ngOnDestroy(): void {
        this.subscriptions.unsubscribe();
    }

    // Optional: Save state before browser closes/refreshes
    // @HostListener('window:beforeunload', ['$event'])
    // unloadNotification($event: any): void {
    //     // You can choose to save current checkout form state here if needed
    //     // For simple login state, it's saved right after verification.
    // }

    private initForms(): void {
        this.loginForm = this.fb.group({
            email: ['', [Validators.required, Validators.email]],
            otp: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]]
        });

        this.checkoutForm = this.fb.group({
            firstName: ['', Validators.required],
            lastName: [''],
            phone: ['', [Validators.required, Validators.pattern(/^\d{10,15}$/)]],
            email: ['', [Validators.required, Validators.email]],
            address1: ['', Validators.required],
            address2: [''],
            city: ['', Validators.required],
            state: ['', Validators.required],
            zipCode: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
            country: ['India', Validators.required],
            createAccount: [false],
            orderNotes: ['']
        });
    }

    private checkStoredLoginState(): void {
        const storedUserId = localStorage.getItem('loggedInUserId');
        const storedEmail = localStorage.getItem('loginEmail');
        const storedOtpVerified = localStorage.getItem('otpVerified');

        if (storedUserId && storedEmail && storedOtpVerified === 'true') {
            this.loggedInUserId = parseInt(storedUserId, 10);
            this.loginEmail = storedEmail;
            this.otpVerified = true;
            this.otpSent = true; // Assume OTP was sent and verified

            this.loginForm.patchValue({ email: this.loginEmail }); // Pre-fill login form email

            // Immediately fetch addresses for the logged-in user
            this.fetchUserAddresses(this.loggedInUserId);
        } else {
            // If no stored state, ensure everything is reset
            this.logout(); // Use logout to reset state cleanly
        }
    }

    // Helper to safely parse float values
    public parseFloat(value: string | number | null | undefined): number {
        return Number.parseFloat(String(value ?? 0));
    }

    // Helper method to display messages
    private displayMessage(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info', duration: number = 5000): void {
        this.errorMessage = message;
        this.messageType = type;
        this.showErrorMessage = true;
        setTimeout(() => {
            this.showErrorMessage = false;
            this.errorMessage = '';
        }, duration);
    }

    // --- OTP Related Methods ---
    sendOtp(): void {
        this.displayMessage('', 'info', 0);

        if (this.loginForm.get('email')?.invalid) {
            this.displayMessage('Please enter a valid email address to send OTP.', 'warning');
            return;
        }

        this.loginEmail = this.loginForm.get('email')?.value;
        const otpData = {
            email: this.loginEmail
        };

        this.http.post('http://localhost/ezhuthupizhai/backend/auth/send_otp', otpData)
            .subscribe({
                next: (response: any) => {
                    if (response.success) {
                        this.otpSent = true;
                        this.displayMessage('OTP sent to your email! Please check your inbox.', 'success', 8000);
                    } else {
                        this.displayMessage('Failed to send OTP: ' + (response.message || 'Unknown error.'), 'error');
                    }
                },
                error: (error) => {
                    console.error('Error sending OTP:', error);
                    this.displayMessage('An error occurred while sending OTP. Please try again.', 'error');
                }
            });
    }

    verifyOtpAndFetchAddresses(): void {
        this.displayMessage('', 'info', 0);

        if (this.loginForm.invalid) {
            this.displayMessage('Please enter a valid email and OTP.', 'warning');
            return;
        }

        const verifyData = {
            email: this.loginForm.get('email')?.value,
            otp: this.loginForm.get('otp')?.value
        };

        this.http.post('http://localhost/ezhuthupizhai/backend/auth/verify_otp_and_get_addresses', verifyData)
            .subscribe({
                next: (response: any) => {
                    if (response.success) {
                        this.loggedInUserId = response.user_id || null;
                        this.otpVerified = true; // Mark as verified

                        // --- Store login state in localStorage ---
                        localStorage.setItem('loggedInUserId', String(this.loggedInUserId));
                        localStorage.setItem('loginEmail', this.loginEmail);
                        localStorage.setItem('otpVerified', 'true');

                        this.userAddresses = response.addresses || [];

                        if (this.userAddresses.length > 0) {
                            this.activeAddressMode = 'saved';
                            this.selectedAddressId = this.userAddresses[0].id;
                            this.selectSavedAddress(this.userAddresses[0].id);
                            this.displayMessage('OTP verified. Addresses loaded successfully!', 'success', 3000);
                        } else {
                            this.activeAddressMode = 'new';
                            this.selectedAddressId = null;
                            this.resetCheckoutForm();
                            this.checkoutForm.patchValue({ email: this.loginEmail });
                            this.displayMessage('OTP verified. No saved addresses found. Please enter your details.', 'info', 5000);
                        }
                    } else {
                        this.displayMessage('OTP verification failed: ' + (response.message || 'Invalid OTP.'), 'error');
                        this.otpVerified = false;
                        this.logout(); // Clear local storage on failed verification attempt
                    }
                },
                error: (error) => {
                    console.error('Error verifying OTP or fetching addresses:', error);
                    this.displayMessage('An error occurred during OTP verification or address retrieval. Please try again.', 'error');
                    this.otpVerified = false;
                    this.logout(); // Clear local storage on error
                }
            });
    }

    // New method to fetch addresses based on user ID (for refresh)
    private fetchUserAddresses(userId: number): void {
        this.displayMessage('Attempting to retrieve your saved addresses...', 'info', 2000);
        this.http.post('http://localhost/ezhuthupizhai/backend/auth/get_addresses_by_user_id', { user_id: userId })
            .subscribe({
                next: (response: any) => {
                    if (response.success) {
                        this.userAddresses = response.addresses || [];
                        if (this.userAddresses.length > 0) {
                            this.activeAddressMode = 'saved';
                            this.selectedAddressId = this.userAddresses[0].id;
                            this.selectSavedAddress(this.userAddresses[0].id);
                            this.displayMessage('Welcome back! Your addresses have been loaded.', 'success', 3000);
                        } else {
                            this.activeAddressMode = 'new';
                            this.selectedAddressId = null;
                            this.resetCheckoutForm();
                            this.checkoutForm.patchValue({ email: this.loginEmail });
                            this.displayMessage('Welcome back! No saved addresses found. Please enter your details.', 'info', 5000);
                        }
                    } else {
                        this.displayMessage('Failed to load saved addresses: ' + (response.message || 'Unknown error.'), 'error');
                        this.logout(); // If fetching addresses fails, assume logout
                    }
                },
                error: (error) => {
                    console.error('Error fetching addresses on refresh:', error);
                    this.displayMessage('An error occurred while loading your addresses. Please log in again.', 'error');
                    this.logout(); // If fetching addresses fails, assume logout
                }
            });
    }

    // New method for explicit logout
    logout(): void {
        localStorage.removeItem('loggedInUserId');
        localStorage.removeItem('loginEmail');
        localStorage.removeItem('otpVerified');

        this.loggedInUserId = null;
        this.otpVerified = false;
        this.otpSent = false;
        this.loginEmail = '';
        this.loginOtp = '';
        this.userAddresses = [];
        this.selectedAddressId = null;
        this.activeAddressMode = 'new'; // Reset to new address entry
        this.resetCheckoutForm(); // Clear checkout form
        this.loginForm.reset(); // Clear login form
        this.displayMessage('You have been logged out.', 'info', 3000);
    }

    // --- Address Management Methods ---
    toggleAddressMode(mode: 'saved' | 'new'): void {
        this.activeAddressMode = mode;
        this.displayMessage('', 'info', 0);

        if (mode === 'new') {
            this.selectedAddressId = null;
            this.resetCheckoutForm();
            if (this.otpVerified) {
                this.checkoutForm.patchValue({ email: this.loginEmail });
            }
            this.displayMessage('Enter details for your new delivery address.', 'info', 3000);
        } else if (mode === 'saved' && this.userAddresses.length > 0) {
            if (!this.selectedAddressId || !this.userAddresses.some(addr => addr.id === this.selectedAddressId)) {
                 this.selectedAddressId = this.userAddresses[0].id;
                 this.selectSavedAddress(this.userAddresses[0].id);
            } else {
                this.selectSavedAddress(this.selectedAddressId);
            }
            this.displayMessage('Choose a saved address.', 'info', 3000);
        } else if (mode === 'saved' && this.userAddresses.length === 0) {
            this.activeAddressMode = 'new';
            this.displayMessage('You have no saved addresses. Please add a new one.', 'warning');
            if (this.otpVerified) {
                this.checkoutForm.patchValue({ email: this.loginEmail });
            }
        }
    }

    selectSavedAddress(addressId: number): void {
        this.selectedAddressId = addressId;
        const selectedAddress = this.userAddresses.find(addr => addr.id === addressId);
        if (selectedAddress) {
            this.checkoutForm.patchValue({
                firstName: selectedAddress.first_name,
                lastName: selectedAddress.last_name,
                phone: selectedAddress.phone,
                email: selectedAddress.email,
                address1: selectedAddress.address1,
                address2: selectedAddress.address2,
                city: selectedAddress.city,
                state: selectedAddress.state,
                zipCode: selectedAddress.zip_code,
                country: selectedAddress.country,
            });
            this.checkoutForm.get('createAccount')?.patchValue(false);
            this.checkoutForm.markAsPristine();
            this.checkoutForm.markAsUntouched();
            this.displayMessage('Address selected: ' + selectedAddress.address1, 'info', 2000);
        }
    }

    editAddress(address: UserAddress): void {
        this.activeAddressMode = 'new';
        this.selectedAddressId = address.id;

        this.checkoutForm.patchValue({
            firstName: address.first_name,
            lastName: address.last_name,
            phone: address.phone,
            email: address.email,
            address1: address.address1,
            address2: address.address2,
            city: address.city,
            state: address.state,
            zipCode: address.zip_code,
            country: address.country,
        });
        this.checkoutForm.get('createAccount')?.patchValue(false);
        this.displayMessage('You are now editing this address. Make changes and place order.', 'info', 5000);
    }

    removeAddress(addressId: number): void {
        if (confirm('Are you sure you want to remove this address?')) {
            // **IMPORTANT:** You should send an API request to your backend here
            // to actually delete the address from the database.
            // Example (uncomment and adjust if you have an API endpoint for this):
            /*
            this.http.post('http://localhost/ezhuthupizhai/backend/addresses/remove', { address_id: addressId, user_id: this.loggedInUserId })
              .subscribe({
                next: (response: any) => {
                  if (response.success) {
                    this.userAddresses = this.userAddresses.filter(addr => addr.id !== addressId);
                    if (this.selectedAddressId === addressId) {
                      this.selectedAddressId = null;
                      this.activeAddressMode = 'new';
                      this.resetCheckoutForm();
                    }
                    this.displayMessage('Address removed successfully!', 'success', 3000);
                  } else {
                    this.displayMessage(response.message || 'Failed to remove address.', 'error');
                  }
                },
                error: (error) => {
                  console.error('Error removing address:', error);
                  this.displayMessage('An error occurred while removing address. Please try again.', 'error');
                }
              });
            */

            // For now, only remove from local array:
            this.userAddresses = this.userAddresses.filter(addr => addr.id !== addressId);
            if (this.selectedAddressId === addressId) {
                this.selectedAddressId = null;
                this.activeAddressMode = 'new';
                this.resetCheckoutForm();
            }
            this.displayMessage('Address removed successfully!', 'success', 3000);
        }
    }

    resetCheckoutForm(): void {
        this.checkoutForm.reset({
            firstName: '',
            lastName: '',
            phone: '',
            email: '',
            address1: '',
            address2: '',
            city: 'Kota', // Default value
            state: 'Rajasthan', // Default value
            zipCode: '',
            country: 'India', // Default value
            createAccount: false,
            orderNotes: ''
        });
        this.checkoutForm.markAsPristine();
        this.checkoutForm.markAsUntouched();
    }

    // --- Place Order Logic ---
    placeOrder(): void {
        this.displayMessage('', 'info', 0);

        if (this.cartItems.length === 0) {
            this.displayMessage('Your cart is empty. Please add items before placing an order.', 'warning');
            this.router.navigate(['/cart']);
            return;
        }

        if (!this.agreedToTerms) {
            this.displayMessage('Please agree to the website terms and conditions.', 'warning');
            return;
        }

        let shippingDetailsToSend: any;

        if (this.activeAddressMode === 'saved' && this.selectedAddressId !== null) {
            const selectedAddress = this.userAddresses.find(addr => addr.id === this.selectedAddressId);
            if (!selectedAddress) {
                this.displayMessage('Selected address not found. Please choose an address or enter new details.', 'error');
                return;
            }
            shippingDetailsToSend = {
                ...selectedAddress,
                orderNotes: this.checkoutForm.get('orderNotes')?.value,
                address_id: selectedAddress.id,
                is_address_from_saved: true,
                createAccount: false
            };
            if (shippingDetailsToSend.address2 === null) shippingDetailsToSend.address2 = '';
            if (shippingDetailsToSend.lastName === null) shippingDetailsToSend.lastName = '';


        } else {
            if (this.checkoutForm.invalid) {
                this.displayMessage('Please fill in all required shipping details.', 'warning');
                this.checkoutForm.markAllAsTouched();
                return;
            }
            shippingDetailsToSend = {
                ...this.checkoutForm.value,
                is_address_from_saved: false
            };
            if (this.selectedAddressId !== null) {
                shippingDetailsToSend.address_id = this.selectedAddressId;
            }
        }

        combineLatest([
            this.cartService.cartTotal$,
            this.cartService.totalCouponDiscount$,
            this.cartService.subTotalAfterDiscount$,
            this.cartService.deliveryCharge$,
            this.cartService.finalTotal$
        ]).pipe(take(1)).subscribe(([subtotal, coupon_discount, subtotal_after_discount, delivery_charge, final_total]) => {

            const orderData = {
                user_auth_context: {
                    email: this.loginEmail,
                    otp_verified: this.otpVerified,
                    user_id: this.loggedInUserId
                },
                shipping_details: shippingDetailsToSend,
                payment_method: this.selectedPaymentMethod,
                agreed_to_terms: this.agreedToTerms,
                cart_items: this.cartItems.map(item => ({
                    product_id: item.product.id,
                    quantity: item.quantity,
                    price: this.parseFloat(item.product.special_price),
                    product: {
                        name: item.product.name,
                        special_price: item.product.special_price
                    }
                })),
                order_summary: {
                    subtotal: this.parseFloat(subtotal),
                    coupon_discount: this.parseFloat(coupon_discount),
                    subtotal_after_discount: this.parseFloat(subtotal_after_discount),
                    delivery_charge: this.parseFloat(delivery_charge),
                    final_total: this.parseFloat(final_total)
                }
            };

            this.http.post('http://localhost/ezhuthupizhai/backend/checkout/place_order', orderData).subscribe({
                next: (response: any) => {
                    if (response.success) {
                        this.cartService.clearCart();
                        this.router.navigate(['/order-confirmation', response.order_id]);
                        this.displayMessage('Order placed successfully! Order ID: ' + response.order_id, 'success');
                        this.logout(); // Log out after successful order to clear state
                    } else {
                        this.displayMessage(response.message || 'Order placement failed.', 'error');
                    }
                },
                error: (error) => {
                    console.error('Error placing order:', error);
                    this.displayMessage('An error occurred while placing your order. Please try again.', 'error');
                }
            });
        });
    }

    goToCart(): void {
        this.router.navigate(['/cart']);
    }
}