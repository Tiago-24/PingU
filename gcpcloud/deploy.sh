#!/usr/bin/env bash

# --- FIX: mark /root and current directory as safe ---
git config --global --add safe.directory /root || true
git config --global --add safe.directory "$(pwd)" || true
# -----------------------------------------------------

# Find gcpcloud directory
REPO_ROOT="$(git rev-parse --show-toplevel)"
GCP_DIR="$REPO_ROOT/gcpcloud"
PUSH_IMG_SCRIPT="push_images.sh"

# === GCP AUTHENTICATION AUTO ===
KEY_PATH="$GCP_DIR/secrets/gcp-key.json"
PROJECT_ID="agisit25-g33"
ZONE="us-west1-c"

if gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q "@"; then
  echo "✅ GCP already authenticated as $(gcloud config get-value account)"
else
  echo "🔐 Authenticating with Service Account..."
  if [[ ! -f "$KEY_PATH" ]]; then
    echo "❌ ERROR: Service account key not found at $KEY_PATH"
    exit 1
  fi
  gcloud auth activate-service-account --key-file="$KEY_PATH"
  gcloud config set project "$PROJECT_ID"
  gcloud config set compute/zone "$ZONE"
  echo "✅ Authenticated with Service Account successfully."
fi


# === PERSISTENT DISKS MANAGEMENT ===
manage_persistent_disks() {
    local action=$1
    local disks=("user-db-disk" "group-db-disk" "message-db-disk")
    local zone="us-west1-c"
    local project="agisit25-g33"
    
    # Set the active project
    echo "🔧 Setting active project to: $project"
    gcloud config set project $project
    
    for disk in "${disks[@]}"; do
        case $action in
            "create")
                if ! gcloud compute disks describe "$disk" --zone="$zone" >/dev/null 2>&1; then
                    echo "🚀 Creating persistent disk: $disk"
                    gcloud compute disks create "$disk" \
                        --size=10GB \
                        --zone="$zone" \
                        --type=pd-standard
                    echo "✅ Disk $disk created successfully"
                else
                    echo "✅ Persistent disk $disk already exists"
                fi
                ;;
            "destroy")
                read -p "❌ Are you sure you want to delete persistent disk $disk? This will DELETE ALL DATA! (y/N): " -n 1 -r
                echo
                if [[ $REPLY =~ ^[Yy]$ ]]; then
                    gcloud compute disks delete "$disk" --zone="$zone" --quiet
                    echo "✅ Disk $disk deleted"
                else
                    echo "ℹ️  Disk $disk was NOT deleted"
                fi
                ;;
        esac
    done
}

# Main deployment flow
echo "=== Managing Persistent Disks ==="
manage_persistent_disks "create"

terraform init

# Setup MGMT ssh key
echo "Setup MGMT node ssh key"
ssh-keygen -t RSA

# Set up infrastructure using Terraform
echo "Setting up infrastructure"
terraform plan
terraform apply --auto-approve

# Get IP addresses
echo "VM IP addresses"
MASTER_IP=$(terraform output -json master | jq -r '.')
WORKER1_IP=$(terraform output -json worker_IPs | jq -r '.[0]' | sed 's/.*= //' | xargs)
WORKER2_IP=$(terraform output -json worker_IPs | jq -r '.[1]' | sed 's/.*= //' | xargs)
WORKER3_IP=$(terraform output -json worker_IPs | jq -r '.[2]' | sed 's/.*= //' | xargs)
WORKER4_IP=$(terraform output -json worker_IPs | jq -r '.[3]' | sed 's/.*= //' | xargs)

echo "MASTER_IP: $MASTER_IP"
echo "WORKER1_IP: $WORKER1_IP"
echo "WORKER2_IP: $WORKER2_IP"
echo "WORKER3_IP: $WORKER3_IP"
echo "WORKER4_IP: $WORKER4_IP"

# Update gcphosts file with VM IPs
echo "Updating gcphosts"
sed -i '/^\[targets\]/,$d' gcphosts  # Remove from [targets] to end
cat >> gcphosts <<EOF
[targets]
master ansible_host=$MASTER_IP ansible_user=ubuntu ansible_connection=ssh
worker1 ansible_host=$WORKER1_IP ansible_user=ubuntu ansible_connection=ssh
worker2 ansible_host=$WORKER2_IP ansible_user=ubuntu ansible_connection=ssh
worker3 ansible_host=$WORKER3_IP ansible_user=ubuntu ansible_connection=ssh
worker4 ansible_host=$WORKER4_IP ansible_user=ubuntu ansible_connection=ssh
EOF

echo "Generate shared .env file with all service URLs"
cat > ".env" <<EOF
# Shared .env with all service URLs (using GCP IPs)

REACT_APP_INGRESS_URL=http://$WORKER1_IP:31577

# Auth/JWT
SECRET_KEY=change-me-to-a-long-random-string
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
EOF

# Wait for SSH to be ready on all hosts
echo "Waiting for SSH connectivity on all hosts..."
for host in master worker1 worker2 worker3 worker4; do
  ip=$(grep "$host ansible_host" gcphosts | awk '{print $2}' | cut -d'=' -f2)
  echo "Waiting for SSH on $host ($ip)..."
  until ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 -o UserKnownHostsFile=/dev/null ubuntu@$ip 'echo SSH ready on $host'; do
    echo "SSH not ready on $host, retrying in 10s..."
    sleep 10
  done
  echo "SSH ready on $host"
done

# === MOUNT PERSISTENT DISKS TO VMs ===
echo "Mounting persistent disks to worker nodes..."
mount_disk_to_vm() {
    local vm_name=$1
    local disk_name=$2
    local mount_point=$3
    
    echo "Mounting $disk_name to $vm_name at $mount_point"
    
    gcloud compute instances attach-disk $vm_name \
        --disk $disk_name \
        --zone us-west1-c \
        --device-name $disk_name
    
    gcloud compute ssh $vm_name --zone=us-west1-c --command "
        sudo mkdir -p $mount_point
        if ! sudo blkid /dev/disk/by-id/google-$disk_name | grep -q ext4; then
            echo 'Formatting disk $disk_name...'
            sudo mkfs.ext4 -m 0 -F -E lazy_itable_init=0,lazy_journal_init=0,discard /dev/disk/by-id/google-$disk_name
        fi
        sudo mount -o discard,defaults /dev/disk/by-id/google-$disk_name $mount_point
        sudo mkdir -p $mount_point/pgdata
        sudo chown -R 999:999 $mount_point/pgdata
        sudo chmod -R 750 $mount_point/pgdata
        echo '/dev/disk/by-id/google-$disk_name $mount_point ext4 defaults 0 0' | sudo tee -a /etc/fstab
        echo '✅ Disk $disk_name mounted on $vm_name with pgdata directory'
    "
}

mount_disk_to_vm "worker1" "user-db-disk" "/mnt/user-db-data"
mount_disk_to_vm "worker2" "group-db-disk" "/mnt/group-db-data"  
mount_disk_to_vm "worker3" "message-db-disk" "/mnt/message-db-data"

echo "Configuring nodes"
ansible-playbook ansible-gcp-configure-nodes.yml

echo "Installing Kubernetes on nodes"
ansible-playbook ansible-k8s-install.yml

echo "Creating cluster"
ansible-playbook ansible-create-cluster.yml

echo "Workers joining"
ansible-playbook ansible-workers-join.yml

echo ">>> Deploying monitoring stack (Prometheus + Grafana via Helm)"
ansible-playbook ansible-deploy-monitoring.yml

echo "Deploying microservices"
ansible-playbook ansible-start-deployment.yml

# === GET INGRESS PORT AUTOMATICALLY ===
echo "Fetching Ingress NodePort from master..."
INGRESS_PORT=$(ssh -o StrictHostKeyChecking=no ubuntu@$MASTER_IP "sudo kubectl -n ingress-nginx get svc ingress-nginx-controller -o=jsonpath='{.spec.ports[?(@.port==80)].nodePort}'" 2>/dev/null)

if [[ -z "$INGRESS_PORT" ]]; then
  echo "⚠️  Could not fetch Ingress port automatically. Please check manually with:"
  echo "   ssh ubuntu@$MASTER_IP 'sudo kubectl -n ingress-nginx get svc'"
  INGRESS_PORT="<UNKNOWN>"
else
  echo "✅ Ingress port detected: $INGRESS_PORT"
fi

# === FIREWALL RULE AUTO-UPDATE ===
FIREWALL_RULE_NAME="allow-ingress-port"
NETWORK_TAG="worker"

if [[ "$INGRESS_PORT" != "<UNKNOWN>" ]]; then
  echo "🌐 Updating firewall rule to allow NodePort ${INGRESS_PORT} ..."

  # Verifica se a regra já existe
  if gcloud compute firewall-rules describe "$FIREWALL_RULE_NAME" --project "$PROJECT_ID" >/dev/null 2>&1; then
    echo "🔁 Updating existing firewall rule: $FIREWALL_RULE_NAME"
    gcloud compute firewall-rules update "$FIREWALL_RULE_NAME" \
      --allow "tcp:${INGRESS_PORT}" \
      --target-tags "$NETWORK_TAG" \
      --priority 1000 \
      --quiet
  else
    echo "🚀 Creating new firewall rule: $FIREWALL_RULE_NAME"
    gcloud compute firewall-rules create "$FIREWALL_RULE_NAME" \
      --allow "tcp:${INGRESS_PORT}" \
      --target-tags "$NETWORK_TAG" \
      --direction INGRESS \
      --priority 1000 \
      --network default \
      --quiet
  fi

  echo "✅ Firewall rule configured to allow external access on port ${INGRESS_PORT}"
else
  echo "⚠️ Skipping firewall update (no ingress port found)."
fi


echo
echo "🎉 Service ready at: http://$WORKER2_IP:$INGRESS_PORT"
echo "💻 To access master node: ssh ubuntu@$MASTER_IP"
