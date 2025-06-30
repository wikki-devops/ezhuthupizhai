<?php
defined('BASEPATH') OR exit('No direct script access allowed');

class User_model extends CI_Model {

    public function __construct()
    {
        parent::__construct();
        $this->load->database();
    }

    /**
     * Retrieves a user by their primary identifier (e.g., email).
     * This is the method used by both Auth and Checkout controllers to find a user.
     * @param string $identifier The user's email address.
     * @return array|null User data array if found, null otherwise.
     */
    public function get_user_by_identifier($identifier)
    {
        $this->db->where('email', $identifier); // Assuming 'email' is the primary identifier in your 'users' table
        $query = $this->db->get('users'); // 'users' is your user table name
        return $query->row_array();
    }

    /**
     * Creates a new user record if one doesn't exist for the given email.
     * Used after OTP verification or if 'create account' is checked in checkout.
     * @param string $email The user's email address.
     * @return int|bool The ID of the existing or newly created user on success, FALSE on database error.
     */
    public function create_user_if_not_exists($email)
    {
        $user = $this->get_user_by_identifier($email);
        if ($user) {
            return $user['id']; // User already exists, return their ID
        } else {
            $data = [
                'email'      => $email,
                'created_at' => date('Y-m-d H:i:s'),
                'status'     => 'active',
                // Consider adding a default hashed password or making it nullable if password is set later
                // 'password' => password_hash(uniqid(), PASSWORD_BCRYPT),
            ];
            $this->db->insert('users', $data);

            if ($this->db->affected_rows() > 0) {
                return $this->db->insert_id();
            }
            return FALSE; // Return FALSE on insert failure
        }
    }

    /**
     * Updates an existing user's basic information.
     * @param int $user_id The ID of the user to update.
     * @param array $data An associative array of data to update (e.g., first_name, last_name, phone).
     * @return bool TRUE on success, FALSE on failure.
     */
    public function update_user($user_id, $data)
    {
        $this->db->where('id', $user_id);
        return $this->db->update('users', $data);
    }

    /**
     * Saves a new user address to the 'user_addresses' table.
     * @param array $address_data An associative array of address details.
     * @return int|bool The ID of the newly inserted address on success, FALSE on failure.
     */
    public function save_user_address($address_data)
    {
        $this->db->insert('user_addresses', $address_data);
        if ($this->db->affected_rows() > 0) {
            return $this->db->insert_id();
        }
        return FALSE;
    }

    /**
     * Updates an existing user address in the 'user_addresses' table.
     * @param int $address_id The ID of the address to update.
     * @param int $user_id The ID of the user (for security, ensure address belongs to user).
     * @param array $data An associative array of address details to update.
     * @return bool TRUE on success, FALSE on failure.
     */
    public function update_user_address($address_id, $user_id, $data)
    {
        $this->db->where('id', $address_id);
        $this->db->where('user_id', $user_id); // Ensure the address belongs to this user
        return $this->db->update('user_addresses', $data);
    }


    /**
     * Retrieves all addresses associated with a given user ID.
     * @param int $user_id The ID of the user.
     * @return array An array of user address data. Returns empty array if no addresses found.
     */
    public function get_user_addresses($user_id)
    {
        $this->db->where('user_id', $user_id);
        $query = $this->db->get('user_addresses'); // 'user_addresses' is your addresses table name
        return $query->result_array();
    }


    // --- OTP Database Methods for `user_otp` table ---

    /**
     * Saves a new OTP record to the database.
     * @param string $email The email associated with the OTP.
     * @param string $otp_code The generated OTP code.
     * @param string $phone Optional phone number.
     * @param int $expiry_minutes OTP validity in minutes.
     * @return bool TRUE on success, FALSE on failure.
     */
    public function save_otp($email, $otp_code, $phone = null, $expiry_minutes = 5)
    {
        $expires_at = date('Y-m-d H:i:s', strtotime("+$expiry_minutes minutes"));

        $data = [
            'email'      => $email,
            'otp_code'   => $otp_code,
            'phone'      => $phone, // Make sure 'phone' column exists in user_otp if you store it
            'created_at' => date('Y-m-d H:i:s'),
            'expires_at' => $expires_at,
            'ip_address' => $this->input->ip_address(), // Make sure 'ip_address' column exists in your DB table
            'is_used'    => 0 // Mark as not used initially
        ];

        // OPTIONAL: Delete any existing unused OTPs for this email to ensure only one active OTP
        $this->db->where('email', $email);
        $this->db->where('is_used', 0);
        $this->db->where('expires_at >', date('Y-m-d H:i:s')); // Only delete currently valid ones
        $this->db->delete('user_otp'); // Use your actual table name: user_otp

        return $this->db->insert('user_otp', $data); // Use your actual table name: user_otp
    }

    /**
     * Finds a valid and unused OTP record for a given email and OTP code.
     * @param string $email The email associated with the OTP.
     * @param string $otp_code The OTP code entered by the user.
     * @return array|null The OTP record if found and valid, null otherwise.
     */
    public function find_valid_otp($email, $otp_code)
    {
        $this->db->where('email', $email);
        $this->db->where('otp_code', $otp_code);
        $this->db->where('is_used', 0); // Must not be used
        $this->db->where('expires_at >', date('Y-m-d H:i:s')); // Must not be expired
        $this->db->order_by('created_at', 'DESC'); // Get the latest one if multiple exist
        $this->db->limit(1);
        $query = $this->db->get('user_otp'); // Use your actual table name: user_otp
        return $query->row_array();
    }

    /**
     * Marks an OTP record as used in the database.
     * @param int $otp_id The ID of the OTP record to mark.
     * @return bool TRUE on success, FALSE on failure.
     */
    public function mark_otp_as_used($otp_id)
    {
        $this->db->where('id', $otp_id);
        return $this->db->update('user_otp', ['is_used' => 1]); // Use your actual table name: user_otp
    }
}