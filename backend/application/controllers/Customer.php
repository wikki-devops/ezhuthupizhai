<?php
defined('BASEPATH') or exit('No direct script access allowed');

class Customer extends CI_Controller
{

    public function __construct()
    {
        parent::__construct();
        $this->load->model('User_model');
        $this->load->helper('form');
        $this->load->library('form_validation');
        $this->load->library('session');

        header('Access-Control-Allow-Origin: http://localhost:4200');
        header('Access-Control-Allow-Methods: GET, POST, OPTIONS, PUT, DELETE');
        header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
        header('Access-Control-Allow-Credentials: true');

        if ($this->input->method() === 'options') {
            $this->output->set_status_header(200);
            exit();
        }
    }

    public function details($user_id)
    {
        $user_details = $this->User_model->get_user_details_by_id($user_id);

        if ($user_details) {
            unset($user_details['password']);
            $this->output
                ->set_content_type('application/json')
                ->set_output(json_encode(['success' => true, 'customer_details' => $user_details]));
        } else {
            $this->output
                ->set_status_header(404)
                ->set_content_type('application/json')
                ->set_output(json_encode(['success' => false, 'message' => 'User not found.']));
        }
    }

    public function addresses($user_id)
    {
        if (!is_numeric($user_id)) {
            $this->output
                ->set_status_header(400)
                ->set_content_type('application/json')
                ->set_output(json_encode(['success' => false, 'message' => 'Invalid user ID.']));
            return;
        }

        $addresses = $this->User_model->get_user_addresses($user_id);

        if ($addresses) {
            $this->output
                ->set_content_type('application/json')
                ->set_output(json_encode(['success' => true, 'addresses' => $addresses]));
        } else {
            $this->output
                ->set_content_type('application/json')
                ->set_output(json_encode(['success' => true, 'addresses' => [], 'message' => 'No addresses found for this user.']));
        }
    }
}
