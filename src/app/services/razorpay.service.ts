// src/app/services/razorpay.service.ts

import { Injectable } from '@angular/core';

export interface RazorpayOptionsForService { // Make sure this is exported
  key: string;
  amount: string; // Amount in paisa, as a string
  currency: string;
  name: string;
  description: string;
  image?: string;
  order_id: string; // The order ID obtained from your backend
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  notes?: {
    [key: string]: string | undefined;
  };
  theme?: {
    color?: string;
  };
  display?: {
    blocks?: {
      contact: {
        name: string;
        fields: Array<'email' | 'contact'>;
      };
      address: {
        name: string;
        fields: Array<'name' | 'address_line_1' | 'address_line_2' | 'pincode' | 'city' | 'state' | 'country'>;
      };
      payment?: {
        name: string;
      };
    };
  };
  checkout?: {};
  handler?: (response: any) => void;
  modal?: {
    ondismiss?: () => void;
  };
}

declare const Razorpay: any;

@Injectable({
  providedIn: 'root'
})
export class RazorpayService {
  constructor() {
    this.loadRazorpayScript();
  }

  private loadRazorpayScript(): void {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => {
      console.log('Razorpay SDK loaded successfully');
    };
    script.onerror = (error) => {
      console.error('Error loading Razorpay SDK:', error);
    };
    document.body.appendChild(script);
  }

  open(options: RazorpayOptionsForService): void { // This needs the interface to be visible
    if (typeof Razorpay === 'undefined') {
      console.error('Razorpay SDK not loaded. Cannot open payment gateway.');
      return;
    }

    const defaultOptions: RazorpayOptionsForService = {
      ...options,
      handler: options.handler || ((response: any) => {
        console.log('Payment successful:', response);
        alert('Payment Successful! Payment ID: ' + response.razorpay_payment_id);
      }),
      modal: {
        ondismiss: options.modal?.ondismiss || (() => {
          console.log('Payment modal dismissed');
          alert('Payment was dismissed.');
        })
      }
    };

    const rzp = new Razorpay(defaultOptions);
    rzp.open();
  }
}