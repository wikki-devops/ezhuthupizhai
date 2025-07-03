<?php
defined('BASEPATH') or exit('No direct script access allowed');

class Shop_model extends CI_Model
{
    public function __construct()
    {
        parent::__construct();
        $this->load->database();
    }

   
    public function get_all_products()
    {
        $query = $this->db->get('products');
        return $query->result();
    }

    
    public function get_product_by_id($product_id)
    {
        $this->db->where('id', $product_id);
        $query = $this->db->get('products');
        $product = $query->row();

        if ($product) {
            $thumbnail_image = $this->get_product_images($product_id, true);
            $product->thumbnail_image = !empty($thumbnail_image) ? $thumbnail_image[0]->image_url : null;
        }

        return $product;
    }

    public function get_product_images($product_id, $is_thumbnail_only = false)
    {
        $this->db->where('product_id', $product_id);
        if ($is_thumbnail_only) {
            $this->db->where('is_thumbnail', 1);
        }
        $this->db->order_by('order_priority', 'ASC');
        $query = $this->db->get('product_images');
        return $query->result();
    }

    public function get_product_reviews($product_id)
    {
        $this->db->where('product_id', $product_id);
        $query = $this->db->get('reviews');
        return $query->result();
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
        $product = $query->row_array();

        if ($product) {
            $product['images'] = $this->get_product_images($product['id'], false);
            $product['thumbnail_image'] = !empty($product['images']) && isset($product['images'][0]) ? $product['images'][0]->image_url : null;
            $product['reviews'] = $this->get_product_reviews($product['id']);
        }

        return $product;
    }

    public function slugExists($slug)
    {
        $this->db->where('slug', $slug);
        $query = $this->db->get('products');
        return $query->num_rows() > 0;
    }

    public function get_all_coupons()
    {
        $query = $this->db->get('coupons');
        return $query->result();
    }

    public function get_coupon_by_code($coupon_code)
    {
        $this->db->where('coupon_code', $coupon_code);
        $query = $this->db->get('coupons');
        return $query->row();
    }
}