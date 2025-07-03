import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Observable, Subscription, combineLatest } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { take } from 'rxjs/operators';
import { CartService } from '../../services/cart.service.ts.service';
import { CartItem } from '../../models/cart-item.model';
import { AppliedCoupon } from '../../models/applied-coupon.model';
import { UserService, User, Address as UserAddress } from '../../services/user.service';
import { environment } from 'src/app/environments/environment';

@Component({
    selector: 'app-checkout',
    templateUrl: './checkout.component.html',
    styleUrls: ['./checkout.component.css']
})
export class CheckoutComponent implements OnInit, OnDestroy {
    checkoutForm!: FormGroup;
    loginForm!: FormGroup;

    cartItems$: Observable<CartItem[]>;
    cartItems: CartItem[] = [];

    totalCouponDiscount$: Observable<number>;
    deliveryCharge$: Observable<number>;
    subTotalAfterDiscount$: Observable<number>;
    finalTotal$: Observable<number>;
    currentlyAppliedCoupon$: Observable<AppliedCoupon | null>;

    loggedInUserId: number | null = null;
    loginEmail: string = '';
    otpSent: boolean = false;
    otpVerified: boolean = false;

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
        private fb: FormBuilder,
        private userService: UserService
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

        this.subscriptions.add(this.userService.currentUser$.subscribe(user => {
            if (user) {
                this.loggedInUserId = user.id;
                this.loginEmail = user.email;
                this.otpVerified = true;
                this.otpSent = true;
                this.loginForm.patchValue({
                    email: this.loginEmail
                });
                // Disable email field after login/OTP verification
                this.loginForm.get('email')?.disable();
                this.fetchUserAddresses(this.loggedInUserId);
            } else {
                this.logoutLocalState();
                // Ensure email field is enabled if user logs out
                this.loginForm.get('email')?.enable();
            }
            this.updateLoginFormState(); // Call to manage OTP field state
        }));

        // Initial setup for form field disabling based on activeAddressMode
        this.updateCheckoutFormAccessibility();
    }

    ngOnDestroy(): void {
        this.subscriptions.unsubscribe();
    }

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
            createAccount: [true],
            orderNotes: ['']
        });
    }

    // New method to control login form field accessibility
    private updateLoginFormState(): void {
        const otpControl = this.loginForm.get('otp');
        const emailControl = this.loginForm.get('email');

        if (this.otpSent) {
            otpControl?.enable(); // Enable OTP input if OTP is sent
        } else {
            otpControl?.disable(); // Disable OTP input if not sent
        }

        if (this.otpVerified && this.loggedInUserId) {
            emailControl?.disable(); // Disable email if OTP is verified and logged in
            otpControl?.disable(); // Disable OTP if logged in
        } else {
            emailControl?.enable(); // Ensure email is enabled if not verified/logged in
        }
    }

    // New method to control checkout form field accessibility
    private updateCheckoutFormAccessibility(): void {
        if (this.activeAddressMode === 'saved' && this.selectedAddressId !== null) {
            // If a saved address is selected, disable most fields
            this.checkoutForm.controls['firstName'].disable();
            this.checkoutForm.controls['lastName'].disable();
            this.checkoutForm.controls['phone'].disable();
            this.checkoutForm.controls['email'].disable();
            this.checkoutForm.controls['address1'].disable();
            this.checkoutForm.controls['address2'].disable();
            this.checkoutForm.controls['city'].disable();
            this.checkoutForm.controls['state'].disable();
            this.checkoutForm.controls['zipCode'].disable();
            this.checkoutForm.controls['country'].disable();
            this.checkoutForm.controls['createAccount'].disable(); // Can't create account if using saved address
        } else {
            // If 'new' address mode or no saved address selected, enable fields
            this.checkoutForm.controls['firstName'].enable();
            this.checkoutForm.controls['lastName'].enable();
            this.checkoutForm.controls['phone'].enable();
            this.checkoutForm.controls['email'].enable();
            this.checkoutForm.controls['address1'].enable();
            this.checkoutForm.controls['address2'].enable();
            this.checkoutForm.controls['city'].enable();
            this.checkoutForm.controls['state'].enable();
            this.checkoutForm.controls['zipCode'].enable();
            this.checkoutForm.controls['country'].enable();

            // Re-enable createAccount only if user is not logged in
            if (!this.loggedInUserId) {
                this.checkoutForm.controls['createAccount'].enable();
            } else {
                this.checkoutForm.controls['createAccount'].disable(); // Logged-in users can't "create account" again
                this.checkoutForm.patchValue({ createAccount: false }); // Ensure it's false for logged-in users
            }
        }

        // Always ensure email in checkout form is patched and potentially disabled if logged in
        if (this.loggedInUserId && this.loginEmail) {
            this.checkoutForm.patchValue({ email: this.loginEmail });
            this.checkoutForm.get('email')?.disable(); // Keep it disabled if logged in
        } else {
             // If not logged in, make sure email is enabled if it was disabled by a saved address selection
            this.checkoutForm.get('email')?.enable();
        }
    }


    public parseFloat(value: string | number | null | undefined): number {
        return Number.parseFloat(String(value ?? 0));
    }

    private displayMessage(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info', duration: number = 5000): void {
        this.errorMessage = message;
        this.messageType = type;
        this.showErrorMessage = true;
        if (duration > 0) {
            setTimeout(() => {
                this.showErrorMessage = false;
                this.errorMessage = '';
            }, duration);
        }
    }

    private logoutLocalState(): void {
        this.loggedInUserId = null;
        this.otpVerified = false;
        this.otpSent = false;
        this.loginEmail = '';
        this.userAddresses = [];
        this.selectedAddressId = null;
        this.activeAddressMode = 'new';
        this.resetCheckoutForm();
        this.loginForm.reset();
        this.updateLoginFormState(); // Update state after logout
        this.updateCheckoutFormAccessibility(); // Update state after logout
    }

    sendOtp(): void {
        this.displayMessage('', 'info', 0);

        if (this.loginForm.get('email')?.invalid) {
            this.displayMessage('Please enter a valid email address to send OTP.', 'warning');
            return;
        }

        const emailToSend = this.loginForm.get('email')?.value;
        this.userService.sendOtp(emailToSend)
            .subscribe({
                next: (response: any) => {
                    if (response.success) {
                        this.otpSent = true;
                        this.displayMessage('OTP sent to your email! Please check your inbox.', 'success', 8000);
                        this.loginEmail = emailToSend;
                        this.updateLoginFormState(); // Update state after OTP sent
                    } else {
                        this.displayMessage('Failed to send OTP: ' + (response.message || 'Unknown error.'), 'error');
                    }
                },
                error: (error) => {
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

        const emailToVerify = this.loginForm.get('email')?.value;
        const otpToVerify = this.loginForm.get('otp')?.value;

        this.userService.verifyOtp(emailToVerify, otpToVerify)
            .subscribe({
                next: (response: any) => {
                    if (response.success) {
                        const user: User = {
                            id: response.user_id,
                            first_name: response.first_name || '',
                            last_name: response.last_name || null,
                            email: emailToVerify,
                            phone: response.phone || '',
                            token: response.token || undefined
                        };

                        this.userService.setUser(user);
                        this.displayMessage('OTP verified. You are now logged in!', 'success', 3000);
                        // currentUser$ subscription in ngOnInit will handle fetchUserAddresses and update form state
                    } else {
                        this.displayMessage('OTP verification failed: ' + (response.message || 'Invalid OTP.'), 'error');
                        this.otpVerified = false;
                        this.loginForm.get('otp')?.reset();
                        this.updateLoginFormState(); // Update state on failure
                    }
                },
                error: (error) => {
                    this.displayMessage('An error occurred during OTP verification. Please try again.', 'error');
                    this.otpVerified = false;
                    this.loginForm.get('otp')?.reset();
                    this.updateLoginFormState(); // Update state on error
                }
            });
    }

    private fetchUserAddresses(userId: number): void {
        if (!userId) {
            return;
        }
        this.displayMessage('Attempting to retrieve your saved addresses...', 'info', 2000);

        this.userService.getUserAddresses(userId)
            .subscribe({
                next: (response) => {
                    if (response.success) {
                        this.userAddresses = response.addresses || [];
                        if (this.userAddresses.length > 0) {
                            this.activeAddressMode = 'saved';
                            const defaultShippingAddress = this.userAddresses.find(addr => addr.is_default_shipping === 1);
                            this.selectedAddressId = defaultShippingAddress?.id ?? this.userAddresses[0]?.id ?? null;
                            if (this.selectedAddressId !== null) {
                                this.selectSavedAddress(this.selectedAddressId);
                            } else {
                                this.activeAddressMode = 'new';
                                this.displayMessage('No valid default or saved addresses found. Please add a new one.', 'warning');
                                this.resetCheckoutForm();
                                this.checkoutForm.patchValue({ email: this.loginEmail });
                            }
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
                        this.userService.clearUser();
                    }
                    this.updateCheckoutFormAccessibility(); // Update form state after address fetch
                },
                error: (error) => {
                    this.displayMessage('An error occurred while loading your addresses. Please log in again.', 'error');
                    this.userService.clearUser();
                    this.updateCheckoutFormAccessibility(); // Update form state on error
                }
            });
    }

    logout(): void {
        this.userService.clearUser();
        this.displayMessage('You have been logged out.', 'info', 3000);
    }

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
        } else if (mode === 'saved') {
            if (this.userAddresses.length > 0) {
                const defaultShippingAddress = this.userAddresses.find(addr => addr.is_default_shipping === 1);
                this.selectedAddressId = defaultShippingAddress?.id ?? this.userAddresses[0]?.id ?? null;

                if (this.selectedAddressId !== null) {
                    this.selectSavedAddress(this.selectedAddressId);
                    this.displayMessage('Choose a saved address.', 'info', 3000);
                } else {
                    this.activeAddressMode = 'new';
                    this.displayMessage('No valid saved addresses available. Please add a new one.', 'warning');
                    this.resetCheckoutForm();
                    if (this.otpVerified) {
                        this.checkoutForm.patchValue({ email: this.loginEmail });
                    }
                }
            } else {
                this.activeAddressMode = 'new';
                this.displayMessage('You have no saved addresses. Please add a new one.', 'warning');
                if (this.otpVerified) {
                    this.checkoutForm.patchValue({ email: this.loginEmail });
                }
            }
        }
        this.updateCheckoutFormAccessibility(); // Call this after changing mode
    }

    selectSavedAddress(addressId: number | undefined | null): void {
        if (addressId === undefined || addressId === null) {
            this.selectedAddressId = null;
            this.resetCheckoutForm();
            this.updateCheckoutFormAccessibility(); // Update accessibility
            return;
        }

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
        } else {
            this.selectedAddressId = null;
            this.activeAddressMode = 'new';
            this.resetCheckoutForm();
            this.displayMessage('Selected address is no longer available. Please enter a new address.', 'error');
        }
        this.updateCheckoutFormAccessibility(); // Call this after selection
    }

    editAddress(address: UserAddress): void {
        this.activeAddressMode = 'new';
        this.selectedAddressId = address.id ?? null;

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
        this.updateCheckoutFormAccessibility(); // Call this after setting fields for edit
    }

    removeAddress(addressId: number): void {
        if (confirm('Are you sure you want to remove this address? This action cannot be undone.')) {
            this.http.post(environment.apiUrl + 'addresses/remove', {
                address_id: addressId,
                user_id: this.loggedInUserId
            })
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

                            if (this.userAddresses.length === 0) {
                                this.activeAddressMode = 'new';
                                this.displayMessage('All saved addresses removed. Please add a new one.', 'info');
                            }
                            this.updateCheckoutFormAccessibility(); // Update accessibility
                        } else {
                            this.displayMessage(response.message || 'Failed to remove address.', 'error');
                        }
                    },
                    error: (error) => {
                        this.displayMessage('An error occurred while removing address. Please try again.', 'error');
                    }
                });
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
            city: 'Kota',
            state: 'Rajasthan',
            zipCode: '',
            country: 'India',
            createAccount: true,
            orderNotes: ''
        });
        this.checkoutForm.markAsPristine();
        this.checkoutForm.markAsUntouched();
        this.updateCheckoutFormAccessibility(); // Ensure initial state is correctly set
    }

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
                orderNotes: this.checkoutForm.get('orderNotes')?.value,
                address_id: selectedAddress.id,
                is_address_from_saved: true,
                createAccount: false
            };
            if (shippingDetailsToSend.address2 === null) shippingDetailsToSend.address2 = '';
            if (shippingDetailsToSend.lastName === null) shippingDetailsToSend.lastName = '';

        } else {
            // Read values from form, even if controls are disabled,
            // by using getRawValue() if you need disabled fields values.
            // If only enabled fields' values are needed, .value is fine.
            // For shipping details, you likely need all values the user *saw* or entered.
            const formValue = this.checkoutForm.getRawValue();

            // Perform validation on the form before proceeding.
            // Note: Validators on disabled fields are ignored by default.
            // If you need to validate disabled fields, you must enable them temporarily,
            // or perform manual validation. For a 'saved' address, it's assumed valid.
            if (this.checkoutForm.invalid && this.activeAddressMode === 'new') {
                 // Only mark as touched and show error if it's a 'new' address being entered and it's invalid.
                this.displayMessage('Please fill in all required shipping details correctly.', 'warning');
                this.checkoutForm.markAllAsTouched();
                return;
            }

            shippingDetailsToSend = {
                ...formValue, // Use all raw form values including disabled ones
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
            this.cartService.finalTotal$,
            this.userService.currentUser$.pipe(take(1))
        ]).subscribe(([subtotal, coupon_discount, subtotal_after_discount, delivery_charge, final_total, currentUser]) => {

            const formattedCartItems = this.cartItems.map(item => {
                const priceAtOrder = this.parseFloat(item.product.special_price) || this.parseFloat(item.product.mrp_price);

                const baseItem = {
                    product_id: item.product.id,
                    product_name: item.product.name,
                    quantity: item.quantity,
                    price_at_order: priceAtOrder,
                };

                if (item.product.options?.['is_byob_box']) {
                    const byob_list = (item.product.options['selected_item_names'] as string[] || [])
                                        .map((name, index) => `${index + 1}. ${name}`)
                                        .join('\n');
                    return {
                        ...baseItem,
                        byob_items_list: byob_list || null
                    };
                }
                return baseItem;
            });

            if (formattedCartItems.length === 0) {
                this.displayMessage('There was an issue processing your cart items. Please try again.', 'error');
                return;
            }

            const orderData = {
                user_auth_context: {
                    email: currentUser?.email || this.loginEmail,
                    otp_verified: this.otpVerified,
                    user_id: currentUser?.id || this.loggedInUserId
                },
                shipping_details: shippingDetailsToSend,
                payment_method: this.selectedPaymentMethod,
                agreed_to_terms: this.agreedToTerms,
                cart_items: formattedCartItems,
                order_summary: {
                    subtotal: this.parseFloat(subtotal),
                    coupon_discount: this.parseFloat(coupon_discount),
                    subtotal_after_discount: this.parseFloat(subtotal_after_discount),
                    delivery_charge: this.parseFloat(delivery_charge),
                    final_total: this.parseFloat(final_total)
                }
            };

            this.http.post(environment.apiUrl + 'checkout/place_order', orderData).subscribe({
                next: (response: any) => {
                    if (response.success) {
                        this.cartService.clearCart();
                        this.router.navigate(['/order-confirmation', response.order_id]);
                        this.displayMessage('Order placed successfully! Order ID: ' + response.order_id, 'success', 5000);
                    } else {
                        this.displayMessage(response.message || 'Order placement failed. Please try again.', 'error');
                    }
                },
                error: (error) => {
                    console.error('HTTP Error placing order:', error);
                    let errorMessage = 'An unexpected error occurred while placing your order. Please try again.';
                    if (error.error && error.error.message) {
                        errorMessage = error.error.message;
                    }
                    this.displayMessage(errorMessage, 'error');
                }
            });
        });
    }

    goToCart(): void {
        this.router.navigate(['/cart']);
    }
}