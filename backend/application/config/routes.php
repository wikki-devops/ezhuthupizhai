<?php
defined('BASEPATH') or exit('No direct script access allowed');

$route['default_controller'] = 'welcome';
$route['404_override'] = '';
$route['translate_uri_dashes'] = FALSE;

$route['products/slug/(:any)'] = 'products/slug/$1';

$route['api/products'] = 'api/products';
$route['api/categories'] = 'api/categories';
$route['api/product_detail/(:num)'] = 'api/product_detail/$1';

$route['api/coupons'] = 'api_controller/get_all_coupons';
$route['api/coupons/(:any)'] = 'api_controller/get_coupon/$1';
$route['checkout'] = 'checkout';
$route['checkout/place_order'] = 'checkout/place_order';

$route['checkout/get_order_details/(:num)'] = 'checkout/get_order_details/$1';

$route['customer/details/(:num)'] = 'customer/details/$1';
$route['customer/addresses/(:num)'] = 'customer/addresses/$1';

$route['byob/items'] = 'byob/items';
$route['byob/create'] = 'byob/create';
$route['byob/box/(:num)'] = 'byob/box/$1';
$route['byob/add_item'] = 'byob/add_item';
$route['byob/update_item_quantity'] = 'byob/update_item_quantity';
$route['byob/remove_item'] = 'byob/remove_item';
$route['byob/add_to_cart'] = 'byob/add_to_cart';
