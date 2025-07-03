<?php
// application/models/Review_model.php

defined('BASEPATH') or exit('No direct script access allowed');

class Review_model extends CI_Model
{

    public function __construct()
    {
        parent::__construct();
        $this->load->database(); // Load the database library
    }

    /**
     * Create a new review record.
     * @param array $data An associative array of review data.
     * @return int|bool Inserted ID on success, FALSE on failure.
     */
    public function create_review($data)
    {
        // Automatically add current timestamp
        $data['created_at'] = date('Y-m-d H:i:s');
        if ($this->db->insert('reviews', $data)) {
            return $this->db->insert_id(); // Returns the ID of the inserted row
        }
        return FALSE;
    }

    /**
     * Get all reviews.
     * @return array An array of review objects.
     */
    public function get_all_reviews()
    {
        $this->db->order_by('created_at', 'DESC');
        $query = $this->db->get('reviews');
        return $query->result(); // Returns an array of objects
    }

    /**
     * Get reviews for a specific product.
     * @param int $product_id The ID of the product.
     * @return array An array of review objects.
     */
    public function get_reviews_by_product_id($product_id)
    {
        $this->db->where('product_id', $product_id);
        $this->db->order_by('created_at', 'DESC');
        $query = $this->db->get('reviews');
        return $query->result();
    }

    /**
     * Get a single review by its ID.
     * @param int $review_id The ID of the review.
     * @return object|null A single review object on success, or null if not found.
     */
    public function get_review_by_id($review_id)
    {
        log_message('debug', 'Attempting to fetch review with ID: ' . $review_id); // Log the ID being sought

        $this->db->where('id', $review_id);
        $query = $this->db->get('reviews');

        // !! CRITICAL LOG TO CHECK !!
        log_message('debug', 'Last DB Query for get_review_by_id: ' . $this->db->last_query());

        $result = $query->row(); // Get single row as object

        // !! CRITICAL LOG TO CHECK !!
        log_message('debug', 'Result from get_review_by_id: ' . print_r($result, true));

        return $result;
    }

    // You can add more methods here like update_review, delete_review, etc.
}
