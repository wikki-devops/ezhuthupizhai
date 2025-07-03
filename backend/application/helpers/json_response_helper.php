<?php
// application/helpers/json_response_helper.php

defined('BASEPATH') OR exit('No direct script access allowed');

if (!function_exists('json_response')) {
    function json_response($data = [], $http_status_code = 200)
    {
        // Set the Content-Type header to indicate JSON response
        header('Content-Type: application/json');

        // Set the HTTP status code
        http_response_code($http_status_code);

        // Log the data being encoded (for debugging, you can keep or remove this)
        log_message('debug', 'Data being JSON encoded: ' . print_r($data, TRUE));

        // Encode the data to JSON
        $json_output = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        // Log the generated JSON string (for debugging, you can keep or remove this)
        log_message('debug', 'Generated JSON string: ' . $json_output);

        // Check for JSON encoding errors (important!)
        if (json_last_error() !== JSON_ERROR_NONE) {
            log_message('error', 'JSON encoding error: ' . json_last_error_msg());
            // You might want to send a generic error response here if encoding fails
            // header('Content-Type: application/json', true, 500);
            // echo json_encode(['status' => 500, 'message' => 'Internal Server Error: JSON Encoding Failed']);
            // exit();
        }

        // Output the JSON string
        echo $json_output;

        // Terminate script execution to prevent any further output (e.g., HTML, whitespace)
        exit();
    }
}
