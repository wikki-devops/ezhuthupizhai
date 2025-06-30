<?php
ini_set('display_errors', '1');
error_reporting(E_ALL);

echo "PHP is running.<br>";
trigger_error("This is a test error to see if display_errors is working!", E_USER_ERROR);
echo "Script finished.";
?>