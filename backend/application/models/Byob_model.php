<?php
defined('BASEPATH') or exit('No direct script access allowed');

class Byob_model extends CI_Model
{

    public function __construct()
    {
        parent::__construct();
        $this->load->database();
    }

    public function get_byob_available_items()
    {

        $allowed_product_ids = [1, 2, 3, 4, 5, 15, 16, 17, 18, 19, 20, 21, 22];

        $this->db->select('p.*, pi.image_url');
        $this->db->from('products p');
        $this->db->join('product_images pi', 'pi.product_id = p.id AND pi.is_thumbnail = 1', 'left');
        $this->db->where_in('p.id', $allowed_product_ids);
        $query = $this->db->get();

        $items = $query->result_array();

        // Construct full image URLs
        foreach ($items as &$item) {
            if (!empty($item['image_url'])) {
                $item['thumbnail_image_full_url'] = $item['image_url'];
            } else {
                $item['thumbnail_image_full_url'] = null; 
            }
            unset($item['image_url']);
        }

        return $items;
    }

    /**
     * Get a single product by its ID.
     * Updated to also fetch the thumbnail image URL.
     */
    public function get_product_by_id($product_id)
    {
        // $this->load->helper('url'); // Only uncomment if you use base_url() for other purposes.
        $this->db->select('p.*, pi.image_url');
        $this->db->from('products p');
        $this->db->join('product_images pi', 'pi.product_id = p.id AND pi.is_thumbnail = 1', 'left');
        $this->db->where('p.id', $product_id);
        $query = $this->db->get();
        $product = $query->row_array();

        if ($product && !empty($product['image_url'])) {
            // Directly use the image_url from the database
            $product['thumbnail_image_full_url'] = $product['image_url'];
            unset($product['image_url']);
        } else if ($product) {
            $product['thumbnail_image_full_url'] = null; // Or a placeholder
        }

        return $product;
    }

    /**
     * Create a new BYOB box.
     */
    public function create_byob_box($user_id = NULL)
    {
        $data = [
            'user_id' => $user_id,
            'box_name' => 'Custom Gift Box', // Default name, can be updated later
            'total_mrp_price' => 0.00,
            'total_special_price' => 0.00,
        ];
        $this->db->insert('byob_boxes', $data);
        return $this->db->insert_id();
    }

    /**
     * Get a BYOB box by its ID.
     * Updated to include thumbnail image URLs for items within the box.
     */
    public function get_byob_box($box_id)
    {
        // $this->load->helper('url'); // Only uncomment if you use base_url() for other purposes.
        $this->db->select('bb.*, bbi.product_id, bbi.quantity, p.name, p.short_description, p.mrp_price, p.special_price, pi.image_url');
        $this->db->from('byob_boxes bb');
        $this->db->join('byob_box_items bbi', 'bb.id = bbi.byob_box_id', 'left');
        $this->db->join('products p', 'bbi.product_id = p.id', 'left');
        $this->db->join('product_images pi', 'pi.product_id = p.id AND pi.is_thumbnail = 1', 'left'); // Join for item images
        $this->db->where('bb.id', $box_id);
        $query = $this->db->get();

        $box_data = null;
        $items = [];
        foreach ($query->result_array() as $row) {
            if ($box_data === null) {
                $box_data = [
                    'id' => $row['id'],
                    'user_id' => $row['user_id'],
                    'box_name' => $row['box_name'],
                    'total_mrp_price' => $row['total_mrp_price'],
                    'total_special_price' => $row['total_special_price'],
                    'created_at' => $row['created_at'],
                    'updated_at' => $row['updated_at'],
                    'items' => []
                ];
            }
            if ($row['product_id'] !== null) {
                $item_thumbnail_url = null;
                if (!empty($row['image_url'])) {
                    // Directly use the image_url from the database
                    $item_thumbnail_url = $row['image_url'];
                }

                $items[] = [
                    'product_id' => $row['product_id'],
                    'name' => $row['name'],
                    'short_description' => $row['short_description'],
                    'quantity' => $row['quantity'],
                    'mrp_price' => $row['mrp_price'],
                    'special_price' => $row['special_price'],
                    'thumbnail_image_full_url' => $item_thumbnail_url
                ];
            }
        }
        if ($box_data) {
            $box_data['items'] = $items;
        }
        return $box_data;
    }

    /**
     * Add an item to a BYOB box.
     */
    public function add_item_to_byob_box($box_id, $product_id, $quantity = 1)
    {
        // Check if item already exists in the box
        $this->db->where('byob_box_id', $box_id);
        $this->db->where('product_id', $product_id);
        $existing_item = $this->db->get('byob_box_items')->row_array();

        $product_info = $this->get_product_by_id($product_id); // Use the updated get_product_by_id
        if (!$product_info) {
            return false; // Product not found
        }

        if ($existing_item) {
            // Update quantity if item exists
            $new_quantity = $existing_item['quantity'] + $quantity;
            $this->db->where('id', $existing_item['id']);
            $this->db->update('byob_box_items', ['quantity' => $new_quantity]);
        } else {
            // Add new item
            $data = [
                'byob_box_id' => $box_id,
                'product_id' => $product_id,
                'quantity' => $quantity,
                'item_mrp_price' => $product_info['mrp_price'],
                'item_special_price' => $product_info['special_price'],
            ];
            $this->db->insert('byob_box_items', $data);
        }
        $this->update_byob_box_totals($box_id);
        return true;
    }

    /**
     * Update quantity of an item in a BYOB box.
     */
    public function update_item_quantity_in_byob_box($box_id, $product_id, $quantity)
    {
        if ($quantity <= 0) {
            return $this->remove_item_from_byob_box($box_id, $product_id);
        }

        $this->db->where('byob_box_id', $box_id);
        $this->db->where('product_id', $product_id);
        $this->db->update('byob_box_items', ['quantity' => $quantity]);
        $this->update_byob_box_totals($box_id);
        return $this->db->affected_rows() > 0;
    }

    /**
     * Remove an item from a BYOB box.
     */
    public function remove_item_from_byob_box($box_id, $product_id)
    {
        $this->db->where('byob_box_id', $box_id);
        $this->db->where('product_id', $product_id);
        $this->db->delete('byob_box_items');
        $this->update_byob_box_totals($box_id);
        return $this->db->affected_rows() > 0;
    }

    /**
     * Update the total prices of a BYOB box.
     */
    public function update_byob_box_totals($box_id)
    {
        $this->db->select('SUM(bbi.quantity * bbi.item_mrp_price) as total_mrp, SUM(bbi.quantity * bbi.item_special_price) as total_special');
        $this->db->from('byob_box_items bbi');
        $this->db->where('bbi.byob_box_id', $box_id);
        $query = $this->db->get()->row();

        $data = [
            'total_mrp_price' => $query->total_mrp ? $query->total_mrp : 0.00,
            'total_special_price' => $query->total_special ? $query->total_special : 0.00,
        ];
        $this->db->where('id', $box_id);
        $this->db->update('byob_boxes', $data);
    }
}