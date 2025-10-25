#!/usr/bin/env bash

set -e

ACTION=${1:-"status"}
DISKS=("user-db-disk" "group-db-disk" "message-db-disk")
ZONE="us-west1-c"
PROJECT="agisit25-g33"

# Set the active project
echo "🔧 Setting active project to: $PROJECT"
gcloud config set project $PROJECT

case $ACTION in
    "create")
        for disk in "${DISKS[@]}"; do
            if ! gcloud compute disks describe "$disk" --zone="$ZONE" >/dev/null 2>&1; then
                echo "🚀 Creating persistent disk: $disk"
                gcloud compute disks create "$disk" \
                    --size=5GB \
                    --zone="$ZONE" \
                    --type=pd-standard
                echo "✅ Disk $disk created successfully"
            else
                echo "✅ Persistent disk $disk already exists"
            fi
        done
        ;;
    "destroy")
        echo "❌ WARNING: This will PERMANENTLY DELETE all database disks and ALL DATA!"
        read -p "Are you absolutely sure? (type 'YES' to confirm): " -r
        if [[ $REPLY == "YES" ]]; then
            for disk in "${DISKS[@]}"; do
                gcloud compute disks delete "$disk" --zone="$ZONE" --quiet
                echo "✅ Deleted disk: $disk"
            done
        else
            echo "ℹ️  Operation cancelled"
        fi
        ;;
    "status"|*)
        echo "📊 Persistent Disks Status in project $PROJECT:"
        for disk in "${DISKS[@]}"; do
            if gcloud compute disks describe "$disk" --zone="$ZONE" >/dev/null 2>&1; then
                SIZE=$(gcloud compute disks describe "$disk" --zone="$ZONE" --format="value(sizeGb)")
                echo "✅ $disk: EXISTS (${SIZE}GB)"
            else
                echo "❌ $disk: NOT FOUND"
            fi
        done
        ;;
esac