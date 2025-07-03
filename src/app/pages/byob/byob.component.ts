import { Component, OnInit } from '@angular/core';
import { ByobService } from 'src/app/services/byob.service';
import { Router } from '@angular/router';
import { CartService } from 'src/app/services/cart.service.ts.service';
import { Product } from 'src/app/models/product.model';


@Component({
  selector: 'app-byob',
  templateUrl: './byob.component.html',
  styleUrls: ['./byob.component.css']
})
export class ByobComponent implements OnInit {
  isLoading: boolean = false;
  selectableBooks: any[] = [];
  selectableItems: any[] = [];

  selectedBooks: any[] = [];
  selectedItems: any[] = [];

  byobBoxId: number | null = null;
  currentByobBox: any;

  boxMessage: string = '';
  showSuccessMessage: boolean = false;

  constructor(
    private byobService: ByobService,
    private router: Router,
    private cartService: CartService
  ) { }

  ngOnInit(): void {
    this.createOrLoadByobBox();
    this.loadAvailableItems();
  }

  loadAvailableItems(): void {
    this.isLoading = true;
    this.byobService.getAvailableItems().subscribe({
      next: (res) => {
        if (res.status && res.data) {
          this.selectableBooks = res.data.filter((item: any) => parseFloat(item.mrp_price) >= 300);
          this.selectableItems = res.data.filter((item: any) => parseFloat(item.mrp_price) < 300);

          this.selectableBooks.forEach(book => book.selected = false);
          this.selectableItems.forEach(item => item.selected = false);

          if (this.currentByobBox && this.currentByobBox.items) {
            this.repopulateSelectedItems(this.currentByobBox.items);
          }

        } else {
          this.boxMessage = res.message || 'Failed to load available items.';
          this.showSuccessMessage = false;
        }
        this.isLoading = false;
      },
      error: (err) => {
        this.boxMessage = 'Error loading available items. Please try again later.';
        this.showSuccessMessage = false;
        this.isLoading = false;
      }
    });
  }

  createOrLoadByobBox(): void {
    const savedBoxId = localStorage.getItem('byob_box_id');
    if (savedBoxId) {
      this.byobBoxId = +savedBoxId;
      this.byobService.getByobBox(this.byobBoxId).subscribe({
        next: (res) => {
          if (res.status && res.data) {
            this.currentByobBox = res.data;
            this.repopulateSelectedItems(res.data.items);
            this.boxMessage = 'Loaded your existing custom box.';
            this.showSuccessMessage = true;
          } else {
            this.createNewByobBox();
          }
        },
        error: (err) => {
          this.createNewByobBox();
        }
      });
    } else {
      this.createNewByobBox();
    }
  }

  createNewByobBox(): void {
    this.isLoading = true;
    this.byobService.createByobBox().subscribe({
      next: (res) => {
        if (res.status && res.data) {
          this.currentByobBox = res.data;
          this.byobBoxId = res.data.id;
          localStorage.setItem('byob_box_id', this.byobBoxId!.toString());
          this.boxMessage = 'Your custom gift box is ready to be built!';
          this.showSuccessMessage = true;
        } else {
          this.boxMessage = res.message || 'Failed to create BYOB box.';
          this.showSuccessMessage = false;
        }
        this.isLoading = false;
      },
      error: (err) => {
        this.boxMessage = 'Error creating BYOB box. Please try again.';
        this.showSuccessMessage = false;
        this.isLoading = false;
      }
    });
  }

  repopulateSelectedItems(itemsInBox: any[]): void {
    if (!itemsInBox) return;

    this.selectedBooks = [];
    this.selectedItems = [];

    this.selectableBooks.forEach(book => {
      book.selected = itemsInBox.some(boxItem => boxItem.product_id === book.id);
      if (book.selected) {
        this.selectedBooks.push(book);
      }
    });

    this.selectableItems.forEach(item => {
      item.selected = itemsInBox.some(boxItem => boxItem.product_id === item.id);
      if (item.selected) {
        this.selectedItems.push(item);
      }
    });
  }

  toggleBookSelection(book: any): void {
    if (!this.byobBoxId) {
      this.boxMessage = 'Please wait, initializing your custom box...';
      this.showSuccessMessage = false;
      return;
    }

    const wasSelected = book.selected;
    book.selected = !book.selected;

    this.isLoading = true;
    this.boxMessage = '';

    if (book.selected) {
      this.byobService.addItemToBox(this.byobBoxId, book.id).subscribe({
        next: (res) => {
          if (res.status) {
            this.selectedBooks.push(book);
            this.boxMessage = `${book.name} added to your box.`;
            this.showSuccessMessage = true;
          } else {
            book.selected = wasSelected;
            this.boxMessage = res.message || `Failed to add ${book.name}.`;
            this.showSuccessMessage = false;
          }
          this.isLoading = false;
        },
        error: (err) => {
          book.selected = wasSelected;
          this.boxMessage = `Error adding ${book.name}.`;
          this.showSuccessMessage = false;
          this.isLoading = false;
        }
      });
    } else {
      this.byobService.removeItemFromBox(this.byobBoxId, book.id).subscribe({
        next: (res) => {
          if (res.status) {
            this.selectedBooks = this.selectedBooks.filter(b => b.id !== book.id);
            this.boxMessage = `${book.name} removed from your box.`;
            this.showSuccessMessage = true;
          } else {
            book.selected = wasSelected;
            this.boxMessage = res.message || `Failed to remove ${book.name}.`;
            this.showSuccessMessage = false;
          }
          this.isLoading = false;
        },
        error: (err) => {
          book.selected = wasSelected;
          this.boxMessage = `Error removing ${book.name}.`;
          this.showSuccessMessage = false;
          this.isLoading = false;
        }
      });
    }
  }

  toggleItemSelection(item: any): void {
    if (!this.byobBoxId) {
      this.boxMessage = 'Please wait, initializing your custom box...';
      this.showSuccessMessage = false;
      return;
    }

    const wasSelected = item.selected;
    item.selected = !item.selected;
    this.isLoading = true;
    this.boxMessage = '';

    if (item.selected) {
      this.byobService.addItemToBox(this.byobBoxId, item.id).subscribe({
        next: (res) => {
          if (res.status) {
            this.selectedItems.push(item);
            this.boxMessage = `${item.name} added to your box.`;
            this.showSuccessMessage = true;
          } else {
            item.selected = wasSelected;
            this.boxMessage = res.message || `Failed to add ${item.name}.`;
            this.showSuccessMessage = false;
          }
          this.isLoading = false;
        },
        error: (err) => {
          item.selected = wasSelected;
          this.boxMessage = `Error adding ${item.name}.`;
          this.showSuccessMessage = false;
          this.isLoading = false;
        }
      });
    } else {
      this.byobService.removeItemFromBox(this.byobBoxId, item.id).subscribe({
        next: (res) => {
          if (res.status) {
            this.selectedItems = this.selectedItems.filter(i => i.id !== item.id);
            this.boxMessage = `${item.name} removed from your box.`;
            this.showSuccessMessage = true;
          } else {
            item.selected = wasSelected;
            this.boxMessage = res.message || `Failed to remove ${item.name}.`;
            this.showSuccessMessage = false;
          }
          this.isLoading = false;
        },
        error: (err) => {
          item.selected = wasSelected;
          this.boxMessage = `Error removing ${item.name}.`;
          this.showSuccessMessage = false;
          this.isLoading = false;
        }
      });
    }
  }

  removeSelectedItem(itemToRemove: any, type: 'book' | 'item'): void {
    if (!this.byobBoxId) return;

    this.isLoading = true;
    this.boxMessage = '';

    this.byobService.removeItemFromBox(this.byobBoxId, itemToRemove.id).subscribe({
      next: (res) => {
        if (res.status) {
          if (type === 'book') {
            this.selectedBooks = this.selectedBooks.filter(b => b.id !== itemToRemove.id);
            const bookInSelectable = this.selectableBooks.find(b => b.id === itemToRemove.id);
            if (bookInSelectable) bookInSelectable.selected = false;
          } else {
            this.selectedItems = this.selectedItems.filter(i => i.id !== itemToRemove.id);
            const itemInSelectable = this.selectableItems.find(i => i.id === itemToRemove.id);
            if (itemInSelectable) itemInSelectable.selected = false;
          }
          this.boxMessage = `${itemToRemove.name} removed from your box.`;
          this.showSuccessMessage = true;
        } else {
          this.boxMessage = res.message || `Failed to remove ${itemToRemove.name}.`;
          this.showSuccessMessage = false;
        }
        this.isLoading = false;
      },
      error: (err) => {
        this.boxMessage = `Error removing ${itemToRemove.name}.`;
        this.showSuccessMessage = false;
        this.isLoading = false;
      }
    });
  }

  get totalPrice(): number {
    let total = 0;
    this.selectedBooks.forEach(book => total += parseFloat(book.special_price || book.mrp_price || '0'));
    this.selectedItems.forEach(item => total += parseFloat(item.special_price || item.mrp_price || '0'));
    return total;
  }

  addToCart(): void {
    if ((this.selectedBooks.length === 0 && this.selectedItems.length === 0) || !this.byobBoxId) {
      this.boxMessage = 'Please select items to build your box before adding to cart.';
      this.showSuccessMessage = false;
      return;
    }

    this.isLoading = true;
    this.boxMessage = '';

    const byobBoxName = 'BYOB Box';

    const selectedItemNames: string[] = [];
    this.selectedBooks.forEach(book => {
      selectedItemNames.push(book.name);
    });
    this.selectedItems.forEach(item => {
      selectedItemNames.push(item.name);
    });

    let byobBoxDescription = '';
    let itemCounter = 1;

    if (this.selectedBooks.length > 0 || this.selectedItems.length > 0) {
      byobBoxDescription += '\nUnder Selected Items:\n';
      this.selectedBooks.forEach(book => {
        byobBoxDescription += `${itemCounter}. ${book.name}\n`;
        itemCounter++;
      });
      this.selectedItems.forEach(item => {
        byobBoxDescription += `${itemCounter}. ${item.name}\n`;
        itemCounter++;
      });
    }

    const boxMrpPrice = this.totalPrice.toFixed(2);
    const boxSpecialPrice = this.totalPrice.toFixed(2);

    const byobProduct: Product = {
      id: -1 * this.byobBoxId!,
      name: byobBoxName,
      short_description: 'A custom build-your-own-box.',
      description: byobBoxDescription,
      mrp_price: boxMrpPrice,
      special_price: boxSpecialPrice,
      thumbnail_image: 'https://placehold.co/500?text=byob',
      categories: ['BYOB'],
      tag: 'custom_box',
      images: [],
      reviews: [],
      options: {
        is_byob_box: true,
        byob_box_id: this.byobBoxId,
        selected_item_ids: [...this.selectedBooks.map(b => b.id), ...this.selectedItems.map(i => i.id)],
        selected_item_names: selectedItemNames
      }
    };

    this.cartService.addToCart(byobProduct, 1);

    this.boxMessage = 'Your custom BYOB Box has been added to the cart successfully!';
    this.showSuccessMessage = true;

    localStorage.removeItem('byob_box_id');
    this.byobBoxId = null;

    this.selectedBooks = [];
    this.selectedItems = [];
    this.selectableBooks.forEach(b => b.selected = false);
    this.selectableItems.forEach(i => i.selected = false);

    this.createNewByobBox();

    this.isLoading = false;
  }
}