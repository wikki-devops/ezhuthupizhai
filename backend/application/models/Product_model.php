<?php
defined('BASEPATH') or exit('No direct script access allowed');

class Product_model extends CI_Model
{

    public function __construct()
    {
        parent::__construct();
        $this->load->database();
    }

    public function get_all_products()
    {
        // Select all columns from products
        $query = $this->db->get('products');
        return $query->result();
    }

    /**
     * Get a single product by ID, potentially with its main thumbnail image.
     * @param int $product_id
     * @return object|null A single product object or null if not found.
     */
    public function get_product_by_id($product_id)
    {
        $this->db->where('id', $product_id);
        $query = $this->db->get('products');
        $product = $query->row(); // Get a single row

        if ($product) {
            // Fetch the primary thumbnail image for the product list view
            $thumbnail_image = $this->get_product_images($product_id, true);
            $product->thumbnail_image = !empty($thumbnail_image) ? $thumbnail_image[0]->image_url : null;
        }

        return $product;
    }

    /**
     * Get images for a specific product.
     * @param int $product_id
     * @param bool $is_thumbnail_only If true, only fetch the thumbnail image.
     * @return array An array of image objects.
     */
    public function get_product_images($product_id, $is_thumbnail_only = false)
    {
        $this->db->where('product_id', $product_id);
        if ($is_thumbnail_only) {
            $this->db->where('is_thumbnail', 1);
        }
        $this->db->order_by('order_priority', 'ASC'); // Order by priority
        $query = $this->db->get('product_images');
        return $query->result();
    }

    /**
     * Get reviews for a specific product.
     * @param int $product_id
     * @return array An array of review objects.
     */
    public function get_product_reviews($product_id)
    {
        $this->db->where('product_id', $product_id);
        $query = $this->db->get('reviews');
        $reviews = $query->result();

        foreach ($reviews as $review) {
        }

        return $reviews;
    }

    public function get_all_categories()
    {
        $this->db->select('categories');
        $query = $this->db->get('products');
        $all_category_strings = $query->result_array();

        $unique_categories = [];
        foreach ($all_category_strings as $row) {
            $categories_in_row = explode(',', $row['categories']);
            foreach ($categories_in_row as $cat) {
                $unique_categories[] = trim($cat);
            }
        }
        return array_values(array_unique($unique_categories));
    }

    public function getProductBySlug($slug)
    {
        $this->db->where('slug', $slug);
        $query = $this->db->get('products');
        $product = $query->row_array(); // Return as an associative array

        if ($product) {
            // Add images
            $images = $this->get_product_images($product['id'], false); // get all images
            $product['images'] = $images;

            // Add thumbnail image
            $thumbnail = $this->get_product_images($product['id'], true);
            $product['thumbnail_image'] = !empty($thumbnail) ? $thumbnail[0]->image_url : null;

            // Add reviews
            $reviews = $this->get_product_reviews($product['id']);
            $product['reviews'] = $reviews;
        }

        return $product;
    }

    public function slugExists($slug)
    {
        $this->db->where('slug', $slug);
        $query = $this->db->get('products');
        return $query->num_rows() > 0;
    }
}
