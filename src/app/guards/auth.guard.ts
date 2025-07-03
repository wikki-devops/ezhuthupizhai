import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { map, take } from 'rxjs/operators';
import { UserService } from '../services/user.service'; // Adjust path if needed

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {

  constructor(private userService: UserService, private router: Router) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {

    return this.userService.currentUser$.pipe(
      take(1), // Take the current value and complete
      map(user => {
        if (user && user.id) { // Check if a user object exists and has an ID
          return true; // User is logged in, allow access
        } else {
          // User is not logged in, redirect to login page (or home)
          this.router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
          return false; // Prevent access
        }
      })
    );
  }
}