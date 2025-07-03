// footer.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { ProductServiceTsService } from 'src/app/services/product.service.ts.service';
import { Product } from 'src/app/models/product.model';
import { Review } from 'src/app/models/review.model'; // <--- ADD THIS IMPORT
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-footer',
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.css']
})
export class FooterComponent implements OnInit, OnDestroy {
  email: string = 'mano@ezhuthupizhai.in';
  footerProducts: Product[] = [];
  private productsSubscription: Subscription | undefined;

  constructor(private productService: ProductServiceTsService) { }

  ngOnInit(): void {
    this.productsSubscription = this.productService.getProducts().subscribe({
      next: (products: Product[]) => {
        if (products && products.length > 0) {
          const productsCopy = [...products];
          const shuffledProducts = this.shuffleArray(productsCopy);
          this.footerProducts = shuffledProducts.slice(0, 3); // Showing 3 products
        } else {
          this.footerProducts = [];
        }
      },
      error: (error) => {
        console.error('Error fetching products for footer:', error);
        this.footerProducts = [];
      }
    });
  }

  ngOnDestroy(): void {
    if (this.productsSubscription) {
      this.productsSubscription.unsubscribe();
    }
  }

  // Helper functions for rating calculation (transferred from ProductsComponent)
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

  // Helper function for slugifying, for product links
  slugify(text: string): string {
    if (!text) return '';
    return text.toString().toLowerCase()
      .replace(/\s+/g, '-')           // Replace spaces with -
      .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
      .replace(/\-\-+/g, '-')         // Replace multiple - with single -
      .replace(/^-+/, '')             // Trim - from start of text
      .replace(/-+$/, '');            // Trim - from end of text
  }

  // Helper function to shuffle array
  private shuffleArray(array: any[]): any[] {
    let currentIndex = array.length, randomIndex;
    while (currentIndex !== 0) {
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex--;
      [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }
    return array;
  }
}