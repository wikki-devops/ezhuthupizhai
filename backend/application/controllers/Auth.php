<?php
defined('BASEPATH') OR exit('No direct script access allowed');

// Include Composer's autoloader for Google API Client and Guzzle
require_once FCPATH . 'vendor/autoload.php';

class Auth extends CI_Controller {

    // Class properties to store Gmail API credentials for easy access
    protected $gmailEmail;
    protected $clientId;
    protected $clientSecret;
    protected $refreshToken;

    public function __construct()
    {
        parent::__construct();
        $this->load->model('User_model');
        $this->load->library('form_validation');
        $this->load->library('session'); // Keep loaded for general session use (not for OTP storage now)
        $this->load->helper('url');
        $this->load->config('email'); // Load email config for Gmail API credentials
        $this->load->config('config'); // Load general config for other settings if any

        // Initialize class properties from config
        $this->gmailEmail = $this->config->item('gmail_email');
        $this->clientId = $this->config->item('gmail_client_id');
        $this->clientSecret = $this->config->item('gmail_client_secret');
        $this->refreshToken = $this->config->item('gmail_refresh_token');

        // --- START CORS HEADERS (Crucial for API calls from Angular) ---
        header('Content-Type: application/json');
        header("Access-Control-Allow-Origin: http://localhost:4200"); // IMPORTANT: Change to your Angular app's exact origin
        header("Access-Control-Allow-Methods: GET, POST, OPTIONS, PUT, DELETE");
        header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, Accept");
        header("Access-Control-Max-Age: 86400");
        header("Access-Control-Allow-Credentials: true");

        // Handle preflight OPTIONS requests directly
        if ($this->input->method() === 'options') {
            http_response_code(200);
            exit();
        }
        // --- END CORS HEADERS ---
    }

    /**
     * Refreshes the Google API access token using the stored refresh token.
     * @return string|null The new access token or null on failure.
     */
    private function refreshAccessToken()
    {
        $client = new GuzzleHttp\Client();
        try {
            $response = $client->post('https://oauth2.googleapis.com/token', [
                'form_params' => [
                    'client_id' => $this->clientId,
                    'client_secret' => $this->clientSecret,
                    'refresh_token' => $this->refreshToken,
                    'grant_type' => 'refresh_token',
                ],
                'verify' => FALSE // WARNING: Set to TRUE in production for SSL certificate verification.
            ]);

            $data = json_decode($response->getBody()->getContents(), true);
            return $data['access_token'] ?? null;
        } catch (GuzzleHttp\Exception\RequestException $e) {
            $error_details = $e->getMessage();
            if ($e->hasResponse()) {
                $error_details .= ' Response: ' . $e->getResponse()->getBody()->getContents();
            }
            log_message('error', 'Guzzle Request Exception refreshing token: ' . $error_details);
            return null;
        } catch (Exception $e) {
            log_message('error', 'General Exception refreshing token: ' . $e->getMessage());
            return null;
        }
    }

    /**
     * Sends a One-Time Password (OTP) to the provided email address using Gmail API.
     * Stores the OTP in the database (`user_otp` table).
     * Expects JSON input: {"email": "user@example.com", "phone": "1234567890"}
     */
    public function send_otp()
    {
        $input_data = json_decode($this->input->raw_input_stream, true);
        $email = $input_data['email'] ?? null;
        $phone = $input_data['phone'] ?? null;

        if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $this->output->set_status_header(400)->set_output(json_encode(['success' => false, 'message' => 'A valid email address is required.']));
            return;
        }

        $otp = rand(100000, 999999); // Generate 6-digit OTP
        $otp_validity_minutes = 5; // Define OTP validity period

        // --- Store OTP in Database (`user_otp` table) ---
        $save_otp_success = $this->User_model->save_otp($email, $otp, $phone, $otp_validity_minutes);

        if (!$save_otp_success) {
            $this->output->set_status_header(500)->set_output(json_encode(['success' => false, 'message' => 'Failed to save OTP to database. Please try again.']));
            log_message('error', 'SEND_OTP: Failed to save OTP to database for email: ' . $email);
            return;
        }
        log_message('debug', 'SEND_OTP: OTP ' . $otp . ' saved to database for email: ' . $email);
        // --- END Store OTP in Database ---

        // Get a fresh Google API access token
        $accessToken = $this->refreshAccessToken();

        if (!$accessToken) {
            $this->output->set_status_header(500)->set_output(json_encode(['success' => false, 'message' => 'Error: Could not obtain Google API access token.']));
            log_message('error', 'OTP Email Error: Failed to get Google API access token for email: ' . $email);
            return;
        }

        // Configure Google_Client and Google_Service_Gmail
        $client = new Google_Client();
        $client->setAccessToken($accessToken);
        $service = new Google_Service_Gmail($client);

        try {
            // Get email content details from config/email.php
            $from_email = $this->config->item('from_email');
            $from_name = $this->config->item('from_name');
            $subject_template = $this->config->item('otp_email_subject_template');
            $body_template = $this->config->item('otp_email_body_template');

            // Replace placeholders in subject and body
            $app_name = $from_name;
            $subject = str_replace('{APP_NAME}', $app_name, $subject_template);
            $email_message_html = str_replace(
                ['{OTP_CODE}', '{OTP_VALIDITY_MINUTES}', '{APP_NAME}'],
                [$otp, $otp_validity_minutes, $app_name],
                $body_template
            );

            // Create raw email message compatible with Gmail API
            $message = new Google_Service_Gmail_Message();
            $rawMessage = "From: {$from_name} <{$from_email}>\r\n";
            $rawMessage .= "To: <{$email}>\r\n";
            $rawMessage .= "Subject: {$subject}\r\n";
            $rawMessage .= "MIME-Version: 1.0\r\n";
            $rawMessage .= "Content-Type: text/html; charset=utf-8\r\n";
            $rawMessage .= "Content-Transfer-Encoding: quoted-printable\r\n\r\n";
            $rawMessage .= $email_message_html;

            // Encode the message to base64url for Gmail API
            $mime = rtrim(strtr(base64_encode($rawMessage), '+/', '-_'), '=');
            $message->setRaw($mime);

            // Send the email via Gmail API
            $sentMessage = $service->users_messages->send('me', $message);

            $this->output->set_status_header(200)->set_output(json_encode(['success' => true, 'message' => 'OTP sent successfully to ' . $email . '.']));
            log_message('info', 'OTP sent: ' . $otp . ' to ' . $email . ' via Gmail API. Message ID: ' . $sentMessage->getId());

        } catch (Google_Service_Exception $e) {
            $error_message = 'Error sending OTP via Gmail API: ' . $e->getMessage();
            log_message('error', 'OTP Email Error (Google Service): ' . $error_message);
            $this->output->set_status_header(500)->set_output(json_encode(['success' => false, 'message' => $error_message]));
        } catch (Exception $e) {
            $error_message = 'Error sending OTP (general): ' . $e->getMessage();
            log_message('error', 'OTP Email Error (General): ' . $error_message);
            $this->output->set_status_header(500)->set_output(json_encode(['success' => false, 'message' => $error_message]));
        }
    }

    /**
     * Verifies the OTP provided by the user against the one stored in the database.
     * If successful, returns user details including addresses.
     * Expects JSON input: {"email": "user@example.com", "otp": "123456"}
     */
    public function verify_otp_and_get_addresses()
    {
        $input_data = json_decode($this->input->raw_input_stream, true);
        $email = $input_data['email'] ?? null; // Now explicitly required in verification
        $entered_otp = $input_data['otp'] ?? null;

        // Log input data for debugging
        log_message('debug', 'VERIFY_OTP_AND_GET_ADDRESSES: Received email: ' . ($email ?: 'NULL/EMPTY') . ', OTP: ' . ($entered_otp ?: 'NULL/EMPTY'));

        $response_data = ['success' => false, 'message' => ''];
        $http_status = 400; // Default HTTP status for bad request

        if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $response_data['message'] = 'Email is required for OTP verification.';
        } elseif (empty($entered_otp)) {
            $response_data['message'] = 'OTP not provided.';
        } else {
            // --- Retrieve OTP from Database (`user_otp` table) ---
            $otp_record = $this->User_model->find_valid_otp($email, $entered_otp);

            if (!$otp_record) {
                // If not found, it's either invalid, expired, or already used
                $response_data['message'] = 'Invalid, expired, or already used OTP. Please request a new one.';
                $http_status = 401; // Unauthorized
            } else {
                // OTP found and is valid (not expired, not used)
                log_message('info', 'VERIFY_OTP_AND_GET_ADDRESSES: OTP matched successfully! Email: ' . $email . ', OTP: ' . $entered_otp);

                // --- Mark OTP as Used in Database ---
                $mark_used_success = $this->User_model->mark_otp_as_used($otp_record['id']);
                if (!$mark_used_success) {
                    log_message('error', 'VERIFY_OTP_AND_GET_ADDRESSES: Failed to mark OTP as used for ID: ' . $otp_record['id']);
                    // This is a warning, continue with verification if OTP itself was valid
                }
                // --- END Mark OTP as Used ---

                // Retrieve user details and addresses
                $user = null;
                $user_id = null;
                $addresses = [];

                $user = $this->User_model->get_user_by_identifier($email);
                if ($user) {
                    $user_id = $user['id'];
                    $addresses = $this->User_model->get_user_addresses($user_id);
                } else {
                    // Create new user if not found (based on your existing logic)
                    $new_user_id = $this->User_model->create_user_if_not_exists($email);
                    if ($new_user_id) {
                        $user_id = $new_user_id;
                        $response_data['message'] = 'OTP verified. New user account created.';
                    } else {
                        log_message('error', 'Failed to create new user account after OTP verification for email: ' . $email);
                        $response_data['message'] = 'OTP verified, but failed to process user account.';
                        $http_status = 500;
                        goto send_response; // Skip success if user creation failed
                    }
                }

                $response_data['success'] = true;
                $response_data['message'] = $response_data['message'] ?: 'OTP verified successfully!';
                $response_data['user_id'] = $user_id;
                $response_data['email'] = $email;
                $response_data['phone'] = $otp_record['phone']; // Get phone from OTP record (if stored in DB)
                $response_data['addresses'] = $addresses;
                $http_status = 200; // OK
            }
        }

        send_response:
        $this->output->set_status_header($http_status)->set_output(json_encode($response_data));
    }

    /**
     * Handles user logout.
     * No OTP-specific session clearing needed as OTP is DB-based.
     */
    public function logout()
    {
        $this->session->sess_destroy(); // Destroys the entire CI session

        $this->output->set_content_type('application/json');
        $this->output->set_status_header(200);
        echo json_encode(['success' => true, 'message' => 'Logged out successfully.']);
    }
}