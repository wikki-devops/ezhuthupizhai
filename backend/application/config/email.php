<?php
defined('BASEPATH') OR exit('No direct script access allowed');

// Gmail API OAuth2 Credentials
$config['gmail_email']       = 'iloveadyar@gmail.com'; // Your Gmail email address
$config['gmail_client_id']   = '1074648762010-sb6qn1gj163u9m7059is183v9k2nbvtf.apps.googleusercontent.com';
$config['gmail_client_secret'] = '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';
$config['gmail_refresh_token'] = '1//042IbyInj3FfmCgYIARAAGAQSNwF-L9Ir7uZfOlJci5ktWcdRzS8DvLMB4BvLIFw3_eQPqRMVqsfMm-LrjlR72IpToMPaUDyUwpQ';

// General Email Settings (these are mostly placeholders as direct API is used for sending)
$config['protocol']    = 'smtp';
$config['smtp_host']   = 'smtp.gmail.com';
$config['smtp_port']   = 587;
$config['smtp_crypto'] = 'tls';
$config['charset']     = 'utf-8';
$config['newline']     = "\r\n";
$config['mailtype']    = 'html'; // Can be 'text' or 'html'
$config['validation']  = TRUE;

// Custom Email Templates and Sender Info
$config['from_email'] = 'iloveadyar@gmail.com'; // IMPORTANT: This should be your authenticated Gmail API email
$config['from_name']  = 'Ezhuthupizhai Support'; // Your application's name for emails

// OTP Email Templates
$config['otp_email_subject_template'] = 'Your {APP_NAME} OTP Code';
$config['otp_email_body_template'] = '
    <p>Dear User,</p>
    <p>Your One-Time Password (OTP) for {APP_NAME} is: <strong>{OTP_CODE}</strong></p>
    <p>This OTP is valid for {OTP_VALIDITY_MINUTES} minutes. Please do not share this code with anyone.</p>
    <p>If you did not request this OTP, please ignore this email.</p>
    <p>Thank you,<br>The {APP_NAME} Team</p>
';