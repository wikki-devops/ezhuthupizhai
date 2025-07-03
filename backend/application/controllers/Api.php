<?php
defined('BASEPATH') or exit('No direct script access allowed');

class Api extends CI_Controller
{
    public function __construct()
    {
        parent::__construct();
        $this->load->model('Shop_model');
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

    public function products()
    {
        $products = $this->Shop_model->get_all_products();

        foreach ($products as $product) {
            $thumbnail_images = $this->Shop_model->get_product_images($product->id, true);
            $product->thumbnail_image = !empty($thumbnail_images) ? $thumbnail_images[0]->image_url : 'https://placehold.co/500x500';

            $product->categories = explode(',', $product->categories);
            $product->categories = array_map('trim', $product->categories);

            $product->mrp_price = number_format((float)$product->mrp_price, 2, '.', '');
            $product->special_price = number_format((float)$product->special_price, 2, '.', '');

            $product->reviews = $this->Shop_model->get_product_reviews($product->id);
        }

        echo json_encode(['status' => 'success', 'data' => $products]);
    }

    public function product_detail($id)
    {
        $product = $this->Shop_model->get_product_by_id($id);

        if ($product) {
            $product->images = $this->Shop_model->get_product_images($id);
            $product->reviews = $this->Shop_model->get_product_reviews($id);

            $product->mrp_price = number_format((float)$product->mrp_price, 2, '.', '');
            $product->special_price = number_format((float)$product->special_price, 2, '.', '');

            foreach ($product->images as $image) {
                // $image->image_url = base_url($image->image_url);
            }

            echo json_encode(['status' => 'success', 'data' => $product]);
        } else {
            echo json_encode(['status' => 'error', 'message' => 'Product not found']);
        }
    }

    public function categories()
    {
        $categories = $this->Shop_model->get_all_categories();
        echo json_encode(['status' => 'success', 'data' => $categories]);
    }

    public function slug($slug)
    {
        $product = $this->Shop_model->getProductBySlug($slug);

        if ($product) {
            echo json_encode($product);
        } else {
            http_response_code(404);
            echo json_encode(['message' => 'Product not found.']);
        }
    }

    public function get_all_coupons()
    {
        $coupons = $this->Shop_model->get_all_coupons();

        $processed_coupons = array_map(function ($coupon) {
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
            return $coupon;
        }, $coupons);

        $this->output->set_output(json_encode($processed_coupons));
    }

    public function get_coupon($coupon_code)
    {
        $coupon = $this->Shop_model->get_coupon_by_code($coupon_code);

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
}
