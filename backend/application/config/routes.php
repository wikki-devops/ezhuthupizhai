<?php
defined('BASEPATH') OR exit('No direct script access allowed');

$route['default_controller'] = 'welcome';
$route['404_override'] = '';
$route['translate_uri_dashes'] = FALSE;

$route['api/products'] = 'api/products';
$route['api/categories'] = 'api/categories';
$route['api/product_detail/(:num)'] = 'api/product_detail/$1'; // New route for product detail

