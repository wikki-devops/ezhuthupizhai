<?php
defined('BASEPATH') OR exit('No direct script access allowed');

class Api extends CI_Controller {

    public function __construct()
    {
        parent::__construct();
        $this->load->model('Product_model');
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
}