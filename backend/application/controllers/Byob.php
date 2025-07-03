<?php
defined('BASEPATH') or exit('No direct script access allowed');

class Byob extends CI_Controller
{

    public function __construct()
    {
        parent::__construct();
        $this->load->model('Byob_model');
        $this->load->library(['form_validation', 'session']);
        $this->load->helper('json_response');

        header('Access-Control-Allow-Origin: http://localhost:4200');
        header('Access-Control-Allow-Methods: GET, POST, OPTIONS, PUT, DELETE');
        header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
        header('Access-Control-Allow-Credentials: true');

        if ($this->input->method() === 'options') {
            $this->output->set_status_header(200);
            exit();
        }
    }

    private function json_response($statusHeader, $response)
    {
        header($statusHeader);
        header('Content-type: application/json');
        echo json_encode($response, JSON_UNESCAPED_SLASHES);
        exit;
    }

    public function items()
    {
        $items = $this->Byob_model->get_byob_available_items();
        if ($items) {
            $this->json_response('HTTP/1.1 200 OK', ['status' => true, 'data' => $items]);
        } else {
            $this->json_response('HTTP/1.1 404 Not Found', ['status' => false, 'message' => 'No BYOB items found.']);
        }
    }
}
