<?php
defined('BASEPATH') OR exit('No direct script access allowed');

class Coupon_model extends CI_Model {

    public function __construct() {
        parent::__construct();
        $this->load->database();
    }

    /**
     * Get all coupons from the database.
     * @return array An array of coupon objects.
     */
    public function get_all_coupons() {
        $query = $this->db->get('coupons');
        return $query->result(); // Returns an array of objects
    }

    /**
     * Get a single coupon by its code.
     * @param string $coupon_code The code of the coupon to retrieve.
     * @return object|null The coupon object if found, otherwise null.
     */
    public function get_coupon_by_code($coupon_code) {
        $this->db->where('coupon_code', $coupon_code);
        $query = $this->db->get('coupons');
        return $query->row(); // Returns a single object
    }
}