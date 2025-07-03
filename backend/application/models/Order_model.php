<?php
defined('BASEPATH') or exit('No direct script access allowed');

class Order_model extends CI_Model
{

    public function __construct()
    {
        parent::__construct();
        $this->load->database();
    }
    public function insert_order($data)
    {
        $data['created_at'] = date('Y-m-d H:i:s');
        $data['updated_at'] = date('Y-m-d H:i:s');

        $this->db->insert('orders', $data);

        if ($this->db->affected_rows() > 0) {
            return $this->db->insert_id();
        }
        return FALSE;
    }
    
    public function insert_order_items($data)
    {
        foreach ($data as &$item) {
            $item['created_at'] = date('Y-m-d H:i:s');
            $item['updated_at'] = date('Y-m-d H:i:s');

            if (!isset($item['byob_items_list'])) {
                $item['byob_items_list'] = null;
            }
        }

        $this->db->insert_batch('order_items', $data);

        return ($this->db->affected_rows() > 0);
    }
    public function get_order_by_id($order_id)
    {
        $this->db->where('id', $order_id);
        $query = $this->db->get('orders');

        if ($query->num_rows() > 0) {
            return $query->row_array();
        }
        return NULL;
    }

    public function get_order_items($order_id)
    {
        $this->db->where('order_id', $order_id);
        $query = $this->db->get('order_items');

        if ($query->num_rows() > 0) {
            return $query->result_array();
        }
        return [];
    }
}
