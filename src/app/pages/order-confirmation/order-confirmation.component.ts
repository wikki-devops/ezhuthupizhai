import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CartService } from '../../services/cart.service.ts.service'; // Adjust path if needed
import { Order } from 'src/app/models/order.model';

@Component({
  selector: 'app-order-confirmation',
  templateUrl: './order-confirmation.component.html',
  styleUrls: ['./order-confirmation.component.css']
})
export class OrderConfirmationComponent implements OnInit {
  orderId: string | null = null;
  orderDetails: Order | null = null; // Property to store the fetched order details
  isLoading: boolean = true;
  hasError: boolean = false;
  errorMessage: string = '';

  constructor(
    private route: ActivatedRoute,
    private cartService: CartService // Inject CartService
  ) { }

  ngOnInit(): void {
    // Get the order ID from the route parameters
    this.route.paramMap.subscribe(params => {
      this.orderId = params.get('orderId'); // 'orderId' must match the parameter name in app-routing.module.ts
      console.log('Order ID on confirmation page:', this.orderId);

      if (this.orderId) {
        this.isLoading = true;
        this.hasError = false;
        this.errorMessage = '';
        this.cartService.getOrderDetails(this.orderId).subscribe({
          next: (response) => {
            if (response.success && response.order_details) {
              this.orderDetails = response.order_details;
              console.log('Order details loaded:', this.orderDetails);
            } else {
              this.hasError = true;
              this.errorMessage = response.message || 'Failed to load order details.';
              console.error('Failed to load order details:', response);
            }
            this.isLoading = false;
          },
          error: (err) => {
            this.hasError = true;
            this.errorMessage = 'An error occurred while fetching order details. Please try again.';
            this.isLoading = false;
            console.error('HTTP Error fetching order details:', err);
          }
        });
      } else {
        this.hasError = true;
        this.errorMessage = 'No Order ID provided for confirmation.';
        this.isLoading = false;
        console.warn('No orderId received in OrderConfirmationComponent.');
      }
    });
  }
}