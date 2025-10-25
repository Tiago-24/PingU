#!/usr/bin/env bash

echo "=== Destroying Kubernetes Infrastructure ==="
terraform destroy -auto-approve

echo "=== Persistent disks were NOT destroyed ==="
echo "To manually destroy persistent disks (WARNING: DATA LOSS), run:"
echo "  ./manage-disks.sh destroy"