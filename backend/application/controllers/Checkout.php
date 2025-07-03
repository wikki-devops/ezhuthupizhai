<?php
defined('BASEPATH') or exit('No direct script access allowed');

class Checkout extends CI_Controller
{
    public function __construct()
    {
        parent::__construct();
        $this->load->model('Order_model');
        $this->load->model('User_model');
        $this->load->library(['form_validation', 'session']);
        $this->load->helper(['url', 'form']);

        header('Access-Control-Allow-Origin: http://localhost:4200');
        header('Access-Control-Allow-Methods: GET, POST, OPTIONS, PUT, DELETE');
        header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
        header('Access-Control-Allow-Credentials: true');

        if ($this->input->method() === 'options') {
            $this->output->set_status_header(200);
            exit();
        }
    }

    public function place_order()
    {
        $input = json_decode($this->input->raw_input_stream, true);

        if (empty($input)) {
            $this->output->set_status_header(400)->set_output(json_encode(['success' => false, 'message' => 'No data provided.']));
            return;
        }

        $user_auth_context = $input['user_auth_context'] ?? [];
        $user_id_from_auth_context = $user_auth_context['user_id'] ?? null;
        $email_from_auth_context = $user_auth_context['email'] ?? null;
        $otp_verified = $user_auth_context['otp_verified'] ?? false;

        $shippingDetails    = $input['shipping_details'] ?? [];
        $orderSummary       = $input['order_summary'] ?? [];
        $cartItems          = $input['cart_items'] ?? [];
        $agreedToTerms      = $input['agreed_to_terms'] ?? false;
        $paymentMethod      = $input['payment_method'] ?? null;

        $address_id_from_frontend = $shippingDetails['address_id'] ?? null;
        $is_address_from_saved_selection = $shippingDetails['is_address_from_saved'] ?? false;
        $create_account_flag_from_form = $shippingDetails['createAccount'] ?? false;

        // Server-Side Validation
        if (empty($cartItems)) {
            $this->output->set_status_header(400)->set_output(json_encode(['success' => false, 'message' => 'Cart is empty.']));
            return;
        }
        if (!$agreedToTerms) {
            $this->output->set_status_header(400)->set_output(json_encode(['success' => false, 'message' => 'Please agree to the terms and conditions.']));
            return;
        }
        if (empty($shippingDetails['email']) || !filter_var($shippingDetails['email'], FILTER_VALIDATE_EMAIL)) {
            $this->output->set_status_header(400)->set_output(json_encode(['success' => false, 'message' => 'A valid email is required.']));
            return;
        }
        if (empty($shippingDetails['firstName']) || empty($shippingDetails['phone']) || empty($shippingDetails['address1']) || empty($shippingDetails['city']) || empty($shippingDetails['state']) || empty($shippingDetails['zipCode']) || empty($shippingDetails['country'])) {
            $this->output->set_status_header(400)->set_output(json_encode(['success' => false, 'message' => 'All shipping address fields are required.']));
            return;
        }

        $this->db->trans_begin();

        try {
            $user_id = NULL;

            $common_user_data_from_shipping = [
                'first_name' => $shippingDetails['firstName'] ?? null,
                'last_name'  => $shippingDetails['lastName'] ?? null,
                'phone'      => $shippingDetails['phone'] ?? null
            ];

            // Determine User ID for the Order
            if ($user_id_from_auth_context !== null) {
                $user_id = $user_id_from_auth_context;
            } elseif ($this->session->userdata('user_id')) {
                $user_id = $this->session->userdata('user_id');
            } elseif ($otp_verified && !empty($email_from_auth_context)) {
                $user_id = $this->User_model->create_user_if_not_exists($email_from_auth_context, $common_user_data_from_shipping);
                if (!$user_id) {
                    throw new Exception('Failed to identify or create user account after OTP verification.');
                }
            } elseif (!empty($shippingDetails['email'])) {
                $user_from_shipping_email = $this->User_model->get_user_by_identifier($shippingDetails['email']);

                if ($user_from_shipping_email) {
                    $user_id = $user_from_shipping_email['id'];
                    if ($create_account_flag_from_form || ($user_from_shipping_email['first_name'] === null && !empty($shippingDetails['firstName']))) {
                        $this->User_model->update_user($user_id, $common_user_data_from_shipping);
                    }
                } elseif ($create_account_flag_from_form) {
                    $user_id = $this->User_model->create_user_if_not_exists($shippingDetails['email'], $common_user_data_from_shipping);
                    if (!$user_id) {
                        throw new Exception('Failed to create new user account from checkout form.');
                    }
                }
            }

            // Save/Update Address in `user_addresses` table for identified users
            if ($user_id !== null) {
                $address_to_save_update = [
                    'user_id'    => $user_id,
                    'first_name' => $shippingDetails['firstName'],
                    'last_name'  => $shippingDetails['lastName'] ?? null,
                    'phone'      => $shippingDetails['phone'],
                    'email'      => $shippingDetails['email'],
                    'address1'   => $shippingDetails['address1'],
                    'address2'   => $shippingDetails['address2'] ?? null,
                    'city'       => $shippingDetails['city'],
                    'state'      => $shippingDetails['state'],
                    'zip_code'   => $shippingDetails['zipCode'],
                    'country'    => $shippingDetails['country'],
                    'type'       => 'shipping',
                    'is_default_billing' => 0,
                    'is_default_shipping' => 1,
                    'is_active'  => 1
                ];

                $saved_address_id = null;

                if ($is_address_from_saved_selection && $address_id_from_frontend) {
                    $saved_address_id = $address_id_from_frontend;
                } else {
                    if ($address_id_from_frontend) {
                        $this->User_model->update_user_address($address_id_from_frontend, $user_id, $address_to_save_update);
                        $saved_address_id = $address_id_from_frontend;
                    } else {
                        $saved_address_id = $this->User_model->save_user_address($address_to_save_update);
                        if (!$saved_address_id) {
                            throw new Exception('Failed to save new shipping address.');
                        }
                    }
                }
            }

            // Prepare and insert the main order record
            $orderData = [
                'user_id'                 => $user_id,
                'first_name'              => $shippingDetails['firstName'],
                'last_name'               => $shippingDetails['lastName'] ?? null,
                'email'                   => $shippingDetails['email'],
                'phone'                   => $shippingDetails['phone'],
                'address1'                => $shippingDetails['address1'],
                'address2'                => $shippingDetails['address2'] ?? null,
                'city'                    => $shippingDetails['city'],
                'state'                   => $shippingDetails['state'],
                'zip_code'                => $shippingDetails['zipCode'],
                'country'                 => $shippingDetails['country'],
                'order_notes'             => $shippingDetails['orderNotes'] ?? null,
                'payment_method'          => $paymentMethod,
                'subtotal'                => $orderSummary['subtotal'],
                'coupon_discount'         => $orderSummary['coupon_discount'],
                'subtotal_after_discount' => $orderSummary['subtotal_after_discount'],
                'delivery_charge'         => $orderSummary['delivery_charge'],
                'final_total'             => $orderSummary['final_total'],
                'status'                  => ($paymentMethod === 'COD') ? 'pending' : 'pending_payment',
            ];

            $order_id = $this->Order_model->insert_order($orderData);

            if (! $order_id) {
                throw new Exception('Failed to save order to database.');
            }

            // Prepare and insert order items
            $orderItemsToInsert = [];
            foreach ($cartItems as $item) {
                $productId = $item['product_id'] ?? null;
                $productName = $item['product_name'] ?? 'Unknown Product';
                $priceAtOrder = floatval($item['price_at_order'] ?? 0.00);
                $quantity = intval($item['quantity'] ?? 1);
                $byobItemsList = $item['byob_items_list'] ?? null;

                if ($quantity <= 0 || $priceAtOrder < 0) {
                    continue;
                }

                $orderItemsToInsert[] = [
                    'order_id'       => $order_id,
                    'product_id'     => $productId,
                    'product_name'   => $productName,
                    'quantity'       => $quantity,
                    'price_at_order' => $priceAtOrder,
                    'total'          => $quantity * $priceAtOrder,
                    'byob_items_list' => $byobItemsList, // Include BYOB specific data
                ];
            }

            if (empty($orderItemsToInsert)) {
                throw new Exception('No valid cart items to process for order ID: ' . $order_id);
            }

            if (!$this->Order_model->insert_order_items($orderItemsToInsert)) {
                throw new Exception('Failed to save order items for order ID: ' . $order_id);
            }

            // Handle payment gateway specific logic
            if ($paymentMethod === 'Razorpay') {
                $this->db->trans_commit();
                $this->output->set_content_type('application/json')->set_status_header(201);
                echo json_encode([
                    'success' => true,
                    'message' => 'Order placed, awaiting Razorpay payment initiation.',
                    'order_id' => $order_id,
                ]);
                return;
            }

            $this->db->trans_commit();

            $this->output->set_content_type('application/json')->set_status_header(201);
            echo json_encode(['success' => true, 'message' => 'Order placed successfully!', 'order_id' => $order_id]);

        } catch (Exception $e) {
            $this->db->trans_rollback();
            // In production, you might only log $e->getMessage() for security
            log_message('error', 'Order placement failed: ' . $e->getMessage());
            $this->output->set_content_type('application/json')->set_status_header(500);
            echo json_encode(['success' => false, 'message' => 'An internal server error occurred while placing your order. Please try again.']);
        }
    }

    public function get_order_details($order_id = null)
    {
        $this->output->set_content_type('application/json');

        if (empty($order_id) || !is_numeric($order_id)) {
            $this->output->set_status_header(400)->set_output(json_encode(['success' => false, 'message' => 'Invalid or missing Order ID.']));
            return;
        }

        $order = $this->Order_model->get_order_by_id($order_id);

        if (!$order) {
            $this->output->set_status_header(404)->set_output(json_encode(['success' => false, 'message' => 'Order not found.']));
            return;
        }

        $order_items = $this->Order_model->get_order_items($order_id);

        $response_data = [
            'success' => true,
            'message' => 'Order details fetched successfully.',
            'order_details' => [
                'id'                     => $order['id'],
                'first_name'             => $order['first_name'],
                'last_name'              => $order['last_name'],
                'email'                  => $order['email'],
                'phone'                  => $order['phone'],
                'address1'               => $order['address1'],
                'address2'               => $order['address2'],
                'city'                   => $order['city'],
                'state'                  => $order['state'],
                'zip_code'               => $order['zip_code'],
                'country'                => $order['country'],
                'order_notes'            => $order['order_notes'],
                'payment_method'         => $order['payment_method'],
                'subtotal'               => floatval($order['subtotal']),
                'coupon_discount'        => floatval($order['coupon_discount']),
                'subtotal_after_discount' => floatval($order['subtotal_after_discount']),
                'delivery_charge'        => floatval($order['delivery_charge']),
                'final_total'            => floatval($order['final_total']),
                'status'                 => $order['status'],
                'created_at'             => $order['created_at'],
                'order_items'            => $order_items,
            ]
        ];

        $this->output->set_status_header(200)->set_output(json_encode($response_data));
    }
}