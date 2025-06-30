<?php
defined('BASEPATH') or exit('No direct script access allowed');

class Checkout extends CI_Controller
{

    public function __construct()
    {
        parent::__construct();
        $this->load->model('Order_model');
        $this->load->model('User_model'); // Ensure User_model is loaded
        $this->load->library(['form_validation', 'session']);
        $this->load->helper(['url', 'form']);

        // --- CORS Configuration for Development ---
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
            $this->output->set_status_header(400); // Bad Request
            echo json_encode(['success' => false, 'message' => 'No data provided in the request body.']);
            return;
        }

        // Extract data from frontend payload
        $user_auth_context = $input['user_auth_context'] ?? [];
        $user_id_from_auth_context = $user_auth_context['user_id'] ?? null; // Prefer user_id from OTP verification response if present
        $email_from_auth_context = $user_auth_context['email'] ?? null; // Email from OTP login
        $otp_verified = $user_auth_context['otp_verified'] ?? false; // Flag from OTP login

        $shippingDetails    = $input['shipping_details'] ?? [];
        $orderSummary       = $input['order_summary'] ?? [];
        $cartItems          = $input['cart_items'] ?? [];
        $agreedToTerms      = $input['agreed_to_terms'] ?? false;
        $paymentMethod      = $input['payment_method'] ?? null;

        // Flags from frontend that determine address saving logic
        $address_id_from_frontend = $shippingDetails['address_id'] ?? null; // ID if an existing address was selected/edited
        // This 'is_address_from_saved' flag must be explicitly sent from Angular based on UI action
        $is_address_from_saved_selection = $shippingDetails['is_address_from_saved'] ?? false;
        $create_account_flag_from_form = $shippingDetails['createAccount'] ?? false;


        // Server-Side Validation (add more as needed)
        if (empty($cartItems)) {
            $this->output->set_status_header(400)->set_output(json_encode(['success' => false, 'message' => 'Cart is empty. Cannot place order.']));
            return;
        }
        if (!$agreedToTerms) {
            $this->output->set_status_header(400)->set_output(json_encode(['success' => false, 'message' => 'Please agree to the terms and conditions.']));
            return;
        }
        if (empty($shippingDetails['email']) || !filter_var($shippingDetails['email'], FILTER_VALIDATE_EMAIL)) {
            $this->output->set_status_header(400)->set_output(json_encode(['success' => false, 'message' => 'A valid email is required for shipping details.']));
            return;
        }
        // Add more validation for required shipping fields (firstName, address1, city, state, zipCode etc.)


        // Start a database transaction for atomicity
        $this->db->trans_begin();

        try {
            $user_id = NULL; // Initialize user_id for the order

            // --- Determine User ID for the Order ---

            // 1. Prioritize user_id if already established and sent from the frontend (e.g., after OTP login)
            if ($user_id_from_auth_context !== null) {
                $user_id = $user_id_from_auth_context;
                log_message('info', 'PLACE_ORDER: User ID from OTP auth context: ' . $user_id);
            }
            // 2. Fallback: Check if user is logged in via traditional CI session (if applicable for your app)
            elseif ($this->session->userdata('user_id')) {
                $user_id = $this->session->userdata('user_id');
                log_message('info', 'PLACE_ORDER: User ID from CI session: ' . $user_id);
            }
            // 3. If no user_id, and OTP was just verified, try to identify/create user by email used for OTP
            // This is the common path for first-time OTP users or existing users logging in via OTP
            elseif ($otp_verified && !empty($email_from_auth_context)) {
                $user_id = $this->User_model->create_user_if_not_exists($email_from_auth_context);
                if (!$user_id) {
                    throw new Exception('Failed to identify or create user account after OTP verification.');
                }
                log_message('info', 'PLACE_ORDER: Identified/Created user ' . $user_id . ' based on OTP email: ' . $email_from_auth_context);
            }
            // 4. Handle Guest checkout OR new account creation without prior OTP verification
            // This path would be taken if user just fills the form without prior login/OTP
            elseif (!empty($shippingDetails['email'])) { // Use email as identifier for guest/new account
                 // Try to find user by the email entered in the shipping form
                $user_from_shipping_email = $this->User_model->get_user_by_identifier($shippingDetails['email']);

                if ($user_from_shipping_email) {
                    $user_id = $user_from_shipping_email['id'];
                    log_message('info', 'PLACE_ORDER: Existing user identified by shipping email: ' . $user_id);
                    // Optionally update user info if createAccount is true and they just updated fields
                    if ($create_account_flag_from_form) { // If they checked "create account" and are an existing user
                         $this->User_model->update_user($user_id, [ // Make sure User_model has an update_user method
                            'first_name' => $shippingDetails['firstName'],
                            'last_name'  => $shippingDetails['lastName'] ?? null,
                            'phone'      => $shippingDetails['phone'] // Update phone if applicable
                         ]);
                        log_message('info', 'PLACE_ORDER: Existing user updated with new shipping details: ' . $user_id);
                    }
                } elseif ($create_account_flag_from_form) {
                    // Create a brand new user account if 'createAccount' is checked and user doesn't exist
                    $user_id = $this->User_model->create_user_if_not_exists($shippingDetails['email']);
                    if (!$user_id) {
                        throw new Exception('Failed to create new user account from checkout form.');
                    }
                    log_message('info', 'PLACE_ORDER: New user account created from checkout form: ' . $user_id);
                } else {
                    // It's a pure guest checkout, user_id remains NULL.
                    log_message('info', 'PLACE_ORDER: Pure guest checkout (user_id will be NULL).');
                }
            }
            // --- End User ID Determination ---


            // --- Logic to Save/Update Address in `user_addresses` table ---
            // This ensures manual entries or edits are saved for identified users.
            if ($user_id !== null) { // Only save/update address if a user_id is established
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
                    'type'       => 'shipping', // or 'both'
                    'is_default_billing' => 0, // Default these or derive from form
                    'is_default_shipping' => 1,
                    'is_active'  => 1
                ];

                $saved_address_id = null;

                if ($is_address_from_saved_selection && $address_id_from_frontend) {
                    // Case 1: User selected an existing address from saved list (frontend should not send full form data in this scenario, just address_id)
                    // If frontend sent full form data AND an address_id, it might be an edit of a saved address.
                    // For now, if address_id is provided AND is_address_from_saved is true, assume it was already saved
                    // and we just need its ID. If it's an edit, frontend should handle setting address_id AND NOT setting is_address_from_saved.
                    $saved_address_id = $address_id_from_frontend; // Use the ID passed from frontend
                    log_message('info', 'PLACE_ORDER: User selected existing address ID: ' . $saved_address_id);
                }
                // Case 2: User manually entered a new address OR edited an existing one.
                // In this case, frontend should *not* set is_address_from_saved to true.
                // If address_id is present, it's an edit. Otherwise, it's a new address.
                else {
                    if ($address_id_from_frontend) {
                        // User edited an existing address (passed ID, but not flagged as 'from_saved_selection')
                        $this->User_model->update_user_address($address_id_from_frontend, $user_id, $address_to_save_update); // Needs update method
                        $saved_address_id = $address_id_from_frontend;
                        log_message('info', 'PLACE_ORDER: Existing address updated for user ID: ' . $user_id . ' Address ID: ' . $saved_address_id);
                    } else {
                        // User entered a brand new address (no ID from frontend)
                        $saved_address_id = $this->User_model->save_user_address($address_to_save_update);
                        if (!$saved_address_id) {
                            log_message('error', 'PLACE_ORDER: Failed to save new user address for user ID: ' . $user_id);
                            // Decide if this should throw an exception and roll back or continue (if guest allowed)
                        } else {
                            log_message('info', 'PLACE_ORDER: New address saved for user ID: ' . $user_id . ' Address ID: ' . $saved_address_id);
                        }
                    }
                }
            }
            // --- END: Logic to save/update address ---


            // Prepare order data
            $orderData = [
                'user_id'                 => $user_id, // This will now hold the determined user_id (or NULL for pure guest)
                // Shipping details captured from the form/selected address
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
            log_message('info', 'Order inserted with ID: ' . $order_id);

            // Insert order items
            $orderItemsToInsert = [];
            foreach ($cartItems as $item) {
                $productName = $item['product']['name'] ?? 'Unknown Product';
                $productPrice = floatval($item['product']['special_price'] ?? 0.00);
                $quantity = intval($item['quantity'] ?? 1);

                $orderItemsToInsert[] = [
                    'order_id'       => $order_id,
                    'product_id'     => $item['product_id'] ?? null,
                    'product_name'   => $productName,
                    'quantity'       => $quantity,
                    'price_at_order' => $productPrice,
                    'total'          => $quantity * $productPrice,
                ];
            }

            if (empty($orderItemsToInsert)) {
                throw new Exception('No valid cart items to process for order ID: ' . $order_id);
            }

            if (!$this->Order_model->insert_order_items($orderItemsToInsert)) {
                throw new Exception('Failed to save order items for order ID: ' . $order_id);
            }
            log_message('info', 'Order items saved for order ID: ' . $order_id);

            // Handle payment gateway specific logic (Razorpay example)
            if ($paymentMethod === 'Razorpay') {
                $this->db->trans_commit();
                $this->output->set_content_type('application/json')->set_status_header(201);
                echo json_encode([
                    'success' => true,
                    'message' => 'Order placed, awaiting Razorpay payment initiation.',
                    'order_id' => $order_id,
                    // You might return Razorpay order details here
                ]);
                return;
            }

            $this->db->trans_commit(); // Commit the transaction if all successful

            $this->output->set_content_type('application/json')->set_status_header(201);
            echo json_encode(['success' => true, 'message' => 'Order placed successfully!', 'order_id' => $order_id]);
        } catch (Exception $e) {
            $this->db->trans_rollback(); // Rollback on any error
            log_message('error', 'Order placement failed: ' . $e->getMessage());
            $this->output->set_content_type('application/json')->set_status_header(500);
            echo json_encode(['success' => false, 'message' => 'An internal server error occurred while placing your order. Please try again.']);
        }
    }

    public function get_order_details($order_id = null)
    {
        $this->output->set_content_type('application/json');

        if (empty($order_id) || !is_numeric($order_id)) {
            $this->output->set_status_header(400);
            echo json_encode(['success' => false, 'message' => 'Invalid or missing Order ID.']);
            return;
        }

        $order = $this->Order_model->get_order_by_id($order_id);

        if (!$order) {
            $this->output->set_status_header(404);
            echo json_encode(['success' => false, 'message' => 'Order not found.']);
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

        $this->output->set_status_header(200);
        echo json_encode($response_data);
    }
}