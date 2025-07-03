<?php
defined('BASEPATH') or exit('No direct script access allowed');

require_once FCPATH . 'vendor/autoload.php';

class Auth extends CI_Controller
{
    protected $gmailEmail;
    protected $clientId;
    protected $clientSecret;
    protected $refreshToken;

    public function __construct()
    {
        parent::__construct();
        $this->load->model('User_model');
        $this->load->library('form_validation');
        $this->load->library('session');
        $this->load->helper('url');
        $this->load->config('email');
        $this->load->config('config');

        $this->gmailEmail = $this->config->item('gmail_email');
        $this->clientId = $this->config->item('gmail_client_id');
        $this->clientSecret = $this->config->item('gmail_client_secret');
        $this->refreshToken = $this->config->item('gmail_refresh_token');

        header('Content-Type: application/json');
        header("Access-Control-Allow-Origin: http://localhost:4200");
        header("Access-Control-Allow-Methods: GET, POST, OPTIONS, PUT, DELETE");
        header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, Accept");
        header("Access-Control-Max-Age: 86400");
        header("Access-Control-Allow-Credentials: true");

        if ($this->input->method() === 'options') {
            http_response_code(200);
            exit();
        }
    }

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
                'verify' => FALSE
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

    public function send_otp()
    {
        $input_data = json_decode($this->input->raw_input_stream, true);
        $email = $input_data['email'] ?? null;
        $phone = $input_data['phone'] ?? null;

        if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $this->output->set_status_header(400)->set_output(json_encode(['success' => false, 'message' => 'A valid email address is required.']));
            return;
        }

        $otp = rand(100000, 999999);
        $otp_validity_minutes = 5;

        $save_otp_success = $this->User_model->save_otp($email, $otp, $phone, $otp_validity_minutes);

        if (!$save_otp_success) {
            $this->output->set_status_header(500)->set_output(json_encode(['success' => false, 'message' => 'Failed to save OTP to database. Please try again.']));
            log_message('error', 'SEND_OTP: Failed to save OTP to database for email: ' . $email);
            return;
        }

        $accessToken = $this->refreshAccessToken();

        if (!$accessToken) {
            $this->output->set_status_header(500)->set_output(json_encode(['success' => false, 'message' => 'Error: Could not obtain Google API access token.']));
            log_message('error', 'OTP Email Error: Failed to get Google API access token for email: ' . $email);
            return;
        }

        $client = new Google_Client();
        $client->setAccessToken($accessToken);
        $service = new Google_Service_Gmail($client);

        try {
            $from_email = $this->config->item('from_email');
            $from_name = $this->config->item('from_name');
            $subject_template = $this->config->item('otp_email_subject_template');
            $body_template = $this->config->item('otp_email_body_template');

            $app_name = $from_name;
            $subject = str_replace('{APP_NAME}', $app_name, $subject_template);
            $email_message_html = str_replace(
                ['{OTP_CODE}', '{OTP_VALIDITY_MINUTES}', '{APP_NAME}'],
                [$otp, $otp_validity_minutes, $app_name],
                $body_template
            );

            $message = new Google_Service_Gmail_Message();
            $rawMessage = "From: {$from_name} <{$from_email}>\r\n";
            $rawMessage .= "To: <{$email}>\r\n";
            $rawMessage .= "Subject: {$subject}\r\n";
            $rawMessage .= "MIME-Version: 1.0\r\n";
            $rawMessage .= "Content-Type: text/html; charset=utf-8\r\n";
            $rawMessage .= "Content-Transfer-Encoding: quoted-printable\r\n\r\n";
            $rawMessage .= $email_message_html;

            $mime = rtrim(strtr(base64_encode($rawMessage), '+/', '-_'), '=');
            $message->setRaw($mime);

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

    public function verify_otp_and_get_addresses()
    {
        $input_data = json_decode($this->input->raw_input_stream, true);
        $email = $input_data['email'] ?? null;
        $entered_otp = $input_data['otp'] ?? null;

        $response_data = ['success' => false, 'message' => ''];
        $http_status = 400;

        if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $response_data['message'] = 'Email is required for OTP verification.';
        } elseif (empty($entered_otp)) {
            $response_data['message'] = 'OTP not provided.';
        } else {
            $otp_record = $this->User_model->find_valid_otp($email, $entered_otp);

            if (!$otp_record) {
                $response_data['message'] = 'Invalid, expired, or already used OTP. Please request a new one.';
                $http_status = 401;
            } else {
                $mark_used_success = $this->User_model->mark_otp_as_used($otp_record['id']);
                if (!$mark_used_success) {
                    log_message('error', 'VERIFY_OTP_AND_GET_ADDRESSES: Failed to mark OTP as used for ID: ' . $otp_record['id']);
                }

                $user = null;
                $user_id = null;
                $addresses = [];

                $user = $this->User_model->get_user_by_identifier($email);
                if ($user) {
                    $user_id = $user['id'];
                    $addresses = $this->User_model->get_user_addresses($user_id);
                } else {
                    $new_user_id = $this->User_model->create_user_if_not_exists($email);
                    if ($new_user_id) {
                        $user_id = $new_user_id;
                        $response_data['message'] = 'OTP verified. New user account created.';
                    } else {
                        log_message('error', 'Failed to create new user account after OTP verification for email: ' . $email);
                        $response_data['message'] = 'OTP verified, but failed to process user account.';
                        $http_status = 500;
                        goto send_response;
                    }
                }

                $response_data['success'] = true;
                $response_data['message'] = $response_data['message'] ?: 'OTP verified successfully!';
                $response_data['user_id'] = $user_id;
                $response_data['email'] = $email;
                $response_data['phone'] = $otp_record['phone'];
                $response_data['addresses'] = $addresses;
                $http_status = 200;
            }
        }

        send_response:
        $this->output->set_status_header($http_status)->set_output(json_encode($response_data));
    }

    public function get_addresses_by_user_id()
    {
        $json_data = file_get_contents('php://input');
        $data = json_decode($json_data, true);

        $user_id = $data['user_id'] ?? null;

        if (empty($user_id) || !is_numeric($user_id) || $user_id <= 0) {
            $response = ['success' => false, 'message' => 'Invalid user ID provided.'];
            $this->output
                ->set_content_type('application/json')
                ->set_output(json_encode($response));
            return;
        }

        $addresses = $this->User_model->get_user_addresses($user_id);

        if ($addresses !== null) {
            $response = ['success' => true, 'addresses' => $addresses];
        } else {
            $response = ['success' => false, 'message' => 'Failed to retrieve addresses.'];
        }

        $this->output
            ->set_content_type('application/json')
            ->set_output(json_encode($response));
    }
}
