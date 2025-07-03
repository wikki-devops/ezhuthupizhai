import { NgModule } from '@angular/core';
import { RouterModule, Routes, ExtraOptions } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { ShopComponent } from './pages/shop/shop.component';
import { ProductDetailsComponent } from './pages/product-details/product-details.component';
import { CartComponent } from './pages/cart/cart.component';
import { CheckoutComponent } from './pages/checkout/checkout.component';
import { OrderConfirmationComponent } from './pages/order-confirmation/order-confirmation.component';
import { ByobComponent } from './pages/byob/byob.component';
import { ContactComponent } from './pages/contact/contact.component';
import { LoginComponent } from './pages/login/login.component';
import { AuthGuard } from './guards/auth.guard';

const routes: Routes = [
  { path: '', redirectTo: '/home', pathMatch: 'full' },
  { path: 'home', component: HomeComponent },
  { path: 'shop', component: ShopComponent },
  { path: 'products/:slug', component: ProductDetailsComponent },
  { path: 'cart', component: CartComponent },
  { path: 'checkout', component: CheckoutComponent },
  // {
  //   path: 'order-confirmation/:orderId',
  //   component: OrderConfirmationComponent,
  //   canActivate: [AuthGuard]
  // },
  { path: 'order-confirmation/:orderId', component: OrderConfirmationComponent },

  { path: 'byob', component: ByobComponent },
  { path: 'contact', component: ContactComponent },
  { path: 'login', component: LoginComponent },
];

const routerOptions: ExtraOptions = {
  scrollPositionRestoration: 'enabled', // This is the key property!
  anchorScrolling: 'enabled', // Optional: if you have anchor links (e.g., #section1)
  scrollOffset: [0, 0], // Optional: [x, y] to offset the scroll position (e.g., for fixed headers)
};


@NgModule({
  imports: [RouterModule.forRoot(routes, routerOptions)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
