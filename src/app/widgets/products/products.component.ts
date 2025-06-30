import { Component, OnInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { ProductServiceTsService } from 'src/app/services/product.service.ts.service';
import { CartService } from 'src/app/services/cart.service.ts.service';

import { Product } from 'src/app/models/product.model';
import { Review } from 'src/app/models/review.model';
import { Subscription } from 'rxjs';

declare const Swiper: any;

@Component({
  selector: 'app-products',
  templateUrl: './products.component.html',
  styleUrls: ['./products.component.css']
})
export class ProductsComponent implements OnInit, OnDestroy {
  allProducts: Product[] = [];
  filteredProducts: Product[] = [];
  categories: string[] = [];
  activeFilter: string = 'ALL';
  quickViewQuantities: { [productId: number]: number } = {};
  private productsSubscription: Subscription | undefined;
  private categoriesSubscription: Subscription | undefined;

  constructor(private productService: ProductServiceTsService, private cartService: CartService) { } // Renamed injected CartService to 'cartService' for consistency

  ngOnInit(): void {
    this.fetchCategories();
    this.fetchProducts();
  }

  fetchProducts(): void {
    this.productsSubscription = this.productService.getProducts().subscribe({
      next: (products) => {
        this.allProducts = products;
        this.filterProducts(this.activeFilter);
        // Initialize quick view quantities for all products when fetched
        this.allProducts.forEach(product => {
          this.quickViewQuantities[product.id] = 1; // Default quick view quantity to 1
          console.log(`[ProductsComponent] Product name: "${product.name}", Generated Slug for URL: "${this.slugify(product.name)}"`);
        });
      },
      error: (err) => {
        console.error('[ProductsComponent] Error fetching products:', err);
      }
    });
  }

  fetchCategories(): void {
    this.categoriesSubscription = this.productService.getCategories().subscribe({
      next: (categories) => {
        this.categories = ['ALL', ...categories.filter(cat => cat !== 'ALL')];
      },
      error: (err) => {
        console.error('Error fetching categories:', err);
      }
    });
  }

  filterProducts(category: string): void {
    this.activeFilter = category;
    if (category === 'ALL') {
      this.filteredProducts = [...this.allProducts];
    } else {
      this.filteredProducts = this.allProducts.filter(product =>
        product.categories.includes(category)
      );
    }
  }

  calculateProductAverageRating(reviews: Review[]): number {
    if (!reviews || reviews.length === 0) {
      return 0;
    }
    const total = reviews.reduce((sum, review) => sum + Number(review.rating), 0);
    return total / reviews.length;
  }

  getStarArray(rating: number): boolean[] {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(i <= Math.floor(rating));
    }
    return stars;
  }

  getDiscountPercentage(mrp: string, special: string): number {
    const mrpNum = parseFloat(mrp);
    const specialNum = parseFloat(special);

    if (mrpNum > 0 && mrpNum !== specialNum) {
      return ((1 - (specialNum / mrpNum)) * 100);
    }
    return 0;
  }

  getQuickViewQuantity(productId: number): number {
    if (!this.quickViewQuantities[productId] || this.quickViewQuantities[productId] < 1) {
      this.quickViewQuantities[productId] = 1;
    }
    console.log(`[getQuickViewQuantity] Product ID: ${productId}, Returning quantity: ${this.quickViewQuantities[productId]}`);
    return this.quickViewQuantities[productId];
  }

  onQuickViewQuantityChange(productId: number, event: Event): void {
    const inputElement = event.target as HTMLInputElement;
    let newQuantity = Number(inputElement.value);

    if (isNaN(newQuantity) || newQuantity < 1) {
      newQuantity = 1;
    }
    this.quickViewQuantities[productId] = newQuantity;
    console.log(`[onQuickViewQuantityChange] Product ID: ${productId}, New quantity set to: ${this.quickViewQuantities[productId]}`);
  } incrementQuickViewQuantity(product: Product): void {
    const currentQuantity = this.getQuickViewQuantity(product.id);
    this.quickViewQuantities[product.id] = currentQuantity + 1;
    console.log(`[incrementQuickViewQuantity] Product ID: ${product.id}, New quantity after increment: ${this.quickViewQuantities[product.id]}`);
  }

  // Decrements the quantity for a product in the quick view modal
  decrementQuickViewQuantity(product: Product): void {
    const currentQuantity = this.getQuickViewQuantity(product.id);
    if (currentQuantity > 1) {
      this.quickViewQuantities[product.id] = currentQuantity - 1;
      console.log(`[decrementQuickViewQuantity] Product ID: ${product.id}, New quantity after decrement: ${this.quickViewQuantities[product.id]}`);
    } else {
      console.log(`[decrementQuickViewQuantity] Product ID: ${product.id}, Quantity is 1, not decrementing further.`);
    }
  }

  // Updated: Add To Cart Method
  onAddToCart(product: Product, quantity: number = 1): void {
    console.log(`[onAddToCart] Received product: ${product.name}, Quantity: ${quantity}`);
    const quantityToAdd = Math.max(1, quantity); // Ensure at least 1 is added
    console.log(`[onAddToCart] Final quantity to add to cart: ${quantityToAdd}`);

    this.cartService.addToCart(product, quantityToAdd);
    console.log(`Added ${quantityToAdd} of ${product.name} to cart.`);

    // Optional: Reset the quick view quantity for this product back to 1 after adding to cart
    this.quickViewQuantities[product.id] = 1;
  }

  ngOnDestroy(): void {
    if (this.productsSubscription) {
      this.productsSubscription.unsubscribe();
    }
    if (this.categoriesSubscription) {
      this.categoriesSubscription.unsubscribe();
    }
  }
  slugify(text: string): string {
    if (!text) return '';
    return text.toString().toLowerCase()
      .replace(/\s+/g, '-')           // Replace spaces with -
      .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
      .replace(/\-\-+/g, '-')         // Replace multiple - with single -
      .replace(/^-+/, '')             // Trim - from start of text
      .replace(/-+$/, '');            // Trim - from end of text
  }

}