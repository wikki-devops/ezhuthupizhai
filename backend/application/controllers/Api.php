<?php
defined('BASEPATH') or exit('No direct script access allowed');

// Import the Razorpay API class
use Razorpay\Api\Api as RazorpayApi;
use Razorpay\Api\Errors\SignatureVerificationError;


class Api extends CI_Controller
{
    private $razorpay_key_id;
    private $razorpay_key_secret;
    private $razorpay_api;

    public function __construct()
    {
        parent::__construct();
        $this->load->model('Product_model');
        $this->load->model('Coupon_model');
        $this->load->model('Order_model');
        $this->output->set_content_type('application/json');

        header("Access-Control-Allow-Origin: *");
        header("Access-Control-Allow-Methods: GET, POST, OPTIONS, PUT, DELETE");
        header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

        if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
            http_response_code(200);
            exit();
        }
    }

    /**
     * Endpoint to get all products for the main list view.
     * Includes thumbnail image, formatted prices, AND REVIEWS.
     * URL: http://your_ci_app_url/api/products
     */
    public function products()
    {
        $products = $this->Product_model->get_all_products();

        foreach ($products as $product) {
            // Fetch the primary thumbnail image for the list view
            $thumbnail_images = $this->Product_model->get_product_images($product->id, true);
            $product->thumbnail_image = !empty($thumbnail_images) ? $thumbnail_images[0]->image_url : 'https://placehold.co/500x500'; // Default placeholder

            $product->categories = explode(',', $product->categories);
            $product->categories = array_map('trim', $product->categories);

            $product->mrp_price = number_format((float)$product->mrp_price, 2, '.', '');
            $product->special_price = number_format((float)$product->special_price, 2, '.', '');

            // >>> CRUCIAL ADDITION: Fetch and assign reviews for each product <<<
            $product->reviews = $this->Product_model->get_product_reviews($product->id);
        }

        echo json_encode(['status' => 'success', 'data' => $products]);
    }

    /**
     * Endpoint to get details for a single product (for Quick View).
     * Includes all images and reviews.
     * URL: http://your_ci_app_url/api/product_detail/:id
     * @param int $id The product ID.
     */
    public function product_detail($id)
    {
        $product = $this->Product_model->get_product_by_id($id);

        if ($product) {
            $product->images = $this->Product_model->get_product_images($id); // All images
            $product->reviews = $this->Product_model->get_product_reviews($id); // All reviews (already present)

            // Ensure price formatting
            $product->mrp_price = number_format((float)$product->mrp_price, 2, '.', '');
            $product->special_price = number_format((float)$product->special_price, 2, '.', '');

            // For image URLs, prepend base_url if they are relative paths
            foreach ($product->images as $image) {
                // If your images are stored relative to CI base_url, uncomment/adjust this:
                // $image->image_url = base_url($image->image_url);
            }

            echo json_encode(['status' => 'success', 'data' => $product]);
        } else {
            echo json_encode(['status' => 'error', 'message' => 'Product not found']);
        }
    }

    public function categories()
    {
        $categories = $this->Product_model->get_all_categories();
        echo json_encode(['status' => 'success', 'data' => $categories]);
    }
    public function slug($slug)
    {
        $product = $this->Product_model->getProductBySlug($slug); // Call a method in your model

        if ($product) {
            echo json_encode($product);
        } else {
            http_response_code(404); // Not Found
            echo json_encode(['message' => 'Product not found.']);
        }
    }
    public function get_all_coupons()
    {
        $coupons = $this->Coupon_model->get_all_coupons();

        // Process data for Angular (e.g., convert expiry_date to ISO string, parse customer IDs)
        $processed_coupons = array_map(function ($coupon) {
            if (isset($coupon->expiry_date) && !empty($coupon->expiry_date)) {
                $coupon->expiry_date = (new DateTime($coupon->expiry_date))->format(DateTime::ISO8601);
            } else {
                $coupon->expiry_date = null; // Ensure null if empty
            }

            // Convert comma-separated string to array for Angular
            if (isset($coupon->allowed_customer_ids) && !empty($coupon->allowed_customer_ids)) {
                $coupon->allowed_customer_ids = array_map('intval', explode(',', $coupon->allowed_customer_ids));
            } else {
                $coupon->allowed_customer_ids = [];
            }
            return $coupon;
        }, $coupons);

        $this->output->set_output(json_encode($processed_coupons));
    }

    /**
     * Endpoint to get a specific coupon by code (less used if getAll is preferred)
     */
    public function get_coupon($coupon_code)
    {

        $coupon = $this->Coupon_model->get_coupon_by_code($coupon_code);

        if ($coupon) {
            if (isset($coupon->expiry_date) && !empty($coupon->expiry_date)) {
                $coupon->expiry_date = (new DateTime($coupon->expiry_date))->format(DateTime::ISO8601);
            } else {
                $coupon->expiry_date = null;
            }
            if (isset($coupon->allowed_customer_ids) && !empty($coupon->allowed_customer_ids)) {
                $coupon->allowed_customer_ids = array_map('intval', explode(',', $coupon->allowed_customer_ids));
            } else {
                $coupon->allowed_customer_ids = [];
            }
            $this->output->set_output(json_encode($coupon));
        } else {
            http_response_code(404);
            $this->output->set_output(json_encode(['message' => 'Coupon not found.']));
        }
    }
    public function create_razorpay_order()
    {
        // *** The ob_start() line we added for debugging ***
        ob_start();

        $this->config->load('razorpay', TRUE); // The TRUE makes it load into a named index 'razorpay'

        // Retrieve keys from the loaded config
        $this->razorpay_key_id = $this->config->item('razorpay_key_id', 'razorpay');
        $this->razorpay_key_secret = $this->config->item('razorpay_key_secret', 'razorpay');
        log_message('debug', 'DEBUG: Razorpay Key ID read: ' . $this->razorpay_key_id);
        log_message('debug', 'DEBUG: Razorpay Key Secret read: ' . $this->razorpay_key_secret);

        if (empty($this->razorpay_key_id) || empty($this->razorpay_key_secret)) {
            log_message('error', 'Razorpay API keys are not configured in application/config/razorpay.php. Payment methods might fail.');
            return;
        } else {
            $this->razorpay_api = new RazorpayApi($this->razorpay_key_id, $this->razorpay_key_secret);
        }

        // Ensure $this->razorpay_api is initialized from the constructor.
        if (!$this->razorpay_api) {
            log_message('error', 'Razorpay API is not initialized. Check API key configuration.');
            $this->output
                ->set_status_header(500)
                ->set_output(json_encode(['success' => false, 'message' => 'Payment gateway not configured correctly.']))
                ->_display();
            exit;
        }

        // Ensure it's a POST request
        if ($this->input->method() !== 'post') {
            $this->output
                ->set_status_header(405) // Method Not Allowed
                ->set_output(json_encode(['success' => false, 'message' => 'Method not allowed.']))
                ->_display();
            exit;
        }

        // Get raw POST data from Angular
        $input_data = json_decode(file_get_contents('php://input'), true);

        if (!isset($input_data['items']) || !is_array($input_data['items'])) {
            $this->output
                ->set_status_header(400) // Bad Request
                ->set_output(json_encode(['success' => false, 'message' => 'Invalid or missing cart items.']))
                ->_display();
            exit;
        }

        $cartItems = $input_data['items'];
        $appliedCoupons = isset($input_data['appliedCoupons']) ? $input_data['appliedCoupons'] : [];
        $calculatedAmount = 0;
        $currency = 'INR';

        try {
            // Step 1: Calculate base amount from cart items
            foreach ($cartItems as $item) {
                $productId = $item['product']['id'];
                $quantity = $item['quantity'];

                $productDb = $this->Product_model->get_product_by_id($productId);

                if (!$productDb) {
                    $this->output
                        ->set_status_header(404)
                        ->set_output(json_encode(['success' => false, 'message' => 'Product not found: ' . $item['product']['name']]))
                        ->_display();
                    exit;
                }

                $productPrice = (float)$productDb->special_price;
                $calculatedAmount += ($productPrice * $quantity);
            }

            // Step 2: Apply coupons server-side
            foreach ($appliedCoupons as $coupon) {
                $couponCode = $coupon['coupon_code'];
                $couponDb = $this->Coupon_model->get_coupon_by_code($couponCode);

                if ($couponDb && $couponDb->is_active == 1) {
                    $current_time = new DateTime();
                    if (isset($couponDb->expiry_date) && !empty($couponDb->expiry_date)) {
                        $expiry_date = new DateTime($couponDb->expiry_date);
                        if ($current_time > $expiry_date) {
                            log_message('info', 'Coupon ' . $couponCode . ' expired.');
                            continue;
                        }
                    }

                    if (isset($couponDb->min_cart_value) && (float)$couponDb->min_cart_value > 0 && $calculatedAmount < (float)$couponDb->min_cart_value) {
                        log_message('info', 'Coupon ' . $couponCode . ' min cart value not met.');
                        continue;
                    }

                    if ($couponDb->discount_type === 'percentage') {
                        $discount = $calculatedAmount * ((float)$couponDb->discount_value / 100);
                        $calculatedAmount -= $discount;
                    } elseif ($couponDb->discount_type === 'fixed') {
                        $calculatedAmount -= (float)$couponDb->discount_value;
                    }
                    $calculatedAmount = max(0, $calculatedAmount);

                    if ($couponCode === 'EPSPECIAL' && isset($couponDb->discount_type) && $couponDb->discount_type === 'product_discount') {
                        $calculatedAmount -= (float)$couponDb->discount_value;
                        $calculatedAmount = max(0, $calculatedAmount);
                    }
                }
            }

            $amountInPaisa = round($calculatedAmount * 100);
            if ($amountInPaisa <= 0) {
                $amountInPaisa = 100;
            }

            $orderData = [
                'receipt'         => 'rcptid_' . uniqid(),
                'amount'          => $amountInPaisa,
                'currency'        => $currency,
                'payment_capture' => 1
            ];

            $razorpayOrder = $this->razorpay_api->order->create($orderData);

            // *** THIS IS THE PROBLEM AREA ***
            // You had some debugging here or another echo.

            // Capture any unwanted output and log it (from our debugging)
            $unwanted_output = ob_get_clean(); // This is the line that captures the *first* JSON output
            if (!empty($unwanted_output)) {
                log_message('error', 'Unwanted output detected before JSON: ' . $unwanted_output);
            }

            // This is your intended, correct output
            $this->output
                ->set_status_header(200)
                ->set_output(json_encode([
                    'success' => true,
                    'order_id' => $razorpayOrder['id'],
                    'amount' => $razorpayOrder['amount'],
                    'currency' => $razorpayOrder['currency']
                ]))
                ->_display();
            exit; // Ensure nothing else runs after this
        } catch (Exception $e) {
            log_message('error', 'Error creating Razorpay order: ' . $e->getMessage());
            // Capture any unwanted output even on error
            $unwanted_output = ob_get_clean();
            if (!empty($unwanted_output)) {
                log_message('error', 'Unwanted output detected on error path: ' . $unwanted_output);
            }
            $this->output
                ->set_status_header(500)
                ->set_output(json_encode(['success' => false, 'message' => 'Failed to create Razorpay order: ' . $e->getMessage()]))
                ->_display();
            exit;
        }
    }

    /**
     * Endpoint to verify Razorpay payment signature.
     * Accessible via: your_ci_app_url/api/razorpay_payment_success
     * This method receives the payment response from the frontend and verifies its authenticity.
     */
    public function razorpay_payment_success()
    {
        // Ensure it's a POST request
        if ($this->input->method() !== 'post') {
            $this->output
                ->set_status_header(405)
                ->set_output(json_encode(['success' => false, 'message' => 'Method not allowed.']))
                ->_display();
            exit;
        }

        $input_data = json_decode(file_get_contents('php://input'), true);

        if (!isset($input_data['razorpay_order_id']) || !isset($input_data['razorpay_payment_id']) || !isset($input_data['razorpay_signature'])) {
            $this->output
                ->set_status_header(400)
                ->set_output(json_encode(['success' => false, 'message' => 'Missing payment details.']))
                ->_display();
            exit;
        }

        $razorpay_order_id = $input_data['razorpay_order_id'];
        $razorpay_payment_id = $input_data['razorpay_payment_id'];
        $razorpay_signature = $input_data['razorpay_signature'];

        try {
            // Verify the payment signature using Razorpay SDK utility
            $attributes = array(
                'razorpay_order_id' => $razorpay_order_id,
                'razorpay_payment_id' => $razorpay_payment_id,
                'razorpay_signature' => $razorpay_signature
            );

            $this->razorpay_api->utility->verifyPaymentSignature($attributes);

            // If verification is successful, update your order status in the database
            // This is where you would interact with your Order_model.
            // Example:
            $success = $this->Order_model->update_order_status($razorpay_order_id, 'paid', $razorpay_payment_id);

            if ($success) {
                // Optionally: Clear user's cart (if cart is server-side or tied to session/user)
                // $this->load->library('cart_library'); // If you have a CI cart library
                // $this->cart_library->clear_user_cart();

                $this->output
                    ->set_status_header(200)
                    ->set_output(json_encode(['success' => true, 'message' => 'Payment successfully verified!', 'orderId' => $razorpay_order_id]))
                    ->_display();
            } else {
                // This indicates an issue updating your internal order status, even if Razorpay verified.
                // Log this as a critical error.
                log_message('error', 'Razorpay payment verified, but failed to update internal order status for Order ID: ' . $razorpay_order_id);
                $this->output
                    ->set_status_header(500)
                    ->set_output(json_encode(['success' => false, 'message' => 'Payment verified, but internal order update failed. Please contact support.']))
                    ->_display();
            }
        } catch (SignatureVerificationError $e) {
            // This is a critical security failure, indicates tampering or incorrect keys
            log_message('error', 'Razorpay Signature Verification Failed: ' . $e->getMessage() . ' For Order ID: ' . $razorpay_order_id);
            $this->output
                ->set_status_header(400) // Bad Request
                ->set_output(json_encode(['success' => false, 'message' => 'Payment verification failed: Invalid signature.']))
                ->_display();
        } catch (Exception $e) {
            log_message('error', 'An unexpected error occurred during payment verification: ' . $e->getMessage() . ' For Order ID: ' . $razorpay_order_id);
            $this->output
                ->set_status_header(500)
                ->set_output(json_encode(['success' => false, 'message' => 'An internal server error occurred during verification.']))
                ->_display();
        }
    }
}
