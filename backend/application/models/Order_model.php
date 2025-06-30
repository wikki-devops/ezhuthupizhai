<?php
defined('BASEPATH') OR exit('No direct script access allowed');

class Order_model extends CI_Model {

    public function __construct()
    {
        parent::__construct();
        $this->load->database();
    }

    /**
     * Inserts a new order into the 'orders' table.
     * @param array $data The order data to insert.
     * @return int|bool Insert ID on success, FALSE on failure.
     */
    public function insert_order($data)
    {
        $data['created_at'] = date('Y-m-d H:i:s');
        $data['updated_at'] = date('Y-m-d H:i:s');

        // CI3 ActiveRecord Insert
        $this->db->insert('orders', $data);

        // SQL Query Equivalent:
        // INSERT INTO `orders` (`first_name`, `last_name`, ..., `created_at`, `updated_at`)
        // VALUES ('value1', 'value2', ..., NOW(), NOW());

        if ($this->db->affected_rows() > 0) {
            return $this->db->insert_id(); // Return the ID of the inserted order
        }
        return FALSE;
    }

    /**
     * Inserts multiple order items into the 'order_items' table.
     * @param array $data An array of order item arrays.
     * @return bool TRUE on success, FALSE on failure.
     */
    public function insert_order_items($data)
    {
        foreach ($data as &$item) { // Use & for reference to modify the array directly
            $item['created_at'] = date('Y-m-d H:i:s');
            $item['updated_at'] = date('Y-m-d H:i:s');
        }

        // CI3 ActiveRecord Insert Batch
        $this->db->insert_batch('order_items', $data);

        // SQL Query Equivalent (example for 2 items):
        // INSERT INTO `order_items` (`order_id`, `product_id`, `product_name`, `quantity`, `price_at_order`, `total`, `created_at`, `updated_at`)
        // VALUES
        // (1, 101, 'Product A', 2, 25.00, 50.00, NOW(), NOW()),
        // (1, 102, 'Product B', 1, 10.00, 10.00, NOW(), NOW());

        return ($this->db->affected_rows() > 0);
    }

    /**
     * Get an order by ID (e.g., for thank you page or order details)
     * @param int $order_id
     * @return array|null Order data or null if not found.
     */
    public function get_order_by_id($order_id)
    {
        $this->db->where('id', $order_id);
        $query = $this->db->get('orders');

        // SQL Query Equivalent:
        // SELECT * FROM `orders` WHERE `id` = '{$order_id}' LIMIT 1;

        if ($query->num_rows() > 0) {
            return $query->row_array(); // Returns a single row as an array
        }
        return NULL;
    }

    /**
     * Get order items for a specific order.
     * @param int $order_id
     * @return array Array of order item arrays.
     */
    public function get_order_items($order_id)
    {
        $this->db->where('order_id', $order_id);
        $query = $this->db->get('order_items');

        // SQL Query Equivalent:
        // SELECT * FROM `order_items` WHERE `order_id` = '{$order_id}';

        if ($query->num_rows() > 0) {
            return $query->result_array(); // Returns all rows as an array of arrays
        }
        return [];
    }

    // You can add more methods here like update_order_status etc.
}