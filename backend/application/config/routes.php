<?php
defined('BASEPATH') OR exit('No direct script access allowed');

$route['default_controller'] = 'welcome';
$route['404_override'] = '';
$route['translate_uri_dashes'] = FALSE;

$route['products/slug/(:any)'] = 'products/slug/$1';

$route['api/products'] = 'api/products';
$route['api/categories'] = 'api/categories';
$route['api/product_detail/(:num)'] = 'api/product_detail/$1'; // New route for product detail

$route['api/coupons'] = 'api_controller/get_all_coupons';
$route['api/coupons/(:any)'] = 'api_controller/get_coupon/$1'; // If you need single coupon lookup

$route['checkout'] = 'checkout';
$route['checkout/place_order'] = 'checkout/place_order';

$route['checkout/get_order_details/(:num)'] = 'checkout/get_order_details/$1';

$route['customer/details/(:num)'] = 'customer/details/$1'; // Route for fetching user details by ID
$route['customer/addresses/(:num)'] = 'customer/addresses/$1';

