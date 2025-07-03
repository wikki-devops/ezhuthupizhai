<?php
defined('BASEPATH') or exit('No direct script access allowed');

class Review extends CI_Controller
{
    public function __construct()
    {
        parent::__construct();
        $this->load->model('Review_model');
        $this->load->helper('url');
        $this->load->helper('json_response');

        header("Access-Control-Allow-Origin: *");
        header("Content-Type: application/json; charset=UTF-8");
        header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
        header("Access-Control-Max-Age: 3600");
        header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

        if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
            http_response_code(200);
            exit();
        }
    }

    public function create()
    {
        if ($this->input->method() !== 'post') {
            json_response(['status' => 405, 'message' => 'Method Not Allowed'], 405);
            return;
        }

        $json_data = $this->input->raw_input_stream;
        $data = json_decode($json_data, TRUE);

        if (
            empty($data['product_id']) ||
            empty($data['customer_name']) ||
            empty($data['rating']) ||
            empty($data['comment'])
        ) {
            json_response(['status' => 400, 'message' => 'Incomplete data. Required fields: product_id, customer_name, rating, comment.'], 400);
            return;
        }

        $review_id = $this->Review_model->create_review($data);

        if ($review_id) {
            $new_review = $this->Review_model->get_review_by_id($review_id);
            json_response(['status' => 201, 'message' => 'Review created successfully.', 'data' => $new_review], 201);
        } else {
            json_response(['status' => 500, 'message' => 'Failed to create review.'], 500);
        }
    }

    public function get()
    {
        if ($this->input->method() !== 'get') {
            json_response(['status' => 405, 'message' => 'Method Not Allowed'], 405);
            return;
        }

        $product_id = $this->input->get('product_id');

        if (!empty($product_id)) {
            $reviews = $this->Review_model->get_reviews_by_product_id($product_id);
        } else {
            $reviews = $this->Review_model->get_all_reviews();
        }

        if ($reviews) {
            json_response(['status' => 200, 'message' => 'Reviews retrieved successfully.', 'data' => $reviews], 200);
        } else {
            json_response(['status' => 404, 'message' => 'No reviews found.'], 404);
        }
    }
}
