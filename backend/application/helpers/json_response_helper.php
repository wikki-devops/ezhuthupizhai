<?php
defined('BASEPATH') OR exit('No direct script access allowed');

/**
 * Sends a JSON response with the given data and HTTP status code.
 *
 * @param array $data The data to be encoded as JSON.
 * @param int $http_status The HTTP status code (e.g., 200, 400, 500).
 * @return void
 */
if ( ! function_exists('json_response'))
{
    function json_response($data, $http_status = 200)
    {
        // Get the CodeIgniter instance
        $CI =& get_instance();

        // Set the Content-Type header to application/json
        $CI->output->set_content_type('application/json');

        // Set the HTTP status code
        $CI->output->set_status_header($http_status);

        // Output the JSON encoded data
        $CI->output->set_output(json_encode($data));

        // End script execution to prevent further output
        exit();
    }
}

/* End of file json_response_helper.php */
/* Location: ./application/helpers/json_response_helper.php */