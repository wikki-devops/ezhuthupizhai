import { Component, OnInit, AfterViewInit, OnDestroy, ElementRef, ViewChild} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ProductServiceTsService } from 'src/app/services/product.service.ts.service';
import { CartService } from 'src/app/services/cart.service.ts.service';
import { Product } from 'src/app/models/product.model';
import { Review } from 'src/app/models/review.model'; // Make sure this is updated as per previous instructions
import { ProductImage } from 'src/app/models/product-image.model';
import { Subscription, Subject } from 'rxjs'; // Import Subject for destroy$
import { takeUntil } from 'rxjs/operators'; // Import takeUntil operator
import { DomSanitizer, SafeResourceUrl, SafeHtml } from '@angular/platform-browser';
import { FormBuilder, FormGroup, Validators } from '@angular/forms'; // Import for Reactive Forms

declare var $: any;

@Component({
  selector: 'app-product-details', // Keep this as app-product-details based on your current code
  templateUrl: './product-details.component.html',
  styleUrls: ['./product-details.component.css']
})
export class ProductDetailsComponent implements OnInit, AfterViewInit, OnDestroy { // Keep this as ProductDetailsComponent
  @ViewChild('elfsightWidgetContainer', { static: true }) elfsightWidgetContainer!: ElementRef; // Reference the div
  product: Product | undefined;
  quickViewQuantities: { [productId: number]: number } = {};

  reviewForm: FormGroup; // Declare the review form
  selectedRating: number = 0; // To store the user's selected rating
  reviewSubmissionMessage: string = ''; // Message for review submission status

  private productSubscription?: Subscription;
  private routeSubscription?: Subscription;
  private destroy$ = new Subject<void>(); // Used for unsubscribing observables on destroy

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private productService: ProductServiceTsService,
    private cartService: CartService,
    private sanitizer: DomSanitizer,
    private fb: FormBuilder
  ) {
    // Initialize the review form in the constructor
    this.reviewForm = this.fb.group({
      customer_name: ['', Validators.required], // Matches DB column name
      rating: [0, [Validators.required, Validators.min(1), Validators.max(5)]], // Default to 0, updated by star clicks
      comment: ['', [Validators.required, Validators.maxLength(500)]]
    });
  }

  ngAfterViewInit(): void {
    // Initial safety net
    setTimeout(() => this.initializeMagnificPopup(), 100);
    const script = document.createElement('script');
    script.src = this.sanitizer.bypassSecurityTrustResourceUrl('https://static.elfsight.com/platform/platform.js') as string;
    script.async = true;
    const div = document.createElement('div');
    div.className = 'elfsight-app-856019a4-b468-4aa8-9d7c-ee22b1e0b532';
    div.setAttribute('data-elfsight-app-lazy', '');

    // Append them to the container
    this.elfsightWidgetContainer.nativeElement.appendChild(script);
    this.elfsightWidgetContainer.nativeElement.appendChild(div);
  }

  ngOnInit(): void {
    // Use takeUntil to automatically unsubscribe
    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe(params => {
      const slug = params.get('slug');
      if (slug) {
        this.fetchProductBySlug(slug);
      } else {
        this.router.navigate(['/products']);
      }
    });
  }

  fetchProductBySlug(slug: string): void {
    // Use takeUntil for the product subscription as well
    this.productService.getProductBySlug(slug).pipe(takeUntil(this.destroy$)).subscribe({
      next: (data: Product | null) => {
        if (data) {
          this.product = {
            ...data,
            images: data.images || [],  // Ensure images is an array
            reviews: data.reviews || [] // Ensure reviews is an array
          };
          this.quickViewQuantities[this.product.id] = 1;
          setTimeout(() => this.initializeMagnificPopup(), 100);

        } else {
          this.router.navigate(['/404']);
        }
      },
      error: (error) => {
        console.error('Error fetching product by slug:', error);
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

  // Adjusted getStarArray to include full stars for average rating display
  getStarArray(rating: number): boolean[] {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(i <= Math.round(rating)); // Round for display
    }
    return stars;
  }

  ngOnDestroy(): void {
    // Unsubscribe using destroy$
    this.destroy$.next();
    this.destroy$.complete();
    // Destroy Magnific Popup
    if ($('#lightgallery').data('magnificPopup')) {
      $('#lightgallery').magnificPopup('destroy');
    }

    const elfsightScript = this.elfsightWidgetContainer.nativeElement.querySelector('script[src*="elfsight.com/platform"]');
    if (elfsightScript) {
      elfsightScript.remove();
    }
    const elfsightDiv = this.elfsightWidgetContainer.nativeElement.querySelector('.elfsight-app-856019a4-b468-4aa8-9d7c-ee22b1e0b532');
    if (elfsightDiv) {
      elfsightDiv.remove();
    }

  }

  getSanitizedDescription(): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(this.product?.description || '');
  }

  // --- New Review Submission Logic ---

  // Method to set the rating when a star is clicked
  setRating(rating: number): void {
    this.selectedRating = rating;
    this.reviewForm.patchValue({ rating: rating }); // Update the form control value
    // Mark as touched to trigger validation if needed immediately
    this.reviewForm.controls['rating'].markAsTouched();
  }

  // Method to handle review form submission
  submitReview(): void {
    // Mark all fields as touched to show validation errors instantly
    this.reviewForm.markAllAsTouched();

    if (this.reviewForm.valid && this.product?.id) { // Ensure product and its ID exist
      this.reviewSubmissionMessage = ''; // Clear previous messages

      const reviewData: { product_id: number; customer_name: string; rating: number; comment: string } = {
        product_id: this.product.id,
        customer_name: this.reviewForm.value.customer_name,
        rating: this.reviewForm.value.rating,
        comment: this.reviewForm.value.comment
      };

      this.productService.submitProductReview(reviewData).pipe(takeUntil(this.destroy$)).subscribe(
        (newReview: Review | null) => {
          if (newReview) {
            this.reviewSubmissionMessage = 'Thank you for your review!';
            this.reviewForm.reset({ rating: 0 }); // Reset form fields, reset rating to 0
            this.selectedRating = 0; // Reset visual stars

            // Add new review to existing array to update UI immediately
            if (this.product && this.product.reviews) {
              this.product.reviews.unshift(newReview); // Add to the beginning
            } else if (this.product) {
              this.product.reviews = [newReview]; // Initialize if no reviews existed
            }
          } else {
            this.reviewSubmissionMessage = 'Failed to submit review. Please try again.';
          }
        },
        error => {
          console.error('Review submission error:', error);
          this.reviewSubmissionMessage = 'An error occurred during submission. Please try again later.';
        }
      );
    } else {
      // Check if rating is the issue specifically
      if (this.reviewForm.controls['rating'].invalid && this.reviewForm.controls['rating'].touched) {
        this.reviewSubmissionMessage = 'Please select a rating (1-5 stars).';
      } else {
        this.reviewSubmissionMessage = 'Please fill in all required fields.';
      }
    }
  }
  // --- End New Review Submission Logic ---
}