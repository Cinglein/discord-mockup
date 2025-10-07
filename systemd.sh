#!/bin/bash
default_server_path="/home/ec2-user"

# Prompt for service details
read -p "Enter the service name: " service_name
read -p "Enter the server directory (default: ${default_server_path}/${service_name}): " server_path
server_path="${server_path:-$default_server_path}/${service_name}"

# Create the systemd service file
service_file="/etc/systemd/system/${service_name}.service"
sudo touch "${service_file}"

echo "[Unit]
Description=${service_name}
Wants=network-online.target
After=network-online.target

[Service]
Type=simple
ExecStart=${server_path}/${service_name}
WorkingDirectory=${server_path}
Restart=always

[Install]
WantedBy=default.target" | sudo tee "${service_file}" > /dev/null

# Reload systemd to recognize the new service
sudo systemctl daemon-reload

# Enable the service to start at boot
sudo systemctl enable "${service_name}"

echo "Service ${service_name} has been created and enabled. You can start it with:"
echo "sudo systemctl start ${service_name}"
