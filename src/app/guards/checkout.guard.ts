import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { map, take } from 'rxjs/operators';
import { CartService } from '../services/cart.service.ts.service'; // Adjust path if needed

@Injectable({
  providedIn: 'root'
})
export class CheckoutGuard implements CanActivate {

  constructor(private cartService: CartService, private router: Router) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {

    return this.cartService.cartItems$.pipe(
      take(1), // Take only the current value
      map(cartItems => {
        if (cartItems && cartItems.length > 0) {
          return true; // Allow navigation if cart is not empty
        } else {
          alert('Your cart is empty. Please add items before proceeding to checkout.'); // Optional: user feedback
          return this.router.createUrlTree(['/cart']); // Redirect to cart page (or '/home')
        }
      })
    );
  }
}