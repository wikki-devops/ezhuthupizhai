import { Component, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ProductServiceTsService } from 'src/app/services/product.service.ts.service';
import { CartService } from 'src/app/services/cart.service.ts.service';
import { Product } from 'src/app/models/product.model';
import { Review } from 'src/app/models/review.model';
import { ProductImage } from 'src/app/models/product-image.model';
import { Subscription } from 'rxjs';

declare var $: any;

@Component({
  selector: 'app-product-details',
  templateUrl: './product-details.component.html',
  styleUrls: ['./product-details.component.css']
})
export class ProductDetailsComponent implements OnInit, AfterViewInit, OnDestroy {
  product: Product | undefined;
  quickViewQuantities: { [productId: number]: number } = {};

  private productSubscription?: Subscription;
  private routeSubscription?: Subscription;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private productService: ProductServiceTsService,
    private cartService: CartService
  ) { }

  ngAfterViewInit(): void {
    // Initial safety net
    setTimeout(() => this.initializeMagnificPopup(), 100);
  }

  ngOnInit(): void {
    this.routeSubscription = this.route.paramMap.subscribe(params => {
      const slug = params.get('slug');
      if (slug) {
        this.fetchProductBySlug(slug);
      } else {
        this.router.navigate(['/products']);
      }
    });
  }
  fetchProductBySlug(slug: string): void {
    this.productSubscription = this.productService.getProductBySlug(slug).subscribe({
      next: (data: Product | null) => {
        if (data) {
          this.product = {
            ...data,
            images: data.images || []  // Ensure images is an array
          };
          this.quickViewQuantities[this.product.id] = 1;
          setTimeout(() => this.initializeMagnificPopup(), 100);

        } else {
          this.router.navigate(['/404']);
        }
      },
      error: (error) => {
        this.router.navigate(['/404']);
      }
    });
  }

  initializeMagnificPopup(): void {
    const $gallery = $('#lightgallery');

    if ($gallery.data('magnificPopup')) {
      $gallery.magnificPopup('destroy'); // Prevent duplicate bindings
    }

    $gallery.magnificPopup({
      delegate: 'a.lg-item',
      type: 'image',
      gallery: {
        enabled: true
      }
    });
  }



  public parseFloat(value: string | number | null | undefined): number {
    return Number.parseFloat(String(value ?? 0));
  }

  get hasImages(): boolean {
    return !!this.product && Array.isArray(this.product.images) && this.product.images.length > 0;
  }

  get thumbnailImages(): ProductImage[] {
    return this.product?.images?.filter(img => img.is_thumbnail) || [];
  }

  get additionalImages(): ProductImage[] {
    return this.product?.images?.filter(img => !img.is_thumbnail) || [];
  }

  getQuickViewQuantity(productId: number): number {
    if (!this.quickViewQuantities[productId] || this.quickViewQuantities[productId] < 1) {
      this.quickViewQuantities[productId] = 1;
    }
    return this.quickViewQuantities[productId];
  }

  onQuickViewQuantityChange(productId: number, event: Event): void {
    const inputElement = event.target as HTMLInputElement;
    let newQuantity = Number(inputElement.value);

    if (isNaN(newQuantity) || newQuantity < 1) {
      newQuantity = 1;
    }
    this.quickViewQuantities[productId] = newQuantity;
  }

  incrementQuickViewQuantity(product: Product): void {
    const currentQuantity = this.getQuickViewQuantity(product.id);
    this.quickViewQuantities[product.id] = currentQuantity + 1;
  }

  decrementQuickViewQuantity(product: Product): void {
    const currentQuantity = this.getQuickViewQuantity(product.id);
    if (currentQuantity > 1) {
      this.quickViewQuantities[product.id] = currentQuantity - 1;
    }
  }

  onAddToCart(product: Product): void {
    const quantityToAdd = this.getQuickViewQuantity(product.id);
    this.cartService.addToCart(product, quantityToAdd);
    this.quickViewQuantities[product.id] = 1; // Reset quantity
  }

  getDiscountPercentage(mrp: string, special: string): number {
    const mrpNum = parseFloat(mrp);
    const specialNum = parseFloat(special);
    return mrpNum > specialNum ? ((1 - (specialNum / mrpNum)) * 100) : 0;
  }

  calculateProductAverageRating(reviews: Review[] = []): number {
    const total = reviews.reduce((sum, r) => sum + Number(r.rating), 0);
    return reviews.length ? total / reviews.length : 0;
  }
  getTotalPrice(product: Product): number {
    const quantity = this.getQuickViewQuantity(product.id);
    const price = parseFloat(product.special_price);
    return quantity * price;
  }

  getStarArray(rating: number): boolean[] {
    return Array(5).fill(false).map((_, i) => i < Math.floor(rating));
  }

  ngOnDestroy(): void {
    this.productSubscription?.unsubscribe();
    this.routeSubscription?.unsubscribe();
    $('#lightgallery').magnificPopup('destroy'); // Cleanup
  }
}
