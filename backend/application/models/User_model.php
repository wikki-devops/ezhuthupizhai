<?php
// application/controllers/User_model.php

defined('BASEPATH') or exit('No direct script access allowed');

class User_model extends CI_Model
{
    public function __construct()
    {
        parent::__construct();
        $this->load->database();
    }

    public function get_user_by_identifier($identifier)
    {
        $this->db->where('email', $identifier);
        $query = $this->db->get('users');
        return $query->row_array();
    }

    public function create_user_if_not_exists($email, $additional_user_data = [])
    {
        $user = $this->get_user_by_identifier($email);
        if ($user) {
            if (!empty($additional_user_data)) {
                $update_data = [];
                if (isset($additional_user_data['first_name']) && ($user['first_name'] ?? '') !== $additional_user_data['first_name']) {
                    $update_data['first_name'] = $additional_user_data['first_name'];
                }
                if (isset($additional_user_data['last_name']) && ($user['last_name'] ?? '') !== $additional_user_data['last_name']) {
                    $update_data['last_name'] = $additional_user_data['last_name'];
                }
                if (isset($additional_user_data['phone']) && ($user['phone'] ?? '') !== $additional_user_data['phone']) {
                    $update_data['phone'] = $additional_user_data['phone'];
                }

                if (!empty($update_data)) {
                    $this->update_user($user['id'], $update_data);
                }
            }
            return $user['id'];
        } else {
            $data = [
                'email'      => $email,
                'created_at' => date('Y-m-d H:i:s'),
                'updated_at' => date('Y-m-d H:i:s'),
                'status'     => 'active',
            ];

            if (isset($additional_user_data['first_name'])) {
                $data['first_name'] = $additional_user_data['first_name'];
            }
            if (isset($additional_user_data['last_name'])) {
                $data['last_name'] = $additional_user_data['last_name'];
            }
            if (isset($additional_user_data['phone'])) {
                $data['phone'] = $additional_user_data['phone'];
            }

            $this->db->insert('users', $data);

            if ($this->db->affected_rows() > 0) {
                return $this->db->insert_id();
            }
            return FALSE;
        }
    }

    public function update_user($user_id, $data)
    {
        $data['updated_at'] = date('Y-m-d H:i:s');
        $this->db->where('id', $user_id);
        return $this->db->update('users', $data);
    }

    public function save_user_address($address_data)
    {
        $address_data['created_at'] = date('Y-m-d H:i:s');
        $address_data['updated_at'] = date('Y-m-d H:i:s');
        $this->db->insert('user_addresses', $address_data);
        if ($this->db->affected_rows() > 0) {
            return $this->db->insert_id();
        }
        return FALSE;
    }

    public function update_user_address($address_id, $user_id, $data)
    {
        $data['updated_at'] = date('Y-m-d H:i:s');
        $this->db->where('id', $address_id);
        $this->db->where('user_id', $user_id);
        return $this->db->update('user_addresses', $data);
    }

    public function get_user_addresses($user_id)
    {
        $this->db->where('user_id', $user_id);
        $query = $this->db->get('user_addresses');
        return $query->result_array();
    }

    public function save_otp($email, $otp_code, $phone = null, $expiry_minutes = 5)
    {
        $expires_at = date('Y-m-d H:i:s', strtotime("+$expiry_minutes minutes"));

        $data = [
            'email'      => $email,
            'otp_code'   => $otp_code,
            'phone'      => $phone,
            'created_at' => date('Y-m-d H:i:s'),
            'expires_at' => $expires_at,
            'ip_address' => $this->input->ip_address(),
            'is_used'    => 0
        ];

        $this->db->where('email', $email);
        $this->db->where('is_used', 0);
        $this->db->where('expires_at >', date('Y-m-d H:i:s'));
        $this->db->delete('user_otp');

        return $this->db->insert('user_otp', $data);
    }

    public function find_valid_otp($email, $otp_code)
    {
        $this->db->where('email', $email);
        $this->db->where('otp_code', $otp_code);
        $this->db->where('is_used', 0);
        $this->db->where('expires_at >', date('Y-m-d H:i:s'));
        $this->db->order_by('created_at', 'DESC');
        $this->db->limit(1);
        $query = $this->db->get('user_otp');
        return $query->row_array();
    }

    public function mark_otp_as_used($otp_id)
    {
        $this->db->where('id', $otp_id);
        return $this->db->update('user_otp', ['is_used' => 1]);
    }
}
