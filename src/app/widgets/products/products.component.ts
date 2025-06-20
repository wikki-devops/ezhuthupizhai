import { Component, OnInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { ProductServiceTsService } from 'src/app/services/product.service.ts.service';
import { Product } from 'src/app/models/product.model';
import { Review } from 'src/app/models/review.model'; // Keep Review model for calculating average rating for each product
import { Subscription } from 'rxjs';

// Swiper will now ideally auto-initialize on the individual modal elements
// We no longer explicitly control its lifecycle in TypeScript for the quick view.
// If your Swiper setup requires manual initialization, you might need a different strategy.
// For many themes, just including the Swiper JS library and having the correct HTML structure
// (like `swiper quick-modal-swiper2`) is enough for auto-init.
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

  private productsSubscription: Subscription | undefined;
  private categoriesSubscription: Subscription | undefined;

  constructor(private productService: ProductServiceTsService) { }

  ngOnInit(): void {
    this.fetchCategories();
    this.fetchProducts();
  }

  fetchProducts(): void {
    this.productsSubscription = this.productService.getProducts().subscribe({
      next: (products) => {
        this.allProducts = products;
        this.filterProducts(this.activeFilter);
      },
      error: (err) => {
        console.error('Error fetching products:', err);
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

  ngOnDestroy(): void {
    if (this.productsSubscription) {
      this.productsSubscription.unsubscribe();
    }
    if (this.categoriesSubscription) {
      this.categoriesSubscription.unsubscribe();
    }
  }
}